const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class VendorModel extends BaseModel {
    constructor() {
        super('api_vendors');
    }

    /**
     * Get all vendors with optional filtering
     * @param {Object} filters - Optional filters
     * @returns {Promise<Array>} Array of vendors
     */
    async getAllVendors(filters = {}) {
        let query = `
            SELECT 
                v.id, v.name, v.abbreviation, v.business_name, v.description, v.website,
                v.is_active, v.is_archived, v.created_at, v.updated_at,
                COUNT(DISTINCT vc.id) as contact_count,
                COUNT(DISTINCT vf.id) as file_count,
                COUNT(DISTINCT va.id) as address_count,
                COUNT(DISTINCT vn.id) as note_count
            FROM ${this.tableName} v
            LEFT JOIN api_vendor_contacts vc ON v.id = vc.vendor_id AND vc.is_active = TRUE
            LEFT JOIN api_vendor_files vf ON v.id = vf.vendor_id AND vf.is_active = TRUE
            LEFT JOIN api_vendor_addresses va ON v.id = va.vendor_id AND va.is_active = TRUE
            LEFT JOIN api_vendor_notes vn ON v.id = vn.vendor_id AND vn.is_active = TRUE
        `;

        const conditions = [];
        const values = [];

        if (filters.is_active !== undefined) {
            conditions.push('v.is_active = ?');
            values.push(filters.is_active);
        }

        if (filters.is_archived !== undefined) {
            conditions.push('v.is_archived = ?');
            values.push(filters.is_archived);
        }

        if (filters.search) {
            conditions.push('(v.name LIKE ? OR v.abbreviation LIKE ? OR v.business_name LIKE ?)');
            const searchTerm = `%${filters.search}%`;
            values.push(searchTerm, searchTerm, searchTerm);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' GROUP BY v.id ORDER BY v.name ASC';

        return await this.executeQuery(query, values);
    }

    /**
     * Get vendor by ID with all related data
     * @param {number} vendorId - Vendor ID
     * @returns {Promise<Object|null>} Vendor with related data
     */
    async getVendorById(vendorId) {
        const query = `
            SELECT 
                v.id, v.name, v.abbreviation, v.business_name, v.description, v.website,
                v.is_active, v.is_archived, v.created_at, v.updated_at,
                v.created_by, v.updated_by
            FROM ${this.tableName} v
            WHERE v.id = ?
        `;
        
        const vendors = await this.executeQuery(query, [vendorId]);
        if (vendors.length === 0) {
            return null;
        }

        const vendor = vendors[0];

        // Get contacts
        vendor.contacts = await this.getVendorContacts(vendorId);
        
        // Get files
        vendor.files = await this.getVendorFiles(vendorId);
        
        // Get addresses
        vendor.addresses = await this.getVendorAddresses(vendorId);
        
        // Get notes
        vendor.notes = await this.getVendorNotes(vendorId);

        return vendor;
    }

    /**
     * Create a new vendor
     * @param {Object} vendorData - Vendor data
     * @param {number} userId - User ID creating the vendor
     * @returns {Promise<Object>} Created vendor
     */
    async createVendor(vendorData, userId) {
        const {
            name, abbreviation, business_name, description, website,
            is_active = true, is_archived = false
        } = vendorData;

        const query = `
            INSERT INTO ${this.tableName} (
                name, abbreviation, business_name, description, website,
                is_active, is_archived, created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            name, abbreviation, business_name, description, website,
            is_active, is_archived, userId, userId
        ];

        const result = await this.executeQuery(query, values);
        return await this.getVendorById(result.insertId);
    }

    /**
     * Update vendor
     * @param {number} vendorId - Vendor ID
     * @param {Object} vendorData - Updated vendor data
     * @param {number} userId - User ID making the update
     * @returns {Promise<Object>} Updated vendor
     */
    async updateVendor(vendorId, vendorData, userId) {
        const {
            name, abbreviation, business_name, description, website, is_active
        } = vendorData;

        const query = `
            UPDATE ${this.tableName} 
            SET name = ?, abbreviation = ?, business_name = ?, description = ?, 
                website = ?, is_active = ?, updated_by = ?
            WHERE id = ?
        `;

        const values = [
            name, abbreviation, business_name, description, website,
            is_active, userId, vendorId
        ];

        await this.executeQuery(query, values);
        return await this.getVendorById(vendorId);
    }

    /**
     * Archive vendor (soft delete)
     * @param {number} vendorId - Vendor ID
     * @param {number} userId - User ID archiving the vendor
     * @returns {Promise<boolean>} Success status
     */
    async archiveVendor(vendorId, userId) {
        const query = `
            UPDATE ${this.tableName} 
            SET is_archived = TRUE, updated_by = ?
            WHERE id = ?
        `;

        await this.executeQuery(query, [userId, vendorId]);
        return true;
    }

    /**
     * Restore archived vendor
     * @param {number} vendorId - Vendor ID
     * @param {number} userId - User ID restoring the vendor
     * @returns {Promise<boolean>} Success status
     */
    async restoreVendor(vendorId, userId) {
        const query = `
            UPDATE ${this.tableName} 
            SET is_archived = FALSE, updated_by = ?
            WHERE id = ?
        `;

        await this.executeQuery(query, [userId, vendorId]);
        return true;
    }

    /**
     * Get vendor contacts
     * @param {number} vendorId - Vendor ID
     * @returns {Promise<Array>} Array of contacts
     */
    async getVendorContacts(vendorId) {
        const query = `
            SELECT 
                id, vendor_id, contact_type, first_name, last_name, title, email,
                phone, phone_ext, mobile, fax, address_line1, address_line2,
                city, state, zip_code, country, is_primary, is_active,
                created_at, updated_at
            FROM api_vendor_contacts
            WHERE vendor_id = ? AND is_active = TRUE
            ORDER BY is_primary DESC, first_name ASC
        `;

        return await this.executeQuery(query, [vendorId]);
    }

    /**
     * Create vendor contact
     * @param {number} vendorId - Vendor ID
     * @param {Object} contactData - Contact data
     * @param {number} userId - User ID creating the contact
     * @returns {Promise<Object>} Created contact
     */
    async createVendorContact(vendorId, contactData, userId) {
        const {
            contact_type = 'primary', first_name, last_name, title, email,
            phone, phone_ext, mobile, fax, address_line1, address_line2,
            city, state, zip_code, country = 'USA', is_primary = false
        } = contactData;

        // If this is being set as primary, unset other primary contacts
        if (is_primary) {
            await this.executeQuery(`
                UPDATE api_vendor_contacts 
                SET is_primary = FALSE 
                WHERE vendor_id = ? AND contact_type = ?
            `, [vendorId, contact_type]);
        }

        const query = `
            INSERT INTO api_vendor_contacts (
                vendor_id, contact_type, first_name, last_name, title, email,
                phone, phone_ext, mobile, fax, address_line1, address_line2,
                city, state, zip_code, country, is_primary, created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            vendorId, contact_type, first_name, last_name, title, email,
            phone, phone_ext, mobile, fax, address_line1, address_line2,
            city, state, zip_code, country, is_primary, userId, userId
        ];

        const result = await this.executeQuery(query, values);
        return await this.getVendorContactById(result.insertId);
    }

    /**
     * Get vendor contact by ID
     * @param {number} contactId - Contact ID
     * @returns {Promise<Object|null>} Contact or null
     */
    async getVendorContactById(contactId) {
        const query = `
            SELECT 
                id, vendor_id, contact_type, first_name, last_name, title, email,
                phone, phone_ext, mobile, fax, address_line1, address_line2,
                city, state, zip_code, country, is_primary, is_active,
                created_at, updated_at
            FROM api_vendor_contacts
            WHERE id = ?
        `;

        const contacts = await this.executeQuery(query, [contactId]);
        return contacts.length > 0 ? contacts[0] : null;
    }

    /**
     * Update vendor contact
     * @param {number} contactId - Contact ID
     * @param {Object} contactData - Updated contact data
     * @param {number} userId - User ID making the update
     * @returns {Promise<Object>} Updated contact
     */
    async updateVendorContact(contactId, contactData, userId) {
        const {
            contact_type, first_name, last_name, title, email,
            phone, phone_ext, mobile, fax, address_line1, address_line2,
            city, state, zip_code, country, is_primary
        } = contactData;

        // If this is being set as primary, unset other primary contacts
        if (is_primary) {
            const contact = await this.getVendorContactById(contactId);
            if (contact) {
                await this.executeQuery(`
                    UPDATE api_vendor_contacts 
                    SET is_primary = FALSE 
                    WHERE vendor_id = ? AND contact_type = ? AND id != ?
                `, [contact.vendor_id, contact_type, contactId]);
            }
        }

        const query = `
            UPDATE api_vendor_contacts 
            SET contact_type = ?, first_name = ?, last_name = ?, title = ?, email = ?,
                phone = ?, phone_ext = ?, mobile = ?, fax = ?, address_line1 = ?, 
                address_line2 = ?, city = ?, state = ?, zip_code = ?, country = ?, 
                is_primary = ?, updated_by = ?
            WHERE id = ?
        `;

        const values = [
            contact_type, first_name, last_name, title, email,
            phone, phone_ext, mobile, fax, address_line1, address_line2,
            city, state, zip_code, country, is_primary, userId, contactId
        ];

        await this.executeQuery(query, values);
        return await this.getVendorContactById(contactId);
    }

    /**
     * Delete vendor contact
     * @param {number} contactId - Contact ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteVendorContact(contactId) {
        const query = `
            UPDATE api_vendor_contacts 
            SET is_active = FALSE 
            WHERE id = ?
        `;

        await this.executeQuery(query, [contactId]);
        return true;
    }

    /**
     * Get vendor files
     * @param {number} vendorId - Vendor ID
     * @returns {Promise<Array>} Array of files
     */
    async getVendorFiles(vendorId) {
        const query = `
            SELECT 
                id, vendor_id, file_type, file_name, file_path, file_size,
                mime_type, description, is_active, created_at, updated_at
            FROM api_vendor_files
            WHERE vendor_id = ? AND is_active = TRUE
            ORDER BY file_type ASC, file_name ASC
        `;

        return await this.executeQuery(query, [vendorId]);
    }

    /**
     * Create vendor file
     * @param {number} vendorId - Vendor ID
     * @param {Object} fileData - File data
     * @param {number} userId - User ID creating the file
     * @returns {Promise<Object>} Created file record
     */
    async createVendorFile(vendorId, fileData, userId) {
        const {
            file_type = 'other', file_name, file_path, file_size,
            mime_type, description
        } = fileData;

        const query = `
            INSERT INTO api_vendor_files (
                vendor_id, file_type, file_name, file_path, file_size,
                mime_type, description, created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            vendorId, file_type, file_name, file_path, file_size,
            mime_type, description, userId, userId
        ];

        const result = await this.executeQuery(query, values);
        return await this.getVendorFileById(result.insertId);
    }

    /**
     * Get vendor file by ID
     * @param {number} fileId - File ID
     * @returns {Promise<Object|null>} File or null
     */
    async getVendorFileById(fileId) {
        const query = `
            SELECT 
                id, vendor_id, file_type, file_name, file_path, file_size,
                mime_type, description, is_active, created_at, updated_at
            FROM api_vendor_files
            WHERE id = ?
        `;

        const files = await this.executeQuery(query, [fileId]);
        return files.length > 0 ? files[0] : null;
    }

    /**
     * Delete vendor file
     * @param {number} fileId - File ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteVendorFile(fileId) {
        const query = `
            UPDATE api_vendor_files 
            SET is_active = FALSE 
            WHERE id = ?
        `;

        await this.executeQuery(query, [fileId]);
        return true;
    }

    /**
     * Get vendor addresses
     * @param {number} vendorId - Vendor ID
     * @returns {Promise<Array>} Array of addresses
     */
    async getVendorAddresses(vendorId) {
        const query = `
            SELECT 
                id, vendor_id, address_type, address_line1, address_line2,
                city, state, zip_code, country, is_primary, is_active,
                created_at, updated_at
            FROM api_vendor_addresses
            WHERE vendor_id = ? AND is_active = TRUE
            ORDER BY is_primary DESC, address_type ASC
        `;

        return await this.executeQuery(query, [vendorId]);
    }

    /**
     * Create vendor address
     * @param {number} vendorId - Vendor ID
     * @param {Object} addressData - Address data
     * @param {number} userId - User ID creating the address
     * @returns {Promise<Object>} Created address
     */
    async createVendorAddress(vendorId, addressData, userId) {
        const {
            address_type = 'main', address_line1, address_line2,
            city, state, zip_code, country = 'USA', is_primary = false
        } = addressData;

        // If this is being set as primary, unset other primary addresses
        if (is_primary) {
            await this.executeQuery(`
                UPDATE api_vendor_addresses 
                SET is_primary = FALSE 
                WHERE vendor_id = ? AND address_type = ?
            `, [vendorId, address_type]);
        }

        const query = `
            INSERT INTO api_vendor_addresses (
                vendor_id, address_type, address_line1, address_line2,
                city, state, zip_code, country, is_primary, created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            vendorId, address_type, address_line1, address_line2,
            city, state, zip_code, country, is_primary, userId, userId
        ];

        const result = await this.executeQuery(query, values);
        return await this.getVendorAddressById(result.insertId);
    }

    /**
     * Get vendor address by ID
     * @param {number} addressId - Address ID
     * @returns {Promise<Object|null>} Address or null
     */
    async getVendorAddressById(addressId) {
        const query = `
            SELECT 
                id, vendor_id, address_type, address_line1, address_line2,
                city, state, zip_code, country, is_primary, is_active,
                created_at, updated_at
            FROM api_vendor_addresses
            WHERE id = ?
        `;

        const addresses = await this.executeQuery(query, [addressId]);
        return addresses.length > 0 ? addresses[0] : null;
    }

    /**
     * Update vendor address
     * @param {number} addressId - Address ID
     * @param {Object} addressData - Updated address data
     * @param {number} userId - User ID making the update
     * @returns {Promise<Object>} Updated address
     */
    async updateVendorAddress(addressId, addressData, userId) {
        const {
            address_type, address_line1, address_line2,
            city, state, zip_code, country, is_primary
        } = addressData;

        // If this is being set as primary, unset other primary addresses
        if (is_primary) {
            const address = await this.getVendorAddressById(addressId);
            if (address) {
                await this.executeQuery(`
                    UPDATE api_vendor_addresses 
                    SET is_primary = FALSE 
                    WHERE vendor_id = ? AND address_type = ? AND id != ?
                `, [address.vendor_id, address_type, addressId]);
            }
        }

        const query = `
            UPDATE api_vendor_addresses 
            SET address_type = ?, address_line1 = ?, address_line2 = ?,
                city = ?, state = ?, zip_code = ?, country = ?, is_primary = ?, updated_by = ?
            WHERE id = ?
        `;

        const values = [
            address_type, address_line1, address_line2,
            city, state, zip_code, country, is_primary, userId, addressId
        ];

        await this.executeQuery(query, values);
        return await this.getVendorAddressById(addressId);
    }

    /**
     * Delete vendor address
     * @param {number} addressId - Address ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteVendorAddress(addressId) {
        const query = `
            UPDATE api_vendor_addresses 
            SET is_active = FALSE 
            WHERE id = ?
        `;

        await this.executeQuery(query, [addressId]);
        return true;
    }

    /**
     * Get vendor notes
     * @param {number} vendorId - Vendor ID
     * @returns {Promise<Array>} Array of notes
     */
    async getVendorNotes(vendorId) {
        const query = `
            SELECT 
                id, vendor_id, note_type, title, content, is_private, is_active,
                created_at, updated_at, created_by, updated_by
            FROM api_vendor_notes
            WHERE vendor_id = ? AND is_active = TRUE
            ORDER BY created_at DESC
        `;

        return await this.executeQuery(query, [vendorId]);
    }

    /**
     * Create vendor note
     * @param {number} vendorId - Vendor ID
     * @param {Object} noteData - Note data
     * @param {number} userId - User ID creating the note
     * @returns {Promise<Object>} Created note
     */
    async createVendorNote(vendorId, noteData, userId) {
        const {
            note_type = 'general', title, content, is_private = false
        } = noteData;

        const query = `
            INSERT INTO api_vendor_notes (
                vendor_id, note_type, title, content, is_private, created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [vendorId, note_type, title, content, is_private, userId, userId];

        const result = await this.executeQuery(query, values);
        return await this.getVendorNoteById(result.insertId);
    }

    /**
     * Get vendor note by ID
     * @param {number} noteId - Note ID
     * @returns {Promise<Object|null>} Note or null
     */
    async getVendorNoteById(noteId) {
        const query = `
            SELECT 
                id, vendor_id, note_type, title, content, is_private, is_active,
                created_at, updated_at, created_by, updated_by
            FROM api_vendor_notes
            WHERE id = ?
        `;

        const notes = await this.executeQuery(query, [noteId]);
        return notes.length > 0 ? notes[0] : null;
    }

    /**
     * Update vendor note
     * @param {number} noteId - Note ID
     * @param {Object} noteData - Updated note data
     * @param {number} userId - User ID making the update
     * @returns {Promise<Object>} Updated note
     */
    async updateVendorNote(noteId, noteData, userId) {
        const { note_type, title, content, is_private } = noteData;

        const query = `
            UPDATE api_vendor_notes 
            SET note_type = ?, title = ?, content = ?, is_private = ?, updated_by = ?
            WHERE id = ?
        `;

        const values = [note_type, title, content, is_private, userId, noteId];

        await this.executeQuery(query, values);
        return await this.getVendorNoteById(noteId);
    }

    /**
     * Delete vendor note
     * @param {number} noteId - Note ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteVendorNote(noteId) {
        const query = `
            UPDATE api_vendor_notes 
            SET is_active = FALSE 
            WHERE id = ?
        `;

        await this.executeQuery(query, [noteId]);
        return true;
    }

    /**
     * Search vendors by name or abbreviation
     * @param {string} searchTerm - Search term
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Array of matching vendors
     */
    async searchVendors(searchTerm, options = {}) {
        const { limit = 10, activeOnly = true } = options;
        
        let query = `
            SELECT id, name, abbreviation, business_name
            FROM ${this.tableName}
            WHERE (name LIKE ? OR abbreviation LIKE ? OR business_name LIKE ?)
        `;
        
        const searchPattern = `%${searchTerm}%`;
        const values = [searchPattern, searchPattern, searchPattern];
        
        if (activeOnly) {
            query += ' AND is_active = TRUE AND is_archived = FALSE';
        }
        
        query += ' ORDER BY name ASC';
        
        if (limit) {
            query += ' LIMIT ?';
            values.push(limit);
        }
        
        return await this.executeQuery(query, values);
    }

    /**
     * Get vendor statistics
     * @returns {Promise<Object>} Vendor statistics
     */
    async getVendorStats() {
        const query = `
            SELECT 
                COUNT(*) as total_vendors,
                COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_vendors,
                COUNT(CASE WHEN is_archived = TRUE THEN 1 END) as archived_vendors,
                COUNT(CASE WHEN is_active = FALSE THEN 1 END) as inactive_vendors
            FROM ${this.tableName}
        `;

        const stats = await this.executeQuery(query);
        return stats[0];
    }
}

module.exports = VendorModel; 