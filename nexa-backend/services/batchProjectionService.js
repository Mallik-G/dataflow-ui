const { BatchProjection } = require('../models');
const { Op } = require('sequelize');

class BatchProjectionService {
  /**
   * Create a new batch projection configuration
   */
  static async createProjection(projectionData) {
    try {
      const projection = await BatchProjection.create({
        entityName: projectionData.entityName,
        selectedEntities: projectionData.selectedEntities,
        settings: projectionData.settings,
        schedule: projectionData.schedule,
        output: projectionData.output,
        createdBy: projectionData.createdBy || 'system',
        updatedBy: projectionData.updatedBy || 'system',
      });

      return {
        success: true,
        projection: projection.toJSON(),
      };
    } catch (error) {
      console.error('Error creating batch projection:', error);
      throw error;
    }
  }

  /**
   * Get all batch projections with optional filtering
   */
  static async getAllProjections(filters = {}) {
    try {
      const whereClause = {};

      // Apply filters
      if (filters.status) {
        whereClause.status = filters.status;
      }

      if (filters.entityName) {
        whereClause.entityName = {
          [Op.iLike]: `%${filters.entityName}%`,
        };
      }

      if (filters.createdBy) {
        whereClause.createdBy = filters.createdBy;
      }

      const projections = await BatchProjection.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
      });

      return {
        success: true,
        projections: projections.map((p) => p.toJSON()),
        total: projections.length,
      };
    } catch (error) {
      console.error('Error fetching batch projections:', error);
      throw error;
    }
  }

  /**
   * Get a single batch projection by ID
   */
  static async getProjectionById(id) {
    try {
      const projection = await BatchProjection.findByPk(id);

      if (!projection) {
        return {
          success: false,
          message: 'Projection not found',
        };
      }

      return {
        success: true,
        projection: projection.toJSON(),
      };
    } catch (error) {
      console.error('Error fetching batch projection:', error);
      throw error;
    }
  }

  /**
   * Update a batch projection configuration
   */
  static async updateProjection(id, updateData) {
    try {
      const projection = await BatchProjection.findByPk(id);

      if (!projection) {
        return {
          success: false,
          message: 'Projection not found',
        };
      }

      // Update the projection
      await projection.update({
        ...updateData,
        updatedBy: updateData.updatedBy || 'system',
        updatedAt: new Date(),
      });

      return {
        success: true,
        projection: projection.toJSON(),
      };
    } catch (error) {
      console.error('Error updating batch projection:', error);
      throw error;
    }
  }

  /**
   * Delete a batch projection configuration
   */
  static async deleteProjection(id) {
    try {
      const projection = await BatchProjection.findByPk(id);

      if (!projection) {
        return {
          success: false,
          message: 'Projection not found',
        };
      }

      await projection.destroy();

      return {
        success: true,
        message: 'Projection deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting batch projection:', error);
      throw error;
    }
  }

  /**
   * Update projection status
   */
  static async updateStatus(id, status, updatedBy = 'system') {
    try {
      const projection = await BatchProjection.findByPk(id);

      if (!projection) {
        return {
          success: false,
          message: 'Projection not found',
        };
      }

      await projection.update({
        status,
        updatedBy,
        updatedAt: new Date(),
      });

      return {
        success: true,
        projection: projection.toJSON(),
      };
    } catch (error) {
      console.error('Error updating projection status:', error);
      throw error;
    }
  }

  /**
   * Update projection run statistics
   */
  static async updateRunStats(
    id,
    { lastRunAt, nextRunAt, success = true, error = null }
  ) {
    try {
      const projection = await BatchProjection.findByPk(id);

      if (!projection) {
        return {
          success: false,
          message: 'Projection not found',
        };
      }

      const updateData = {
        lastRunAt,
        nextRunAt,
        runCount: projection.runCount + 1,
        updatedAt: new Date(),
      };

      if (success) {
        updateData.errorCount = 0;
        updateData.lastError = null;
      } else {
        updateData.errorCount = projection.errorCount + 1;
        updateData.lastError = error;
      }

      await projection.update(updateData);

      return {
        success: true,
        projection: projection.toJSON(),
      };
    } catch (error) {
      console.error('Error updating projection run stats:', error);
      throw error;
    }
  }

  /**
   * Get projections that are due to run
   */
  static async getDueProjections() {
    try {
      const now = new Date();

      const projections = await BatchProjection.findAll({
        where: {
          status: 'active',
          nextRunAt: {
            [Op.lte]: now,
          },
        },
        order: [['nextRunAt', 'ASC']],
      });

      return {
        success: true,
        projections: projections.map((p) => p.toJSON()),
      };
    } catch (error) {
      console.error('Error fetching due projections:', error);
      throw error;
    }
  }

  /**
   * Get projection statistics
   */
  static async getProjectionStats() {
    try {
      const stats = await BatchProjection.findAll({
        attributes: [
          'status',
          [
            BatchProjection.sequelize.fn(
              'COUNT',
              BatchProjection.sequelize.col('id')
            ),
            'count',
          ],
        ],
        group: ['status'],
      });

      const totalProjections = await BatchProjection.count();
      const activeProjections = await BatchProjection.count({
        where: { status: 'active' },
      });
      const dueProjections = await BatchProjection.count({
        where: {
          status: 'active',
          nextRunAt: {
            [Op.lte]: new Date(),
          },
        },
      });

      return {
        success: true,
        stats: {
          total: totalProjections,
          active: activeProjections,
          due: dueProjections,
          byStatus: stats.reduce((acc, stat) => {
            acc[stat.status] = parseInt(stat.dataValues.count);
            return acc;
          }, {}),
        },
      };
    } catch (error) {
      console.error('Error fetching projection stats:', error);
      throw error;
    }
  }
}

module.exports = BatchProjectionService;
