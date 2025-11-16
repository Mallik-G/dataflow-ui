const { AttributeTransformation } = require('../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

class AttributeTransformationService {
  /**
   * Save or update attribute transformations
   */
  static async saveTransformation(transformationData) {
    try {
      const {
        entityName,
        curatedEntityName,
        fileType = 'curated',
        sourceAttributes,
        curatedAttributes,
        mappings,
        columnRules,
        operatorRules,
        concatenationRules,
        entityNLPRules,
        columnDescriptions,
        newColumns,
        entityLevelMetadata,
        fileData,
        createdBy,
        updatedBy,
        notes,
      } = transformationData;

      // Generate unique transformation ID
      const transformationId = `trans_${uuidv4()
        .replace(/-/g, '')
        .substring(0, 8)}`;

      // Check if transformation already exists for this entity and file type
      const existingTransformation = await AttributeTransformation.findOne({
        where: {
          entityName,
          fileType,
        },
      });

      let transformation;

      if (existingTransformation) {
        // Update existing transformation
        transformation = await existingTransformation.update({
          curatedEntityName,
          sourceAttributes,
          curatedAttributes,
          mappings,
          columnRules,
          operatorRules,
          concatenationRules,
          entityNLPRules,
          columnDescriptions,
          newColumns,
          entityLevelMetadata,
          fileData,
          transformationId: existingTransformation.transformationId,
          updatedBy: updatedBy || createdBy || 'system',
          notes,
        });
      } else {
        // Create new transformation
        transformation = await AttributeTransformation.create({
          entityName,
          curatedEntityName,
          fileType,
          sourceAttributes,
          curatedAttributes,
          mappings,
          columnRules,
          operatorRules,
          concatenationRules,
          entityNLPRules,
          columnDescriptions,
          newColumns,
          entityLevelMetadata,
          fileData,
          transformationId,
          createdBy: createdBy || 'system',
          updatedBy: updatedBy || createdBy || 'system',
          notes,
        });
      }

      return {
        success: true,
        transformation: transformation.toJSON(),
        message: existingTransformation
          ? 'Transformation updated successfully'
          : 'Transformation saved successfully',
      };
    } catch (error) {
      console.error('Error saving attribute transformation:', error);
      throw error;
    }
  }

  /**
   * Get transformation by entity name and file type
   */
  static async getTransformation(entityName, fileType = 'curated') {
    try {
      const transformation = await AttributeTransformation.findOne({
        where: {
          entityName,
          fileType,
        },
        order: [['updatedAt', 'DESC']],
      });

      return {
        success: true,
        transformation: transformation ? transformation.toJSON() : null,
        message: transformation
          ? 'Transformation found'
          : 'No transformation found',
      };
    } catch (error) {
      console.error('Error getting attribute transformation:', error);
      throw error;
    }
  }

  /**
   * Get all transformations with optional filtering
   */
  static async getAllTransformations(filters = {}) {
    try {
      const whereClause = {};

      // Apply filters
      if (filters.entityName) {
        whereClause.entityName = filters.entityName;
      }
      if (filters.fileType) {
        whereClause.fileType = filters.fileType;
      }
      if (filters.status) {
        whereClause.status = filters.status;
      }
      if (filters.createdBy) {
        whereClause.createdBy = filters.createdBy;
      }

      const transformations = await AttributeTransformation.findAll({
        where: whereClause,
        order: [['updatedAt', 'DESC']],
      });

      return {
        success: true,
        transformations: transformations.map((t) => t.toJSON()),
        count: transformations.length,
      };
    } catch (error) {
      console.error('Error getting all attribute transformations:', error);
      throw error;
    }
  }

  /**
   * Update transformation status
   */
  static async updateTransformationStatus(entityName, fileType, status) {
    try {
      const transformation = await AttributeTransformation.findOne({
        where: {
          entityName,
          fileType,
        },
      });

      if (!transformation) {
        throw new Error('Transformation not found');
      }

      await transformation.update({
        status,
        updatedBy: 'system',
      });

      return {
        success: true,
        transformation: transformation.toJSON(),
        message: 'Transformation status updated successfully',
      };
    } catch (error) {
      console.error('Error updating transformation status:', error);
      throw error;
    }
  }

  /**
   * Mark transformation as applied
   */
  static async markTransformationApplied(entityName, fileType) {
    try {
      const transformation = await AttributeTransformation.findOne({
        where: {
          entityName,
          fileType,
        },
      });

      if (!transformation) {
        throw new Error('Transformation not found');
      }

      await transformation.update({
        lastAppliedAt: new Date(),
        appliedCount: transformation.appliedCount + 1,
        updatedBy: 'system',
      });

      return {
        success: true,
        transformation: transformation.toJSON(),
        message: 'Transformation marked as applied',
      };
    } catch (error) {
      console.error('Error marking transformation as applied:', error);
      throw error;
    }
  }

  /**
   * Delete transformation
   */
  static async deleteTransformation(entityName, fileType) {
    try {
      const transformation = await AttributeTransformation.findOne({
        where: {
          entityName,
          fileType,
        },
      });

      if (!transformation) {
        throw new Error('Transformation not found');
      }

      await transformation.destroy();

      return {
        success: true,
        message: 'Transformation deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting transformation:', error);
      throw error;
    }
  }

  /**
   * Get transformation statistics
   */
  static async getTransformationStats() {
    try {
      const stats = await AttributeTransformation.findAll({
        attributes: [
          'fileType',
          'status',
          [AttributeTransformation.sequelize.fn('COUNT', '*'), 'count'],
        ],
        group: ['fileType', 'status'],
      });

      const totalTransformations = await AttributeTransformation.count();
      const activeTransformations = await AttributeTransformation.count({
        where: { status: 'active' },
      });
      const draftTransformations = await AttributeTransformation.count({
        where: { status: 'draft' },
      });

      return {
        success: true,
        stats: {
          total: totalTransformations,
          active: activeTransformations,
          draft: draftTransformations,
          byTypeAndStatus: stats.map((s) => s.toJSON()),
        },
      };
    } catch (error) {
      console.error('Error getting transformation stats:', error);
      throw error;
    }
  }
}

module.exports = AttributeTransformationService;
