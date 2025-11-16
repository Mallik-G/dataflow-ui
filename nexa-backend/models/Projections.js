const { DataTypes } = require('sequelize');
const { sq } = require('../config/dbConfig');

const Projections = sq.define(
  'Projections',
  {
    projection_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    projection_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Description of Table',
    },
    source_entities: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    target_layer: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['curated', 'consumption']],
      },
    },
    projection_type: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['live', 'batch']],
      },
    },
    schedule_time: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    frequency: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [['hourly', 'daily', 'weekly', 'monthly', 'custom', '']],
      },
    },
    time_of_day: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    legacy_projection: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    projection_sources: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    projection_target: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    pii_suppressed: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [
          ['running', 'suspended', 'failed', 'paused', 'completed', 'pending'],
        ],
      },
      defaultValue: 'pending',
    },
    last_run_date: {
      type: DataTypes.DATE,
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
    tableName: 'projections',
    timestamps: true,
    paranoid: true,
  }
);

module.exports = Projections;
