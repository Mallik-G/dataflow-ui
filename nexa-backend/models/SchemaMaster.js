const { DataTypes } = require('sequelize');
const { sq } = require('../config/dbConfig');

const SchemaMaster = sq.define(
  'SchemaMaster',
  {
    entity_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    source_master_id: {
      type: DataTypes.UUID,
      references: {
        model: 'source_master',
        key: 'source_master_id',
      },
      allowNull: false,
      comment: 'Source master id',
    },
    source_name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Name of source / database ',
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Name of entity',
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Description of Table',
    },
    ddl: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'DDL structure',
    },
    schema: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'schema of table',
    },
    ingestion_type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['raw', 'curated', 'consumption']],
      },
      comment: 'type of ingestion',
    },
    commit_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    creation_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    created_by: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    modify_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    modify_by: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: 'entity_schema_master',
    timestamps: true,
  }
);

module.exports = SchemaMaster;
