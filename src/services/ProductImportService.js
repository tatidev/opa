/**
 * NetSuite Product Import Service
 * Handles importing products and colorways from OPMS to NetSuite
 */

const netsuiteClient = require('./netsuiteClient');
const ProductModel = require('../models/ProductModel');
const ItemModel = require('../models/ItemModel');
const ColorModel = require('../models/ColorModel');
const logger = require('../utils/logger');

class ProductImportService {
  constructor() {
    this.productModel = new ProductModel();
    this.itemModel = new ItemModel();
    this.colorModel = new ColorModel();
  }

  /**
   * Get test products for initial import
   * @param {number} limit - Number of products to select
   * @returns {Promise<Array>} Array of products with their items and colors
   */
  async getTestProducts(limit = 5) {
    try {
      logger.info('Selecting test products for import', { limit });
      
      // Get products with their pricing, vendor information, and use selections
      const products = await this.productModel.executeQuery(`
        SELECT 
          p.id,
          p.name,
          p.type,
          p.width,
          p.vrepeat,
          p.hrepeat,
          p.outdoor,
          p.archived,
          p.in_master,
          pp.p_res_cut,
          pp.p_hosp_cut,
          pp.p_hosp_roll,
          pp.p_dig_res,
          pp.p_dig_hosp,
          pp.date as price_date,
          v.name as vendor_name,
          v.abrev as vendor_abbreviation,
          GROUP_CONCAT(DISTINCT u.name ORDER BY u.name ASC SEPARATOR ', ') as use_names
        FROM T_PRODUCT p
        LEFT JOIN T_PRODUCT_PRICE pp ON p.id = pp.product_id AND pp.product_type = p.type
        LEFT JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
        LEFT JOIN Z_VENDOR v ON pv.vendor_id = v.id
        LEFT JOIN T_PRODUCT_USE pu ON p.id = pu.product_id
        LEFT JOIN P_USE u ON pu.use_id = u.id
        WHERE p.archived = 'N' 
        AND p.type = 'R' 
        AND p.in_master = 1
        GROUP BY p.id, p.name, p.type, p.width, p.vrepeat, p.hrepeat, p.outdoor, p.archived, p.in_master, pp.p_res_cut, pp.p_hosp_cut, pp.p_hosp_roll, pp.p_dig_res, pp.p_dig_hosp, pp.date, v.name, v.abrev
        ORDER BY p.name
        LIMIT ?
      `, [limit]);

      logger.info('Selected products for import', { count: products.length });

      // Get items and colors for each product
      const productsWithItems = await Promise.all(products.map(async (product) => {
        // Get items for this product
        const items = await this.itemModel.executeQuery(`
          SELECT 
            i.id,
            i.product_id,
            i.product_type,
            i.code,
            i.status_id,
            i.stock_status_id,
            i.vendor_color,
            i.vendor_code,
            i.in_master,
            i.archived,
            ps.name as status_name,
            ss.name as stock_status_name
          FROM T_ITEM i
          LEFT JOIN P_PRODUCT_STATUS ps ON i.status_id = ps.id
          LEFT JOIN P_STOCK_STATUS ss ON i.stock_status_id = ss.id
          WHERE i.product_id = ? 
          AND i.product_type = 'R' 
          AND i.archived = 'N'
          ORDER BY i.code
        `, [product.id]);

        // Get colors for each item
        const itemsWithColors = await Promise.all(items.map(async (item) => {
          const colors = await this.colorModel.executeQuery(`
            SELECT 
              c.id,
              c.name,
              c.active,
              ic.n_order
            FROM T_ITEM_COLOR ic
            JOIN P_COLOR c ON ic.color_id = c.id
            WHERE ic.item_id = ?
            AND c.active = 'Y'
            ORDER BY ic.n_order
          `, [item.id]);

          return {
            ...item,
            colors: colors
          };
        }));

        return {
          ...product,
          items: itemsWithColors
        };
      }));

      logger.info('Products with items and colors prepared', { 
        totalProducts: productsWithItems.length,
        totalItems: productsWithItems.reduce((sum, p) => sum + p.items.length, 0)
      });

      return productsWithItems;
    } catch (error) {
      logger.error('Error selecting test products', { error: error.message });
      throw error;
    }
  }

  /**
   * Transform OPMS product data to NetSuite parent item format
   * @param {Object} product - OPMS product data
   * @returns {Object} NetSuite inventory item data
   */
  transformProductToParentItem(product) {
    const itemId = `OPMS-P-${product.id}`;
    
    return {
      itemId: itemId,
      displayName: product.name,
      parent: null, // Top-level parent item
      isLotItem: true, // Enable lot tracking for fabrics
      isSerialItem: false,
      isInactive: false,
      
      // Standard fields
      itemType: 'InvtPart',
      
      // Use existing custom fields that we can find
      // We'll use generic fields until proper custom fields are created
      custitem4: product.in_master === 1, // Using existing boolean field
      custitem_alf_print_item_name: true, // Mark as OPMS item
      
      // For now, we'll put OPMS data in the description until custom fields are created
      description: `OPMS Product ID: ${product.id} | Width: ${product.width} | V-Repeat: ${product.vrepeat} | H-Repeat: ${product.hrepeat} | Outdoor: ${product.outdoor} | Vendor: ${product.vendor_name || 'Unknown'} (${product.vendor_abbreviation || 'N/A'}) | Pricing: Res Cut: ${product.p_res_cut || 'N/A'}, Hosp Roll: ${product.p_hosp_roll || 'N/A'}`
    };
  }

  /**
   * Transform OPMS item data to NetSuite child item format
   * @param {Object} item - OPMS item data
   * @param {Object} product - OPMS product data
   * @returns {Object} NetSuite inventory item data
   */
  transformItemToChildItem(item, product) {
    const itemId = `OPMS-I-${item.id}`;
    const parentId = `OPMS-P-${product.id}`;
    
    // Create display name with color information
    const colorNames = item.colors.map(c => c.name).join(' / ');
    const displayName = colorNames 
      ? `${product.name} - ${colorNames}`
      : `${product.name} - ${item.code || 'No Code'}`;
    
    return {
      itemId: itemId,
      displayName: displayName,
      parent: parentId, // Reference to parent item
      isLotItem: true, // Enable lot tracking for fabrics
      isSerialItem: false,
      isInactive: false,
      
      // Standard fields
      itemType: 'InvtPart',
      
      // Use existing custom fields
      custitem4: item.in_master === 1, // Using existing boolean field
      custitem_alf_print_item_name: true, // Mark as OPMS item
      
      // Put OPMS data in description until custom fields are created
      description: `OPMS Item ID: ${item.id} | Product ID: ${product.id} | Code: ${item.code || 'N/A'} | Vendor Color: ${item.vendor_color || 'N/A'} | Status: ${item.status_name || 'Unknown'} | Stock Status: ${item.stock_status_name || 'Unknown'} | Colors: ${colorNames || 'No Colors'}`
    };
  }

  /**
   * Import a single product as a parent item
   * @param {Object} product - OPMS product data
   * @returns {Promise<Object>} NetSuite creation result
   */
  async importParentItem(product) {
    try {
      logger.info('Importing parent item', { 
        productId: product.id, 
        productName: product.name 
      });

      const parentItemData = this.transformProductToParentItem(product);
      const result = await netsuiteClient.upsertInventoryItem(parentItemData, parentItemData.itemId);
      
      logger.info('Parent item imported successfully', { 
        productId: product.id,
        netsuiteId: result.id,
        itemId: parentItemData.itemId
      });

      return result;
    } catch (error) {
      logger.error('Error importing parent item', { 
        productId: product.id, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Import a single item as a child item
   * @param {Object} item - OPMS item data
   * @param {Object} product - OPMS product data
   * @returns {Promise<Object>} NetSuite creation result
   */
  async importChildItem(item, product) {
    try {
      logger.info('Importing child item', { 
        itemId: item.id, 
        productId: product.id,
        colors: item.colors.length
      });

      const childItemData = this.transformItemToChildItem(item, product);
      const result = await netsuiteClient.upsertInventoryItem(childItemData, childItemData.itemId);
      
      logger.info('Child item imported successfully', { 
        itemId: item.id,
        netsuiteId: result.id,
        netsuiteItemId: childItemData.itemId
      });

      return result;
    } catch (error) {
      logger.error('Error importing child item', { 
        itemId: item.id, 
        productId: product.id,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Import a complete product with all its items
   * @param {Object} product - OPMS product data with items
   * @returns {Promise<Object>} Import results
   */
  async importCompleteProduct(product) {
    try {
      logger.info('Starting complete product import', { 
        productId: product.id,
        productName: product.name,
        itemCount: product.items.length
      });

      const results = {
        product: product,
        parent: null,
        children: [],
        errors: []
      };

      // Import parent item first
      try {
        results.parent = await this.importParentItem(product);
      } catch (error) {
        results.errors.push({
          type: 'parent',
          productId: product.id,
          error: error.message
        });
        logger.error('Failed to import parent item', { 
          productId: product.id, 
          error: error.message 
        });
      }

      // Import child items
      for (const item of product.items) {
        try {
          const childResult = await this.importChildItem(item, product);
          results.children.push(childResult);
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          results.errors.push({
            type: 'child',
            itemId: item.id,
            productId: product.id,
            error: error.message
          });
          logger.error('Failed to import child item', { 
            itemId: item.id, 
            productId: product.id,
            error: error.message 
          });
        }
      }

      logger.info('Complete product import finished', { 
        productId: product.id,
        parentSuccess: !!results.parent,
        childrenSuccess: results.children.length,
        totalErrors: results.errors.length
      });

      return results;
    } catch (error) {
      logger.error('Error in complete product import', { 
        productId: product.id, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Import multiple products (main import function)
   * @param {Array} products - Array of OPMS products with items
   * @returns {Promise<Object>} Complete import results
   */
  async importProducts(products) {
    try {
      logger.info('Starting batch product import', { 
        productCount: products.length 
      });

      const results = {
        startTime: new Date(),
        products: [],
        summary: {
          totalProducts: products.length,
          successfulProducts: 0,
          failedProducts: 0,
          totalParents: 0,
          totalChildren: 0,
          totalErrors: 0
        }
      };

      // Process each product
      for (const product of products) {
        try {
          const productResult = await this.importCompleteProduct(product);
          results.products.push(productResult);
          
          // Update summary
          if (productResult.parent) {
            results.summary.totalParents++;
          }
          results.summary.totalChildren += productResult.children.length;
          results.summary.totalErrors += productResult.errors.length;
          
          if (productResult.errors.length === 0) {
            results.summary.successfulProducts++;
          } else {
            results.summary.failedProducts++;
          }

          logger.info('Product import completed', { 
            productId: product.id,
            parentSuccess: !!productResult.parent,
            childrenCount: productResult.children.length,
            errors: productResult.errors.length
          });
          
          // Delay between products to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          results.summary.failedProducts++;
          results.summary.totalErrors++;
          logger.error('Product import failed completely', { 
            productId: product.id, 
            error: error.message 
          });
        }
      }

      results.endTime = new Date();
      results.duration = results.endTime - results.startTime;

      logger.info('Batch product import completed', { 
        duration: results.duration,
        summary: results.summary
      });

      return results;
    } catch (error) {
      logger.error('Error in batch product import', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate import report
   * @param {Object} results - Import results
   * @returns {Object} Formatted report
   */
  generateImportReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      duration: `${Math.round(results.duration / 1000)}s`,
      summary: results.summary,
      details: {
        successful: [],
        failed: [],
        warnings: []
      }
    };

    // Process each product result
    results.products.forEach(productResult => {
      const productInfo = {
        id: productResult.product.id,
        name: productResult.product.name,
        parentCreated: !!productResult.parent,
        childrenCreated: productResult.children.length,
        errors: productResult.errors.length
      };

      if (productResult.errors.length === 0) {
        report.details.successful.push(productInfo);
      } else {
        report.details.failed.push({
          ...productInfo,
          errors: productResult.errors
        });
      }

      // Check for warnings (partial success)
      if (productResult.parent && productResult.children.length > 0 && productResult.errors.length > 0) {
        report.details.warnings.push({
          ...productInfo,
          message: 'Partial success - some items failed'
        });
      }
    });

    return report;
  }
}

module.exports = ProductImportService; 