/**
 * OPMS Data Transformation Service
 * Transforms OPMS Product/Item data to NetSuite inventory item format
 * 
 * Implements complete field mapping from OPMS-Fields-for-NetSuite-Item.md specification
 * with " - " validation pattern for all 25+ fields (blank/null/empty become " - ")
 * 
 * BUSINESS RULE: Only items with valid item codes are synced to NetSuite.
 * Items without codes are intentionally blocked from sync.
 */

const logger = require('../utils/logger');
const BaseModel = require('../models/BaseModel');

class OpmsDataTransformService extends BaseModel {
    constructor() {
        super();
    }

    /**
     * Transform OPMS item data to NetSuite format
     * @param {number} itemId - OPMS Item ID
     * @returns {Promise<Object>} - NetSuite payload
     */
    async transformItemForNetSuite(itemId) {
        try {
            logger.info('Starting data transformation for item', { itemId });

            // Step 1: Extract all OPMS data using master query
            const opmsData = await this.extractOpmsItemData(itemId);

            // Step 1b: Extract pricing data from OPMS (for NetSuite cascade sync)
            // DISABLED: NetSuite is source of truth for pricing - do not send OPMS pricing to NetSuite
            // const pricingData = await this.extractPricingData(opmsData.product_id, opmsData.product_type || 'R');
            // opmsData.pricing = pricingData;
            // 
            // logger.info('💰 Pricing data extracted from OPMS', {
            //     itemId: itemId,
            //     productId: opmsData.product_id,
            //     pricing: pricingData
            // });

            // Step 1c: Extract origin data for sales description
            const originData = await this.extractOriginData(opmsData.product_id);
            opmsData.origin = originData;
            
            logger.info('🌍 Origin data extracted from OPMS', {
                itemId: itemId,
                productId: opmsData.product_id,
                origin: originData
            });

            // Step 1d: Compose purchase and sales descriptions
            // FIXED: Remove pricingData parameter since pricing extraction is disabled
            opmsData.purchaseDescription = this.composePurchaseDescription(opmsData, null);
            opmsData.salesDescription = this.composeSalesDescription(opmsData, originData);
            
            logger.info('📝 Descriptions composed', {
                itemId: itemId,
                purchaseDescLength: opmsData.purchaseDescription?.length || 0,
                salesDescLength: opmsData.salesDescription?.length || 0
            });

            // Step 2: Validate each field (blank/null/empty become " - ")
            const validatedData = await this.validateAllFields(opmsData);

            // Step 3: Transform to NetSuite payload format
            const netsuitePayload = await this.buildNetSuitePayload(validatedData);

            logger.info('Data transformation completed successfully', {
                itemId: itemId,
                itemCode: opmsData.item_code,
                productName: opmsData.product_name,
                fieldCount: Object.keys(netsuitePayload).length
            });

            return netsuitePayload;
        } catch (error) {
            logger.error('Data transformation failed', {
                error: error.message,
                itemId: itemId
            });
            throw error;
        }
    }

    /**
     * Extract complete OPMS item data using master query
     * @param {number} itemId - Item ID
     * @returns {Promise<Object>} - Complete OPMS data
     */
    async extractOpmsItemData(itemId) {
        try {
            // Master data extraction query from specification
            const masterQuery = `
                SELECT DISTINCT
                    -- Core identifiers
                    i.id as item_id,
                    i.code as item_code,
                    p.id as product_id,
                    p.name as product_name,
                    
                    -- Dimensions
                    p.width,
                    p.vrepeat,
                    p.hrepeat,
                    
                    -- Vendor information
                    v.id as vendor_id,
                    v.name as vendor_name,
                    m.netsuite_vendor_id,
                    i.vendor_code,
                    i.vendor_color,
                    pvar.vendor_product_name,
                    
                    -- Colors (comma-separated)
                    GROUP_CONCAT(DISTINCT c.name ORDER BY ic.n_order SEPARATOR ', ') as color_name,
                    
                    -- Compliance fields
                    pvar.prop_65,
                    pvar.ab_2998_compliant,
                    pvar.tariff_code,
                    
                    -- Multi-select fields (comma-separated)
                    GROUP_CONCAT(DISTINCT pf.name ORDER BY pf.name SEPARATOR ', ') as finish_names,
                    GROUP_CONCAT(DISTINCT pcl.name ORDER BY pcl.name SEPARATOR ', ') as cleaning_names,
                    GROUP_CONCAT(DISTINCT po.name ORDER BY po.name SEPARATOR ', ') as origin_names,
                    GROUP_CONCAT(DISTINCT pu.name ORDER BY pu.name SEPARATOR ', ') as use_names

                FROM T_ITEM i
                JOIN T_PRODUCT p ON i.product_id = p.id
                LEFT JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
                LEFT JOIN Z_VENDOR v ON pv.vendor_id = v.id
                LEFT JOIN opms_netsuite_vendor_mapping m ON v.id = m.opms_vendor_id

                -- Core relationships
                LEFT JOIN T_PRODUCT_VARIOUS pvar ON p.id = pvar.product_id
                LEFT JOIN T_ITEM_COLOR ic ON i.id = ic.item_id
                LEFT JOIN P_COLOR c ON ic.color_id = c.id

                -- Multi-select relationships
                LEFT JOIN T_PRODUCT_FINISH tpf ON p.id = tpf.product_id
                LEFT JOIN P_FINISH pf ON tpf.finish_id = pf.id
                LEFT JOIN T_PRODUCT_CLEANING tpcl ON p.id = tpcl.product_id  
                LEFT JOIN P_CLEANING pcl ON tpcl.cleaning_id = pcl.id
                LEFT JOIN T_PRODUCT_ORIGIN tpo ON p.id = tpo.product_id
                LEFT JOIN P_ORIGIN po ON tpo.origin_id = po.id
                LEFT JOIN T_PRODUCT_USE tpu ON p.id = tpu.product_id
                LEFT JOIN P_USE pu ON tpu.use_id = pu.id

                WHERE i.id = ?
                  AND i.code IS NOT NULL           -- INTENTIONAL: Only sync items with valid codes
                  AND i.code != ''                 -- INTENTIONAL: Exclude empty codes  
                  AND p.name IS NOT NULL
                  AND i.archived = 'N'
                  AND p.archived = 'N'
                  -- Filter active vendors only when they exist, allow NULL vendors
                  AND (v.id IS NULL OR (v.active = 'Y' AND v.archived = 'N'))
                  AND (m.id IS NULL OR m.opms_vendor_name = m.netsuite_vendor_name)

                GROUP BY i.id, i.code, p.id, p.name, p.width, p.vrepeat, p.hrepeat, 
                         v.id, v.name, m.netsuite_vendor_id, i.vendor_code, i.vendor_color, 
                         pvar.vendor_product_name, pvar.prop_65, pvar.ab_2998_compliant, pvar.tariff_code

                HAVING color_name IS NOT NULL
            `;

            const [results] = await this.db.query(masterQuery, [itemId]);
            const masterData = results[0];

            if (!masterData) {
                // Provide detailed explanation of why item is not syncable
                const diagnosticQuery = `
                    SELECT 
                        i.id,
                        i.code,
                        i.archived as item_archived,
                        p.name as product_name,
                        p.archived as product_archived,
                        CASE WHEN i.code IS NULL OR i.code = '' THEN 'No item code (intentionally blocked)' ELSE 'OK' END as code_status,
                        CASE WHEN p.name IS NULL OR p.name = '' THEN 'Missing product name' ELSE 'OK' END as name_status,
                        CASE WHEN i.archived = 'Y' THEN 'Item archived' ELSE 'OK' END as item_status,
                        CASE WHEN p.archived = 'Y' THEN 'Product archived' ELSE 'OK' END as product_status,
                        (SELECT COUNT(*) FROM T_ITEM_COLOR ic WHERE ic.item_id = i.id) as color_count
                    FROM T_ITEM i 
                    LEFT JOIN T_PRODUCT p ON i.product_id = p.id 
                    WHERE i.id = ?
                `;
                
                const [diagnosticResults] = await this.db.query(diagnosticQuery, [itemId]);
                const diagnostic = diagnosticResults[0];
                
                if (!diagnostic) {
                    throw new Error(`Item ${itemId} not found in database`);
                }
                
                const issues = [];
                if (diagnostic.code_status !== 'OK') issues.push(diagnostic.code_status);
                if (diagnostic.name_status !== 'OK') issues.push(diagnostic.name_status);
                if (diagnostic.item_status !== 'OK') issues.push(diagnostic.item_status);
                if (diagnostic.product_status !== 'OK') issues.push(diagnostic.product_status);
                if (diagnostic.color_count === 0) issues.push('No colors assigned');
                
                const detailedError = `Item ${itemId} not syncable. Issues: ${issues.join(', ')}. ` +
                    `Current state: code="${diagnostic.code}", product="${diagnostic.product_name}", ` +
                    `colors=${diagnostic.color_count}, item_archived=${diagnostic.item_archived}, ` +
                    `product_archived=${diagnostic.product_archived}`;
                
                throw new Error(detailedError);
            }

            // Step 2: Get mini-forms content (separate queries)
            const miniFormsData = await this.getMiniFormsData(masterData.product_id);

            return { ...masterData, ...miniFormsData };
        } catch (error) {
            logger.error('Failed to extract OPMS item data', {
                error: error.message,
                itemId: itemId
            });
            throw error;
        }
    }

    /**
     * Get mini-forms content data (text format)
     * @param {number} productId - Product ID
     * @returns {Promise<Object>} - Mini-forms data
     */
    async getMiniFormsData(productId) {
        try {
            // Front Content Query (Text Format)
            const frontContentQuery = `
                SELECT GROUP_CONCAT(
                    CONCAT(pcf.perc, '% ', pc.name) 
                    ORDER BY pcf.perc DESC 
                    SEPARATOR ', '
                ) as front_content_text
                FROM T_PRODUCT_CONTENT_FRONT pcf
                JOIN P_CONTENT pc ON pcf.content_id = pc.id
                WHERE pcf.product_id = ?
            `;

            // Back Content Query (Text Format)
            const backContentQuery = `
                SELECT GROUP_CONCAT(
                    CONCAT(pcb.perc, '% ', pc.name) 
                    ORDER BY pcb.perc DESC 
                    SEPARATOR ', '
                ) as back_content_text
                FROM T_PRODUCT_CONTENT_BACK pcb
                JOIN P_CONTENT pc ON pcb.content_id = pc.id
                WHERE pcb.product_id = ?
            `;

            // Abrasion Tests Query (Text Format)
            const abrasionQuery = `
                SELECT GROUP_CONCAT(
                    CONCAT(pat.name, ': ', pa.n_rubs, ' rubs (', pal.name, ')') 
                    ORDER BY pat.name 
                    SEPARATOR ', '
                ) as abrasion_text
                FROM T_PRODUCT_ABRASION pa
                JOIN P_ABRASION_TEST pat ON pa.abrasion_test_id = pat.id
                JOIN P_ABRASION_LIMIT pal ON pa.abrasion_limit_id = pal.id
                WHERE pa.product_id = ? AND pa.visible = 'Y'
            `;

            // Fire Codes Query (Text Format)
            const firecodesQuery = `
                SELECT GROUP_CONCAT(
                    pft.name 
                    ORDER BY pft.name 
                    SEPARATOR ', '
                ) as firecodes_text
                FROM T_PRODUCT_FIRECODE pf
                JOIN P_FIRECODE_TEST pft ON pf.firecode_test_id = pft.id
                WHERE pf.product_id = ? AND pf.visible = 'Y'
            `;

            // Execute all mini-forms queries in parallel
            const [
                [frontContent],
                [backContent],
                [abrasion],
                [firecodes]
            ] = await Promise.all([
                this.db.query(frontContentQuery, [productId]),
                this.db.query(backContentQuery, [productId]),
                this.db.query(abrasionQuery, [productId]),
                this.db.query(firecodesQuery, [productId])
            ]);

            // Access first row of each result set
            const frontRow = frontContent && frontContent.length > 0 ? frontContent[0] : null;
            const backRow = backContent && backContent.length > 0 ? backContent[0] : null;
            const abrasionRow = abrasion && abrasion.length > 0 ? abrasion[0] : null;
            const firecodesRow = firecodes && firecodes.length > 0 ? firecodes[0] : null;

            return {
                front_content_text: frontRow?.front_content_text || null,
                back_content_text: backRow?.back_content_text || null,
                abrasion_text: abrasionRow?.abrasion_text || null,
                firecodes_text: firecodesRow?.firecodes_text || null
            };
        } catch (error) {
            logger.error('Failed to get mini-forms data', {
                error: error.message,
                productId: productId
            });
            throw error;
        }
    }

    /**
     * Validate all fields (blank/null/empty become " - ")
     * @param {Object} opmsData - Raw OPMS data
     * @returns {Promise<Object>} - Validated data with field status
     */
    async validateAllFields(opmsData) {
        try {
            const validatedFields = {};

            // All fields requiring validation from specification
            const fieldsToValidate = [
                // Core fields
                'item_code', 'product_name', 'color_name',
                
                // Dimensional fields
                'width', 'vrepeat', 'hrepeat',
                
                // Vendor fields
                'vendor_name', 'vendor_code', 'vendor_color', 'vendor_product_name',
                
                // Compliance fields
                'prop_65', 'ab_2998_compliant', 'tariff_code',
                
                // Multi-select fields
                'finish_names', 'cleaning_names', 'origin_names', 'use_names',
                
                // Mini-forms fields
                'front_content_text', 'back_content_text', 'abrasion_text', 'firecodes_text'
            ];

            for (const fieldName of fieldsToValidate) {
                const validationStatus = this.validateOpmsField(fieldName, opmsData[fieldName]);
                validatedFields[fieldName] = {
                    value: opmsData[fieldName],
                    status: validationStatus,
                    netsuiteValue: this.getNetSuiteValue(
                        opmsData[fieldName], 
                        validationStatus, 
                        fieldName, 
                        opmsData.item_id
                    )
                };
            }

            // Track validation results for monitoring
            const validationSummary = {
                total_fields: fieldsToValidate.length,
                has_data: 0,
                src_empty_data: 0,
                query_failed: 0
            };

            Object.values(validatedFields).forEach(field => {
                validationSummary[field.status]++;
            });

            logger.debug('Field validation completed', {
                itemId: opmsData.item_id,
                validationSummary: validationSummary
            });

            return { 
                ...opmsData, 
                validatedFields,
                validationSummary
            };
        } catch (error) {
            logger.error('Field validation failed', {
                error: error.message,
                itemId: opmsData.item_id
            });
            throw error;
        }
    }

    /**
     * Validate individual OPMS field (blank/null/empty become " - ")
     * @param {string} fieldName - Field name
     * @param {*} fieldData - Field data
     * @returns {string} - Validation status
     */
    validateOpmsField(fieldName, fieldData) {
        if (fieldData === undefined) {
            logger.debug(`OPMS field '${fieldName}' is undefined - treating as empty`);
            return 'query_failed';
        } else if (fieldData === null || 
                   fieldData === '' || 
                   (typeof fieldData === 'string' && fieldData.trim() === '') ||
                   (Array.isArray(fieldData) && fieldData.length === 0)) {
            logger.debug(`OPMS field '${fieldName}': empty data`);
            return 'src_empty_data';
        } else {
            return 'has_data';
        }
    }

    /**
     * Get NetSuite value based on validation status
     * @param {*} fieldData - Original field data
     * @param {string} validationStatus - Validation result
     * @param {string} fieldName - Field name for logging
     * @param {number} itemId - Item ID for logging
     * @returns {*} - NetSuite-ready value
     */
    getNetSuiteValue(fieldData, validationStatus, fieldName, itemId) {
        if (validationStatus === 'src_empty_data') {
            return ' - ';  // Shows as dash in NetSuite UI for empty OPMS fields
        } else if (validationStatus === 'query_failed') {
            logger.debug(`OPMS field '${fieldName}' query failed for item ${itemId} - returning ' - '`);
            return ' - ';  // Show as dash in NetSuite UI
        } else {
            return fieldData;  // Shows actual OPMS data
        }
    }

    /**
     * Build complete NetSuite payload
     * @param {Object} validatedData - Validated OPMS data
     * @returns {Promise<Object>} - NetSuite RESTlet payload
     */
    async buildNetSuitePayload(validatedData) {
        try {
            const vf = validatedData.validatedFields;

            // Build complete NetSuite payload with all 25+ fields
            // Note: OPMS sync always uses clean itemIds without prefixes for data integrity
            
            const payload = {
                // ============================================================================
                // CORE IDENTITY FIELDS
                // ============================================================================
                itemId: vf.item_code.netsuiteValue,  // FIXED: Use camelCase to match RESTlet expectation
                custitem_opms_item_id: validatedData.item_id,
                custitem_opms_prod_id: validatedData.product_id,
                displayname: `${vf.product_name.netsuiteValue}: ${vf.color_name.netsuiteValue}`,
                custitem_opms_parent_product_name: vf.product_name.netsuiteValue,

                // ============================================================================
                // DIMENSIONAL FIELDS
                // ============================================================================
                fabricWidth: vf.width.netsuiteValue,  // RESTlet expects fabricWidth, not custitem_opms_fabric_width
                custitem_vertical_repeat: vf.vrepeat.netsuiteValue,
                custitem_horizontal_repeat: vf.hrepeat.netsuiteValue,
                custitem_opms_is_repeat: !(validatedData.vrepeat === null && validatedData.hrepeat === null),

                // ============================================================================
                // VENDOR RELATIONSHIP FIELDS
                // ============================================================================
                vendor: validatedData.netsuite_vendor_id ? parseInt(validatedData.netsuite_vendor_id) : null,
                vendorcode: vf.vendor_code.netsuiteValue,
                vendorName: vf.vendor_name.netsuiteValue,
                custitem_opms_vendor_prod_name: vf.vendor_product_name.netsuiteValue,
                custitem_opms_vendor_color: vf.vendor_color.netsuiteValue,

                // ============================================================================
                // COLOR & MULTI-SELECT FIELDS
                // ============================================================================
                custitem_opms_item_colors: vf.color_name.netsuiteValue,
                finish: vf.finish_names.netsuiteValue,              // RESTlet expects finish, not custitem_opms_finish
                cleaning: vf.cleaning_names.netsuiteValue,          // RESTlet expects cleaning, not custitem_opms_fabric_cleaning
                origin: vf.origin_names.netsuiteValue,              // RESTlet expects origin, not custitem_opms_product_origin
                custitem_item_application: vf.use_names.netsuiteValue,

                // ============================================================================
                // COMPLIANCE FIELDS
                // ============================================================================
                custitem_prop65_compliance: this.transformComplianceField(validatedData.prop_65),
                custitem_ab2998_compliance: this.transformComplianceField(validatedData.ab_2998_compliant),
                custitem_tariff_harmonized_code: vf.tariff_code.netsuiteValue,

                // ============================================================================
                // MINI-FORMS CONTENT FIELDS (TEXT FORMAT)
                // ============================================================================
                custitem_opms_front_content: vf.front_content_text.netsuiteValue,
                custitem_opms_back_content: vf.back_content_text.netsuiteValue,
                custitem_opms_abrasion: vf.abrasion_text.netsuiteValue,
                custitem_opms_firecodes: vf.firecodes_text.netsuiteValue,

                // ============================================================================
                // PRICING FIELDS (from T_PRODUCT_PRICE and T_PRODUCT_PRICE_COST)
                // DISABLED: NetSuite is source of truth - do NOT send OPMS pricing to NetSuite
                // Pricing flows ONE-WAY: NetSuite → OPMS (via webhook)
                // ============================================================================
                // price_1_: validatedData.pricing?.p_res_cut ? parseFloat(validatedData.pricing.p_res_cut) : null,  // Base Price Line 1 (Residential Cut)
                // price_1_5: validatedData.pricing?.p_hosp_roll ? parseFloat(validatedData.pricing.p_hosp_roll) : null, // Price Level 1, Line 5 (Hospital Roll)
                // cost: validatedData.pricing?.cost_cut ? parseFloat(validatedData.pricing.cost_cut) : null,  // Purchase Price (Vendor Cut Cost)
                // custitem_f3_rollprice: validatedData.pricing?.cost_roll ? parseFloat(validatedData.pricing.cost_roll) : null,  // Roll Price (Vendor Roll Cost)

                // ============================================================================
                // SALES AND PURCHASE DESCRIPTIONS (from OPMS product data)
                // One-way sync: OPMS → NetSuite (does not cascade from pricing updates)
                // ============================================================================
                purchasedescription: validatedData.purchaseDescription || null,
                salesdescription: validatedData.salesDescription || null,

                // ============================================================================
                // METADATA FIELDS
                // ============================================================================
                custitem_opms_sync_timestamp: new Date().toISOString(),
                custitem_opms_field_validation_summary: JSON.stringify(validatedData.validationSummary),

                // ============================================================================
                // NETSUITE LOT-NUMBERED INVENTORY ITEM CONSTANTS
                // These ensure consistent item configuration across all OPMS-synced items
                // Values from NetSuite Item 8161 (Dresden: Mink) - tested and proven
                // ============================================================================
                
                // CHECKBOX FIELDS (Boolean) - NetSuite expects JavaScript boolean type
                usebins: true,                                     // Checkbox: Enable bin tracking
                matchbilltoreceipt: true,                          // Checkbox: Match bills to receipts  
                custitem_aln_1_auto_numbered: true,                // Checkbox: Enable lot/serial auto-numbering
                
                // LIST FIELDS (Integer) - NetSuite list internal IDs
                // taxschedule: already set in validation (ID 1 = Taxable)
                unitstype: 2,                                      // List: Units type (2 = Area)
                custitem_aln_2_number_format: 1,                   // List: Number format (1 = Bolt/Lot Number)
                
                // NUMERIC FIELDS (Integer)
                custitem_aln_3_initial_sequence: 1                 // Numeric: Initial sequence number
                // subsidiary: already set above (2 = Opuzen)
            };

            // Log NetSuite constants to verify correct types
            logger.info('🔧 NetSuite Constants in Payload', {
                usebins: payload.usebins + ' (type: ' + typeof payload.usebins + ')',
                matchbilltoreceipt: payload.matchbilltoreceipt + ' (type: ' + typeof payload.matchbilltoreceipt + ')',
                custitem_aln_1_auto_numbered: payload.custitem_aln_1_auto_numbered + ' (type: ' + typeof payload.custitem_aln_1_auto_numbered + ')',
                unitstype: payload.unitstype + ' (type: ' + typeof payload.unitstype + ')',
                custitem_aln_2_number_format: payload.custitem_aln_2_number_format + ' (type: ' + typeof payload.custitem_aln_2_number_format + ')',
                custitem_aln_3_initial_sequence: payload.custitem_aln_3_initial_sequence + ' (type: ' + typeof payload.custitem_aln_3_initial_sequence + ')'
            });

            // Log pricing fields before cleaning
            // DISABLED: Pricing extraction is disabled - NetSuite is source of truth
            // logger.info('💰 Pricing fields BEFORE cleanPayload', {
            //     price_1_: payload.price_1_,
            //     price_1_5: payload.price_1_5,
            //     cost: payload.cost,
            //     custitem_f3_rollprice: payload.custitem_f3_rollprice
            // });

            // Remove null/undefined values to avoid NetSuite errors
            const cleanedPayload = this.cleanPayload(payload);

            // Log pricing fields after cleaning
            // DISABLED: Pricing extraction is disabled - NetSuite is source of truth
            // logger.info('💰 Pricing fields AFTER cleanPayload', {
            //     price_1_: cleanedPayload.price_1_,
            //     price_1_5: cleanedPayload.price_1_5,
            //     cost: cleanedPayload.cost,
            //     custitem_f3_rollprice: cleanedPayload.custitem_f3_rollprice
            // });

            logger.info('NetSuite payload built successfully', {
                itemId: validatedData.item_id,
                itemCode: validatedData.item_code,
                fieldCount: Object.keys(cleanedPayload).length,
                validationSummary: validatedData.validationSummary
            });

            return cleanedPayload;
        } catch (error) {
            logger.error('Failed to build NetSuite payload', {
                error: error.message,
                itemId: validatedData.item_id
            });
            throw error;
        }
    }

    /**
     * Transform compliance field values
     * @param {string} opmsValue - OPMS compliance value (Y/N/null)
     * @returns {string} - NetSuite compliance value
     */
    transformComplianceField(opmsValue) {
        switch(opmsValue) {
            case 'Y': return 'Yes';
            case 'N': return 'No';
            case 'D': return ' - ';
            case null: 
            case undefined: return ' - ';
            default: return ' - ';
        }
    }

    /**
     * Clean payload by removing null/undefined values
     * @param {Object} payload - Raw payload
     * @returns {Object} - Cleaned payload
     */
    cleanPayload(payload) {
        const cleaned = {};
        
        for (const [key, value] of Object.entries(payload)) {
            // Keep values that are not null/undefined
            // Keep " - " strings to show empty OPMS fields
            if (value !== null && value !== undefined) {
                cleaned[key] = value;
            }
        }

        return cleaned;
    }

    /**
     * Validate item exists and is syncable
     * @param {number} itemId - Item ID
     * @returns {Promise<Object>} - Validation result
     */
    async validateItemForSync(itemId) {
        try {
            const validationQuery = `
                SELECT 
                    i.id,
                    i.code,
                    i.archived as item_archived,
                    p.id as product_id,
                    p.name as product_name,
                    p.archived as product_archived,
                    v.id as vendor_id,
                    v.name as vendor_name,
                    v.active as vendor_active,
                    v.archived as vendor_archived,
                    m.netsuite_vendor_id,
                    m.opms_vendor_name,
                    m.netsuite_vendor_name
                FROM T_ITEM i
                JOIN T_PRODUCT p ON i.product_id = p.id
                JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
                JOIN Z_VENDOR v ON pv.vendor_id = v.id
                LEFT JOIN opms_netsuite_vendor_mapping m ON v.id = m.opms_vendor_id
                WHERE i.id = ?
            `;

            const [item] = await this.db.query(validationQuery, [itemId]);

            if (!item) {
                return {
                    isValid: false,
                    errors: ['Item not found']
                };
            }

            const errors = [];

            // Validation checks
            if (!item.code) errors.push('Item code is null');
            if (!item.product_name) errors.push('Product name is null');
            if (!item.vendor_name) errors.push('Vendor name is null');
            if (item.item_archived === 'Y') errors.push('Item is archived');
            if (item.product_archived === 'Y') errors.push('Product is archived');
            if (item.vendor_active === 'N') errors.push('Vendor is inactive');
            if (item.vendor_archived === 'Y') errors.push('Vendor is archived');
            if (!item.netsuite_vendor_id) errors.push('No NetSuite vendor mapping found');
            if (item.opms_vendor_name !== item.netsuite_vendor_name) {
                errors.push('Vendor mapping is inaccurate');
            }

            return {
                isValid: errors.length === 0,
                errors: errors,
                data: item
            };
        } catch (error) {
            logger.error('Item validation failed', {
                error: error.message,
                itemId: itemId
            });
            return {
                isValid: false,
                errors: [`Validation query failed: ${error.message}`]
            };
        }
    }

    /**
     * Get transformation statistics for monitoring
     * @param {Object} options - Query options
     * @returns {Promise<Object>} - Transformation statistics
     */
    async getTransformationStats(options = {}) {
        try {
            const { hours = 24 } = options;

            // This would be populated by actual transformation calls
            // For now, return basic structure
            return {
                period_hours: hours,
                total_transformations: 0,
                successful_transformations: 0,
                failed_transformations: 0,
                avg_processing_time_ms: 0,
                field_validation_stats: {
                    total_fields_processed: 0,
                    has_data_count: 0,
                    src_empty_data_count: 0,
                    query_failed_count: 0
                },
                common_validation_issues: []
            };
        } catch (error) {
            logger.error('Failed to get transformation statistics', {
                error: error.message,
                options: options
            });
            throw error;
        }
    }

    /**
     * Extract pricing data from OPMS for NetSuite sync
     * @param {number} productId - Product ID
     * @param {string} productType - Product type ('R', 'D', etc.)
     * @returns {Promise<Object>} - Pricing data
     */
    async extractPricingData(productId, productType = 'R') {
        try {
            // Query customer pricing from T_PRODUCT_PRICE
            const priceQuery = `
                SELECT p_res_cut, p_hosp_roll
                FROM T_PRODUCT_PRICE
                WHERE product_id = ? AND product_type = ?
            `;
            
            const [priceResults] = await this.db.query(priceQuery, [productId, productType]);
            const priceData = priceResults[0] || {};

            // Query vendor costs from T_PRODUCT_PRICE_COST
            const costQuery = `
                SELECT cost_cut, cost_roll
                FROM T_PRODUCT_PRICE_COST
                WHERE product_id = ?
            `;
            
            const [costResults] = await this.db.query(costQuery, [productId]);
            const costData = costResults[0] || {};

            return {
                p_res_cut: priceData.p_res_cut || null,
                p_hosp_roll: priceData.p_hosp_roll || null,
                cost_cut: costData.cost_cut || null,
                cost_roll: costData.cost_roll || null
            };
        } catch (error) {
            logger.error('Failed to extract pricing data', {
                error: error.message,
                productId: productId,
                productType: productType
            });
            // Return null pricing on error - don't fail the entire sync
            return {
                p_res_cut: null,
                p_hosp_roll: null,
                cost_cut: null,
                cost_roll: null
            };
        }
    }

    /**
     * Extract product origin data from OPMS for sales description
     * @param {number} productId - Product ID
     * @returns {Promise<string|null>} - Origin name or null
     */
    async extractOriginData(productId) {
        try {
            const originQuery = `
                SELECT GROUP_CONCAT(po.name ORDER BY po.name SEPARATOR ', ') as origin_names
                FROM T_PRODUCT_ORIGIN tpo
                JOIN P_ORIGIN po ON tpo.origin_id = po.id
                WHERE tpo.product_id = ?
            `;
            
            const [originResults] = await this.db.query(originQuery, [productId]);
            const originName = Array.isArray(originResults) && originResults[0]
                ? (originResults[0].origin_names || null)
                : null;
            
            logger.debug('Origin data extracted', {
                productId: productId,
                origin: originName
            });
            
            return originName;
        } catch (error) {
            logger.error('Failed to extract origin data', {
                error: error.message,
                productId: productId
            });
            // Return null on error - don't fail the entire sync
            return null;
        }
    }

    /**
     * Compose purchase description from OPMS item data
     * Includes pricing information for internal use
     * @param {Object} itemData - Complete OPMS item data
     * @param {Object} pricingData - Pricing data from extractPricingData
     * @returns {string} - Multi-line purchase description with <br> tags
     */
    composePurchaseDescription(itemData, pricingData) {
        logger.debug('🛠️  Composing Purchase Description', {
            itemId: itemData.item_id,
            itemCode: itemData.item_code,
            productName: itemData.product_name,
            hasPricing: !!pricingData
        });
        
        const lines = [];
        
        // Pattern: Vendor Product Name (vendor's name for the product)
        // Always show, use " - " if empty
        const patternValue = itemData.vendor_product_name || ' - ';
        lines.push(`Pattern: ${patternValue}`);
        logger.debug('  ✓ Added Pattern (Vendor Product Name):', patternValue);
        
        // Color: Vendor Color (vendor's color code/name)
        // Always show, use " - " if empty
        const colorValue = itemData.vendor_color || ' - ';
        lines.push(`Color: ${colorValue}`);
        logger.debug('  ✓ Added Color (Vendor Color):', colorValue);
        
        // Width: XX''
        if (itemData.width) {
            lines.push(`Width: ${itemData.width}''`);
            logger.debug('  ✓ Added Width:', `${itemData.width}''`);
        } else {
            logger.debug('  ℹ️  No width data');
        }
        
        // Repeat: H: XX'' V: XX''
        if (itemData.hrepeat || itemData.vrepeat) {
            const h = itemData.hrepeat || '0';
            const v = itemData.vrepeat || '0';
            lines.push(`Repeat: H: ${h}'' V: ${v}''`);
            logger.debug('  ✓ Added Repeat:', `H: ${h}'' V: ${v}''`);
        } else {
            logger.debug('  ℹ️  No repeat data');
        }
        
        // Content: Front content percentages
        if (itemData.front_content_text) {
            lines.push(`Content: ${itemData.front_content_text}`);
            logger.debug('  ✓ Added Front Content:', itemData.front_content_text);
        } else {
            logger.debug('  ℹ️  No front content data');
        }
        
        // Back Content: Back fabric content (if different from front)
        if (itemData.back_content_text) {
            lines.push(`Back Content: ${itemData.back_content_text}`);
            logger.debug('  ✓ Added Back Content:', itemData.back_content_text);
        } else {
            logger.debug('  ℹ️  No back content data');
        }
        
        // Abrasion: Test results (clean up placeholder values)
        if (itemData.abrasion_text) {
            // Remove placeholder/unknown values but keep rest of string
            let cleanedAbrasion = itemData.abrasion_text
                .replace(/\(\s*Unknown\s*\)/gi, '') // remove parenthetical Unknown
                .replace(/\bUnknown\b/gi, '')
                .replace(/Don'?t\s*know/gi, '')
                .replace(/\bn\/?a\b/gi, '')
                .replace(/\s{2,}/g, ' ')
                .replace(/\s+,/g, ',')
                .replace(/,\s+/g, ', ')
                .trim();
            
            // Only add if there's meaningful content left after cleanup
            if (cleanedAbrasion) {
                lines.push(`Abrasion: ${cleanedAbrasion}`);
                logger.debug('  ✓ Added Abrasion (cleaned):', cleanedAbrasion);
                if (cleanedAbrasion !== itemData.abrasion_text) {
                    logger.debug('    (Original had placeholder values removed)');
                }
            } else {
                logger.debug('  ℹ️  Abrasion data only contained placeholders, skipping');
            }
        } else {
            logger.debug('  ℹ️  No abrasion data');
        }
        
        // Fire Rating: Certifications
        if (itemData.firecodes_text) {
            lines.push(`Fire Rating: ${itemData.firecodes_text}`);
            logger.debug('  ✓ Added Fire Rating:', itemData.firecodes_text);
        } else {
            logger.debug('  ℹ️  No firecode data');
        }
        
        // NOTE: Pricing removed from Purchase Description per user request
        // Pricing is already available in dedicated NetSuite pricing fields
        
        const result = lines.join('\n');
        logger.info('✅ Purchase Description Complete', {
            lineCount: lines.length,
            totalLength: result.length,
            preview: result.substring(0, 100) + '...'
        });
        
        return result;
    }

    /**
     * Compose sales description from OPMS item data
     * Customer-facing without pricing information
     * @param {Object} itemData - Complete OPMS item data
     * @param {string|null} originData - Product origin name
     * @returns {string} - Multi-line sales description with <br> tags
     */
    composeSalesDescription(itemData, originData) {
        logger.debug('🛠️  Composing Sales Description', {
            itemId: itemData.item_id,
            itemCode: itemData.item_code,
            productName: itemData.product_name,
            hasOrigin: !!originData
        });
        
        const lines = [];
        
        // Start with item number (#XXXX-XXXX)
        if (itemData.item_code) {
            lines.push(`#${itemData.item_code}`);
            logger.debug('  ✓ Added Item Number:', `#${itemData.item_code}`);
        } else {
            logger.warn('  ⚠️  Missing item_code');
        }
        
        // Pattern: Product Name
        if (itemData.product_name) {
            lines.push(`Pattern: ${itemData.product_name}`);
            logger.debug('  ✓ Added Pattern:', itemData.product_name);
        } else {
            logger.warn('  ⚠️  Missing product_name');
        }
        
        // Color: Color Names
        if (itemData.color_name) {
            lines.push(`Color: ${itemData.color_name}`);
            logger.debug('  ✓ Added Color:', itemData.color_name);
        } else {
            logger.warn('  ⚠️  Missing color_name');
        }
        
        // Width: XX''
        if (itemData.width) {
            lines.push(`Width: ${itemData.width}''`);
            logger.debug('  ✓ Added Width:', `${itemData.width}''`);
        } else {
            logger.debug('  ℹ️  No width data');
        }
        
        // Repeat: H: XX'' V: XX''
        if (itemData.hrepeat || itemData.vrepeat) {
            const h = itemData.hrepeat || '0';
            const v = itemData.vrepeat || '0';
            lines.push(`Repeat: H: ${h}'' V: ${v}''`);
            logger.debug('  ✓ Added Repeat:', `H: ${h}'' V: ${v}''`);
        } else {
            logger.debug('  ℹ️  No repeat data');
        }
        
        // Content: Front content percentages
        if (itemData.front_content_text) {
            lines.push(`Content: ${itemData.front_content_text}`);
            logger.debug('  ✓ Added Front Content:', itemData.front_content_text);
        } else {
            logger.debug('  ℹ️  No front content data');
        }
        
        // Back Content: Back fabric content (if different from front)
        if (itemData.back_content_text) {
            lines.push(`Back Content: ${itemData.back_content_text}`);
            logger.debug('  ✓ Added Back Content:', itemData.back_content_text);
        } else {
            logger.debug('  ℹ️  No back content data');
        }
        
        // Abrasion: Test results (clean up placeholder values)
        if (itemData.abrasion_text) {
            // Remove placeholder/unknown values but keep rest of string
            let cleanedAbrasion = itemData.abrasion_text
                .replace(/\(\s*Unknown\s*\)/gi, '') // remove parenthetical Unknown
                .replace(/\bUnknown\b/gi, '')
                .replace(/Don'?t\s*know/gi, '')
                .replace(/\bn\/?a\b/gi, '')
                .replace(/\s{2,}/g, ' ')
                .replace(/\s+,/g, ',')
                .replace(/,\s+/g, ', ')
                .trim();
            
            // Only add if there's meaningful content left after cleanup
            if (cleanedAbrasion) {
                lines.push(`Abrasion: ${cleanedAbrasion}`);
                logger.debug('  ✓ Added Abrasion (cleaned):', cleanedAbrasion);
                if (cleanedAbrasion !== itemData.abrasion_text) {
                    logger.debug('    (Original had placeholder values removed)');
                }
            } else {
                logger.debug('  ℹ️  Abrasion data only contained placeholders, skipping');
            }
        } else {
            logger.debug('  ℹ️  No abrasion data');
        }
        
        // Fire Rating: Certifications
        if (itemData.firecodes_text) {
            lines.push(`Fire Rating: ${itemData.firecodes_text}`);
            logger.debug('  ✓ Added Fire Rating:', itemData.firecodes_text);
        } else {
            logger.debug('  ℹ️  No firecode data');
        }
        
        // Country of Origin - Use same data source as custitem_opms_product_origin
        const origin = originData || ' - ';
        lines.push(`Country of Origin: ${origin}`);
        logger.debug('  ✓ Added Country of Origin:', origin);
        
        const result = lines.join('\n');
        logger.info('✅ Sales Description Complete', {
            lineCount: lines.length,
            totalLength: result.length,
            preview: result.substring(0, 100) + '...'
        });
        
        return result;
    }
}

module.exports = OpmsDataTransformService;

