const express = require('express');
const router = express.Router();
const fileUploadS3 = require('../middlewares/fileUploadS3');
const fileUploadBuffer = require('../middlewares/fileUploadBuffer');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const {
  transformData,
  generateCuratedFile,
  generateConsumptionFile,
  getSavedTransformations,
  getCuratedFiles,
  getConsumptionFiles,
  getConsumptionFileColumns,
  saveTransformations,
  getAIConsumptionFiles,
  getAICuratedFiles,
  getGoldFiles,
} = require('../controllers/transformationController');

const {
  saveRawFileSchema,
  getRawFileSchema,
  getAllRawFileSchemas,
  updateRawFileSchemaStatus,
  deleteRawFileSchema,
  getRawFileSchemaStats,
  extractSchemaFromFile,
  generateControlColumns,
  generateColumnMetadata,
} = require('../controllers/rawFileSchemaController');

const {
  saveConsumptionFileSchema,
  getConsumptionFileSchema,
  getAllConsumptionFileSchemas,
  updateConsumptionFileSchemaStatus,
  deleteConsumptionFileSchema,
  getConsumptionFileSchemaStats,
  extractSchemaFromFile: extractConsumptionSchemaFromFile,
} = require('../controllers/consumptionFileSchemaController');

const AttributeTransformationService = require('../services/attributeTransformationService');

const {
  testProjection,
  saveProjectionSettings,
  getProjectionSettings,
  getProjectionById,
  updateProjectionSettings,
  updateProjectionStatus,
  deleteProjectionSettings,
  getProjectionStats,
} = require('../controllers/batchProjectionController');

const {
  testGitHubConnection,
  saveGitHubConnection,
  updateGitHubConnection,
  getRepositoryInfo,
  listBranches,
  getActiveConnection,
  resetConnection,
  testWritePermissions,
} = require('../controllers/githubController');

const {
  generateAllArtifacts,
  generateArtifactsDiff,
  generateAllDiffs,
} = require('../controllers/artifactController');

const {
  saveNLPArtifact,
  getNLPArtifactsByEntity,
  getAllNLPArtifacts,
  getNLPArtifactById,
  updateNLPArtifact,
  deleteNLPArtifact,
  getNLPArtifactsStats,
} = require('../controllers/nlpArtifactController');

const GitHubService = require('../services/githubService');
const GitHubConnection = require('../models/GitHubConnection'); // Added this import for the debug endpoint
const RawFileSchemaService = require('../services/rawFileSchemaService'); // Added this import for schema extraction

// POST /api/upload - accepts a file and uploads to S3 (legacy behavior)
router.post('/upload', fileUploadS3.single('file'), async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: 'No file uploaded' });
  }

  try {
    // Extract entity name from filename
    const fileName = req.file.originalname;
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    const entityName = `raw.${baseName}`;

    // Check if this is a schema-only upload (no file saving)
    const schemaOnly =
      req.body.schemaOnly === 'true' || req.body.schemaOnly === true;

    if (schemaOnly) {
      // For schema-only uploads, redirect to the dedicated schema extraction endpoint
      return res.status(400).json({
        success: false,
        message:
          'Please use /api/extract-schema endpoint for schema-only extraction',
      });
    } else {
      // Original behavior - save file and schema
      const schemaData = {
        entityName,
        fileKey: req.file.key,
        fileName: fileName,
        fileLocation: req.file.location,
        fileSize: req.file.size,
        contentType: req.file.mimetype,
      };

      console.log('Auto-saving raw file schema for uploaded file:', fileName);
      console.log('Entity name:', entityName);
      console.log('File key:', req.file.key);

      // Call the schema save endpoint internally
      const schemaReq = {
        body: schemaData,
      };
      const schemaRes = {
        json: (data) => {
          console.log('Schema save response:', data);
        },
        status: (code) => ({
          json: (data) => {
            console.log('Schema save error:', data);
          },
        }),
      };

      await saveRawFileSchema(schemaReq, schemaRes);

      res.json({
        success: true,
        location: req.file.location,
        key: req.file.key,
        entityName: entityName,
        message: 'File uploaded and schema saved successfully',
        processingMode: 'file-and-schema',
      });
    }
  } catch (error) {
    console.error('Error in file upload with schema save:', error);
    // Still return success for file upload even if schema save fails
    res.json({
      success: true,
      location: req.file.location,
      key: req.file.key,
      warning: 'File uploaded but schema save failed: ' + error.message,
    });
  }
});

// POST /api/extract-schema - extract schema from file without saving the file
router.post(
  '/extract-schema',
  fileUploadBuffer.single('file'),
  async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: 'No file uploaded' });
    }

    try {
      // Extract entity name from filename
      const fileName = req.file.originalname;
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      const entityName = `raw.${baseName}`;

      // Extract schema directly from file buffer without saving to S3
      const fileContent = req.file.buffer.toString('utf-8');

      // Extract schema from file content
      const { schemaAttributes, schemaMetadata } =
        RawFileSchemaService.extractSchemaFromContent(
          fileContent,
          fileName,
          req.file.mimetype
        );

      // Save schema to database with schema-only indicator
      const schemaData = {
        entityName,
        fileName: fileName,
        fileKey: `schema-only/${entityName}_${Date.now()}`,
        fileLocation: `schema-only://${entityName}`,
        fileSize: req.file.size,
        contentType: req.file.mimetype,
        schemaAttributes,
        schemaMetadata,
        fileData: {
          lastModified: new Date().toISOString(),
          contentLength: req.file.size,
          etag: null, // No S3 ETag since file wasn't saved
        },
        createdBy: 'system',
        notes: 'Schema extracted from uploaded file - file not saved',
        processingMode: 'schema-only',
      };

      const schemaReq = { body: schemaData };
      const schemaRes = {
        json: (data) => {
          console.log('Schema save response:', data);
        },
        status: (code) => ({
          json: (data) => {
            console.log('Schema save error:', data);
          },
        }),
      };

      await saveRawFileSchema(schemaReq, schemaRes);

      res.json({
        success: true,
        entityName: entityName,
        schemaAttributes,
        schemaMetadata,
        message: 'Schema extracted and saved successfully (file not saved)',
        processingMode: 'schema-only',
      });
    } catch (error) {
      console.error('Error in schema extraction:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to extract schema from file',
      });
    }
  }
);

// POST /api/raw-schemas/save - save raw file schema when file is uploaded
router.post('/api/raw-schemas/save', saveRawFileSchema);

// GET /api/raw-schemas/:entityName - get raw file schema for an entity
router.get('/api/raw-schemas/:entityName', getRawFileSchema);

// GET /api/raw-schemas - get all raw file schemas with optional filtering
router.get('/api/raw-schemas', getAllRawFileSchemas);

// PUT /api/raw-schemas/:entityName/status - update raw file schema status
router.put('/api/raw-schemas/:entityName/status', updateRawFileSchemaStatus);

// DELETE /api/raw-schemas/:entityName - delete raw file schema
router.delete('/api/raw-schemas/:entityName', deleteRawFileSchema);

// GET /api/raw-schemas/stats - get raw file schema statistics
router.get('/api/raw-schemas/stats', getRawFileSchemaStats);

// POST /api/raw-schemas/extract - extract schema from file content (utility endpoint)
router.post('/api/raw-schemas/extract', extractSchemaFromFile);

// GET /api/raw-schemas/:entityName/control-columns - generate control columns for an entity
router.get(
  '/api/raw-schemas/:entityName/control-columns',
  generateControlColumns
);

// GET /api/raw-schemas/:entityName/column-metadata - generate datatypes and descriptions for all columns
router.get(
  '/api/raw-schemas/:entityName/column-metadata',
  generateColumnMetadata
);

// GET /api/control-columns/descriptions - get control columns with LLM descriptions
router.get('/api/control-columns/descriptions', (req, res) => {
  // Mock LLM response for control columns
  const controlColumns = [
    {
      name: '_ingest_timestamp',
      description:
        'Records when data was ingested into the system. Automatically populated by the data pipeline.',
      llmGenerated: true,
      llmResponse:
        "This column tracks the timestamp when data was first ingested into our data lake. It's essential for data lineage and audit trails.",
    },
    {
      name: '_source_system',
      description:
        'Identifies the source system that provided the data. Used for data lineage tracking.',
      llmGenerated: true,
      llmResponse:
        'This field identifies the originating system that provided the data. Critical for data governance and source tracking.',
    },
    {
      name: '_record_status',
      description:
        'Status after validation (valid/quarantined/error). Indicates data quality assessment.',
      llmGenerated: true,
      llmResponse:
        "This column indicates the validation status of each record. Values include 'valid', 'quarantined', or 'error' based on data quality checks.",
    },
    {
      name: '_update_timestamp',
      description:
        'Last update time in the silver/curated layer. Tracks when the record was last modified.',
      llmGenerated: true,
      llmResponse:
        'Tracks the last modification timestamp in the curated layer. Important for change tracking and data freshness monitoring.',
    },
    {
      name: '_batch_id',
      description:
        'Associates records with a specific processing batch. Used for batch processing and error tracking.',
      llmGenerated: true,
      llmResponse:
        'Links records to specific processing batches. Essential for batch processing, error tracking, and reprocessing workflows.',
    },
    {
      name: '_created_by',
      description:
        'Process or user that created the record. Tracks data origin and responsibility.',
      llmGenerated: true,
      llmResponse:
        'Identifies the process or user responsible for creating this record. Important for accountability and audit trails.',
    },
    {
      name: '_updated_by',
      description:
        'Process or user that last updated the record. Maintains audit trail of changes.',
      llmGenerated: true,
      llmResponse:
        'Tracks who or what process last modified the record. Critical for maintaining complete audit trails of data changes.',
    },
  ];

  res.json({
    success: true,
    controlColumns: controlColumns,
    message: 'Control columns with LLM descriptions retrieved successfully',
  });
});

// Consumption File Schema Routes
// POST /api/consumption-schemas/save - save consumption file schema when file is generated
router.post('/api/consumption-schemas/save', saveConsumptionFileSchema);

// GET /api/consumption-schemas/:entityName - get consumption file schema for an entity
router.get('/api/consumption-schemas/:entityName', getConsumptionFileSchema);

// GET /api/consumption-schemas - get all consumption file schemas with optional filtering
router.get('/api/consumption-schemas', getAllConsumptionFileSchemas);

// PUT /api/consumption-schemas/:entityName/status - update consumption file schema status
router.put(
  '/api/consumption-schemas/:entityName/status',
  updateConsumptionFileSchemaStatus
);

// DELETE /api/consumption-schemas/:entityName - delete consumption file schema
router.delete(
  '/api/consumption-schemas/:entityName',
  deleteConsumptionFileSchema
);

// GET /api/consumption-schemas/stats - get consumption file schema statistics
router.get('/api/consumption-schemas/stats', getConsumptionFileSchemaStats);

// POST /api/consumption-schemas/extract - extract schema from consumption file content (utility endpoint)
router.post(
  '/api/consumption-schemas/extract',
  extractConsumptionSchemaFromFile
);

// GET /api/documents - fetch all documents from S3
router.get('/documents', async (req, res) => {
  const s3 = new AWS.S3({
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    region: process.env.AWS_REGION,
  });
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Prefix: 'documents/',
  };
  try {
    const data = await s3.listObjectsV2(params).promise();
    const files = (data.Contents || []).map((obj) => ({
      key: obj.Key,
      location: `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${obj.Key}`,
    }));
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch documents',
      error: err.message,
    });
  }
});

// GET /api/file/:key - fetch a specific file from S3
router.get('/api/file/:key', async (req, res) => {
  const { key } = req.params;
  const s3 = new AWS.S3({
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    region: process.env.AWS_REGION,
  });
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key,
  };
  try {
    const data = await s3.getObject(params).promise();
    res.json({
      success: true,
      key: key,
      contentType: data.ContentType,
      size: data.ContentLength,
      lastModified: data.LastModified,
      location: `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
    });
  } catch (err) {
    res
      .status(404)
      .json({ success: false, message: 'File not found', error: err.message });
  }
});

// PUT /api/file/rename - rename a file in S3
router.put('/api/file/rename', async (req, res) => {
  const { oldKey, newName } = req.body;

  if (!oldKey || !newName) {
    return res.status(400).json({
      success: false,
      message: 'Both oldKey and newName are required',
    });
  }

  const s3 = new AWS.S3({
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    region: process.env.AWS_REGION,
  });

  try {
    // Extract the directory path from old key
    const pathParts = oldKey.split('/');
    const fileName = pathParts.pop(); // Remove the filename
    const directory = pathParts.join('/'); // Keep the directory path

    // Create new key with same directory but new filename
    const newKey = `${directory}/${newName}`;

    // Copy the file to new location
    const copyParams = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      CopySource: `${process.env.AWS_S3_BUCKET_NAME}/${oldKey}`,
      Key: newKey,
    };

    await s3.copyObject(copyParams).promise();

    // Delete the old file
    const deleteParams = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: oldKey,
    };

    await s3.deleteObject(deleteParams).promise();

    res.json({
      success: true,
      message: 'File renamed successfully',
      oldKey: oldKey,
      newKey: newKey,
      newLocation: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${newKey}`,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to rename file',
      error: err.message,
    });
  }
});

// POST /api/transformations/save - transform raw data to curated data (legacy endpoint)
router.post('/api/transformations/save', transformData);

// POST /api/transformations/save-mappings - save transformations for both curated and consumption
router.post('/api/transformations/save-mappings', saveTransformations);

// GET /api/transformations/:entityName - get saved transformations for an entity
router.get('/api/transformations/:entityName', getSavedTransformations);

// POST /api/curated/generate - generate curated file from raw data
router.post('/api/curated/generate', generateCuratedFile);

// POST /api/consumption/generate - generate consumption file from gold data
router.post('/api/consumption/generate', generateConsumptionFile);

// GET /api/curated/files - get list of curated files from S3
router.get('/api/curated/files', getCuratedFiles);

// GET /api/consumption/files - get list of consumption files from S3
router.get('/api/consumption/files', getConsumptionFiles);

// GET /api/consumption/files/:fileName/columns - get columns/attributes of a specific consumption file
router.get(
  '/api/consumption/files/:fileName/columns',
  getConsumptionFileColumns
);

// GET /api/gold/files - get list of gold files from S3
router.get('/api/gold/files', getGoldFiles);

// GET /api/ai-consumption-files - get list of AI consumption files from S3
router.get('/api/ai-consumption-files', getAIConsumptionFiles);

// GET /api/ai-curated-files - get list of AI curated files from curatedfiles folder
router.get('/api/ai-curated-files', getAICuratedFiles);

// Attribute Transformation Management Routes
// GET /api/transformations - get all transformations with optional filtering
router.get('/api/transformations', async (req, res) => {
  try {
    const filters = {
      entityName: req.query.entityName,
      fileType: req.query.fileType,
      status: req.query.status,
      createdBy: req.query.createdBy,
    };

    const result = await AttributeTransformationService.getAllTransformations(
      filters
    );
    res.json(result);
  } catch (error) {
    console.error('Error getting all transformations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transformations',
      error: error.message,
    });
  }
});

// PUT /api/transformations/:entityName/status - update transformation status
router.put('/api/transformations/:entityName/status', async (req, res) => {
  try {
    const { entityName } = req.params;
    const { fileType = 'curated', status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    const result =
      await AttributeTransformationService.updateTransformationStatus(
        entityName,
        fileType,
        status
      );
    res.json(result);
  } catch (error) {
    console.error('Error updating transformation status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update transformation status',
      error: error.message,
    });
  }
});

// DELETE /api/transformations/:entityName - delete transformation
router.delete('/api/transformations/:entityName', async (req, res) => {
  try {
    const { entityName } = req.params;
    const { fileType = 'curated' } = req.query;

    const result = await AttributeTransformationService.deleteTransformation(
      entityName,
      fileType
    );
    res.json(result);
  } catch (error) {
    console.error('Error deleting transformation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete transformation',
      error: error.message,
    });
  }
});

// GET /api/transformations/stats - get transformation statistics
router.get('/api/transformations/stats', async (req, res) => {
  try {
    const result =
      await AttributeTransformationService.getTransformationStats();
    res.json(result);
  } catch (error) {
    console.error('Error getting transformation stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transformation statistics',
      error: error.message,
    });
  }
});

// Batch Projection Routes
// POST /api/batch-projections/test - test a batch projection
router.post('/api/batch-projections/test', testProjection);

// POST /api/batch-projections/save - save batch projection settings
router.post('/api/batch-projections/save', saveProjectionSettings);

// GET /api/batch-projections - get all batch projection settings
router.get('/api/batch-projections', getProjectionSettings);

// GET /api/batch-projections/stats - get projection statistics
router.get('/api/batch-projections/stats', getProjectionStats);

// GET /api/batch-projections/:projectionId - get a specific projection
router.get('/api/batch-projections/:projectionId', getProjectionById);

// PUT /api/batch-projections/:projectionId - update projection settings
router.put('/api/batch-projections/:projectionId', updateProjectionSettings);

// PATCH /api/batch-projections/:projectionId/status - update projection status
router.patch(
  '/api/batch-projections/:projectionId/status',
  updateProjectionStatus
);

// DELETE /api/batch-projections/:projectionId - delete batch projection settings
router.delete('/api/batch-projections/:projectionId', deleteProjectionSettings);

// GitHub Connection Routes
// POST /api/github/test - test GitHub connection
router.post('/api/github/test', testGitHubConnection);

// POST /api/github/test-write - test GitHub write permissions
router.post('/api/github/test-write', testWritePermissions);

// POST /api/github/save - save GitHub connection
router.post('/api/github/save', saveGitHubConnection);

// PUT /api/github/update - update existing GitHub connection
router.put('/api/github/update', updateGitHubConnection);

// POST /api/github/repository-info - get repository information
router.post('/api/github/repository-info', getRepositoryInfo);

// POST /api/github/branches - list repository branches
router.post('/api/github/branches', listBranches);

// GET /api/github/active - get the currently active connection
router.get('/api/github/active', getActiveConnection);

// GET /api/github/connection - get the currently active connection (alias)
router.get('/api/github/connection', getActiveConnection);

// GET /api/github/debug - debug endpoint to check all connections
router.get('/api/github/debug', async (req, res) => {
  try {
    const allConnections = await GitHubConnection.findAll({
      attributes: [
        'id',
        'repositoryUrl',
        'repositoryName',
        'branch',
        'username',
        'isActive',
        'createdAt',
      ],
    });

    console.log('All GitHub connections:', allConnections);

    res.json({
      success: true,
      connections: allConnections,
      count: allConnections.length,
    });
  } catch (error) {
    console.error('Failed to get connections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get connections',
      error: error.message,
    });
  }
});

// GET /api/github/file - get file content from GitHub
router.get('/api/github/file', async (req, res) => {
  try {
    const { repositoryUrl, branch, filePath } = req.query;

    console.log('GitHub File Request:', {
      repositoryUrl,
      branch,
      filePath,
      username: req.query.username ? '***' : 'not provided',
    });

    if (!repositoryUrl || !branch || !filePath) {
      console.log('Missing required parameters');
      return res.status(400).json({
        success: false,
        message: 'Repository URL, branch, and file path are required',
      });
    }

    // Get the active GitHub connection to use its credentials
    const activeConnection = await GitHubService.getActiveConnection();
    console.log('Active connection result:', {
      hasConnection: !!activeConnection,
      connectionData: activeConnection
        ? {
            id: activeConnection.id,
            repositoryUrl: activeConnection.repositoryUrl,
            branch: activeConnection.branch,
            username: activeConnection.username ? '***' : 'not set',
          }
        : null,
    });

    if (!activeConnection) {
      console.log('No active GitHub connection found');
      return res.status(400).json({
        success: false,
        message: 'No active GitHub connection found',
      });
    }

    // Extract repository info
    const repoInfo = GitHubService.extractRepoInfo(repositoryUrl);
    console.log('Repository info:', repoInfo);

    if (!repoInfo) {
      console.log('Invalid repository URL format');
      return res.status(400).json({
        success: false,
        message: 'Invalid repository URL format',
      });
    }

    // Construct the GitHub API URL for the file
    const fileUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents/${filePath}?ref=${branch}`;
    console.log('GitHub API URL:', fileUrl);

    // Prepare authentication
    const isToken =
      !activeConnection.password || activeConnection.password.trim() === '';
    const auth = isToken
      ? { Authorization: `token ${activeConnection.username}` }
      : {
          Authorization: `Basic ${Buffer.from(
            `${activeConnection.username}:${activeConnection.password}`
          ).toString('base64')}`,
        };

    console.log('Authentication type:', isToken ? 'token' : 'basic');

    // Get file content
    const content = await GitHubService.getFileContent(fileUrl, auth);
    console.log('File content result:', {
      hasContent: !!content,
      contentLength: content ? content.length : 0,
    });

    if (content) {
      res.json({
        success: true,
        content: content,
        message: 'File content retrieved successfully',
      });
    } else {
      res.json({
        success: false,
        content: null,
        message: 'File not found or could not be retrieved',
      });
    }
  } catch (error) {
    console.error('Failed to get file from GitHub:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get file from GitHub',
      error: error.message,
    });
  }
});

// DELETE /api/github/reset - reset/delete the active connection
router.delete('/api/github/reset', resetConnection);

// Artifact Generation Routes
// POST /api/artifacts/generate - generate all data engineering artifacts
router.post('/api/artifacts/generate', generateAllArtifacts);

// POST /api/artifacts/diff - generate diff between existing and new artifacts
router.post('/api/artifacts/diff', generateArtifactsDiff);

// POST /api/artifacts/generate-all-diffs - generate diffs for multiple entities simultaneously
router.post('/api/artifacts/generate-all-diffs', generateAllDiffs);

// POST /api/artifacts/push-to-github - push artifacts to GitHub
router.post('/api/artifacts/push-to-github', async (req, res) => {
  try {
    const { artifacts, githubConfig, folderPath } = req.body;

    if (!artifacts || !githubConfig) {
      return res.status(400).json({
        success: false,
        message: 'Artifacts and GitHub config are required',
      });
    }

    const result = await GitHubService.pushArtifactsToRepository(
      artifacts,
      githubConfig,
      folderPath
    );
    res.json(result);
  } catch (error) {
    console.error('Failed to push artifacts to GitHub:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to push artifacts to GitHub',
      error: error.message,
    });
  }
});

// POST /api/artifacts/push-all-to-github - push all artifacts to GitHub in single commit
router.post('/api/artifacts/push-all-to-github', async (req, res) => {
  try {
    const {
      artifacts,
      githubConfig,
      newBranchName,
      createPR,
      targetBranch,
      folderPath,
    } = req.body;

    if (!artifacts || !githubConfig || !Array.isArray(artifacts)) {
      return res.status(400).json({
        success: false,
        message: 'Artifacts array and GitHub config are required',
      });
    }

    console.log(
      `Pushing ${artifacts.length} entities to GitHub in single commit...`
    );
    if (newBranchName) {
      console.log(`Creating new branch: ${newBranchName}`);
    }
    if (createPR) {
      console.log(`Will create PR to target branch: ${targetBranch || 'main'}`);
    }

    const result = await GitHubService.pushAllArtifactsToRepository(
      artifacts,
      githubConfig,
      newBranchName,
      createPR,
      targetBranch,
      folderPath
    );
    res.json(result);
  } catch (error) {
    console.error('Failed to push all artifacts to GitHub:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to push all artifacts to GitHub',
      error: error.message,
    });
  }
});

// NLP Artifact Routes
// POST /api/nlp-artifacts - save accepted NLP artifact
router.post('/api/nlp-artifacts', saveNLPArtifact);

// GET /api/nlp-artifacts - get all NLP artifacts with pagination
router.get('/api/nlp-artifacts', getAllNLPArtifacts);

// GET /api/nlp-artifacts/stats - get NLP artifacts statistics
router.get('/api/nlp-artifacts/stats', getNLPArtifactsStats);

// GET /api/nlp-artifacts/entity/:entityName - get NLP artifacts for specific entity
router.get('/api/nlp-artifacts/entity/:entityName', getNLPArtifactsByEntity);

// GET /api/nlp-artifacts/:id - get specific NLP artifact by ID
router.get('/api/nlp-artifacts/:id', getNLPArtifactById);

// PUT /api/nlp-artifacts/:id - update NLP artifact
router.put('/api/nlp-artifacts/:id', updateNLPArtifact);

// DELETE /api/nlp-artifacts/:id - delete NLP artifact (soft delete)
router.delete('/api/nlp-artifacts/:id', deleteNLPArtifact);

module.exports = router;
// --- ETL SQL local file endpoints ---
// GET /api/etl/sql-files - list SQL files under data/ETL
router.get('/api/etl/sql-files', async (req, res) => {
  try {
    const etlDir = path.join(__dirname, '..', 'data', 'ETL');
    if (!fs.existsSync(etlDir)) {
      return res.json({ success: true, files: [], message: 'No ETL directory found' });
    }
    const entries = fs.readdirSync(etlDir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.sql'))
      .map((e) => e.name);
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to list SQL files', error: error.message });
  }
});

// GET /api/etl/sql-files/:fileName - read SQL file content
router.get('/api/etl/sql-files/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return res.status(400).json({ success: false, message: 'Invalid file name' });
    }
    const etlDir = path.join(__dirname, '..', 'data', 'ETL');
    const filePath = path.join(etlDir, fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ success: true, fileName, content });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to read SQL file', error: error.message });
  }
});
