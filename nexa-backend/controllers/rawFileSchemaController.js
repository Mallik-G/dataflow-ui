const AWS = require('aws-sdk');
const RawFileSchemaService = require('../services/rawFileSchemaService');

// Initialize S3 client
const s3 = new AWS.S3({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION,
});

// Save raw file schema when file is uploaded
const saveRawFileSchema = async (req, res) => {
  try {
    const {
      entityName,
      fileKey,
      fileName,
      fileLocation,
      fileSize,
      contentType,
      schemaAttributes,
      schemaMetadata,
      fileData,
      createdBy,
      notes,
      processingMode,
    } = req.body;

    console.log('saveRawFileSchema called for entity:', entityName);
    console.log('File key:', fileKey);
    console.log('File name:', fileName);
    console.log('Processing mode:', processingMode);

    let finalSchemaAttributes = schemaAttributes;
    let finalSchemaMetadata = schemaMetadata;
    let finalFileData = fileData;

    // If schema data is not provided in request body, extract from S3 file
    if (!schemaAttributes || !schemaMetadata) {
      console.log('Schema data not provided, extracting from S3 file...');

      // Download the file from S3 to extract schema
      const fileParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileKey,
      };

      const s3FileData = await s3.getObject(fileParams).promise();
      const fileContent = s3FileData.Body.toString('utf-8');

      console.log('File content length:', fileContent.length);
      console.log('File content preview:', fileContent.substring(0, 500));

      // Extract schema from file content
      const extractedSchema = RawFileSchemaService.extractSchemaFromContent(
        fileContent,
        fileName,
        contentType
      );

      finalSchemaAttributes = extractedSchema.schemaAttributes;
      finalSchemaMetadata = extractedSchema.schemaMetadata;
      finalFileData = {
        lastModified: s3FileData.LastModified?.toISOString(),
        contentLength: s3FileData.ContentLength,
        etag: s3FileData.ETag,
      };
    } else {
      console.log(
        'Schema data provided in request body, using provided data...'
      );
    }

    console.log('Final schema attributes:', finalSchemaAttributes);
    console.log('Final schema metadata:', finalSchemaMetadata);

    // Save schema to database
    const schemaData = {
      entityName,
      fileName,
      fileKey,
      fileLocation,
      fileSize,
      contentType,
      schemaAttributes: finalSchemaAttributes,
      schemaMetadata: finalSchemaMetadata,
      fileData: finalFileData,
      createdBy: createdBy || 'system',
      notes: notes || 'Schema extracted from uploaded file',
      processingMode: processingMode || 'file-and-schema',
    };

    const result = await RawFileSchemaService.saveRawFileSchema(schemaData);

    console.log('Raw file schema saved to database for entity:', entityName);
    console.log('Database schema ID:', result.schema.schemaId);

    res.json({
      success: true,
      message: result.message,
      schemaId: result.schema.schemaId,
      entityName: entityName,
      schemaAttributes: finalSchemaAttributes,
      schemaMetadata: finalSchemaMetadata,
      databaseId: result.schema.id,
    });
  } catch (error) {
    console.error('Raw file schema save error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save raw file schema',
      error: error.message,
    });
  }
};

// Get raw file schema for an entity
const getRawFileSchema = async (req, res) => {
  try {
    const { entityName } = req.params;

    console.log('Getting raw file schema for entity:', entityName);

    const result = await RawFileSchemaService.getRawFileSchema(entityName);

    if (result.schema) {
      console.log('Found raw file schema in database for entity:', entityName);
      res.json({
        success: true,
        message: result.message,
        schema: result.schema,
        entityName: entityName,
      });
    } else {
      console.log('No raw file schema found for entity:', entityName);
      res.json({
        success: true,
        message: result.message,
        schema: null,
        entityName: entityName,
      });
    }
  } catch (error) {
    console.error('Error getting raw file schema:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get raw file schema',
      error: error.message,
    });
  }
};

// Get all raw file schemas with optional filtering, pagination, and search
const getAllRawFileSchemas = async (req, res) => {
  try {
    // Extract pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;

    // Extract search and filter parameters
    const filters = {
      entityName: req.query.entityName,
      status: req.query.status,
      createdBy: req.query.createdBy,
      search: req.query.search, // New search parameter
      sortBy: req.query.sortBy, // New sort parameter
    };

    console.log(
      'Getting all raw file schemas with filters:',
      filters,
      'page:',
      page,
      'limit:',
      limit
    );

    const result = await RawFileSchemaService.getAllRawFileSchemas(filters, {
      page,
      limit,
      offset,
    });

    res.json({
      success: true,
      message: result.message,
      schemas: result.schemas,
      totalCount: result.totalCount,
      currentPage: page,
      totalPages: Math.ceil(result.totalCount / limit),
      limit: limit,
      filters: filters,
    });
  } catch (error) {
    console.error('Error getting all raw file schemas:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get raw file schemas',
      error: error.message,
    });
  }
};

// Update raw file schema status
const updateRawFileSchemaStatus = async (req, res) => {
  try {
    const { entityName } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    console.log(
      'Updating raw file schema status for entity:',
      entityName,
      'to:',
      status
    );

    const result = await RawFileSchemaService.updateRawFileSchemaStatus(
      entityName,
      status
    );

    res.json(result);
  } catch (error) {
    console.error('Error updating raw file schema status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update raw file schema status',
      error: error.message,
    });
  }
};

// Delete raw file schema (soft delete)
const deleteRawFileSchema = async (req, res) => {
  try {
    const { entityName } = req.params;

    console.log('Deleting raw file schema for entity:', entityName);

    const result = await RawFileSchemaService.deleteRawFileSchema(entityName);

    res.json(result);
  } catch (error) {
    console.error('Error deleting raw file schema:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete raw file schema',
      error: error.message,
    });
  }
};

// Get raw file schema statistics
const getRawFileSchemaStats = async (req, res) => {
  try {
    console.log('Getting raw file schema statistics');

    const result = await RawFileSchemaService.getRawFileSchemaStats();

    res.json(result);
  } catch (error) {
    console.error('Error getting raw file schema stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get raw file schema statistics',
      error: error.message,
    });
  }
};

// Extract schema from file content (utility endpoint)
const extractSchemaFromFile = async (req, res) => {
  try {
    const { fileContent, fileName, contentType } = req.body;

    if (!fileContent || !fileName) {
      return res.status(400).json({
        success: false,
        message: 'File content and file name are required',
      });
    }

    console.log('Extracting schema from file:', fileName);

    const { schemaAttributes, schemaMetadata } =
      RawFileSchemaService.extractSchemaFromContent(
        fileContent,
        fileName,
        contentType
      );

    console.log('Extracted schema attributes:', schemaAttributes);
    console.log('Schema metadata:', schemaMetadata);

    res.json({
      success: true,
      message: 'Schema extracted successfully',
      schemaAttributes: schemaAttributes,
      schemaMetadata: schemaMetadata,
      fileName: fileName,
    });
  } catch (error) {
    console.error('Error extracting schema from file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to extract schema from file',
      error: error.message,
    });
  }
};

// Generate control columns for an entity (mockup of LLM generation)
const generateControlColumns = async (req, res) => {
  try {
    const { entityName } = req.params;

    console.log('Generating control columns for entity:', entityName);

    // Mockup of LLM-generated control columns based on entity type
    const controlColumns = [
      {
        name: '_ingest_timestamp',
        description:
          'Records when data was ingested into the system. Automatically populated by the data pipeline.',
        dataType: 'TIMESTAMP',
        isRequired: true,
        isSystem: true,
      },
      {
        name: '_source_system',
        description:
          'Identifies the source system that provided the data. Used for data lineage tracking.',
        dataType: 'VARCHAR(100)',
        isRequired: true,
        isSystem: true,
      },
      {
        name: '_record_status',
        description:
          'Status after validation (valid/quarantined/error). Indicates data quality assessment.',
        dataType: 'VARCHAR(20)',
        isRequired: true,
        isSystem: true,
      },
      {
        name: '_update_timestamp',
        description:
          'Last update time in the silver/curated layer. Tracks when the record was last modified.',
        dataType: 'TIMESTAMP',
        isRequired: true,
        isSystem: true,
      },
      {
        name: '_batch_id',
        description:
          'Associates records with a specific processing batch. Used for batch processing and error tracking.',
        dataType: 'VARCHAR(50)',
        isRequired: true,
        isSystem: true,
      },
      {
        name: '_created_by',
        description:
          'Process or user that created the record. Tracks data origin and responsibility.',
        dataType: 'VARCHAR(100)',
        isRequired: true,
        isSystem: true,
      },
      {
        name: '_updated_by',
        description:
          'Process or user that last updated the record. Maintains audit trail of changes.',
        dataType: 'VARCHAR(100)',
        isRequired: true,
        isSystem: true,
      },
    ];

    // Add entity-specific control columns based on entity type
    const entityType = entityName.toLowerCase();
    if (entityType.includes('customer')) {
      controlColumns.push({
        name: '_customer_segment',
        description:
          'Customer segmentation based on business rules and data analysis.',
        dataType: 'VARCHAR(50)',
        isRequired: false,
        isSystem: true,
      });
    } else if (entityType.includes('product')) {
      controlColumns.push({
        name: '_product_category_level',
        description:
          'Hierarchical level of product categorization for analytics.',
        dataType: 'INTEGER',
        isRequired: false,
        isSystem: true,
      });
    } else if (entityType.includes('order')) {
      controlColumns.push({
        name: '_order_priority',
        description: 'Order priority classification based on business rules.',
        dataType: 'VARCHAR(20)',
        isRequired: false,
        isSystem: true,
      });
    }

    res.json({
      success: true,
      message: 'Control columns generated successfully',
      entityName: entityName,
      controlColumns: controlColumns,
      generatedBy: 'LLM-Mockup',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating control columns:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate control columns',
      error: error.message,
    });
  }
};

// Generate column metadata (datatypes and descriptions) for an entity
const generateColumnMetadata = async (req, res) => {
  try {
    const { entityName } = req.params;

    console.log('Generating column metadata for entity:', entityName);

    // Get the existing schema for this entity
    const result = await RawFileSchemaService.getRawFileSchema(entityName);

    if (!result.schema) {
      return res.status(404).json({
        success: false,
        message: 'No schema found for this entity',
        entityName: entityName,
      });
    }

    const schema = result.schema;
    const schemaAttributes = schema.schemaAttributes || [];

    if (schemaAttributes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No columns found in schema',
        entityName: entityName,
      });
    }

    // Generate metadata for each column
    const columnMetadata = schemaAttributes.map((attr) => {
      const dataType = {
        type: attr.dataType || 'string',
        nullable: attr.nullable !== false, // Default to nullable if not specified
      };

      const description =
        attr.description ||
        RawFileSchemaService.generateColumnDescription(attr.name, dataType);

      return {
        columnName: attr.name,
        dataType: dataType.type,
        nullable: dataType.nullable,
        description: description,
        sampleValues: attr.sampleValues || [],
        statistics: attr.statistics || {},
        isGenerated: !attr.description, // Flag to indicate if description was auto-generated
      };
    });

    res.json({
      success: true,
      message: 'Column metadata generated successfully',
      entityName: entityName,
      columnMetadata: columnMetadata,
      totalColumns: columnMetadata.length,
      generatedBy: 'Auto-Generation',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating column metadata:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate column metadata',
      error: error.message,
    });
  }
};

module.exports = {
  saveRawFileSchema,
  getRawFileSchema,
  getAllRawFileSchemas,
  updateRawFileSchemaStatus,
  deleteRawFileSchema,
  getRawFileSchemaStats,
  extractSchemaFromFile,
  generateControlColumns,
  generateColumnMetadata,
};
