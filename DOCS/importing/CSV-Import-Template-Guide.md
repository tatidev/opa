# CSV Import Template Guide - For Business Users

**Purpose:** This guide helps you create CSV files for importing product data into the OPMS system.

---

## 🎯 **QUICK START**

### **What You Need**
1. **Excel or Google Sheets** (to create your CSV file)
2. **Product information** you want to import
3. **This template guide** (for column requirements)

### **Required Information** *(Must have these 3 things)*
- ✅ **Item Code** (in format `1354-6543` or `7654-8989K`)
- ✅ **Product Name** (like `Tranquil`)
- ✅ **Color** (like `Ash` or `Ash, Blue`)

---

## 📊 **CSV COLUMN TEMPLATE**

Copy this table into Excel/Sheets and fill in your data:

| Column Name | Required? | What to Put Here | Examples |
|-------------|-----------|------------------|----------|
| **Item Id (Opuzen Code)** | ✅ **YES** | Unique item code in format ####-####<alpha> | `1354-6543`, `7654-8989K`, `2001-5678A` |
| **OPMS Item Id** | ❌ No | Leave empty (system fills this) | *(leave blank)* |
| **OPMS Product Id** | ❌ No | Leave empty (system fills this) | *(leave blank)* |
| **Product Name** | ✅ **YES** | Name of the fabric/product | `Tranquil`, `Berba`, `Tolstoy` |
| **Display Name** | ❌ No | Leave empty (system creates this) | *(leave blank)* |
| **Color** | ✅ **YES** | Color name(s), separate multiple with commas | `Ash`, `Blue`, `Ash, Blue` |
| **Width** | ❌ No | Fabric width in inches | `54.00`, `48.5`, `60` |
| **VR** | ❌ No | Vertical repeat in inches | `0.65`, `12.5`, `8.0` |
| **HR** | ❌ No | Horizontal repeat in inches | `0.75`, `8.25`, `10.0` |
| **Vendor** | ❌ No | Vendor/manufacturer name | `TextileCorp`, `FabricMills` |
| **Vendor Item Code** | ❌ No | Vendor's code for this item | `TC-ASH-001`, `FM-BLUE-02` |
| **Vendor Product Name** | ❌ No | Vendor's name for this product | `Tranquil Ash Fabric` |
| **Vendor Item Color** | ❌ No | Vendor's color code | `ASH-001`, `BLUE-02` |
| **Repeat (No-Repeat)** | ❌ No | Pattern repeat type | `Repeat`, `No-Repeat`, `Y`, `N` |
| **Front Content** | ❌ No | Description of fabric front | `Beautiful ash-colored fabric...` |
| **Back Content** | ❌ No | Description of fabric back | `Soft and durable backing...` |
| **Abrasion** | ❌ No | Abrasion test results | `Class II`, `ASTM D3884` |
| **Firecodes** | ❌ No | Fire safety ratings | `Class A`, `ASTM E84` |
| **Prop 65 Compliance** | ❌ No | California Prop 65 compliance | `Y` (Yes) or `N` (No) |
| **AB 2998 Compliance** | ❌ No | California AB 2998 compliance | `Y` (Yes) or `N` (No) |
| **Finish** | ❌ No | Fabric finish type | `Matte`, `Satin`, `Textured` |
| **Cleaning** | ❌ No | Cleaning instructions | `Professional cleaning only` |
| **Origin** | ❌ No | Country of origin | `USA`, `Italy`, `Belgium` |
| **Tariff / Harmonized Code** | ❌ No | Trade classification code | `6302.93.0000` |
| **Use (Item Application)** | ❌ No | Intended use/application | `Residential upholstery` |

---

## ⚠️ **IMPORTANT RULES**

### **Item Code Format** *(NEW REQUIREMENT)*
- **✅ CORRECT**: `1354-6543`, `7654-8989K`, `2001-5678A` (4 digits, dash, 4 digits, optional letter)
- **❌ WRONG**: `ABC123`, `PROD-01`, `FAB-001` (old formats), `1234-567AB` (multiple letters)

### **Required Fields**
- **Must have data**: Item Code, Product Name, Color
- **Cannot be empty**: These 3 fields must have values in every row

### **Data Format Rules**
- **Numbers**: Use decimals like `54.00` or `12.5` (not text like "USA")
- **Yes/No Fields**: Use `Y` for Yes, `N` for No (not "Maybe" or "True")
- **Multiple Colors**: Separate with commas: `Ash, Blue, Red`
- **Text Fields**: Can contain any text, descriptions, or instructions

---

## 📝 **SAMPLE ROW**

Here's what a complete row should look like:

```csv
1354-6543,1001,2001,Tranquil,Tranquil: Ash,Ash,54.00,0.65,0.75,TextileCorp,TC-ASH-001,Tranquil Ash Fabric,ASH-001,Y,Beautiful ash-colored fabric with subtle texture,Soft and durable backing material,Class II,Class A,Y,N,Matte,Professional cleaning only,USA,6302.93.0000,Residential upholstery
```

---

## 🛠️ **HOW TO CREATE YOUR CSV**

### **Step 1: Set Up Your Spreadsheet**
1. Open Excel or Google Sheets
2. Copy the column names from the table above into the first row
3. Add your data in the rows below

### **Step 2: Fill in Required Data**
1. **Item Code**: Create unique codes like `1354-6543`, `2001-5678`
2. **Product Name**: Enter your fabric/product names
3. **Color**: Enter color names (separate multiple colors with commas)

### **Step 3: Add Optional Data**
- Fill in any additional columns you have information for
- Leave blank any columns you don't have data for
- The system will handle empty optional fields

### **Step 4: Save as CSV**
1. **File → Save As**
2. **Choose format**: CSV (Comma delimited)
3. **Save** your file

---

## ✅ **VALIDATION CHECK**

Before uploading, make sure:

- ✅ **Every row has**: Item Code, Product Name, Color
- ✅ **Item codes follow**: `####-####` format (like `1354-6543`)
- ✅ **Numbers are numbers**: Width, VR, HR contain only numbers
- ✅ **Yes/No fields use**: `Y` or `N` (not words)
- ✅ **No duplicate item codes**: Each item code appears only once

---

## 🚨 **COMMON MISTAKES TO AVOID**

| ❌ **Wrong** | ✅ **Correct** | **Why** |
|-------------|---------------|---------|
| `ABC123` | `1354-6543` | Must use new ####-####<alpha> format |
| `PROD-01K` | `2001-5678K` | Must use 4 digits each side |
| `USA` in Width | `54.00` | Width must be a number |
| `Maybe` in Prop 65 | `Y` or `N` | Must be Yes or No |
| Empty Item Code | `1354-6543` | Item Code is required |
| `Ash Blue` | `Ash, Blue` | Multiple colors need commas |

---

## 🎉 **YOU'RE READY!**

Once your CSV file is created:

1. **Upload** it through the import system
2. **Review** any validation messages
3. **Fix** any errors using the guidance provided
4. **Import** your data successfully

**Need help?** The system provides specific error messages and fix suggestions if anything needs to be corrected.

---

*This guide covers everything you need to create a properly formatted CSV file for importing your product data!*
