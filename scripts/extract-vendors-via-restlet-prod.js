#!/usr/bin/env node

/**
 * NetSuite Production Vendor Data Extraction via RESTlet
 * 
 * This script extracts ALL vendor data from the Production NetSuite account
 * using the VendorListRestlet approach since SuiteTalk REST API is not available.
 * 
 * Usage: node scripts/extract-vendors-via-restlet-prod.js
 */

const axios = require('axios');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const dotenv = require('dotenv');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
dotenv.config();

class NetSuiteVendorRestletExtractor {
    constructor() {
        // Validate environment variables - Use production-specific credentials
        const requiredEnvVars = [
            'NETSUITE_CONSUMER_KEY_PROD',
            'NETSUITE_CONSUMER_SECRET_PROD', 
            'NETSUITE_TOKEN_ID_PROD',
            'NETSUITE_TOKEN_SECRET_PROD',
            'NETSUITE_ACCOUNT_ID_PROD',
            'NETSUITE_REALM_PROD'
        ];

        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                throw new Error(`Missing required environment variable: ${envVar}`);
            }
        }

        // Initialize OAuth for NetSuite API calls with PRODUCTION credentials
        this.oauth = OAuth({
            consumer: {
                key: process.env.NETSUITE_CONSUMER_KEY_PROD,
                secret: process.env.NETSUITE_CONSUMER_SECRET_PROD,
            },
            signature_method: 'HMAC-SHA256',
            hash_function(base_string, key) {
                return crypto
                    .createHmac('sha256', key)
                    .update(base_string)
                    .digest('base64');
            },
            realm: process.env.NETSUITE_REALM_PROD,
            parameter_separator: ',',
            encode_rfc3986: function(str) {
                return encodeURIComponent(str)
                    .replace(/!/g, '%21')
                    .replace(/\*/g, '%2A')
                    .replace(/\(/g, '%28')
                    .replace(/\)/g, '%29')
                    .replace(/'/g, '%27');
            }
        });

        this.token = {
            key: process.env.NETSUITE_TOKEN_ID_PROD,
            secret: process.env.NETSUITE_TOKEN_SECRET_PROD,
        };

        // Construct production RESTlet URL for VendorListRestlet
        // Based on the pattern: https://{accountId}.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script={scriptId}&deploy={deployId}
        // Script ID: 1762, Deploy ID: 2 (Opuzen Vendor List RESTlet 2 - Production - Clean version without emojis)
        const accountId = process.env.NETSUITE_ACCOUNT_ID_PROD;
        this.restletUrl = `https://${accountId}.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1762&deploy=2`;
        
        console.log(`🔧 NetSuite Vendor RESTlet Extractor initialized for PRODUCTION account: ${accountId}`);
        console.log(`🌐 RESTlet URL: ${this.restletUrl}`);
    }

    /**
     * Extract all vendors from NetSuite using RESTlet
     * @returns {Promise<Array>} Complete array of vendor data
     */
    async extractAllVendors() {
        try {
            console.log('🔍 Starting vendor extraction from NetSuite PRODUCTION via RESTlet...');
            
            const allVendors = [];
            let startIndex = 0;
            const pageSize = 1000; // Large page size for RESTlet
            let hasMore = true;
            let totalExtracted = 0;

            while (hasMore) {
                console.log(`📄 Extracting vendors ${startIndex + 1} to ${startIndex + pageSize}...`);
                
                const result = await this.extractVendorPage(startIndex, pageSize);
                
                if (result && result.success && result.vendors && result.vendors.length > 0) {
                    allVendors.push(...result.vendors);
                    totalExtracted += result.vendors.length;
                    console.log(`✅ Extracted ${result.vendors.length} vendors (Total: ${totalExtracted})`);
                    
                    // Check if there are more results
                    hasMore = result.hasMore || false;
                    if (hasMore) {
                        startIndex += pageSize;
                        // Add delay to avoid rate limiting
                        await this.delay(1000);
                    }
                } else {
                    console.log('⚠️  No more vendors found or error occurred');
                    hasMore = false;
                }
            }

            console.log(`🎉 Vendor extraction complete! Total vendors extracted: ${allVendors.length}`);
            return allVendors;

        } catch (error) {
            console.error('❌ Error extracting vendors:', error.message);
            if (error.response) {
                console.error(`   Response status: ${error.response.status}`);
                console.error(`   Response data:`, error.response.data);
            }
            throw error;
        }
    }

    /**
     * Extract a page of vendors from NetSuite using RESTlet
     * @param {number} startIndex - Starting index for pagination
     * @param {number} pageSize - Number of vendors to extract
     * @returns {Promise<Object>} RESTlet response with vendor data
     */
    async extractVendorPage(startIndex, pageSize) {
        try {
            // Prepare request body for RESTlet
            const requestBody = {
                startIndex: startIndex,
                pageSize: pageSize
            };

            // Create OAuth headers (matching working NetSuite services)
            const requestData = {
                url: this.restletUrl,
                method: 'POST'
            };

            // Get OAuth data with timestamp and nonce
            const authData = this.oauth.authorize(requestData, this.token);

            // Construct Authorization header manually (matching working services)
            const realm = process.env.NETSUITE_REALM_PROD;
            const consumerKey = process.env.NETSUITE_CONSUMER_KEY_PROD;
            const tokenKey = process.env.NETSUITE_TOKEN_ID_PROD;

            let authHeader = `OAuth realm="${realm}",`;
            authHeader += `oauth_consumer_key="${consumerKey}",`;
            authHeader += `oauth_token="${tokenKey}",`;
            authHeader += `oauth_signature_method="${authData.oauth_signature_method}",`;
            authHeader += `oauth_timestamp="${authData.oauth_timestamp}",`;
            authHeader += `oauth_nonce="${authData.oauth_nonce}",`;
            authHeader += `oauth_version="${authData.oauth_version}",`;
            authHeader += `oauth_signature="${encodeURIComponent(authData.oauth_signature)}"`;

            const response = await axios.post(this.restletUrl, requestBody, {
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });

            if (response.data) {
                return response.data;
            }

            return { success: false, error: 'No response data' };

        } catch (error) {
            console.error(`❌ Error extracting vendor page (start: ${startIndex}):`, error.message);
            if (error.response) {
                console.error(`   Response status: ${error.response.status}`);
                console.error(`   Response data:`, error.response.data);
            }
            throw error;
        }
    }

    /**
     * Save vendor data to JSON file
     * @param {Array} vendors - Array of vendor data
     * @param {string} filename - Output filename
     */
    async saveVendorData(vendors, filename) {
        try {
            const outputPath = path.join(__dirname, '..', 'DOCS', 'NetSuite-Integrations', 'NetSuite-Vendor-Extraction', filename);
            
            // Ensure directory exists
            const dir = path.dirname(outputPath);
            await fs.mkdir(dir, { recursive: true });

            // Create comprehensive vendor data structure
            const vendorData = {
                metadata: {
                    extractedAt: new Date().toISOString(),
                    source: 'NetSuite Production Account',
                    accountId: process.env.NETSUITE_ACCOUNT_ID_PROD,
                    totalVendors: vendors.length,
                    extractionMethod: 'RESTlet (VendorListRestlet)',
                    version: '2.0.0',
                    restletUrl: this.restletUrl,
                    fieldsIncluded: [
                        'id', 'entityid', 'companyname', 'altname', 'displayName',
                        'email', 'phone', 'fax', 'url', 'accountnumber', 'vatregnumber', 'code',
                        'isinactive', 'subsidiary', 'subsidiaryId',
                        'terms', 'termsId', 'currency', 'currencyId',
                        'category', 'categoryId', 'printoncheckas', 'balance', 'comments',
                        'taxidnum', 'taxpayeridnum', 'unbilledorders',
                        'representingsubsidiary', 'representingsubsidiaryId', 'defaultaddress'
                    ]
                },
                summary: {
                    totalVendors: vendors.length,
                    activeVendors: vendors.filter(v => !v.isinactive).length,
                    inactiveVendors: vendors.filter(v => v.isinactive).length,
                    vendorsWithCompanyName: vendors.filter(v => v.companyname).length,
                    vendorsWithEntityId: vendors.filter(v => v.entityid).length,
                    vendorsWithEmail: vendors.filter(v => v.email).length,
                    vendorsWithPhone: vendors.filter(v => v.phone).length,
                    vendorsWithTerms: vendors.filter(v => v.terms).length,
                    vendorsWithAccountNumber: vendors.filter(v => v.accountnumber).length,
                    vendorsWithCode: vendors.filter(v => v.code).length
                },
                vendors: vendors
            };

            await fs.writeFile(outputPath, JSON.stringify(vendorData, null, 2), 'utf8');
            console.log(`💾 Vendor data saved to: ${outputPath}`);
            console.log(`📊 Summary: ${vendorData.summary.totalVendors} total vendors`);
            console.log(`   - Active: ${vendorData.summary.activeVendors}, Inactive: ${vendorData.summary.inactiveVendors}`);
            console.log(`   - With Email: ${vendorData.summary.vendorsWithEmail}`);
            console.log(`   - With Phone: ${vendorData.summary.vendorsWithPhone}`);
            console.log(`   - With Terms: ${vendorData.summary.vendorsWithTerms}`);
            console.log(`   - With Account Number: ${vendorData.summary.vendorsWithAccountNumber}`);
            console.log(`   - With Code: ${vendorData.summary.vendorsWithCode}`);
            
            return outputPath;

        } catch (error) {
            console.error('❌ Error saving vendor data:', error.message);
            throw error;
        }
    }

    /**
     * Utility function to add delay
     * @param {number} ms - Milliseconds to delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Test RESTlet connection
     * @returns {Promise<boolean>} True if connection successful
     */
    async testConnection() {
        try {
            console.log('🧪 Testing RESTlet connection...');
            
            // Try a small page first
            const result = await this.extractVendorPage(0, 1);
            
            if (result && result.success) {
                console.log('✅ RESTlet connection successful!');
                return true;
            } else {
                console.log('❌ RESTlet connection failed:', result?.error || 'Unknown error');
                return false;
            }
            
        } catch (error) {
            console.error('❌ RESTlet connection test failed:', error.message);
            return false;
        }
    }

    /**
     * Main extraction process
     */
    async run() {
        try {
            console.log('🚀 Starting NetSuite Production Vendor Extraction via RESTlet...');
            console.log('=' .repeat(60));
            
            // Test connection first
            const connectionOk = await this.testConnection();
            if (!connectionOk) {
                throw new Error('RESTlet connection test failed. Please check if VendorListRestlet is deployed to production.');
            }
            
            // Extract all vendors
            const allVendors = await this.extractAllVendors();
            
            console.log(`📋 Extracted ${allVendors.length} total active vendors from NetSuite`);
            
            // Filter for "Fabric Supplier" category only
            const fabricSupplierVendors = allVendors.filter(vendor => 
                vendor.category === 'Fabric Supplier'
            );
            
            console.log(`🔍 Filtered to ${fabricSupplierVendors.length} Fabric Supplier vendors`);
            console.log(`   (Excluded ${allVendors.length - fabricSupplierVendors.length} vendors with other categories)`);
            
            // Use fixed filename as specified
            const filename = 'netsuite-vendors-fullData-PROD-template.json';
            
            // Save vendor data (Fabric Suppliers only)
            const outputPath = await this.saveVendorData(fabricSupplierVendors, filename);
            
            console.log('=' .repeat(60));
            console.log('✅ NetSuite Production Vendor Extraction Complete!');
            console.log(`📁 Output file: ${outputPath}`);
            console.log(`📊 Total vendors extracted: ${allVendors.length}`);
            console.log(`📊 Fabric Supplier vendors saved: ${fabricSupplierVendors.length}`);
            
            return {
                success: true,
                outputPath,
                totalVendors: fabricSupplierVendors.length,
                vendors: fabricSupplierVendors
            };

        } catch (error) {
            console.error('❌ Extraction failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Run the extraction if this script is executed directly
if (require.main === module) {
    const extractor = new NetSuiteVendorRestletExtractor();
    extractor.run()
        .then(result => {
            if (result.success) {
                console.log('\n🎉 SUCCESS: Vendor extraction completed successfully!');
                process.exit(0);
            } else {
                console.log('\n❌ FAILED: Vendor extraction failed!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('\n💥 UNEXPECTED ERROR:', error);
            process.exit(1);
        });
}

module.exports = NetSuiteVendorRestletExtractor;

