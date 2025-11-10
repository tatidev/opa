/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 * 
 * Vendor List RESTlet
 * Extracts all vendors from NetSuite with accurate ID → Name mappings
 */

define(['N/search', 'N/log'], function(search, log) {
    
    /**
     * GET handler - Extract all vendors
     * @returns {Object} Complete vendor list with accurate mappings
     */
    function get() {
        log.debug('VendorListRestlet', '🔍 EXTRACTING ALL VENDORS FROM NETSUITE');
        
        try {
            var vendors = [];
            var vendorSearch = search.create({
                type: search.Type.VENDOR,
                filters: [
                    ['isinactive', 'is', 'F'] // Only active vendors
                ],
                columns: [
                    'internalid',
                    'entityid', 
                    'companyname',
                    'isinactive'
                ]
            });

            var searchResult = vendorSearch.run();
            var resultRange = searchResult.getRange({
                start: 0,
                end: 1000 // Get first 1000 vendors
            });

            log.debug('VendorListRestlet', 'Found ' + resultRange.length + ' active vendors');

            for (var i = 0; i < resultRange.length; i++) {
                var vendor = resultRange[i];
                
                var vendorData = {
                    id: vendor.getValue('internalid'),
                    entityid: vendor.getValue('entityid'),
                    companyname: vendor.getValue('companyname'),
                    displayName: vendor.getValue('companyname') || vendor.getValue('entityid') || 'Vendor ' + vendor.getValue('internalid'),
                    isinactive: vendor.getValue('isinactive')
                };
                
                vendors.push(vendorData);
            }

            // Check if there are more results (for pagination if needed)
            var hasMore = false;
            try {
                var nextRange = searchResult.getRange({
                    start: 1000,
                    end: 1001
                });
                hasMore = nextRange.length > 0;
            } catch (e) {
                // No more results
                hasMore = false;
            }

            log.audit('VendorListRestlet', 'Successfully extracted ' + vendors.length + ' vendors');

            return {
                success: true,
                extractedAt: new Date().toISOString(),
                totalVendors: vendors.length,
                hasMore: hasMore,
                vendors: vendors,
                message: 'Vendor list extracted successfully'
            };

        } catch (error) {
            log.error('VendorListRestlet', 'Error extracting vendors: ' + error.toString());
            return {
                success: false,
                error: error.toString(),
                message: 'Failed to extract vendor list'
            };
        }
    }

    /**
     * POST handler - Extract vendors with pagination
     * @param {Object} requestBody - Request with pagination parameters
     * @returns {Object} Paginated vendor list
     */
    function post(requestBody) {
        log.debug('VendorListRestlet', '🔍 EXTRACTING VENDORS WITH PAGINATION');
        log.debug('VendorListRestlet', 'Request: ' + JSON.stringify(requestBody));
        
        try {
            var startIndex = requestBody.startIndex || 0;
            var pageSize = Math.min(requestBody.pageSize || 1000, 1000); // Max 1000 per request
            
            var vendors = [];
            var vendorSearch = search.create({
                type: search.Type.VENDOR,
                filters: [
                    ['isinactive', 'is', 'F'] // Only active vendors
                ],
                columns: [
                    'internalid',
                    'entityid', 
                    'companyname',
                    'isinactive'
                ]
            });

            var searchResult = vendorSearch.run();
            var resultRange = searchResult.getRange({
                start: startIndex,
                end: startIndex + pageSize
            });

            log.debug('VendorListRestlet', 'Retrieved ' + resultRange.length + ' vendors (start: ' + startIndex + ')');

            for (var i = 0; i < resultRange.length; i++) {
                var vendor = resultRange[i];
                
                var vendorData = {
                    id: vendor.getValue('internalid'),
                    entityid: vendor.getValue('entityid'),
                    companyname: vendor.getValue('companyname'),
                    displayName: vendor.getValue('companyname') || vendor.getValue('entityid') || 'Vendor ' + vendor.getValue('internalid'),
                    isinactive: vendor.getValue('isinactive')
                };
                
                vendors.push(vendorData);
            }

            // Check if there are more results
            var hasMore = false;
            try {
                var nextRange = searchResult.getRange({
                    start: startIndex + pageSize,
                    end: startIndex + pageSize + 1
                });
                hasMore = nextRange.length > 0;
            } catch (e) {
                // No more results
                hasMore = false;
            }

            log.audit('VendorListRestlet', 'Successfully extracted ' + vendors.length + ' vendors (page)');

            return {
                success: true,
                extractedAt: new Date().toISOString(),
                startIndex: startIndex,
                pageSize: pageSize,
                returnedCount: vendors.length,
                hasMore: hasMore,
                vendors: vendors,
                message: 'Vendor page extracted successfully'
            };

        } catch (error) {
            log.error('VendorListRestlet', 'Error extracting vendor page: ' + error.toString());
            return {
                success: false,
                error: error.toString(),
                message: 'Failed to extract vendor page'
            };
        }
    }

    // Export the functions that NetSuite will call
    return {
        get: get,
        post: post
    };
});
