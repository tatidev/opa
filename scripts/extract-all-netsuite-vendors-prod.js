#!/usr/bin/env node

/**
 * NetSuite Production Vendor Data Extraction Script
 * 
 * This script extracts ALL vendor data from the Production NetSuite account
 * and saves it as a JSON array for analysis and integration purposes.
 * 
 * Usage: node scripts/extract-all-netsuite-vendors-prod.js
 */

const axios = require('axios');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const dotenv = require('dotenv');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
dotenv.config();

class NetSuiteVendorExtractor {
    constructor() {
        // Validate environment variables
        const requiredEnvVars = [
            'NETSUITE_CONSUMER_KEY',
            'NETSUITE_CONSUMER_SECRET', 
            'NETSUITE_TOKEN_ID',
            'NETSUITE_TOKEN_SECRET',
            'NETSUITE_ACCOUNT_ID_PROD'
        ];

        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                throw new Error(`Missing required environment variable: ${envVar}`);
            }
        }

        // Initialize OAuth for NetSuite API calls
        this.oauth = OAuth({
            consumer: {
                key: process.env.NETSUITE_CONSUMER_KEY,
                secret: process.env.NETSUITE_CONSUMER_SECRET,
            },
            signature_method: 'HMAC-SHA256',
            hash_function(base_string, key) {
                return crypto
                    .createHmac('sha256', key)
                    .update(base_string)
                    .digest('base64');
            },
        });

        this.token = {
            key: process.env.NETSUITE_TOKEN_ID,
            secret: process.env.NETSUITE_TOKEN_SECRET,
        };

        // Use PRODUCTION NetSuite account - SuiteTalk REST API
        const accountId = process.env.NETSUITE_ACCOUNT_ID_PROD.replace('_', '-').toLowerCase();
        this.baseUrl = `https://${accountId}.suitetalk.api.netsuite.com/rest/platform/v1`;
        
        console.log(`🔧 NetSuite Vendor Extractor initialized for PRODUCTION account: ${process.env.NETSUITE_ACCOUNT_ID_PROD}`);
        console.log(`🌐 Base URL: ${this.baseUrl}`);
    }

    /**
     * Extract all vendors from NetSuite using REST API
     * @returns {Promise<Array>} Complete array of vendor data
     */
    async extractAllVendors() {
        try {
            console.log('🔍 Starting vendor extraction from NetSuite PRODUCTION...');
            
            const allVendors = [];
            let startIndex = 0;
            const pageSize = 1000; // NetSuite REST API limit
            let hasMore = true;
            let totalExtracted = 0;

            while (hasMore) {
                console.log(`📄 Extracting vendors ${startIndex + 1} to ${startIndex + pageSize}...`);
                
                const vendors = await this.extractVendorPage(startIndex, pageSize);
                
                if (vendors && vendors.length > 0) {
                    allVendors.push(...vendors);
                    totalExtracted += vendors.length;
                    console.log(`✅ Extracted ${vendors.length} vendors (Total: ${totalExtracted})`);
                    
                    // Check if we got fewer results than requested (end of data)
                    if (vendors.length < pageSize) {
                        hasMore = false;
                    } else {
                        startIndex += pageSize;
                        // Add delay to avoid rate limiting
                        await this.delay(1000);
                    }
                } else {
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
     * Extract a page of vendors from NetSuite using SuiteTalk REST API search
     * @param {number} startIndex - Starting index for pagination
     * @param {number} pageSize - Number of vendors to extract
     * @returns {Promise<Array>} Array of vendor data for this page
     */
    async extractVendorPage(startIndex, pageSize) {
        try {
            // Use NetSuite SuiteTalk REST API search endpoint
            const searchUrl = `${this.baseUrl}/record/vendor`;
            const searchParams = {
                q: '*', // Search for all vendors
                limit: pageSize,
                offset: startIndex
            };

            // Create OAuth headers
            const requestData = {
                url: searchUrl,
                method: 'GET',
                data: searchParams
            };

            const authHeader = this.oauth.toHeader(this.oauth.authorize(requestData, this.token));

            const response = await axios.get(searchUrl, {
                params: searchParams,
                headers: {
                    ...authHeader,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });

            if (response.data && response.data.items) {
                return response.data.items.map(vendor => this.formatVendorData(vendor));
            }

            return [];

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
     * Format vendor data for consistent structure
     * @param {Object} vendor - Raw vendor data from NetSuite
     * @returns {Object} Formatted vendor data
     */
    formatVendorData(vendor) {
        return {
            id: vendor.id,
            entityid: vendor.entityid || null,
            companyname: vendor.companyname || null,
            displayName: vendor.companyname || vendor.entityid || `Vendor ${vendor.id}`,
            isinactive: vendor.isinactive || false,
            subsidiary: vendor.subsidiary || null,
            currency: vendor.currency || null,
            terms: vendor.terms || null,
            creditlimit: vendor.creditlimit || null,
            balance: vendor.balance || null,
            unbilledorders: vendor.unbilledorders || null,
            lastmodifieddate: vendor.lastmodifieddate || null,
            datecreated: vendor.datecreated || null,
            // Additional computed fields
            isActive: !vendor.isinactive,
            hasCompanyName: !!vendor.companyname,
            hasEntityId: !!vendor.entityid,
            extractedAt: new Date().toISOString()
        };
    }

    /**
     * Save vendor data to JSON file
     * @param {Array} vendors - Array of vendor data
     * @param {string} filename - Output filename
     */
    async saveVendorData(vendors, filename) {
        try {
            const outputPath = path.join(__dirname, '..', 'DOCS', 'ai-specs', filename);
            
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
                    extractionMethod: 'REST API',
                    version: '1.0.0'
                },
                summary: {
                    totalVendors: vendors.length,
                    activeVendors: vendors.filter(v => v.isActive).length,
                    inactiveVendors: vendors.filter(v => !v.isActive).length,
                    vendorsWithCompanyName: vendors.filter(v => v.hasCompanyName).length,
                    vendorsWithEntityId: vendors.filter(v => v.hasEntityId).length
                },
                vendors: vendors
            };

            await fs.writeFile(outputPath, JSON.stringify(vendorData, null, 2), 'utf8');
            console.log(`💾 Vendor data saved to: ${outputPath}`);
            console.log(`📊 Summary: ${vendorData.summary.totalVendors} total vendors (${vendorData.summary.activeVendors} active, ${vendorData.summary.inactiveVendors} inactive)`);
            
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
     * Main extraction process
     */
    async run() {
        try {
            console.log('🚀 Starting NetSuite Production Vendor Extraction...');
            console.log('=' .repeat(60));
            
            // Extract all vendors
            const vendors = await this.extractAllVendors();
            
            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const filename = `netsuite-vendors-PROD-${timestamp}.json`;
            
            // Save vendor data
            const outputPath = await this.saveVendorData(vendors, filename);
            
            console.log('=' .repeat(60));
            console.log('✅ NetSuite Production Vendor Extraction Complete!');
            console.log(`📁 Output file: ${outputPath}`);
            console.log(`📊 Total vendors extracted: ${vendors.length}`);
            
            return {
                success: true,
                outputPath,
                totalVendors: vendors.length,
                vendors
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
    const extractor = new NetSuiteVendorExtractor();
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

module.exports = NetSuiteVendorExtractor;
