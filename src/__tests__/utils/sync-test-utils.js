'use strict';

/**
 * Test utilities for NetSuite to OPMS sync system
 */

/**
 * Generate mock NetSuite item data
 */
function generateMockNetSuiteItem(overrides = {}) {
  const defaults = {
    id: `item_${Math.floor(Math.random() * 100000)}`,
    itemid: `ITEM_${Math.floor(Math.random() * 100000)}`,
    price_1_: (Math.random() * 100).toFixed(2),
    cost: (Math.random() * 50).toFixed(2),
    custitem_f3_rollprice: (Math.random() * 80).toFixed(2),
    lastmodifieddate: new Date().toISOString(),
    isinactive: 'F'
  };

  return { ...defaults, ...overrides };
}

/**
 * Generate mock NetSuite items batch
 */
function generateMockNetSuiteItemsBatch(count, overrides = {}) {
  return Array.from({ length: count }, (_, index) => 
    generateMockNetSuiteItem({
      id: `item_${index + 1}`,
      itemid: `ITEM_${index + 1}`,
      ...overrides
    })
  );
}

/**
 * Generate mock sync job data
 */
function generateMockSyncJob(overrides = {}) {
  const defaults = {
    job_type: 'initial',
    status: 'pending',
    total_items: 100,
    processed_items: 0,
    successful_items: 0,
    failed_items: 0
  };

  return { ...defaults, ...overrides };
}

/**
 * Generate mock sync item data
 */
function generateMockSyncItem(overrides = {}) {
  const defaults = {
    netsuite_item_id: `item_${Math.floor(Math.random() * 100000)}`,
    status: 'pending',
    sync_fields: {},
    retry_count: 0,
    max_retries: 3
  };

  return { ...defaults, ...overrides };
}

/**
 * Generate mock sync log data
 */
function generateMockSyncLog(overrides = {}) {
  const defaults = {
    log_level: 'info',
    message: 'Test log message',
    details: null
  };

  return { ...defaults, ...overrides };
}

/**
 * Simulate sync job lifecycle
 */
async function simulateSyncJobLifecycle(job, totalItems = 100, successRate = 0.95) {
  try {
    // Start job
    await job.markStarted();
    
    let processed = 0;
    let successful = 0;
    let failed = 0;

    // Simulate processing items
    for (let i = 0; i < totalItems; i++) {
      processed++;
      
      // Simulate success/failure based on success rate
      if (Math.random() < successRate) {
        successful++;
      } else {
        failed++;
      }

      // Update progress every 10 items
      if (processed % 10 === 0) {
        await job.updateProgress(processed, successful, failed);
        await job.addLog('info', `Progress: ${processed}/${totalItems}`);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Final progress update
    await job.updateProgress(processed, successful, failed);
    
    if (failed === 0) {
      await job.markCompleted();
      await job.addLog('info', 'Sync completed successfully');
    } else {
      await job.markFailed(`Sync completed with ${failed} failures`);
    }

    return { processed, successful, failed };
  } catch (error) {
    await job.markFailed(error.message);
    throw error;
  }
}

/**
 * Simulate rate-limited API calls
 */
async function simulateRateLimitedCalls(callCount, delayMs = 1000) {
  const startTime = Date.now();
  const results = [];

  for (let i = 0; i < callCount; i++) {
    const callStart = Date.now();
    
    // Simulate API call
    const result = await simulateApiCall(i);
    results.push(result);
    
    const callDuration = Date.now() - callStart;
    const remainingDelay = Math.max(0, delayMs - callDuration);
    
    if (remainingDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingDelay));
    }
  }

  const totalTime = Date.now() - startTime;
  return { results, totalTime, averageTimePerCall: totalTime / callCount };
}

/**
 * Simulate API call
 */
async function simulateApiCall(index) {
  // Simulate variable response time
  const responseTime = Math.random() * 100 + 50; // 50-150ms
  await new Promise(resolve => setTimeout(resolve, responseTime));
  
  return {
    index,
    responseTime,
    success: Math.random() > 0.1, // 90% success rate
    data: `Response for call ${index}`
  };
}

/**
 * Create test database with sample data
 */
async function createTestDatabase(sequelize) {
  // Create tables
  await sequelize.sync({ force: true });
  
  // Create sample sync jobs
  const jobs = await Promise.all([
    sequelize.models.NetsuiteOpmsSyncJob.create(generateMockSyncJob({
      job_type: 'initial',
      status: 'completed',
      total_items: 1000,
      processed_items: 1000,
      successful_items: 980,
      failed_items: 20
    })),
    sequelize.models.NetsuiteOpmsSyncJob.create(generateMockSyncJob({
      job_type: 'item',
      status: 'running',
      total_items: 1,
      processed_items: 0
    })),
    sequelize.models.NetsuiteOpmsSyncJob.create(generateMockSyncJob({
      job_type: 'manual',
      status: 'failed',
      total_items: 50,
      processed_items: 25,
      successful_items: 20,
      failed_items: 5,
      error_message: 'Test error message'
    }))
  ]);

  // Create sample sync items
  const syncItems = [];
  for (const job of jobs) {
    const itemCount = job.total_items || 10;
    for (let i = 0; i < itemCount; i++) {
      const syncItem = await sequelize.models.NetsuiteOpmsSyncItem.create(
        generateMockSyncItem({
          sync_job_id: job.id,
          netsuite_item_id: `item_${job.id}_${i}`,
          status: i < (job.successful_items || 0) ? 'success' : 'failed',
          sync_fields: i < (job.successful_items || 0) ? {
            p_res_cut: (Math.random() * 100).toFixed(2),
            p_hosp_roll: (Math.random() * 100).toFixed(2),
            purchase_price: (Math.random() * 50).toFixed(2)
          } : null,
          error_message: i >= (job.successful_items || 0) ? 'Test error' : null
        })
      );
      syncItems.push(syncItem);
    }
  }

  // Create sample sync logs
  const syncLogs = [];
  for (const job of jobs) {
    const logCount = Math.floor(Math.random() * 10) + 5;
    for (let i = 0; i < logCount; i++) {
      const logLevels = ['info', 'warn', 'error'];
      const logLevel = logLevels[Math.floor(Math.random() * logLevels.length)];
      
      const syncLog = await sequelize.models.NetsuiteOpmsSyncLog.create(
        generateMockSyncLog({
          sync_job_id: job.id,
          log_level: logLevel,
          message: `Test ${logLevel} log message ${i + 1}`,
          details: logLevel === 'error' ? { errorCode: 'TEST_001' } : null
        })
      );
      syncLogs.push(syncLog);
    }
  }

  return { jobs, syncItems, syncLogs };
}

/**
 * Validate sync job data structure
 */
function validateSyncJobStructure(job) {
  const requiredFields = [
    'id', 'job_type', 'status', 'total_items', 'processed_items',
    'successful_items', 'failed_items', 'created_at', 'updated_at'
  ];

  for (const field of requiredFields) {
    expect(job).toHaveProperty(field);
  }

  expect(typeof job.id).toBe('number');
  expect(['initial', 'item', 'scheduled', 'manual', 'force_full']).toContain(job.job_type);
  expect(['pending', 'running', 'completed', 'failed', 'cancelled']).toContain(job.status);
  expect(typeof job.total_items).toBe('number');
  expect(typeof job.processed_items).toBe('number');
  expect(typeof job.successful_items).toBe('number');
  expect(typeof job.failed_items).toBe('number');
}

/**
 * Validate sync item data structure
 */
function validateSyncItemStructure(syncItem) {
  const requiredFields = [
    'id', 'sync_job_id', 'netsuite_item_id', 'status',
    'retry_count', 'max_retries', 'created_at', 'updated_at'
  ];

  for (const field of requiredFields) {
    expect(syncItem).toHaveProperty(field);
  }

  expect(typeof syncItem.id).toBe('number');
  expect(typeof syncItem.sync_job_id).toBe('number');
  expect(typeof syncItem.netsuite_item_id).toBe('string');
  expect(['pending', 'processing', 'success', 'failed', 'skipped']).toContain(syncItem.status);
  expect(typeof syncItem.retry_count).toBe('number');
  expect(typeof syncItem.max_retries).toBe('number');
}

/**
 * Validate sync log data structure
 */
function validateSyncLogStructure(syncLog) {
  const requiredFields = [
    'id', 'log_level', 'message', 'created_at'
  ];

  for (const field of requiredFields) {
    expect(syncLog).toHaveProperty(field);
  }

  expect(typeof syncLog.id).toBe('number');
  expect(['debug', 'info', 'warn', 'error']).toContain(syncLog.log_level);
  expect(typeof syncLog.message).toBe('string');
}

/**
 * Performance testing utilities
 */
const PerformanceUtils = {
  /**
   * Measure execution time of async function
   */
  async measureExecutionTime(fn, ...args) {
    const startTime = process.hrtime.bigint();
    const result = await fn(...args);
    const endTime = process.hrtime.bigint();
    
    const executionTimeMs = Number(endTime - startTime) / 1000000;
    
    return {
      result,
      executionTimeMs,
      executionTimeSeconds: executionTimeMs / 1000
    };
  },

  /**
   * Run performance benchmark
   */
  async runBenchmark(name, fn, iterations = 100, warmupRuns = 10) {
    console.log(`\n🏃 Running benchmark: ${name}`);
    
    // Warmup runs
    for (let i = 0; i < warmupRuns; i++) {
      await fn();
    }
    
    // Actual benchmark
    const times = [];
    for (let i = 0; i < iterations; i++) {
      const { executionTimeMs } = await this.measureExecutionTime(fn);
      times.push(executionTimeMs);
    }
    
    // Calculate statistics
    const sortedTimes = times.sort((a, b) => a - b);
    const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
    const min = sortedTimes[0];
    const max = sortedTimes[sortedTimes.length - 1];
    const median = sortedTimes[Math.floor(times.length / 2)];
    const p95 = sortedTimes[Math.floor(times.length * 0.95)];
    const p99 = sortedTimes[Math.floor(times.length * 0.99)];
    
    console.log(`📊 Results for ${name}:`);
    console.log(`   Iterations: ${iterations}`);
    console.log(`   Average: ${avg.toFixed(2)}ms`);
    console.log(`   Median: ${median.toFixed(2)}ms`);
    console.log(`   Min: ${min.toFixed(2)}ms`);
    console.log(`   Max: ${max.toFixed(2)}ms`);
    console.log(`   95th percentile: ${p95.toFixed(2)}ms`);
    console.log(`   99th percentile: ${p99.toFixed(2)}ms`);
    
    return {
      name,
      iterations,
      average: avg,
      median,
      min,
      max,
      p95,
      p99,
      times
    };
  }
};

module.exports = {
  generateMockNetSuiteItem,
  generateMockNetSuiteItemsBatch,
  generateMockSyncJob,
  generateMockSyncItem,
  generateMockSyncLog,
  simulateSyncJobLifecycle,
  simulateRateLimitedCalls,
  simulateApiCall,
  createTestDatabase,
  validateSyncJobStructure,
  validateSyncItemStructure,
  validateSyncLogStructure,
  PerformanceUtils
};
