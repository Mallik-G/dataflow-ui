const express = require('express');
const router = express.Router();
const {
  saveSchemaMaster,
  createMultipleSchemas,
  getAllSchemas,
  getGroupedSchemasCount,
} = require('../../controllers/dataflow/schemaMasterController.js');

router.post('/schema', saveSchemaMaster);
router.post('/multiple-schemas', createMultipleSchemas);
router.get('/all-schemas', getAllSchemas);
router.get('/grouped-schemas-count', getGroupedSchemasCount);

module.exports = router;
