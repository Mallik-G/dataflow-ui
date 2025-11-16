const GitHubService = require('../services/githubService');
// const axios = require('axios'); // No longer needed - using direct database access

/**
 * Generate all artifacts for data engineering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const generateAllArtifacts = async (req, res) => {
  try {
    const {
      entityName,
      transformations,
      pushToGitHub = false,
      githubConfig = null,
      customArtifacts = null,
      storedArtifacts = null,
      folderPath,
    } = req.body;

    // Import NLPArtifact model for direct database access
    const { NLPArtifact } = require('../models/NLPArtifact');
    console.log('NLPArtifact model imported:', !!NLPArtifact);
    console.log('NLPArtifact model type:', typeof NLPArtifact);

    // Test database connection
    try {
      const { sq } = require('../config/dbConfig');
      console.log(
        'Database connection status:',
        sq.authenticate ? 'Available' : 'Not available'
      );
    } catch (dbError) {
      console.error('Database connection error:', dbError);
    }

    console.log('Generating all artifacts for entity:', entityName);

    if (!entityName || !transformations) {
      return res.status(400).json({
        success: false,
        message: 'Entity name and transformations are required',
      });
    }

    // Generate all artifacts
    const artifacts = {
      entityName,
      curatedEntityName: transformations.curatedEntityName,
      generatedAt: new Date().toISOString(),
      artifacts: {},
    };

    // Generate DDL artifacts (SQL and PySpark code)
    console.log('Generating SQL code for:', entityName);
    const backendSql = generateSQLCode(entityName, transformations);
    console.log('Generated SQL code length:', backendSql?.length || 0);

    console.log('Generating PySpark code for:', entityName);
    const backendPySpark = generatePySparkCode(entityName, transformations);
    console.log('Generated PySpark code length:', backendPySpark?.length || 0);

    // Generate additional DDL artifacts
    console.log('Generating configuration files for:', entityName);
    const configFiles = generateConfigFiles(entityName, transformations);
    console.log('Generated config files:', Object.keys(configFiles));

    console.log('Generating documentation for:', entityName);
    const documentation = generateDocumentation(entityName, transformations);
    console.log('Generated documentation length:', documentation?.length || 0);

    console.log('Generating CI/CD pipeline for:', entityName);
    const cicdPipeline = generateCICDPipeline(entityName);
    console.log('Generated CI/CD pipeline length:', cicdPipeline?.length || 0);

    console.log('Generating Dockerfile for:', entityName);
    const dockerfile = generateDockerfile(entityName);
    console.log('Generated Dockerfile length:', dockerfile?.length || 0);

    // Generate DML artifacts (Data Manipulation Language)
    console.log('Generating DML SQL for:', entityName);
    const dmlSql = generateDMLSQL(entityName, transformations);
    console.log('Generated DML SQL length:', dmlSql?.length || 0);

    console.log('Generating DML PySpark for:', entityName);
    const dmlPySpark = generateDMLPySpark(entityName, transformations);
    console.log('Generated DML PySpark length:', dmlPySpark?.length || 0);

    // Fetch accepted NLP artifacts for this entity
    let nlpSql = '';
    let nlpPySpark = '';
    try {
      // Fetch NLP artifacts directly from database
      console.log(
        `Attempting to fetch NLP artifacts for entity: ${entityName}`
      );

      // First, let's test if we can query the database at all
      try {
        const totalCount = await NLPArtifact.count();
        console.log(`Total NLP artifacts in database: ${totalCount}`);

        const acceptedCount = await NLPArtifact.count({
          where: { status: 'accepted' },
        });
        console.log(`Accepted NLP artifacts in database: ${acceptedCount}`);
      } catch (countError) {
        console.error('Error counting NLP artifacts:', countError);
        throw countError;
      }

      const nlpArtifacts = await NLPArtifact.findAll({
        where: { status: 'accepted' },
        order: [['acceptedAt', 'DESC']],
      });

      console.log(
        `Found ${nlpArtifacts.length} accepted transformation artifacts`
      );
      console.log(
        'NLP Artifacts found:',
        nlpArtifacts.map((a) => ({
          entityName: a.entityName,
          status: a.status,
          hasSql: !!a.sqlCode,
          hasPySpark: !!a.pysparkCode,
        }))
      );

      if (nlpArtifacts.length > 0) {
        const availableEntities = nlpArtifacts.map((a) => a.entityName);
        console.log(
          `Available entity names in NLP artifacts:`,
          availableEntities
        );

        // Check if our entity name exists in the available entities
        console.log(`Looking for entity: "${entityName}"`);
        console.log(
          `Available entities: [${availableEntities
            .map((e) => `"${e}"`)
            .join(', ')}]`
        );

        // Try exact match first
        let matchingArtifact = nlpArtifacts.find(
          (a) => a.entityName === entityName
        );

        // If no exact match, try different variations
        if (!matchingArtifact) {
          console.log(`No exact match found, trying variations...`);

          // Try without underscores
          const entityNameNoUnderscore = entityName.replace(/_/g, '');
          matchingArtifact = nlpArtifacts.find(
            (a) => a.entityName.replace(/_/g, '') === entityNameNoUnderscore
          );
          if (matchingArtifact) {
            console.log(
              `Found match with no underscores: ${matchingArtifact.entityName}`
            );
          }

          // Try with different case
          if (!matchingArtifact) {
            matchingArtifact = nlpArtifacts.find(
              (a) => a.entityName.toLowerCase() === entityName.toLowerCase()
            );
            if (matchingArtifact) {
              console.log(
                `Found match with case insensitive: ${matchingArtifact.entityName}`
              );
            }
          }

          // Try partial matching
          if (!matchingArtifact) {
            const partialMatches = nlpArtifacts.filter(
              (a) =>
                a.entityName.includes(entityName) ||
                entityName.includes(a.entityName)
            );
            if (partialMatches.length > 0) {
              console.log(
                `Partial matches found:`,
                partialMatches.map((a) => a.entityName)
              );
              // Use the first partial match
              matchingArtifact = partialMatches[0];
              console.log(
                `Using partial match: ${matchingArtifact.entityName}`
              );
            }
          }
        }

        if (matchingArtifact) {
          console.log(
            `Found matching transformation artifact for ${entityName}:`,
            matchingArtifact.entityName
          );
          console.log(
            `SQL Code length: ${matchingArtifact.sqlCode?.length || 0}`
          );
          console.log(
            `PySpark Code length: ${matchingArtifact.pysparkCode?.length || 0}`
          );
          nlpSql = matchingArtifact.sqlCode || '';
          nlpPySpark = matchingArtifact.pysparkCode || '';
        } else {
          console.log(
            `No transformation artifacts found for ${entityName}. Available entities: ${availableEntities.join(
              ', '
            )}`
          );
          // Try partial matching
          const partialMatches = nlpArtifacts.filter(
            (a) =>
              a.entityName.includes(entityName) ||
              entityName.includes(a.entityName)
          );
          if (partialMatches.length > 0) {
            console.log(
              `Partial matches found:`,
              partialMatches.map((a) => a.entityName)
            );
          }
        }
      }
    } catch (nlpError) {
      console.error(
        `Error fetching transformation artifacts for ${entityName}:`,
        nlpError
      );
      console.log(
        `No transformation artifacts found for ${entityName}:`,
        nlpError.message
      );
    }

    // Organize artifacts by category
    console.log(`Final NLP values for ${entityName}:`, {
      nlpSqlLength: nlpSql.length,
      nlpPySparkLength: nlpPySpark.length,
      nlpSqlPreview: nlpSql.substring(0, 100),
      nlpPySparkPreview: nlpPySpark.substring(0, 100),
    });

    artifacts.artifacts = {
      // DDL artifacts (Data Definition Language)
      sql: backendSql,
      pyspark: backendPySpark,
      config: configFiles['config.yaml'],
      requirements: configFiles['requirements.txt'],
      documentation: documentation,
      cicd: cicdPipeline,
      dockerfile: dockerfile,

      // NLP artifacts (from accepted NLP artifacts)
      nlpSql: nlpSql,
      nlpPySpark: nlpPySpark,

      // DML artifacts (Data Manipulation Language)
      dmlSql: dmlSql,
      dmlPySpark: dmlPySpark,
    };

    // Push to GitHub if requested
    if (pushToGitHub && githubConfig) {
      try {
        const pushResult = await pushArtifactsToGitHub(
          artifacts,
          githubConfig,
          folderPath
        );
        artifacts.githubPush = pushResult;
      } catch (githubError) {
        console.error('Failed to push to GitHub:', githubError);
        artifacts.githubPush = {
          success: false,
          error: githubError.message,
        };
      }
    }

    res.json({
      success: true,
      message: 'All artifacts generated successfully',
      data: artifacts,
    });
  } catch (error) {
    console.error('Artifact generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate artifacts',
      error: error.message,
    });
  }
};

/**
 * Generate diff between existing and new artifacts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const generateArtifactsDiff = async (req, res) => {
  try {
    const {
      entityName,
      transformations,
      githubConfig,
      customArtifacts = null,
      storedArtifacts = null,
      folderPath,
    } = req.body;

    // Import NLPArtifact model for direct database access
    const { NLPArtifact } = require('../models/NLPArtifact');

    console.log('Generating diff for entity:', entityName);

    if (!entityName || !transformations || !githubConfig) {
      return res.status(400).json({
        success: false,
        message: 'Entity name, transformations, and GitHub config are required',
      });
    }

    // Generate all artifacts first
    const artifacts = {
      entityName,
      curatedEntityName: transformations.curatedEntityName,
      generatedAt: new Date().toISOString(),
      artifacts: {},
    };

    // Generate SQL and PySpark code
    const backendSql = generateSQLCode(entityName, transformations);
    const backendPySpark = generatePySparkCode(entityName, transformations);

    // Generate DML SQL and PySpark code
    const dmlSql = generateDMLSQL(entityName, transformations);
    const dmlPySpark = generateDMLPySpark(entityName, transformations);

    // Use backend-generated artifacts
    artifacts.artifacts.sql = backendSql;
    artifacts.artifacts.pyspark = backendPySpark;
    artifacts.artifacts.dmlSql = dmlSql;
    artifacts.artifacts.dmlPySpark = dmlPySpark;

    // Fetch accepted NLP artifacts for this entity
    try {
      // Fetch NLP artifacts directly from database
      const nlpArtifacts = await NLPArtifact.findAll({
        where: { status: 'accepted' },
        order: [['acceptedAt', 'DESC']],
      });

      console.log(
        `Found ${nlpArtifacts.length} accepted transformation artifacts`
      );

      if (nlpArtifacts.length > 0) {
        const availableEntities = nlpArtifacts.map((a) => a.entityName);
        console.log(
          `Available entity names in NLP artifacts:`,
          availableEntities
        );

        // Check if our entity name exists in the available entities
        const matchingArtifact = nlpArtifacts.find(
          (a) => a.entityName === entityName
        );

        if (matchingArtifact) {
          console.log(
            `Found matching transformation artifact for ${entityName}:`,
            matchingArtifact.entityName
          );
          artifacts.artifacts.nlpSql = matchingArtifact.sqlCode || '';
          artifacts.artifacts.nlpPySpark = matchingArtifact.pysparkCode || '';
        } else {
          console.log(
            `No transformation artifacts found for ${entityName}. Available entities: ${availableEntities.join(
              ', '
            )}`
          );
          artifacts.artifacts.nlpSql = '';
          artifacts.artifacts.nlpPySpark = '';
        }
      } else {
        artifacts.artifacts.nlpSql = '';
        artifacts.artifacts.nlpPySpark = '';
      }
    } catch (nlpError) {
      console.log(
        `No transformation artifacts found for ${entityName}:`,
        nlpError.message
      );
      artifacts.artifacts.nlpSql = '';
      artifacts.artifacts.nlpPySpark = '';
    }

    // Generate diff
    const diffResult = await GitHubService.generateArtifactsDiff(
      artifacts,
      githubConfig,
      folderPath
    );

    res.json({
      success: true,
      message: 'Diff generated successfully',
      data: {
        diff: diffResult.data,
        artifacts: artifacts,
      },
    });
  } catch (error) {
    console.error('Diff generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate diff',
      error: error.message,
    });
  }
};

/**
 * Generate diffs for multiple entities simultaneously
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const generateAllDiffs = async (req, res) => {
  try {
    const { entities, githubConfig, folderPath } = req.body;

    // Import NLPArtifact model for direct database access
    const { NLPArtifact } = require('../models/NLPArtifact');

    console.log('Generating diffs for multiple entities:', entities.length);

    if (!entities || !Array.isArray(entities) || !githubConfig) {
      return res.status(400).json({
        success: false,
        message: 'Entities array and GitHub config are required',
      });
    }

    if (entities.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one entity is required',
      });
    }

    const allDiffs = {};
    const allArtifacts = {};

    // Process all entities in parallel
    const diffPromises = entities.map(async (entityData) => {
      const { entityName, transformations } = entityData;

      try {
        console.log(`Processing entity: ${entityName}`);
        console.log(`Entity transformations:`, transformations);

        // Generate artifacts for this entity
        const artifacts = {
          entityName,
          curatedEntityName: transformations.curatedEntityName,
          generatedAt: new Date().toISOString(),
          artifacts: {},
        };

        // Generate SQL and PySpark code
        const backendSql = generateSQLCode(entityName, transformations);
        const backendPySpark = generatePySparkCode(entityName, transformations);

        // Generate DML SQL and PySpark code
        const dmlSql = generateDMLSQL(entityName, transformations);
        const dmlPySpark = generateDMLPySpark(entityName, transformations);

        // Use backend-generated artifacts
        artifacts.artifacts.sql = backendSql;
        artifacts.artifacts.pyspark = backendPySpark;
        artifacts.artifacts.dmlSql = dmlSql;
        artifacts.artifacts.dmlPySpark = dmlPySpark;

        // Fetch accepted NLP artifacts for this entity
        try {
          console.log(`Fetching NLP artifacts for entity: ${entityName}`);

          // Fetch NLP artifacts directly from database
          const nlpArtifacts = await NLPArtifact.findAll({
            where: { status: 'accepted' },
            order: [['acceptedAt', 'DESC']],
          });

          console.log(
            `Found ${nlpArtifacts.length} accepted transformation artifacts`
          );

          if (nlpArtifacts.length > 0) {
            const availableEntities = nlpArtifacts.map((a) => a.entityName);
            console.log(
              `Available entity names in NLP artifacts:`,
              availableEntities
            );

            // Check if our entity name exists in the available entities
            const matchingArtifact = nlpArtifacts.find(
              (a) => a.entityName === entityName
            );

            if (matchingArtifact) {
              console.log(
                `Found matching transformation artifact for ${entityName}:`,
                matchingArtifact.entityName
              );
              artifacts.artifacts.nlpSql = matchingArtifact.sqlCode || '';
              artifacts.artifacts.nlpPySpark =
                matchingArtifact.pysparkCode || '';
              console.log(
                `Found transformation artifacts for ${entityName}: SQL=${artifacts.artifacts.nlpSql.length}, PySpark=${artifacts.artifacts.nlpPySpark.length}`
              );
            } else {
              console.log(
                `No transformation artifacts found for ${entityName}. Available entities: ${availableEntities.join(
                  ', '
                )}`
              );
              artifacts.artifacts.nlpSql = '';
              artifacts.artifacts.nlpPySpark = '';
            }
          } else {
            console.log(
              `No transformation artifacts found for ${entityName}:`,
              'No artifacts in database'
            );
            artifacts.artifacts.nlpSql = '';
            artifacts.artifacts.nlpPySpark = '';
          }
        } catch (nlpError) {
          console.log(
            `Error fetching transformation artifacts for ${entityName}:`,
            nlpError.message
          );
          artifacts.artifacts.nlpSql = '';
          artifacts.artifacts.nlpPySpark = '';
        }

        // Generate diff for this entity
        console.log(`GitHub config for ${entityName}:`, {
          repositoryUrl: githubConfig.repositoryUrl,
          branch: githubConfig.branch,
          username: githubConfig.username ? '***' : 'undefined',
          password: githubConfig.password ? '***' : 'undefined',
        });

        const diffResult = await GitHubService.generateArtifactsDiff(
          artifacts,
          githubConfig,
          folderPath
        );

        return {
          entityName,
          diff: diffResult.data,
          artifacts: artifacts,
          success: true,
        };
      } catch (error) {
        console.error(`Failed to generate diff for ${entityName}:`, error);
        return {
          entityName,
          error: error.message,
          success: false,
        };
      }
    });

    // Wait for all diffs to be generated
    const results = await Promise.all(diffPromises);

    // Organize results
    results.forEach((result) => {
      if (result.success) {
        allDiffs[result.entityName] = result.diff;
        allArtifacts[result.entityName] = result.artifacts;
      } else {
        console.error(
          `Failed to generate diff for ${result.entityName}: ${result.error}`
        );
        // Include error information in response
        allDiffs[result.entityName] = {
          error: result.error,
          success: false,
        };
      }
    });

    const successfulCount = results.filter((r) => r.success).length;
    const failedCount = results.length - successfulCount;

    console.log(
      `Generated diffs for ${successfulCount} entities, ${failedCount} failed`
    );

    res.json({
      success: true,
      message: `Generated diffs for ${successfulCount} entities${
        failedCount > 0 ? `, ${failedCount} failed` : ''
      }`,
      data: {
        diffs: allDiffs,
        artifacts: allArtifacts,
        summary: {
          total: entities.length,
          successful: successfulCount,
          failed: failedCount,
        },
      },
    });
  } catch (error) {
    console.error('Batch diff generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate diffs for multiple entities',
      error: error.message,
    });
  }
};

/**
 * Generate SQL code for the entity
 */
const generateSQLCode = (entityName, transformations) => {
  const { mappings, columnRules, curatedAttributes, newColumns } =
    transformations;

  let code = `-- SQL Code for Entity: ${entityName}\n`;
  code += `-- Create curated table with transformations\n\n`;

  // Filter out control columns from actual table columns
  const tableColumns = curatedAttributes.filter(
    (attr) => !isControlColumn(attr)
  );

  code += `CREATE TABLE IF NOT EXISTS ${transformations.curatedEntityName} (\n`;

  // Add all curated attributes as columns (excluding control columns)
  tableColumns.forEach((attr, idx) => {
    let dataType = 'VARCHAR(255)'; // Default type

    // Determine data type based on column name
    if (attr.includes('timestamp') || attr.includes('date')) {
      dataType = 'TIMESTAMP';
    } else if (attr.includes('id') || attr.includes('_id')) {
      dataType = 'BIGINT';
    } else if (
      attr.includes('amount') ||
      attr.includes('price') ||
      attr.includes('cost')
    ) {
      dataType = 'DECIMAL(10,2)';
    } else if (attr.includes('quantity') || attr.includes('count')) {
      dataType = 'INTEGER';
    } else if (attr === 'is_deleted' || attr.includes('is_')) {
      dataType = 'BOOLEAN';
    }

    code += `    ${attr} ${dataType}`;
    if (idx < tableColumns.length - 1) code += ',';
    code += `\n`;
  });

  code += `);\n\n`;

  // Add ALTER TABLE commands for new columns if they exist
  if (newColumns && newColumns.length > 0) {
    code += `-- Add new columns to existing table\n`;
    newColumns.forEach((columnName) => {
      if (columnName && typeof columnName === 'string' && columnName.trim()) {
        let dataType = 'VARCHAR(255)'; // Default type

        // Determine data type based on column name
        if (columnName.includes('timestamp') || columnName.includes('date')) {
          dataType = 'TIMESTAMP';
        } else if (columnName.includes('id') || columnName.includes('_id')) {
          dataType = 'BIGINT';
        } else if (
          columnName.includes('amount') ||
          columnName.includes('price') ||
          columnName.includes('cost')
        ) {
          dataType = 'DECIMAL(10,2)';
        } else if (
          columnName.includes('quantity') ||
          columnName.includes('count')
        ) {
          dataType = 'INTEGER';
        } else if (columnName === 'is_deleted' || columnName.includes('is_')) {
          dataType = 'BOOLEAN';
        }

        code += `ALTER TABLE ${
          transformations.curatedEntityName
        } ADD COLUMN ${columnName.trim()} ${dataType};\n`;
      }
    });
    code += `\n`;
  }

  code += `-- Insert transformed data\n`;
  code += `INSERT INTO ${transformations.curatedEntityName}\n`;
  code += `SELECT\n`;

  // Add column mappings with transformations (excluding control columns)
  const fileMappings = mappings.filter((mapping) => !mapping.isControlColumn);
  fileMappings.forEach((mapping, idx) => {
    if (mapping.isNewColumn) {
      code += `    NULL as ${mapping.curated}`;
    } else {
      // Regular column mapping
      let columnExpr = mapping.raw;

      // Apply NLP transformations if any
      const nlpRules = columnRules[mapping.curated]?.nlp || [];
      nlpRules.forEach((rule) => {
        if (rule.enabled) {
          switch (rule.type) {
            case 'uppercase':
              columnExpr = `UPPER(${columnExpr})`;
              break;
            case 'lowercase':
              columnExpr = `LOWER(${columnExpr})`;
              break;
            case 'trim_whitespace':
              columnExpr = `TRIM(${columnExpr})`;
              break;
            case 'remove_special_chars':
              columnExpr = `REGEXP_REPLACE(${columnExpr}, '[^a-zA-Z0-9\\s]', '')`;
              break;
          }
        }
      });

      code += `    ${columnExpr} as ${mapping.curated}`;
    }

    if (idx < fileMappings.length - 1) code += ',';
    code += `\n`;
  });

  code += `FROM raw_${entityName.replace('raw.', '')};\n\n`;

  return code;
};

/**
 * Generate PySpark code for the entity
 */
const generatePySparkCode = (entityName, transformations) => {
  const { mappings, columnRules, operatorRules, concatenationRules } =
    transformations;

  let code = `# PySpark Code for Entity: ${entityName}\n`;
  code += `from pyspark.sql import SparkSession\n`;
  code += `from pyspark.sql.functions import *\n\n`;

  code += `# Initialize Spark session\n`;
  code += `spark = SparkSession.builder.appName("${entityName}_processing").getOrCreate()\n\n`;

  code += `# Read the raw data\n`;
  code += `df = spark.read.format("csv").option("header", "true").load("path/to/raw/data")\n\n`;

  code += `# Apply transformations\n`;

  // Add NLP transformations
  Object.keys(columnRules).forEach((column) => {
    const rules = columnRules[column];
    if (rules.nlp && rules.nlp.length > 0) {
      code += `# NLP transformations for column: ${column}\n`;
      rules.nlp.forEach((rule) => {
        if (rule.enabled) {
          switch (rule.type) {
            case 'uppercase':
              code += `df = df.withColumn("${column}", upper(col("${column}")))\n`;
              break;
            case 'lowercase':
              code += `df = df.withColumn("${column}", lower(col("${column}")))\n`;
              break;
            case 'title_case':
              code += `df = df.withColumn("${column}", initcap(col("${column}")))\n`;
              break;
            case 'remove_special_chars':
              code += `df = df.withColumn("${column}", regexp_replace(col("${column}"), "[^a-zA-Z0-9\\s]", ""))\n`;
              break;
            case 'trim_whitespace':
              code += `df = df.withColumn("${column}", trim(col("${column}")))\n`;
              break;
          }
        }
      });
      code += `\n`;
    }
  });

  // Add DQ validations
  Object.keys(columnRules).forEach((column) => {
    const rules = columnRules[column];
    if (rules.dq && rules.dq.length > 0) {
      code += `# Data Quality validations for column: ${column}\n`;
      rules.dq.forEach((rule) => {
        if (rule.enabled) {
          switch (rule.type) {
            case 'not_null':
              code += `df = df.filter(col("${column}").isNotNull())\n`;
              break;
            case 'unique':
              code += `df = df.dropDuplicates(["${column}"])\n`;
              break;
            case 'email_format':
              code += `df = df.filter(col("${column}").rlike("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"))\n`;
              break;
            case 'numeric_only':
              code += `df = df.filter(col("${column}").cast("double").isNotNull())\n`;
              break;
          }
        }
      });
      code += `\n`;
    }
  });

  // Add operator rules
  Object.keys(operatorRules).forEach((column) => {
    const rules = operatorRules[column];
    if (rules && rules.length > 0) {
      code += `# Operator rules for column: ${column}\n`;
      rules.forEach((rule) => {
        if (rule.enabled) {
          switch (rule.type) {
            case 'greater_than':
              code += `df = df.filter(col("${column}") > ${rule.value})\n`;
              break;
            case 'less_than':
              code += `df = df.filter(col("${column}") < ${rule.value})\n`;
              break;
            case 'equals':
              code += `df = df.filter(col("${column}") == "${rule.value}")\n`;
              break;
            case 'not_equals':
              code += `df = df.filter(col("${column}") != "${rule.value}")\n`;
              break;
            case 'greater_than_equal':
              code += `df = df.filter(col("${column}") >= ${rule.value})\n`;
              break;
            case 'less_than_equal':
              code += `df = df.filter(col("${column}") <= ${rule.value})\n`;
              break;
            case 'between':
              const [min, max] = rule?.value
                ?.split?.(',')
                ?.map((v) => v?.trim());
              code += `df = df.filter((col("${column}") >= ${min}) & (col("${column}") <= ${max}))\n`;
              break;
            case 'in_list':
              const values = rule?.value
                ?.split?.(',')
                ?.map((v) => `"${v?.trim()}"`)
                ?.join?.(', ');
              code += `df = df.filter(col("${column}").isin(${values}))\n`;
              break;
          }
        }
      });
      code += `\n`;
    }
  });

  // Add concatenation rules
  if (concatenationRules.length > 0) {
    code += `# Column concatenations\n`;
    concatenationRules.forEach((rule) => {
      const concatExpr = rule.sourceColumns
        .map((col) => `col("${col}")`)
        .join?.(` + lit("${rule.separator}") + `);
      code += `df = df.withColumn("${rule.targetColumn}", ${concatExpr})\n`;
    });
    code += `\n`;
  }

  // Add new columns (excluding control columns)
  // First check if newColumns are explicitly provided in transformations
  let newColumns = [];
  if (transformations.newColumns && transformations.newColumns.length > 0) {
    newColumns = transformations.newColumns.filter(
      (columnName) =>
        columnName && typeof columnName === 'string' && columnName.trim()
    );
  } else {
    // Fallback to mapping-based detection
    newColumns = mappings
      .filter(
        (mapping) =>
          mapping.isNewColumn &&
          mapping.curated.trim() &&
          !mapping.isControlColumn
      )
      .map((mapping) => mapping.curated.trim());
  }

  if (newColumns.length > 0) {
    code += `# New columns\n`;
    newColumns.forEach((column) => {
      code += `df = df.withColumn("${column}", lit(null).cast("string"))\n`;
    });
    code += `\n`;
  }

  code += `# Write the processed data\n`;
  code += `df.write.mode("overwrite").parquet("path/to/curated/data")\n`;
  code += `\nspark.stop()\n`;

  return code;
};

/**
 * Generate Dockerfile for the data pipeline
 */
const generateDockerfile = (entityName) => {
  return `# Dockerfile for ${entityName} Data Pipeline
FROM apache/airflow:2.7.1-python3.9

# Install additional dependencies
USER root
RUN apt-get update && apt-get install -y \\
    openjdk-11-jdk \\
    && rm -rf /var/lib/apt/lists/*

# Set JAVA_HOME
ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
ENV PATH=$PATH:$JAVA_HOME/bin

# Install Python packages
COPY requirements.txt /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Copy pipeline code
COPY pipelines/ /opt/airflow/pipelines/
COPY dags/ /opt/airflow/dags/

# Set working directory
WORKDIR /opt/airflow

# Switch back to airflow user
USER airflow

# Expose port
EXPOSE 8080

# Start Airflow
CMD ["webserver"]`;
};

/**
 * Generate CI/CD pipeline configuration
 */
const generateCICDPipeline = (entityName) => {
  return `# CI/CD Pipeline for ${entityName}
name: ${entityName}-data-pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        pip install pytest pytest-cov
    
    - name: Run tests
      run: |
        pytest tests/ --cov=pipelines/ --cov-report=xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to production
      run: |
        echo "Deploying ${entityName} pipeline to production"
        # Add deployment steps here`;
};

/**
 * Generate Airflow DAG
 */
const generateAirflowDAG = (entityName, transformations) => {
  return `# Airflow DAG for ${entityName} data pipeline
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python_operator import PythonOperator
from airflow.operators.bash_operator import BashOperator

default_args = {
    'owner': 'data-engineering',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    '${entityName}_data_pipeline',
    default_args=default_args,
    description='Data pipeline for ${entityName}',
    schedule_interval='0 2 * * *',  # Daily at 2 AM
    catchup=False,
    tags=['data-pipeline', '${entityName}'],
)

# Task 1: Extract data from source
extract_task = PythonOperator(
    task_id='extract_${entityName}_data',
    python_callable=extract_data,
    op_kwargs={'entity_name': '${entityName}'},
    dag=dag,
)

# Task 2: Transform data using PySpark
transform_task = BashOperator(
    task_id='transform_${entityName}_data',
    bash_command='spark-submit /opt/airflow/pipelines/${entityName}_transform.py',
    dag=dag,
)

# Task 3: Load data to curated layer
load_task = PythonOperator(
    task_id='load_${entityName}_data',
    python_callable=load_data,
    op_kwargs={'entity_name': '${transformations.curatedEntityName}'},
    dag=dag,
)

# Task 4: Run data quality checks
quality_check_task = PythonOperator(
    task_id='quality_check_${entityName}',
    python_callable=run_quality_checks,
    op_kwargs={'entity_name': '${transformations.curatedEntityName}'},
    dag=dag,
)

# Define task dependencies
extract_task >> transform_task >> load_task >> quality_check_task

def extract_data(entity_name):
    """Extract data from source system"""
    print(f"Extracting data for {entity_name}")
    pass

def load_data(entity_name):
    """Load data to curated layer"""
    print(f"Loading data for {entity_name}")
    pass

def run_quality_checks(entity_name):
    """Run data quality checks"""
    print(f"Running quality checks for {entity_name}")
    pass`;
};

/**
 * Generate data quality tests
 */
const generateDataQualityTests = (entityName, transformations) => {
  const { columnRules } = transformations;

  let tests = `# Data Quality Tests for ${entityName}
import pytest
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, count, isnan, isnull

class Test${
    entityName.charAt(0).toUpperCase() + entityName.slice(1)
  }DataQuality:
    
    @pytest.fixture(scope="class")
    def spark(self):
        return SparkSession.builder \\
            .appName("${entityName}_quality_tests") \\
            .master("local[*]") \\
            .getOrCreate()
    
    @pytest.fixture(scope="class")
    def df(self, spark):
        return spark.read.format("parquet").load("path/to/${entityName}_data")
    
    def test_no_null_values_in_required_columns(self, df):
        """Test that required columns have no null values"""
        required_columns = [`;

  // Add null checks for columns with DQ rules
  Object.keys(columnRules).forEach((column) => {
    const rules = columnRules[column];
    if (
      rules.dq &&
      rules.dq.some((rule) => rule.type === 'not_null' && rule.enabled)
    ) {
      tests += `\n            "${column}",`;
    }
  });

  tests += `
        ]
        
        for column in required_columns:
            null_count = df.filter(col(column).isNull()).count()
            assert null_count == 0, f"Column {column} has {null_count} null values"
    
    def test_data_types_are_correct(self, df):
        """Test that columns have correct data types"""
        pass
    
    def test_value_ranges_are_valid(self, df):
        """Test that numeric values are within expected ranges"""
        pass`;

  return tests;
};

/**
 * Generate documentation
 */
const generateDocumentation = (entityName, transformations) => {
  const {
    columnDescriptions = {},
    mappings = [],
    columnRules = {},
  } = transformations;

  return `# ${entityName} Data Pipeline Documentation

## Overview
This document describes the data pipeline for the ${entityName} entity, including transformations, data quality rules, and deployment information.

## Entity Information
- **Raw Entity**: ${entityName}
- **Curated Entity**: ${transformations.curatedEntityName || 'N/A'}
- **Generated**: ${new Date().toISOString()}

## Column Mappings
${mappings
  .map((mapping) => {
    if (mapping.isControlColumn) {
      return `- **${mapping.curated}**: Entity-level metadata (system-generated)`;
    } else if (mapping.isNewColumn) {
      return `- **${mapping.curated}**: New column (no source mapping)`;
    } else {
      return `- **${mapping.raw}** → **${mapping.curated}**: Direct mapping`;
    }
  })
  .join('\n')}

## Column Descriptions
${Object.entries(columnDescriptions)
  .map(
    ([column, description]) =>
      `### ${column}
${description}`
  )
  .join('\n\n')}

## Data Quality Rules
${Object.keys(columnRules)
  .map((column) => {
    const rules = columnRules[column];
    const nlpRules = rules?.nlp?.filter((r) => r.enabled) || [];
    const dqRules = rules?.dq?.filter((r) => r.enabled) || [];

    if (nlpRules.length === 0 && dqRules.length === 0) return '';

    return `### ${column}
${nlpRules.map((rule) => `- **NLP**: ${rule.type}`).join('\n')}
${dqRules.map((rule) => `- **DQ**: ${rule.type}`).join('\n')}`;
  })
  .filter(Boolean)
  .join('\n\n')}

## Deployment
The pipeline is deployed using:
- **Orchestration**: Apache Airflow
- **Processing**: Apache Spark
- **Storage**: AWS S3
- **Infrastructure**: Terraform

## Monitoring
- Data quality metrics are collected and monitored
- Pipeline execution logs are available in Airflow
- Error handling and alerting are configured`;
};

/**
 * Generate configuration files
 */
const generateConfigFiles = (entityName, transformations) => {
  return {
    'config.yaml': `# Configuration for ${entityName} pipeline
entity:
  name: ${entityName}
  curated_name: ${transformations.curatedEntityName}
  description: "Data pipeline for ${entityName} entity"

processing:
  engine: spark
  version: "3.3.0"
  executor_memory: "4g"
  driver_memory: "2g"
  executor_cores: 2

storage:
  raw_bucket: "raw-data-bucket"
  curated_bucket: "curated-data-bucket"
  consumption_bucket: "consumption-data-bucket"

quality:
  enabled: true
  rules_file: "quality_rules.yaml"
  alert_on_failure: true

monitoring:
  metrics_enabled: true
  log_level: "INFO"
  alert_email: "data-team@company.com"`,

    'requirements.txt': `# Python dependencies for ${entityName} pipeline
pyspark==3.3.0
pandas==1.5.3
numpy==1.24.3
boto3==1.26.137
great-expectations==0.17.19
pytest==7.3.1
pytest-cov==4.1.0`,
  };
};

/**
 * Check if a column is a control column
 */
const isControlColumn = (columnName) => {
  const controlColumns = [
    '_ingest_timestamp',
    '_source_system',
    '_record_status',
    '_update_timestamp',
    '_batch_id',
    '_created_by',
    '_updated_by',
  ];
  return controlColumns.includes(columnName);
};

/**
 * Push artifacts to GitHub repository
 */
const pushArtifactsToGitHub = async (artifacts, githubConfig, folderPath) => {
  try {
    console.log('Pushing artifacts to GitHub:', githubConfig.repositoryUrl);

    const result = await GitHubService.pushArtifactsToRepository(
      artifacts,
      githubConfig,
      folderPath
    );

    return {
      success: true,
      message: result.message,
      repository: result.repository,
      branch: result.branch,
      commit_sha: result.commit_sha,
      files_pushed: result.files_pushed,
      commit_url: result.commit_url,
    };
  } catch (error) {
    throw new Error(`Failed to push to GitHub: ${error.message}`);
  }
};

/**
 * Generate DML SQL code for data manipulation operations
 */
const generateDMLSQL = (entityName, transformations) => {
  const { rawAttributes, curatedAttributes, mappings, newColumns } =
    transformations;

  let code = `-- DML Operations for ${entityName}\n`;
  code += `-- Generated on: ${new Date().toISOString()}\n\n`;

  // Add ALTER TABLE commands for new columns if they exist
  if (newColumns && newColumns.length > 0) {
    code += `-- Add new columns to existing table\n`;
    newColumns.forEach((columnName) => {
      if (columnName && typeof columnName === 'string' && columnName.trim()) {
        let dataType = 'VARCHAR(255)'; // Default type

        // Determine data type based on column name
        if (columnName.includes('timestamp') || columnName.includes('date')) {
          dataType = 'TIMESTAMP';
        } else if (columnName.includes('id') || columnName.includes('_id')) {
          dataType = 'BIGINT';
        } else if (
          columnName.includes('amount') ||
          columnName.includes('price') ||
          columnName.includes('cost')
        ) {
          dataType = 'DECIMAL(10,2)';
        } else if (
          columnName.includes('quantity') ||
          columnName.includes('count')
        ) {
          dataType = 'INTEGER';
        } else if (columnName === 'is_deleted' || columnName.includes('is_')) {
          dataType = 'BOOLEAN';
        }

        code += `ALTER TABLE curated.${entityName} ADD COLUMN IF NOT EXISTS ${columnName.trim()} ${dataType};\n`;
      }
    });
    code += `\n`;
  }

  // INSERT statement
  code += `-- Insert new records into curated table\n`;
  code += `INSERT INTO curated.${entityName} (\n`;
  code += `  ${curatedAttributes.join(',\n  ')}\n`;
  code += `)\n`;
  code += `SELECT \n`;

  // Map raw attributes to curated attributes
  const selectColumns = mappings
    .map((mapping) => {
      if (mapping.raw && mapping.curated) {
        return `  ${mapping.raw} as ${mapping.curated}`;
      } else if (mapping.isControlColumn) {
        return `  ${mapping.curated}`;
      } else {
        return `  NULL as ${mapping.curated}`;
      }
    })
    .filter((col) => col);

  code += selectColumns.join(',\n');
  code += `\nFROM raw.${entityName};\n\n`;

  // UPDATE statement
  code += `-- Update existing records\n`;
  code += `UPDATE curated.${entityName} \n`;
  code += `SET \n`;
  code += `  updated_at = CURRENT_TIMESTAMP,\n`;
  code += `  version = version + 1\n`;
  code += `WHERE id IN (\n`;
  code += `  SELECT id FROM raw.${entityName}\n`;
  code += `);\n\n`;

  // DELETE statement (soft delete)
  code += `-- Soft delete records\n`;
  code += `UPDATE curated.${entityName} \n`;
  code += `SET \n`;
  code += `  is_deleted = true,\n`;
  code += `  updated_at = CURRENT_TIMESTAMP\n`;
  code += `WHERE id NOT IN (\n`;
  code += `  SELECT id FROM raw.${entityName}\n`;
  code += `);\n`;

  return code;
};

/**
 * Generate DML PySpark code for data manipulation operations
 */
const generateDMLPySpark = (entityName, transformations) => {
  const { rawAttributes, curatedAttributes, mappings, newColumns } =
    transformations;

  let code = `# DML Operations for ${entityName}\n`;
  code += `# Generated on: ${new Date().toISOString()}\n\n`;

  code += `from pyspark.sql import SparkSession\n`;
  code += `from pyspark.sql.functions import *\n`;
  code += `from pyspark.sql.types import *\n\n`;

  code += `# Initialize Spark session\n`;
  code += `spark = SparkSession.builder \\\n`;
  code += `    .appName("${entityName}_DML_Operations") \\\n`;
  code += `    .config("spark.sql.adaptive.enabled", "true") \\\n`;
  code += `    .getOrCreate()\n\n`;

  // Add new columns handling if they exist
  if (newColumns && newColumns.length > 0) {
    code += `# Handle new columns for existing curated table\n`;
    code += `# Note: In PySpark, you may need to recreate the table or use Delta Lake for schema evolution\n`;
    code += `# For now, we'll add new columns during data processing\n\n`;
  }

  // Read raw data
  code += `# Read raw data\n`;
  code += `raw_df = spark.read.parquet("path/to/raw/${entityName}")\n\n`;

  // Read existing curated data
  code += `# Read existing curated data\n`;
  code += `curated_df = spark.read.parquet("path/to/curated/${entityName}")\n\n`;

  // Insert new records
  code += `# Insert new records\n`;
  code += `new_records = raw_df.join(curated_df, "id", "left_anti")\n`;
  code += `if new_records.count() > 0:\n`;
  code += `    # Transform new records according to mappings\n`;
  code += `    transformed_new = new_records.select(\n`;

  const selectExpressions = mappings
    .map((mapping) => {
      if (mapping.raw && mapping.curated) {
        return `        col("${mapping.raw}").alias("${mapping.curated}")`;
      } else if (mapping.isControlColumn) {
        return `        lit(None).cast("string").alias("${mapping.curated}")`;
      } else {
        return `        lit(None).cast("string").alias("${mapping.curated}")`;
      }
    })
    .filter((expr) => expr);

  code += selectExpressions.join(',\n');
  code += `\n    )\n`;
  code += `    \n`;

  // Add new columns to the transformed data if they exist
  if (newColumns && newColumns.length > 0) {
    code += `    # Add new columns with default values\n`;
    newColumns.forEach((columnName) => {
      if (columnName && typeof columnName === 'string' && columnName.trim()) {
        code += `    transformed_new = transformed_new.withColumn("${columnName.trim()}", lit(None).cast("string"))\n`;
      }
    });
    code += `    \n`;
  }

  code += `    # Add control columns\n`;
  code += `    transformed_new = transformed_new.withColumn("created_at", current_timestamp()) \\\n`;
  code += `        .withColumn("updated_at", current_timestamp()) \\\n`;
  code += `        .withColumn("version", lit(1)) \\\n`;
  code += `        .withColumn("is_deleted", lit(False))\n`;
  code += `    \n`;
  code += `    # Append to curated table\n`;
  code += `    transformed_new.write.mode("append").parquet("path/to/curated/${entityName}")\n\n`;

  // Update existing records
  code += `# Update existing records\n`;
  code += `existing_records = raw_df.join(curated_df, "id", "inner")\n`;
  code += `if existing_records.count() > 0:\n`;
  code += `    # Update logic here\n`;
  code += `    updated_records = existing_records.withColumn("updated_at", current_timestamp()) \\\n`;
  code += `        .withColumn("version", col("version") + 1)\n`;

  // Add new columns to existing records if they exist
  if (newColumns && newColumns.length > 0) {
    code += `    \n    # Add new columns to existing records\n`;
    newColumns.forEach((columnName) => {
      if (columnName && typeof columnName === 'string' && columnName.trim()) {
        code += `    updated_records = updated_records.withColumn("${columnName.trim()}", lit(None).cast("string"))\n`;
      }
    });
  }

  code += `    \n    # Write updated records (overwrite mode for simplicity)\n`;
  code += `    updated_records.write.mode("overwrite").parquet("path/to/curated/${entityName}_updated")\n\n`;

  // Soft delete
  code += `# Soft delete records that no longer exist in raw\n`;
  code += `deleted_records = curated_df.join(raw_df, "id", "left_anti")\n`;
  code += `if deleted_records.count() > 0:\n`;
  code += `    deleted_records = deleted_records.withColumn("is_deleted", lit(True)) \\\n`;
  code += `        .withColumn("updated_at", current_timestamp())\n`;
  code += `    \n`;
  code += `    # Write deleted records\n`;
  code += `    deleted_records.write.mode("append").parquet("path/to/curated/${entityName}_deleted")\n\n`;

  code += `spark.stop()\n`;

  return code;
};

module.exports = {
  generateAllArtifacts,
  generateArtifactsDiff,
  generateAllDiffs,
};
