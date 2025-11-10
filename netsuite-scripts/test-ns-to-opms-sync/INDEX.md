# 📑 NetSuite → OPMS Sync - Documentation Index

**Quick Navigation for All Sync-Related Documentation**

---

## 🎯 **START HERE**

### **New to This Sync?**
👉 **[TESTING-COMPLETE-SUMMARY.md](TESTING-COMPLETE-SUMMARY.md)** - Overview, test results, and production checklist

### **Need Quick Instructions?**
👉 **[QUICK-START.md](QUICK-START.md)** - 5 commands to run tests

### **Want Complete Details?**
👉 **[README.md](README.md)** - Comprehensive testing guide

---

## 📚 **Documentation by Purpose**

### **For Testing (Development/Localhost)**

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [QUICK-START.md](QUICK-START.md) | Fast testing instructions | Quick testing reference |
| [README.md](README.md) | Complete test guide | Full testing walkthrough |
| [1-setup-opms-test-data.sql](1-setup-opms-test-data.sql) | Create test data | First step of testing |
| [3-manual-sync-test.js](3-manual-sync-test.js) | Automated test suite | Run sync validation tests |
| [4-validate-sync-results.sql](4-validate-sync-results.sql) | Verify sync worked | After running tests |
| [6-cleanup-test-data.sql](6-cleanup-test-data.sql) | Remove test data | After testing complete |
| [run-tests.sh](run-tests.sh) | Automated test runner | Run entire test suite |

### **For Production Deployment**

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [TESTING-COMPLETE-SUMMARY.md](TESTING-COMPLETE-SUMMARY.md) | Test results & prod checklist | Before production deploy |
| [../NETSUITE-WEBHOOK-DEPLOYMENT-GUIDE.md](../NETSUITE-WEBHOOK-DEPLOYMENT-GUIDE.md) | Deploy SuiteScript to NS | Setting up webhook |
| [LIVE-NETSUITE-TESTING-CHECKLIST.md](LIVE-NETSUITE-TESTING-CHECKLIST.md) | Production testing steps | After deployment |
| [DASHBOARD-AND-LIVE-TESTING-GUIDE.md](DASHBOARD-AND-LIVE-TESTING-GUIDE.md) | Monitor sync activity | Ongoing monitoring |

### **For Troubleshooting**

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [README.md#troubleshooting](README.md) | Common issues & solutions | When tests fail |
| [NETSUITE-WEBHOOK-DEPLOYMENT-GUIDE.md#troubleshooting](../NETSUITE-WEBHOOK-DEPLOYMENT-GUIDE.md) | NetSuite webhook issues | Webhook not firing |
| [DASHBOARD-AND-LIVE-TESTING-GUIDE.md](DASHBOARD-AND-LIVE-TESTING-GUIDE.md) | Dashboard & monitoring | Dashboard not updating |

---

## 🗂️ **File Organization**

```
netsuite-scripts/
├── test-ns-to-opms-sync/          ← Testing Suite
│   ├── INDEX.md                    ← This file (navigation)
│   ├── TESTING-COMPLETE-SUMMARY.md ← **START HERE**
│   ├── QUICK-START.md              ← Fast reference
│   ├── README.md                   ← Complete guide
│   ├── DASHBOARD-AND-LIVE-TESTING-GUIDE.md
│   ├── LIVE-NETSUITE-TESTING-CHECKLIST.md
│   ├── 1-setup-opms-test-data.sql
│   ├── 2-netsuite-test-item-setup-guide.md
│   ├── 3-manual-sync-test.js
│   ├── 4-validate-sync-results.sql
│   ├── 6-cleanup-test-data.sql
│   ├── run-tests.sh
│   ├── debug-sync-direct.js
│   └── quick-test.js
├── ItemPricingUpdateWebhook.js     ← NetSuite SuiteScript (DEPLOYED)
└── NETSUITE-WEBHOOK-DEPLOYMENT-GUIDE.md ← Webhook setup guide
```

---

## 🎓 **Learning Path**

### **Phase 1: Understanding** (First Time)
1. Read [TESTING-COMPLETE-SUMMARY.md](TESTING-COMPLETE-SUMMARY.md)
2. Review test results and what was validated
3. Understand the 4 pricing fields that sync

### **Phase 2: Local Testing** (Development)
1. Follow [QUICK-START.md](QUICK-START.md)
2. Run test suite
3. Verify sync logic works

### **Phase 3: Production Deployment** (When Ready)
1. Review production checklist in [TESTING-COMPLETE-SUMMARY.md](TESTING-COMPLETE-SUMMARY.md)
2. Deploy NetSuite webhook via [NETSUITE-WEBHOOK-DEPLOYMENT-GUIDE.md](../NETSUITE-WEBHOOK-DEPLOYMENT-GUIDE.md)
3. Test with real items via [LIVE-NETSUITE-TESTING-CHECKLIST.md](LIVE-NETSUITE-TESTING-CHECKLIST.md)
4. Monitor via dashboard: `/api/sync-dashboard/`

---

## 🔗 **Quick Links**

**Dashboard (Localhost)**:
- http://localhost:3000/api/sync-dashboard/

**API Endpoints**:
- Webhook: `POST /api/ns-to-opms/webhook`
- Metrics: `GET /api/sync-dashboard/metrics`
- Health: `GET /api/ns-to-opms/health`

**Production URLs** (when deployed):
- Dashboard: `https://your-api.com/api/sync-dashboard/`
- Webhook: `https://your-api.com/api/ns-to-opms/webhook`

---

## 📊 **Test Results At a Glance**

**Final Score**: 4/4 (100%) ✅✅✅✅

| Test | Result | What Was Validated |
|------|--------|-------------------|
| Normal Pricing Sync | ✅ PASSED | All 4 fields sync correctly |
| Lisa Slayman Skip | ✅ PASSED | Skip logic works |
| Invalid Data | ✅ PASSED | Validation prevents bad data |
| Missing Item | ✅ PASSED | Error handling works |

**Conclusion**: Sync service is production-ready. Needs only production deployment for live webhook testing.

---

## 💡 **Key Concepts**

### **4 Pricing Fields Synced**
1. NetSuite `price_1_` (line 1) → OPMS `T_PRODUCT_PRICE.p_res_cut`
2. NetSuite `price_1_` (line 2) → OPMS `T_PRODUCT_PRICE.p_hosp_roll`
3. NetSuite `cost` → OPMS `T_PRODUCT_PRICE_COST.cost_cut`
4. NetSuite `custitem_f3_rollprice` → OPMS `T_PRODUCT_PRICE_COST.cost_roll`

### **Lisa Slayman Skip Logic**
- If NetSuite field `custitemf3_lisa_item` = TRUE
- Sync is skipped (pricing NOT updated in OPMS)
- Properly logged with reason

### **Transaction Safety**
- All database updates atomic (all-or-nothing)
- Automatic rollback on errors
- No partial updates possible

---

## 🆘 **Getting Help**

**Common Questions**:
- "How do I test the sync?" → [QUICK-START.md](QUICK-START.md)
- "How do I deploy to NetSuite?" → [NETSUITE-WEBHOOK-DEPLOYMENT-GUIDE.md](../NETSUITE-WEBHOOK-DEPLOYMENT-GUIDE.md)
- "Tests are failing" → [README.md#troubleshooting](README.md)
- "Dashboard not working" → [DASHBOARD-AND-LIVE-TESTING-GUIDE.md](DASHBOARD-AND-LIVE-TESTING-GUIDE.md)

**Technical References**:
- Sync Spec: `DOCS/ai-specs/app-technical-specifications/netsuite-to-opms-synchronization-spec.md`
- Database Spec: `DOCS/ai-specs/app-technical-specifications/opms-database-spec.md`
- Code: `src/services/NsToOpmsSyncService.js`

---

**Last Updated**: October 16, 2025  
**Test Status**: ✅ Complete - Ready for Production  
**Next Milestone**: Production Deployment & Live Webhook Testing




