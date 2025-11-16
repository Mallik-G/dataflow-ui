const responder = require('../utils/responder');
const ConnectorService = require('../services/connectorService');
const { Client } = require("pg");
const { S3Client, ListBucketsCommand, HeadBucketCommand } = require("@aws-sdk/client-s3");
// Get all connectors
const getAllConnectors = async (req, res, next) => {
  try {

    const result = await ConnectorService.getAllConnectors(req, res, next);

    responder.sendResponse(res, 200, "true", result, "Connectors Data.");

  } catch (error) {
    console.error('Get settings error:', error);
    responder.sendResponse(res, 500, "false", null, error.message);
  }
};

// Add Connector
const addConnector = async (req, res) => {
  try {
    const { name, source_dataset, targetSystem, authConfig, cdc_mode, sync_type, watermark_column, primary_keys, sync_mode, schedule_cron, compute_type, cluster_config, status } = req.body;

    const connectorData = {
      name,
      source_dataset,
      targetSystem,
      authConfig,
      cdc_mode,
      sync_type,
      watermark_column,
      primary_keys,
      sync_mode,
      schedule_cron,
      compute_type,
      cluster_config,
      status,
      createdBy: req.user?.id || 'system',
      updatedBy: req.user?.id || 'system',
    };

    const result = await ConnectorService.createConnector(
      connectorData
    );

    if (result.success) {
      responder.sendResponse(res, 201, "true", result.connector, "Connector saved successfully.");
    } else {
      responder.sendResponse(res, 400, "false", null, result.message);
    }
  } catch (error) {
    console.error('Save settings error:', error);
    responder.sendResponse(res, 500, "false", null, error.message);
  }
};

// Delete connector
const deleteConnector = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await ConnectorService.deleteConnector(id);

    if (result.success) {
      responder.sendResponse(res, 200, "true", null, "Connector deleted successfully.");
    } else {
      responder.sendResponse(res, 404, "false", null, result.message);
    }
  } catch (error) {
    console.error('Delete settings error:', error);
    responder.sendResponse(res, 500, "false", null, error.message);
  }
};

// Get connector by Id
const getConnector = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await ConnectorService.getConnector(id);

    if (result.success) {
      responder.sendResponse(res, 200, "true", result, "Connector data.");
    } else {
      responder.sendResponse(res, 404, "false", null, result.message);
    }
  } catch (error) {
    console.error('Getting settings error:', error);
    responder.sendResponse(res, 500, "false", null, error.message);
  }
};

const testRdsConnection = async (req, res) => {
  const { host, username, password } = req.body;

  if (!host || !username || !password) {
    return res.status(400).json({ success: false, message: "Missing credentials" });
  }
  const port = 5432;
  const database = 'mpp';
  const client = new Client({
    host,
    port,
    user: username,
    password,
    database: database || "postgres", // default DB
    ssl: { rejectUnauthorized: false }, // needed for AWS RDS
  });

  try {

    await client.connect();
    await client.query("SELECT NOW();"); // simple test query
    await client.end();

    res.json({
      success: true,
      message: `✅ PostgreSQL connection successful for host ${host}`,
    });
  } catch (err) {
    console.error("❌ PostgreSQL connection failed:", err.message);
    res.status(500).json({
      success: false,
      message: "❌ Failed to connect to PostgreSQL RDS",
      error: err.message,
    });
  }

};

const testS3Connection = async (req, res) => {
  try {
    const { awsAccessKeyId: accessKey, awsSecretAccessKey: secretKey, region, resource: bucket } = req.body;
    console.log(`accessKey ${accessKey} secretKey ${secretKey} region ${region} bucket ${bucket}`)
    if (!accessKey || !secretKey || !region) {
      return res.status(400).json({
        success: false,
        message: "Missing required AWS S3 credentials (accessKey, secretKey, region)",
      });
    }

    // Initialize S3 Client
    const s3 = new S3Client({
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });

    // ✅ If bucket name provided, check that bucket
    if (bucket && bucket.trim()) {
      try {
        await s3.send(new HeadBucketCommand({ Bucket: bucket }));
        return res.json({
          success: true,
          message: `✅ Connection successful. Bucket "${bucket}" is accessible.`,
        });
      } catch (err) {
        return res.status(403).json({
          success: false,
          message: `❌ Cannot access bucket "${bucket}"`,
          error: err.message,
        });
      }
    }

    // ✅ If no bucket, just list buckets (general credentials test)
    const response = await s3.send(new ListBucketsCommand());
    res.json({
      success: true,
      message: "✅ AWS S3 connection successful",
      //buckets: response.Buckets?.map((b) => b.Name) || [],
    });
  } catch (err) {
    console.error("❌ S3 connection failed:", err);
    res.status(500).json({
      success: false,
      message: "❌ Failed to connect to AWS S3",
      error: err.message,
    });
  }
};

// Get All sources 

const getAllSources = async (req, res, next) => {
  try {
    console.log('sourcessss')
    const result = await ConnectorService.getAllSources(req, res, next);

    responder.sendResponse(res, 200, "true", result, "Sources Data.");

  } catch (error) {
    console.log('sourcessss')
    console.error('Get settings error:', error);
    responder.sendResponse(res, 500, "false", null, error.message);
  }
};


module.exports = {
  getAllConnectors,
  addConnector,
  deleteConnector,
  getConnector,
  testRdsConnection,
  testS3Connection,
  getAllSources,
};