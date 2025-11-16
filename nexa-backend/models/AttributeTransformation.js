const { DataTypes } = require('sequelize');
const { sq } = require('../config/dbConfig');

const AttributeTransformation = sq.define(
  'AttributeTransformation',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    entityName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    curatedEntityName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fileType: {
      type: DataTypes.STRING,
      defaultValue: 'curated',
      allowNull: false,
    },
    sourceAttributes: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    curatedAttributes: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    mappings: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    columnRules: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    operatorRules: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    concatenationRules: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    entityNLPRules: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    columnDescriptions: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    newColumns: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    entityLevelMetadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    fileData: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    transformationId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'draft',
      allowNull: false,
    },
    version: {
      type: DataTypes.STRING,
      defaultValue: '1.0',
      allowNull: false,
    },
    lastAppliedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    appliedCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'attribute_transformations',
    timestamps: true,
  }
);

module.exports = AttributeTransformation;
