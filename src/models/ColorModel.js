const BaseModel = require('./BaseModel');

class ColorModel extends BaseModel {
    constructor() {
        super('P_COLOR');
    }

    /**
     * Get all colors with optional filtering
     * @param {Object} filters - Optional filters (name, archived, etc.)
     * @returns {Promise<Array>} Array of colors
     */
    async getAllColors(filters = {}) {
        let query = `
            SELECT 
                c.*,
                COUNT(DISTINCT ic.item_id) as item_count
            FROM P_COLOR c
            LEFT JOIN T_ITEM_COLOR ic ON c.id = ic.color_id
        `;

        const values = [];
        const conditions = [];

        if (filters.name) {
            conditions.push('c.name LIKE ?');
            values.push(`%${filters.name}%`);
        }

        if (filters.archived !== undefined) {
            // Map archived filter to active column (archived='N' means active='Y')
            const activeValue = filters.archived === 'N' ? 'Y' : 'N';
            conditions.push('c.active = ?');
            values.push(activeValue);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' GROUP BY c.id ORDER BY c.name ASC';

        return this.executeQuery(query, values);
    }

    /**
     * Get colors for a specific item
     * @param {number} itemId - Item ID
     * @returns {Promise<Array>} Array of colors with order information
     */
    async getItemColors(itemId) {
        const query = `
            SELECT 
                c.*,
                ic.n_order
            FROM P_COLOR c
            INNER JOIN T_ITEM_COLOR ic ON c.id = ic.color_id
            WHERE ic.item_id = ?
            ORDER BY ic.n_order ASC
        `;
        
        return this.executeQuery(query, [itemId]);
    }

    /**
     * Add a color to an item
     * @param {number} itemId - Item ID
     * @param {number} colorId - Color ID
     * @param {number} order - Optional order number
     * @returns {Promise<Object>} Created relationship
     */
    async addItemColor(itemId, colorId, order = null) {
        // If no order specified, get the next available order number
        if (order === null) {
            const [maxOrder] = await this.executeQuery(
                'SELECT MAX(n_order) as max_order FROM T_ITEM_COLOR WHERE item_id = ?',
                [itemId]
            );
            order = (maxOrder.max_order || 0) + 1;
        }

        const query = `
            INSERT INTO T_ITEM_COLOR (item_id, color_id, n_order, date_add, user_id)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
            ON DUPLICATE KEY UPDATE 
            n_order = VALUES(n_order),
            user_id = VALUES(user_id)
        `;

        await this.executeQuery(query, [itemId, colorId, order, 0]);
        return this.getItemColors(itemId);
    }

    /**
     * Remove a color from an item
     * @param {number} itemId - Item ID
     * @param {number} colorId - Color ID
     * @returns {Promise<boolean>} Success status
     */
    async removeItemColor(itemId, colorId) {
        const result = await this.executeQuery(
            'DELETE FROM T_ITEM_COLOR WHERE item_id = ? AND color_id = ?',
            [itemId, colorId]
        );
        return result.affectedRows > 0;
    }

    /**
     * Get items that use a specific color
     * @param {number} colorId - Color ID
     * @returns {Promise<Array>} Array of items using the color
     */
    async getItemsByColor(colorId) {
        const query = `
            SELECT 
                i.*,
                ic.n_order as color_order
            FROM T_ITEM i
            INNER JOIN T_ITEM_COLOR ic ON i.id = ic.item_id
            WHERE ic.color_id = ?
            AND i.archived = 'N'
            ORDER BY i.code ASC
        `;
        
        return this.executeQuery(query, [colorId]);
    }
}

module.exports = ColorModel;
