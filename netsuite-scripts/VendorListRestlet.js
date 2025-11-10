/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 * 
 * Vendor List RESTlet
 * Extracts all vendors from NetSuite - Using ONLY proven working fields
 */

define(['N/search', 'N/log'], function(search, log) {
    
    /**
     * Get vendor search columns - ONLY fields proven to work in production
     * @returns {Array} Array of search column field IDs
     */
    function getVendorSearchColumns() {
        return [
            'internalid',
            'entityid',
            'companyname',
            'isinactive',
            'subsidiary',
            'category'
        ];
    }
    
    /**
     * Build vendor data object from search result
     * @param {Object} vendor - Search result object
     * @returns {Object} Vendor data object
     */
    function buildVendorData(vendor) {
        return {
            id: vendor.getValue('internalid'),
            entityid: vendor.getValue('entityid'),
            companyname: vendor.getValue('companyname'),
            displayName: vendor.getValue('companyname') || vendor.getValue('entityid') || 'Vendor ' + vendor.getValue('internalid'),
            isinactive: vendor.getValue('isinactive'),
            subsidiary: vendor.getText('subsidiary') || null,
            subsidiaryId: vendor.getValue('subsidiary') || null,
            category: vendor.getText('category') || null,
            categoryId: vendor.getValue('category') || null
        };
    }
    
    /**
     * GET handler - Extract all active vendors
     * @returns {Object} Complete vendor list (category must be filtered via saved search or by ID)
     */
    function get() {
        log.debug('VendorListRestlet', 'EXTRACTING ACTIVE VENDORS FROM NETSUITE');
        
        try {
            var vendors = [];
            var vendorSearch = search.create({
                type: search.Type.VENDOR,
                filters: [
                    ['isinactive', 'is', 'F'] // Only active vendors
                    // NOTE: Category text filter not supported in SuiteScript 2.1
                    // To filter by category, create a saved search with category criteria
                ],
                columns: getVendorSearchColumns()
            });

            var searchResult = vendorSearch.run();
            var resultRange = searchResult.getRange({
                start: 0,
                end: 1000 // Get first 1000 vendors
            });

            log.debug('VendorListRestlet', 'Found ' + resultRange.length + ' active vendors');

            for (var i = 0; i < resultRange.length; i++) {
                var vendor = resultRange[i];
                vendors.push(buildVendorData(vendor));
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

            log.audit('VendorListRestlet', 'Successfully extracted ' + vendors.length + ' active vendors');

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
     * POST handler - Extract active vendors with pagination
     * @param {Object} requestBody - Request with pagination parameters
     * @returns {Object} Paginated vendor list
     */
    function post(requestBody) {
        log.debug('VendorListRestlet', 'EXTRACTING ACTIVE VENDORS WITH PAGINATION');
        log.debug('VendorListRestlet', 'Request: ' + JSON.stringify(requestBody));
        
        try {
            var startIndex = requestBody.startIndex || 0;
            var pageSize = Math.min(requestBody.pageSize || 1000, 1000); // Max 1000 per request
            
            var vendors = [];
            var vendorSearch = search.create({
                type: search.Type.VENDOR,
                filters: [
                    ['isinactive', 'is', 'F'] // Only active vendors
                    // NOTE: Category text filter not supported in SuiteScript 2.1
                    // To filter by category, create a saved search with category criteria
                ],
                columns: getVendorSearchColumns()
            });

            var searchResult = vendorSearch.run();
            var resultRange = searchResult.getRange({
                start: startIndex,
                end: startIndex + pageSize
            });

            log.debug('VendorListRestlet', 'Retrieved ' + resultRange.length + ' active vendors (start: ' + startIndex + ')');

            for (var i = 0; i < resultRange.length; i++) {
                var vendor = resultRange[i];
                vendors.push(buildVendorData(vendor));
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

            log.audit('VendorListRestlet', 'Successfully extracted ' + vendors.length + ' active vendors (page)');

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
