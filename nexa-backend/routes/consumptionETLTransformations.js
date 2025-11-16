const express = require('express');
const router = express.Router();
const {
  saveConsumptionETLTransformation,
  getConsumptionETLTransformationsByEntity,
  getConsumptionETLTransformationsByEntityAndColumn,
  getAllConsumptionETLTransformations,
  updateConsumptionETLTransformationStatus,
  deleteConsumptionETLTransformation,
} = require('../controllers/consumptionETLTransformationController');

// Save consumption ETL transformation
router.post('/save', saveConsumptionETLTransformation);

// Get all consumption ETL transformations for a specific entity
router.get('/entity/:entityName', getConsumptionETLTransformationsByEntity);

// Get all consumption ETL transformations for a specific entity and column
router.get(
  '/entity/:entityName/column/:columnName',
  getConsumptionETLTransformationsByEntityAndColumn
);

// Get all consumption ETL transformations
router.get('/all', getAllConsumptionETLTransformations);

// Update consumption ETL transformation status
router.put('/:id/status', updateConsumptionETLTransformationStatus);

// Delete consumption ETL transformation (soft delete)
router.delete('/:id', deleteConsumptionETLTransformation);

module.exports = router;
