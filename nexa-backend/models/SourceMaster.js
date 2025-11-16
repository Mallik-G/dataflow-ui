const { DataTypes } = require('sequelize');
const { sq } = require('../config/dbConfig');

const SourceMaster = sq.define(
  'SourceMaster',
  {
    source_master_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    source_name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Description of Table',
    },
    catalog: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    schema: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
    },
    tables: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      unique: true,
    },
    table_schema_mapping: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: 'source_master',
    timestamps: true,
  }
);

module.exports = SourceMaster;
