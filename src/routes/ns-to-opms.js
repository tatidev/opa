'use strict';

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const NsToOpmsWebhookService = require('../services/NsToOpmsWebhookService');

const webhookSyncService = new NsToOpmsWebhookService();

/**
 * @swagger
 * /api/ns-to-opms/webhook:
 *   post:
 *     summary: Process NetSuite item pricing update webhook
 *     description: |
 *       Receives webhooks from NetSuite when inventory item pricing is updated 
 *       and synchronizes the changes to OPMS database.
 *       
 *       **CRITICAL SAFETY RULES:**
 *       - Verifies webhook authenticity before processing
 *       - Checks Lisa Slayman flag before any sync operations
 *       - Logs all webhook events for audit purposes
 *       - Returns success even if sync is skipped (to prevent NetSuite retries)
 *       
 *       **Field Mappings (4 Fields Only):**
 *       - `price_1_` → `T_PRODUCT_PRICE.p_res_cut`
 *       - `price_1_` (line 2) → `T_PRODUCT_PRICE.p_hosp_roll`
 *       - `cost` → `T_PRODUCT_PRICE_COST.cost_cut`
 *       - `custitem_f3_rollprice` → `T_PRODUCT_PRICE_COST.cost_roll`
 *     tags: [NS to OPMS Sync]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventType
 *               - itemData
 *               - timestamp
 *               - source
 *             properties:
 *               eventType:
 *                 type: string
 *                 enum: [item.pricing.updated]
 *                 description: Type of webhook event
 *                 example: item.pricing.updated
 *               itemData:
 *                 type: object
 *                 required:
 *                   - itemid
 *                   - internalid
 *                 properties:
 *                   itemid:
 *                     type: string
 *                     description: NetSuite item ID (maps to OPMS T_ITEM.code)
 *                     example: "FAB-001-BLUE"
 *                   internalid:
 *                     type: string
 *                     description: NetSuite internal ID
 *                     example: "12345"
 *                   lastmodifieddate:
 *                     type: string
 *                     format: date-time
 *                     description: Last modification timestamp
 *                   price_1_:
 *                     type: number
 *                     format: float
 *                     description: Base price line 1 (residential cut price)
 *                     example: 25.99
 *                   price_2_:
 *                     type: number
 *                     format: float
 *                     description: Base price line 2 (hospital roll price)
 *                     example: 45.50
 *                   cost:
 *                     type: number
 *                     format: float
 *                     description: Purchase cost (vendor cut cost)
 *                     example: 15.75
 *                   custitem_f3_rollprice:
 *                     type: number
 *                     format: float
 *                     description: Custom roll price (vendor roll cost)
 *                     example: 40.00
 *                   custitemf3_lisa_item:
 *                     type: boolean
 *                     description: Lisa Slayman skip flag - if true, sync is skipped
 *                     example: false
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: Webhook timestamp
 *                 example: "2024-01-15T10:30:00Z"
 *               source:
 *                 type: string
 *                 description: Source of the webhook
 *                 example: "netsuite_webhook"
 *     responses:
 *       200:
 *         description: Webhook processed successfully (includes skipped items)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Webhook processed successfully"
 *                 itemId:
 *                   type: string
 *                   example: "FAB-001-BLUE"
 *                 result:
 *                   type: string
 *                   enum: [updated, skipped]
 *                   example: "updated"
 *                 reason:
 *                   type: string
 *                   description: Reason for skip (if applicable)
 *                   example: "Lisa Slayman item - pricing sync disabled"
 *                 processingTimeMs:
 *                   type: number
 *                   description: Processing time in milliseconds
 *                   example: 1250
 *       400:
 *         description: Invalid webhook payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unsupported event type"
 *       401:
 *         description: Unauthorized webhook (invalid secret)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unauthorized webhook"
 *       500:
 *         description: Internal server error during processing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 *                 message:
 *                   type: string
 *                   example: "Failed to process webhook"
 */
router.post('/webhook', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Verify webhook authenticity
    const authHeader = req.headers['authorization'];
    if (!authHeader || !verifyWebhookSecret(authHeader)) {
      logger.warn('Unauthorized webhook attempt', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      return res.status(401).json({ error: 'Unauthorized webhook' });
    }
    
    const { eventType, itemData, timestamp, source } = req.body;
    
    // Validate webhook payload
    if (eventType !== 'item.pricing.updated') {
      logger.warn('Unsupported webhook event type', {
        eventType: eventType,
        expectedType: 'item.pricing.updated'
      });
      return res.status(400).json({ error: 'Unsupported event type' });
    }
    
    if (!itemData || !itemData.itemid) {
      logger.error('Invalid webhook payload - missing item data', {
        hasItemData: !!itemData,
        hasItemId: !!(itemData && itemData.itemid),
        payload: req.body
      });
      return res.status(400).json({ error: 'Invalid item data' });
    }
    
    logger.info('Received pricing webhook', {
      itemId: itemData.itemid,
      internalId: itemData.internalid,
      lisaSlayman: itemData.custitemf3_lisa_item,
      source: source,
      timestamp: timestamp
    });
    
    // Process the pricing update
    const result = await webhookSyncService.processItemPricingWebhook({
      itemData: itemData,
      timestamp: timestamp
    });
    
    const processingTime = Date.now() - startTime;
    
    // Log result
    logger.info('Webhook processed', {
      itemId: itemData.itemid,
      result: result.skipped ? 'skipped' : 'success',
      reason: result.reason,
      processingTimeMs: processingTime
    });
    
    // Always return success to prevent NetSuite retries
    // Even skipped items are considered "successfully processed"
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      itemId: itemData.itemid,
      result: result.skipped ? 'skipped' : 'updated',
      reason: result.reason,
      processingTimeMs: processingTime
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Webhook processing error', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      processingTimeMs: processingTime
    });
    
    // Return 500 for actual errors so NetSuite can retry
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process webhook'
    });
  }
});

/**
 * @swagger
 * /api/ns-to-opms/health:
 *   get:
 *     summary: NS to OPMS sync service health check
 *     description: |
 *       Returns the health status of the NetSuite to OPMS sync service including 
 *       processing statistics and service availability.
 *     tags: [NS to OPMS Sync]
 *     responses:
 *       200:
 *         description: Sync service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "OK"
 *                 message:
 *                   type: string
 *                   example: "NetSuite to OPMS sync service is running"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00Z"
 *                 stats:
 *                   type: object
 *                   properties:
 *                     received:
 *                       type: number
 *                       description: Total webhooks received
 *                       example: 150
 *                     processed:
 *                       type: number
 *                       description: Successfully processed webhooks
 *                       example: 142
 *                     skipped:
 *                       type: number
 *                       description: Skipped webhooks (Lisa Slayman items)
 *                       example: 5
 *                     failed:
 *                       type: number
 *                       description: Failed webhook processing attempts
 *                       example: 3
 *                     successRate:
 *                       type: number
 *                       description: Success rate percentage
 *                       example: 94.67
 *                     lastProcessed:
 *                       type: string
 *                       format: date-time
 *                       description: Timestamp of last processed webhook
 *                       example: "2024-01-15T10:25:00Z"
 */
router.get('/health', (req, res) => {
  const stats = webhookSyncService.getStats();
  
  res.json({
    status: 'OK',
    message: 'NetSuite to OPMS sync service is running',
    timestamp: new Date().toISOString(),
    stats: stats
  });
});

/**
 * @swagger
 * /api/ns-to-opms/stats:
 *   get:
 *     summary: Get detailed NS to OPMS sync statistics
 *     description: |
 *       Returns detailed statistics about sync processing performance,
 *       including success rates, processing counts, and timing information.
 *     tags: [NS to OPMS Sync]
 *     responses:
 *       200:
 *         description: Sync statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 syncStats:
 *                   type: object
 *                   properties:
 *                     received:
 *                       type: number
 *                       description: Total webhooks received
 *                       example: 150
 *                     processed:
 *                       type: number
 *                       description: Successfully processed webhooks
 *                       example: 142
 *                     skipped:
 *                       type: number
 *                       description: Skipped webhooks (Lisa Slayman items)
 *                       example: 5
 *                     failed:
 *                       type: number
 *                       description: Failed webhook processing attempts
 *                       example: 3
 *                     successRate:
 *                       type: number
 *                       description: Success rate percentage
 *                       example: 94.67
 *                     lastProcessed:
 *                       type: string
 *                       format: date-time
 *                       description: Timestamp of last processed webhook
 *                       example: "2024-01-15T10:25:00Z"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00Z"
 */
router.get('/stats', (req, res) => {
  const stats = webhookSyncService.getStats();
  
  res.json({
    syncStats: stats,
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /api/ns-to-opms/reset-stats:
 *   post:
 *     summary: Reset NS to OPMS sync statistics
 *     description: |
 *       Resets all sync processing statistics to zero. This endpoint is 
 *       primarily intended for testing and debugging purposes.
 *       
 *       **Warning:** This will clear all historical statistics data.
 *     tags: [NS to OPMS Sync]
 *     responses:
 *       200:
 *         description: Statistics reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Sync statistics reset"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00Z"
 */
router.post('/reset-stats', (req, res) => {
  webhookSyncService.resetStats();
  
  res.json({
    message: 'Sync statistics reset',
    timestamp: new Date().toISOString()
  });
});

/**
 * Verify webhook secret
 * 
 * @param {string} authHeader - Authorization header value
 * @returns {boolean} True if secret is valid
 */
function verifyWebhookSecret(authHeader) {
  const expectedSecret = process.env.NS_TO_OPMS_WEBHOOK_SECRET;
  logger.debug('Webhook verification debug', {
    hasExpectedSecret: !!expectedSecret,
    expectedSecretLength: expectedSecret ? expectedSecret.length : 0,
    authHeader: authHeader,
    providedSecret: authHeader ? authHeader.replace('Bearer ', '') : 'none'
  });
  
  if (!expectedSecret) {
    logger.error('NS_TO_OPMS_WEBHOOK_SECRET not configured');
    return false;
  }
  
  const providedSecret = authHeader.replace('Bearer ', '');
  const isValid = providedSecret === expectedSecret;
  logger.debug('Webhook secret validation result', { isValid });
  return isValid;
}

module.exports = router;
