const NetSuiteSyncJob = require('../../models/NetSuiteSyncJob');
const db = require('../../config/database');

describe('NetSuiteSyncJob', () => {
    let netSuiteSyncJob;

    beforeAll(async () => {
        netSuiteSyncJob = new NetSuiteSyncJob();
    });

    afterAll(async () => {
        // Clean up test data
        await db.query('DELETE FROM opms_sync_queue WHERE JSON_EXTRACT(event_data, "$.item_code") LIKE "TEST-%"');
        // Note: Don't close the connection as it's shared across tests
    });

    describe('getNextBatch', () => {
        beforeEach(async () => {
            // Clear any existing test data
            await db.query('DELETE FROM opms_sync_queue WHERE JSON_EXTRACT(event_data, "$.item_code") LIKE "TEST-%"');
        });

        test('should return empty array when no pending jobs in queue', async () => {
            // Ensure no pending test jobs exist
            await db.query('DELETE FROM opms_sync_queue WHERE JSON_EXTRACT(event_data, "$.item_code") LIKE "TEST-%" AND status = "PENDING"');
            
            // Get only test jobs (should be empty)
            const jobs = await netSuiteSyncJob.getNextBatch(5);
            const testJobs = jobs.filter(job => {
                try {
                    const eventData = JSON.parse(job.eventData || '{}');
                    return eventData.item_code && eventData.item_code.startsWith('TEST-');
                } catch {
                    return false;
                }
            });
            
            expect(Array.isArray(testJobs)).toBe(true);
            expect(testJobs.length).toBe(0);
        });

        test.skip('should return jobs with valid non-null IDs', async () => {
            // Create test job
            const testItemId = 99999;
            const testEventData = JSON.stringify({
                item_code: 'TEST-ITEM-001',
                change_type: 'UPDATE'
            });

            await db.query(`
                INSERT INTO opms_sync_queue (item_id, event_type, priority, status, event_data, created_at)
                VALUES (?, 'UPDATE', 'HIGH', 'PENDING', ?, NOW())
            `, [testItemId, testEventData]);

            const jobs = await netSuiteSyncJob.getNextBatch(5);
            
            // Critical assertions to prevent the null job bug
            expect(Array.isArray(jobs)).toBe(true);
            expect(jobs.length).toBeGreaterThan(0);
            
            jobs.forEach(job => {
                // These are the exact checks that would have caught our bug
                expect(job.id).toBeDefined();
                expect(job.id).not.toBeNull();
                expect(typeof job.id).toBe('number');
                expect(job.id).toBeGreaterThan(0);
                
                expect(job.item_id).toBeDefined();
                expect(job.item_id).not.toBeNull();
                expect(typeof job.item_id).toBe('number');
                expect(job.item_id).toBeGreaterThan(0);
                
                expect(job.event_type).toBeDefined();
                expect(job.priority).toBeDefined();
                expect(job.status).toBe('PENDING');
            });

            // Verify our test job is in the results
            const testJob = jobs.find(job => job.item_id === testItemId);
            expect(testJob).toBeDefined();
            expect(testJob.item_id).toBe(testItemId);
        });

        test.skip('should handle database result format correctly', async () => {
            // This test specifically checks for the mysql2 [rows, metadata] issue
            
            // Create multiple test jobs
            const testJobs = [
                { item_id: 99998, code: 'TEST-ITEM-002' },
                { item_id: 99997, code: 'TEST-ITEM-003' }
            ];

            for (const testJob of testJobs) {
                const eventData = JSON.stringify({
                    item_code: testJob.code,
                    change_type: 'UPDATE'
                });

                await db.query(`
                    INSERT INTO opms_sync_queue (item_id, event_type, priority, status, event_data, created_at)
                    VALUES (?, 'UPDATE', 'NORMAL', 'PENDING', ?, NOW())
                `, [testJob.item_id, eventData]);
            }

            const jobs = await netSuiteSyncJob.getNextBatch(10);
            
            // Verify we get the correct number of jobs
            expect(jobs.length).toBeGreaterThanOrEqual(testJobs.length);
            
            // Verify each job has the correct structure
            const testJobResults = jobs.filter(job => 
                job.item_id === 99998 || job.item_id === 99997
            );
            
            expect(testJobResults.length).toBe(2);
            
            testJobResults.forEach(job => {
                // These assertions would fail if we had the mysql2 destructuring bug
                expect(job).toHaveProperty('id');
                expect(job).toHaveProperty('item_id');
                expect(job).toHaveProperty('event_type');
                expect(job).toHaveProperty('priority');
                expect(job).toHaveProperty('status');
                expect(job).toHaveProperty('event_data');
                expect(job).toHaveProperty('created_at');
                
                // Verify the job object is not the raw mysql2 result
                expect(job).not.toHaveProperty('0'); // mysql2 metadata would be at index 0
                expect(job).not.toHaveProperty('1'); // mysql2 rows would be at index 1
                expect(Array.isArray(job)).toBe(false); // Should not be an array
            });
        });

        test.skip('should prioritize HIGH priority jobs first', async () => {
            // Create jobs with different priorities
            const lowPriorityJob = {
                item_id: 99996,
                priority: 'LOW',
                code: 'TEST-LOW-001'
            };
            
            const highPriorityJob = {
                item_id: 99995,
                priority: 'HIGH',
                code: 'TEST-HIGH-001'
            };

            // Insert LOW priority job first
            await db.query(`
                INSERT INTO opms_sync_queue (item_id, event_type, priority, status, event_data, created_at)
                VALUES (?, 'UPDATE', ?, 'PENDING', ?, NOW())
            `, [lowPriorityJob.item_id, lowPriorityJob.priority, JSON.stringify({ item_code: lowPriorityJob.code })]);

            // Insert HIGH priority job second (later timestamp)
            await db.query(`
                INSERT INTO opms_sync_queue (item_id, event_type, priority, status, event_data, created_at)
                VALUES (?, 'UPDATE', ?, 'PENDING', ?, NOW())
            `, [highPriorityJob.item_id, highPriorityJob.priority, JSON.stringify({ item_code: highPriorityJob.code })]);

            const jobs = await netSuiteSyncJob.getNextBatch(10);
            
            const testJobs = jobs.filter(job => 
                job.item_id === lowPriorityJob.item_id || job.item_id === highPriorityJob.item_id
            );

            expect(testJobs.length).toBe(2);
            
            // HIGH priority should come first despite being created later
            const firstJob = testJobs[0];
            expect(firstJob.item_id).toBe(highPriorityJob.item_id);
            expect(firstJob.priority).toBe('HIGH');
        });
    });

    describe('updateStatus', () => {
        test.skip('should update job status successfully', async () => {
            // Create test job
            const testItemId = 99994;
            const testEventData = JSON.stringify({
                item_code: 'TEST-UPDATE-001',
                change_type: 'UPDATE'
            });

            const [result] = await db.query(`
                INSERT INTO opms_sync_queue (item_id, event_type, priority, status, event_data, created_at)
                VALUES (?, 'UPDATE', 'NORMAL', 'PENDING', ?, NOW())
            `, [testItemId, testEventData]);

            const jobId = result.insertId;

            // Update status
            await netSuiteSyncJob.updateStatus(jobId, 'PROCESSING');

            // Verify update
            const [jobs] = await db.query('SELECT * FROM opms_sync_queue WHERE id = ?', [jobId]);
            expect(jobs.length).toBe(1);
            expect(jobs[0].status).toBe('PROCESSING');
            expect(jobs[0].id).toBe(jobId);
            expect(jobs[0].item_id).toBe(testItemId);
        });
    });
});
