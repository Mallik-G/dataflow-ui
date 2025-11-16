const express = require('express');
const router = express.Router();

const fileRoutes = require('./file');
const transformationController = require('../controllers/transformationController');
const consumptionETLTransformationsRoutes = require('./consumptionETLTransformations');
const workspaceCodeRoutes = require('./workspaceCode');
const consumptionArtifactsRoutes = require('./consumptionArtifacts');
const changeLogRoutes = require('./changeLog');
const connectorRoutes = require('./connectors.routes');

router.use('/api', fileRoutes);
router.use('/api/api/consumption-etl', consumptionETLTransformationsRoutes);
router.use('/api/api/workspace-code', workspaceCodeRoutes);
router.use('/api/api/consumption-artifacts', consumptionArtifactsRoutes);
router.use('/api/api/change-log', changeLogRoutes);
router.use('/api/connectors', connectorRoutes);

//New DB Structure Routes
const schemaMasterRoutes = require('./dataflow/schemaMasterRoutes');
const sourceMasterRoutes = require('./dataflow/sourceMasterRoutes');
const projectionsRoutes = require('./projections/projectionsRoutes');

router.use('/api/schema-master', schemaMasterRoutes);
router.use('/api/source-master', sourceMasterRoutes);
router.use('/api/projections', projectionsRoutes);

// Add route for fetching all curated file columns
router.get(
  '/api/curated/columns/all',
  transformationController.getAllCuratedFileColumns
);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

module.exports = router;
