const { sq } = require('../config/dbConfig');
const BatchProjection = require('./BatchProjection');
const AttributeTransformation = require('./AttributeTransformation');
const RawFileSchema = require('./RawFileSchema');
const ConsumptionFileSchema = require('./ConsumptionFileSchema');
const GitHubConnection = require('./GitHubConnection');
const NLPArtifact = require('./NLPArtifact');
const ConsumptionETLTransformation = require('./ConsumptionETLTransformation');
const WorkspaceCode = require('./WorkspaceCode');
const ChangeLog = require('./ChangeLog');
const Connectors = require('./Connectors');
const SchemaMaster = require('./SchemaMaster');

// Define associations here if needed
// Example: BatchProjection.hasMany(ProjectionRun, { foreignKey: 'projectionId' });

module.exports = {
  sq,
  BatchProjection,
  AttributeTransformation,
  RawFileSchema,
  ConsumptionFileSchema,
  GitHubConnection,
  NLPArtifact,
  ConsumptionETLTransformation,
  WorkspaceCode,
  ChangeLog,
  Connectors,
  SchemaMaster,
};
