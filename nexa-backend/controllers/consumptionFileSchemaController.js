const AWS = require('aws-sdk');
const ConsumptionFileSchemaService = require('../services/consumptionFileSchemaService');

// Initialize S3 client
const s3 = new AWS.S3({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION,
});

// Save consumption file schema when file is generated
const saveConsumptionFileSchema = async (req, res) => {
  try {
    const {
      entityName,
      fileKey,
      fileName,
      fileLocation,
      fileSize,
      contentType,
      sourceEntities,
      joinRelationships,
      transformations,
    } = req.body;

    console.log('saveConsumptionFileSchema called for entity:', entityName);
    console.log('File key:', fileKey);
    console.log('File name:', fileName);

    // Download the file from S3 to extract schema
    const fileParams = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileKey,
    };

    const fileData = await s3.getObject(fileParams).promise();
    const fileContent = fileData.Body.toString('utf-8');

    console.log('File content length:', fileContent.length);
    console.log('File content preview:', fileContent.substring(0, 500));

    // Extract schema from file content
    const { schemaAttributes, schemaMetadata } =
      ConsumptionFileSchemaService.extractSchemaFromContent(
        fileContent,
        fileName,
        contentType
      );

    console.log('Extracted schema attributes:', schemaAttributes);
    console.log('Schema metadata:', schemaMetadata);

    // Save schema to database
    const schemaData = {
      entityName,
      fileName,
      fileKey,
      fileLocation,
      fileSize,
      contentType,
      schemaAttributes,
      schemaMetadata,
      sourceEntities: sourceEntities || [],
      joinRelationships: joinRelationships || [],
      transformations: transformations || {},
      fileData: {
        lastModified: fileData.LastModified?.toISOString(),
        contentLength: fileData.ContentLength,
        etag: fileData.ETag,
      },
      createdBy: 'system',
      notes: 'Schema extracted from generated consumption file',
    };

    const result = await ConsumptionFileSchemaService.saveConsumptionFileSchema(
      schemaData
    );

    console.log(
      'Consumption file schema saved to database for entity:',
      entityName
    );
    console.log('Database schema ID:', result.schema.schemaId);

    res.json({
      success: true,
      message: result.message,
      schemaId: result.schema.schemaId,
      entityName: entityName,
      schemaAttributes: schemaAttributes,
      schemaMetadata: schemaMetadata,
      databaseId: result.schema.id,
    });
  } catch (error) {
    console.error('Consumption file schema save error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save consumption file schema',
      error: error.message,
    });
  }
};

// Get consumption file schema for an entity
const getConsumptionFileSchema = async (req, res) => {
  try {
    const { entityName } = req.params;

    console.log('Getting consumption file schema for entity:', entityName);

    const result = await ConsumptionFileSchemaService.getConsumptionFileSchema(
      entityName
    );

    if (result.schema) {
      console.log(
        'Found consumption file schema in database for entity:',
        entityName
      );
      res.json({
        success: true,
        message: result.message,
        schema: result.schema,
        entityName: entityName,
      });
    } else {
      console.log('No consumption file schema found for entity:', entityName);
      res.json({
        success: true,
        message: result.message,
        schema: null,
        entityName: entityName,
      });
    }
  } catch (error) {
    console.error('Error getting consumption file schema:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get consumption file schema',
      error: error.message,
    });
  }
};

// Get all consumption file schemas with optional filtering, pagination, and search
const getAllConsumptionFileSchemas = async (req, res) => {
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
    };

    console.log(
      'Getting all consumption file schemas with filters:',
      filters,
      'page:',
      page,
      'limit:',
      limit
    );

    const result =
      await ConsumptionFileSchemaService.getAllConsumptionFileSchemas(filters, {
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
    console.error('Error getting all consumption file schemas:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get consumption file schemas',
      error: error.message,
    });
  }
};

// Update consumption file schema status
const updateConsumptionFileSchemaStatus = async (req, res) => {
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
      'Updating consumption file schema status for entity:',
      entityName,
      'to:',
      status
    );

    const result =
      await ConsumptionFileSchemaService.updateConsumptionFileSchemaStatus(
        entityName,
        status
      );

    res.json(result);
  } catch (error) {
    console.error('Error updating consumption file schema status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update consumption file schema status',
      error: error.message,
    });
  }
};

// Delete consumption file schema (soft delete)
const deleteConsumptionFileSchema = async (req, res) => {
  try {
    const { entityName } = req.params;

    console.log('Deleting consumption file schema for entity:', entityName);

    const result =
      await ConsumptionFileSchemaService.deleteConsumptionFileSchema(
        entityName
      );

    res.json(result);
  } catch (error) {
    console.error('Error deleting consumption file schema:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete consumption file schema',
      error: error.message,
    });
  }
};

// Get consumption file schema statistics
const getConsumptionFileSchemaStats = async (req, res) => {
  try {
    console.log('Getting consumption file schema statistics');

    const result =
      await ConsumptionFileSchemaService.getConsumptionFileSchemaStats();

    res.json(result);
  } catch (error) {
    console.error('Error getting consumption file schema stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get consumption file schema statistics',
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

    console.log('Extracting schema from consumption file:', fileName);

    const { schemaAttributes, schemaMetadata } =
      ConsumptionFileSchemaService.extractSchemaFromContent(
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
    console.error('Error extracting schema from consumption file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to extract schema from consumption file',
      error: error.message,
    });
  }
};

module.exports = {
  saveConsumptionFileSchema,
  getConsumptionFileSchema,
  getAllConsumptionFileSchemas,
  updateConsumptionFileSchemaStatus,
  deleteConsumptionFileSchema,
  getConsumptionFileSchemaStats,
  extractSchemaFromFile,
};
