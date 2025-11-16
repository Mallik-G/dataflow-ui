const { DataTypes } = require('sequelize');
const { sq } = require('../config/dbConfig');
const Connectors = sq.define(
    'Connectors',
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        source_dataset: {
            type: DataTypes.ARRAY(DataTypes.STRING), // Array of String
            allowNull: true,
        },
        targetSystem: {
            type: DataTypes.STRING,  
            allowNull: true,
        },
        authConfig: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
        cdc_mode: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        sync_type: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        watermark_column: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        primary_keys: {
            type: DataTypes.ARRAY(DataTypes.STRING), // Array of String
            allowNull: true,
        },
        sync_mode: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        schedule_cron: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        compute_type: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        cluster_config: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        last_run_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Timestamp of the last successful run',
        },
        last_run_status: {
            type: DataTypes.STRING,
            allowNull: true
        },
        lastError: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Last error message if any',
        },
        last_watermark: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        next_run_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        createdBy: {
            type: DataTypes.STRING,
            allowNull: true
        },
        updatedBy: {
            type: DataTypes.STRING,
            allowNull: true
        },
    },
    {
        tableName: 'connectors',
        timestamps: true,
        indexes: [
            {
                fields: ['name'],
            },
            {
                fields: ['status'],
            },
            {
                fields: ['createdAt'],
            },
        ],
    }
);

module.exports = Connectors;
