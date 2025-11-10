const VendorModel = require('../models/VendorModel');
const logger = require('../utils/logger');

class VendorController {
    constructor() {
        this.vendorModel = new VendorModel();
    }

    /**
     * Get all vendors
     * @route GET /api/vendors
     */
    async getAllVendors(req, res) {
        try {
            const {
                is_active,
                is_archived,
                search,
                page = 1,
                limit = 50
            } = req.query;

            const filters = {};
            if (is_active !== undefined) filters.is_active = is_active === 'true';
            if (is_archived !== undefined) filters.is_archived = is_archived === 'true';
            if (search) filters.search = search;

            const vendors = await this.vendorModel.getAllVendors(filters);

            // Simple pagination
            const startIndex = (page - 1) * limit;
            const endIndex = page * limit;
            const paginatedVendors = vendors.slice(startIndex, endIndex);

            logger.info(`Retrieved ${vendors.length} vendors with filters:`, filters);

            res.json({
                success: true,
                data: paginatedVendors,
                pagination: {
                    currentPage: parseInt(page),
                    totalItems: vendors.length,
                    totalPages: Math.ceil(vendors.length / limit),
                    itemsPerPage: parseInt(limit)
                }
            });
        } catch (error) {
            logger.error('Error fetching vendors:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching vendors',
                error: error.message
            });
        }
    }

    /**
     * Get vendor by ID
     * @route GET /api/vendors/:id
     */
    async getVendorById(req, res) {
        try {
            const { id } = req.params;

            const vendor = await this.vendorModel.getVendorById(id);

            if (!vendor) {
                return res.status(404).json({
                    success: false,
                    message: 'Vendor not found'
                });
            }

            logger.info(`Retrieved vendor ${id}:`, vendor.name);

            res.json({
                success: true,
                data: vendor
            });
        } catch (error) {
            logger.error('Error fetching vendor:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching vendor',
                error: error.message
            });
        }
    }

    /**
     * Create new vendor
     * @route POST /api/vendors
     */
    async createVendor(req, res) {
        try {
            const vendorData = req.body;
            const userId = req.user.id;

            // Validate required fields
            if (!vendorData.name || !vendorData.abbreviation) {
                return res.status(400).json({
                    success: false,
                    message: 'Name and abbreviation are required'
                });
            }

            const vendor = await this.vendorModel.createVendor(vendorData, userId);

            logger.info(`Created vendor ${vendor.id}:`, vendor.name);

            res.status(201).json({
                success: true,
                data: vendor,
                message: 'Vendor created successfully'
            });
        } catch (error) {
            logger.error('Error creating vendor:', error);
            
            // Handle duplicate key errors
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({
                    success: false,
                    message: 'Vendor name or abbreviation already exists'
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error creating vendor',
                error: error.message
            });
        }
    }

    /**
     * Update vendor
     * @route PUT /api/vendors/:id
     */
    async updateVendor(req, res) {
        try {
            const { id } = req.params;
            const vendorData = req.body;
            const userId = req.user.id;

            // Check if vendor exists
            const existingVendor = await this.vendorModel.getVendorById(id);
            if (!existingVendor) {
                return res.status(404).json({
                    success: false,
                    message: 'Vendor not found'
                });
            }

            const vendor = await this.vendorModel.updateVendor(id, vendorData, userId);

            logger.info(`Updated vendor ${id}:`, vendor.name);

            res.json({
                success: true,
                data: vendor,
                message: 'Vendor updated successfully'
            });
        } catch (error) {
            logger.error('Error updating vendor:', error);
            
            // Handle duplicate key errors
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({
                    success: false,
                    message: 'Vendor name or abbreviation already exists'
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error updating vendor',
                error: error.message
            });
        }
    }

    /**
     * Archive vendor
     * @route DELETE /api/vendors/:id
     */
    async archiveVendor(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // Check if vendor exists
            const existingVendor = await this.vendorModel.getVendorById(id);
            if (!existingVendor) {
                return res.status(404).json({
                    success: false,
                    message: 'Vendor not found'
                });
            }

            await this.vendorModel.archiveVendor(id, userId);

            logger.info(`Archived vendor ${id}:`, existingVendor.name);

            res.json({
                success: true,
                message: 'Vendor archived successfully'
            });
        } catch (error) {
            logger.error('Error archiving vendor:', error);
            res.status(500).json({
                success: false,
                message: 'Error archiving vendor',
                error: error.message
            });
        }
    }

    /**
     * Restore archived vendor
     * @route POST /api/vendors/:id/restore
     */
    async restoreVendor(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // Check if vendor exists
            const existingVendor = await this.vendorModel.getVendorById(id);
            if (!existingVendor) {
                return res.status(404).json({
                    success: false,
                    message: 'Vendor not found'
                });
            }

            await this.vendorModel.restoreVendor(id, userId);

            logger.info(`Restored vendor ${id}:`, existingVendor.name);

            res.json({
                success: true,
                message: 'Vendor restored successfully'
            });
        } catch (error) {
            logger.error('Error restoring vendor:', error);
            res.status(500).json({
                success: false,
                message: 'Error restoring vendor',
                error: error.message
            });
        }
    }

    /**
     * Get vendor contacts
     * @route GET /api/vendors/:id/contacts
     */
    async getVendorContacts(req, res) {
        try {
            const { id } = req.params;

            const contacts = await this.vendorModel.getVendorContacts(id);

            logger.info(`Retrieved ${contacts.length} contacts for vendor ${id}`);

            res.json({
                success: true,
                data: contacts
            });
        } catch (error) {
            logger.error('Error fetching vendor contacts:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching vendor contacts',
                error: error.message
            });
        }
    }

    /**
     * Create vendor contact
     * @route POST /api/vendors/:id/contacts
     */
    async createVendorContact(req, res) {
        try {
            const { id } = req.params;
            const contactData = req.body;
            const userId = req.user.id;

            // Check if vendor exists
            const existingVendor = await this.vendorModel.getVendorById(id);
            if (!existingVendor) {
                return res.status(404).json({
                    success: false,
                    message: 'Vendor not found'
                });
            }

            const contact = await this.vendorModel.createVendorContact(id, contactData, userId);

            logger.info(`Created contact for vendor ${id}:`, contact.id);

            res.status(201).json({
                success: true,
                data: contact,
                message: 'Vendor contact created successfully'
            });
        } catch (error) {
            logger.error('Error creating vendor contact:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating vendor contact',
                error: error.message
            });
        }
    }

    /**
     * Update vendor contact
     * @route PUT /api/vendors/:id/contacts/:contactId
     */
    async updateVendorContact(req, res) {
        try {
            const { id, contactId } = req.params;
            const contactData = req.body;
            const userId = req.user.id;

            // Check if contact exists
            const existingContact = await this.vendorModel.getVendorContactById(contactId);
            if (!existingContact || existingContact.vendor_id != id) {
                return res.status(404).json({
                    success: false,
                    message: 'Contact not found for this vendor'
                });
            }

            const contact = await this.vendorModel.updateVendorContact(contactId, contactData, userId);

            logger.info(`Updated contact ${contactId} for vendor ${id}`);

            res.json({
                success: true,
                data: contact,
                message: 'Vendor contact updated successfully'
            });
        } catch (error) {
            logger.error('Error updating vendor contact:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating vendor contact',
                error: error.message
            });
        }
    }

    /**
     * Delete vendor contact
     * @route DELETE /api/vendors/:id/contacts/:contactId
     */
    async deleteVendorContact(req, res) {
        try {
            const { id, contactId } = req.params;

            // Check if contact exists
            const existingContact = await this.vendorModel.getVendorContactById(contactId);
            if (!existingContact || existingContact.vendor_id != id) {
                return res.status(404).json({
                    success: false,
                    message: 'Contact not found for this vendor'
                });
            }

            await this.vendorModel.deleteVendorContact(contactId);

            logger.info(`Deleted contact ${contactId} for vendor ${id}`);

            res.json({
                success: true,
                message: 'Vendor contact deleted successfully'
            });
        } catch (error) {
            logger.error('Error deleting vendor contact:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting vendor contact',
                error: error.message
            });
        }
    }

    /**
     * Get vendor files
     * @route GET /api/vendors/:id/files
     */
    async getVendorFiles(req, res) {
        try {
            const { id } = req.params;

            const files = await this.vendorModel.getVendorFiles(id);

            logger.info(`Retrieved ${files.length} files for vendor ${id}`);

            res.json({
                success: true,
                data: files
            });
        } catch (error) {
            logger.error('Error fetching vendor files:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching vendor files',
                error: error.message
            });
        }
    }

    /**
     * Create vendor file
     * @route POST /api/vendors/:id/files
     */
    async createVendorFile(req, res) {
        try {
            const { id } = req.params;
            const fileData = req.body;
            const userId = req.user.id;

            // Check if vendor exists
            const existingVendor = await this.vendorModel.getVendorById(id);
            if (!existingVendor) {
                return res.status(404).json({
                    success: false,
                    message: 'Vendor not found'
                });
            }

            // Validate required fields
            if (!fileData.file_name || !fileData.file_path) {
                return res.status(400).json({
                    success: false,
                    message: 'File name and path are required'
                });
            }

            const file = await this.vendorModel.createVendorFile(id, fileData, userId);

            logger.info(`Created file for vendor ${id}:`, file.id);

            res.status(201).json({
                success: true,
                data: file,
                message: 'Vendor file created successfully'
            });
        } catch (error) {
            logger.error('Error creating vendor file:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating vendor file',
                error: error.message
            });
        }
    }

    /**
     * Delete vendor file
     * @route DELETE /api/vendors/:id/files/:fileId
     */
    async deleteVendorFile(req, res) {
        try {
            const { id, fileId } = req.params;

            // Check if file exists
            const existingFile = await this.vendorModel.getVendorFileById(fileId);
            if (!existingFile || existingFile.vendor_id != id) {
                return res.status(404).json({
                    success: false,
                    message: 'File not found for this vendor'
                });
            }

            await this.vendorModel.deleteVendorFile(fileId);

            logger.info(`Deleted file ${fileId} for vendor ${id}`);

            res.json({
                success: true,
                message: 'Vendor file deleted successfully'
            });
        } catch (error) {
            logger.error('Error deleting vendor file:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting vendor file',
                error: error.message
            });
        }
    }

    /**
     * Get vendor addresses
     * @route GET /api/vendors/:id/addresses
     */
    async getVendorAddresses(req, res) {
        try {
            const { id } = req.params;

            const addresses = await this.vendorModel.getVendorAddresses(id);

            logger.info(`Retrieved ${addresses.length} addresses for vendor ${id}`);

            res.json({
                success: true,
                data: addresses
            });
        } catch (error) {
            logger.error('Error fetching vendor addresses:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching vendor addresses',
                error: error.message
            });
        }
    }

    /**
     * Create vendor address
     * @route POST /api/vendors/:id/addresses
     */
    async createVendorAddress(req, res) {
        try {
            const { id } = req.params;
            const addressData = req.body;
            const userId = req.user.id;

            // Check if vendor exists
            const existingVendor = await this.vendorModel.getVendorById(id);
            if (!existingVendor) {
                return res.status(404).json({
                    success: false,
                    message: 'Vendor not found'
                });
            }

            // Validate required fields
            if (!addressData.address_line1 || !addressData.city || !addressData.state || !addressData.zip_code) {
                return res.status(400).json({
                    success: false,
                    message: 'Address line 1, city, state, and zip code are required'
                });
            }

            const address = await this.vendorModel.createVendorAddress(id, addressData, userId);

            logger.info(`Created address for vendor ${id}:`, address.id);

            res.status(201).json({
                success: true,
                data: address,
                message: 'Vendor address created successfully'
            });
        } catch (error) {
            logger.error('Error creating vendor address:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating vendor address',
                error: error.message
            });
        }
    }

    /**
     * Update vendor address
     * @route PUT /api/vendors/:id/addresses/:addressId
     */
    async updateVendorAddress(req, res) {
        try {
            const { id, addressId } = req.params;
            const addressData = req.body;
            const userId = req.user.id;

            // Check if address exists
            const existingAddress = await this.vendorModel.getVendorAddressById(addressId);
            if (!existingAddress || existingAddress.vendor_id != id) {
                return res.status(404).json({
                    success: false,
                    message: 'Address not found for this vendor'
                });
            }

            const address = await this.vendorModel.updateVendorAddress(addressId, addressData, userId);

            logger.info(`Updated address ${addressId} for vendor ${id}`);

            res.json({
                success: true,
                data: address,
                message: 'Vendor address updated successfully'
            });
        } catch (error) {
            logger.error('Error updating vendor address:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating vendor address',
                error: error.message
            });
        }
    }

    /**
     * Delete vendor address
     * @route DELETE /api/vendors/:id/addresses/:addressId
     */
    async deleteVendorAddress(req, res) {
        try {
            const { id, addressId } = req.params;

            // Check if address exists
            const existingAddress = await this.vendorModel.getVendorAddressById(addressId);
            if (!existingAddress || existingAddress.vendor_id != id) {
                return res.status(404).json({
                    success: false,
                    message: 'Address not found for this vendor'
                });
            }

            await this.vendorModel.deleteVendorAddress(addressId);

            logger.info(`Deleted address ${addressId} for vendor ${id}`);

            res.json({
                success: true,
                message: 'Vendor address deleted successfully'
            });
        } catch (error) {
            logger.error('Error deleting vendor address:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting vendor address',
                error: error.message
            });
        }
    }

    /**
     * Get vendor notes
     * @route GET /api/vendors/:id/notes
     */
    async getVendorNotes(req, res) {
        try {
            const { id } = req.params;

            const notes = await this.vendorModel.getVendorNotes(id);

            logger.info(`Retrieved ${notes.length} notes for vendor ${id}`);

            res.json({
                success: true,
                data: notes
            });
        } catch (error) {
            logger.error('Error fetching vendor notes:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching vendor notes',
                error: error.message
            });
        }
    }

    /**
     * Create vendor note
     * @route POST /api/vendors/:id/notes
     */
    async createVendorNote(req, res) {
        try {
            const { id } = req.params;
            const noteData = req.body;
            const userId = req.user.id;

            // Check if vendor exists
            const existingVendor = await this.vendorModel.getVendorById(id);
            if (!existingVendor) {
                return res.status(404).json({
                    success: false,
                    message: 'Vendor not found'
                });
            }

            // Validate required fields
            if (!noteData.content) {
                return res.status(400).json({
                    success: false,
                    message: 'Note content is required'
                });
            }

            const note = await this.vendorModel.createVendorNote(id, noteData, userId);

            logger.info(`Created note for vendor ${id}:`, note.id);

            res.status(201).json({
                success: true,
                data: note,
                message: 'Vendor note created successfully'
            });
        } catch (error) {
            logger.error('Error creating vendor note:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating vendor note',
                error: error.message
            });
        }
    }

    /**
     * Update vendor note
     * @route PUT /api/vendors/:id/notes/:noteId
     */
    async updateVendorNote(req, res) {
        try {
            const { id, noteId } = req.params;
            const noteData = req.body;
            const userId = req.user.id;

            // Check if note exists
            const existingNote = await this.vendorModel.getVendorNoteById(noteId);
            if (!existingNote || existingNote.vendor_id != id) {
                return res.status(404).json({
                    success: false,
                    message: 'Note not found for this vendor'
                });
            }

            const note = await this.vendorModel.updateVendorNote(noteId, noteData, userId);

            logger.info(`Updated note ${noteId} for vendor ${id}`);

            res.json({
                success: true,
                data: note,
                message: 'Vendor note updated successfully'
            });
        } catch (error) {
            logger.error('Error updating vendor note:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating vendor note',
                error: error.message
            });
        }
    }

    /**
     * Delete vendor note
     * @route DELETE /api/vendors/:id/notes/:noteId
     */
    async deleteVendorNote(req, res) {
        try {
            const { id, noteId } = req.params;

            // Check if note exists
            const existingNote = await this.vendorModel.getVendorNoteById(noteId);
            if (!existingNote || existingNote.vendor_id != id) {
                return res.status(404).json({
                    success: false,
                    message: 'Note not found for this vendor'
                });
            }

            await this.vendorModel.deleteVendorNote(noteId);

            logger.info(`Deleted note ${noteId} for vendor ${id}`);

            res.json({
                success: true,
                message: 'Vendor note deleted successfully'
            });
        } catch (error) {
            logger.error('Error deleting vendor note:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting vendor note',
                error: error.message
            });
        }
    }

    /**
     * Search vendors
     * @route GET /api/vendors/search
     */
    async searchVendors(req, res) {
        try {
            const { q, limit = 10, active_only = true } = req.query;

            if (!q) {
                return res.status(400).json({
                    success: false,
                    message: 'Search query parameter "q" is required'
                });
            }

            const options = {
                limit: parseInt(limit),
                activeOnly: active_only === 'true'
            };

            const vendors = await this.vendorModel.searchVendors(q, options);

            logger.info(`Search for "${q}" returned ${vendors.length} vendors`);

            res.json({
                success: true,
                data: vendors,
                query: q
            });
        } catch (error) {
            logger.error('Error searching vendors:', error);
            res.status(500).json({
                success: false,
                message: 'Error searching vendors',
                error: error.message
            });
        }
    }

    /**
     * Get vendor statistics
     * @route GET /api/vendors/stats
     */
    async getVendorStats(req, res) {
        try {
            const stats = await this.vendorModel.getVendorStats();

            logger.info('Retrieved vendor statistics');

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error fetching vendor statistics:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching vendor statistics',
                error: error.message
            });
        }
    }
}

module.exports = VendorController; 