/**
 * NetSuite Model
 * Handles data synchronization between OPMS and NetSuite
 */

const BaseModel = require('./BaseModel');
const netsuiteClient = require('../services/netsuiteClient');
const logger = require('../utils/logger');

class NetSuiteModel extends BaseModel {
  constructor() {
    super('netsuite_sync_log'); // Table to store sync logs
  }

  /**
   * Synchronize inventory items from NetSuite to local database
   * 
   * @param {Object} options - Sync options
   * @returns {Object} - Sync results
   */
  async syncInventoryItems(options = {}) {
    const { limit = 100, lastSync = null } = options;
    
    try {
      logger.info('Starting NetSuite inventory items sync', { limit, lastSync });
      
      // Get inventory items from NetSuite
      const params = { limit };
      if (lastSync) {
        params.lastModifiedDate = lastSync;
      }
      
      const inventoryItems = await netsuiteClient.getInventoryItems(params);
      
      if (!inventoryItems || !inventoryItems.items) {
        logger.warn('No inventory items returned from NetSuite');
        return { success: false, message: 'No inventory items returned', count: 0 };
      }
      
      logger.info(`Retrieved ${inventoryItems.items.length} inventory items from NetSuite`);
      
      // Process inventory items
      const processedItems = [];
      
      for (const item of inventoryItems.items) {
        // Process each inventory item
        // This would typically involve mapping NetSuite fields to your database schema
        // and inserting or updating records in your database
        
        // For demonstration purposes, we'll just log the item
        logger.debug(`Processing inventory item: ${item.id}`, { itemId: item.id });
        
        processedItems.push({
          netsuiteId: item.id,
          name: item.displayName || item.itemId,
          // Add other fields as needed
        });
      }
      
      // Log sync results
      const syncLog = {
        sync_type: 'inventory_items',
        items_count: processedItems.length,
        sync_date: new Date(),
        status: 'success',
        details: JSON.stringify({ 
          processed: processedItems.length,
          total: inventoryItems.items.length
        })
      };
      
      await this.create(syncLog);
      
      return {
        success: true,
        message: `Synchronized ${processedItems.length} inventory items`,
        count: processedItems.length,
        items: processedItems
      };
    } catch (error) {
      logger.error('Error synchronizing inventory items from NetSuite', { error: error.message });
      
      // Log sync error
      const syncLog = {
        sync_type: 'inventory_items',
        items_count: 0,
        sync_date: new Date(),
        status: 'error',
        details: JSON.stringify({ error: error.message })
      };
      
      await this.create(syncLog);
      
      return {
        success: false,
        message: `Error synchronizing inventory items: ${error.message}`,
        count: 0
      };
    }
  }

  /**
   * Synchronize assembly items from NetSuite to local database
   * 
   * @param {Object} options - Sync options
   * @returns {Object} - Sync results
   */
  async syncAssemblyItems(options = {}) {
    const { limit = 100, lastSync = null } = options;
    
    try {
      logger.info('Starting NetSuite assembly items sync', { limit, lastSync });
      
      // Get assembly items from NetSuite
      const params = { limit };
      if (lastSync) {
        params.lastModifiedDate = lastSync;
      }
      
      const assemblyItems = await netsuiteClient.getAssemblyItems(params);
      
      if (!assemblyItems || !assemblyItems.items) {
        logger.warn('No assembly items returned from NetSuite');
        return { success: false, message: 'No assembly items returned', count: 0 };
      }
      
      logger.info(`Retrieved ${assemblyItems.items.length} assembly items from NetSuite`);
      
      // Process assembly items
      const processedItems = [];
      
      for (const item of assemblyItems.items) {
        // Process each assembly item
        logger.debug(`Processing assembly item: ${item.id}`, { itemId: item.id });
        
        processedItems.push({
          netsuiteId: item.id,
          name: item.displayName || item.itemId,
          // Add other fields as needed
        });
      }
      
      // Log sync results
      const syncLog = {
        sync_type: 'assembly_items',
        items_count: processedItems.length,
        sync_date: new Date(),
        status: 'success',
        details: JSON.stringify({ 
          processed: processedItems.length,
          total: assemblyItems.items.length
        })
      };
      
      await this.create(syncLog);
      
      return {
        success: true,
        message: `Synchronized ${processedItems.length} assembly items`,
        count: processedItems.length,
        items: processedItems
      };
    } catch (error) {
      logger.error('Error synchronizing assembly items from NetSuite', { error: error.message });
      
      // Log sync error
      const syncLog = {
        sync_type: 'assembly_items',
        items_count: 0,
        sync_date: new Date(),
        status: 'error',
        details: JSON.stringify({ error: error.message })
      };
      
      await this.create(syncLog);
      
      return {
        success: false,
        message: `Error synchronizing assembly items: ${error.message}`,
        count: 0
      };
    }
  }

  /**
   * Get sync history
   * 
   * @param {Object} options - Query options
   * @returns {Array} - Sync history records
   */
  async getSyncHistory(options = {}) {
    const { limit = 10, offset = 0, syncType = null } = options;
    
    try {
      let query = 'SELECT * FROM netsuite_sync_log';
      const params = [];
      
      if (syncType) {
        query += ' WHERE sync_type = ?';
        params.push(syncType);
      }
      
      query += ' ORDER BY sync_date DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      
      const [rows] = await this.db.query(query, params);
      return rows;
    } catch (error) {
      logger.error('Error retrieving NetSuite sync history', { error: error.message });
      throw error;
    }
  }
}

module.exports = new NetSuiteModel(); 