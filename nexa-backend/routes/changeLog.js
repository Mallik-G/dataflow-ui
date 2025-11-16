const express = require('express');
const router = express.Router();
const {
  saveCodeChange,
  getAllChangeLogs,
  getChangeLogById,
  deleteChangeLog
} = require('../controllers/changeLogController');

router.post('/save', saveCodeChange);
router.get('/all', getAllChangeLogs);
router.get('/:id', getChangeLogById);
router.delete('/:id', deleteChangeLog);

module.exports = router;
