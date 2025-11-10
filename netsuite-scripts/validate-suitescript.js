/**
 * Basic SuiteScript 2.1 Validation Tool
 * Checks for common syntax and compliance issues
 */

const fs = require('fs');
const path = require('path');

function validateSuiteScript(filePath) {
    console.log('🔍 Validating SuiteScript file:', filePath);
    
    if (!fs.existsSync(filePath)) {
        console.error('❌ File not found:', filePath);
        return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let issues = [];
    let passes = [];
    
    // Check 1: Required headers
    const hasApiVersion = content.includes('@NApiVersion 2.1');
    const hasScriptType = content.includes('@NScriptType Restlet');
    const hasModuleScope = content.includes('@NModuleScope');
    
    if (!hasApiVersion) issues.push('❌ Missing @NApiVersion 2.1');
    else passes.push('✅ @NApiVersion 2.1 found');
    
    if (!hasScriptType) issues.push('❌ Missing @NScriptType Restlet');
    else passes.push('✅ @NScriptType Restlet found');
    
    if (!hasModuleScope) issues.push('❌ Missing @NModuleScope');
    else passes.push('✅ @NModuleScope found');
    
    // Check 2: AMD pattern
    const hasDefine = content.includes('define([');
    const hasReturn = content.includes('return {');
    
    if (!hasDefine) issues.push('❌ Missing define() AMD pattern');
    else passes.push('✅ AMD define() pattern found');
    
    if (!hasReturn) issues.push('❌ Missing return statement for exports');
    else passes.push('✅ Module exports return found');
    
    // Check 3: NetSuite modules
    const modulePattern = /define\(\[(.*?)\]/;
    const moduleMatch = content.match(modulePattern);
    if (moduleMatch) {
        const modules = moduleMatch[1].split(',').map(m => m.trim().replace(/'/g, ''));
        const validModules = modules.every(module => 
            module.startsWith('N/') || module === ''
        );
        
        if (!validModules) {
            issues.push('❌ Invalid NetSuite module imports');
        } else {
            passes.push('✅ Valid NetSuite module imports');
        }
    }
    
    // Check 4: Function exports
    const requiredFunctions = ['get', 'post', 'put', 'delete'];
    const exportMatch = content.match(/return\s*\{([^}]+)\}/s);
    
    if (exportMatch) {
        const exports = exportMatch[1];
        requiredFunctions.forEach(func => {
            if (exports.includes(func)) {
                passes.push(`✅ ${func.toUpperCase()} handler exported`);
            } else {
                issues.push(`⚠️  ${func.toUpperCase()} handler not exported (optional)`);
            }
        });
    }
    
    // Check 5: Error handling
    const hasTryCatch = content.includes('try {') && content.includes('catch');
    if (!hasTryCatch) issues.push('⚠️  No try/catch error handling found');
    else passes.push('✅ Error handling (try/catch) found');
    
    // Check 6: Logging
    const hasLogging = content.includes('log.debug') || content.includes('log.audit') || content.includes('log.error');
    if (!hasLogging) issues.push('⚠️  No logging statements found');
    else passes.push('✅ Logging statements found');
    
    // Results
    console.log('\n📊 Validation Results:');
    console.log('='.repeat(50));
    
    passes.forEach(pass => console.log(pass));
    issues.forEach(issue => console.log(issue));
    
    const warningCount = issues.filter(i => i.startsWith('⚠️')).length;
    const errorCount = issues.filter(i => i.startsWith('❌')).length;
    
    console.log('\n📈 Summary:');
    console.log(`✅ Passes: ${passes.length}`);
    console.log(`⚠️  Warnings: ${warningCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    if (errorCount === 0) {
        console.log('\n🎉 SuiteScript validation passed! Ready for NetSuite deployment.');
        return true;
    } else {
        console.log('\n❌ SuiteScript validation failed. Fix errors before deployment.');
        return false;
    }
}

// Run validation if called directly
if (require.main === module) {
    const scriptPath = process.argv[2] || 'netsuite-scripts/CreateInventoryItemRestlet.js';
    validateSuiteScript(scriptPath);
}

module.exports = { validateSuiteScript }; 