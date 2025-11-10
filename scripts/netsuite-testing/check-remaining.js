const ns = require('../../src/services/netsuiteRestletService');

ns.bulkDeleteItems({ dryRun: true, itemPattern: 'opmsAPI', maxItems: 100 })
  .then(result => {
    console.log('Remaining opmsAPI items found:', result.itemsFound?.length || 0);
    if (result.itemsFound && result.itemsFound.length > 0) {
      console.log('Items still in NetSuite:');
      result.itemsFound.forEach(item => {
        console.log(`  - ${item.itemid}`);
      });
    } else {
      console.log('No more opmsAPI items found');
    }
  })
  .catch(error => {
    console.log('Error:', error.message);
  });
