require('dotenv').config();
const BaseModel = require('../src/models/BaseModel');

async function checkTriggers() {
  const model = new BaseModel();
  try {
    console.log('\n🔍 Checking for OPMS sync triggers...\n');
    
    const [triggers] = await model.db.query(`
      SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE
      FROM information_schema.TRIGGERS 
      WHERE TRIGGER_SCHEMA = DATABASE()
      AND TRIGGER_NAME LIKE '%sync%'
      ORDER BY EVENT_OBJECT_TABLE, EVENT_MANIPULATION
    `);
    
    console.log('Triggers found:', triggers.length);
    if (triggers.length > 0) {
      triggers.forEach(t => {
        console.log(`  ✓ ${t.TRIGGER_NAME} on ${t.EVENT_OBJECT_TABLE} (${t.EVENT_MANIPULATION})`);
      });
    } else {
      console.log('  ❌ NO sync triggers found');
    }
    
    console.log('\n🔍 Checking for opms_sync_queue table...\n');
    
    const [tables] = await model.db.query(`
      SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'opms_sync_queue'
    `);
    
    if (tables.length > 0) {
      console.log('  ✓ opms_sync_queue table exists');
      const [count] = await model.db.query('SELECT COUNT(*) as cnt FROM opms_sync_queue');
      console.log(`    Rows in queue: ${count[0].cnt}`);
    } else {
      console.log('  ❌ opms_sync_queue table DOES NOT EXIST');
    }
    
    process.exit(0);
  } catch (e) { console.error('Error:', e.message); process.exit(1); }
}

checkTriggers();

