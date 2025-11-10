const BaseModel = require('./BaseModel');
const ProductModel = require('./ProductModel');

class ItemModel extends BaseModel {
    constructor() {
        super('T_ITEM');
        this.productModel = new ProductModel();
    }

    /**
     * Get product name by type and ID - matches legacy get_product_name
     * @param {string} type - Product type ('R' or 'D')
     * @param {number} id - Product ID
     */
    async getProductName(type, id) {
        switch (type) {
            case 'R': // Regular
                const regularQuery = `SELECT name FROM T_PRODUCT WHERE id = ?`;
                const regularResult = await this.executeQuery(regularQuery, [id]);
                return regularResult[0]?.name || '';

            case 'D': // Digital
                const digitalQuery = `
                    SELECT CONCAT(
                        ds.name, ' on ', 
                        CASE WHEN x.reverse_ground = 'Y' THEN 'Reverse ' ELSE '' END, 
                        COALESCE(p.dig_product_name, p.name), ' / ',
                        GROUP_CONCAT(DISTINCT c.name SEPARATOR ' / ')
                    ) as name
                    FROM T_PRODUCT_X_DIGITAL x
                    JOIN U_DIGITAL_STYLE ds ON x.style_id = ds.id
                    JOIN T_ITEM i ON i.id = x.item_id
                    JOIN T_PRODUCT p ON p.id = i.product_id
                    LEFT JOIN T_ITEM_COLOR ic ON ic.item_id = i.id
                    LEFT JOIN P_COLOR c ON c.id = ic.color_id
                    WHERE x.id = ?
                    GROUP BY x.id
                `;
                const digitalResult = await this.executeQuery(digitalQuery, [id]);
                return digitalResult[0]?.name || '';

            default:
                return '';
        }
    }

    /**
     * Get item info for tag display - matches legacy get_item_info_for_tag
     * @param {string} productType - Product type ('R' or 'D')
     * @param {number} itemId - Item ID
     */
    async getItemInfoForTag(productType, itemId) {
        let query;
        
        if (productType === 'R') {
            // Regular product query
            query = `
                SELECT 
                    i.id as item_id, i.code, i.in_ringset, i.in_master, p.in_master as product_in_master,
                    p.id as product_id,
                    IF(i.code IS NULL, CONCAT_WS(' ', v.abrev, p.name), p.name) as product_name,
                    ps.name as status, ps.descr as status_abrev, ps.web_vis as web_vis, ps.id as status_id,
                    ss.name as stock_status, ss.descr as stock_status_abrev, ss.id as stock_status_id,
                    p.width as width,
                    p.vrepeat as vrepeat,
                    p.hrepeat as hrepeat,
                    pv.prop_65,
                    pv.ab_2998_compliant,
                    pv.tariff_code,
                    pv.vendor_product_name,
                    i.vendor_color,
                    i.vendor_code,
                    v.name as vendor_name,
                    GROUP_CONCAT(DISTINCT f.name ORDER BY f.name SEPARATOR ', ') as finish_names,
                    GROUP_CONCAT(DISTINCT cl.name ORDER BY cl.name SEPARATOR ', ') as cleaning_names,
                    GROUP_CONCAT(DISTINCT o.name ORDER BY o.name SEPARATOR ', ') as origin_names,
                    i.archived,
                    i.product_type,
                    GROUP_CONCAT(DISTINCT c.name ORDER BY ic.n_order SEPARATOR ' / ') as color,
                    GROUP_CONCAT(DISTINCT c.id ORDER BY ic.n_order SEPARATOR ' / ') as color_ids
                FROM T_ITEM i
                LEFT JOIN T_PRODUCT p ON i.product_id = p.id
                LEFT JOIN T_PRODUCT_VARIOUS pv ON pv.product_id = p.id
                LEFT JOIN P_PRODUCT_STATUS ps ON ps.id = i.status_id
                LEFT JOIN P_STOCK_STATUS ss ON ss.id = i.stock_status_id
                LEFT JOIN T_PRODUCT_VENDOR pven ON p.id = pven.product_id
                LEFT JOIN Z_VENDOR v ON pven.vendor_id = v.id
                LEFT JOIN T_PRODUCT_FINISH pf ON p.id = pf.product_id
                LEFT JOIN P_FINISH f ON pf.finish_id = f.id
                LEFT JOIN T_PRODUCT_CLEANING pcl ON p.id = pcl.product_id
                LEFT JOIN P_CLEANING cl ON pcl.cleaning_id = cl.id
                LEFT JOIN T_PRODUCT_ORIGIN po ON p.id = po.product_id
                LEFT JOIN P_ORIGIN o ON po.origin_id = o.id
                LEFT JOIN T_ITEM_COLOR ic ON i.id = ic.item_id
                LEFT JOIN P_COLOR c ON ic.color_id = c.id
                WHERE i.id = ?
                GROUP BY i.id
            `;
        } else {
            // Digital product query
            query = `
                SELECT 
                    i.id as item_id, i.code, i.in_ringset, i.in_master, x.in_master as product_in_master,
                    x.id as product_id,
                    CONCAT(
                        ds.name, ' on ', 
                        CASE WHEN x.reverse_ground = 'Y' THEN 'Reverse ' ELSE '' END, 
                        COALESCE(p.dig_product_name, p.name), 
                        ' ', 
                        GROUP_CONCAT(DISTINCT pc.name SEPARATOR ' / ')
                    ) as product_name,
                    ps.name as status, ps.descr as status_abrev, ps.id as status_id,
                    ss.name as stock_status, ss.descr as stock_status_abrev, ss.id as stock_status_id,
                    COALESCE(p.dig_width, p.width) as width,
                    COALESCE(p.dig_vrepeat, p.vrepeat) as vrepeat,
                    COALESCE(p.dig_hrepeat, p.hrepeat) as hrepeat,
                    pv.vendor_product_name,
                    i.vendor_color,
                    i.vendor_code,
                    v.name as vendor_name,
                    GROUP_CONCAT(DISTINCT f.name ORDER BY f.name SEPARATOR ', ') as finish_names,
                    GROUP_CONCAT(DISTINCT cl.name ORDER BY cl.name SEPARATOR ', ') as cleaning_names,
                    GROUP_CONCAT(DISTINCT o.name ORDER BY o.name SEPARATOR ', ') as origin_names,
                    i.archived,
                    i.product_type,
                    GROUP_CONCAT(DISTINCT c.name ORDER BY ic.n_order SEPARATOR ' / ') as color,
                    GROUP_CONCAT(DISTINCT c.id ORDER BY ic.n_order SEPARATOR ' / ') as color_ids
                FROM T_ITEM i
                JOIN T_PRODUCT_X_DIGITAL x ON x.id = i.product_id
                JOIN T_ITEM tt ON x.item_id = tt.id
                JOIN T_PRODUCT p ON tt.product_id = p.id
                LEFT JOIN T_ITEM_COLOR ic2 ON tt.id = ic2.item_id
                LEFT JOIN P_COLOR pc ON pc.id = ic2.color_id
                JOIN U_DIGITAL_STYLE ds ON ds.id = x.style_id
                LEFT JOIN P_PRODUCT_STATUS ps ON ps.id = i.status_id
                LEFT JOIN P_STOCK_STATUS ss ON ss.id = i.stock_status_id
                LEFT JOIN T_PRODUCT_VARIOUS pv ON pv.product_id = p.id
                LEFT JOIN T_PRODUCT_VENDOR pven ON p.id = pven.product_id
                LEFT JOIN Z_VENDOR v ON pven.vendor_id = v.id
                LEFT JOIN T_PRODUCT_FINISH pf ON p.id = pf.product_id
                LEFT JOIN P_FINISH f ON pf.finish_id = f.id
                LEFT JOIN T_PRODUCT_CLEANING pcl ON p.id = pcl.product_id
                LEFT JOIN P_CLEANING cl ON pcl.cleaning_id = cl.id
                LEFT JOIN T_PRODUCT_ORIGIN po ON p.id = po.product_id
                LEFT JOIN P_ORIGIN o ON po.origin_id = o.id
                LEFT JOIN T_ITEM_COLOR ic ON i.id = ic.item_id
                LEFT JOIN P_COLOR c ON ic.color_id = c.id
                WHERE i.id = ?
                GROUP BY i.id
            `;
        }
        
        const result = await this.executeQuery(query, [itemId]);
        return result[0] || null;
    }

    /**
     * Get item details by product ID - matches legacy RevisedQueries_model::get_item_details_by_product_id
     * @param {number} productId - Product ID
     * @param {string} productType - Product type ('R' or 'D')
     * @returns {Promise<Array>} Array of detailed item information
     */
    async getItemDetailsByProductId(productId, productType) {
        const items = [];
        
        // First get all items for the product
        const itemsFetched = await this.getItemsByProductId(productId, productType);
        
        // For each item, get detailed information
        for (const item of itemsFetched) {
            const itemDetails = await this.getItemDetails(item.item_id, productType);
            
            // For digital products, add the product name
            if (productType === 'D') {
                itemDetails.product_name = await this.getProductName(productType, productId);
            }
            
            items.push(itemDetails);
        }
        
        return items;
    }

    /**
     * Get items by product ID - matches legacy get_items_by_product_id
     * @param {number} productId - Product ID
     * @param {string} productType - Product type ('R' or 'D')
     * @returns {Promise<Array>} Array of basic item information
     */
    async getItemsByProductId(productId, productType) {
        const query = `
            SELECT 
                i.id AS item_id,
                i.code,
                i.archived
            FROM T_ITEM i
            WHERE i.product_id = ?
            AND i.product_type = ?
            AND i.archived = 'N'
            ORDER BY i.code ASC
        `;
        
        return this.executeQuery(query, [productId, productType]);
    }

    /**
     * Get comprehensive item details - matches legacy get_item_details EXACTLY for datatable compatibility
     * @param {number} itemId - Item ID
     * @param {string} productType - Product type ('R' or 'D')
     * @returns {Promise<Object>} Detailed item information
     */
    async getItemDetails(itemId, productType) {
        // Build the SELECT clause exactly as in the legacy PHP code
        let selectClause = `
            i.*, i.code, i.id AS item_id, 
            i.product_id,
            i.product_type AS product_type,
            i.archived,
            sales_stock.id AS sales_id,
            sales_stock.yardsInStock,
            sales_stock.yardsOnHold,
            sales_stock.yardsAvailable,
            sales_stock.yardsOnOrder,
            sales_stock.yardsBackorder,
            showp.visible as web_visible,
            pp.p_dig_hosp,
            pp.p_dig_res,
            pp.p_res_cut,
            pp.p_hosp_cut,
            pp.p_hosp_roll,
            pp.p_hosp_roll as volume_price,
            ppc.cost_cut,
            ppc.cost_half_roll,
            ppc.cost_roll,
            ppc.cost_roll_ex_mill,
            ppc.cost_roll_landed,
            mpl.price_date,
            samploc.name AS roll_location,
            GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR '/') AS color,
            GROUP_CONCAT(coorclr.coord_color_id SEPARATOR ' / ') AS showcase_coord_color_id,
            ishelf.shelf_id,
            JSON_ARRAYAGG(resel.item_id_1) AS reselections_ids,
            showi.visible AS showcase_visible,
            showi.url_title AS url_title,
            showi.pic_big_url AS pic_big_url,
            showi.pic_hd_url AS pic_hd_url,
            shelf.name AS shelf,
            ps.id AS status_id,
            ps.name AS status,
            ps.descr AS status_descr,
            ss.id AS stock_status_id,
            ss.name AS stock_status,
            ss.descr AS stock_status_descr,
            pv.prop_65,
            pv.ab_2998_compliant,
            pv.tariff_code,
            pv.vendor_product_name,
            i.vendor_color,
            i.vendor_code,
            v.name as vendor_name,
            GROUP_CONCAT(DISTINCT f.name ORDER BY f.name SEPARATOR ', ') as finish_names,
            GROUP_CONCAT(DISTINCT cl.name ORDER BY cl.name SEPARATOR ', ') as cleaning_names,
            GROUP_CONCAT(DISTINCT o.name ORDER BY o.name SEPARATOR ', ') as origin_names
        `;

        // Add product-type specific fields exactly as in legacy
        if (productType === 'R') {
            selectClause += `, p.name AS product_name, p.in_master AS in_master_product`;
        } else if (productType === 'D') {
            selectClause += `, digp.reverse_ground AS reverse_ground, digp.style_id AS style_id`;
        }

        // Build the FROM clause
        let fromClause = ` FROM T_ITEM AS i`;

        // Add product-type specific joins exactly as in legacy
        if (productType === 'R') {
            fromClause += ` LEFT JOIN T_PRODUCT AS p ON p.id = i.product_id`;
            fromClause += ` LEFT JOIN T_PRODUCT_VARIOUS AS pv ON pv.product_id = p.id`;
            fromClause += ` LEFT JOIN T_PRODUCT_VENDOR AS pven ON p.id = pven.product_id`;
            fromClause += ` LEFT JOIN Z_VENDOR AS v ON pven.vendor_id = v.id`;
            fromClause += ` LEFT JOIN T_PRODUCT_FINISH AS pf ON p.id = pf.product_id`;
            fromClause += ` LEFT JOIN P_FINISH AS f ON pf.finish_id = f.id`;
            fromClause += ` LEFT JOIN T_PRODUCT_CLEANING AS pcl ON p.id = pcl.product_id`;
            fromClause += ` LEFT JOIN P_CLEANING AS cl ON pcl.cleaning_id = cl.id`;
            fromClause += ` LEFT JOIN T_PRODUCT_ORIGIN AS po ON p.id = po.product_id`;
            fromClause += ` LEFT JOIN P_ORIGIN AS o ON po.origin_id = o.id`;
        } else if (productType === 'D') {
            fromClause += ` LEFT JOIN T_PRODUCT_X_DIGITAL AS digp ON digp.id = i.product_id`;
            // For digital products, we need to join through the base product
            fromClause += ` LEFT JOIN T_ITEM AS base_item ON base_item.id = digp.item_id`;
            fromClause += ` LEFT JOIN T_PRODUCT AS p ON p.id = base_item.product_id`;
            fromClause += ` LEFT JOIN T_PRODUCT_VARIOUS AS pv ON pv.product_id = p.id`;
            fromClause += ` LEFT JOIN T_PRODUCT_VENDOR AS pven ON p.id = pven.product_id`;
            fromClause += ` LEFT JOIN Z_VENDOR AS v ON pven.vendor_id = v.id`;
            fromClause += ` LEFT JOIN T_PRODUCT_FINISH AS pf ON p.id = pf.product_id`;
            fromClause += ` LEFT JOIN P_FINISH AS f ON pf.finish_id = f.id`;
            fromClause += ` LEFT JOIN T_PRODUCT_CLEANING AS pcl ON p.id = pcl.product_id`;
            fromClause += ` LEFT JOIN P_CLEANING AS cl ON pcl.cleaning_id = cl.id`;
            fromClause += ` LEFT JOIN T_PRODUCT_ORIGIN AS po ON p.id = po.product_id`;
            fromClause += ` LEFT JOIN P_ORIGIN AS o ON po.origin_id = o.id`;
        }

        // Add all other joins in the exact same order as legacy
        fromClause += `
            LEFT JOIN T_PRODUCT_PRICE AS pp ON pp.product_id = i.product_id AND pp.product_type = i.product_type
            LEFT JOIN T_PRODUCT_PRICE_COST AS ppc ON ppc.product_id = i.product_id
            LEFT JOIN T_PRODUCT_USE AS pu ON pu.product_id = i.product_id
            LEFT JOIN SHOWCASE_PRODUCT AS showp ON showp.product_id = i.product_id
            LEFT JOIN P_USE AS u ON u.id = pu.use_id
            LEFT JOIN PROC_MASTER_PRICE_LIST AS mpl ON mpl.product_id = i.product_id
            LEFT JOIN P_PRODUCT_STATUS AS ps ON ps.id = i.status_id
            LEFT JOIN P_STOCK_STATUS AS ss ON ss.id = i.stock_status_id
            LEFT JOIN T_ITEM_COLOR AS ic ON ic.item_id = i.id
            LEFT JOIN P_COLOR AS c ON c.id = ic.color_id
            LEFT JOIN T_ITEM_SHELF AS ishelf ON ishelf.item_id = i.id
            LEFT JOIN P_SHELF AS shelf ON shelf.id = ishelf.shelf_id
            LEFT JOIN P_SAMPLING_LOCATIONS AS samploc ON samploc.id = i.roll_location_id
            LEFT JOIN T_ITEM_MESSAGES AS mess ON mess.item_id = i.id
            LEFT JOIN T_ITEM_STOCK AS istock ON istock.item_id = i.id
            LEFT JOIN T_ITEM_RESELECTION AS resel ON resel.item_id_0 = i.id
            LEFT JOIN SHOWCASE_ITEM AS showi ON showi.item_id = i.id
            LEFT JOIN SHOWCASE_ITEM_COORD_COLOR AS coorclr ON i.id = coorclr.item_id
        `;

        // Note: The legacy uses $this->db_sales which points to the sales database
        // In local dev: opuzen_loc_sales, in prod: opuzen_prod_sales
        const salesDb = process.env.NODE_ENV === 'production' ? 'opuzen_prod_sales' : 'opuzen_loc_sales';
        fromClause += ` LEFT JOIN ${salesDb}.op_products_stock AS sales_stock ON i.id = sales_stock.master_item_id`;

        // Build the complete query
        const query = `SELECT ${selectClause} ${fromClause}
            WHERE i.id = ?
            AND i.product_type = ?
            GROUP BY i.id
        `;

        const result = await this.executeQuery(query, [itemId, productType]);
        return result[0] || null;
    }

    /**
     * Save item and related data
     * @param {Object} data - Item data
     * @param {number} itemId - Optional item ID for updates
     */
    async saveItem(data, itemId = null) {
        const connection = await this.db.pool.getConnection();
        try {
            await connection.beginTransaction();

            // Save main item data
            const itemData = {
                product_id: data.product_id,
                product_type: data.product_type,
                code: data.code,
                status_id: data.status_id,
                stock_status_id: data.stock_status_id,
                vendor_color: data.vendor_color,
                vendor_code: data.vendor_code,
                roll_location_id: data.roll_location_id,
                roll_yardage: data.roll_yardage,
                bin_location_id: data.bin_location_id,
                bin_quantity: data.bin_quantity,
                min_order_qty: data.min_order_qty,
                archived: data.archived || 'N'
            };

            let id;
            if (itemId) {
                await this.update(itemId, itemData);
                id = itemId;
            } else {
                const result = await this.create(itemData);
                id = result.id;
            }

            // Save related data
            if (data.colors) await this.saveColors(id, data.colors);
            if (data.shelves) await this.saveShelves(id, data.shelves);
            if (data.reselections) await this.saveReselections(id, data.reselections);
            if (data.showcase) await this.saveShowcase(id, data.showcase);

            // Refresh the product cache for this item's product
            await this.productModel.refreshCachedProductRow(data.product_id, data.product_type);

            await connection.commit();
            return this.getItemDetails(id, data.product_type);
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Helper methods for saving related data
    async saveColors(itemId, colors) {
        // First delete existing colors
        await this.executeQuery('DELETE FROM T_ITEM_COLOR WHERE item_id = ?', [itemId]);
        
        // Then insert new colors
        if (colors.length > 0) {
            const values = colors.map(colorId => [itemId, colorId]);
            const query = 'INSERT INTO T_ITEM_COLOR (item_id, color_id) VALUES ?';
            await this.executeQuery(query, [values]);
        }
    }

    async saveShelves(itemId, shelves) {
        // First delete existing shelves
        await this.executeQuery('DELETE FROM T_ITEM_SHELF WHERE item_id = ?', [itemId]);
        
        // Then insert new shelves
        if (shelves.length > 0) {
            const values = shelves.map(shelfId => [itemId, shelfId]);
            const query = 'INSERT INTO T_ITEM_SHELF (item_id, shelf_id) VALUES ?';
            await this.executeQuery(query, [values]);
        }
    }

    async saveReselections(itemId, reselections) {
        // First delete existing reselections
        await this.executeQuery('DELETE FROM T_ITEM_RESELE WHERE item_id_2 = ?', [itemId]);
        
        // Then insert new reselections
        if (reselections.length > 0) {
            const values = reselections.map(reselId => [reselId, itemId]);
            const query = 'INSERT INTO T_ITEM_RESELE (item_id_1, item_id_2) VALUES ?';
            await this.executeQuery(query, [values]);
        }
    }

    async saveShowcase(itemId, showcase) {
        const query = `
            INSERT INTO SHOWCASE_ITEM 
            (item_id, visible, url_title, pic_big_url, pic_hd_url)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            visible = VALUES(visible),
            url_title = VALUES(url_title),
            pic_big_url = VALUES(pic_big_url),
            pic_hd_url = VALUES(pic_hd_url)
        `;
        await this.executeQuery(query, [
            itemId,
            showcase.visible,
            showcase.url_title,
            showcase.pic_big_url,
            showcase.pic_hd_url
        ]);
    }

    /**
     * Search items for datatable with server-side processing - matches legacy get_product_items
     * @param {Object} params - Search parameters
     * @param {number} params.item_id - Optional item ID
     * @param {number} params.product_id - Optional product ID
     * @param {string} params.product_type - Optional product type ('R', 'D', or 'SP')
     * @returns {Promise<Object>} Datatable compatible result object
     */
    async searchItems(params = {}) {
        const { item_id, product_id, product_type } = params;
        let tableData = [];
        
        // Handle case where item_id is provided but no product_id and product_type = 'item_id'
        if (product_type === 'item_id' && !product_id && item_id && !isNaN(parseInt(item_id))) {
            tableData = await this.getItemDetailsByItemId(parseInt(item_id));
        }
        // Handle case for specific product types
        else if (['R', 'D', 'SP'].includes(product_type)) {
            if ((!item_id || item_id === '0' || item_id === 0) && 
                product_id && product_id !== '0' && product_id !== 0) {
                tableData = await this.getItemDetailsByProductId(parseInt(product_id), product_type);
            }
        }
        // Handle case where item_id is provided
        else if (item_id && item_id !== '0' && item_id !== 0) {
            tableData = await this.getItemDetailsByItemId(parseInt(item_id));
        }
        
        // Process the items to add web_visibility field and convert image URLs
        for (let i = 0; i < tableData.length; i++) {
            // Default web_visibility to "N"
            tableData[i].web_visibility = "N";
            
            // Check if item has web visibility
            if (tableData[i].item_id && tableData[i].item_code) {
                const webvis = await this.getItemWebVisibility(tableData[i].item_id, tableData[i].item_code);
                tableData[i].webvis = webvis;
                if (webvis === 1) {
                    tableData[i].web_visibility = "Y";
                }
            }
            
            // Convert image URLs to S3 URLs if needed
            if (tableData[i].pic_big_url) {
                tableData[i].pic_big_url = this.convertLegacyImgSrcToS3(tableData[i].pic_big_url);
            }
            if (tableData[i].pic_hd_url) {
                tableData[i].pic_hd_url = this.convertLegacyImgSrcToS3(tableData[i].pic_hd_url);
            }
        }
        
        return tableData;
    }
    
    /**
     * Get item details by item ID - matches legacy get_item_details_by_item_id
     * @param {number} itemId - Item ID
     * @returns {Promise<Array>} Array of item details
     */
    async getItemDetailsByItemId(itemId) {
        // First get basic item info to determine product type
        const query = `
            SELECT i.id AS item_id, i.product_type
            FROM T_ITEM i
            WHERE i.id = ?
            AND i.archived = 'N'
        `;
        
        const items = await this.executeQuery(query, [itemId]);
        if (!items || items.length === 0) {
            return [];
        }
        
        // Get full details for the item
        const result = [];
        for (const item of items) {
            const itemDetails = await this.getItemDetails(item.item_id, item.product_type);
            result.push(itemDetails);
        }
        
        return result;
    }
    
    /**
     * Get item web visibility - matches legacy get_item_web_visiblity
     * @param {number} itemId - Item ID
     * @param {string} itemCode - Item code
     * @returns {Promise<number>} 1 if visible, 0 if not
     */
    async getItemWebVisibility(itemId, itemCode) {
        const query = `
            SELECT COUNT(*) as count
            FROM SHOWCASE_ITEM si
            WHERE si.item_id = ?
            AND si.visible = 'Y'
        `;
        
        const result = await this.executeQuery(query, [itemId]);
        return result[0]?.count > 0 ? 1 : 0;
    }
    
    /**
     * Convert legacy image source to S3 URL - matches legacy fileuploadtos3::convertLegacyImgSrcToS3
     * @param {string} legacyImgUrl - Legacy image URL
     * @returns {string} S3 URL
     */
    convertLegacyImgSrcToS3(legacyImgUrl) {
        // This is a simplified version - in production, you would implement the full conversion logic
        // Check if the URL is already an S3 URL
        if (!legacyImgUrl || legacyImgUrl.includes('s3.amazonaws.com')) {
            return legacyImgUrl;
        }
        
        // Get the environment-specific S3 bucket
        const s3Bucket = process.env.AWS_S3_BUCKET || 'opuzen-dev';
        
        // Extract the file path from the legacy URL
        // Remove any domain or document root prefix
        let filePath = legacyImgUrl;
        if (filePath.includes('/')) {
            // Extract just the filename and directory structure
            const parts = filePath.split('/');
            const relevantParts = parts.slice(Math.max(parts.length - 3, 0));
            filePath = relevantParts.join('/');
        }
        
        // Construct the S3 URL
        return `https://${s3Bucket}.s3.amazonaws.com/images/${filePath}`;
    }

  /**
   * Get item data formatted for NetSuite sync
   * @param {number} itemId - OPMS item ID
   * @param {string} productType - Product type ('R' or 'D')
   * @returns {object} Item data formatted for NetSuite
   */
  async getItemForNetSuiteSync(itemId, productType = 'R') {
    const query = `
      SELECT DISTINCT
        i.id as item_id,
        i.code,
        i.vendor_code,
        i.vendor_color,
        p.id as product_id,
        p.name as product_name,
        p.width,
        v.id as vendor_id,
        v.name as vendor_name,
        m.netsuite_vendor_id,
        m.netsuite_vendor_name,
        pvar.vendor_product_name,
        GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') as color_names
      FROM T_ITEM i
      JOIN T_PRODUCT p ON i.product_id = p.id
      JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
      JOIN Z_VENDOR v ON pv.vendor_id = v.id
      JOIN opms_netsuite_vendor_mapping m ON v.id = m.opms_vendor_id
      LEFT JOIN T_PRODUCT_VARIOUS pvar ON p.id = pvar.product_id
      LEFT JOIN T_ITEM_COLOR ic ON i.id = ic.item_id
      LEFT JOIN P_COLOR c ON ic.color_id = c.id
      WHERE i.id = ?
        AND i.code IS NOT NULL
        AND p.name IS NOT NULL
        AND v.name IS NOT NULL
        AND i.archived = 'N'
        AND p.archived = 'N'
        AND v.active = 'Y'
        AND v.archived = 'N'
        AND m.opms_vendor_name = m.netsuite_vendor_name
      GROUP BY i.id, i.code, i.vendor_code, i.vendor_color, p.id, p.name, p.width, 
               v.id, v.name, m.netsuite_vendor_id, m.netsuite_vendor_name, pvar.vendor_product_name
      HAVING color_names IS NOT NULL
    `;
    
    try {
      const rows = await this.executeQuery(query, [itemId]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error getting item for NetSuite sync:', error);
      throw error;
    }
  }
}

module.exports = ItemModel; 