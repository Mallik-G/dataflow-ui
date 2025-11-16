const { DataTypes } = require('sequelize');
const { sq } = require('../config/dbConfig');

const ConsumptionETLTransformation = sq.define(
  'ConsumptionETLTransformation',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    entityName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Name of the consumption entity (e.g., consumption.customers)',
    },
    columnName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Name of the column being transformed',
    },
    transformationType: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['nlp', 'operator', 'dq_rules', 'concatenation', 'custom']],
      },
      comment: 'Type of transformation applied',
    },
    nlpDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Natural language description of the transformation',
    },
    sqlCode: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Generated SQL code for the transformation',
    },
    pysparkCode: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Generated PySpark code for the transformation',
    },
    transformationRules: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment: 'Additional transformation rules and parameters',
    },
    entityColumns: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Columns relevant to this transformation',
    },
    filePath: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Path to the saved transformation file on the server',
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Name of the saved transformation file',
    },
    version: {
      type: DataTypes.STRING,
      defaultValue: '1.0',
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'accepted',
      allowNull: false,
      validate: {
        isIn: [['accepted', 'archived', 'deleted', 'draft']],
      },
    },
    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Timestamp when the transformation was accepted',
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'system',
    },
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes about the transformation',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment: 'Additional metadata about the transformation',
    },
  },
  {
    tableName: 'consumption_etl_transformations',
    timestamps: true,
    indexes: [
      {
        fields: ['entityName', 'columnName'],
        name: 'entity_column_index',
      },
      {
        fields: ['transformationType'],
        name: 'transformation_type_index',
      },
      {
        fields: ['status'],
        name: 'status_index',
      },
    ],
  }
);

module.exports = ConsumptionETLTransformation;
