const request = require('supertest');
const app = require('../index');
const db = require('../db');
const { generateToken } = require('../utils/auth');

describe('Vendors API', () => {
    let adminToken;
    let userToken;
    let testVendorId;
    let testContactId;
    let testFileId;
    let testAddressId;
    let testNoteId;

    beforeAll(async () => {
        // Create test tokens
        adminToken = generateToken({ id: 1, username: 'admin', role: 'admin' });
        userToken = generateToken({ id: 2, username: 'user', role: 'user' });
    });

    afterAll(async () => {
        // Clean up test data
        if (testVendorId) {
            await db.query('DELETE FROM api_vendor_notes WHERE vendor_id = ?', [testVendorId]);
            await db.query('DELETE FROM api_vendor_addresses WHERE vendor_id = ?', [testVendorId]);
            await db.query('DELETE FROM api_vendor_files WHERE vendor_id = ?', [testVendorId]);
            await db.query('DELETE FROM api_vendor_contacts WHERE vendor_id = ?', [testVendorId]);
            await db.query('DELETE FROM api_vendors WHERE id = ?', [testVendorId]);
        }
        await db.end();
    });

    describe('GET /api/vendors', () => {
        it('should get all vendors when authenticated', async () => {
            const response = await request(app)
                .get('/api/vendors')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.pagination).toHaveProperty('currentPage');
            expect(response.body.pagination).toHaveProperty('totalItems');
        });

        it('should filter vendors by active status', async () => {
            const response = await request(app)
                .get('/api/vendors?is_active=true')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('should search vendors by name', async () => {
            const response = await request(app)
                .get('/api/vendors?search=Carrier')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('should paginate vendors', async () => {
            const response = await request(app)
                .get('/api/vendors?page=1&limit=2')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.pagination.itemsPerPage).toBe(2);
            expect(response.body.pagination.currentPage).toBe(1);
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get('/api/vendors');

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/vendors', () => {
        it('should create a new vendor as admin', async () => {
            const vendorData = {
                name: 'Test Vendor',
                abbreviation: 'TST',
                business_name: 'Test Vendor Inc.',
                description: 'Test vendor description',
                website: 'https://testvendor.com',
                is_active: true
            };

            const response = await request(app)
                .post('/api/vendors')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(vendorData);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(vendorData.name);
            expect(response.body.data.abbreviation).toBe(vendorData.abbreviation);
            expect(response.body.data.business_name).toBe(vendorData.business_name);
            expect(response.body.message).toBe('Vendor created successfully');

            testVendorId = response.body.data.id;
        });

        it('should not create vendor without required fields', async () => {
            const vendorData = {
                business_name: 'Test Vendor Inc.'
            };

            const response = await request(app)
                .post('/api/vendors')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(vendorData);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Name and abbreviation are required');
        });

        it('should not create vendor with duplicate name', async () => {
            const vendorData = {
                name: 'Test Vendor', // Same as previous test
                abbreviation: 'TST2',
                business_name: 'Test Vendor Inc.'
            };

            const response = await request(app)
                .post('/api/vendors')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(vendorData);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Vendor name or abbreviation already exists');
        });

        it('should not allow regular user to create vendor', async () => {
            const vendorData = {
                name: 'Test Vendor 2',
                abbreviation: 'TST2',
                business_name: 'Test Vendor Inc.'
            };

            const response = await request(app)
                .post('/api/vendors')
                .set('Authorization', `Bearer ${userToken}`)
                .send(vendorData);

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/vendors/:id', () => {
        it('should get vendor by ID', async () => {
            const response = await request(app)
                .get(`/api/vendors/${testVendorId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(testVendorId);
            expect(response.body.data.name).toBe('Test Vendor');
        });

        it('should return 404 for non-existent vendor', async () => {
            const response = await request(app)
                .get('/api/vendors/999999')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Vendor not found');
        });
    });

    describe('PUT /api/vendors/:id', () => {
        it('should update vendor as admin', async () => {
            const updateData = {
                name: 'Updated Test Vendor',
                abbreviation: 'UTV',
                business_name: 'Updated Test Vendor Inc.',
                description: 'Updated description',
                website: 'https://updatedvendor.com',
                is_active: false
            };

            const response = await request(app)
                .put(`/api/vendors/${testVendorId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(updateData.name);
            expect(response.body.data.abbreviation).toBe(updateData.abbreviation);
            expect(response.body.data.is_active).toBe(false);
            expect(response.body.message).toBe('Vendor updated successfully');
        });

        it('should not allow regular user to update vendor', async () => {
            const updateData = {
                name: 'Unauthorized Update'
            };

            const response = await request(app)
                .put(`/api/vendors/${testVendorId}`)
                .set('Authorization', `Bearer ${userToken}`)
                .send(updateData);

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
        });

        it('should return 404 for non-existent vendor', async () => {
            const updateData = {
                name: 'Non-existent Vendor'
            };

            const response = await request(app)
                .put('/api/vendors/999999')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(updateData);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Vendor not found');
        });
    });

    describe('Vendor Contacts', () => {
        describe('POST /api/vendors/:id/contacts', () => {
            it('should create vendor contact', async () => {
                const contactData = {
                    contact_type: 'primary',
                    first_name: 'John',
                    last_name: 'Doe',
                    title: 'Sales Manager',
                    email: 'john.doe@testvendor.com',
                    phone: '555-123-4567',
                    phone_ext: '123',
                    mobile: '555-987-6543',
                    is_primary: true
                };

                const response = await request(app)
                    .post(`/api/vendors/${testVendorId}/contacts`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(contactData);

                expect(response.status).toBe(201);
                expect(response.body.success).toBe(true);
                expect(response.body.data.first_name).toBe(contactData.first_name);
                expect(response.body.data.last_name).toBe(contactData.last_name);
                expect(response.body.data.email).toBe(contactData.email);
                expect(response.body.data.is_primary).toBe(true);

                testContactId = response.body.data.id;
            });

            it('should not create contact for non-existent vendor', async () => {
                const contactData = {
                    first_name: 'Jane',
                    last_name: 'Smith',
                    email: 'jane.smith@testvendor.com'
                };

                const response = await request(app)
                    .post('/api/vendors/999999/contacts')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(contactData);

                expect(response.status).toBe(404);
                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Vendor not found');
            });
        });

        describe('GET /api/vendors/:id/contacts', () => {
            it('should get vendor contacts', async () => {
                const response = await request(app)
                    .get(`/api/vendors/${testVendorId}/contacts`)
                    .set('Authorization', `Bearer ${adminToken}`);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(Array.isArray(response.body.data)).toBe(true);
                expect(response.body.data.length).toBeGreaterThan(0);
            });
        });

        describe('PUT /api/vendors/:id/contacts/:contactId', () => {
            it('should update vendor contact', async () => {
                const updateData = {
                    first_name: 'John Updated',
                    last_name: 'Doe Updated',
                    title: 'Senior Sales Manager',
                    email: 'john.updated@testvendor.com'
                };

                const response = await request(app)
                    .put(`/api/vendors/${testVendorId}/contacts/${testContactId}`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(updateData);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.data.first_name).toBe(updateData.first_name);
                expect(response.body.data.title).toBe(updateData.title);
            });
        });
    });

    describe('Vendor Files', () => {
        describe('POST /api/vendors/:id/files', () => {
            it('should create vendor file', async () => {
                const fileData = {
                    file_type: 'catalog',
                    file_name: 'test-catalog.pdf',
                    file_path: '/uploads/vendors/test-catalog.pdf',
                    file_size: 1024000,
                    mime_type: 'application/pdf',
                    description: 'Test catalog file'
                };

                const response = await request(app)
                    .post(`/api/vendors/${testVendorId}/files`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(fileData);

                expect(response.status).toBe(201);
                expect(response.body.success).toBe(true);
                expect(response.body.data.file_name).toBe(fileData.file_name);
                expect(response.body.data.file_type).toBe(fileData.file_type);
                expect(response.body.data.file_size).toBe(fileData.file_size);

                testFileId = response.body.data.id;
            });

            it('should not create file without required fields', async () => {
                const fileData = {
                    file_type: 'catalog'
                };

                const response = await request(app)
                    .post(`/api/vendors/${testVendorId}/files`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(fileData);

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('File name and path are required');
            });
        });

        describe('GET /api/vendors/:id/files', () => {
            it('should get vendor files', async () => {
                const response = await request(app)
                    .get(`/api/vendors/${testVendorId}/files`)
                    .set('Authorization', `Bearer ${adminToken}`);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(Array.isArray(response.body.data)).toBe(true);
                expect(response.body.data.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Vendor Addresses', () => {
        describe('POST /api/vendors/:id/addresses', () => {
            it('should create vendor address', async () => {
                const addressData = {
                    address_type: 'main',
                    address_line1: '123 Test Street',
                    address_line2: 'Suite 100',
                    city: 'Test City',
                    state: 'CA',
                    zip_code: '12345',
                    country: 'USA',
                    is_primary: true
                };

                const response = await request(app)
                    .post(`/api/vendors/${testVendorId}/addresses`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(addressData);

                expect(response.status).toBe(201);
                expect(response.body.success).toBe(true);
                expect(response.body.data.address_line1).toBe(addressData.address_line1);
                expect(response.body.data.city).toBe(addressData.city);
                expect(response.body.data.state).toBe(addressData.state);
                expect(response.body.data.is_primary).toBe(true);

                testAddressId = response.body.data.id;
            });

            it('should not create address without required fields', async () => {
                const addressData = {
                    address_type: 'billing'
                };

                const response = await request(app)
                    .post(`/api/vendors/${testVendorId}/addresses`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(addressData);

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Address line 1, city, state, and zip code are required');
            });
        });

        describe('GET /api/vendors/:id/addresses', () => {
            it('should get vendor addresses', async () => {
                const response = await request(app)
                    .get(`/api/vendors/${testVendorId}/addresses`)
                    .set('Authorization', `Bearer ${adminToken}`);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(Array.isArray(response.body.data)).toBe(true);
                expect(response.body.data.length).toBeGreaterThan(0);
            });
        });

        describe('PUT /api/vendors/:id/addresses/:addressId', () => {
            it('should update vendor address', async () => {
                const updateData = {
                    address_line1: '456 Updated Street',
                    city: 'Updated City',
                    state: 'NY',
                    zip_code: '54321'
                };

                const response = await request(app)
                    .put(`/api/vendors/${testVendorId}/addresses/${testAddressId}`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(updateData);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.data.address_line1).toBe(updateData.address_line1);
                expect(response.body.data.city).toBe(updateData.city);
                expect(response.body.data.state).toBe(updateData.state);
            });
        });
    });

    describe('Vendor Notes', () => {
        describe('POST /api/vendors/:id/notes', () => {
            it('should create vendor note', async () => {
                const noteData = {
                    note_type: 'general',
                    title: 'Test Note',
                    content: 'This is a test note for the vendor.',
                    is_private: false
                };

                const response = await request(app)
                    .post(`/api/vendors/${testVendorId}/notes`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(noteData);

                expect(response.status).toBe(201);
                expect(response.body.success).toBe(true);
                expect(response.body.data.title).toBe(noteData.title);
                expect(response.body.data.content).toBe(noteData.content);
                expect(response.body.data.note_type).toBe(noteData.note_type);
                expect(response.body.data.is_private).toBe(false);

                testNoteId = response.body.data.id;
            });

            it('should not create note without content', async () => {
                const noteData = {
                    title: 'Test Note'
                };

                const response = await request(app)
                    .post(`/api/vendors/${testVendorId}/notes`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(noteData);

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
                expect(response.body.message).toBe('Note content is required');
            });
        });

        describe('GET /api/vendors/:id/notes', () => {
            it('should get vendor notes', async () => {
                const response = await request(app)
                    .get(`/api/vendors/${testVendorId}/notes`)
                    .set('Authorization', `Bearer ${adminToken}`);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(Array.isArray(response.body.data)).toBe(true);
                expect(response.body.data.length).toBeGreaterThan(0);
            });
        });

        describe('PUT /api/vendors/:id/notes/:noteId', () => {
            it('should update vendor note', async () => {
                const updateData = {
                    title: 'Updated Test Note',
                    content: 'This is an updated test note.',
                    note_type: 'payment',
                    is_private: true
                };

                const response = await request(app)
                    .put(`/api/vendors/${testVendorId}/notes/${testNoteId}`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(updateData);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.data.title).toBe(updateData.title);
                expect(response.body.data.content).toBe(updateData.content);
                expect(response.body.data.note_type).toBe(updateData.note_type);
                expect(response.body.data.is_private).toBe(true);
            });
        });
    });

    describe('GET /api/vendors/search', () => {
        it('should search vendors by name', async () => {
            const response = await request(app)
                .get('/api/vendors/search?q=Test')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.query).toBe('Test');
        });

        it('should search vendors by abbreviation', async () => {
            const response = await request(app)
                .get('/api/vendors/search?q=UTV')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('should limit search results', async () => {
            const response = await request(app)
                .get('/api/vendors/search?q=Test&limit=1')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBeLessThanOrEqual(1);
        });

        it('should require search query', async () => {
            const response = await request(app)
                .get('/api/vendors/search')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Search query parameter "q" is required');
        });
    });

    describe('GET /api/vendors/stats', () => {
        it('should get vendor statistics', async () => {
            const response = await request(app)
                .get('/api/vendors/stats')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('total_vendors');
            expect(response.body.data).toHaveProperty('active_vendors');
            expect(response.body.data).toHaveProperty('archived_vendors');
            expect(response.body.data).toHaveProperty('inactive_vendors');
        });
    });

    describe('DELETE /api/vendors/:id', () => {
        it('should archive vendor as admin', async () => {
            const response = await request(app)
                .delete(`/api/vendors/${testVendorId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Vendor archived successfully');
        });

        it('should not allow regular user to archive vendor', async () => {
            const response = await request(app)
                .delete(`/api/vendors/${testVendorId}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/vendors/:id/restore', () => {
        it('should restore archived vendor as admin', async () => {
            const response = await request(app)
                .post(`/api/vendors/${testVendorId}/restore`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Vendor restored successfully');
        });

        it('should not allow regular user to restore vendor', async () => {
            const response = await request(app)
                .post(`/api/vendors/${testVendorId}/restore`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
        });
    });

    describe('DELETE operations', () => {
        it('should delete vendor contact', async () => {
            const response = await request(app)
                .delete(`/api/vendors/${testVendorId}/contacts/${testContactId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Vendor contact deleted successfully');
        });

        it('should delete vendor file', async () => {
            const response = await request(app)
                .delete(`/api/vendors/${testVendorId}/files/${testFileId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Vendor file deleted successfully');
        });

        it('should delete vendor address', async () => {
            const response = await request(app)
                .delete(`/api/vendors/${testVendorId}/addresses/${testAddressId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Vendor address deleted successfully');
        });

        it('should delete vendor note', async () => {
            const response = await request(app)
                .delete(`/api/vendors/${testVendorId}/notes/${testNoteId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Vendor note deleted successfully');
        });
    });
}); 