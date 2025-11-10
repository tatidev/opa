const express = require('express');
const router = express.Router();
const VendorController = require('../controllers/VendorController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

const vendorController = new VendorController();

// Apply authentication middleware to all vendor routes
router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     Vendor:
 *       type: object
 *       required:
 *         - name
 *         - abbreviation
 *       properties:
 *         id:
 *           type: integer
 *           description: The vendor ID
 *         name:
 *           type: string
 *           description: The vendor name
 *         abbreviation:
 *           type: string
 *           description: The vendor abbreviation
 *         business_name:
 *           type: string
 *           description: The vendor business name
 *         description:
 *           type: string
 *           description: The vendor description
 *         website:
 *           type: string
 *           description: The vendor website
 *         is_active:
 *           type: boolean
 *           description: Whether the vendor is active
 *         is_archived:
 *           type: boolean
 *           description: Whether the vendor is archived
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         contact_count:
 *           type: integer
 *           description: Number of contacts
 *         file_count:
 *           type: integer
 *           description: Number of files
 *         address_count:
 *           type: integer
 *           description: Number of addresses
 *         note_count:
 *           type: integer
 *           description: Number of notes
 *     VendorContact:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The contact ID
 *         vendor_id:
 *           type: integer
 *           description: The vendor ID
 *         contact_type:
 *           type: string
 *           enum: [primary, billing, technical, sales]
 *           description: The contact type
 *         first_name:
 *           type: string
 *           description: The contact first name
 *         last_name:
 *           type: string
 *           description: The contact last name
 *         title:
 *           type: string
 *           description: The contact title
 *         email:
 *           type: string
 *           description: The contact email
 *         phone:
 *           type: string
 *           description: The contact phone
 *         phone_ext:
 *           type: string
 *           description: The contact phone extension
 *         mobile:
 *           type: string
 *           description: The contact mobile
 *         is_primary:
 *           type: boolean
 *           description: Whether this is the primary contact
 *         is_active:
 *           type: boolean
 *           description: Whether the contact is active
 *     VendorFile:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The file ID
 *         vendor_id:
 *           type: integer
 *           description: The vendor ID
 *         file_type:
 *           type: string
 *           enum: [logo, certificate, contract, catalog, price_list, other]
 *           description: The file type
 *         file_name:
 *           type: string
 *           description: The file name
 *         file_path:
 *           type: string
 *           description: The file path
 *         file_size:
 *           type: integer
 *           description: The file size in bytes
 *         mime_type:
 *           type: string
 *           description: The file MIME type
 *         description:
 *           type: string
 *           description: The file description
 *         is_active:
 *           type: boolean
 *           description: Whether the file is active
 *     VendorAddress:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The address ID
 *         vendor_id:
 *           type: integer
 *           description: The vendor ID
 *         address_type:
 *           type: string
 *           enum: [main, billing, shipping, warehouse]
 *           description: The address type
 *         address_line1:
 *           type: string
 *           description: The address line 1
 *         address_line2:
 *           type: string
 *           description: The address line 2
 *         city:
 *           type: string
 *           description: The city
 *         state:
 *           type: string
 *           description: The state
 *         zip_code:
 *           type: string
 *           description: The zip code
 *         country:
 *           type: string
 *           description: The country
 *         is_primary:
 *           type: boolean
 *           description: Whether this is the primary address
 *         is_active:
 *           type: boolean
 *           description: Whether the address is active
 *     VendorNote:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The note ID
 *         vendor_id:
 *           type: integer
 *           description: The vendor ID
 *         note_type:
 *           type: string
 *           enum: [general, payment, shipping, quality, service]
 *           description: The note type
 *         title:
 *           type: string
 *           description: The note title
 *         content:
 *           type: string
 *           description: The note content
 *         is_private:
 *           type: boolean
 *           description: Whether the note is private
 *         is_active:
 *           type: boolean
 *           description: Whether the note is active
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         created_by:
 *           type: integer
 *           description: User ID who created the note
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * tags:
 *   name: Vendors
 *   description: Vendor management endpoints
 */

/**
 * @swagger
 * /api/vendors:
 *   get:
 *     summary: Get all vendors
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: is_archived
 *         schema:
 *           type: boolean
 *         description: Filter by archived status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search vendors by name, abbreviation, or business name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of vendors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Vendor'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalItems:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     itemsPerPage:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', (req, res) => vendorController.getAllVendors(req, res));

/**
 * @swagger
 * /api/vendors/search:
 *   get:
 *     summary: Search vendors
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of results to return
 *       - in: query
 *         name: active_only
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Only return active vendors
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       abbreviation:
 *                         type: string
 *                       business_name:
 *                         type: string
 *                 query:
 *                   type: string
 *       400:
 *         description: Missing search query
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/search', (req, res) => vendorController.searchVendors(req, res));

/**
 * @swagger
 * /api/vendors/stats:
 *   get:
 *     summary: Get vendor statistics
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vendor statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_vendors:
 *                       type: integer
 *                     active_vendors:
 *                       type: integer
 *                     archived_vendors:
 *                       type: integer
 *                     inactive_vendors:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/stats', (req, res) => vendorController.getVendorStats(req, res));

/**
 * @swagger
 * /api/vendors/{id}:
 *   get:
 *     summary: Get vendor by ID
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *     responses:
 *       200:
 *         description: Vendor details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Vendor'
 *       404:
 *         description: Vendor not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/:id', (req, res) => vendorController.getVendorById(req, res));

/**
 * @swagger
 * /api/vendors:
 *   post:
 *     summary: Create new vendor
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - abbreviation
 *             properties:
 *               name:
 *                 type: string
 *                 description: Vendor name
 *               abbreviation:
 *                 type: string
 *                 description: Vendor abbreviation
 *               business_name:
 *                 type: string
 *                 description: Vendor business name
 *               description:
 *                 type: string
 *                 description: Vendor description
 *               website:
 *                 type: string
 *                 description: Vendor website
 *               is_active:
 *                 type: boolean
 *                 description: Whether the vendor is active
 *     responses:
 *       201:
 *         description: Vendor created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Vendor'
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.post('/', requireRole(['admin', 'manager']), (req, res) => vendorController.createVendor(req, res));

/**
 * @swagger
 * /api/vendors/{id}:
 *   put:
 *     summary: Update vendor
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Vendor name
 *               abbreviation:
 *                 type: string
 *                 description: Vendor abbreviation
 *               business_name:
 *                 type: string
 *                 description: Vendor business name
 *               description:
 *                 type: string
 *                 description: Vendor description
 *               website:
 *                 type: string
 *                 description: Vendor website
 *               is_active:
 *                 type: boolean
 *                 description: Whether the vendor is active
 *     responses:
 *       200:
 *         description: Vendor updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Vendor'
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Vendor not found
 *       500:
 *         description: Server error
 */
router.put('/:id', requireRole(['admin', 'manager']), (req, res) => vendorController.updateVendor(req, res));

/**
 * @swagger
 * /api/vendors/{id}:
 *   delete:
 *     summary: Archive vendor
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *     responses:
 *       200:
 *         description: Vendor archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Vendor not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', requireRole(['admin', 'manager']), (req, res) => vendorController.archiveVendor(req, res));

/**
 * @swagger
 * /api/vendors/{id}/restore:
 *   post:
 *     summary: Restore archived vendor
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *     responses:
 *       200:
 *         description: Vendor restored successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Vendor not found
 *       500:
 *         description: Server error
 */
router.post('/:id/restore', requireRole(['admin', 'manager']), (req, res) => vendorController.restoreVendor(req, res));

// Vendor contacts routes
/**
 * @swagger
 * /api/vendors/{id}/contacts:
 *   get:
 *     summary: Get vendor contacts
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *     responses:
 *       200:
 *         description: List of vendor contacts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VendorContact'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/:id/contacts', (req, res) => vendorController.getVendorContacts(req, res));

/**
 * @swagger
 * /api/vendors/{id}/contacts:
 *   post:
 *     summary: Create vendor contact
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contact_type:
 *                 type: string
 *                 enum: [primary, billing, technical, sales]
 *                 description: Contact type
 *               first_name:
 *                 type: string
 *                 description: First name
 *               last_name:
 *                 type: string
 *                 description: Last name
 *               title:
 *                 type: string
 *                 description: Job title
 *               email:
 *                 type: string
 *                 description: Email address
 *               phone:
 *                 type: string
 *                 description: Phone number
 *               phone_ext:
 *                 type: string
 *                 description: Phone extension
 *               mobile:
 *                 type: string
 *                 description: Mobile number
 *               is_primary:
 *                 type: boolean
 *                 description: Whether this is the primary contact
 *     responses:
 *       201:
 *         description: Contact created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/VendorContact'
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Vendor not found
 *       500:
 *         description: Server error
 */
router.post('/:id/contacts', requireRole(['admin', 'manager']), (req, res) => vendorController.createVendorContact(req, res));

/**
 * @swagger
 * /api/vendors/{id}/contacts/{contactId}:
 *   put:
 *     summary: Update vendor contact
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Contact ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contact_type:
 *                 type: string
 *                 enum: [primary, billing, technical, sales]
 *                 description: Contact type
 *               first_name:
 *                 type: string
 *                 description: First name
 *               last_name:
 *                 type: string
 *                 description: Last name
 *               title:
 *                 type: string
 *                 description: Job title
 *               email:
 *                 type: string
 *                 description: Email address
 *               phone:
 *                 type: string
 *                 description: Phone number
 *               is_primary:
 *                 type: boolean
 *                 description: Whether this is the primary contact
 *     responses:
 *       200:
 *         description: Contact updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/VendorContact'
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Contact not found
 *       500:
 *         description: Server error
 */
router.put('/:id/contacts/:contactId', requireRole(['admin', 'manager']), (req, res) => vendorController.updateVendorContact(req, res));

/**
 * @swagger
 * /api/vendors/{id}/contacts/{contactId}:
 *   delete:
 *     summary: Delete vendor contact
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Contact ID
 *     responses:
 *       200:
 *         description: Contact deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Contact not found
 *       500:
 *         description: Server error
 */
router.delete('/:id/contacts/:contactId', requireRole(['admin', 'manager']), (req, res) => vendorController.deleteVendorContact(req, res));

// Vendor files routes
/**
 * @swagger
 * /api/vendors/{id}/files:
 *   get:
 *     summary: Get vendor files
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *     responses:
 *       200:
 *         description: List of vendor files
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VendorFile'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/:id/files', (req, res) => vendorController.getVendorFiles(req, res));

/**
 * @swagger
 * /api/vendors/{id}/files:
 *   post:
 *     summary: Create vendor file
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - file_name
 *               - file_path
 *             properties:
 *               file_type:
 *                 type: string
 *                 enum: [logo, certificate, contract, catalog, price_list, other]
 *                 description: File type
 *               file_name:
 *                 type: string
 *                 description: File name
 *               file_path:
 *                 type: string
 *                 description: File path
 *               file_size:
 *                 type: integer
 *                 description: File size in bytes
 *               mime_type:
 *                 type: string
 *                 description: MIME type
 *               description:
 *                 type: string
 *                 description: File description
 *     responses:
 *       201:
 *         description: File created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/VendorFile'
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Vendor not found
 *       500:
 *         description: Server error
 */
router.post('/:id/files', requireRole(['admin', 'manager']), (req, res) => vendorController.createVendorFile(req, res));

/**
 * @swagger
 * /api/vendors/{id}/files/{fileId}:
 *   delete:
 *     summary: Delete vendor file
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: integer
 *         description: File ID
 *     responses:
 *       200:
 *         description: File deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
router.delete('/:id/files/:fileId', requireRole(['admin', 'manager']), (req, res) => vendorController.deleteVendorFile(req, res));

// Vendor addresses routes
/**
 * @swagger
 * /api/vendors/{id}/addresses:
 *   get:
 *     summary: Get vendor addresses
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *     responses:
 *       200:
 *         description: List of vendor addresses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VendorAddress'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/:id/addresses', (req, res) => vendorController.getVendorAddresses(req, res));

/**
 * @swagger
 * /api/vendors/{id}/addresses:
 *   post:
 *     summary: Create vendor address
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - address_line1
 *               - city
 *               - state
 *               - zip_code
 *             properties:
 *               address_type:
 *                 type: string
 *                 enum: [main, billing, shipping, warehouse]
 *                 description: Address type
 *               address_line1:
 *                 type: string
 *                 description: Address line 1
 *               address_line2:
 *                 type: string
 *                 description: Address line 2
 *               city:
 *                 type: string
 *                 description: City
 *               state:
 *                 type: string
 *                 description: State
 *               zip_code:
 *                 type: string
 *                 description: ZIP code
 *               country:
 *                 type: string
 *                 description: Country
 *               is_primary:
 *                 type: boolean
 *                 description: Whether this is the primary address
 *     responses:
 *       201:
 *         description: Address created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/VendorAddress'
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Vendor not found
 *       500:
 *         description: Server error
 */
router.post('/:id/addresses', requireRole(['admin', 'manager']), (req, res) => vendorController.createVendorAddress(req, res));

/**
 * @swagger
 * /api/vendors/{id}/addresses/{addressId}:
 *   put:
 *     summary: Update vendor address
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Address ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address_type:
 *                 type: string
 *                 enum: [main, billing, shipping, warehouse]
 *                 description: Address type
 *               address_line1:
 *                 type: string
 *                 description: Address line 1
 *               address_line2:
 *                 type: string
 *                 description: Address line 2
 *               city:
 *                 type: string
 *                 description: City
 *               state:
 *                 type: string
 *                 description: State
 *               zip_code:
 *                 type: string
 *                 description: ZIP code
 *               country:
 *                 type: string
 *                 description: Country
 *               is_primary:
 *                 type: boolean
 *                 description: Whether this is the primary address
 *     responses:
 *       200:
 *         description: Address updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/VendorAddress'
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Address not found
 *       500:
 *         description: Server error
 */
router.put('/:id/addresses/:addressId', requireRole(['admin', 'manager']), (req, res) => vendorController.updateVendorAddress(req, res));

/**
 * @swagger
 * /api/vendors/{id}/addresses/{addressId}:
 *   delete:
 *     summary: Delete vendor address
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Address ID
 *     responses:
 *       200:
 *         description: Address deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Address not found
 *       500:
 *         description: Server error
 */
router.delete('/:id/addresses/:addressId', requireRole(['admin', 'manager']), (req, res) => vendorController.deleteVendorAddress(req, res));

// Vendor notes routes
/**
 * @swagger
 * /api/vendors/{id}/notes:
 *   get:
 *     summary: Get vendor notes
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *     responses:
 *       200:
 *         description: List of vendor notes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VendorNote'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/:id/notes', (req, res) => vendorController.getVendorNotes(req, res));

/**
 * @swagger
 * /api/vendors/{id}/notes:
 *   post:
 *     summary: Create vendor note
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               note_type:
 *                 type: string
 *                 enum: [general, payment, shipping, quality, service]
 *                 description: Note type
 *               title:
 *                 type: string
 *                 description: Note title
 *               content:
 *                 type: string
 *                 description: Note content
 *               is_private:
 *                 type: boolean
 *                 description: Whether the note is private
 *     responses:
 *       201:
 *         description: Note created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/VendorNote'
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Vendor not found
 *       500:
 *         description: Server error
 */
router.post('/:id/notes', requireRole(['admin', 'manager']), (req, res) => vendorController.createVendorNote(req, res));

/**
 * @swagger
 * /api/vendors/{id}/notes/{noteId}:
 *   put:
 *     summary: Update vendor note
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Note ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note_type:
 *                 type: string
 *                 enum: [general, payment, shipping, quality, service]
 *                 description: Note type
 *               title:
 *                 type: string
 *                 description: Note title
 *               content:
 *                 type: string
 *                 description: Note content
 *               is_private:
 *                 type: boolean
 *                 description: Whether the note is private
 *     responses:
 *       200:
 *         description: Note updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/VendorNote'
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Note not found
 *       500:
 *         description: Server error
 */
router.put('/:id/notes/:noteId', requireRole(['admin', 'manager']), (req, res) => vendorController.updateVendorNote(req, res));

/**
 * @swagger
 * /api/vendors/{id}/notes/{noteId}:
 *   delete:
 *     summary: Delete vendor note
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vendor ID
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Note ID
 *     responses:
 *       200:
 *         description: Note deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Note not found
 *       500:
 *         description: Server error
 */
router.delete('/:id/notes/:noteId', requireRole(['admin', 'manager']), (req, res) => vendorController.deleteVendorNote(req, res));

module.exports = router; 