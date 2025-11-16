const { DataTypes } = require('sequelize');
const { sq } = require('../config/dbConfig');

const WorkspaceCode = sq.define(
  'WorkspaceCode',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    entityName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Name of the entity (e.g., consumption.account)',
    },
    nlpDescription: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Natural language description of the transformation',
    },
    sqlCode: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Generated SQL code',
    },
    pysparkCode: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Generated PySpark code',
    },
    isEditingSql: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether SQL code is being edited',
    },
    isEditingPySpark: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether PySpark code is being edited',
    },
    editableSqlCode: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Editable version of SQL code',
    },
    editablePySparkCode: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Editable version of PySpark code',
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'workspace_codes',
    timestamps: true,
    indexes: [
      {
        fields: ['entityName'],
      },
    ],
  }
);

module.exports = WorkspaceCode;
