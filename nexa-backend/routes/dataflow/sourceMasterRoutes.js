const express = require('express');
const router = express.Router();

const {
  addSource,
  getAllSources,
} = require('../../controllers/dataflow/sourceMasterController');

router.post('/source', addSource);
router.get('/sources', getAllSources);

module.exports = router;
