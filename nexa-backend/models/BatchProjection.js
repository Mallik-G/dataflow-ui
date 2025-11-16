const { DataTypes } = require('sequelize');
const { sq } = require('../config/dbConfig');

const BatchProjection = sq.define(
  'BatchProjection',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    entityName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Name of the main entity for the projection',
    },
    selectedEntities: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'JSON object containing selected entities and their attributes',
    },
    settings: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'Projection settings like output format, compression, etc.',
    },
    schedule: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Schedule configuration for recurring projections',
    },
    output: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'Output configuration including S3 bucket and path',
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'paused'),
      defaultValue: 'active',
      allowNull: false,
    },
    lastRunAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp of the last successful run',
    },
    nextRunAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp of the next scheduled run',
    },
    runCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of times this projection has been executed',
    },
    errorCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of failed executions',
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Last error message if any',
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'User who created this projection',
    },
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'User who last updated this projection',
    },
  },
  {
    tableName: 'batch_projections',
    timestamps: true,
    indexes: [
      {
        fields: ['entityName'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['nextRunAt'],
      },
      {
        fields: ['createdAt'],
      },
    ],
  }
);

module.exports = BatchProjection;
