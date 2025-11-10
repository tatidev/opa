const BaseModel = require('./BaseModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');

class UserModel extends BaseModel {
    constructor() {
        super('api_users');
    }

    /**
     * Create a new user with hashed password
     * @param {Object} userData - User data
     * @returns {Promise<Object>} Created user without password
     */
    async createUser(userData) {
        try {
            // Hash password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
            
            // Generate email verification token
            const emailVerificationToken = crypto.randomBytes(32).toString('hex');
            
            const userToCreate = {
                ...userData,
                password_hash: hashedPassword,
                email_verification_token: emailVerificationToken,
                is_active: true,
                email_verified: false
            };
            
            // Remove plain password from object
            delete userToCreate.password;
            
            const result = await this.create(userToCreate);
            
            // Return user without sensitive data
            return await this.findByIdSafe(result.id);
        } catch (error) {
            logger.error('Error creating user:', error);
            throw error;
        }
    }

    /**
     * Find user by email or username
     * @param {string} identifier - Email or username
     * @returns {Promise<Object|null>} User with password hash
     */
    async findByIdentifier(identifier) {
        const query = `
            SELECT * FROM ${this.tableName} 
            WHERE (email = ? OR username = ?) 
            AND is_active = TRUE
        `;
        const results = await this.executeQuery(query, [identifier, identifier]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Find user by ID without sensitive data
     * @param {number} id - User ID
     * @returns {Promise<Object|null>} User without password hash
     */
    async findByIdSafe(id) {
        const query = `
            SELECT 
                id, username, email, first_name, last_name, phone, company,
                is_active, email_verified, last_login, created_at, updated_at
            FROM ${this.tableName} 
            WHERE id = ? AND is_active = TRUE
        `;
        const results = await this.executeQuery(query, [id]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Find user with roles and showrooms
     * @param {number} id - User ID
     * @returns {Promise<Object|null>} User with roles and showrooms
     */
    async findWithRolesAndShowrooms(id) {
        const user = await this.findByIdSafe(id);
        if (!user) return null;

        // Get user roles
        const rolesQuery = `
            SELECT r.id, r.name, r.description
            FROM api_roles r
            JOIN api_user_roles ur ON r.id = ur.role_id
            WHERE ur.user_id = ? AND r.is_active = TRUE
        `;
        const roles = await this.executeQuery(rolesQuery, [id]);

        // Get user showrooms
        const showroomsQuery = `
            SELECT s.id, s.name, s.abbreviation, s.city, s.state
            FROM api_showrooms s
            JOIN api_user_showrooms us ON s.id = us.showroom_id
            WHERE us.user_id = ? AND s.is_active = TRUE
        `;
        const showrooms = await this.executeQuery(showroomsQuery, [id]);

        return {
            ...user,
            roles: roles,
            showrooms: showrooms
        };
    }

    /**
     * Verify user password
     * @param {string} password - Plain text password
     * @param {string} hashedPassword - Hashed password from database
     * @returns {Promise<boolean>} Password match result
     */
    async verifyPassword(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }

    /**
     * Update user password
     * @param {number} userId - User ID
     * @param {string} newPassword - New plain text password
     * @returns {Promise<boolean>} Update success
     */
    async updatePassword(userId, newPassword) {
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        
        const result = await this.update(userId, {
            password_hash: hashedPassword,
            password_reset_token: null,
            password_reset_expires: null
        });
        
        return result.affectedRows > 0;
    }

    /**
     * Generate password reset token
     * @param {string} email - User email
     * @returns {Promise<string|null>} Reset token or null if user not found
     */
    async generatePasswordResetToken(email) {
        const user = await this.findByIdentifier(email);
        if (!user) return null;

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 3600000); // 1 hour

        await this.update(user.id, {
            password_reset_token: resetToken,
            password_reset_expires: resetExpires
        });

        return resetToken;
    }

    /**
     * Verify password reset token
     * @param {string} token - Reset token
     * @returns {Promise<Object|null>} User if valid token
     */
    async verifyPasswordResetToken(token) {
        const query = `
            SELECT * FROM ${this.tableName} 
            WHERE password_reset_token = ? 
            AND password_reset_expires > NOW()
            AND is_active = TRUE
        `;
        const results = await this.executeQuery(query, [token]);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Update last login timestamp
     * @param {number} userId - User ID
     * @returns {Promise<boolean>} Update success
     */
    async updateLastLogin(userId) {
        const result = await this.update(userId, {
            last_login: new Date(),
            failed_login_attempts: 0,
            locked_until: null
        });
        return result.affectedRows > 0;
    }

    /**
     * Handle failed login attempt
     * @param {number} userId - User ID
     * @returns {Promise<boolean>} Update success
     */
    async handleFailedLogin(userId) {
        const user = await this.findById(userId);
        if (!user) return false;

        const attempts = (user.failed_login_attempts || 0) + 1;
        const lockUntil = attempts >= 5 ? new Date(Date.now() + 900000) : null; // 15 minutes

        const result = await this.update(userId, {
            failed_login_attempts: attempts,
            locked_until: lockUntil
        });

        return result.affectedRows > 0;
    }

    /**
     * Check if user is locked
     * @param {Object} user - User object
     * @returns {boolean} Lock status
     */
    isUserLocked(user) {
        if (!user.locked_until) return false;
        return new Date() < new Date(user.locked_until);
    }

    /**
     * Assign role to user
     * @param {number} userId - User ID
     * @param {number} roleId - Role ID
     * @param {number} assignedBy - ID of user making assignment
     * @returns {Promise<boolean>} Assignment success
     */
    async assignRole(userId, roleId, assignedBy) {
        try {
            const query = `
                INSERT INTO api_user_roles (user_id, role_id, assigned_by)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by)
            `;
            await this.executeQuery(query, [userId, roleId, assignedBy]);
            return true;
        } catch (error) {
            logger.error('Error assigning role:', error);
            return false;
        }
    }

    /**
     * Remove role from user
     * @param {number} userId - User ID
     * @param {number} roleId - Role ID
     * @returns {Promise<boolean>} Removal success
     */
    async removeRole(userId, roleId) {
        try {
            const query = `DELETE FROM api_user_roles WHERE user_id = ? AND role_id = ?`;
            await this.executeQuery(query, [userId, roleId]);
            return true;
        } catch (error) {
            logger.error('Error removing role:', error);
            return false;
        }
    }

    /**
     * Assign showroom to user
     * @param {number} userId - User ID
     * @param {number} showroomId - Showroom ID
     * @param {number} assignedBy - ID of user making assignment
     * @returns {Promise<boolean>} Assignment success
     */
    async assignShowroom(userId, showroomId, assignedBy) {
        try {
            const query = `
                INSERT INTO api_user_showrooms (user_id, showroom_id, assigned_by)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by)
            `;
            await this.executeQuery(query, [userId, showroomId, assignedBy]);
            return true;
        } catch (error) {
            logger.error('Error assigning showroom:', error);
            return false;
        }
    }

    /**
     * Remove showroom from user
     * @param {number} userId - User ID
     * @param {number} showroomId - Showroom ID
     * @returns {Promise<boolean>} Removal success
     */
    async removeShowroom(userId, showroomId) {
        try {
            const query = `DELETE FROM api_user_showrooms WHERE user_id = ? AND showroom_id = ?`;
            await this.executeQuery(query, [userId, showroomId]);
            return true;
        } catch (error) {
            logger.error('Error removing showroom:', error);
            return false;
        }
    }

    /**
     * Get all users with roles and showrooms
     * @param {Object} filters - Optional filters
     * @returns {Promise<Array>} Users array
     */
    async getAllUsersWithDetails(filters = {}) {
        let query = `
            SELECT 
                u.id, u.username, u.email, u.first_name, u.last_name, 
                u.phone, u.company, u.is_active, u.email_verified, 
                u.last_login, u.created_at, u.updated_at,
                GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ', ') as roles,
                GROUP_CONCAT(DISTINCT s.abbreviation ORDER BY s.abbreviation SEPARATOR ', ') as showrooms
            FROM ${this.tableName} u
            LEFT JOIN api_user_roles ur ON u.id = ur.user_id
            LEFT JOIN api_roles r ON ur.role_id = r.id AND r.is_active = TRUE
            LEFT JOIN api_user_showrooms us ON u.id = us.user_id
            LEFT JOIN api_showrooms s ON us.showroom_id = s.id AND s.is_active = TRUE
        `;

        const conditions = [];
        const values = [];

        if (filters.is_active !== undefined) {
            conditions.push('u.is_active = ?');
            values.push(filters.is_active);
        }

        if (filters.role) {
            conditions.push('r.name = ?');
            values.push(filters.role);
        }

        if (filters.showroom) {
            conditions.push('s.abbreviation = ?');
            values.push(filters.showroom);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' GROUP BY u.id ORDER BY u.last_name, u.first_name';

        return await this.executeQuery(query, values);
    }

    /**
     * Check if user has specific role
     * @param {number} userId - User ID
     * @param {string} roleName - Role name
     * @returns {Promise<boolean>} Role check result
     */
    async hasRole(userId, roleName) {
        const query = `
            SELECT COUNT(*) as count
            FROM api_user_roles ur
            JOIN api_roles r ON ur.role_id = r.id
            WHERE ur.user_id = ? AND r.name = ? AND r.is_active = TRUE
        `;
        const results = await this.executeQuery(query, [userId, roleName]);
        return results[0].count > 0;
    }

    /**
     * Check if user has access to specific showroom
     * @param {number} userId - User ID
     * @param {number} showroomId - Showroom ID
     * @returns {Promise<boolean>} Access check result
     */
    async hasShowroomAccess(userId, showroomId) {
        const query = `
            SELECT COUNT(*) as count
            FROM api_user_showrooms us
            JOIN api_showrooms s ON us.showroom_id = s.id
            WHERE us.user_id = ? AND s.id = ? AND s.is_active = TRUE
        `;
        const results = await this.executeQuery(query, [userId, showroomId]);
        return results[0].count > 0;
    }
}

module.exports = UserModel; 