const express = require('express');
const router = express.Router();
const {
    getAllConnectors,
    addConnector,
    deleteConnector,
    getConnector,
    testRdsConnection,
    testS3Connection,
    getAllSources,
} = require('../controllers/connectorController');

// GET: List Connectors
router.get('/', getAllConnectors);

// GET: Get Connector by Id
router.get('/:id', getConnector);

// POST: Add Connectors
router.post('/add', addConnector);

// DELETE: Delete Connector
router.delete('/:id', deleteConnector);

// GET: Get sources
router.post('/sources', getAllSources);

// Test RDS connection
router.post("/test-rds", testRdsConnection);

//Test S3 connection

router.post("/test-s3", testS3Connection);


module.exports = router;
