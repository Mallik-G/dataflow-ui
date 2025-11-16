const express = require('express');
const router = express.Router();
const {
  generateConsumptionArtifacts,
  generateConsumptionDiffs,
  getStoredConsumptionArtifacts,
} = require('../controllers/consumptionArtifactController');

// Generate consumption artifacts
router.post('/generate', generateConsumptionArtifacts);

// Generate consumption diffs for GitHub integration
router.post('/generate-diffs', generateConsumptionDiffs);

// Get stored consumption artifacts for an entity
router.get('/stored', getStoredConsumptionArtifacts);

module.exports = router;
