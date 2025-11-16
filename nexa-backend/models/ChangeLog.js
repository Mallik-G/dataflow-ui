const { DataTypes } = require('sequelize');
const { sq } = require('../config/dbConfig');

const ChangeLog = sq.define(
  'ChangeLog',
  {
    change_log_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['Schema', 'ETL']]
      }
    },
    ingestion_type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['raw', 'curated', 'consumption']]
      }
    },
    previous_data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    new_data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    Old_commit_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    creation_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    created_by: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'admin@gmail.com',
    },
  },
  {
    tableName: 'change_log',
    timestamps: false,
    indexes: [
      {
        fields: ['type'],
      },
      {
        fields: ['ingestion_type'],
      },
      {
        fields: ['creation_date'],
      },
      {
        fields: ['created_by'],
      },
    ],
  }
);

module.exports = ChangeLog;
