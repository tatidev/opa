/**
 * NetSuite Item Management Service
 * 
 * Service for managing inventory items (mark inactive, delete, bulk operations)
 * Complements the creation service by handling post-creation management
 * Uses RESTletManageInventoryItem.js for NetSuite operations
 */

require('dotenv').config();
const oauth = require('oauth-1.0a');
const crypto = require('crypto');
const fetch = require('node-fetch');
const logger = require('../utils/logger');

class NetSuiteManageItemService {
    constructor() {
        this.config = this.getConfig();
        this.oauth = this.createOAuthInstance();
    }

    /**
     * Get configuration from environment variables (consistent with existing NetSuite services)
     */
    getConfig() {
        const environment = process.env.NODE_ENV || 'sandbox';
        
        // For test environment, return mock configuration
        if (environment === 'test') {
            return {
                isMocked: true,
                consumerKey: 'TEST_CONSUMER_KEY',
                consumerSecret: 'TEST_CONSUMER_SECRET',
                tokenKey: 'TEST_TOKEN_KEY',
                tokenSecret: 'TEST_TOKEN_SECRET',
                realm: 'TEST_REALM',
                accountId: 'TEST_ACCOUNT',
                restletUrl: 'https://test-mock.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=TEST&deploy=TEST',
                sandboxUrl: 'https://test-mock.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=TEST&deploy=TEST'
            };
        }
        
        return {
            isMocked: false,
            consumerKey: process.env.NETSUITE_CONSUMER_KEY,
            consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
            tokenKey: process.env.NETSUITE_TOKEN_ID,         // Match existing service
            tokenSecret: process.env.NETSUITE_TOKEN_SECRET,  // Match existing service
            realm: process.env.NETSUITE_REALM,               // Match existing service
            accountId: process.env.NETSUITE_ACCOUNT_ID_SANDBOX || process.env.NETSUITE_ACCOUNT_ID_PROD,
            restletUrl: process.env.NETSUITE_MANAGE_RESTLET_URL || 'https://11516011-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=TBD&deploy=TBD',
            sandboxUrl: process.env.NETSUITE_MANAGE_SANDBOX_RESTLET_URL || 'https://11516011-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=TBD&deploy=TBD'
        };
    }

    /**
     * Create OAuth 1.0a instance (matching working NetSuite service)
     */
    createOAuthInstance() {
        return oauth({
            consumer: {
                key: this.config.consumerKey,
                secret: this.config.consumerSecret
            },
            signature_method: 'HMAC-SHA256',
            hash_function(base_string, key) {
                return crypto
                    .createHmac('sha256', key)
                    .update(base_string)
                    .digest('base64');
            },
            realm: this.config.realm,
            parameter_separator: ','
        });
    }

    /**
     * Get the appropriate RESTlet URL
     */
    getRestletUrl() {
        const isSandbox = process.env.NODE_ENV !== 'production';
        return isSandbox ? this.config.sandboxUrl : this.config.restletUrl;
    }

    /**
     * Build OAuth headers for requests (matching working NetSuite service)
     */
    buildAuthHeaders(method, url, body = null) {
        // Ensure environment variables are set
        if (!this.config.consumerKey || !this.config.consumerSecret || 
            !this.config.tokenKey || !this.config.tokenSecret) {
            throw new Error('NetSuite OAuth credentials not configured');
        }

        // Prepare request data for OAuth signing
        const requestData = { url, method };

        // OAuth token configuration
        const oauthToken = {
            key: this.config.tokenKey,     // NETSUITE_TOKEN_ID
            secret: this.config.tokenSecret // NETSUITE_TOKEN_SECRET
        };

        // Get OAuth data with timestamp and nonce
        const authData = this.oauth.authorize(requestData, oauthToken);

        // Construct Authorization header manually (matching working service)
        let authHeader = `OAuth realm="${this.config.realm}",`;
        authHeader += `oauth_consumer_key="${this.config.consumerKey}",`;
        authHeader += `oauth_token="${this.config.tokenKey}",`;
        authHeader += `oauth_signature_method="${authData.oauth_signature_method}",`;
        authHeader += `oauth_timestamp="${authData.oauth_timestamp}",`;
        authHeader += `oauth_nonce="${authData.oauth_nonce}",`;
        authHeader += `oauth_version="${authData.oauth_version}",`;
        authHeader += `oauth_signature="${encodeURIComponent(authData.oauth_signature)}"`;

        return {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept': '*/*',
            'Connection': 'keep-alive',
            'User-Agent': 'Opuzen-API/1.0'
        };
    }

    /**
     * Make authenticated request to NetSuite management RESTlet
     */
    async makeRequest(payload) {
        // Mock implementation for test environment
        if (this.config.isMocked) {
            logger.debug('MOCK: Making management RESTlet request', {
                action: payload.action,
                payloadKeys: Object.keys(payload)
            });
            
            return this.mockRequest(payload);
        }
        
        const restletUrl = this.getRestletUrl();
        
        if (!restletUrl) {
            throw new Error('NetSuite management RESTlet URL not configured. Set NETSUITE_MANAGE_RESTLET_URL environment variable.');
        }

        const authHeaders = this.buildAuthHeaders('POST', restletUrl, JSON.stringify(payload));
        
        logger.debug('Making management RESTlet request', {
            url: restletUrl,
            action: payload.action,
            payloadKeys: Object.keys(payload)
        });

        try {
            const response = await fetch(restletUrl, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`NetSuite RESTlet Error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            
            logger.debug('Management RESTlet response received', {
                success: result.success,
                action: payload.action
            });

            return result;

        } catch (error) {
            logger.error('NetSuite management RESTlet request failed:', error);
            throw error;
        }
    }
    
    /**
     * Mock request handler for test environment
     */
    mockRequest(payload) {
        const action = payload.action;
        
        switch (action) {
            case 'search_items':
                return this.mockSearchItems(payload);
            case 'delete':
                return this.mockDeleteItem(payload);
            case 'mark_inactive':
                return this.mockMarkInactive(payload);
            case 'get_status':
                return this.mockGetStatus(payload);
            default:
                return {
                    success: true,
                    message: `MOCK: ${action} operation completed`,
                    isMocked: true
                };
        }
    }
    
    /**
     * Mock search items implementation
     */
    mockSearchItems(payload) {
        const searchPattern = payload.searchPattern || 'opmsAPI-';
        const maxItems = payload.maxItems || 50;
        
        // Generate mock items that match the search pattern
        const mockItems = [];
        
        // For test environment, create predictable items that match common test patterns
        if (searchPattern.includes('CLEANUP')) {
            // For cleanup tests, return an item that matches the expected pattern
            const mockId = Math.floor(Math.random() * 10000) + 1000;
            mockItems.push({
                internalId: mockId,
                itemId: `opmsAPI-TEST-CLEANUP-${Date.now()}`,
                displayName: `Test Cleanup Item`,
                isInactive: false,
                recordType: 'lotnumberedinventoryitem'
            });
        } else {
            // For other searches, generate a few random items
            const numItems = Math.min(Math.floor(Math.random() * 3) + 1, maxItems); // 1-3 items
            
            for (let i = 0; i < numItems; i++) {
                const mockId = Math.floor(Math.random() * 10000) + 1000;
                mockItems.push({
                    internalId: mockId,
                    itemId: `${searchPattern}TEST-${Date.now()}-${i}`,
                    displayName: `Mock Test Item ${i + 1}`,
                    isInactive: false,
                    recordType: 'lotnumberedinventoryitem'
                });
            }
        }
        
        return {
            success: true,
            itemsFound: mockItems.length,
            items: mockItems,
            isMocked: true
        };
    }
    
    /**
     * Mock delete item implementation
     */
    mockDeleteItem(payload) {
        const itemId = payload.id;
        
        return {
            success: true,
            itemId: itemId,
            operation: 'deleted',
            message: `MOCK: Successfully deleted item ${itemId}`,
            itemIdentifier: `MOCK-ITEM-${itemId}`,
            isMocked: true
        };
    }
    
    /**
     * Mock mark inactive implementation
     */
    mockMarkInactive(payload) {
        const itemId = payload.id;
        
        return {
            success: true,
            itemId: itemId,
            message: `MOCK: Successfully marked item ${itemId} inactive`,
            previousStatus: 'active',
            newStatus: 'inactive',
            itemIdentifier: `MOCK-ITEM-${itemId}`,
            isMocked: true
        };
    }
    
    /**
     * Mock get status implementation
     */
    mockGetStatus(payload) {
        const itemId = payload.id;
        
        return {
            success: true,
            itemId: itemId,
            status: 'active',
            isInactive: false,
            itemIdentifier: `MOCK-ITEM-${itemId}`,
            displayName: `Mock Item ${itemId}`,
            recordType: 'lotnumberedinventoryitem',
            isMocked: true
        };
    }

    /**
     * Mark a single item as inactive
     */
    async markItemInactive(itemId) {
        logger.info(`Marking NetSuite item inactive: ${itemId}`);
        
        try {
            const payload = {
                action: 'mark_inactive',
                id: itemId
            };

            const result = await this.makeRequest(payload);
            
            if (result.success) {
                logger.info(`Successfully marked item ${itemId} inactive`);
                return {
                    success: true,
                    itemId: itemId,
                    message: result.message,
                    previousStatus: result.previousStatus,
                    newStatus: result.newStatus,
                    itemIdentifier: result.itemIdentifier
                };
            } else {
                logger.error(`Failed to mark item ${itemId} inactive:`, result.error);
                return {
                    success: false,
                    itemId: itemId,
                    error: result.error
                };
            }

        } catch (error) {
            logger.error(`Error marking item ${itemId} inactive:`, error);
            return {
                success: false,
                itemId: itemId,
                error: error.message
            };
        }
    }

    /**
     * Mark a single item as active
     */
    async markItemActive(itemId) {
        logger.info(`Marking NetSuite item active: ${itemId}`);
        
        try {
            const payload = {
                action: 'mark_active',
                id: itemId
            };

            const result = await this.makeRequest(payload);
            
            if (result.success) {
                logger.info(`Successfully marked item ${itemId} active`);
                return {
                    success: true,
                    itemId: itemId,
                    message: result.message,
                    previousStatus: result.previousStatus,
                    newStatus: result.newStatus,
                    itemIdentifier: result.itemIdentifier
                };
            } else {
                logger.error(`Failed to mark item ${itemId} active:`, result.error);
                return {
                    success: false,
                    itemId: itemId,
                    error: result.error
                };
            }

        } catch (error) {
            logger.error(`Error marking item ${itemId} active:`, error);
            return {
                success: false,
                itemId: itemId,
                error: error.message
            };
        }
    }

    /**
     * Attempt to delete an item (marks inactive if deletion fails due to dependencies)
     */
    async deleteItem(itemId) {
        logger.info(`Attempting to delete NetSuite item: ${itemId}`);
        
        try {
            const payload = {
                action: 'delete',
                id: itemId
            };

            const result = await this.makeRequest(payload);
            
            if (result.success) {
                if (result.operation === 'marked_inactive_fallback') {
                    logger.info(`Item ${itemId} has dependencies - marked inactive instead of deleting`);
                    return {
                        success: true,
                        itemId: itemId,
                        deleted: false,
                        markedInactive: true,
                        message: result.message,
                        itemIdentifier: result.itemIdentifier,
                        originalError: result.originalError
                    };
                } else {
                    logger.info(`Successfully deleted item ${itemId}`);
                    return {
                        success: true,
                        itemId: itemId,
                        deleted: true,
                        markedInactive: false,
                        message: result.message,
                        itemIdentifier: result.itemIdentifier
                    };
                }
            } else {
                logger.error(`Failed to delete item ${itemId}:`, result.error);
                return {
                    success: false,
                    itemId: itemId,
                    deleted: false,
                    markedInactive: false,
                    error: result.error
                };
            }

        } catch (error) {
            logger.error(`Error deleting item ${itemId}:`, error);
            return {
                success: false,
                itemId: itemId,
                deleted: false,
                markedInactive: false,
                error: error.message
            };
        }
    }

    /**
     * Mark multiple items inactive in bulk
     */
    async bulkMarkItemsInactive(itemIds) {
        logger.info(`Bulk marking ${itemIds.length} NetSuite items inactive`);
        
        try {
            const payload = {
                action: 'bulk_mark_inactive',
                itemIds: itemIds
            };

            const result = await this.makeRequest(payload);
            
            logger.info(`Bulk inactive operation completed - Success: ${result.successful}, Failed: ${result.failed}`);
            return result;

        } catch (error) {
            logger.error('Error in bulk mark inactive operation:', error);
            return {
                success: false,
                error: error.message,
                totalItems: itemIds.length,
                successful: 0,
                failed: itemIds.length,
                items: itemIds.map(id => ({
                    itemId: id,
                    success: false,
                    error: error.message
                }))
            };
        }
    }

    /**
     * Get status of an item
     */
    async getItemStatus(itemId) {
        logger.debug(`Getting status of NetSuite item: ${itemId}`);
        
        try {
            const payload = {
                action: 'get_status',
                id: itemId
            };

            const result = await this.makeRequest(payload);
            
            if (result.success) {
                logger.debug(`Item ${itemId} status: ${result.status}`);
                return {
                    success: true,
                    itemId: itemId,
                    status: result.status,
                    isInactive: result.isInactive,
                    itemIdentifier: result.itemIdentifier,
                    displayName: result.displayName,
                    recordType: result.recordType
                };
            } else {
                logger.error(`Failed to get status for item ${itemId}:`, result.error);
                return {
                    success: false,
                    itemId: itemId,
                    error: result.error
                };
            }

        } catch (error) {
            logger.error(`Error getting status for item ${itemId}:`, error);
            return {
                success: false,
                itemId: itemId,
                error: error.message
            };
        }
    }

    /**
     * Smart delete operation: try direct delete, fallback to mark inactive
     */
    async smartDelete(itemId) {
        logger.info(`Smart delete operation for NetSuite item: ${itemId}`);
        
        // Use the RESTlet's delete action which already implements this logic
        return await this.deleteItem(itemId);
    }

    /**
     * Smart delete multiple items
     */
    async smartBulkDelete(itemIds) {
        logger.info(`Smart bulk delete operation for ${itemIds.length} NetSuite items`);
        
        const results = {
            totalItems: itemIds.length,
            directDeleted: 0,
            markedInactive: 0,
            failed: 0,
            items: []
        };

        for (const itemId of itemIds) {
            const result = await this.smartDelete(itemId);
            
            if (result.success) {
                if (result.deleted) {
                    results.directDeleted++;
                } else if (result.markedInactive) {
                    results.markedInactive++;
                }
            } else {
                results.failed++;
            }

            results.items.push(result);
        }

        logger.info(`Smart bulk delete completed - Direct: ${results.directDeleted}, Inactive: ${results.markedInactive}, Failed: ${results.failed}`);
        return results;
    }

    /**
     * Search for items by itemid pattern (most recent first)
     * @param {string} searchPattern - Pattern to search for (e.g., "opmsAPI-")
     * @param {number} maxItems - Maximum number of items to return
     * @returns {Promise<Array>} Array of found items ordered by most recent first
     */
    async searchItems(searchPattern = 'opmsAPI-', maxItems = 50) {
        logger.info(`Searching NetSuite items by pattern: "${searchPattern}" (max: ${maxItems})`);

        try {
            const payload = {
                action: 'search_items',
                searchPattern: searchPattern,
                maxItems: maxItems
            };

            const result = await this.makeRequest(payload);

            if (result.success) {
                logger.info(`✅ Found ${result.itemsFound} items matching pattern "${searchPattern}"`);
                return result.items || [];
            } else {
                logger.error(`Search failed for pattern "${searchPattern}":`, result.error);
                throw new Error(result.error || 'Search operation failed');
            }

        } catch (error) {
            logger.error(`Error searching items with pattern "${searchPattern}":`, error);
            throw error;
        }
    }
}

module.exports = new NetSuiteManageItemService();
