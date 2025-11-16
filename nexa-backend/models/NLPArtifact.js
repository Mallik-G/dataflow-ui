const { DataTypes } = require('sequelize');
const { sq } = require('../config/dbConfig');

const NLPArtifact = sq.define(
  'NLPArtifact',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    entityName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Name of the raw entity (e.g., users)',
    },
    curatedEntityName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Name of the curated/consumption entity (e.g., curated.users)',
    },
    nlpDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Natural language description provided for NLP generation',
    },
    sqlCode: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Generated SQL code',
    },
    pysparkCode: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Generated PySpark code',
    },
    entityColumns: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Columns relevant to this NLP artifact',
    },
    filePath: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Path to the saved artifact file on the server',
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Name of the saved artifact file',
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
        isIn: [['accepted', 'archived', 'deleted']],
      },
    },
    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Timestamp when the artifact was accepted',
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
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment: 'Additional metadata about the artifact',
    },
  },
  {
    tableName: 'nlp_artifacts',
    timestamps: true,
  }
);

module.exports = NLPArtifact;
