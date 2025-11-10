require('dotenv').config();
const BaseModel = require('../src/models/BaseModel');

async function findItems() {
  const model = new BaseModel();
  
  try {
    // Find test products
    const productQuery = `
      SELECT id, name FROM T_PRODUCT 
      WHERE name LIKE '%TEST%' AND archived = 'N' 
      ORDER BY id DESC LIMIT 5
    `;
    const [products] = await model.db.query(productQuery);
    
    console.log('\n📦 Test Products Found:');
    console.log('═'.repeat(80));
    products.forEach(p => {
      console.log(`Product ID: ${p.id}, Name: "${p.name}"`);
    });
    
    if (products.length > 0) {
      const productId = products[0].id;
      console.log(`\n🔍 Looking for items in Product ${productId} (${products[0].name})...`);
      
      const itemQuery = `
        SELECT 
          i.id as item_id,
          i.code as item_code,
          p.id as product_id,
          p.name as product_name,
          GROUP_CONCAT(c.name ORDER BY ic.n_order SEPARATOR ', ') as colors
        FROM T_ITEM i
        JOIN T_PRODUCT p ON i.product_id = p.id
        LEFT JOIN T_ITEM_COLOR ic ON i.id = ic.item_id
        LEFT JOIN P_COLOR c ON ic.color_id = c.id
        WHERE i.product_id = ? 
          AND i.archived = 'N'
          AND i.code IS NOT NULL
          AND i.code != ''
        GROUP BY i.id
        LIMIT 5
      `;
      
      const [items] = await model.db.query(itemQuery, [productId]);
      
      console.log('\n📋 Items Found:');
      console.log('═'.repeat(80));
      if (items.length === 0) {
        console.log('❌ No items found for this product');
      } else {
        items.forEach(item => {
          console.log(`OPMS ID: ${item.item_id}, Code: "${item.item_code}", Colors: ${item.colors || 'None'}`);
        });
        
        console.log('\n🧪 To test, run:');
        console.log(`node scripts/test-sales-purchase-descriptions.js ${items[0].item_id}`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

findItems();

