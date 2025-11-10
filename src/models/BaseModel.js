const db = require('../config/database');
const logger = require('../utils/logger');

class BaseModel {
    constructor(tableName) {
        this.tableName = tableName;
        this.db = db;
    }

    /**
     * Find a single record by ID
     * @param {number} id - The ID to find
     * @returns {Promise<Object>} The found record
     */
    async findById(id) {
        try {
            const [rows] = await this.db.query(
                `SELECT * FROM ${this.tableName} WHERE id = ?`,
                [id]
            );
            return rows[0];
        } catch (error) {
            logger.error(`Error in ${this.tableName}.findById:`, error);
            throw error;
        }
    }

    /**
     * Find all records with optional conditions
     * @param {Object} conditions - The conditions to filter by
     * @returns {Promise<Array>} Array of found records
     */
    async findAll(conditions = {}) {
        try {
            let query = `SELECT * FROM ${this.tableName}`;
            const values = [];
            
            if (Object.keys(conditions).length > 0) {
                const whereClause = Object.keys(conditions)
                    .map(key => `${key} = ?`)
                    .join(' AND ');
                query += ` WHERE ${whereClause}`;
                values.push(...Object.values(conditions));
            }

            const [rows] = await this.db.query(query, values);
            return rows;
        } catch (error) {
            logger.error(`Error in ${this.tableName}.findAll:`, error);
            throw error;
        }
    }

    /**
     * Create a new record
     * @param {Object} data - The data to insert
     * @returns {Promise<Object>} The created record
     */
    async create(data) {
        try {
            const columns = Object.keys(data).join(', ');
            const placeholders = Object.keys(data).map(() => '?').join(', ');
            const values = Object.values(data);

            const [result] = await this.db.query(
                `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`,
                values
            );

            return this.findById(result.insertId);
        } catch (error) {
            logger.error(`Error in ${this.tableName}.create:`, error);
            throw error;
        }
    }

    /**
     * Update a record by ID
     * @param {number} id - The ID to update
     * @param {Object} data - The data to update
     * @returns {Promise<Object>} The updated record
     */
    async update(id, data) {
        try {
            const setClause = Object.keys(data)
                .map(key => `${key} = ?`)
                .join(', ');
            const values = [...Object.values(data), id];

            await this.db.query(
                `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`,
                values
            );

            return this.findById(id);
        } catch (error) {
            logger.error(`Error in ${this.tableName}.update:`, error);
            throw error;
        }
    }

    /**
     * Delete a record by ID
     * @param {number} id - The ID to delete
     * @returns {Promise<boolean>} Success status
     */
    async delete(id) {
        try {
            const [result] = await this.db.query(
                `DELETE FROM ${this.tableName} WHERE id = ?`,
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            logger.error(`Error in ${this.tableName}.delete:`, error);
            throw error;
        }
    }

    /**
     * Execute a custom query
     * @param {string} query - The SQL query
     * @param {Array} values - The values for the query
     * @returns {Promise<Array>} The query results
     */
    async executeQuery(query, values = []) {
        try {
            const [rows] = await this.db.query(query, values);
            return rows;
        } catch (error) {
            logger.error(`Error in ${this.tableName}.executeQuery:`, error);
            throw error;
        }
    }
}

module.exports = BaseModel; 