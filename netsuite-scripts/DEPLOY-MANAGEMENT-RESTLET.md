# 🔧 Deploy Management RESTlet Guide

## 📋 **QUICK DEPLOYMENT STEPS:**

### **1. Upload RESTlet to NetSuite**
1. **Login** to NetSuite Sandbox
2. **Navigate**: Customization > Scripting > Scripts > New 
3. **Select**: RESTlet
4. **Upload**: `RESTletManageInventoryItem.js`
5. **Set Properties**:
   - **Name**: "Inventory Item Management RESTlet"
   - **ID**: `custscript_manage_inventory_item`
   - **Function**: `post`

### **2. Create Script Deployment**
1. **Click**: "Deploy Script" 
2. **Set Properties**:
   - **Title**: "Inventory Item Management Deployment"
   - **ID**: `custdeploy_manage_inventory_item`
   - **Status**: Testing (initially)
   - **Log Level**: Debug
3. **Save Deployment**

### **3. Get RESTlet URL**
After deployment, NetSuite will show you the RESTlet URL like:
```
https://11516011-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=[SCRIPT_ID]&deploy=[DEPLOY_ID]
```

### **4. Update Environment Variables**
Add to your environment configuration:
```bash
# Management RESTlet URLs
NETSUITE_MANAGE_SANDBOX_RESTLET_URL=https://11516011-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=[SCRIPT_ID]&deploy=[DEPLOY_ID]
NETSUITE_MANAGE_RESTLET_URL=https://11516011.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=[SCRIPT_ID]&deploy=[DEPLOY_ID]
```

## 🧪 **TEST THE DEPLOYMENT:**

### **Test Script:**
```bash
node scripts/smart-delete-strategy.js 8262
```

### **Expected Output:**
```
🧠 SMART DELETE STRATEGY
=======================
Items: 8262
Strategy: Try DELETE first, fallback to inactive

[1/1] Processing Item 8262:
   📋 Item: opmsAPI-TEST-123
   📊 Current status: ACTIVE
   🎯 Smart Strategy: Attempting optimized cleanup...
   ✅ SUCCESS: Direct deletion worked (no transactions)
   or
   ✅ SUCCESS: Marked inactive (has dependencies)
   📋 Item: opmsAPI-TEST-123

📊 SMART DELETE STRATEGY RESULTS
================================
🗑️  Direct deletions (no transactions): 1
📝 Marked inactive (has dependencies): 0
❌ Failed: 0

🎉 All items processed successfully!
```

## 🔧 **SUPPORTED ACTIONS:**

### **Mark Item Inactive:**
```json
{
  "action": "mark_inactive",
  "id": 8262
}
```

### **Delete Item (Smart Fallback):**
```json
{
  "action": "delete", 
  "id": 8262
}
```

### **Get Item Status:**
```json
{
  "action": "get_status",
  "id": 8262
}
```

### **Bulk Mark Inactive:**
```json
{
  "action": "bulk_mark_inactive",
  "itemIds": [8262, 890, 889]
}
```

## 🚨 **TROUBLESHOOTING:**

### **Common Issues:**
1. **"RESTlet URL not configured"** → Set environment variables
2. **"OAuth authentication failed"** → Check NETSUITE_* environment variables
3. **"Record type not found"** → RESTlet not deployed or wrong URL
4. **"Permission denied"** → Check RESTlet deployment permissions

### **Debug Steps:**
1. **Verify** RESTlet is deployed and status is "Testing" or "Released"
2. **Check** environment variables are set correctly
3. **Test** with curl first:
```bash
curl -X POST "YOUR_RESTLET_URL" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_status", "id": 8262}'
```

## 🎯 **READY FOR TESTING!**

Once deployed, the management RESTlet provides:
- ✅ Smart delete (try direct, fallback to inactive)
- ✅ Mark inactive/active operations  
- ✅ Bulk operations
- ✅ Full error handling
- ✅ Support for both LOT_NUMBERED and regular INVENTORY_ITEM types

Deploy the RESTlet and test with the updated `smart-delete-strategy.js` script! 🚀
