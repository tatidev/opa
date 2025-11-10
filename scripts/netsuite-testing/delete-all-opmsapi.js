const ns = require('../../src/services/netsuiteRestletService');

async function deleteAllOpmsApiItems() {
  let totalDeleted = 0;
  let round = 1;
  
  while (true) {
    console.log(`\n=== DELETION ROUND ${round} ===`);
    
    try {
      const result = await ns.bulkDeleteItems({ 
        dryRun: false, 
        itemPattern: 'opmsAPI', 
        maxItems: 100 
      });
      
      console.log(`Round ${round}: Processed ${result.itemsProcessed}, Deleted ${result.itemsDeleted}, Errors ${result.errors.length}`);
      
      totalDeleted += result.itemsDeleted;
      
      if (result.itemsProcessed === 0) {
        console.log('\n✅ No more opmsAPI items found - cleanup complete!');
        break;
      }
      
      round++;
      
      // Safety limit to prevent infinite loops
      if (round > 10) {
        console.log('\n⚠️ Safety limit reached (10 rounds) - stopping');
        break;
      }
      
    } catch (error) {
      console.log(`Round ${round} failed:`, error.message);
      break;
    }
  }
  
  console.log(`\n🎉 TOTAL DELETED: ${totalDeleted} opmsAPI items`);
}

deleteAllOpmsApiItems();
