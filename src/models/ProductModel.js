const BaseModel = require('./BaseModel');

class ProductModel extends BaseModel {
    constructor() {
        super('T_PRODUCT');
    }

    /**
     * Get all products with optional filtering
     * @param {Object} filters - Optional filters (archived, etc.)
     * @returns {Promise<Array>} Array of products
     */
    async findAll(filters = {}) {
        let query = `
            SELECT 
                p.id, 
                p.name, 
                p.width, 
                p.vrepeat, 
                p.hrepeat, 
                p.outdoor, 
                p.archived,
                p.in_master,
                'R' as product_type,
                GROUP_CONCAT(DISTINCT v.name SEPARATOR ', ') as vendors
            FROM T_PRODUCT p
            LEFT JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
            LEFT JOIN Z_VENDOR v ON pv.vendor_id = v.id
        `;

        const values = [];
        const conditions = [];

        if (filters.archived !== undefined) {
            conditions.push('p.archived = ?');
            values.push(filters.archived);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' GROUP BY p.id ORDER BY p.name ASC';

        return this.executeQuery(query, values);
    }

    /**
     * Search products for datatable with server-side processing
     * @param {string} searchTerm - Search term
     * @param {Object} options - Datatable options (start, length, order)
     * @returns {Promise<Object>} Datatable compatible result object
     */
    async searchProducts(searchTerm, options = {}) {
        // Ensure cache table exists before searching
        await this.ensureCacheTableExists();
        
        // Check if cache table has data, if not build it
        const cacheCount = await this.executeQuery(`SELECT COUNT(*) as count FROM cached_product_spec_view`);
        if (cacheCount[0].count === 0) {
            await this.buildCachedProductSpecView();
        }
        
        // Build the main query using the cache table - exactly matching legacy PHP structure
        let query = `SELECT * FROM cached_product_spec_view`;
        const values = [];
        const whereParts = [];
        
        // ✅ Match legacy WHERE clause exactly - only filter by archived, not in_master
        // ✅ Exclude digital products (search only regular products)
        whereParts.push("archived = 'N' AND product_type = 'R'");
        
        if (searchTerm) {
            const searchPattern = `%${searchTerm}%`;
            
            // ✅ Match legacy search fields exactly from get_products_spec_view()
            whereParts.push(`(
                vendors_abrev LIKE ? OR
                searchable_vendors_abrev LIKE ? OR
                product_name LIKE ? OR
                vendors_name LIKE ? OR
                vendor_product_name LIKE ? OR
                vendor_business_name LIKE ? OR
                searchable_colors LIKE ? OR
                searchable_uses LIKE ? OR
                searchable_firecodes LIKE ? OR
                searchable_content_front LIKE ? OR
                weaves LIKE ? OR
                colors LIKE ? OR
                uses LIKE ? OR
                firecodes LIKE ? OR
                content_front LIKE ?
            )`);
            
            // Add 15 values for the 15 search fields above
            for (let i = 0; i < 15; i++) {
                values.push(searchPattern);
            }
        }
        
        if (whereParts.length > 0) {
            query += ' WHERE ' + whereParts.join(' AND ');
        }
        
        // ✅ De-duplicate results based on primary identifiers - exactly as in legacy PHP
        query += ' GROUP BY product_id, product_type';
        
        // Add ordering if specified
        if (options.order && options.order.length > 0) {
            const orderColumn = this.getOrderColumnForCache(options.order[0].column);
            const orderDir = options.order[0].dir === 'desc' ? 'DESC' : 'ASC';
            query += ` ORDER BY ${orderColumn} ${orderDir}`;
        } else {
            query += ' ORDER BY product_name ASC';
        }
        
        // ✅ Get total count exactly as in legacy PHP (exclude digital products)
        const countQuery = `SELECT COUNT(*) as total FROM cached_product_spec_view WHERE archived = 'N' AND product_type = 'R'`;
        const totalResult = await this.executeQuery(countQuery);
        const total = totalResult[0].total;
        
        // ✅ Get filtered count using the same logic as legacy PHP
        const countFilteredQuery = `
            SELECT COUNT(*) as filtered FROM (
                SELECT DISTINCT product_id, product_type 
                FROM cached_product_spec_view 
                WHERE ${whereParts.join(' AND ')}
            ) as count_query
        `;
        const countFilteredResult = await this.executeQuery(countFilteredQuery, values);
        const filtered = countFilteredResult[0].filtered;
        
        // Add pagination
        if (options.start !== undefined && options.length !== undefined) {
            query += ' LIMIT ? OFFSET ?';
            values.push(parseInt(options.length), parseInt(options.start));
        }
        
        // Execute the final query
        const data = await this.executeQuery(query, values);
        
        return {
            total,
            filtered,
            data
        };
    }
    
    /**
     * Helper method to remove duplicates from an array based on multiple keys
     * @param {Array} array - Array to remove duplicates from
     * @param {...string} keys - Keys to use for duplicate detection
     * @returns {Array} Array with duplicates removed
     */
    removeDuplicates(array, ...keys) {
        // Implementing a more robust duplicate removal that matches legacy PHP behavior
        const seen = new Map();
        return array.filter(item => {
            // Create a composite key from the specified properties
            const key = keys.map(k => item[k]).join('|');
            
            // Check if we've seen this key before
            if (seen.has(key)) {
                return false;
            }
            
            // Mark this key as seen and keep the item
            seen.set(key, true);
            return true;
        });
    }

    /**
     * Map datatable column index to cached table column name
     * @param {number} columnIndex - Datatable column index
     * @returns {string} Database column name
     */
    getOrderColumnForCache(columnIndex) {
        const columns = [
            'product_name', // 0: Product Name
            'width', // 1: Width
            'vrepeat', // 2: Vertical Repeat
            'hrepeat', // 3: Horizontal Repeat
            'abrasions', // 4: Abrasions
            'content_front', // 5: Content Front
            'firecodes', // 6: Firecodes
            'uses', // 7: Uses
            'vendor_product_name', // 8: Vendor Product Name
            'p_hosp_cut', // 9: Hospital Cut Price
            'p_hosp_roll', // 10: Hospital Roll Price
            'p_res_cut', // 11: Residential Cut Price
            'p_dig_res', // 12: Digital Residential Price
            'p_dig_hosp', // 13: Digital Hospital Price
            'cost_cut', // 14: Cost Cut
            'cost_half_roll', // 15: Cost Half Roll
            'cost_roll', // 16: Cost Roll
            'cost_roll_landed', // 17: Cost Roll Landed
            'cost_roll_ex_mill', // 18: Cost Roll Ex Mill
            'vendors_name', // 19: Vendor Name
            'weaves', // 20: Weaves
            'colors' // 21: Colors
        ];
        
        return columns[columnIndex] || 'product_name';
    }

    /**
     * Find product by ID
     * @param {number|string} id - Product ID
     * @returns {Promise<Object|null>} Product object or null if not found
     */
    async findById(id) {
        const query = `
            SELECT 
                p.id, 
                p.name, 
                p.width, 
                p.vrepeat, 
                p.hrepeat, 
                p.outdoor, 
                p.archived,
                p.in_master,
                'R' as product_type,
                GROUP_CONCAT(DISTINCT v.name SEPARATOR ', ') as vendors
            FROM T_PRODUCT p
            LEFT JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
            LEFT JOIN Z_VENDOR v ON pv.vendor_id = v.id
            WHERE p.id = ?
            GROUP BY p.id
        `;
        
        const result = await this.executeQuery(query, [id]);
        return result.length > 0 ? result[0] : null;
    }

    /**
     * Get product info for tag display
     * @param {string} type - Product type ('R' or 'D')
     * @param {number} productId - Product ID
     * @returns {Promise<Object|null>} Product info object or null if not found
     */
    async getProductInfoForTag(type, productId) {
        // This is a simplified version - in a real implementation, you would include all the fields
        // from the legacy get_product_info_for_tag function
        const query = `
            SELECT 
                p.id as product_id, 
                p.name as product_name,
                p.width,
                p.vrepeat,
                p.hrepeat,
                p.outdoor,
                'R' as product_type,
                GROUP_CONCAT(DISTINCT c.name ORDER BY c.name ASC SEPARATOR ', ') as colors,
                (
                    SELECT COUNT(DISTINCT i.id)
                 FROM T_ITEM i 
                    WHERE i.product_id = p.id
                 AND i.archived = 'N'
                ) as total_aval_colors
            FROM T_PRODUCT p
            LEFT JOIN T_ITEM i ON i.product_id = p.id
            LEFT JOIN T_ITEM_COLOR ic ON ic.item_id = i.id
            LEFT JOIN P_COLOR c ON c.id = ic.color_id
            WHERE p.id = ?
            GROUP BY p.id
        `;
        
        const result = await this.executeQuery(query, [productId]);
        return result.length > 0 ? result[0] : null;
    }

    /**
     * Get product specification sheet
     * @param {string} type - Product type ('R' or 'D')
     * @param {number} productId - Product ID
     * @param {Object} options - Optional parameters
     * @returns {Promise<Object|null>} Product specification sheet or null if not found
     */
    async getProductSpecsheet(type, productId, options = {}) {
        // This is a simplified version - in a real implementation, you would include all the fields
        // from the legacy get_product_specsheet function
        const query = `
            SELECT 
                p.id as product_id, 
                p.name as product_name,
                p.width,
                p.vrepeat,
                p.hrepeat,
                p.outdoor,
                'R' as product_type,
                GROUP_CONCAT(DISTINCT a.abrasion_test_id, '*', al.name, '-', a.n_rubs, '-', at.name SEPARATOR ' / ') as abrasions,
                GROUP_CONCAT(DISTINCT REPLACE(cf.perc, '.00', ''), '% ', pc.name ORDER BY cf.perc DESC SEPARATOR ' / ') as content_front,
                GROUP_CONCAT(DISTINCT REPLACE(cb.perc, '.00', ''), '% ', pcb.name ORDER BY cb.perc DESC SEPARATOR ' / ') as content_back,
                GROUP_CONCAT(DISTINCT ft.name SEPARATOR ' / ') as firecodes,
                GROUP_CONCAT(DISTINCT f.name SEPARATOR ' / ') as finishs,
                GROUP_CONCAT(DISTINCT o.name SEPARATOR ' / ') as origin,
                GROUP_CONCAT(DISTINCT u.name ORDER BY u.name ASC SEPARATOR ' / ') as uses,
                GROUP_CONCAT(DISTINCT w.name ORDER BY w.name ASC SEPARATOR ' / ') as weaves
            FROM T_PRODUCT p
            LEFT JOIN T_PRODUCT_ABRASION a ON p.id = a.product_id
            LEFT JOIN P_ABRASION_TEST at ON a.abrasion_test_id = at.id
            LEFT JOIN P_ABRASION_LIMIT al ON a.abrasion_limit_id = al.id
            LEFT JOIN T_PRODUCT_CONTENT_FRONT cf ON p.id = cf.product_id
            LEFT JOIN P_CONTENT pc ON cf.content_id = pc.id
            LEFT JOIN T_PRODUCT_CONTENT_BACK cb ON p.id = cb.product_id
            LEFT JOIN P_CONTENT pcb ON cb.content_id = pcb.id
            LEFT JOIN T_PRODUCT_FIRECODE pf ON p.id = pf.product_id
            LEFT JOIN P_FIRECODE_TEST ft ON pf.firecode_test_id = ft.id
            LEFT JOIN T_PRODUCT_FINISH pfi ON p.id = pfi.product_id
            LEFT JOIN P_FINISH f ON pfi.finish_id = f.id
            LEFT JOIN T_PRODUCT_ORIGIN po ON p.id = po.product_id
            LEFT JOIN P_ORIGIN o ON po.origin_id = o.id
            LEFT JOIN T_PRODUCT_USE pu ON p.id = pu.product_id
            LEFT JOIN P_USE u ON pu.use_id = u.id
            LEFT JOIN T_PRODUCT_WEAVE pw ON p.id = pw.product_id
            LEFT JOIN P_WEAVE w ON pw.weave_id = w.id
            WHERE p.id = ?
            GROUP BY p.id
        `;
        
        const result = await this.executeQuery(query, [productId]);
        return result.length > 0 ? result[0] : null;
    }

    /**
     * Get product name by ID - matches legacy get_product_name_by_id
     * @param {number} productId - Product ID
     * @param {string} productType - Product type ('R' or 'D')
     */
    async getProductNameById(productId, productType = 'R') {
        if (productType === 'D') {
            // For digital products, get the style name and ground info
            const query = `
                SELECT CONCAT(ds.name, ' on ', 
                    CASE WHEN x.reverse_ground = 'Y' THEN 'Reverse ' ELSE '' END,
                    COALESCE(p.dig_product_name, p.name)) as product_name
                FROM T_PRODUCT_X_DIGITAL x
                JOIN U_DIGITAL_STYLE ds ON x.style_id = ds.id
                JOIN T_ITEM i ON x.item_id = i.id
                JOIN T_PRODUCT p ON i.product_id = p.id
                WHERE x.id = ?
                LIMIT 1
            `;
            const result = await this.executeQuery(query, [productId]);
            return result[0]?.product_name || null;
        } else {
            // For regular products, just get the name
            const query = `SELECT name as product_name FROM T_PRODUCT WHERE id = ?`;
            const result = await this.executeQuery(query, [productId]);
            return result[0]?.product_name || null;
        }
    }

    /**
     * Get product name by item ID - matches legacy get_product_name_by_item_id
     * @param {number} itemId - Item ID
     */
    async getProductNameByItemId(itemId) {
        const query = `
            SELECT i.product_type, i.product_id
            FROM T_ITEM i
            WHERE i.id = ?
        `;
        const result = await this.executeQuery(query, [itemId]);
        
        if (result.length === 0) return null;
        
        const { product_type, product_id } = result[0];
        return this.getProductNameById(product_id, product_type);
    }

    /**
     * Validation rules for product types - matches legacy rules() method
     * @param {string} productType - Product type ('R' or 'D')
     * @param {number} id - Product ID (0 for new products)
     */
    getValidationRules(productType, id) {
        const rules = {
            'R': [
                {
                    field: 'product_name',
                    label: 'Name',
                    rules: 'required'
                },
                {
                    field: 'vendor',
                    label: 'Vendor',
                    rules: 'required|is_natural_no_zero'
                }
            ],
            'D': [
                {
                    field: 'style',
                    label: 'Style',
                    rules: 'required|is_natural_no_zero'
                },
                {
                    field: 'ground',
                    label: 'Ground',
                    rules: 'required|is_natural_no_zero'
                }
            ]
        };
        return rules[productType] || [];
    }

    /**
     * Save product and all related data - matches legacy save_product
     * @param {string} productType - Product type ('R' or 'D')
     * @param {Object} data - Product data
     * @param {number} id - Optional product ID for updates
     */
    async saveProduct(productType, data, id = null) {
        const connection = await this.db.pool.getConnection();
        try {
            await connection.beginTransaction();

            // Prepare main product data based on actual T_PRODUCT structure
            const productData = {
                name: data.product_name || data.name,
                type: productType,
                width: data.width || null,
                vrepeat: data.vrepeat || null,
                hrepeat: data.hrepeat || null,
                lightfastness: data.lightfastness || null,
                seam_slippage: data.seam_slippage || '',
                outdoor: data.outdoor || 'N',
                dig_product_name: data.dig_product_name || null,
                dig_width: data.dig_width || null,
                user_id: data.user_id || 0
            };

            let productId;
            if (id && id !== '0') {
                // Update existing product
                await this.executeQuery(
                    `UPDATE T_PRODUCT SET 
                     name = ?, type = ?, width = ?, vrepeat = ?, hrepeat = ?, 
                     lightfastness = ?, seam_slippage = ?, outdoor = ?, 
                     dig_product_name = ?, dig_width = ?, user_id = ?, 
                     date_modif = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [...Object.values(productData), id]
                );
                productId = id;
            } else {
                // Create new product
                const result = await this.executeQuery(
                    `INSERT INTO T_PRODUCT 
                     (name, type, width, vrepeat, hrepeat, lightfastness, seam_slippage, 
                      outdoor, dig_product_name, dig_width, user_id, date_add, date_modif) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    Object.values(productData)
                );
                productId = result.insertId;
            }

            // Save related data using helper methods
            if (data.cleaning) await this.saveCleaning(data.cleaning, productId);
            if (data.warranty) await this.saveWarranty(data.warranty, productId);
            if (data.content_front) await this.saveContentFront(data.content_front, productId);
            if (data.content_back) await this.saveContentBack(data.content_back, productId);
            if (data.finish) await this.saveFinish(data.finish, productId);
            if (data.origin) await this.saveOrigin(data.origin, productId);
            if (data.cost) await this.saveCost(data.cost, productId);
            if (data.price) await this.savePrice(data.price, productId, productType);
            if (data.uses) await this.saveUses(data.uses, productId);
            if (data.various) await this.saveVarious(data.various, productId);
            if (data.vendor) await this.saveVendor(data.vendor, productId);
            if (data.weave) await this.saveWeave(data.weave, productId);
            if (data.abrasion) await this.saveAbrasion(data.abrasion);
            if (data.firecode) await this.saveFirecode(data.firecode);
            if (data.files) await this.saveProductFiles(data.files, productId);

            // Refresh the cache for this product
            await this.refreshCachedProductRow(productId, productType);

            await connection.commit();
            return this.findById(productId);
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Helper methods for saving related data - match legacy PHP methods

    /**
     * Save product price data - matches legacy save_price
     */
    async savePrice(data, productId, productType) {
        const query = `
            INSERT INTO T_PRODUCT_PRICE 
            (product_id, product_type, p_hosp_cut, p_hosp_roll, p_res_cut, p_dig_res, p_dig_hosp, date, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            ON DUPLICATE KEY UPDATE
            p_hosp_cut = VALUES(p_hosp_cut),
            p_hosp_roll = VALUES(p_hosp_roll),
            p_res_cut = VALUES(p_res_cut),
            p_dig_res = VALUES(p_dig_res),
            p_dig_hosp = VALUES(p_dig_hosp),
            date = VALUES(date),
            user_id = VALUES(user_id)
        `;
        await this.executeQuery(query, [
            productId, productType,
            data.p_hosp_cut || null, data.p_hosp_roll || null, data.p_res_cut || null,
            data.p_dig_res || null, data.p_dig_hosp || null,
            data.user_id || 0
        ]);
    }

    /**
     * Save product cost data - matches legacy save_cost
     */
    async saveCost(data, productId) {
        const query = `
            INSERT INTO T_PRODUCT_PRICE_COST 
            (product_id, fob, cost_cut_type_id, cost_cut, cost_half_roll_type_id, cost_half_roll,
             cost_roll_type_id, cost_roll, cost_roll_landed_type_id, cost_roll_landed,
             cost_roll_ex_mill_type_id, cost_roll_ex_mill, cost_roll_ex_mill_text, date, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            ON DUPLICATE KEY UPDATE
            cost_cut_type_id = VALUES(cost_cut_type_id),
            cost_cut = VALUES(cost_cut),
            cost_half_roll_type_id = VALUES(cost_half_roll_type_id),
            cost_half_roll = VALUES(cost_half_roll),
            cost_roll_type_id = VALUES(cost_roll_type_id),
            cost_roll = VALUES(cost_roll),
            cost_roll_landed_type_id = VALUES(cost_roll_landed_type_id),
            cost_roll_landed = VALUES(cost_roll_landed),
            cost_roll_ex_mill_type_id = VALUES(cost_roll_ex_mill_type_id),
            cost_roll_ex_mill = VALUES(cost_roll_ex_mill),
            cost_roll_ex_mill_text = VALUES(cost_roll_ex_mill_text),
            date = VALUES(date),
            user_id = VALUES(user_id)
        `;
        await this.executeQuery(query, [
            productId, data.fob || '',
            data.cost_cut_type_id || null, data.cost_cut || null,
            data.cost_half_roll_type_id || null, data.cost_half_roll || null,
            data.cost_roll_type_id || null, data.cost_roll || null,
            data.cost_roll_landed_type_id || null, data.cost_roll_landed || null,
            data.cost_roll_ex_mill_type_id || null, data.cost_roll_ex_mill || null,
            data.cost_roll_ex_mill_text || null,
            data.user_id || 0
        ]);
    }

    /**
     * Save product vendor data - matches legacy save_vendor
     */
    async saveVendor(data, productId) {
        const query = `
            INSERT INTO T_PRODUCT_VENDOR (product_id, vendor_id, date_add, user_id)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?)
            ON DUPLICATE KEY UPDATE
            vendor_id = VALUES(vendor_id),
            user_id = VALUES(user_id)
        `;
        await this.executeQuery(query, [productId, data.vendor_id, data.user_id || 0]);
    }

    /**
     * Save product content front data - matches legacy save_content_front
     */
    async saveContentFront(data, productId) {
        // First delete existing content
        await this.executeQuery('DELETE FROM T_PRODUCT_CONTENT_FRONT WHERE product_id = ?', [productId]);
        
        // Insert new content
        if (data && data.length > 0) {
            for (const content of data) {
                await this.executeQuery(
                    'INSERT INTO T_PRODUCT_CONTENT_FRONT (product_id, perc, content_id, user_id, date_add) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [productId, content.perc, content.content_id, content.user_id || 0]
                );
            }
        }
    }

    /**
     * Save product content back data - matches legacy save_content_back
     */
    async saveContentBack(data, productId) {
        // First delete existing content
        await this.executeQuery('DELETE FROM T_PRODUCT_CONTENT_BACK WHERE product_id = ?', [productId]);
        
        // Insert new content
        if (data && data.length > 0) {
            for (const content of data) {
                await this.executeQuery(
                    'INSERT INTO T_PRODUCT_CONTENT_BACK (product_id, perc, content_id, user_id, date_add) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [productId, content.perc, content.content_id, content.user_id || 0]
                );
            }
        }
    }

    /**
     * Archive product - matches legacy archive_product
     */
    async archiveProduct(productId, productType) {
        const query = `UPDATE T_PRODUCT SET archived = 'Y', user_id = ?, date_modif = CURRENT_TIMESTAMP WHERE id = ?`;
        await this.executeQuery(query, [0, productId]); // user_id would come from session
        
        // Refresh the cache for this product
        await this.refreshCachedProductRow(productId, productType);
        
        return true;
    }

    /**
     * Retrieve (unarchive) product - matches legacy retrieve_product
     */
    async retrieveProduct(productId, productType) {
        const query = `UPDATE T_PRODUCT SET archived = 'N', user_id = ?, date_modif = CURRENT_TIMESTAMP WHERE id = ?`;
        await this.executeQuery(query, [0, productId]); // user_id would come from session
        
        // Refresh the cache for this product
        await this.refreshCachedProductRow(productId, productType);
        
        return true;
    }

    /**
     * Refresh a single row in the cache table
     * @param {number} productId - Product ID
     * @param {string} productType - Product type ('R' or 'D')
     * @returns {Promise<boolean>} Success status
     */
    async refreshCachedProductRow(productId, productType) {
        // Sanitize input
        productId = parseInt(productId);
        productType = (productType === 'D') ? 'D' : 'R';
        
        try {
            // Build SELECT query that returns 1 row for the given product
            const fullQuery = await this.getProductsSpecFullUnfilteredQuery();
            const query = `
                SELECT *, vendors_abrev AS searchable_vendors_abrev FROM (
                    ${fullQuery}
                ) AS full
                WHERE full.product_id = ?
                AND full.product_type = ?
                LIMIT 1
            `;
            
            const result = await this.executeQuery(query, [productId, productType]);
            if (result.length === 0) {
                return false;
            }
            
            // Upsert into cache table
            const fields = Object.keys(result[0]).join(', ');
            const placeholders = Object.keys(result[0]).map(() => '?').join(', ');
            const values = Object.values(result[0]);
            
            await this.executeQuery(
                `REPLACE INTO cached_product_spec_view (${fields}) VALUES (${placeholders})`,
                values
            );
            
            return true;
        } catch (error) {
            console.error('Error refreshing cache row:', error);
            return false;
        }
    }

    /**
     * Build or rebuild the entire cache table
     * @returns {Promise<boolean>} Success status
     */
    async buildCachedProductSpecView() {
        try {
            // Increase GROUP_CONCAT limit to handle large concatenations
            await this.executeQuery('SET SESSION group_concat_max_len = 32768');
            
            const fullQuery = await this.getProductsSpecFullUnfilteredQuery();
            const query = `
                REPLACE INTO cached_product_spec_view (
                    product_name,
                    vrepeat,
                    hrepeat,
                    width,
                    product_id,
                    outdoor,
                    product_type,
                    archived,
                    in_master,
                    abrasions,
                    count_abrasion_files,
                    content_front,
                    firecodes,
                    count_firecode_files,
                    uses,
                    uses_id,
                    vendor_product_name,
                    tariff_surcharge,
                    freight_surcharge,
                    p_hosp_cut,
                    p_hosp_roll,
                    p_res_cut,
                    p_dig_res,
                    p_dig_hosp,
                    price_date,
                    fob,
                    cost_cut,
                    cost_half_roll,
                    cost_roll,
                    cost_roll_landed,
                    cost_roll_ex_mill,
                    cost_date,
                    vendors_name,
                    vendors_abrev,
                    vendor_business_name,
                    weaves,
                    weaves_id,
                    colors,
                    color_ids,
                    searchable_colors,
                    searchable_uses,
                    searchable_firecodes,
                    searchable_content_front,
                    searchable_vendors_abrev
                )
                ${fullQuery}
            `;
            
            console.log('Building cache table with query...');
            await this.executeQuery(query);
            console.log('Cache table built successfully');
            return true;
        } catch (error) {
            console.error('Error building cache table:', error);
            console.error('Error message:', error.message);
            console.error('Error code:', error.code);
            console.error('SQL State:', error.sqlState);
            if (error.sql) {
                console.error('SQL query:', error.sql.substring(0, 500) + '...');
            }
            return false;
        }
    }

    /**
     * Format Display Name according to Opuzen naming convention
     * Product Name + ": " + Item Colors (formatted based on count)
     * @param {string} productName - The product name
     * @param {string|Array} colors - Colors as string or array
     * @returns {string} Formatted display name
     */
    formatDisplayName(productName, colors) {
        if (!productName) return '';
        
        // Clean up product name according to convention
        let cleanProductName = productName
            .replace(/&/g, 'and')  // Replace & with and
            .replace(/\s+/g, ' ')  // Normalize spaces
            .trim();
        
        // Handle colors
        let colorArray = [];
        if (typeof colors === 'string') {
            // Split by various delimiters and clean up
            colorArray = colors
                .split(/[\/,]/)
                .map(color => color.trim().replace(/&/g, 'and'))  // Clean up & in colors too
                .filter(color => color.length > 0);
        } else if (Array.isArray(colors)) {
            colorArray = colors
                .map(color => color.trim().replace(/&/g, 'and'))  // Clean up & in colors
                .filter(color => color && color.trim().length > 0);
        }
        
        // If no colors, just return the clean product name
        if (colorArray.length === 0) {
            return cleanProductName;
        }
        
        // Format colors based on count
        let formattedColors = '';
        if (colorArray.length === 1) {
            // Single color: no delimiter
            formattedColors = colorArray[0];
        } else if (colorArray.length === 2) {
            // Two colors: use "and"
            formattedColors = colorArray.join(' and ');
        } else {
            // Three or more colors: comma separated
            formattedColors = colorArray.join(', ');
        }
        
        return `${cleanProductName}: ${formattedColors}`;
    }

    /**
     * Get the full unfiltered query for products spec view
     * @returns {Promise<string>} SQL query
     */
    async getProductsSpecFullUnfilteredQuery() {
        // ✅ Match legacy WHERE clauses exactly
        const whereRegular = "P.archived = 'N'";
        const whereDigital = "X.archived = 'N'";
        
        return `
        (SELECT DISTINCT
            P.name AS product_name,
            CAST(P.vrepeat AS CHAR(50)) AS vrepeat,
            CAST(P.hrepeat AS CHAR(50)) AS hrepeat,
            P.width,
            P.id AS product_id,
            P.outdoor,
            'R' AS product_type,
            P.archived,
            P.in_master,
            GROUP_CONCAT(DISTINCT A.abrasion_test_id, '*', AL.name, '-', A.n_rubs, '-', AT.name SEPARATOR ' / ') AS abrasions,
            COUNT(DISTINCT AF.abrasion_id) AS count_abrasion_files,
            GROUP_CONCAT(DISTINCT REPLACE(CF.perc, '.00', ''), '% ', PC.name ORDER BY CF.perc DESC SEPARATOR ' / ') AS content_front,
            GROUP_CONCAT(DISTINCT FT.name SEPARATOR ' / ') AS firecodes,
            COUNT(DISTINCT FF.firecode_id) AS count_firecode_files,
            GROUP_CONCAT(DISTINCT U.name ORDER BY U.name ASC SEPARATOR ' / ') AS uses,
            GROUP_CONCAT(DISTINCT U.id SEPARATOR ' / ') AS uses_id,
            PV.vendor_product_name,
            NULLIF(PV.tariff_surcharge, '') AS tariff_surcharge,
            NULLIF(PV.freight_surcharge, '') AS freight_surcharge,
            PR.p_hosp_cut,
            PR.p_hosp_roll,
            PR.p_res_cut,
            PR.p_dig_res,
            PR.p_dig_hosp,
            DATE_FORMAT(PR.date, '%m/%d/%Y') AS price_date,
            NULLIF(PCOST.fob, '') AS fob,
            IFNULL(PCOST.cost_cut, '-') AS cost_cut,
            IFNULL(PCOST.cost_half_roll, '-') AS cost_half_roll,
            IFNULL(PCOST.cost_roll, '-') AS cost_roll,
            IFNULL(PCOST.cost_roll_landed, '-') AS cost_roll_landed,
            IFNULL(PCOST.cost_roll_ex_mill, '-') AS cost_roll_ex_mill,
            DATE_FORMAT(PCOST.date, '%m/%d/%Y') AS cost_date,
            NULLIF(PV.vendor_product_name, '') AS vendors_name,
            V.abrev AS vendors_abrev,
            V.name AS vendor_business_name,
            GROUP_CONCAT(DISTINCT W.name ORDER BY W.name ASC SEPARATOR ' / ') AS weaves,
            GROUP_CONCAT(DISTINCT W.id SEPARATOR ' / ') AS weaves_id,
            GROUP_CONCAT(DISTINCT C.name ORDER BY C.name ASC SEPARATOR ' / ') AS colors,
            GROUP_CONCAT(DISTINCT C.id SEPARATOR ' / ') AS color_ids,
            GROUP_CONCAT(DISTINCT C.name ORDER BY C.name ASC SEPARATOR ' ') AS searchable_colors,
            GROUP_CONCAT(DISTINCT U.name ORDER BY U.name ASC SEPARATOR ' ') AS searchable_uses,
            GROUP_CONCAT(DISTINCT FT.name SEPARATOR ' ') AS searchable_firecodes,
            GROUP_CONCAT(DISTINCT PC.name ORDER BY CF.perc DESC SEPARATOR ' ') AS searchable_content_front,
            V.abrev AS searchable_vendors_abrev
        FROM T_PRODUCT P
        LEFT JOIN T_PRODUCT_ABRASION A ON P.id = A.product_id
        LEFT JOIN P_ABRASION_TEST AT ON A.abrasion_test_id = AT.id
        LEFT JOIN P_ABRASION_LIMIT AL ON A.abrasion_limit_id = AL.id
        LEFT JOIN T_PRODUCT_ABRASION_FILES AF ON A.id = AF.abrasion_id
        LEFT JOIN T_PRODUCT_CONTENT_FRONT CF ON P.id = CF.product_id
        LEFT JOIN P_CONTENT PC ON CF.content_id = PC.id
        LEFT JOIN T_PRODUCT_FIRECODE F ON P.id = F.product_id
        LEFT JOIN P_FIRECODE_TEST FT ON F.firecode_test_id = FT.id
        LEFT JOIN T_PRODUCT_FIRECODE_FILES FF ON F.id = FF.firecode_id
        LEFT JOIN T_PRODUCT_USE PU ON P.id = PU.product_id
        LEFT JOIN P_USE U ON PU.use_id = U.id
        LEFT JOIN T_PRODUCT_VARIOUS PV ON P.id = PV.product_id
        LEFT JOIN T_PRODUCT_PRICE PR ON PR.product_id = P.id AND PR.product_type = 'R'
        LEFT JOIN T_PRODUCT_PRICE_COST PCOST ON P.id = PCOST.product_id
        LEFT JOIN T_PRODUCT_VENDOR TV ON P.id = TV.product_id
        LEFT JOIN Z_VENDOR V ON TV.vendor_id = V.id
        LEFT JOIN T_PRODUCT_WEAVE PW ON P.id = PW.product_id
        LEFT JOIN P_WEAVE W ON PW.weave_id = W.id
        LEFT JOIN T_ITEM I ON I.product_id = P.id
        LEFT JOIN T_ITEM_COLOR IC ON IC.item_id = I.id
        LEFT JOIN P_COLOR C ON C.id = IC.color_id,
        P_PRICE_TYPE PT
        WHERE ${whereRegular}
        GROUP BY product_id, product_type)
        
        UNION ALL
        
        (SELECT DISTINCT
            CONCAT(DS.name, ' on ', CASE WHEN X.reverse_ground = 'Y' THEN 'Reverse ' ELSE '' END, COALESCE(P.dig_product_name, P.name), ' / ', GROUP_CONCAT(DISTINCT C.name SEPARATOR ' / ')) AS product_name,
            CAST(DS.vrepeat AS CHAR(50)) AS vrepeat,
            CAST(DS.hrepeat AS CHAR(50)) AS hrepeat,
            COALESCE(P.dig_width, P.width) AS width,
            X.id AS product_id,
            P.outdoor,
            'D' AS product_type,
            X.archived,
            X.in_master,
            GROUP_CONCAT(DISTINCT A.abrasion_test_id, '*', AL.name, '-', A.n_rubs, '-', AT.name SEPARATOR ' / ') AS abrasions,
            COUNT(DISTINCT AF.abrasion_id) AS count_abrasion_files,
            GROUP_CONCAT(DISTINCT REPLACE(CF.perc, '.00', ''), '% ', PC.name ORDER BY CF.perc DESC SEPARATOR ' / ') AS content_front,
            GROUP_CONCAT(DISTINCT FT.name SEPARATOR ' / ') AS firecodes,
            COUNT(DISTINCT FF.firecode_id) AS count_firecode_files,
            GROUP_CONCAT(DISTINCT U.name ORDER BY U.name ASC SEPARATOR ' / ') AS uses,
            GROUP_CONCAT(DISTINCT U.id SEPARATOR ' / ') AS uses_id,
            PV.vendor_product_name,
            NULLIF(PV.tariff_surcharge, '') AS tariff_surcharge,
            NULLIF(PV.freight_surcharge, '') AS freight_surcharge,
            PR.p_hosp_cut,
            PR.p_hosp_roll,
            PR.p_res_cut,
            PR.p_dig_res,
            PR.p_dig_hosp,
            DATE_FORMAT(PR.date, '%m/%d/%Y') AS price_date,
            NULLIF(PCOST.fob, '') AS fob,
            IFNULL(PCOST.cost_cut, '-') AS cost_cut,
            IFNULL(PCOST.cost_half_roll, '-') AS cost_half_roll,
            IFNULL(PCOST.cost_roll, '-') AS cost_roll,
            IFNULL(PCOST.cost_roll_landed, '-') AS cost_roll_landed,
            IFNULL(PCOST.cost_roll_ex_mill, '-') AS cost_roll_ex_mill,
            DATE_FORMAT(PCOST.date, '%m/%d/%Y') AS cost_date,
            NULLIF(PV.vendor_product_name, '') AS vendors_name,
            V.abrev AS vendors_abrev,
            V.name AS vendor_business_name,
            GROUP_CONCAT(DISTINCT W.name ORDER BY W.name ASC SEPARATOR ' / ') AS weaves,
            GROUP_CONCAT(DISTINCT W.id SEPARATOR ' / ') AS weaves_id,
            GROUP_CONCAT(DISTINCT C.name ORDER BY C.name ASC SEPARATOR ' / ') AS colors,
            GROUP_CONCAT(DISTINCT C.id SEPARATOR ' / ') AS color_ids,
            GROUP_CONCAT(DISTINCT C.name ORDER BY C.name ASC SEPARATOR ' ') AS searchable_colors,
            GROUP_CONCAT(DISTINCT U.name ORDER BY U.name ASC SEPARATOR ' ') AS searchable_uses,
            GROUP_CONCAT(DISTINCT FT.name SEPARATOR ' ') AS searchable_firecodes,
            GROUP_CONCAT(DISTINCT PC.name ORDER BY CF.perc DESC SEPARATOR ' ') AS searchable_content_front,
            V.abrev AS searchable_vendors_abrev
        FROM T_PRODUCT_X_DIGITAL X
        JOIN U_DIGITAL_STYLE DS ON X.style_id = DS.id
        JOIN T_ITEM I ON X.item_id = I.id
        JOIN T_PRODUCT P ON I.product_id = P.id
        LEFT JOIN T_ITEM_COLOR IC ON IC.item_id = I.id
        LEFT JOIN P_COLOR C ON C.id = IC.color_id
        LEFT JOIN T_PRODUCT_ABRASION A ON P.id = A.product_id
        LEFT JOIN P_ABRASION_TEST AT ON A.abrasion_test_id = AT.id
        LEFT JOIN P_ABRASION_LIMIT AL ON A.abrasion_limit_id = AL.id
        LEFT JOIN T_PRODUCT_ABRASION_FILES AF ON A.id = AF.abrasion_id
        LEFT JOIN T_PRODUCT_CONTENT_FRONT CF ON P.id = CF.product_id
        LEFT JOIN P_CONTENT PC ON CF.content_id = PC.id
        LEFT JOIN T_PRODUCT_FIRECODE F ON P.id = F.product_id
        LEFT JOIN P_FIRECODE_TEST FT ON F.firecode_test_id = FT.id
        LEFT JOIN T_PRODUCT_FIRECODE_FILES FF ON F.id = FF.firecode_id
        LEFT JOIN T_PRODUCT_USE PU ON P.id = PU.product_id
        LEFT JOIN P_USE U ON PU.use_id = U.id
        LEFT JOIN T_PRODUCT_VARIOUS PV ON P.id = PV.product_id
        LEFT JOIN T_PRODUCT_PRICE PR ON PR.product_id = X.id AND PR.product_type = 'D'
        LEFT JOIN T_PRODUCT_PRICE_COST PCOST ON P.id = PCOST.product_id
        LEFT JOIN T_PRODUCT_VENDOR TV ON P.id = TV.product_id
        LEFT JOIN Z_VENDOR V ON TV.vendor_id = V.id
        LEFT JOIN T_PRODUCT_WEAVE PW ON P.id = PW.product_id
        LEFT JOIN P_WEAVE W ON PW.weave_id = W.id,
        P_PRICE_TYPE PT
        WHERE ${whereDigital}
        GROUP BY product_id, product_type)`;
    }

    /**
     * Check if the cache table exists and create it if it doesn't
     * @returns {Promise<boolean>} Success status
     */
    async ensureCacheTableExists() {
        try {
            // Check if the table exists
            const checkQuery = `
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name = 'cached_product_spec_view'
            `;
            const result = await this.executeQuery(checkQuery);
            
            if (result[0].count === 0) {
                // Table doesn't exist, create it with exact production structure
                const createQuery = `
                    CREATE TABLE cached_product_spec_view (
                        product_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        vrepeat VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        hrepeat VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        width DECIMAL(10,2) DEFAULT NULL,
                        product_id INT NOT NULL,
                        outdoor ENUM('Y','N') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        product_type CHAR(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
                        archived ENUM('Y','N') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        in_master ENUM('Y','N') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        abrasions TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                        count_abrasion_files INT DEFAULT NULL,
                        content_front TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                        firecodes TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                        count_firecode_files INT DEFAULT NULL,
                        uses TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                        uses_id TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                        vendor_product_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        tariff_surcharge DECIMAL(10,2) DEFAULT NULL,
                        freight_surcharge DECIMAL(10,2) DEFAULT NULL,
                        p_hosp_cut DECIMAL(10,2) DEFAULT NULL,
                        p_hosp_roll DECIMAL(10,2) DEFAULT NULL,
                        p_res_cut DECIMAL(10,2) DEFAULT NULL,
                        p_dig_res DECIMAL(10,2) DEFAULT NULL,
                        p_dig_hosp DECIMAL(10,2) DEFAULT NULL,
                        price_date VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        fob VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        cost_cut VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        cost_half_roll VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        cost_roll VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        cost_roll_landed VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        cost_roll_ex_mill VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        cost_date VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        vendors_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        vendors_abrev VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        vendor_business_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        weaves TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                        weaves_id TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                        colors TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                        color_ids TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                        searchable_colors TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                        searchable_uses TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                        searchable_firecodes TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                        searchable_content_front TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                        searchable_vendors_abrev VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                        PRIMARY KEY (product_id, product_type),
                        KEY idx_vendors_abrev (vendors_abrev),
                        KEY idx_product_name (product_name),
                        FULLTEXT KEY ft_search (product_name, vendor_product_name, searchable_vendors_abrev, searchable_colors, searchable_uses, searchable_firecodes, searchable_content_front)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                `;
                
                await this.executeQuery(createQuery);
                console.log('Cache table created successfully');
            }
            
            return true;
        } catch (error) {
            console.error('Error creating/updating cache table:', error);
            return false;
        }
    }

    /**
     * Search products and items by name - matches legacy search_by_name
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @param {boolean} options.itemsOnly - If true, only return items
     * @param {boolean} options.includeDigital - If true, include digital products
     * @returns {Promise<Array>} Array of search results
     */
    async searchByName(query, options = {}) {
        // If query contains 'digital', return empty array (matching legacy behavior)
        if (query.toLowerCase().includes('digital')) {
            return [];
        }
        
        // Try to use cached table first for better performance
        try {
            await this.ensureCacheTableExists();
            
            // Check if cache table has data
            const cacheCount = await this.executeQuery(`SELECT COUNT(*) as count FROM cached_product_spec_view`);
            if (cacheCount[0].count > 0) {
                return await this.searchByNameUsingCache(query, options);
            }
        } catch (error) {
            console.warn('Cache table not available for typeahead search, falling back to view:', error.message);
        }
        
        // Fallback to original implementation using view
        const sql = `
            SELECT 
                i.*, 
                v.name as vendor_name
            FROM 
                v_item i
            LEFT JOIN 
                t_product_vendor pv ON i.product_id = pv.product_id
            LEFT JOIN 
                z_vendor v ON pv.vendor_id = v.id
            WHERE 
                (i.product_name LIKE ? OR i.color LIKE ? OR i.code LIKE ?)
                AND i.archived_product = 'N'
                AND i.archived = 'N'
            ORDER BY 
                i.product_type DESC, i.product_name
        `;
        
        const searchPattern = `%${query}%`;
        const results = await this.executeQuery(sql, [searchPattern, searchPattern, searchPattern]);
        
        // Format the results to match the legacy endpoint
        const formattedResults = [];
        const productIds = [];
        
        // Process results based on options
        for (const row of results) {
            // Add product entries if not itemsOnly
            if (!options.itemsOnly) {
                const productIdentifier = `${row.product_id}-${row.product_type}`;
                if (!productIds.includes(productIdentifier)) {
                    productIds.push(productIdentifier);
                    
                    // Skip digital products if includeDigital is false
                    if (row.product_type === 'D' && options.includeDigital === false) {
                        continue;
                    }
                    
                    // Add product entry
                    formattedResults.push({
                        description: row.product_type === 'D' ? 'Opuzen - Digital colorline' : `${row.vendor_name} - Fabric colorline`,
                        id: productIdentifier,
                        label: row.product_name
                    });
                }
            }
            
            // Add item entry
            // Skip digital items if includeDigital is false
            if (row.product_type === 'D' && options.includeDigital === false) {
                continue;
            }
            
            formattedResults.push({
                description: `${row.vendor_name || 'Unknown'} - SKU`,
                id: `${row.item_id}-item_id`,
                label: `${row.product_name} / ${row.code ? row.code + ' / ' : ''}${row.color}`
            });
        }
        
        return formattedResults;
    }

    /**
     * Search products and items by name using cached table
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Array of search results
     */
    async searchByNameUsingCache(query, options = {}) {
        const searchPattern = `%${query}%`;
        const formattedResults = [];
        
        // Get products from cache
        let productWhere = `
            archived = 'N' AND in_master != 'N' AND
            (product_name LIKE ? OR vendors_name LIKE ? OR vendor_product_name LIKE ?)
        `;
        
        const productValues = [searchPattern, searchPattern, searchPattern];
        
        // Filter by product type if specified
        if (options.includeDigital === false) {
            productWhere += ` AND product_type != 'D'`;
        }
        
        const productQuery = `
            SELECT DISTINCT 
                product_id, 
                product_type, 
                product_name, 
                vendors_name,
                vendors_abrev
            FROM cached_product_spec_view
            WHERE ${productWhere}
            ORDER BY product_name
            LIMIT 20
        `;
        
        const products = await this.executeQuery(productQuery, productValues);
        
        // Add product entries if not itemsOnly
        if (!options.itemsOnly) {
            for (const product of products) {
                formattedResults.push({
                    description: product.product_type === 'D' ? 'Opuzen - Digital colorline' : `${product.vendors_name || 'Unknown'} - Fabric colorline`,
                    id: `${product.product_id}-${product.product_type}`,
                    label: product.product_name
                });
            }
        }
        
        // Get items from view (since cache doesn't have individual item data)
        const itemSql = `
            SELECT 
                i.*, 
                v.name as vendor_name
            FROM 
                v_item i
            LEFT JOIN 
                t_product_vendor pv ON i.product_id = pv.product_id
            LEFT JOIN 
                z_vendor v ON pv.vendor_id = v.id
            WHERE 
                (i.product_name LIKE ? OR i.color LIKE ? OR i.code LIKE ?)
                AND i.archived_product = 'N'
                AND i.archived = 'N'
            ORDER BY 
                i.product_type DESC, i.product_name
            LIMIT 30
        `;
        
        const items = await this.executeQuery(itemSql, [searchPattern, searchPattern, searchPattern]);
        
        // Add item entries
        for (const item of items) {
            // Skip digital items if includeDigital is false
            if (item.product_type === 'D' && options.includeDigital === false) {
                continue;
            }
            
            formattedResults.push({
                description: `${item.vendor_name || 'Unknown'} - SKU`,
                id: `${item.item_id}-item_id`,
                label: `${item.product_name} / ${item.code ? item.code + ' / ' : ''}${item.color}`
            });
        }
        
        return formattedResults;
    }

    /**
     * Advanced search using full-text search capabilities
     * @param {string} searchTerm - Search term
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Array of search results
     */
    async advancedSearch(searchTerm, options = {}) {
        if (!searchTerm || searchTerm.trim().length === 0) {
            return [];
        }

        // Ensure cache table exists
        await this.ensureCacheTableExists();

        // Build advanced search query with full-text search
        const query = `
            SELECT 
                *,
                MATCH(product_name, vendors_name, vendor_product_name, searchable_colors, searchable_uses, searchable_content_front, searchable_firecodes) 
                AGAINST(? IN BOOLEAN MODE) as relevance_score
            FROM cached_product_spec_view
            WHERE archived = 'N' 
            AND in_master != 'N'
            AND MATCH(product_name, vendors_name, vendor_product_name, searchable_colors, searchable_uses, searchable_content_front, searchable_firecodes) 
                AGAINST(? IN BOOLEAN MODE)
            ORDER BY relevance_score DESC, product_name ASC
            LIMIT ?
        `;

        const searchTerm_boolean = `+${searchTerm}*`;
        const limit = options.limit || 50;

        try {
            const results = await this.executeQuery(query, [searchTerm_boolean, searchTerm_boolean, limit]);
            return results;
        } catch (error) {
            // Fall back to regular search if full-text search fails
            console.warn('Full-text search failed, falling back to regular search:', error.message);
            return this.searchProducts(searchTerm, options);
        }
    }

    /**
     * Search products with filters
     * @param {Object} filters - Search filters
     * @returns {Promise<Array>} Array of filtered products
     */
    async searchWithFilters(filters = {}) {
        // Ensure cache table exists
        await this.ensureCacheTableExists();

        let query = `SELECT * FROM cached_product_spec_view`;
        const values = [];
        const whereParts = ["archived = 'N'", "in_master != 'N'"];

        // Add search term filter
        if (filters.searchTerm) {
            const searchPattern = `%${filters.searchTerm}%`;
            whereParts.push(`(
                product_name LIKE ? OR
                vendors_name LIKE ? OR
                vendor_product_name LIKE ? OR
                searchable_colors LIKE ? OR
                searchable_uses LIKE ? OR
                searchable_content_front LIKE ?
            )`);
            values.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
        }

        // Add outdoor filter
        if (filters.outdoor !== undefined) {
            whereParts.push('outdoor = ?');
            values.push(filters.outdoor);
        }

        // Add product type filter
        if (filters.productType) {
            whereParts.push('product_type = ?');
            values.push(filters.productType);
        }

        // Add vendor filter
        if (filters.vendorId) {
            whereParts.push('vendors_abrev = ?');
            values.push(filters.vendorId);
        }

        // Add price range filter
        if (filters.priceMin || filters.priceMax) {
            if (filters.priceMin) {
                whereParts.push('p_res_cut >= ?');
                values.push(filters.priceMin);
            }
            if (filters.priceMax) {
                whereParts.push('p_res_cut <= ?');
                values.push(filters.priceMax);
            }
        }

        // Add width range filter
        if (filters.widthMin || filters.widthMax) {
            if (filters.widthMin) {
                whereParts.push('width >= ?');
                values.push(filters.widthMin);
            }
            if (filters.widthMax) {
                whereParts.push('width <= ?');
                values.push(filters.widthMax);
            }
        }

        // Build final query
        if (whereParts.length > 0) {
            query += ' WHERE ' + whereParts.join(' AND ');
        }

        query += ' GROUP BY product_id, product_type';
        query += ' ORDER BY product_name ASC';

        // Add limit
        if (filters.limit) {
            query += ' LIMIT ?';
            values.push(filters.limit);
        }

        return this.executeQuery(query, values);
    }

    /**
     * Get search suggestions based on partial input
     * @param {string} partial - Partial search term
     * @param {number} limit - Maximum number of suggestions
     * @returns {Promise<Array>} Array of suggestions
     */
    async getSearchSuggestions(partial, limit = 10) {
        if (!partial || partial.trim().length < 2) {
            return [];
        }

        // Ensure cache table exists
        await this.ensureCacheTableExists();

        const searchPattern = `${partial}%`;
        const suggestions = new Set();

        // Get suggestions from different fields
        const queries = [
            { field: 'product_name', type: 'Product' },
            { field: 'vendors_name', type: 'Vendor' },
            { field: 'vendor_product_name', type: 'Vendor Product' },
            { field: 'vendors_abrev', type: 'Vendor Code' }
        ];

        for (const { field, type } of queries) {
            const query = `
                SELECT DISTINCT ${field} as suggestion, '${type}' as type
                FROM cached_product_spec_view
                WHERE archived = 'N' 
                AND in_master != 'N'
                AND ${field} LIKE ?
                AND ${field} IS NOT NULL
                AND ${field} != ''
                ORDER BY ${field}
                LIMIT ?
            `;

            const results = await this.executeQuery(query, [searchPattern, limit]);
            results.forEach(row => {
                if (suggestions.size < limit) {
                    suggestions.add(JSON.stringify({
                        suggestion: row.suggestion,
                        type: row.type
                    }));
                }
            });
        }

        return Array.from(suggestions).slice(0, limit).map(item => JSON.parse(item));
    }

    /**
     * Get comprehensive mini-forms data for a product
     * @param {number} productId - Product ID
     * @returns {Promise<Object>} Mini-forms data with file URLs
     */
    async getMiniFormsData(productId) {
        // Query for abrasion data with files
        const abrasionQuery = `
            SELECT 
                A.id as abrasion_id,
                A.product_id,
                A.n_rubs as rubs,
                AT.name as test,
                AL.name as limit_name,
                AF.url_dir
            FROM T_PRODUCT_ABRASION A
            LEFT JOIN P_ABRASION_TEST AT ON A.abrasion_test_id = AT.id
            LEFT JOIN P_ABRASION_LIMIT AL ON A.abrasion_limit_id = AL.id
            LEFT JOIN T_PRODUCT_ABRASION_FILES AF ON A.id = AF.abrasion_id
            WHERE A.product_id = ?
        `;
        
        // Query for firecode data with files
        const firecodeQuery = `
            SELECT 
                F.id as firecode_id,
                F.product_id,
                FT.name as firecode_name,
                FF.url_dir
            FROM T_PRODUCT_FIRECODE F
            LEFT JOIN P_FIRECODE_TEST FT ON F.firecode_test_id = FT.id
            LEFT JOIN T_PRODUCT_FIRECODE_FILES FF ON F.id = FF.firecode_id
            WHERE F.product_id = ?
        `;
        
        // Query for front content
        const frontContentQuery = `
            SELECT 
                CF.product_id,
                CF.perc as percentage,
                CF.content_id,
                PC.name as content
            FROM T_PRODUCT_CONTENT_FRONT CF
            LEFT JOIN P_CONTENT PC ON CF.content_id = PC.id
            WHERE CF.product_id = ?
        `;
        
        // Query for back content
        const backContentQuery = `
            SELECT 
                CB.product_id,
                CB.perc as percentage,
                CB.content_id,
                PC.name as content
            FROM T_PRODUCT_CONTENT_BACK CB
            LEFT JOIN P_CONTENT PC ON CB.content_id = PC.id
            WHERE CB.product_id = ?
        `;
        
        // Execute all queries in parallel
        const [abrasionResults, firecodeResults, frontContentResults, backContentResults] = await Promise.all([
            this.executeQuery(abrasionQuery, [productId]),
            this.executeQuery(firecodeQuery, [productId]),
            this.executeQuery(frontContentQuery, [productId]),
            this.executeQuery(backContentQuery, [productId])
        ]);
        
        // Transform abrasion data with real file URLs
        const abrasionMap = new Map();
        abrasionResults.forEach(row => {
            if (!abrasionMap.has(row.abrasion_id)) {
                abrasionMap.set(row.abrasion_id, {
                    rowId: `ab-${row.abrasion_id}`,
                    test: row.test,
                    rubs: row.rubs || 50000,
                    limit: row.limit_name,
                    publicVisible: true,
                    inVendorSpecsheet: true,
                    files: []
                });
            }
            
            if (row.url_dir) {
                abrasionMap.get(row.abrasion_id).files.push({
                    name: row.url_dir.split('/').pop(),
                    url: `https://opms.opuzen-service.com/${row.url_dir}`
                });
            }
        });
        
        // Transform firecode data with real file URLs
        const firecodeMap = new Map();
        firecodeResults.forEach(row => {
            if (!firecodeMap.has(row.firecode_id)) {
                firecodeMap.set(row.firecode_id, {
                    rowId: `fc-${row.firecode_id}`,
                    fireCode: row.firecode_name,
                    percentage: "Class A",
                    publicVisible: true,
                    inVendorSpecsheet: true,
                    files: []
                });
            }
            
            if (row.url_dir) {
                firecodeMap.get(row.firecode_id).files.push({
                    name: row.url_dir.split('/').pop(),
                    url: `https://opms.opuzen-service.com/${row.url_dir}`
                });
            }
        });
        
        // Transform content data
        const frontContent = frontContentResults.map(row => ({
            rowId: `fc-${row.content_id}`,
            percentage: `${row.percentage}%`,
            content: row.content
        }));
        
        const backContent = backContentResults.map(row => ({
            rowId: `bc-${row.content_id}`,
            percentage: `${row.percentage}%`,
            content: row.content
        }));
        
        return {
            frontContent: frontContent,
            backContent: backContent,
            abrasion: Array.from(abrasionMap.values()),
            firecodes: Array.from(firecodeMap.values())
        };
    }

    /**
     * Get product with mini-forms data included
     * @param {number} productId - Product ID
     * @returns {Promise<Object|null>} Product with mini-forms data
     */
    async getProductWithMiniforms(productId) {
        const product = await this.findById(productId);
        if (!product) {
            return null;
        }
        
        const miniFormsData = await this.getMiniFormsData(productId);
        
        return {
            ...product,
            ...miniFormsData
        };
    }

    /**
     * Create or update front content for a product
     * @param {number} productId - Product ID
     * @param {Array} contentData - Array of content objects {content_id, perc}
     * @returns {Promise<boolean>} Success status
     */
    async saveFrontContent(productId, contentData) {
        try {
            // Delete existing front content
            await this.executeQuery('DELETE FROM T_PRODUCT_CONTENT_FRONT WHERE product_id = ?', [productId]);
            
            // Insert new front content
            if (contentData && contentData.length > 0) {
                const insertPromises = contentData.map(item => 
                    this.executeQuery(
                        'INSERT INTO T_PRODUCT_CONTENT_FRONT (product_id, content_id, perc) VALUES (?, ?, ?)',
                        [productId, item.content_id, item.perc]
                    )
                );
                await Promise.all(insertPromises);
            }
            
            return true;
        } catch (error) {
            throw new Error(`Failed to save front content: ${error.message}`);
        }
    }

    /**
     * Create or update back content for a product
     * @param {number} productId - Product ID
     * @param {Array} contentData - Array of content objects {content_id, perc}
     * @returns {Promise<boolean>} Success status
     */
    async saveBackContent(productId, contentData) {
        try {
            // Delete existing back content
            await this.executeQuery('DELETE FROM T_PRODUCT_CONTENT_BACK WHERE product_id = ?', [productId]);
            
            // Insert new back content
            if (contentData && contentData.length > 0) {
                const insertPromises = contentData.map(item => 
                    this.executeQuery(
                        'INSERT INTO T_PRODUCT_CONTENT_BACK (product_id, content_id, perc) VALUES (?, ?, ?)',
                        [productId, item.content_id, item.perc]
                    )
                );
                await Promise.all(insertPromises);
            }
            
            return true;
        } catch (error) {
            throw new Error(`Failed to save back content: ${error.message}`);
        }
    }

    /**
     * Create or update abrasion data for a product
     * @param {number} productId - Product ID
     * @param {Array} abrasionData - Array of abrasion objects {abrasion_test_id, abrasion_limit_id, n_rubs}
     * @returns {Promise<boolean>} Success status
     */
    async saveAbrasion(productId, abrasionData) {
        try {
            // Delete existing abrasion data and files
            const existingAbrasions = await this.executeQuery('SELECT id FROM T_PRODUCT_ABRASION WHERE product_id = ?', [productId]);
            if (existingAbrasions.length > 0) {
                const abrasionIds = existingAbrasions.map(a => a.id);
                await this.executeQuery(`DELETE FROM T_PRODUCT_ABRASION_FILES WHERE abrasion_id IN (${abrasionIds.map(() => '?').join(',')})`, abrasionIds);
            }
            await this.executeQuery('DELETE FROM T_PRODUCT_ABRASION WHERE product_id = ?', [productId]);
            
            // Insert new abrasion data
            if (abrasionData && abrasionData.length > 0) {
                const insertPromises = abrasionData.map(item => 
                    this.executeQuery(
                        'INSERT INTO T_PRODUCT_ABRASION (product_id, abrasion_test_id, abrasion_limit_id, n_rubs) VALUES (?, ?, ?, ?)',
                        [productId, item.abrasion_test_id, item.abrasion_limit_id, item.n_rubs]
                    )
                );
                await Promise.all(insertPromises);
            }
            
            return true;
        } catch (error) {
            throw new Error(`Failed to save abrasion: ${error.message}`);
        }
    }

    /**
     * Create or update firecode data for a product
     * @param {number} productId - Product ID
     * @param {Array} firecodeData - Array of firecode objects {firecode_test_id}
     * @returns {Promise<boolean>} Success status
     */
    async saveFirecodes(productId, firecodeData) {
        try {
            // Delete existing firecode data and files
            const existingFirecodes = await this.executeQuery('SELECT id FROM T_PRODUCT_FIRECODE WHERE product_id = ?', [productId]);
            if (existingFirecodes.length > 0) {
                const firecodeIds = existingFirecodes.map(f => f.id);
                await this.executeQuery(`DELETE FROM T_PRODUCT_FIRECODE_FILES WHERE firecode_id IN (${firecodeIds.map(() => '?').join(',')})`, firecodeIds);
            }
            await this.executeQuery('DELETE FROM T_PRODUCT_FIRECODE WHERE product_id = ?', [productId]);
            
            // Insert new firecode data
            if (firecodeData && firecodeData.length > 0) {
                const insertPromises = firecodeData.map(item => 
                    this.executeQuery(
                        'INSERT INTO T_PRODUCT_FIRECODE (product_id, firecode_test_id) VALUES (?, ?)',
                        [productId, item.firecode_test_id]
                    )
                );
                await Promise.all(insertPromises);
            }
            
            return true;
        } catch (error) {
            throw new Error(`Failed to save firecodes: ${error.message}`);
        }
    }
}

module.exports = ProductModel; 