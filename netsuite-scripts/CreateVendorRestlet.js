/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

/**
 * NetSuite Vendor Creation RESTlet
 * Creates vendor records from OPMS data
 */

define(['N/record', 'N/log', 'N/search'], function(record, log, search) {
    
    /**
     * Create a new vendor record
     * @param {Object} requestBody - Vendor data from OPMS
     * @returns {Object} Created vendor info
     */
    function post(requestBody) {
        log.debug('CreateVendorRestlet', '🚀🚀🚀 VENDOR CREATION RESTLET STARTED 🚀🚀🚀');
        log.debug('CreateVendorRestlet', 'Request body: ' + JSON.stringify(requestBody));
        
        try {
            // Validate required fields
            if (!requestBody.companyName) {
                throw new Error('Company name is required');
            }
            
            // Check if vendor already exists
            const existingVendor = findVendorByName(requestBody.companyName);
            if (existingVendor) {
                log.debug('CreateVendorRestlet', 'Vendor already exists: ' + existingVendor.id);
                return {
                    success: true,
                    id: existingVendor.id,
                    message: 'Vendor already exists',
                    companyName: existingVendor.companyname,
                    isExisting: true
                };
            }
            
            // Create new vendor record
            const vendorRecord = record.create({
                type: record.Type.VENDOR
            });
            
            // Set required fields
            vendorRecord.setValue({
                fieldId: 'companyname',
                value: requestBody.companyName
            });
            
            // Set optional fields if provided
            if (requestBody.subsidiary) {
                vendorRecord.setValue({
                    fieldId: 'subsidiary',
                    value: requestBody.subsidiary
                });
            }
            
            if (requestBody.email) {
                vendorRecord.setValue({
                    fieldId: 'email',
                    value: requestBody.email
                });
            }
            
            if (requestBody.phone) {
                vendorRecord.setValue({
                    fieldId: 'phone',
                    value: requestBody.phone
                });
            }
            
            // Set custom fields for OPMS mapping
            if (requestBody.opmsVendorId) {
                vendorRecord.setValue({
                    fieldId: 'custentity_opms_vendor_id', // Custom field to store OPMS ID
                    value: requestBody.opmsVendorId
                });
            }
            
            if (requestBody.opmsAbbreviation) {
                vendorRecord.setValue({
                    fieldId: 'custentity_opms_abbreviation', // Custom field for OPMS abbreviation
                    value: requestBody.opmsAbbreviation
                });
            }
            
            // Save the vendor record
            const vendorId = vendorRecord.save();
            
            log.debug('CreateVendorRestlet', '✅ Vendor created successfully with ID: ' + vendorId);
            
            // Read back the created vendor for confirmation
            const savedVendor = record.load({
                type: record.Type.VENDOR,
                id: vendorId
            });
            
            const result = {
                success: true,
                id: vendorId,
                message: 'Vendor created successfully',
                companyName: savedVendor.getValue({ fieldId: 'companyname' }),
                email: savedVendor.getValue({ fieldId: 'email' }),
                phone: savedVendor.getValue({ fieldId: 'phone' }),
                opmsVendorId: savedVendor.getValue({ fieldId: 'custentity_opms_vendor_id' }),
                opmsAbbreviation: savedVendor.getValue({ fieldId: 'custentity_opms_abbreviation' }),
                isExisting: false
            };
            
            log.debug('CreateVendorRestlet', 'Result: ' + JSON.stringify(result));
            return result;
            
        } catch (error) {
            log.error('CreateVendorRestlet', '❌ Error creating vendor: ' + error.toString());
            return {
                success: false,
                error: error.toString(),
                message: 'Failed to create vendor: ' + error.message
            };
        }
    }
    
    /**
     * Search for existing vendor by company name
     * @param {string} companyName - Company name to search for
     * @returns {Object|null} Existing vendor or null
     */
    function findVendorByName(companyName) {
        try {
            const vendorSearch = search.create({
                type: search.Type.VENDOR,
                filters: [
                    ['companyname', 'is', companyName]
                ],
                columns: [
                    'internalid',
                    'companyname',
                    'email'
                ]
            });
            
            const searchResult = vendorSearch.run().getRange({
                start: 0,
                end: 1
            });
            
            if (searchResult.length > 0) {
                return {
                    id: searchResult[0].getValue('internalid'),
                    companyname: searchResult[0].getValue('companyname'),
                    email: searchResult[0].getValue('email')
                };
            }
            
            return null;
            
        } catch (error) {
            log.error('CreateVendorRestlet', 'Error searching for vendor: ' + error.toString());
            return null;
        }
    }
    
    /**
     * Get vendor information
     * @param {Object} requestBody - Request with vendor ID
     * @returns {Object} Vendor information
     */
    function get(requestBody) {
        log.debug('CreateVendorRestlet', 'GET request: ' + JSON.stringify(requestBody));
        
        try {
            if (!requestBody.id) {
                throw new Error('Vendor ID is required');
            }
            
            const vendorRecord = record.load({
                type: record.Type.VENDOR,
                id: requestBody.id
            });
            
            return {
                success: true,
                id: requestBody.id,
                companyName: vendorRecord.getValue({ fieldId: 'companyname' }),
                email: vendorRecord.getValue({ fieldId: 'email' }),
                phone: vendorRecord.getValue({ fieldId: 'phone' }),
                opmsVendorId: vendorRecord.getValue({ fieldId: 'custentity_opms_vendor_id' }),
                opmsAbbreviation: vendorRecord.getValue({ fieldId: 'custentity_opms_abbreviation' })
            };
            
        } catch (error) {
            log.error('CreateVendorRestlet', '❌ Error getting vendor: ' + error.toString());
            return {
                success: false,
                error: error.toString(),
                message: 'Failed to get vendor: ' + error.message
            };
        }
    }
    
    return {
        post: post,
        get: get
    };
});

