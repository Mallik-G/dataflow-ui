const AWS = require('aws-sdk');
const csv = require('csv-parser');
const { stringify } = require('csv-stringify');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const AttributeTransformationService = require('../services/attributeTransformationService');

// In-memory storage for transformations (fallback, now using database)
const transformationsStorage = new Map();

// Initialize S3 client
const s3 = new AWS.S3({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION,
});

// Helper function to apply NLP transformations
const applyNLPTransformations = (value, rules) => {
  let transformedValue = value;

  rules.forEach((rule) => {
    if (!rule.enabled) return;

    switch (rule.type) {
      case 'uppercase':
        transformedValue = transformedValue?.toString().toUpperCase();
        break;
      case 'lowercase':
        transformedValue = transformedValue?.toString().toLowerCase();
        break;
      case 'trim_whitespace':
        transformedValue = transformedValue?.toString().trim();
        break;
      default:
        break;
    }
  });

  return transformedValue;
};

// Helper function to apply data quality checks
const applyDataQualityChecks = (value, rules) => {
  for (const rule of rules) {
    if (!rule.enabled) continue;

    switch (rule.type) {
      case 'not_null':
        if (!value || value.toString().trim() === '') {
          throw new Error('Value cannot be null or empty');
        }
        break;
      case 'email_format':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          throw new Error('Invalid email format');
        }
        break;
      case 'numeric_only':
        if (isNaN(value) || value === '') {
          throw new Error('Value must be numeric');
        }
        break;
      case 'unique':
        // This would need to be handled at the dataset level
        break;
      default:
        break;
    }
  }
  return true;
};

// Helper function to apply operator rules
const applyOperatorRules = (value, rules) => {
  for (const rule of rules) {
    if (!rule.enabled) continue;

    const numValue = parseFloat(value);
    const ruleValue = parseFloat(rule.value);

    switch (rule.type) {
      case 'greater_than':
        if (numValue <= ruleValue) {
          throw new Error(`Value must be greater than ${rule.value}`);
        }
        break;
      case 'less_than':
        if (numValue >= ruleValue) {
          throw new Error(`Value must be less than ${rule.value}`);
        }
        break;
      case 'not_equals':
        if (value === rule.value) {
          throw new Error(`Value cannot be equal to ${rule.value}`);
        }
        break;
      default:
        break;
    }
  }
  return true;
};

// Helper function to apply concatenation rules
const applyConcatenationRules = (row, rules) => {
  const newRow = { ...row };

  rules.forEach((rule) => {
    const values = rule.sourceColumns
      .map((col) => row[col] || '')
      .filter((val) => val !== '');
    newRow[rule.targetColumn] = values.join(rule.separator);
  });

  return newRow;
};

// Main transformation function
const transformData = async (req, res) => {
  try {
    const { entityName, transformations } = req.body;

    console.log('transformData called for entity:', entityName);
    console.log(
      'This function now saves transformation metadata to database, no file generation'
    );

    // Save transformation metadata to database
    const transformationData = {
      entityName,
      curatedEntityName:
        transformations.curatedEntityName ||
        `curated.${entityName.replace('raw.', '')}`,
      fileType: 'curated',
      sourceAttributes: transformations.rawAttributes || [],
      curatedAttributes: transformations.curatedAttributes || [],
      mappings: transformations.mappings || [],
      columnRules: transformations.columnRules || {},
      operatorRules: transformations.operatorRules || {},
      concatenationRules: transformations.concatenationRules || [],
      entityNLPRules: transformations.entityNLPRules || [],
      columnDescriptions: transformations.columnDescriptions || {},
      newColumns: transformations.newColumns || [],
      entityLevelMetadata: transformations.entityLevelMetadata || {},
      fileData: transformations.fileData || {},
      createdBy: 'system',
      notes: 'Saved via transformData endpoint',
    };

    const result = await AttributeTransformationService.saveTransformation(
      transformationData
    );

    // Also keep in-memory storage for backward compatibility
    const transformationId = result.transformation.transformationId;
    const timestamp = new Date().toISOString();

    transformationsStorage.set(entityName, {
      ...transformations,
      transformationId,
      timestamp,
      savedAt: new Date().toISOString(),
    });

    console.log('Transformations saved to database for entity:', entityName);
    console.log('Database transformation ID:', transformationId);

    res.json({
      success: true,
      message: result.message,
      transformationId: transformationId,
      timestamp: timestamp,
      transformations: transformations,
      databaseId: result.transformation.id,
    });
  } catch (error) {
    console.error('Transformation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save transformations',
      error: error.message,
    });
  }
};

// Generate curated file function
const generateCuratedFile = async (req, res) => {
  try {
    const { entityName, curatedEntityName, sourceFileKey, transformations } =
      req.body;

    console.log('generateCuratedFile called for entity:', entityName);
    console.log('curatedEntityName:', curatedEntityName);
    console.log('sourceFileKey:', sourceFileKey);

    const {
      mappings,
      columnRules,
      operatorRules,
      concatenationRules,
      newColumns,
    } = transformations;

    // Download the raw file from S3 using sourceFileKey
    const rawFileParams = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: sourceFileKey,
    };

    const rawFileData = await s3.getObject(rawFileParams).promise();
    const rawFileContent = rawFileData.Body.toString('utf-8');

    console.log('Raw file content length:', rawFileContent.length);
    console.log('Raw file content preview:', rawFileContent.substring(0, 500));

    // Parse CSV content
    const rawRows = [];
    const lines = rawFileContent.split('\n');
    const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));

    console.log('Number of lines:', lines.length);
    console.log('Raw headers:', headers);

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i]
          .split(',')
          .map((v) => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rawRows.push(row);
      }
    }

    console.log('Parsed raw rows count:', rawRows.length);
    if (rawRows.length > 0) {
      console.log('Sample raw row:', rawRows[0]);
    }
    console.log('Mappings:', JSON.stringify(mappings, null, 2));
    console.log('Curated attributes:', transformations.curatedAttributes);

    // Apply transformations
    const transformedRows = [];
    const errors = [];
    let nlpTransformations = 0;
    let dqValidations = 0;
    let operatorFilters = 0;
    let newColumnsCount = 0;
    let concatenationsCount = 0;

    // Ensure all transformation objects exist
    const safeMappings = mappings || [];
    const safeColumnRules = columnRules || {};
    const safeOperatorRules = operatorRules || {};
    const safeConcatenationRules = concatenationRules || [];
    const safeNewColumns = newColumns || [];

    // Separate control columns from regular columns
    const controlColumns = [
      '_ingest_timestamp',
      '_source_system',
      '_record_status',
      '_update_timestamp',
      '_batch_id',
      '_created_by',
      '_updated_by',
    ];

    for (let i = 0; i < rawRows.length; i++) {
      try {
        const rawRow = rawRows[i];
        let transformedRow = {};

        console.log(`Processing row ${i + 1}:`, rawRow);

        // Apply mappings
        if (safeMappings && safeMappings.length > 0) {
          console.log('Mappings found, processing...');
          safeMappings.forEach((mapping) => {
            console.log(`Applying mapping:`, mapping);

            // Handle different mapping formats
            const rawField = mapping.raw || mapping.source || mapping.from;
            const curatedField =
              mapping.curated || mapping.target || mapping.to;

            if (!curatedField) {
              console.log('Invalid mapping format, skipping:', mapping);
              return;
            }

            // Skip control columns - they are entity-level metadata, not actual file columns
            if (
              mapping.isControlColumn ||
              mapping.isEntityLevel ||
              controlColumns.includes(curatedField)
            ) {
              console.log(
                `Skipping control column ${curatedField} - entity-level metadata only`
              );
              return;
            }

            if (mapping.isNewColumn) {
              transformedRow[curatedField] = '';
              newColumnsCount++;
              console.log(`New column ${curatedField} set to empty`);
            } else if (mapping.autogenerated) {
              switch (curatedField) {
                case 'updated_at':
                  transformedRow[curatedField] = new Date().toISOString();
                  break;
                case 'version':
                  transformedRow[curatedField] = '1.0';
                  break;
                case 'is_deleted':
                  transformedRow[curatedField] = 'false';
                  break;
                default:
                  transformedRow[curatedField] = rawRow[rawField] || '';
              }
              console.log(
                `Autogenerated column ${curatedField} = ${transformedRow[curatedField]}`
              );
            } else {
              // Try to find the field in raw data (case-insensitive)
              let rawValue = rawRow[rawField];
              if (rawValue === undefined) {
                // Try case-insensitive matching
                const rawFieldLower = rawField.toLowerCase();
                const matchingKey = Object.keys(rawRow).find(
                  (key) => key.toLowerCase() === rawFieldLower
                );
                if (matchingKey) {
                  rawValue = rawRow[matchingKey];
                  console.log(
                    `Found case-insensitive match: ${matchingKey} for ${rawField}`
                  );
                }
              }

              transformedRow[curatedField] = rawValue || '';
              console.log(
                `Direct mapping ${rawField} -> ${curatedField} = ${transformedRow[curatedField]}`
              );
            }
          });
        } else {
          // Fallback: map all raw columns to curated columns with same names
          console.log('No mappings provided, using fallback mapping strategy');
          headers.forEach((header) => {
            transformedRow[header] = rawRow[header] || '';
          });
          // Add default curated columns
          transformedRow['updated_at'] = new Date().toISOString();
          transformedRow['version'] = '1.0';
          transformedRow['is_deleted'] = 'false';
        }

        console.log(`Transformed row ${i + 1}:`, transformedRow);

        // Apply NLP transformations
        Object.keys(safeColumnRules).forEach((column) => {
          if (transformedRow[column] && safeColumnRules[column].nlp) {
            transformedRow[column] = applyNLPTransformations(
              transformedRow[column],
              safeColumnRules[column].nlp
            );
            nlpTransformations += (safeColumnRules[column].nlp || []).filter(
              (rule) => rule && rule.enabled
            ).length;
          }
        });

        // Apply data quality checks
        Object.keys(safeColumnRules).forEach((column) => {
          if (transformedRow[column] && safeColumnRules[column].dq) {
            applyDataQualityChecks(
              transformedRow[column],
              safeColumnRules[column].dq
            );
            dqValidations += (safeColumnRules[column].dq || []).filter(
              (rule) => rule && rule.enabled
            ).length;
          }
        });

        // Apply operator rules
        Object.keys(safeOperatorRules).forEach((column) => {
          if (transformedRow[column] && safeOperatorRules[column]) {
            applyOperatorRules(
              transformedRow[column],
              safeOperatorRules[column]
            );
            operatorFilters += (safeOperatorRules[column] || []).filter(
              (rule) => rule && rule.enabled
            ).length;
          }
        });

        // Apply concatenation rules
        if (safeConcatenationRules && safeConcatenationRules.length > 0) {
          transformedRow = applyConcatenationRules(
            transformedRow,
            safeConcatenationRules
          );
          concatenationsCount += safeConcatenationRules.length;
        }

        transformedRows.push(transformedRow);
      } catch (error) {
        errors.push({
          row: i + 1,
          error: error.message,
        });
      }
    }

    // Generate curated file name from curatedEntityName
    // Handle cases where curatedEntityName might be "curated.raw.entity_name" or "curated.entity_name"
    let fileName = curatedEntityName;
    if (fileName.startsWith('curated.')) {
      fileName = fileName.substring(8); // Remove "curated." prefix
    }
    // Remove any "raw." prefix if present
    if (fileName.startsWith('raw.')) {
      fileName = fileName.substring(4); // Remove "raw." prefix
    }
    const curatedFileName = `curated/${fileName}.csv`;

    console.log('Generated filename:', curatedFileName);
    console.log('Original curatedEntityName:', curatedEntityName);
    console.log('Processed fileName:', fileName);

    const curatedHeaders = transformations.curatedAttributes;

    console.log('Curated headers:', curatedHeaders);
    console.log(
      'Sample transformed row keys:',
      Object.keys(transformedRows[0] || {})
    );

    // Fallback: if no curated headers provided, use all keys from transformed data
    if (!curatedHeaders || curatedHeaders.length === 0) {
      console.log('No curated headers provided, using fallback headers');
      const allKeys = new Set();
      transformedRows.forEach((row) => {
        Object.keys(row).forEach((key) => allKeys.add(key));
      });
      const fallbackHeaders = Array.from(allKeys);
      console.log('Fallback headers:', fallbackHeaders);

      // Convert to CSV with fallback headers
      const csvContent = [fallbackHeaders.join(',')];
      transformedRows.forEach((row) => {
        const rowValues = fallbackHeaders.map((header) => {
          const value = row[header] || '';
          return `"${value}"`;
        });
        csvContent.push(rowValues.join(','));
      });

      const csvString = csvContent.join('\n');

      // Upload curated file to S3
      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: curatedFileName,
        Body: csvString,
        ContentType: 'text/csv',
      };

      const uploadResult = await s3.upload(uploadParams).promise();

      console.log('File successfully uploaded to S3:');
      console.log('  Key:', curatedFileName);
      console.log('  Location:', uploadResult.Location);
      console.log('  Size:', csvString.length, 'bytes');
      console.log('  Records processed:', transformedRows.length);

      res.json({
        success: true,
        message: 'Curated file generated successfully',
        curatedFileInfo: {
          entityName: entityName || '',
          curatedEntityName: curatedEntityName || '',
          sourceFileKey: sourceFileKey || '',
          curatedFileKey: curatedFileName || '',
          curatedFileLocation: uploadResult?.Location || '',
          fileSize: csvString?.length || 0,
          recordCount: transformedRows?.length || 0,
          generatedAt: new Date().toISOString(),
          transformationsApplied: {
            nlpTransformations: nlpTransformations || 0,
            dqValidations: dqValidations || 0,
            operatorFilters: operatorFilters || 0,
            newColumns: newColumns ? newColumns.length : 0,
            concatenations: concatenationsCount || 0,
          },
          entityLevelMetadata: {
            controlColumns: controlColumns,
            controlColumnsCount: controlColumns.length,
            note: 'Control columns are preserved in mappings for data lineage but not included in curated file',
          },
        },
      });
      return;
    }

    // Filter out control columns from curated headers for actual file generation
    const fileHeaders = curatedHeaders.filter(
      (header) => !controlColumns.includes(header)
    );
    console.log('File headers (excluding control columns):', fileHeaders);
    console.log('Control columns (entity-level only):', controlColumns);

    // Convert to CSV
    const csvContent = [fileHeaders.join(',')];
    transformedRows.forEach((row) => {
      const rowValues = fileHeaders.map((header) => {
        const value = row[header] || '';
        return `"${value}"`;
      });
      csvContent.push(rowValues.join(','));
    });

    const csvString = csvContent.join('\n');

    // Upload curated file to S3
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: curatedFileName,
      Body: csvString,
      ContentType: 'text/csv',
    };

    const uploadResult = await s3.upload(uploadParams).promise();

    console.log('File successfully uploaded to S3:');
    console.log('  Key:', curatedFileName);
    console.log('  Location:', uploadResult.Location);
    console.log('  Size:', csvString.length, 'bytes');
    console.log('  Records processed:', transformedRows.length);

    // Mark transformation as applied in database
    try {
      await AttributeTransformationService.markTransformationApplied(
        entityName,
        'curated'
      );
      console.log('Transformation marked as applied in database');
    } catch (dbError) {
      console.warn(
        'Failed to mark transformation as applied in database:',
        dbError.message
      );
    }

    res.json({
      success: true,
      message: 'Curated file generated successfully',
      curatedFileInfo: {
        entityName: entityName || '',
        curatedEntityName: curatedEntityName || '',
        sourceFileKey: sourceFileKey || '',
        curatedFileKey: curatedFileName || '',
        curatedFileLocation: uploadResult?.Location || '',
        fileSize: csvString?.length || 0,
        recordCount: transformedRows?.length || 0,
        generatedAt: new Date().toISOString(),
        transformationsApplied: {
          nlpTransformations: nlpTransformations || 0,
          dqValidations: dqValidations || 0,
          operatorFilters: operatorFilters || 0,
          newColumns: newColumns ? newColumns.length : 0,
          concatenations: concatenationsCount || 0,
        },
        entityLevelMetadata: {
          controlColumns: controlColumns,
          controlColumnsCount: controlColumns.length,
          note: 'Control columns are preserved in mappings for data lineage but not included in curated file',
        },
      },
    });
  } catch (error) {
    console.error('Curated file generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate curated file',
      error: error.message,
    });
  }
};

// Get list of gold files from S3
const getGoldFiles = async (req, res) => {
  try {
    console.log('Getting gold files from S3...');

    // List objects in the gold folder
    const listParams = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Prefix: 'gold/',
    };

    const s3Response = await s3.listObjectsV2(listParams).promise();
    const goldFiles = [];

    if (s3Response.Contents && s3Response.Contents.length > 0) {
      for (const file of s3Response.Contents) {
        // Skip the gold/ folder itself
        if (file.Key === 'gold/') continue;

        // Only include CSV files
        if (file.Key.endsWith('.csv')) {
          const fileName = file.Key.replace('gold/', '');
          const entityName = fileName.replace('.csv', '');

          goldFiles.push({
            key: file.Key,
            fileName: fileName,
            entityName: entityName,
            size: file.Size,
            lastModified: file.LastModified?.toISOString(),
            location: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${file.Key}`,
            url: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${file.Key}`,
          });
        }
      }
    }

    console.log(
      `Found ${goldFiles.length} gold files:`,
      goldFiles.map((f) => f.fileName)
    );

    res.json({
      success: true,
      message: 'Gold files retrieved successfully',
      files: goldFiles,
      count: goldFiles.length,
    });
  } catch (error) {
    console.error('Error getting gold files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get gold files',
      error: error.message,
    });
  }
};

// Generate consumption file function (for gold entity mappings)
const generateConsumptionFile = async (req, res) => {
  try {
    const {
      entityName,
      consumptionEntityName,
      sourceFileKey,
      transformations,
      localData, // Add support for local data
    } = req.body;

    console.log('generateConsumptionFile called for entity:', entityName);
    console.log('consumptionEntityName:', consumptionEntityName);
    console.log('sourceFileKey:', sourceFileKey);
    console.log('Has local data:', !!localData);

    const {
      mappings,
      columnRules,
      operatorRules,
      concatenationRules,
      newColumns,
    } = transformations;

    let goldRows = [];
    let headers = [];

    // Try to get data from S3 first, fallback to local data
    try {
      // Download the gold file from S3 using sourceFileKey
      const goldFileParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: sourceFileKey,
      };

      const goldFileData = await s3.getObject(goldFileParams).promise();
      const goldFileContent = goldFileData.Body.toString('utf-8');

      console.log('Gold file content length:', goldFileContent.length);
      console.log(
        'Gold file content preview:',
        goldFileContent.substring(0, 500)
      );

      // Parse CSV content
      const lines = goldFileContent.split('\n');
      headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));

      console.log('Number of lines:', lines.length);
      console.log('Gold headers:', headers);

      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = lines[i]
            .split(',')
            .map((v) => v.trim().replace(/"/g, ''));
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          goldRows.push(row);
        }
      }

      console.log('Parsed gold rows count from S3:', goldRows.length);
    } catch (s3Error) {
      console.log('S3 file not found, trying local data:', s3Error.message);

      // Fallback to local data if provided
      if (localData && Array.isArray(localData) && localData.length > 0) {
        console.log('Using local data as fallback');
        goldRows = localData;
        headers = Object.keys(localData[0] || {});
        console.log('Local data rows count:', goldRows.length);
        console.log('Local data headers:', headers);
      } else {
        throw new Error(
          `Gold file not found in S3 (${sourceFileKey}) and no local data provided`
        );
      }
    }

    if (goldRows.length > 0) {
      console.log('Sample gold row:', goldRows[0]);
    }
    console.log('Mappings:', JSON.stringify(mappings, null, 2));

    // Apply transformations
    const transformedRows = [];
    const errors = [];
    let nlpTransformations = 0;
    let dqValidations = 0;
    let operatorFilters = 0;
    let newColumnsCount = 0;
    let concatenationsCount = 0;

    // Ensure all transformation objects exist
    const safeMappings = mappings || [];
    const safeColumnRules = columnRules || {};
    const safeOperatorRules = operatorRules || {};
    const safeConcatenationRules = concatenationRules || [];
    const safeNewColumns = newColumns || [];

    for (let i = 0; i < goldRows.length; i++) {
      try {
        const goldRow = goldRows[i];
        let transformedRow = {};

        console.log(`Processing row ${i + 1}:`, goldRow);

        // Apply mappings
        if (safeMappings && safeMappings.length > 0) {
          console.log('Mappings found, processing...');
          safeMappings.forEach((mapping) => {
            console.log(`Applying mapping:`, mapping);

            // Handle different mapping formats for consumption
            const goldField = mapping.gold || mapping.source || mapping.from;
            const consumptionField =
              mapping.value || mapping.target || mapping.to;

            if (!consumptionField) {
              console.log('Invalid mapping format, skipping:', mapping);
              return;
            }

            if (mapping.isNewColumn) {
              transformedRow[consumptionField] = '';
              newColumnsCount++;
              console.log(`New column ${consumptionField} set to empty`);
            } else if (mapping.autogenerated) {
              // Handle autogenerated fields for consumption layer
              switch (consumptionField) {
                case 'updated_at':
                  transformedRow[consumptionField] = new Date().toISOString();
                  break;
                case 'version':
                  transformedRow[consumptionField] = '1.0';
                  break;
                case 'is_deleted':
                  transformedRow[consumptionField] = 'false';
                  break;
                default:
                  transformedRow[consumptionField] = goldRow[goldField] || '';
              }
              console.log(
                `Autogenerated column ${consumptionField} = ${transformedRow[consumptionField]}`
              );
            } else {
              // Try to find the field in gold data (case-insensitive)
              let goldValue = goldRow[goldField];
              if (goldValue === undefined) {
                // Try case-insensitive matching
                const goldFieldLower = goldField.toLowerCase();
                const matchingKey = Object.keys(goldRow).find(
                  (key) => key.toLowerCase() === goldFieldLower
                );
                if (matchingKey) {
                  goldValue = goldRow[matchingKey];
                  console.log(
                    `Found case-insensitive match: ${matchingKey} for ${goldField}`
                  );
                }
              }

              transformedRow[consumptionField] = goldValue || '';
              console.log(
                `Direct mapping ${goldField} -> ${consumptionField} = ${transformedRow[consumptionField]}`
              );
            }
          });
        } else {
          // Fallback: map all gold columns to consumption columns with same names
          console.log('No mappings provided, using fallback mapping strategy');
          headers.forEach((header) => {
            transformedRow[header] = goldRow[header] || '';
          });
          // Add default consumption columns
          transformedRow['updated_at'] = new Date().toISOString();
          transformedRow['version'] = '1.0';
          transformedRow['is_deleted'] = 'false';
        }

        console.log(`Transformed row ${i + 1}:`, transformedRow);

        // Apply NLP transformations
        Object.keys(safeColumnRules).forEach((column) => {
          if (transformedRow[column] && safeColumnRules[column].nlp) {
            transformedRow[column] = applyNLPTransformations(
              transformedRow[column],
              safeColumnRules[column].nlp
            );
            nlpTransformations += (safeColumnRules[column].nlp || []).filter(
              (rule) => rule && rule.enabled
            ).length;
          }
        });

        // Apply data quality checks
        Object.keys(safeColumnRules).forEach((column) => {
          if (transformedRow[column] && safeColumnRules[column].dq) {
            applyDataQualityChecks(
              transformedRow[column],
              safeColumnRules[column].dq
            );
            dqValidations += (safeColumnRules[column].dq || []).filter(
              (rule) => rule && rule.enabled
            ).length;
          }
        });

        // Apply operator rules
        Object.keys(safeOperatorRules).forEach((column) => {
          if (transformedRow[column] && safeOperatorRules[column]) {
            applyOperatorRules(
              transformedRow[column],
              safeOperatorRules[column]
            );
            operatorFilters += (safeOperatorRules[column] || []).filter(
              (rule) => rule && rule.enabled
            ).length;
          }
        });

        // Apply concatenation rules
        if (safeConcatenationRules && safeConcatenationRules.length > 0) {
          transformedRow = applyConcatenationRules(
            transformedRow,
            safeConcatenationRules
          );
          concatenationsCount += safeConcatenationRules.length;
        }

        transformedRows.push(transformedRow);
      } catch (error) {
        errors.push({
          row: i + 1,
          error: error.message,
        });
      }
    }

    // Generate consumption file name from consumptionEntityName
    let fileName = consumptionEntityName;
    if (fileName.startsWith('consumption.')) {
      fileName = fileName.substring(12); // Remove "consumption." prefix
    }
    // Remove any "gold." prefix if present
    if (fileName.startsWith('gold.')) {
      fileName = fileName.substring(5); // Remove "gold." prefix
    }
    const consumptionFileName = `consumption/${fileName}.csv`;

    console.log('Generated filename:', consumptionFileName);
    console.log('Original consumptionEntityName:', consumptionEntityName);
    console.log('Processed fileName:', fileName);

    // Get all unique keys from transformed data for consumption headers
    const allKeys = new Set();
    transformedRows.forEach((row) => {
      Object.keys(row).forEach((key) => allKeys.add(key));
    });
    const consumptionHeaders = Array.from(allKeys);
    console.log('Consumption headers:', consumptionHeaders);

    // Convert to CSV
    const csvContent = [consumptionHeaders.join(',')];
    transformedRows.forEach((row) => {
      const rowValues = consumptionHeaders.map((header) => {
        const value = row[header] || '';
        return `"${value}"`;
      });
      csvContent.push(rowValues.join(','));
    });

    const csvString = csvContent.join('\n');

    // Upload consumption file to S3
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: consumptionFileName,
      Body: csvString,
      ContentType: 'text/csv',
    };

    const uploadResult = await s3.upload(uploadParams).promise();

    console.log('File successfully uploaded to S3:');
    console.log('  Key:', consumptionFileName);
    console.log('  Location:', uploadResult.Location);
    console.log('  Size:', csvString.length, 'bytes');
    console.log('  Records processed:', transformedRows.length);

    // Save consumption file schema to database
    try {
      const ConsumptionFileSchemaService = require('../services/consumptionFileSchemaService');

      const schemaData = {
        entityName: consumptionEntityName,
        fileName: `${fileName}.csv`,
        fileKey: consumptionFileName,
        fileLocation: uploadResult.Location,
        fileSize: csvString.length,
        contentType: 'text/csv',
        schemaAttributes: consumptionHeaders,
        schemaMetadata: {
          totalRows: transformedRows.length,
          fileType: 'csv',
          delimiter: ',',
          transformationsApplied: {
            nlpTransformations: nlpTransformations || 0,
            dqValidations: dqValidations || 0,
            operatorFilters: operatorFilters || 0,
            newColumns: newColumns ? newColumns.length : 0,
            concatenations: concatenationsCount || 0,
          },
        },
        sourceEntities: [entityName], // Source entity used to create this consumption file
        joinRelationships: [], // No join relationships for single entity consumption
        transformations: transformations || {},
        fileData: {
          lastModified: new Date().toISOString(),
          contentLength: csvString.length,
          etag: uploadResult.ETag,
        },
        createdBy: 'system',
        notes: 'Schema extracted from generated consumption file',
      };

      const schemaResult =
        await ConsumptionFileSchemaService.saveConsumptionFileSchema(
          schemaData
        );
      console.log(
        'Consumption file schema saved to database:',
        schemaResult.message
      );
    } catch (schemaError) {
      console.warn(
        'Failed to save consumption file schema:',
        schemaError.message
      );
      // Don't fail the entire operation if schema save fails
    }

    res.json({
      success: true,
      message: 'Consumption file generated successfully',
      consumptionFileInfo: {
        entityName: entityName || '',
        consumptionEntityName: consumptionEntityName || '',
        sourceFileKey: sourceFileKey || '',
        consumptionFileKey: consumptionFileName || '',
        consumptionFileLocation: uploadResult?.Location || '',
        fileSize: csvString?.length || 0,
        recordCount: transformedRows?.length || 0,
        generatedAt: new Date().toISOString(),
        transformationsApplied: {
          nlpTransformations: nlpTransformations || 0,
          dqValidations: dqValidations || 0,
          operatorFilters: operatorFilters || 0,
          newColumns: newColumns ? newColumns.length : 0,
          concatenations: concatenationsCount || 0,
        },
        dataSource: localData ? 'local' : 's3',
      },
    });
  } catch (error) {
    console.error('Consumption file generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate consumption file',
      error: error.message,
    });
  }
};

// Get saved transformations for an entity (updated to handle both curated and consumption)
const getSavedTransformations = async (req, res) => {
  try {
    const { entityName } = req.params;
    const { fileType = 'curated' } = req.query; // Default to curated for backward compatibility

    console.log(
      'Getting saved transformations for entity:',
      entityName,
      'file type:',
      fileType
    );

    // Try to get from database first
    const dbResult = await AttributeTransformationService.getTransformation(
      entityName,
      fileType
    );

    if (dbResult.transformation) {
      console.log(
        'Found saved transformations in database for entity:',
        entityName,
        'file type:',
        fileType
      );

      // Convert database format to expected format
      const savedTransformations = {
        entityName: dbResult.transformation.entityName,
        curatedEntityName: dbResult.transformation.curatedEntityName,
        rawAttributes: dbResult.transformation.sourceAttributes, // Map from sourceAttributes back to rawAttributes
        curatedAttributes: dbResult.transformation.curatedAttributes,
        mappings: dbResult.transformation.mappings,
        columnRules: dbResult.transformation.columnRules,
        operatorRules: dbResult.transformation.operatorRules,
        concatenationRules: dbResult.transformation.concatenationRules,
        entityNLPRules: dbResult.transformation.entityNLPRules,
        columnDescriptions: dbResult.transformation.columnDescriptions,
        newColumns: dbResult.transformation.newColumns,
        entityLevelMetadata: dbResult.transformation.entityLevelMetadata,
        fileData: dbResult.transformation.fileData,
        transformationId: dbResult.transformation.transformationId,
        savedAt: dbResult.transformation.updatedAt,
        fileType: dbResult.transformation.fileType,
      };

      res.json({
        success: true,
        message: 'Saved transformations found in database',
        transformations: savedTransformations,
        fileType: fileType,
        databaseId: dbResult.transformation.id,
      });
    } else {
      // Fallback to in-memory storage
      console.log(
        'No saved transformations found in database, checking in-memory storage'
      );

      const storageKey = `${entityName}_${fileType}`;
      const savedTransformations = transformationsStorage.get(storageKey);

      if (savedTransformations) {
        console.log(
          'Found saved transformations in memory for entity:',
          entityName,
          'file type:',
          fileType
        );
        res.json({
          success: true,
          message: 'Saved transformations found in memory',
          transformations: savedTransformations,
          fileType: fileType,
        });
      } else {
        console.log(
          'No saved transformations found for entity:',
          entityName,
          'file type:',
          fileType
        );
        res.json({
          success: true,
          message: 'No saved transformations found',
          transformations: null,
          fileType: fileType,
        });
      }
    }
  } catch (error) {
    console.error('Error getting saved transformations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get saved transformations',
      error: error.message,
    });
  }
};

// Get list of curated files from S3
const getCuratedFiles = async (req, res) => {
  try {
    console.log('Getting curated files from S3...');

    // List objects in the curated folder
    const listParams = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Prefix: 'curated/',
    };

    const s3Response = await s3.listObjectsV2(listParams).promise();
    const curatedFiles = [];

    if (s3Response.Contents && s3Response.Contents.length > 0) {
      for (const file of s3Response.Contents) {
        // Skip the curated/ folder itself
        if (file.Key === 'curated/') continue;

        // Only include CSV files
        if (file.Key.endsWith('.csv')) {
          const fileName = file.Key.replace('curated/', '');
          const entityName = fileName.replace('.csv', '');

          curatedFiles.push({
            key: file.Key,
            fileName: fileName,
            entityName: entityName,
            size: file.Size,
            lastModified: file.LastModified?.toISOString(),
            location: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${file.Key}`,
            url: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${file.Key}`,
          });
        }
      }
    }

    console.log(
      `Found ${curatedFiles.length} curated files:`,
      curatedFiles.map((f) => f.fileName)
    );

    res.json({
      success: true,
      message: 'Curated files retrieved successfully',
      files: curatedFiles,
      count: curatedFiles.length,
    });
  } catch (error) {
    console.error('Error getting curated files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get curated files',
      error: error.message,
    });
  }
};

// Endpoint: Get real columns from all curated files
// GET /api/curated/columns/all
const getAllCuratedFileColumns = async (req, res) => {
  try {
    const curatedDir = path.join(__dirname, '..', 'curated');
    const files = fs.readdirSync(curatedDir).filter((f) => f.endsWith('.csv'));
    const result = {};
    for (const file of files) {
      const filePath = path.join(curatedDir, file);
      const data = fs.readFileSync(filePath, 'utf8');
      const firstLine = data.split(/\r?\n/)[0];
      const columns = firstLine
        .split(',')
        .map((col) => col.trim().replace(/^"|"$/g, ''));
      const fileNameNoExt = file.replace(/\.csv$/, '');
      result[fileNameNoExt] = columns;
    }
    res.json(result);
  } catch (err) {
    res
      .status(500)
      .json({ error: 'Failed to read curated files', details: err.message });
  }
};

// Get list of consumption files from S3
const getConsumptionFiles = async (req, res) => {
  try {
    console.log('Getting consumption files from S3...');

    // List objects in the consumption folder
    const listParams = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Prefix: 'consumption/',
    };

    const s3Response = await s3.listObjectsV2(listParams).promise();
    const consumptionFiles = [];

    if (s3Response.Contents && s3Response.Contents.length > 0) {
      for (const file of s3Response.Contents) {
        // Skip the consumption/ folder itself
        if (file.Key === 'consumption/') continue;

        // Only include CSV files
        if (file.Key.endsWith('.csv')) {
          const fileName = file.Key.replace('consumption/', '');
          const entityName = fileName.replace('.csv', '');

          consumptionFiles.push({
            key: file.Key,
            fileName: fileName,
            entityName: entityName,
            size: file.Size,
            lastModified: file.LastModified?.toISOString(),
            location: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${file.Key}`,
            url: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${file.Key}`,
          });
        }
      }
    }

    console.log(
      `Found ${consumptionFiles.length} consumption files:`,
      consumptionFiles.map((f) => f.fileName)
    );

    res.json({
      success: true,
      message: 'Consumption files retrieved successfully',
      files: consumptionFiles,
      count: consumptionFiles.length,
    });
  } catch (error) {
    console.error('Error getting consumption files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get consumption files',
      error: error.message,
    });
  }
};

// Save transformations for gold entity mappings (updated to handle both curated and consumption)
const saveTransformations = async (req, res) => {
  try {
    const { entityName, transformations, fileType = 'curated' } = req.body;

    console.log('saveTransformations called for entity:', entityName);
    console.log('File type:', fileType);
    console.log(
      'This function saves transformation metadata to database for both curated and consumption files'
    );

    // Save transformation metadata to database
    const transformationData = {
      entityName,
      curatedEntityName:
        transformations.curatedEntityName ||
        `curated.${entityName.replace('raw.', '')}`,
      fileType,
      sourceAttributes: transformations.rawAttributes || [],
      curatedAttributes: transformations.curatedAttributes || [],
      mappings: transformations.mappings || [],
      columnRules: transformations.columnRules || {},
      operatorRules: transformations.operatorRules || {},
      concatenationRules: transformations.concatenationRules || [],
      entityNLPRules: transformations.entityNLPRules || [],
      columnDescriptions: transformations.columnDescriptions || {},
      newColumns: transformations.newColumns || [],
      entityLevelMetadata: transformations.entityLevelMetadata || {},
      fileData: transformations.fileData || {},
      createdBy: 'system',
      notes: `Saved via saveTransformations endpoint for ${fileType} file type`,
    };

    const result = await AttributeTransformationService.saveTransformation(
      transformationData
    );

    // Also keep in-memory storage for backward compatibility
    const transformationId = result.transformation.transformationId;
    const timestamp = new Date().toISOString();

    const storageKey = `${entityName}_${fileType}`;
    transformationsStorage.set(storageKey, {
      ...transformations,
      transformationId,
      timestamp,
      savedAt: new Date().toISOString(),
      fileType: fileType,
    });

    console.log(
      'Transformations saved to database for entity:',
      entityName,
      'file type:',
      fileType
    );
    console.log('Database transformation ID:', transformationId);

    res.json({
      success: true,
      message: result.message,
      transformationId: transformationId,
      timestamp: timestamp,
      fileType: fileType,
      transformations: transformations,
      databaseId: result.transformation.id,
    });
  } catch (error) {
    console.error('Transformation save error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save transformations',
      error: error.message,
    });
  }
};

// AI Consumption Files Endpoint
const getAIConsumptionFiles = async (req, res) => {
  try {
    // Extract pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    // Helper to parse CSV file
    const parseCSV = (filePath) => {
      return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', (err) => reject(err));
      });
    };

    // Mock LLM call simulation - add a small delay to simulate AI processing
    console.log('🤖 Simulating LLM call to analyze consumption files...');
    await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5 second delay
    console.log('✅ LLM analysis complete!');

    const dataDir = path.join(__dirname, '../data');
    const consumptionFilesDir = path.join(dataDir, 'consumptionfiles');

    // Parse consumption files
    const consumptionFiles = fs
      .readdirSync(consumptionFilesDir)
      .filter((f) => f.endsWith('.csv'));
    const consumptionData = {};

    for (const file of consumptionFiles) {
      try {
        const filePath = path.join(consumptionFilesDir, file);
        const data = await parseCSV(filePath);
        consumptionData[file.replace('.csv', '')] = data;
      } catch (error) {
        console.warn(`Failed to parse ${file}:`, error.message);
      }
    }

    // Generate AI-suggested consumption files from the consumptionfiles folder
    const aiGeneratedFiles = consumptionFiles.map((file) => {
      const fileName = file.replace('.csv', '');
      const data = consumptionData[fileName] || [];
      const sampleRecord = data[0] || {};
      const columns = Object.keys(sampleRecord);

      // Generate description based on file name
      let description = '';
      let entities = [];
      let outputColumns = [];

      if (fileName.includes('customer_kpi')) {
        description =
          'Customer Key Performance Indicators with ARPU, LTV, and Churn Risk analysis (AI-generated)';
        entities = ['customers', 'customer_metrics'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'customer_metrics',
          sourceField: col,
          aggregation:
            col.includes('Score') || col.includes('Tenure') ? 'AVG' : 'NONE',
        }));
      } else if (fileName.includes('fact_customer_lifecycle')) {
        description =
          'Customer lifecycle events and journey tracking (AI-generated)';
        entities = ['customers', 'customer_events'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'customer_events',
          sourceField: col,
          aggregation: col === 'EventDate' ? 'MAX' : 'NONE',
        }));
      } else if (fileName.includes('fact_invoice')) {
        description =
          'Invoice and billing data with payment tracking (AI-generated)';
        entities = ['customers', 'invoices', 'payments'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'invoices',
          sourceField: col,
          aggregation: col.includes('Amount') ? 'SUM' : 'NONE',
        }));
      } else if (fileName.includes('fact_usage')) {
        description =
          'Service usage patterns and consumption metrics (AI-generated)';
        entities = ['customers', 'services', 'usage'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'usage',
          sourceField: col,
          aggregation: col.includes('Usage') ? 'SUM' : 'NONE',
        }));
      } else if (fileName.includes('subscriber_kpi')) {
        description =
          'Subscriber performance metrics and engagement scores (AI-generated)';
        entities = ['subscribers', 'subscriber_metrics'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'subscriber_metrics',
          sourceField: col,
          aggregation: col.includes('Score') ? 'AVG' : 'NONE',
        }));
      } else if (fileName.includes('product')) {
        description = 'Product catalog and service offerings (AI-generated)';
        entities = ['products', 'services'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'products',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('service')) {
        description = 'Service definitions and configurations (AI-generated)';
        entities = ['services'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'services',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('contract')) {
        description = 'Contract and agreement management data (AI-generated)';
        entities = ['customers', 'contracts'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'contracts',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('device_resource')) {
        description = 'Device and resource allocation tracking (AI-generated)';
        entities = ['devices', 'resources'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'devices',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('subscriber')) {
        description = 'Subscriber profile and subscription data (AI-generated)';
        entities = ['subscribers'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'subscribers',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('account')) {
        description =
          'Account management and billing information (AI-generated)';
        entities = ['accounts', 'customers'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'accounts',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('address')) {
        description = 'Address and location data management (AI-generated)';
        entities = ['addresses', 'customers'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'addresses',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('customer_party')) {
        description =
          'Customer party and relationship management (AI-generated)';
        entities = ['customers', 'parties'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'parties',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('contact_point')) {
        description =
          'Contact information and communication channels (AI-generated)';
        entities = ['contacts', 'customers'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'contacts',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('payment_method')) {
        description = 'Payment method preferences and security (AI-generated)';
        entities = ['customers', 'payment_methods'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'payment_methods',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('invoice')) {
        description =
          'Invoice generation and billing cycle management (AI-generated)';
        entities = ['invoices', 'customers'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'invoices',
          sourceField: col,
          aggregation: col.includes('Amount') ? 'SUM' : 'NONE',
        }));
      } else if (fileName.includes('dimorder')) {
        description = 'Order dimension and classification data (AI-generated)';
        entities = ['orders', 'order_dimensions'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'order_dimensions',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('dimorderitem')) {
        description = 'Order item details and line-level data (AI-generated)';
        entities = ['orders', 'order_items'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'order_items',
          sourceField: col,
          aggregation: col.includes('Quantity') ? 'SUM' : 'NONE',
        }));
      } else {
        description = `${fileName.replace(
          /_/g,
          ' '
        )} data analysis (AI-generated)`;
        entities = [fileName.split('_')[0] + 's'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: entities[0],
          sourceField: col,
          aggregation: 'NONE',
        }));
      }

      return {
        id: fileName,
        name: fileName,
        description: description,
        entities: entities,
        outputColumns: outputColumns,
        createdAt: new Date().toISOString(),
        status: 'ai-generated',
        source: 'AI',
        recordCount: data.length,
        sampleData: data.slice(0, 3), // Include first 3 records as sample
      };
    });

    // Add special AI-generated entities that are created dynamically
    const specialAIEntities = [];

    // Combine regular AI files with special AI entities
    let allAIFiles = [...aiGeneratedFiles, ...specialAIEntities];

    // Apply search filter if provided
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      allAIFiles = allAIFiles.filter(
        (file) =>
          file.name.toLowerCase().includes(searchLower) ||
          file.description.toLowerCase().includes(searchLower) ||
          file.entities.some((entity) =>
            entity.toLowerCase().includes(searchLower)
          )
      );
    }

    // Get total count for pagination
    const totalCount = allAIFiles.length;

    // Apply pagination
    const paginatedFiles = allAIFiles.slice(offset, offset + limit);

    res.json({
      consumptionData: consumptionData, // Include the actual data for frontend use
      files: paginatedFiles, // Return paginated files
      totalCount: totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      limit: limit,
      search: search,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to generate AI consumption files',
      details: err.message,
    });
  }
};

// AI Curated Files Endpoint
const getAICuratedFiles = async (req, res) => {
  try {
    // Helper to parse CSV file
    const parseCSV = (filePath) => {
      return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', (err) => reject(err));
      });
    };

    // Mock LLM call simulation - add a small delay to simulate AI processing
    console.log('🤖 Simulating LLM call to analyze curated files...');
    await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5 second delay
    console.log('✅ LLM analysis complete!');

    const dataDir = path.join(__dirname, '../data');
    const curatedFilesDir = path.join(dataDir, 'curatedfiles');

    // Parse curated files
    const curatedFiles = fs
      .readdirSync(curatedFilesDir)
      .filter((f) => f.endsWith('.csv'));
    const curatedData = {};

    for (const file of curatedFiles) {
      try {
        const filePath = path.join(curatedFilesDir, file);
        const data = await parseCSV(filePath);
        curatedData[file.replace('.csv', '')] = data;
      } catch (error) {
        console.warn(`Failed to parse ${file}:`, error.message);
      }
    }

    // Generate AI-suggested curated files from the curatedfiles folder
    const aiGeneratedFiles = curatedFiles.map((file) => {
      const fileName = file.replace('.csv', '');
      const data = curatedData[fileName] || [];
      const sampleRecord = data[0] || {};
      const columns = Object.keys(sampleRecord);

      // Generate description based on file name
      let description = '';
      let entities = [];
      let outputColumns = [];

      if (fileName.includes('customer_kpi')) {
        description =
          'Customer Key Performance Indicators with ARPU, LTV, and Churn Risk analysis (Curated)';
        entities = ['customers', 'customer_metrics'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'customer_metrics',
          sourceField: col,
          aggregation:
            col.includes('Score') || col.includes('Tenure') ? 'AVG' : 'NONE',
        }));
      } else if (fileName.includes('subscriber_kpi')) {
        description =
          'Subscriber performance metrics and engagement scores (Curated)';
        entities = ['subscribers', 'subscriber_metrics'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'subscriber_metrics',
          sourceField: col,
          aggregation: col.includes('Score') ? 'AVG' : 'NONE',
        }));
      } else if (fileName.includes('account')) {
        description = 'Account management and billing information (Curated)';
        entities = ['accounts', 'customers'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'accounts',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('contract')) {
        description = 'Contract and agreement management data (Curated)';
        entities = ['customers', 'contracts'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'contracts',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('customer_party')) {
        description = 'Customer party and relationship management (Curated)';
        entities = ['customers', 'parties'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'parties',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('dimorder')) {
        description = 'Order dimension and classification data (Curated)';
        entities = ['orders', 'order_dimensions'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'order_dimensions',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('dimorderitem')) {
        description = 'Order item details and line-level data (Curated)';
        entities = ['orders', 'order_items'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'order_items',
          sourceField: col,
          aggregation: col.includes('Quantity') ? 'SUM' : 'NONE',
        }));
      } else if (fileName.includes('invoice')) {
        description =
          'Invoice generation and billing cycle management (Curated)';
        entities = ['invoices', 'customers'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'invoices',
          sourceField: col,
          aggregation: col.includes('Amount') ? 'SUM' : 'NONE',
        }));
      } else if (fileName.includes('payment_method')) {
        description = 'Payment method preferences and security (Curated)';
        entities = ['customers', 'payment_methods'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'payment_methods',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('product')) {
        description = 'Product catalog and service offerings (Curated)';
        entities = ['products', 'services'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'products',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('service')) {
        description = 'Service definitions and configurations (Curated)';
        entities = ['services'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'services',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('device_resource')) {
        description = 'Device and resource allocation tracking (Curated)';
        entities = ['devices', 'resources'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'devices',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('subscriber')) {
        description = 'Subscriber profile and subscription data (Curated)';
        entities = ['subscribers'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'subscribers',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('address')) {
        description = 'Address and location data management (Curated)';
        entities = ['addresses', 'customers'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'addresses',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('contact_point')) {
        description =
          'Contact information and communication channels (Curated)';
        entities = ['contacts', 'customers'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'contacts',
          sourceField: col,
          aggregation: 'NONE',
        }));
      } else if (fileName.includes('fact_usage')) {
        description =
          'Service usage patterns and consumption metrics (Curated)';
        entities = ['customers', 'services', 'usage'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: 'usage',
          sourceField: col,
          aggregation: col.includes('Usage') ? 'SUM' : 'NONE',
        }));
      } else {
        description = `${fileName.replace(/_/g, ' ')} data analysis (Curated)`;
        entities = [fileName.split('_')[0] + 's'];
        outputColumns = columns.map((col) => ({
          name: col,
          sourceEntity: entities[0],
          sourceField: col,
          aggregation: 'NONE',
        }));
      }

      return {
        id: fileName,
        name: fileName,
        description: description,
        entities: entities,
        outputColumns: outputColumns,
        createdAt: new Date().toISOString(),
        status: 'curated',
        recordCount: data.length,
        sampleData: data.slice(0, 3), // Include first 3 records as sample
      };
    });

    res.json({
      curatedData: curatedData, // Include the actual data for frontend use
      files: aiGeneratedFiles, // Only return the AI-generated files from curatedfiles folder
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to generate AI curated files',
      details: err.message,
    });
  }
};

// Get consumption file columns/attributes
const getConsumptionFileColumns = async (req, res) => {
  try {
    const { fileName } = req.params;

    console.log('Getting columns for consumption file:', fileName);

    // Construct the S3 key for the consumption file
    const s3Key = `consumption/${fileName}.csv`;

    // Get the file from S3
    const fileParams = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: s3Key,
    };

    const fileData = await s3.getObject(fileParams).promise();
    const fileContent = fileData.Body.toString('utf-8');

    // Parse CSV header
    const lines = fileContent.split('\n');
    if (lines.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File is empty or invalid',
      });
    }

    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(';')) delimiter = ';';

    const columns = firstLine
      .split(delimiter)
      .map((h) => h.trim().replace(/^"|"$/g, ''))
      .filter((h) => h.length > 0); // Remove empty columns

    console.log(`Found ${columns.length} columns in ${fileName}:`, columns);

    res.json({
      success: true,
      message: 'Consumption file columns retrieved successfully',
      fileName: fileName,
      columns: columns,
      count: columns.length,
    });
  } catch (error) {
    console.error('Error getting consumption file columns:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get consumption file columns',
      error: error.message,
    });
  }
};

module.exports = {
  transformData,
  generateCuratedFile,
  getSavedTransformations,
  getCuratedFiles,
  getAllCuratedFileColumns,
  getAIConsumptionFiles,
  generateConsumptionFile,
  getConsumptionFiles,
  getConsumptionFileColumns,
  saveTransformations,
  getGoldFiles,
  getAICuratedFiles,
};
