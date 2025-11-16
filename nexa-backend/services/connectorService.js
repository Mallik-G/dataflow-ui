const { Connectors, SchemaMaster } = require('../models');
const { Op } = require('sequelize');
const { saveConnectorSecret, getConnectorSecret } = require("../utils/awsSecrets");
class ConnectorService {
  /**
   * Get all connectors with optional filtering
   */
  static async getAllConnectors(req, res, next) {
    try {
      const { keyword, offset, perPage: limit } = req.query;

      const whereClause = {};

      // Apply filters

      if (keyword) {
        whereClause.name = {
          [Op.iLike]: `%${keyword}%`,
        };
      }

      const connectors = await Connectors.findAndCountAll({
        where: whereClause,
        limit: limit,
        offset: offset,
        order: [['createdAt', 'DESC']],
      });

      return { 'totalRecord': connectors.count, 'list': connectors.rows };

    } catch (error) {
      console.error('Error fetching connectors:', error);
      throw error;
    }
  }

  /**
   * Create a new connector
   */
  static async createConnector(connectorData) {
    try {

      // Store sensitive credentials in AWS Secrets Manager
      const secretArn = await saveConnectorSecret(connectorData.name, connectorData.authConfig);

      const connector = await Connectors.create({
        name: connectorData.name,
        source_dataset: connectorData.source_dataset,
        targetSystem: connectorData.targetSystem,
        authConfig: { secretArn },
        cdc_mode: connectorData.cdc_mode,
        sync_type: connectorData.sync_type,
        watermark_column: connectorData.watermark_column,
        primary_keys: connectorData.primary_keys,
        sync_mode: connectorData.sync_mode,
        schedule_cron: connectorData.schedule_cron,
        compute_type: connectorData.compute_type,
        cluster_config: connectorData.cluster_config,
        status: connectorData.status,
        createdBy: connectorData.createdBy || 'system',
        updatedBy: connectorData.updatedBy || 'system',
      });

      return {
        success: true,
        connector: connector.toJSON(),
      };
    } catch (error) {
      console.error('Error creating connector:', error);
      throw error;
    }
  }

  /**
   * Delete a connector
   */
  static async deleteConnector(id) {
    try {
      const connector = await Connectors.findByPk(id);

      if (!connector) {
        return {
          success: false,
          message: 'Connector not found',
        };
      }

      await connector.destroy();

      return {
        success: true,
        message: 'Connector deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting Connector:', error);
      throw error;
    }
  }

  /**
   * Find a connector by Id
   */
  static async getConnector(id) {
    try {
      const connector = await Connectors.findByPk(id);

      if (!connector) {
        return {
          success: false,
          message: 'Connector not found',
        };
      }

      const creds = await getConnectorSecret(connector.authConfig.secretArn);

      return {
        success: true,
        data: connector,
        creds:creds,
        message: 'Connector data',
      };
    } catch (error) {
      console.error('Error deleting Connector:', error);
      throw error;
    }
  }

  //Get All Sources
  static async getAllSources(req, res, next) {
    try {
      const allSources = await SchemaMaster.findAll({
        attributes: ['name'],
        order: [['createdAt', 'DESC']],
      });

      const sources = allSources.map((item) => item.name);

      return sources;

    } catch (error) {
      console.error('Error fetching sources:', error);
      throw error;
    }
  }

}

module.exports = ConnectorService;
