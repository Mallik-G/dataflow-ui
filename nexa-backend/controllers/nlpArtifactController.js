const { NLPArtifact } = require('../models');
const fs = require('fs').promises;
const path = require('path');

/**
 * Save accepted NLP artifact to database and create file
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const saveNLPArtifact = async (req, res) => {
  try {
    const {
      entityName,
      curatedEntityName,
      nlpDescription,
      sqlCode,
      pysparkCode,
      entityColumns,
      createdBy = 'system',
      notes = '',
      metadata = {},
    } = req.body;

    console.log('Saving NLP artifact for entity:', entityName);

    if (!entityName || !nlpDescription) {
      return res.status(400).json({
        success: false,
        message: 'Entity name and NLP description are required',
      });
    }

    // Create timestamp for file naming
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    const fileName = `nlp_artifact_${entityName}_${timestamp}.json`;

    // Create folder structure for accepted artifacts
    const acceptedArtifactsDir = path.join(
      __dirname,
      '..',
      '..',
      'accepted_artifacts'
    );
    const entityDir = path.join(acceptedArtifactsDir, entityName);
    const nlpDir = path.join(entityDir, 'nlp');

    // Ensure directories exist
    await fs.mkdir(acceptedArtifactsDir, { recursive: true });
    await fs.mkdir(entityDir, { recursive: true });
    await fs.mkdir(nlpDir, { recursive: true });

    // Create artifact data with enhanced structure
    const artifactData = {
      entityName,
      curatedEntityName,
      nlpDescription,
      sqlCode: sqlCode || '',
      pysparkCode: pysparkCode || '',
      entityColumns: entityColumns || [],
      version: '1.0',
      acceptedAt: new Date().toISOString(),
      createdBy,
      notes,
      metadata: {
        ...metadata,
        folderStructure: {
          ddl: `curated/ddl/${entityName}`,
          transformations: `curated/transformations/${entityName}`,
          dml: `curated/dml/${entityName}`,
        },
        artifactType: 'nlp_generated',
        source: 'nlp_generation',
        entityType: 'curated',
        acceptedVia: 'nlp_artifacts_manager',
      },
      timestamp,
    };

    // Save to database
    const nlpArtifact = await NLPArtifact.create({
      entityName,
      curatedEntityName,
      nlpDescription,
      sqlCode: sqlCode || '',
      pysparkCode: pysparkCode || '',
      entityColumns: entityColumns || [],
      filePath: path.join(nlpDir, fileName),
      fileName,
      version: '1.0',
      status: 'accepted',
      acceptedAt: new Date(),
      createdBy,
      notes,
      metadata,
    });

    // Save to file system
    const filePath = path.join(nlpDir, fileName);
    await fs.writeFile(filePath, JSON.stringify(artifactData, null, 2));

    console.log('NLP artifact saved successfully:', nlpArtifact.id);

    res.json({
      success: true,
      message: 'NLP artifact saved successfully',
      data: {
        id: nlpArtifact.id,
        entityName: nlpArtifact.entityName,
        fileName: nlpArtifact.fileName,
        filePath: nlpArtifact.filePath,
        acceptedAt: nlpArtifact.acceptedAt,
      },
    });
  } catch (error) {
    console.error('Error saving NLP artifact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save NLP artifact',
      error: error.message,
    });
  }
};

/**
 * Get all NLP artifacts for an entity
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getNLPArtifactsByEntity = async (req, res) => {
  try {
    const { entityName } = req.params;
    const { status = 'accepted' } = req.query;

    console.log('Fetching NLP artifacts for entity:', entityName);

    const whereClause = {
      entityName,
      status,
    };

    const nlpArtifacts = await NLPArtifact.findAll({
      where: whereClause,
      order: [['acceptedAt', 'DESC']],
    });

    res.json({
      success: true,
      message: 'NLP artifacts retrieved successfully',
      data: nlpArtifacts,
    });
  } catch (error) {
    console.error('Error fetching NLP artifacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch NLP artifacts',
      error: error.message,
    });
  }
};

/**
 * Get all NLP artifacts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllNLPArtifacts = async (req, res) => {
  try {
    const { status = 'accepted', page = 1, limit = 20 } = req.query;

    console.log('Fetching all NLP artifacts');

    const offset = (page - 1) * limit;
    const whereClause = status ? { status } : {};

    const { count, rows: nlpArtifacts } = await NLPArtifact.findAndCountAll({
      where: whereClause,
      order: [['acceptedAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      success: true,
      message: 'NLP artifacts retrieved successfully',
      data: {
        artifacts: nlpArtifacts,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching NLP artifacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch NLP artifacts',
      error: error.message,
    });
  }
};

/**
 * Get a specific NLP artifact by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getNLPArtifactById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Fetching NLP artifact by ID:', id);

    const nlpArtifact = await NLPArtifact.findByPk(id);

    if (!nlpArtifact) {
      return res.status(404).json({
        success: false,
        message: 'NLP artifact not found',
      });
    }

    res.json({
      success: true,
      message: 'NLP artifact retrieved successfully',
      data: nlpArtifact,
    });
  } catch (error) {
    console.error('Error fetching NLP artifact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch NLP artifact',
      error: error.message,
    });
  }
};

/**
 * Update an NLP artifact
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateNLPArtifact = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nlpDescription,
      sqlCode,
      pysparkCode,
      entityColumns,
      notes,
      metadata,
      updatedBy = 'system',
    } = req.body;

    console.log('Updating NLP artifact:', id);

    const nlpArtifact = await NLPArtifact.findByPk(id);

    if (!nlpArtifact) {
      return res.status(404).json({
        success: false,
        message: 'NLP artifact not found',
      });
    }

    // Update the artifact
    const updateData = {
      nlpDescription: nlpDescription || nlpArtifact.nlpDescription,
      sqlCode: sqlCode !== undefined ? sqlCode : nlpArtifact.sqlCode,
      pysparkCode:
        pysparkCode !== undefined ? pysparkCode : nlpArtifact.pysparkCode,
      entityColumns: entityColumns || nlpArtifact.entityColumns,
      notes: notes !== undefined ? notes : nlpArtifact.notes,
      metadata: metadata || nlpArtifact.metadata,
      updatedBy,
    };

    await nlpArtifact.update(updateData);

    // Update the file if it exists
    if (nlpArtifact.filePath) {
      try {
        const artifactData = {
          entityName: nlpArtifact.entityName,
          curatedEntityName: nlpArtifact.curatedEntityName,
          nlpDescription: updateData.nlpDescription,
          sqlCode: updateData.sqlCode,
          pysparkCode: updateData.pysparkCode,
          entityColumns: updateData.entityColumns,
          version: nlpArtifact.version,
          acceptedAt: nlpArtifact.acceptedAt,
          createdBy: nlpArtifact.createdBy,
          notes: updateData.notes,
          metadata: updateData.metadata,
          updatedAt: new Date().toISOString(),
        };

        await fs.writeFile(
          nlpArtifact.filePath,
          JSON.stringify(artifactData, null, 2)
        );
      } catch (fileError) {
        console.warn('Failed to update file:', fileError.message);
      }
    }

    res.json({
      success: true,
      message: 'NLP artifact updated successfully',
      data: nlpArtifact,
    });
  } catch (error) {
    console.error('Error updating NLP artifact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update NLP artifact',
      error: error.message,
    });
  }
};

/**
 * Delete an NLP artifact
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteNLPArtifact = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Deleting NLP artifact:', id);

    const nlpArtifact = await NLPArtifact.findByPk(id);

    if (!nlpArtifact) {
      return res.status(404).json({
        success: false,
        message: 'NLP artifact not found',
      });
    }

    // Soft delete by updating status
    await nlpArtifact.update({ status: 'deleted' });

    res.json({
      success: true,
      message: 'NLP artifact deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting NLP artifact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete NLP artifact',
      error: error.message,
    });
  }
};

/**
 * Get NLP artifacts statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getNLPArtifactsStats = async (req, res) => {
  try {
    console.log('Fetching NLP artifacts statistics');

    const totalArtifacts = await NLPArtifact.count();
    const acceptedArtifacts = await NLPArtifact.count({
      where: { status: 'accepted' },
    });
    const archivedArtifacts = await NLPArtifact.count({
      where: { status: 'archived' },
    });
    const deletedArtifacts = await NLPArtifact.count({
      where: { status: 'deleted' },
    });

    // Get artifacts by entity
    const artifactsByEntity = await NLPArtifact.findAll({
      attributes: [
        'entityName',
        [
          NLPArtifact.sequelize.fn('COUNT', NLPArtifact.sequelize.col('id')),
          'count',
        ],
      ],
      where: { status: 'accepted' },
      group: ['entityName'],
      order: [
        [
          NLPArtifact.sequelize.fn('COUNT', NLPArtifact.sequelize.col('id')),
          'DESC',
        ],
      ],
    });

    res.json({
      success: true,
      message: 'NLP artifacts statistics retrieved successfully',
      data: {
        total: totalArtifacts,
        accepted: acceptedArtifacts,
        archived: archivedArtifacts,
        deleted: deletedArtifacts,
        byEntity: artifactsByEntity,
      },
    });
  } catch (error) {
    console.error('Error fetching NLP artifacts statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch NLP artifacts statistics',
      error: error.message,
    });
  }
};

module.exports = {
  saveNLPArtifact,
  getNLPArtifactsByEntity,
  getAllNLPArtifacts,
  getNLPArtifactById,
  updateNLPArtifact,
  deleteNLPArtifact,
  getNLPArtifactsStats,
};
