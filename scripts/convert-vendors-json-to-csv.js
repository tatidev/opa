#!/usr/bin/env node

/**
 * Convert NetSuite Vendors JSON to CSV
 * 
 * Reads the vendor JSON file and converts it to CSV format
 */

const fs = require('fs').promises;
const path = require('path');

async function convertJsonToCsv() {
    try {
        console.log('🔄 Converting vendor JSON to CSV...');
        
        // Read the JSON file
        const jsonPath = path.join(__dirname, '..', 'DOCS', 'NetSuite-Integrations', 'NetSuite-Vendor-Extraction', 'netsuite-vendors-fullData-PROD-template.json');
        const jsonContent = await fs.readFile(jsonPath, 'utf8');
        const data = JSON.parse(jsonContent);
        
        console.log(`📊 Found ${data.vendors.length} vendors to convert`);
        
        // Define CSV headers based on actual fields in the data
        const headers = ['id', 'entityid', 'companyname', 'displayName', 'isinactive', 'subsidiary', 'subsidiaryId'];
        
        // Create CSV content
        let csvContent = headers.join(',') + '\n';
        
        // Add each vendor as a row
        for (const vendor of data.vendors) {
            const row = headers.map(header => {
                let value = vendor[header];
                
                // Handle null/undefined values
                if (value === null || value === undefined) {
                    return '';
                }
                
                // Handle boolean values
                if (typeof value === 'boolean') {
                    return value ? 'true' : 'false';
                }
                
                // Convert to string and escape quotes
                value = String(value);
                
                // If the value contains comma, newline, or quote, wrap in quotes and escape quotes
                if (value.includes(',') || value.includes('\n') || value.includes('"')) {
                    value = '"' + value.replace(/"/g, '""') + '"';
                }
                
                return value;
            }).join(',');
            
            csvContent += row + '\n';
        }
        
        // Write CSV file
        const csvPath = path.join(__dirname, '..', 'DOCS', 'NetSuite-Integrations', 'NetSuite-Vendor-Extraction', 'netsuite-vendors-fullData-PROD-template.csv');
        await fs.writeFile(csvPath, csvContent, 'utf8');
        
        console.log(`✅ CSV file created successfully!`);
        console.log(`📁 Location: ${csvPath}`);
        console.log(`📊 Total rows: ${data.vendors.length + 1} (including header)`);
        
        return csvPath;
        
    } catch (error) {
        console.error('❌ Error converting JSON to CSV:', error.message);
        throw error;
    }
}

// Run if executed directly
if (require.main === module) {
    convertJsonToCsv()
        .then(() => {
            console.log('\n🎉 Conversion completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Conversion failed:', error);
            process.exit(1);
        });
}

module.exports = convertJsonToCsv;

