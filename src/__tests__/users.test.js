const request = require('supertest');
const app = require('../index');
const UserModel = require('../models/UserModel');
const RoleModel = require('../models/RoleModel');
const jwt = require('../utils/jwt');

describe('User Management Endpoints', () => {
    let userModel;
    let roleModel;
    let adminUser;
    let testUser;
    let adminToken;
    let userToken;

    beforeAll(async () => {
        userModel = new UserModel();
        roleModel = new RoleModel();
        
        // Create admin user
        adminUser = await userModel.createUser({
            username: 'admin',
            email: 'admin@example.com',
            password: 'adminpass123',
            first_name: 'Admin',
            last_name: 'User'
        });
        
        // Create test user
        testUser = await userModel.createUser({
            username: 'testuser',
            email: 'test@example.com',
            password: 'testpass123',
            first_name: 'Test',
            last_name: 'User'
        });
        
        // Assign admin role
        const adminRole = await roleModel.findByName('admin');
        if (adminRole) {
            await userModel.assignRole(adminUser.id, adminRole.id);
        }
        
        // Get tokens
        const adminUserWithRoles = await userModel.findWithRolesAndShowrooms(adminUser.id);
        const testUserWithRoles = await userModel.findWithRolesAndShowrooms(testUser.id);
        
        adminToken = jwt.generateTokenPair(adminUserWithRoles).accessToken;
        userToken = jwt.generateTokenPair(testUserWithRoles).accessToken;
    });

    afterAll(async () => {
        // Clean up users
        if (adminUser) await userModel.deleteUser(adminUser.id);
        if (testUser) await userModel.deleteUser(testUser.id);
    });

    describe('GET /api/users', () => {
        test('should get users list as admin', async () => {
            const response = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.users).toBeInstanceOf(Array);
            expect(response.body.data.pagination).toBeDefined();
        });

        test('should fail without authentication', async () => {
            const response = await request(app)
                .get('/api/users');

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });

        test('should fail with insufficient permissions', async () => {
            const response = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
        });

        test('should support pagination', async () => {
            const response = await request(app)
                .get('/api/users?page=1&limit=1')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.pagination.page).toBe(1);
            expect(response.body.data.pagination.limit).toBe(1);
        });

        test('should support search', async () => {
            const response = await request(app)
                .get('/api/users?search=admin')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.users).toBeInstanceOf(Array);
        });
    });

    describe('POST /api/users', () => {
        test('should create user as admin', async () => {
            const userData = {
                username: 'newuser',
                email: 'newuser@example.com',
                password: 'newpass123',
                first_name: 'New',
                last_name: 'User'
            };

            const response = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(userData);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.username).toBe('newuser');
            expect(response.body.data.email).toBe('newuser@example.com');
            expect(response.body.data.password_hash).toBeUndefined();
            
            // Clean up
            await userModel.deleteUser(response.body.data.id);
        });

        test('should fail with duplicate username', async () => {
            const userData = {
                username: 'testuser', // Already exists
                email: 'duplicate@example.com',
                password: 'newpass123',
                first_name: 'Duplicate',
                last_name: 'User'
            };

            const response = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(userData);

            expect(response.status).toBe(409);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Username already exists');
        });

        test('should fail with duplicate email', async () => {
            const userData = {
                username: 'uniqueuser',
                email: 'test@example.com', // Already exists
                password: 'newpass123',
                first_name: 'Duplicate',
                last_name: 'User'
            };

            const response = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(userData);

            expect(response.status).toBe(409);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Email already exists');
        });

        test('should fail with invalid data', async () => {
            const userData = {
                username: 'a', // Too short
                email: 'invalid-email',
                password: '123' // Too short
            };

            const response = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(userData);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Validation failed');
        });

        test('should fail without authentication', async () => {
            const userData = {
                username: 'newuser',
                email: 'newuser@example.com',
                password: 'newpass123',
                first_name: 'New',
                last_name: 'User'
            };

            const response = await request(app)
                .post('/api/users')
                .send(userData);

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/users/:id', () => {
        test('should get user by ID as admin', async () => {
            const response = await request(app)
                .get(`/api/users/${testUser.id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(testUser.id);
            expect(response.body.data.username).toBe('testuser');
        });

        test('should get own user profile', async () => {
            const response = await request(app)
                .get(`/api/users/${testUser.id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(testUser.id);
        });

        test('should fail to get other user profile without admin', async () => {
            const response = await request(app)
                .get(`/api/users/${adminUser.id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
        });

        test('should fail with invalid user ID', async () => {
            const response = await request(app)
                .get('/api/users/invalid')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        test('should fail with nonexistent user ID', async () => {
            const response = await request(app)
                .get('/api/users/99999')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /api/users/:id', () => {
        test('should update user as admin', async () => {
            const updateData = {
                first_name: 'Updated',
                last_name: 'Name'
            };

            const response = await request(app)
                .put(`/api/users/${testUser.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.first_name).toBe('Updated');
            expect(response.body.data.last_name).toBe('Name');
        });

        test('should update own profile', async () => {
            const updateData = {
                phone: '+1234567890'
            };

            const response = await request(app)
                .put(`/api/users/${testUser.id}`)
                .set('Authorization', `Bearer ${userToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.phone).toBe('+1234567890');
        });

        test('should fail to update other user without admin', async () => {
            const updateData = {
                first_name: 'Hacker'
            };

            const response = await request(app)
                .put(`/api/users/${adminUser.id}`)
                .set('Authorization', `Bearer ${userToken}`)
                .send(updateData);

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
        });

        test('should fail with invalid data', async () => {
            const updateData = {
                email: 'invalid-email'
            };

            const response = await request(app)
                .put(`/api/users/${testUser.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(updateData);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /api/users/:id/password', () => {
        test('should update own password', async () => {
            const passwordData = {
                currentPassword: 'testpass123',
                newPassword: 'newtestpass123'
            };

            const response = await request(app)
                .put(`/api/users/${testUser.id}/password`)
                .set('Authorization', `Bearer ${userToken}`)
                .send(passwordData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Password updated successfully');
            
            // Reset password back for other tests
            await request(app)
                .put(`/api/users/${testUser.id}/password`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    currentPassword: 'newtestpass123',
                    newPassword: 'testpass123'
                });
        });

        test('should fail with wrong current password', async () => {
            const passwordData = {
                currentPassword: 'wrongpassword',
                newPassword: 'newtestpass123'
            };

            const response = await request(app)
                .put(`/api/users/${testUser.id}/password`)
                .set('Authorization', `Bearer ${userToken}`)
                .send(passwordData);

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid current password');
        });

        test('should fail with weak new password', async () => {
            const passwordData = {
                currentPassword: 'testpass123',
                newPassword: '123' // Too short
            };

            const response = await request(app)
                .put(`/api/users/${testUser.id}/password`)
                .set('Authorization', `Bearer ${userToken}`)
                .send(passwordData);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Validation failed');
        });

        test('should fail to update other user password without admin', async () => {
            const passwordData = {
                currentPassword: 'testpass123',
                newPassword: 'newtestpass123'
            };

            const response = await request(app)
                .put(`/api/users/${adminUser.id}/password`)
                .set('Authorization', `Bearer ${userToken}`)
                .send(passwordData);

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
        });
    });

    describe('DELETE /api/users/:id', () => {
        test('should deactivate user as admin', async () => {
            // Create a user to deactivate
            const userToDeactivate = await userModel.createUser({
                username: 'deactivateuser',
                email: 'deactivate@example.com',
                password: 'deactivatepass123',
                first_name: 'Deactivate',
                last_name: 'User'
            });

            const response = await request(app)
                .delete(`/api/users/${userToDeactivate.id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('User deactivated successfully');
            
            // Verify user is deactivated
            const deactivatedUser = await userModel.findById(userToDeactivate.id);
            expect(deactivatedUser.is_active).toBe(false);
        });

        test('should fail without admin permissions', async () => {
            const response = await request(app)
                .delete(`/api/users/${adminUser.id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
        });

        test('should fail to deactivate own account', async () => {
            const response = await request(app)
                .delete(`/api/users/${adminUser.id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(409);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Cannot deactivate own account');
        });

        test('should fail with nonexistent user', async () => {
            const response = await request(app)
                .delete('/api/users/99999')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });
    });
}); 