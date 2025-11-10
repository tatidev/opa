/**
 * Tests for CSV Import Progress Tracking Service
 * Tests progress tracking, job management, and real-time updates
 */

const CsvImportProgressService = require('../services/csvImportProgressService');
const ImportJobModel = require('../models/ImportJobModel');
const ImportItemModel = require('../models/ImportItemModel');

// Mock dependencies
jest.mock('../models/ImportJobModel');
jest.mock('../models/ImportItemModel');

describe('CsvImportProgressService', () => {
    let progressService;
    let mockImportJobModel;
    let mockImportItemModel;

    beforeEach(() => {
        jest.clearAllMocks();
        
        progressService = new CsvImportProgressService();
        
        // Get mocked models
        mockImportJobModel = ImportJobModel;
        mockImportItemModel = ImportItemModel;
    });

    describe('Constructor', () => {
        test('should initialize with empty maps', () => {
            expect(progressService.activeJobs).toBeInstanceOf(Map);
            expect(progressService.progressCallbacks).toBeInstanceOf(Map);
            expect(progressService.activeJobs.size).toBe(0);
            expect(progressService.progressCallbacks.size).toBe(0);
        });
    });

    describe('startJobTracking', () => {
        test('should start tracking a new job', () => {
            const jobId = 1;
            const jobData = {
                job_uuid: 'job_123',
                total_items: 100
            };

            progressService.startJobTracking(jobId, jobData);

            const jobInfo = progressService.activeJobs.get(jobId);
            expect(jobInfo).toBeDefined();
            expect(jobInfo.id).toBe(jobId);
            expect(jobInfo.uuid).toBe('job_123');
            expect(jobInfo.status).toBe('processing');
            expect(jobInfo.totalItems).toBe(100);
            expect(jobInfo.processedItems).toBe(0);
            expect(jobInfo.startTime).toBeInstanceOf(Date);
        });

        test('should not overwrite existing job tracking', () => {
            const jobId = 1;
            const jobData1 = { job_uuid: 'job_1', total_items: 100 };
            const jobData2 = { job_uuid: 'job_2', total_items: 200 };

            progressService.startJobTracking(jobId, jobData1);
            progressService.startJobTracking(jobId, jobData2);

            const jobInfo = progressService.activeJobs.get(jobId);
            expect(jobInfo.uuid).toBe('job_1'); // Should not be overwritten
            expect(jobInfo.totalItems).toBe(100);
        });
    });

    describe('updateJobProgress', () => {
        test('should update job progress successfully', () => {
            const jobId = 1;
            const jobData = { job_uuid: 'job_123', total_items: 100 };
            
            progressService.startJobTracking(jobId, jobData);

            const progress = {
                processedItems: 50,
                succeededItems: 45,
                failedItems: 5,
                currentRow: 50
            };

            progressService.updateJobProgress(jobId, progress);

            const jobInfo = progressService.activeJobs.get(jobId);
            expect(jobInfo.processedItems).toBe(50);
            expect(jobInfo.succeededItems).toBe(45);
            expect(jobInfo.failedItems).toBe(5);
            expect(jobInfo.currentRow).toBe(50);
            expect(jobInfo.lastUpdate).toBeInstanceOf(Date);
        });

        test('should warn when updating untracked job', () => {
            const loggerSpy = jest.spyOn(require('../utils/logger'), 'warn').mockImplementation();
            
            progressService.updateJobProgress(999, { processedItems: 10 });
            
            expect(loggerSpy).toHaveBeenCalledWith(
                'Attempted to update progress for untracked job 999'
            );
            
            loggerSpy.mockRestore();
        });
    });

    describe('completeJob', () => {
        test('should complete job successfully', async () => {
            const jobId = 1;
            const jobData = { job_uuid: 'job_123', total_items: 100 };
            
            progressService.startJobTracking(jobId, jobData);

            const finalStats = {
                processedItems: 100,
                succeededItems: 95,
                failedItems: 5
            };

            await progressService.completeJob(jobId, finalStats);

            // Job should be removed from active tracking
            expect(progressService.activeJobs.has(jobId)).toBe(false);
            expect(progressService.progressCallbacks.has(jobId)).toBe(false);
        });

        test('should warn when completing untracked job', async () => {
            const loggerSpy = jest.spyOn(require('../utils/logger'), 'warn').mockImplementation();
            
            await progressService.completeJob(999, {});
            
            expect(loggerSpy).toHaveBeenCalledWith(
                'Attempted to complete untracked job 999'
            );
            
            loggerSpy.mockRestore();
        });
    });

    describe('failJob', () => {
        test('should fail job successfully', async () => {
            const jobId = 1;
            const jobData = { job_uuid: 'job_123', total_items: 100 };
            
            progressService.startJobTracking(jobId, jobData);

            const error = new Error('Processing failed');

            await progressService.failJob(jobId, error);

            // Job should be removed from active tracking
            expect(progressService.activeJobs.has(jobId)).toBe(false);
            expect(progressService.progressCallbacks.has(jobId)).toBe(false);
        });

        test('should warn when failing untracked job', async () => {
            const loggerSpy = jest.spyOn(require('../utils/logger'), 'warn').mockImplementation();
            
            await progressService.failJob(999, new Error('Test error'));
            
            expect(loggerSpy).toHaveBeenCalledWith(
                'Attempted to fail untracked job 999'
            );
            
            loggerSpy.mockRestore();
        });
    });

    describe('getJobProgress', () => {
        test('should return job progress with calculated fields', () => {
            const jobId = 1;
            const jobData = { job_uuid: 'job_123', total_items: 100 };
            
            progressService.startJobTracking(jobId, jobData);

            // Update progress
            progressService.updateJobProgress(jobId, {
                processedItems: 50,
                succeededItems: 45,
                failedItems: 5
            });

            const progress = progressService.getJobProgress(jobId);

            expect(progress).toBeDefined();
            expect(progress.progressPercent).toBe(50);
            expect(progress.isActive).toBe(true);
            expect(progress.estimatedTimeRemaining).toBeDefined();
        });

        test('should return null for untracked job', () => {
            const progress = progressService.getJobProgress(999);
            expect(progress).toBeNull();
        });
    });

    describe('getAllActiveJobs', () => {
        test('should return all active jobs with progress percentages', () => {
            // Start tracking multiple jobs
            progressService.startJobTracking(1, { job_uuid: 'job_1', total_items: 100 });
            progressService.startJobTracking(2, { job_uuid: 'job_2', total_items: 50 });

            // Update progress for one job
            progressService.updateJobProgress(1, { processedItems: 50 });

            const activeJobs = progressService.getAllActiveJobs();

            expect(activeJobs).toHaveLength(2);
            expect(activeJobs[0].progressPercent).toBe(50);
            expect(activeJobs[1].progressPercent).toBe(0);
        });

        test('should return empty array when no active jobs', () => {
            const activeJobs = progressService.getAllActiveJobs();
            expect(activeJobs).toHaveLength(0);
        });
    });

    describe('Progress Callbacks', () => {
        test('should register and call progress callbacks', () => {
            const jobId = 1;
            const jobData = { job_uuid: 'job_123', total_items: 100 };
            
            progressService.startJobTracking(jobId, jobData);

            const callback = jest.fn();
            progressService.registerProgressCallback(jobId, callback);

            // Update progress to trigger callback
            progressService.updateJobProgress(jobId, { processedItems: 50 });

            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({
                    processedItems: 50
                })
            );
        });

        test('should handle multiple callbacks for same job', () => {
            const jobId = 1;
            const jobData = { job_uuid: 'job_123', total_items: 100 };
            
            progressService.startJobTracking(jobId, jobData);

            const callback1 = jest.fn();
            const callback2 = jest.fn();

            progressService.registerProgressCallback(jobId, callback1);
            progressService.registerProgressCallback(jobId, callback2);

            progressService.updateJobProgress(jobId, { processedItems: 25 });

            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });

        test('should unregister progress callbacks', () => {
            const jobId = 1;
            const jobData = { job_uuid: 'job_123', total_items: 100 };
            
            progressService.startJobTracking(jobId, jobData);

            const callback = jest.fn();
            progressService.registerProgressCallback(jobId, callback);

            // Unregister callback
            progressService.unregisterProgressCallback(jobId, callback);

            // Update progress - callback should not be called
            progressService.updateJobProgress(jobId, { processedItems: 50 });

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('processBatch', () => {
        test('should process batch successfully', async () => {
            const jobId = 1;
            const jobData = { job_uuid: 'job_123', total_items: 100 };
            
            progressService.startJobTracking(jobId, jobData);

            const rows = [
                { id: 1, name: 'Item 1' },
                { id: 2, name: 'Item 2' },
                { id: 3, name: 'Item 3' }
            ];

            const processor = jest.fn().mockResolvedValue(true);

            const results = await progressService.processBatch(jobId, rows, processor);

            expect(results.processed).toBe(3);
            expect(results.succeeded).toBe(3);
            expect(results.failed).toBe(0);
            expect(processor).toHaveBeenCalledTimes(3);

            // Check that progress was updated
            const jobInfo = progressService.activeJobs.get(jobId);
            expect(jobInfo.processedItems).toBe(3);
            expect(jobInfo.currentRow).toBe(3);
        });

        test('should handle processing errors in batch', async () => {
            const jobId = 1;
            const jobData = { job_uuid: 'job_123', total_items: 100 };
            
            progressService.startJobTracking(jobId, jobData);

            const rows = [
                { id: 1, name: 'Item 1' },
                { id: 2, name: 'Item 2' }
            ];

            const processor = jest.fn()
                .mockResolvedValueOnce(true) // First item succeeds
                .mockRejectedValueOnce(new Error('Processing failed')); // Second item fails

            const results = await progressService.processBatch(jobId, rows, processor);

            expect(results.processed).toBe(2);
            expect(results.succeeded).toBe(1);
            expect(results.failed).toBe(1);
            expect(results.errors).toHaveLength(1);
            expect(results.errors[0].row).toBe(2);
            expect(results.errors[0].error).toBe('Processing failed');

            // Check that progress was updated
            const jobInfo = progressService.activeJobs.get(jobId);
            expect(jobInfo.processedItems).toBe(2);
            expect(jobInfo.succeededItems).toBe(1);
            expect(jobInfo.failedItems).toBe(1);
        });

        test('should throw error for untracked job', async () => {
            const rows = [{ id: 1, name: 'Item 1' }];
            const processor = jest.fn();

            await expect(
                progressService.processBatch(999, rows, processor)
            ).rejects.toThrow('Job 999 is not being tracked');
        });
    });

    describe('Job Control Methods', () => {
        test('should pause job successfully', async () => {
            const jobId = 1;
            const jobData = { job_uuid: 'job_123', total_items: 100 };
            
            progressService.startJobTracking(jobId, jobData);

            await progressService.pauseJob(jobId);

            const jobInfo = progressService.activeJobs.get(jobId);
            expect(jobInfo.status).toBe('paused');
            expect(jobInfo.pauseTime).toBeInstanceOf(Date);
        });

        test('should resume paused job successfully', async () => {
            const jobId = 1;
            const jobData = { job_uuid: 'job_123', total_items: 100 };
            
            progressService.startJobTracking(jobId, jobData);
            await progressService.pauseJob(jobId);

            await progressService.resumeJob(jobId);

            const jobInfo = progressService.activeJobs.get(jobId);
            expect(jobInfo.status).toBe('processing');
            expect(jobInfo.resumeTime).toBeInstanceOf(Date);
        });

        test('should cancel job successfully', async () => {
            const jobId = 1;
            const jobData = { job_uuid: 'job_123', total_items: 100 };
            
            progressService.startJobTracking(jobId, jobData);

            await progressService.cancelJob(jobId);

            // Job should be removed from tracking
            expect(progressService.activeJobs.has(jobId)).toBe(false);
            expect(progressService.progressCallbacks.has(jobId)).toBe(false);
        });

        test('should throw error for untracked job control operations', async () => {
            await expect(progressService.pauseJob(999)).rejects.toThrow('Job 999 is not being tracked');
            await expect(progressService.resumeJob(999)).rejects.toThrow('Job 999 is not being tracked');
            await expect(progressService.cancelJob(999)).rejects.toThrow('Job 999 is not being tracked');
        });
    });

    describe('getJobStatistics', () => {
        test('should return accurate job statistics', async () => {
            const jobId = 1;
            const jobData = { job_uuid: 'job_123', total_items: 100 };
            
            progressService.startJobTracking(jobId, jobData);

            // Update progress
            progressService.updateJobProgress(jobId, {
                processedItems: 80,
                succeededItems: 75,
                failedItems: 5
            });

            // Wait a bit to ensure time difference
            await new Promise(resolve => setTimeout(resolve, 10));

            const stats = progressService.getJobStatistics(jobId);

            expect(stats.totalItems).toBe(100);
            expect(stats.processedItems).toBe(80);
            expect(stats.succeededItems).toBe(75);
            expect(stats.failedItems).toBe(5);
            expect(stats.successRate).toBe(75);
            expect(stats.failureRate).toBe(5);
            expect(stats.remainingItems).toBe(20);
            expect(typeof stats.duration).toBe('number');
            expect(stats.duration).toBeGreaterThanOrEqual(0);
        });

        test('should return null for untracked job', () => {
            const stats = progressService.getJobStatistics(999);
            expect(stats).toBeNull();
        });
    });

    describe('Private Methods', () => {
        test('should handle database update errors gracefully', async () => {
            const jobId = 1;
            const jobData = { job_uuid: 'job_123', total_items: 100 };
            
            progressService.startJobTracking(jobId, jobData);

            // Mock database error
            const mockUpdate = jest.fn().mockRejectedValue(new Error('Database error'));
            ImportJobModel.prototype.update = mockUpdate;

            const loggerSpy = jest.spyOn(require('../utils/logger'), 'error').mockImplementation();

            await progressService.updateJobProgress(jobId, { processedItems: 50 });

            expect(loggerSpy).toHaveBeenCalledWith(
                'Failed to update job 1 in database',
                expect.any(Error)
            );

            loggerSpy.mockRestore();
        });

        test('should handle callback errors gracefully', () => {
            const jobId = 1;
            const jobData = { job_uuid: 'job_123', total_items: 100 };
            
            progressService.startJobTracking(jobId, jobData);

            const errorCallback = jest.fn().mockImplementation(() => {
                throw new Error('Callback error');
            });

            progressService.registerProgressCallback(jobId, errorCallback);

            const loggerSpy = jest.spyOn(require('../utils/logger'), 'error').mockImplementation();

            // This should not throw an error
            expect(() => {
                progressService.updateJobProgress(jobId, { processedItems: 50 });
            }).not.toThrow();

            expect(loggerSpy).toHaveBeenCalledWith(
                'Error in progress callback for job 1',
                expect.any(Error)
            );

            loggerSpy.mockRestore();
        });
    });

    describe('Time Calculations', () => {
        test('should calculate estimated time remaining correctly', () => {
            const jobId = 1;
            const jobData = { job_uuid: 'job_123', total_items: 100 };
            
            progressService.startJobTracking(jobId, jobData);

            // Simulate some processing time
            const startTime = progressService.activeJobs.get(jobId).startTime;
            progressService.activeJobs.get(jobId).startTime = new Date(startTime.getTime() - 1000); // 1 second ago

            progressService.updateJobProgress(jobId, { processedItems: 50 });

            const progress = progressService.getJobProgress(jobId);
            expect(progress.estimatedTimeRemaining).toBeGreaterThan(0);
        });

        test('should return null for estimated time when no progress', () => {
            const jobId = 1;
            const jobData = { job_uuid: 'job_123', total_items: 100 };
            
            progressService.startJobTracking(jobId, jobData);

            const progress = progressService.getJobProgress(jobId);
            expect(progress.estimatedTimeRemaining).toBeNull();
        });
    });
});
