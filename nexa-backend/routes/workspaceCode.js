const express = require('express');
const router = express.Router();
const {
  saveWorkspaceCode,
  getWorkspaceCodesByEntity,
  getAllWorkspaceCodes,
  updateWorkspaceCode,
  deleteWorkspaceCode,
} = require('../controllers/workspaceCodeController');

// Save new workspace code
router.post('/save', saveWorkspaceCode);

// Get workspace codes by entity
router.get('/entity/:entityName', getWorkspaceCodesByEntity);

// Get all workspace codes
router.get('/all', getAllWorkspaceCodes);

// Update workspace code
router.put('/update/:id', updateWorkspaceCode);

// Delete workspace code
router.delete('/delete/:id', deleteWorkspaceCode);

module.exports = router;
