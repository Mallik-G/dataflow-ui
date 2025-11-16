const { WorkspaceCode } = require('../models');

// Save workspace code transformation
const saveWorkspaceCode = async (req, res) => {
  try {
    const {
      entityName,
      nlpDescription,
      sqlCode,
      pysparkCode,
      isEditingSql,
      isEditingPySpark,
      editableSqlCode,
      editablePySparkCode
    } = req.body;

    // Validate required fields
    if (!entityName || !nlpDescription || !sqlCode || !pysparkCode) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: entityName, nlpDescription, sqlCode, pysparkCode'
      });
    }

    // Create new workspace code entry
    const workspaceCode = await WorkspaceCode.create({
      entityName,
      nlpDescription,
      sqlCode,
      pysparkCode,
      isEditingSql: isEditingSql || false,
      isEditingPySpark: isEditingPySpark || false,
      editableSqlCode: editableSqlCode || sqlCode,
      editablePySparkCode: editablePySparkCode || pysparkCode
    });

    res.status(201).json({
      success: true,
      message: 'Workspace code saved successfully',
      data: workspaceCode
    });

  } catch (error) {
    console.error('Error saving workspace code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save workspace code',
      error: error.message
    });
  }
};

// Get workspace codes by entity
const getWorkspaceCodesByEntity = async (req, res) => {
  try {
    const { entityName } = req.params;

    if (!entityName) {
      return res.status(400).json({
        success: false,
        message: 'Entity name is required'
      });
    }

    const workspaceCodes = await WorkspaceCode.findAll({
      where: { entityName },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: workspaceCodes
    });

  } catch (error) {
    console.error('Error fetching workspace codes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workspace codes',
      error: error.message
    });
  }
};

// Get all workspace codes
const getAllWorkspaceCodes = async (req, res) => {
  try {
    const workspaceCodes = await WorkspaceCode.findAll({
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: workspaceCodes
    });

  } catch (error) {
    console.error('Error fetching all workspace codes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workspace codes',
      error: error.message
    });
  }
};

// Update workspace code
const updateWorkspaceCode = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const workspaceCode = await WorkspaceCode.findByPk(id);
    if (!workspaceCode) {
      return res.status(404).json({
        success: false,
        message: 'Workspace code not found'
      });
    }

    await workspaceCode.update(updateData);

    res.json({
      success: true,
      message: 'Workspace code updated successfully',
      data: workspaceCode
    });

  } catch (error) {
    console.error('Error updating workspace code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update workspace code',
      error: error.message
    });
  }
};

// Delete workspace code
const deleteWorkspaceCode = async (req, res) => {
  try {
    const { id } = req.params;

    const workspaceCode = await WorkspaceCode.findByPk(id);
    if (!workspaceCode) {
      return res.status(404).json({
        success: false,
        message: 'Workspace code not found'
      });
    }

    await workspaceCode.destroy();

    res.json({
      success: true,
      message: 'Workspace code deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting workspace code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete workspace code',
      error: error.message
    });
  }
};

module.exports = {
  saveWorkspaceCode,
  getWorkspaceCodesByEntity,
  getAllWorkspaceCodes,
  updateWorkspaceCode,
  deleteWorkspaceCode
};
