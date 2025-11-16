const { DataTypes } = require('sequelize');
const { sq } = require('../config/dbConfig');

const RawFileSchema = sq.define(
  'RawFileSchema',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    entityName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Name of the raw entity (e.g., raw.customers)',
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Original filename uploaded',
    },
    fileKey: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'S3 key where the file is stored',
    },
    fileLocation: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'S3 URL location of the file',
    },
    fileSize: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'File size in bytes',
    },
    contentType: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'MIME type of the file',
    },
    schemaAttributes: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment:
        'Array of column names/schema attributes extracted from the file',
    },
    schemaMetadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment:
        'Additional metadata about the schema (data types, sample values, etc.)',
    },
    fileData: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment: 'Additional file metadata (last modified, etc.)',
    },
    schemaId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Unique identifier for this schema',
      indexes: [
        {
          unique: true,
          fields: ['schemaId'],
        },
      ],
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'active',
      allowNull: false,
      validate: {
        isIn: [['active', 'archived', 'deleted']],
      },
    },
    version: {
      type: DataTypes.STRING,
      defaultValue: '1.0',
      allowNull: false,
    },
    lastProcessedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when schema was last processed',
    },
    processedCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of times this schema has been processed',
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'User who uploaded the file',
    },
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'User who last updated the schema',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes about the schema',
    },
    processingMode: {
      type: DataTypes.STRING,
      defaultValue: 'file-and-schema',
      allowNull: false,
      validate: {
        isIn: [['file-and-schema', 'schema-only']],
      },
      comment:
        'Whether file was saved (file-and-schema) or only schema extracted (schema-only)',
    },
  },
  {
    tableName: 'raw_file_schemas',
    timestamps: true,
  }
);

module.exports = RawFileSchema;
