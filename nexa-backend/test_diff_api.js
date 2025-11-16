const axios = require('axios');

async function testDiffAPI() {
  try {
    console.log('Testing diff generation API with previous versions...');

    // Test data for a sample entity
    const testData = {
      entities: [
        {
          entityName: 'test_entity',
          transformations: {
            entityName: 'test_entity',
            curatedEntityName: 'test_entity',
            rawAttributes: ['id', 'name', 'email'],
            curatedAttributes: ['id', 'name', 'email', '_ingest_timestamp'],
            mappings: [
              {
                raw: 'id',
                curated: 'id',
                isNewColumn: false,
                isControlColumn: false,
              },
              {
                raw: 'name',
                curated: 'name',
                isNewColumn: false,
                isControlColumn: false,
              },
              {
                raw: 'email',
                curated: 'email',
                isNewColumn: false,
                isControlColumn: false,
              },
            ],
            dataTypes: {},
            constraints: {},
            columnRules: {},
            operatorRules: {},
            concatenationRules: [],
            entityNLPRules: [],
          },
        },
      ],
      githubConfig: {
        repositoryUrl: 'https://github.com/testuser/testrepo',
        branch: 'main',
        username: 'testuser',
        password: 'testtoken',
      },
    };

    console.log('Sending request to generate-all-diffs endpoint...');

    const response = await axios.post(
      'http://localhost:4000/api/artifacts/generate-all-diffs',
      testData,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Response status:', response.status);
    console.log('Response success:', response.data.success);

    if (response.data.success) {
      const { diffs, artifacts, summary } = response.data.data;

      console.log('\nSummary:', summary);
      console.log('Number of entities processed:', Object.keys(diffs).length);

      // Check if previous versions are included in the response
      for (const [entityName, diffData] of Object.entries(diffs)) {
        console.log(`\nEntity: ${entityName}`);
        console.log('Diff success:', diffData.success);

        if (diffData.success !== false) {
          console.log(
            'Previous versions included:',
            !!diffData.previousVersions
          );
          console.log(
            'SQL previous version:',
            !!diffData.previousVersions?.sql
          );
          console.log(
            'PySpark previous version:',
            !!diffData.previousVersions?.pyspark
          );

          if (diffData.previousVersions?.sql) {
            console.log(
              'SQL previous version length:',
              diffData.previousVersions.sql.length
            );
          }
          if (diffData.previousVersions?.pyspark) {
            console.log(
              'PySpark previous version length:',
              diffData.previousVersions.pyspark.length
            );
          }
        } else {
          console.log('Error:', diffData.error);
        }
      }
    } else {
      console.log('API returned error:', response.data.message);
    }
  } catch (error) {
    console.error('Error testing diff API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testDiffAPI();
