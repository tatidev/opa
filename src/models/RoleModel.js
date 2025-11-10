const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class RoleModel extends BaseModel {
    constructor() {
        super('api_roles');
    }

    /**
     * Get all active roles
     * @returns {Promise<Array>} Array of roles
     */
    async getAllRoles() {
        const query = `
            SELECT id, name, description, is_active, created_at, updated_at
            FROM ${this.tableName}
            WHERE is_active = TRUE
            ORDER BY name ASC
        `;
        return await this.executeQuery(query);
    }

    /**
     * Find role by name
     * @param {string} name - Role name
     * @returns {Promise<Object|null>} Role object or null
     */
    async findByName(name) {
        const query = `
            SELECT id, name, description, is_active, created_at, updated_at
            FROM ${this.tableName}
            WHERE name = ? AND is_active = TRUE
        `;
        const results = await this.executeQuery(query, [name]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Create a new role
     * @param {Object} roleData - Role data
     * @returns {Promise<Object>} Created role
     */
    async createRole(roleData) {
        try {
            const result = await this.create({
                name: roleData.name,
                description: roleData.description || '',
                is_active: roleData.is_active !== undefined ? roleData.is_active : true
            });
            
            return await this.findById(result.id);
        } catch (error) {
            logger.error('Error creating role:', error);
            throw error;
        }
    }

    /**
     * Update role
     * @param {number} roleId - Role ID
     * @param {Object} updates - Update data
     * @returns {Promise<Object|null>} Updated role or null
     */
    async updateRole(roleId, updates) {
        try {
            const result = await this.update(roleId, updates);
            if (result.affectedRows === 0) return null;
            
            return await this.findById(roleId);
        } catch (error) {
            logger.error('Error updating role:', error);
            throw error;
        }
    }

    /**
     * Get role with users count
     * @param {number} roleId - Role ID
     * @returns {Promise<Object|null>} Role with user count
     */
    async getRoleWithUserCount(roleId) {
        const query = `
            SELECT 
                r.id, r.name, r.description, r.is_active, 
                r.created_at, r.updated_at,
                COUNT(ur.user_id) as user_count
            FROM ${this.tableName} r
            LEFT JOIN api_user_roles ur ON r.id = ur.role_id
            WHERE r.id = ? AND r.is_active = TRUE
            GROUP BY r.id
        `;
        const results = await this.executeQuery(query, [roleId]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Get all roles with user counts
     * @returns {Promise<Array>} Array of roles with user counts
     */
    async getAllRolesWithUserCounts() {
        const query = `
            SELECT 
                r.id, r.name, r.description, r.is_active, 
                r.created_at, r.updated_at,
                COUNT(ur.user_id) as user_count
            FROM ${this.tableName} r
            LEFT JOIN api_user_roles ur ON r.id = ur.role_id
            WHERE r.is_active = TRUE
            GROUP BY r.id
            ORDER BY r.name ASC
        `;
        return await this.executeQuery(query);
    }

    /**
     * Get users assigned to a specific role
     * @param {number} roleId - Role ID
     * @returns {Promise<Array>} Array of users
     */
    async getRoleUsers(roleId) {
        const query = `
            SELECT 
                u.id, u.username, u.email, u.first_name, u.last_name,
                u.is_active, u.last_login, ur.assigned_at
            FROM api_users u
            JOIN api_user_roles ur ON u.id = ur.user_id
            WHERE ur.role_id = ? AND u.is_active = TRUE
            ORDER BY u.last_name, u.first_name
        `;
        return await this.executeQuery(query, [roleId]);
    }

    /**
     * Check if role can be deleted (no users assigned)
     * @param {number} roleId - Role ID
     * @returns {Promise<boolean>} Whether role can be deleted
     */
    async canDeleteRole(roleId) {
        const query = `
            SELECT COUNT(*) as count
            FROM api_user_roles ur
            JOIN api_users u ON ur.user_id = u.id
            WHERE ur.role_id = ? AND u.is_active = TRUE
        `;
        const results = await this.executeQuery(query, [roleId]);
        return results[0].count === 0;
    }

    /**
     * Deactivate role instead of deleting
     * @param {number} roleId - Role ID
     * @returns {Promise<boolean>} Success status
     */
    async deactivateRole(roleId) {
        try {
            const result = await this.update(roleId, { is_active: false });
            return result.affectedRows > 0;
        } catch (error) {
            logger.error('Error deactivating role:', error);
            return false;
        }
    }

    /**
     * Check if role name exists (for validation)
     * @param {string} name - Role name
     * @param {number} excludeId - ID to exclude from check (for updates)
     * @returns {Promise<boolean>} Whether name exists
     */
    async roleNameExists(name, excludeId = null) {
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
     * Get role permissions (placeholder for future expansion)
     * @param {number} roleId - Role ID
     * @returns {Promise<Array>} Array of permissions
     */
    async getRolePermissions(roleId) {
        // For now, return empty array - can be expanded later
        // when we add a permissions system
        return [];
    }
}

module.exports = RoleModel; 