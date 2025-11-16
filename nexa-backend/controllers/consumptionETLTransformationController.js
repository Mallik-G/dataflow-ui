const { ConsumptionETLTransformation } = require('../models');
const fs = require('fs').promises;
const path = require('path');

/**
 * Save accepted consumption ETL transformation to database and create file
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const saveConsumptionETLTransformation = async (req, res) => {
  try {
    const {
      entityName,
      columnName,
      transformationType = 'nlp',
      nlpDescription,
      sqlCode,
      pysparkCode,
      transformationRules = {},
      entityColumns,
      createdBy = 'system',
      notes = '',
      metadata = {},
    } = req.body;

    if (!entityName || !columnName) {
      return res.status(400).json({
        success: false,
        message: 'Entity name and column name are required',
      });
    }

    // Create timestamp for file naming
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    const fileName = `consumption_etl_${entityName}_${columnName}_${timestamp}.json`;

    // Create folder structure for accepted transformations
    const acceptedTransformationsDir = path.join(
      __dirname,
      '..',
      '..',
      'accepted_transformations'
    );
    const entityDir = path.join(acceptedTransformationsDir, entityName);
    const etlDir = path.join(entityDir, 'etl');

    // Ensure directories exist
    await fs.mkdir(acceptedTransformationsDir, { recursive: true });
    await fs.mkdir(entityDir, { recursive: true });
    await fs.mkdir(etlDir, { recursive: true });

    // Create transformation data with enhanced structure
    const transformationData = {
      entityName,
      columnName,
      transformationType,
      nlpDescription: nlpDescription || '',
      sqlCode: sqlCode || '',
      pysparkCode: pysparkCode || '',
      transformationRules,
      entityColumns: entityColumns || [],
      version: '1.0',
      acceptedAt: new Date().toISOString(),
      createdBy,
      notes,
      metadata: {
        ...metadata,
        folderStructure: {
          ddl: `consumption/ddl/${entityName}`,
          transformations: `consumption/transformations/${entityName}`,
          dml: `consumption/dml/${entityName}`,
        },
        artifactType: 'etl_transformation',
        source: 'etl_generation',
        entityType: 'consumption',
        acceptedVia: 'consumption_canvas_header',
      },
      timestamp,
    };

    // Save to database
    const etlTransformation = await ConsumptionETLTransformation.create({
      entityName,
      columnName,
      transformationType,
      nlpDescription: nlpDescription || '',
      sqlCode: sqlCode || '',
      pysparkCode: pysparkCode || '',
      transformationRules,
      entityColumns: entityColumns || [],
      filePath: path.join(etlDir, fileName),
      fileName,
      version: '1.0',
      status: 'accepted',
      acceptedAt: new Date(),
      createdBy,
      notes,
      metadata,
    });

    // Save to file system
    const filePath = path.join(etlDir, fileName);
    await fs.writeFile(filePath, JSON.stringify(transformationData, null, 2));

    res.json({
      success: true,
      message: 'Consumption ETL transformation saved successfully',
      data: {
        id: etlTransformation.id,
        entityName: etlTransformation.entityName,
        columnName: etlTransformation.columnName,
        fileName: etlTransformation.fileName,
        filePath: etlTransformation.filePath,
        acceptedAt: etlTransformation.acceptedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to save consumption ETL transformation',
      error: error.message,
    });
  }
};

/**
 * Get all consumption ETL transformations for a specific entity
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getConsumptionETLTransformationsByEntity = async (req, res) => {
  try {
    const { entityName } = req.params;

    const transformations = await ConsumptionETLTransformation.findAll({
      where: {
        entityName,
        status: 'accepted',
      },
      order: [['acceptedAt', 'DESC']],
    });

    res.json({
      success: true,
      message: 'Consumption ETL transformations retrieved successfully',
      data: transformations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get consumption ETL transformations',
      error: error.message,
    });
  }
};

/**
 * Get all consumption ETL transformations for a specific entity and column
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getConsumptionETLTransformationsByEntityAndColumn = async (req, res) => {
  try {
    const { entityName, columnName } = req.params;

    const transformations = await ConsumptionETLTransformation.findAll({
      where: {
        entityName,
        columnName,
        status: 'accepted',
      },
      order: [['acceptedAt', 'DESC']],
    });

    res.json({
      success: true,
      message: 'Consumption ETL transformations retrieved successfully',
      data: transformations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get consumption ETL transformations',
      error: error.message,
    });
  }
};

/**
 * Get all consumption ETL transformations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllConsumptionETLTransformations = async (req, res) => {
  try {
    const transformations = await ConsumptionETLTransformation.findAll({
      where: {
        status: 'accepted',
      },
      order: [['acceptedAt', 'DESC']],
    });

    res.json({
      success: true,
      message: 'All consumption ETL transformations retrieved successfully',
      data: transformations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get all consumption ETL transformations',
      error: error.message,
    });
  }
};

/**
 * Update consumption ETL transformation status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateConsumptionETLTransformationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, updatedBy } = req.body;

    const transformation = await ConsumptionETLTransformation.findByPk(id);
    if (!transformation) {
      return res.status(404).json({
        success: false,
        message: 'Consumption ETL transformation not found',
      });
    }

    // Update the transformation
    await transformation.update({
      status,
      notes: notes || transformation.notes,
      updatedBy: updatedBy || 'system',
    });

    res.json({
      success: true,
      message: 'Consumption ETL transformation status updated successfully',
      data: transformation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update consumption ETL transformation status',
      error: error.message,
    });
  }
};

/**
 * Delete consumption ETL transformation (soft delete by setting status to deleted)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteConsumptionETLTransformation = async (req, res) => {
  try {
    const { id } = req.params;

    const transformation = await ConsumptionETLTransformation.findByPk(id);
    if (!transformation) {
      return res.status(404).json({
        success: false,
        message: 'Consumption ETL transformation not found',
      });
    }

    // Soft delete by setting status to deleted
    await transformation.update({
      status: 'deleted',
      updatedBy: 'system',
    });

    res.json({
      success: true,
      message: 'Consumption ETL transformation deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete consumption ETL transformation',
      error: error.message,
    });
  }
};

module.exports = {
  saveConsumptionETLTransformation,
  getConsumptionETLTransformationsByEntity,
  getConsumptionETLTransformationsByEntityAndColumn,
  getAllConsumptionETLTransformations,
  updateConsumptionETLTransformationStatus,
  deleteConsumptionETLTransformation,
};
