const axios = require('axios');

async function testAPI() {
  try {
    console.log('Testing AI consumption files API...');

    const response = await axios.get(
      'http://localhost:4000/api/ai-consumption-files'
    );

    console.log('Response status:', response.status);
    console.log(
      'Files count:',
      response.data.files ? response.data.files.length : 0
    );

    if (response.data.files) {
      console.log('\nFiles found:');
      response.data.files.forEach((file, index) => {
        console.log(`${index + 1}. ${file.name} (${file.source || 'unknown'})`);
        console.log(`   Description: ${file.description}`);
        console.log(
          `   Output columns: ${
            file.outputColumns ? file.outputColumns.length : 0
          }`
        );
        if (file.outputColumns && file.outputColumns.length > 0) {
          console.log(
            `   Sample columns: ${file.outputColumns
              .slice(0, 3)
              .map((col) => col.name)
              .join(', ')}`
          );
        }
        console.log('');
      });

      // Check for special entities
      const goldCustomers = response.data.files.find(
        (f) => f.name === 'gold_customers_360'
      );
      const products360 = response.data.files.find(
        (f) => f.name === 'products_360'
      );

      console.log('Special entities check:');
      console.log('- gold_customers_360 found:', !!goldCustomers);
      console.log('- products_360 found:', !!products360);

      if (goldCustomers) {
        console.log(
          'gold_customers_360 columns:',
          goldCustomers.outputColumns.map((col) => col.name)
        );
      }
      if (products360) {
        console.log(
          'products_360 columns:',
          products360.outputColumns.map((col) => col.name)
        );
      }
    }
  } catch (error) {
    console.error('Error testing API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testAPI();
