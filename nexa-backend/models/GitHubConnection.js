const { DataTypes } = require('sequelize');
const { sq } = require('../config/dbConfig');

const GitHubConnection = sq.define(
  'GitHubConnection',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    repositoryUrl: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'GitHub repository URL',
    },
    repositoryOwner: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Repository owner/organization name',
    },
    repositoryName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Repository name',
    },
    branch: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'main',
      comment: 'Repository branch name',
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'GitHub username or personal access token',
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'GitHub password (encrypted, only for username/password auth)',
    },
    authMethod: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'token',
      comment: 'Authentication method used',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether this connection is currently active',
    },
    lastTestedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp of last successful connection test',
    },
    lastTestResult: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Result of last connection test',
    },
    testCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of times this connection has been tested',
    },
    successCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of successful connection tests',
    },
    failureCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of failed connection tests',
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Last error message if connection failed',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment: 'Additional metadata about the connection',
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'User who created this connection',
    },
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'User who last updated this connection',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes about the connection',
    },
  },
  {
    tableName: 'github_connections',
    timestamps: true,
    indexes: [
      {
        // unique: true,
        fields: ['repositoryUrl', 'branch'],
        where: {
          isActive: true,
        },
      },
      {
        fields: ['isActive'],
      },
      {
        fields: ['lastTestedAt'],
      },
    ],
  }
);

module.exports = GitHubConnection;
