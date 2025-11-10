const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class ShowroomModel extends BaseModel {
    constructor() {
        super('api_showrooms');
    }

    /**
     * Get all active showrooms
     * @param {Object} filters - Optional filters
     * @returns {Promise<Array>} Array of showrooms
     */
    async getAllShowrooms(filters = {}) {
        let query = `
            SELECT id, name, abbreviation, address, city, state, zip, country,
                   phone, email, contact_person, is_active, created_at, updated_at
            FROM ${this.tableName}
        `;
        
        const conditions = [];
        const values = [];

        if (filters.is_active !== undefined) {
            conditions.push('is_active = ?');
            values.push(filters.is_active);
        }

        if (filters.state) {
            conditions.push('state = ?');
            values.push(filters.state);
        }

        if (filters.search) {
            conditions.push('(name LIKE ? OR abbreviation LIKE ? OR city LIKE ?)');
            const searchTerm = `%${filters.search}%`;
            values.push(searchTerm, searchTerm, searchTerm);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY name ASC';

        return await this.executeQuery(query, values);
    }

    /**
     * Find showroom by abbreviation
     * @param {string} abbreviation - Showroom abbreviation
     * @returns {Promise<Object|null>} Showroom object or null
     */
    async findByAbbreviation(abbreviation) {
        const query = `
            SELECT id, name, abbreviation, address, city, state, zip, country,
                   phone, email, contact_person, is_active, created_at, updated_at
            FROM ${this.tableName}
            WHERE abbreviation = ? AND is_active = TRUE
        `;
        const results = await this.executeQuery(query, [abbreviation]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Create a new showroom
     * @param {Object} showroomData - Showroom data
     * @returns {Promise<Object>} Created showroom
     */
    async createShowroom(showroomData) {
        try {
            const result = await this.create({
                name: showroomData.name,
                abbreviation: showroomData.abbreviation,
                address: showroomData.address || null,
                city: showroomData.city || null,
                state: showroomData.state || null,
                zip: showroomData.zip || null,
                country: showroomData.country || 'USA',
                phone: showroomData.phone || null,
                email: showroomData.email || null,
                contact_person: showroomData.contact_person || null,
                is_active: showroomData.is_active !== undefined ? showroomData.is_active : true
            });
            
            return await this.findById(result.id);
        } catch (error) {
            logger.error('Error creating showroom:', error);
            throw error;
        }
    }

    /**
     * Update showroom
     * @param {number} showroomId - Showroom ID
     * @param {Object} updates - Update data
     * @returns {Promise<Object|null>} Updated showroom or null
     */
    async updateShowroom(showroomId, updates) {
        try {
            const result = await this.update(showroomId, updates);
            if (result.affectedRows === 0) return null;
            
            return await this.findById(showroomId);
        } catch (error) {
            logger.error('Error updating showroom:', error);
            throw error;
        }
    }

    /**
     * Get showroom with users count
     * @param {number} showroomId - Showroom ID
     * @returns {Promise<Object|null>} Showroom with user count
     */
    async getShowroomWithUserCount(showroomId) {
        const query = `
            SELECT 
                s.id, s.name, s.abbreviation, s.address, s.city, s.state, s.zip, s.country,
                s.phone, s.email, s.contact_person, s.is_active, s.created_at, s.updated_at,
                COUNT(us.user_id) as user_count
            FROM ${this.tableName} s
            LEFT JOIN api_user_showrooms us ON s.id = us.showroom_id
            WHERE s.id = ? AND s.is_active = TRUE
            GROUP BY s.id
        `;
        const results = await this.executeQuery(query, [showroomId]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Get all showrooms with user counts
     * @returns {Promise<Array>} Array of showrooms with user counts
     */
    async getAllShowroomsWithUserCounts() {
        const query = `
            SELECT 
                s.id, s.name, s.abbreviation, s.address, s.city, s.state, s.zip, s.country,
                s.phone, s.email, s.contact_person, s.is_active, s.created_at, s.updated_at,
                COUNT(us.user_id) as user_count
            FROM ${this.tableName} s
            LEFT JOIN api_user_showrooms us ON s.id = us.showroom_id
            WHERE s.is_active = TRUE
            GROUP BY s.id
            ORDER BY s.name ASC
        `;
        return await this.executeQuery(query);
    }

    /**
     * Get users assigned to a specific showroom
     * @param {number} showroomId - Showroom ID
     * @returns {Promise<Array>} Array of users
     */
    async getShowroomUsers(showroomId) {
        const query = `
            SELECT 
                u.id, u.username, u.email, u.first_name, u.last_name,
                u.is_active, u.last_login, us.assigned_at,
                GROUP_CONCAT(r.name ORDER BY r.name SEPARATOR ', ') as roles
            FROM api_users u
            JOIN api_user_showrooms us ON u.id = us.user_id
            LEFT JOIN api_user_roles ur ON u.id = ur.user_id
            LEFT JOIN api_roles r ON ur.role_id = r.id AND r.is_active = TRUE
            WHERE us.showroom_id = ? AND u.is_active = TRUE
            GROUP BY u.id
            ORDER BY u.last_name, u.first_name
        `;
        return await this.executeQuery(query, [showroomId]);
    }

    /**
     * Check if showroom can be deleted (no users assigned)
     * @param {number} showroomId - Showroom ID
     * @returns {Promise<boolean>} Whether showroom can be deleted
     */
    async canDeleteShowroom(showroomId) {
        const query = `
            SELECT COUNT(*) as count
            FROM api_user_showrooms us
            JOIN api_users u ON us.user_id = u.id
            WHERE us.showroom_id = ? AND u.is_active = TRUE
        `;
        const results = await this.executeQuery(query, [showroomId]);
        return results[0].count === 0;
    }

    /**
     * Deactivate showroom instead of deleting
     * @param {number} showroomId - Showroom ID
     * @returns {Promise<boolean>} Success status
     */
    async deactivateShowroom(showroomId) {
        try {
            const result = await this.update(showroomId, { is_active: false });
            return result.affectedRows > 0;
        } catch (error) {
            logger.error('Error deactivating showroom:', error);
            return false;
        }
    }

    /**
     * Check if showroom name exists (for validation)
     * @param {string} name - Showroom name
     * @param {number} excludeId - ID to exclude from check (for updates)
     * @returns {Promise<boolean>} Whether name exists
     */
    async showroomNameExists(name, excludeId = null) {
        let query = `
            SELECT COUNT(*) as count
            FROM ${this.tableName}
            WHERE name = ? AND is_active = TRUE
        `;
        const params = [name];

        if (excludeId) {
            query += ' AND id != ?';
            params.push(excludeId);
        }

        const results = await this.executeQuery(query, params);
        return results[0].count > 0;
    }

    /**
     * Check if showroom abbreviation exists (for validation)
     * @param {string} abbreviation - Showroom abbreviation
     * @param {number} excludeId - ID to exclude from check (for updates)
     * @returns {Promise<boolean>} Whether abbreviation exists
     */
    async showroomAbbreviationExists(abbreviation, excludeId = null) {
        let query = `
            SELECT COUNT(*) as count
            FROM ${this.tableName}
            WHERE abbreviation = ? AND is_active = TRUE
        `;
        const params = [abbreviation];

        if (excludeId) {
            query += ' AND id != ?';
            params.push(excludeId);
        }

        const results = await this.executeQuery(query, params);
        return results[0].count > 0;
    }

    /**
     * Get showrooms by state
     * @param {string} state - State abbreviation
     * @returns {Promise<Array>} Array of showrooms
     */
    async getShowroomsByState(state) {
        const query = `
            SELECT id, name, abbreviation, city, state, phone, email, contact_person
            FROM ${this.tableName}
            WHERE state = ? AND is_active = TRUE
            ORDER BY name ASC
        `;
        return await this.executeQuery(query, [state]);
    }

    /**
     * Get showrooms for dropdown/select options
     * @returns {Promise<Array>} Array of showrooms with id, name, and abbreviation
     */
    async getShowroomOptions() {
        const query = `
            SELECT id, name, abbreviation, 
                   CONCAT(abbreviation, ' - ', name) as display_name
            FROM ${this.tableName}
            WHERE is_active = TRUE
            ORDER BY name ASC
        `;
        return await this.executeQuery(query);
    }

    /**
     * Get showroom statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getShowroomStatistics() {
        const query = `
            SELECT 
                COUNT(*) as total_showrooms,
                COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_showrooms,
                COUNT(CASE WHEN is_active = FALSE THEN 1 END) as inactive_showrooms,
                COUNT(DISTINCT state) as states_count
            FROM ${this.tableName}
        `;
        const results = await this.executeQuery(query);
        return results[0];
    }

    /**
     * Search showrooms by various criteria
     * @param {string} searchTerm - Search term
     * @returns {Promise<Array>} Array of matching showrooms
     */
    async searchShowrooms(searchTerm) {
        const query = `
            SELECT id, name, abbreviation, city, state, phone, email, contact_person
            FROM ${this.tableName}
            WHERE (
                name LIKE ? OR 
                abbreviation LIKE ? OR 
                city LIKE ? OR 
                state LIKE ? OR 
                contact_person LIKE ?
            ) AND is_active = TRUE
            ORDER BY name ASC
        `;
        const searchPattern = `%${searchTerm}%`;
        return await this.executeQuery(query, [
            searchPattern, searchPattern, searchPattern, 
            searchPattern, searchPattern
        ]);
    }
}

module.exports = ShowroomModel; 