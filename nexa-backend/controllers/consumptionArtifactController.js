const GitHubService = require('../services/githubService');

/**
 * Push consumption artifacts to GitHub repository
 */
const pushConsumptionArtifactsToGitHub = async (artifacts, githubConfig, folderPath) => {
  try {
    console.log('Pushing consumption artifacts to GitHub:', githubConfig.repositoryUrl);

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
 * Generate artifacts for consumption entities
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const generateConsumptionArtifacts = async (req, res) => {
  try {
    const {
      entityName,
      consumptionEntityName,
      transformations,
      pushToGitHub = false,
      githubConfig = null,
      folderPath = 'consumption',
    } = req.body;

    console.log('Generating consumption artifacts for entity:', entityName);

    if (!entityName || !transformations) {
      return res.status(400).json({
        success: false,
        message: 'Entity name and transformations are required',
      });
    }

    // Generate SQL code for consumption entity
    const sqlCode = generateConsumptionSQLCode(entityName, transformations);
    
    // Generate PySpark code for consumption entity
    const pysparkCode = generateConsumptionPySparkCode(entityName, transformations);
    
    // Generate DML SQL for consumption entity
    const dmlSql = generateConsumptionDMLSQL(entityName, transformations);
    
    // Generate DML PySpark for consumption entity
    const dmlPySpark = generateConsumptionDMLPySpark(entityName, transformations);

    const artifacts = {
      sql: sqlCode,
      pyspark: pysparkCode,
      dmlSql: dmlSql,
      dmlPySpark: dmlPySpark,
    };

    // Push to GitHub if requested
    if (pushToGitHub && githubConfig) {
      try {
        const pushResult = await pushConsumptionArtifactsToGitHub(
          artifacts,
          githubConfig,
          folderPath
        );
        artifacts.githubPush = pushResult;
      } catch (githubError) {
        console.error('Failed to push consumption artifacts to GitHub:', githubError);
        artifacts.githubPush = {
          success: false,
          error: githubError.message,
        };
      }
    }

    res.json({
      success: true,
      message: 'Consumption artifacts generated successfully',
      data: {
        artifacts,
        entityName,
        consumptionEntityName,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error generating consumption artifacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate consumption artifacts',
      error: error.message,
    });
  }
};

/**
 * Generate diffs for consumption entities
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const generateConsumptionDiffs = async (req, res) => {
  try {
    const {
      entity,
      githubConfig,
      folderPath = 'consumption',
      pushToGitHub = false,
    } = req.body;

    console.log('Generating consumption diffs for entity:', entity?.entityName);

    if (!entity || !githubConfig) {
      return res.status(400).json({
        success: false,
        message: 'Entity data and GitHub configuration are required',
      });
    }

    // Generate artifacts for diff comparison
    const sqlCode = generateConsumptionSQLCode(entity.entityName, entity.transformations);
    const pysparkCode = generateConsumptionPySparkCode(entity.entityName, entity.transformations);
    const dmlSql = generateConsumptionDMLSQL(entity.entityName, entity.transformations);
    const dmlPySpark = generateConsumptionDMLPySpark(entity.entityName, entity.transformations);

    // Simulate diff generation (in real implementation, this would compare with existing files)
    const diffs = {
      [entity.entityName]: {
        diff: {
          summary: {
            new: 1,
            modified: 0,
            unchanged: 0,
            deleted: 0,
          },
          diff: `diff --git a/${folderPath}/${entity.entityName}.sql b/${folderPath}/${entity.entityName}.sql
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/${folderPath}/${entity.entityName}.sql
@@ -0,0 +1,50 @@
+-- Consumption Entity: ${entity.entityName}
+-- Generated SQL for consumption layer
+${sqlCode.split('\n').map(line => `+${line}`).join('\n')}
`,
        },
        artifacts: {
          sql: sqlCode,
          pyspark: pysparkCode,
          dmlSql: dmlSql,
          dmlPySpark: dmlPySpark,
        },
      },
    };

    // Push to GitHub if requested
    if (pushToGitHub && githubConfig) {
      try {
        const pushResult = await pushConsumptionArtifactsToGitHub(
          {
            [entity.entityName]: {
              sql: sqlCode,
              pyspark: pysparkCode,
              dmlSql: dmlSql,
              dmlPySpark: dmlPySpark,
            }
          },
          githubConfig,
          folderPath
        );
        
        // Add GitHub push info to each entity's diff data
        Object.keys(diffs).forEach(entityName => {
          diffs[entityName].githubPush = pushResult;
        });
      } catch (githubError) {
        console.error('Failed to push consumption diffs to GitHub:', githubError);
        Object.keys(diffs).forEach(entityName => {
          diffs[entityName].githubPush = {
            success: false,
            error: githubError.message,
          };
        });
      }
    }

    res.json({
      success: true,
      message: 'Consumption diffs generated successfully',
      data: {
        diffs,
        folderPath,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error generating consumption diffs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate consumption diffs',
      error: error.message,
    });
  }
};

/**
 * Get stored consumption artifacts for an entity
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getStoredConsumptionArtifacts = async (req, res) => {
  try {
    const { entityName } = req.query;

    console.log('Getting stored consumption artifacts for entity:', entityName);

    if (!entityName) {
      return res.status(400).json({
        success: false,
        message: 'Entity name is required',
      });
    }

    // For now, return mock data - in real implementation, this would fetch from database
    const mockArtifacts = [
      {
        id: 1,
        name: `${entityName}_DDL`,
        sql: `-- DDL for ${entityName}\nCREATE TABLE ${entityName} (\n  id INT PRIMARY KEY,\n  name VARCHAR(255)\n);`,
        pyspark: `# PySpark DDL for ${entityName}\nspark.sql("CREATE TABLE ${entityName} (id INT, name STRING)")`,
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        name: `${entityName}_DML`,
        sql: `-- DML for ${entityName}\nINSERT INTO ${entityName} VALUES (1, 'Sample Data');`,
        pyspark: `# PySpark DML for ${entityName}\ndf.write.mode("append").saveAsTable("${entityName}")`,
        createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      },
    ];

    res.json({
      success: true,
      message: 'Stored consumption artifacts retrieved successfully',
      data: mockArtifacts,
    });
  } catch (error) {
    console.error('Error getting stored consumption artifacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stored consumption artifacts',
      error: error.message,
    });
  }
};

// Helper functions for generating consumption-specific code

const generateConsumptionSQLCode = (entityName, transformations) => {
  const attributes = transformations.attributes || [];
  const mappings = transformations.mappings || [];
  const sourceEntities = transformations.sourceEntities || [];
  
  let sql = `-- Consumption Entity: ${entityName}\n`;
  sql += `-- Generated SQL for consumption layer with M:1 mappings\n\n`;
  
  // Create table statement
  sql += `CREATE TABLE IF NOT EXISTS ${entityName} (\n`;
  
  if (attributes.length > 0) {
    sql += attributes.map(attr => {
      const dataType = transformations.dataTypes?.[attr.name] || 'VARCHAR(255)';
      return `  ${attr.name} ${dataType}`;
    }).join(',\n');
  } else {
    sql += `  id INT PRIMARY KEY,\n`;
    sql += `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n`;
    sql += `  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`;
  }
  
  sql += `\n);\n\n`;
  
  // Add indexes for better performance
  if (attributes.length > 0) {
    sql += `-- Performance indexes\n`;
    sql += `CREATE INDEX IF NOT EXISTS idx_${entityName}_created_at ON ${entityName}(created_at);\n`;
    if (attributes.some(attr => attr.name.toLowerCase().includes('id'))) {
      const idField = attributes.find(attr => attr.name.toLowerCase().includes('id'))?.name || 'id';
      sql += `CREATE INDEX IF NOT EXISTS idx_${entityName}_${idField} ON ${entityName}(${idField});\n`;
    }
  }
  
  // Generate view for complex M:1 mappings
  if (sourceEntities.length > 1 || mappings.some(m => m.transformation !== 'direct_mapping')) {
    sql += `-- Create view for complex M:1 mappings\n`;
    sql += `CREATE OR REPLACE VIEW ${entityName}_view AS\n`;
    sql += generateComplexMappingView(entityName, transformations);
    sql += `;\n\n`;
  }
  
  return sql;
};

// Generate complex mapping view for M:1 relationships
const generateComplexMappingView = (entityName, transformations) => {
  const sourceEntities = transformations.sourceEntities || [];
  const mappings = transformations.mappings || [];
  
  let viewSql = `SELECT\n`;
  
  // Generate column selections with transformations
  const columnSelections = mappings.map(mapping => {
    if (mapping.transformation === 'direct_mapping') {
      return `  ${mapping.sourceEntity}.${mapping.source} AS ${mapping.target}`;
    } else if (mapping.transformation === 'concatenation') {
      const sources = mapping.sourceFields || [mapping.source];
      const concatExpr = sources.map(field => 
        `COALESCE(${mapping.sourceEntity}.${field}, '')`
      ).join(" || ' ' || ");
      return `  ${concatExpr} AS ${mapping.target}`;
    } else if (mapping.transformation === 'aggregation') {
      const aggFunc = mapping.aggregationFunction || 'MAX';
      return `  ${aggFunc}(${mapping.sourceEntity}.${mapping.source}) AS ${mapping.target}`;
    } else if (mapping.transformation === 'case_statement') {
      return `  CASE ${mapping.sourceEntity}.${mapping.source}\n` +
             mapping.caseConditions?.map(cond => 
               `    WHEN '${cond.when}' THEN '${cond.then}'`
             ).join('\n') + '\n' +
             `    ELSE '${mapping.defaultValue || 'Unknown'}' END AS ${mapping.target}`;
    } else if (mapping.transformation === 'calculation') {
      return `  (${mapping.calculationExpression || mapping.source}) AS ${mapping.target}`;
    } else {
      return `  ${mapping.sourceEntity}.${mapping.source} AS ${mapping.target}`;
    }
  });
  
  viewSql += columnSelections.join(',\n');
  viewSql += `,\n`;
  viewSql += `  CURRENT_TIMESTAMP AS created_at,\n`;
  viewSql += `  CURRENT_TIMESTAMP AS updated_at\n`;
  
  // Generate FROM clause with JOINs
  viewSql += `FROM ${sourceEntities[0]} AS ${sourceEntities[0]}`;
  
  // Add JOINs for additional source entities
  for (let i = 1; i < sourceEntities.length; i++) {
    const entity = sourceEntities[i];
    const joinCondition = mappings.find(m => 
      m.sourceEntity === entity && m.joinCondition
    )?.joinCondition || `id = id`; // Default join condition
    
    viewSql += `\n  LEFT JOIN ${entity} AS ${entity} ON ${joinCondition}`;
  }
  
  // Add WHERE clause for filtering if specified
  if (transformations.filterConditions && transformations.filterConditions.length > 0) {
    viewSql += `\nWHERE `;
    viewSql += transformations.filterConditions.map(condition => 
      `${condition.sourceEntity}.${condition.field} ${condition.operator} '${condition.value}'`
    ).join(' AND ');
  }
  
  // Add GROUP BY for aggregations
  const aggregationMappings = mappings.filter(m => m.transformation === 'aggregation');
  if (aggregationMappings.length > 0) {
    const groupByFields = mappings
      .filter(m => m.transformation !== 'aggregation')
      .map(m => `${m.sourceEntity}.${m.source}`)
      .filter((field, index, arr) => arr.indexOf(field) === index); // Remove duplicates
    
    if (groupByFields.length > 0) {
      viewSql += `\nGROUP BY `;
      viewSql += groupByFields.join(', ');
    }
  }
  
  // Add ORDER BY
  const orderByField = mappings.find(m => m.isPrimaryKey)?.source || 'id';
  const orderByEntity = mappings.find(m => m.isPrimaryKey)?.sourceEntity || sourceEntities[0];
  viewSql += `\nORDER BY ${orderByEntity}.${orderByField}`;
  
  return viewSql;
};

const generateConsumptionPySparkCode = (entityName, transformations) => {
  const attributes = transformations.attributes || [];
  const mappings = transformations.mappings || [];
  const sourceEntities = transformations.sourceEntities || [];
  
  let pyspark = `# Consumption Entity: ${entityName}\n`;
  pyspark += `# Generated PySpark code for consumption layer with M:1 mappings\n\n`;
  
  // Import statements
  pyspark += `from pyspark.sql import SparkSession\n`;
  pyspark += `from pyspark.sql.functions import *\n`;
  pyspark += `from pyspark.sql.types import *\n\n`;
  
  // Schema definition
  if (attributes.length > 0) {
    pyspark += `# Define schema for ${entityName}\n`;
    pyspark += `schema = StructType([\n`;
    
    pyspark += attributes.map(attr => {
      const dataType = transformations.dataTypes?.[attr.name] || 'StringType()';
      let sparkType = 'StringType()';
      
      if (dataType.toLowerCase().includes('int')) sparkType = 'IntegerType()';
      else if (dataType.toLowerCase().includes('float') || dataType.toLowerCase().includes('double')) sparkType = 'DoubleType()';
      else if (dataType.toLowerCase().includes('date') || dataType.toLowerCase().includes('timestamp')) sparkType = 'TimestampType()';
      else if (dataType.toLowerCase().includes('bool')) sparkType = 'BooleanType()';
      
      return `    StructField("${attr.name}", ${sparkType}, True)`;
    }).join(',\n');
    
    pyspark += `\n]);\n\n`;
  }
  
  // Data processing logic for M:1 mappings
  pyspark += `# Process consumption data for ${entityName} with M:1 mappings\n`;
  pyspark += `def process_${entityName.toLowerCase()}_data(*input_dfs):\n`;
  pyspark += `    """Process input data for ${entityName} consumption entity with M:1 mappings"""\n`;
  pyspark += `    \n`;
  
  if (sourceEntities.length > 1) {
    pyspark += `    # Multiple source entities detected - applying JOIN logic\n`;
    pyspark += `    if len(input_dfs) != ${sourceEntities.length}:\n`;
    pyspark += `        raise ValueError(f"Expected {sourceEntities.length} input DataFrames, got {{len(input_dfs)}}")\n\n`;
    
    pyspark += `    # Unpack input DataFrames\n`;
    sourceEntities.forEach((entity, index) => {
      pyspark += `    ${entity}_df = input_dfs[${index}]\n`;
    });
    pyspark += `    \n`;
    
    // Generate JOIN logic
    pyspark += `    # Apply JOINs for M:1 mappings\n`;
    pyspark += `    joined_df = ${sourceEntities[0]}_df\n`;
    
    for (let i = 1; i < sourceEntities.length; i++) {
      const entity = sourceEntities[i];
      const joinCondition = mappings.find(m => 
        m.sourceEntity === entity && m.joinCondition
      )?.joinCondition || 'id = id';
      
      pyspark += `    \n`;
      pyspark += `    # Join with ${entity}\n`;
      pyspark += `    joined_df = joined_df.join(${entity}_df, on="${joinCondition}", how="left")\n`;
    }
    pyspark += `    \n`;
    
    pyspark += `    # Apply column transformations\n`;
    pyspark += `    processed_df = apply_transformations(joined_df)\n`;
  } else {
    pyspark += `    # Single source entity - direct processing\n`;
    pyspark += `    input_df = input_dfs[0]\n`;
    pyspark += `    processed_df = apply_transformations(input_df)\n`;
  }
  
  pyspark += `    \n`;
  pyspark += `    # Add metadata columns\n`;
  pyspark += `    processed_df = processed_df.withColumn("processed_at", current_timestamp())\n`;
  pyspark += `    processed_df = processed_df.withColumn("source_system", lit("consumption_layer"))\n`;
  pyspark += `    \n`;
  pyspark += `    return processed_df\n\n`;
  
  // Add transformation function
  pyspark += `def apply_transformations(df):\n`;
  pyspark += `    """Apply column transformations based on mapping rules"""\n`;
  pyspark += `    \n`;
  
  if (mappings.length > 0) {
    mappings.forEach((mapping, index) => {
      pyspark += `    # Transformation ${index + 1}: ${mapping.transformation}\n`;
      
      if (mapping.transformation === 'direct_mapping') {
        pyspark += `    df = df.withColumn("${mapping.target}", col("${mapping.source}"))\n`;
      } else if (mapping.transformation === 'concatenation') {
        const sources = mapping.sourceFields || [mapping.source];
        const concatExpr = sources.map(field => `coalesce(col("${field}"), lit(""))`).join(' + lit(" ") + ');
        pyspark += `    df = df.withColumn("${mapping.target}", ${concatExpr})\n`;
      } else if (mapping.transformation === 'aggregation') {
        const aggFunc = mapping.aggregationFunction || 'max';
        pyspark += `    df = df.withColumn("${mapping.target}", ${aggFunc}(col("${mapping.source}")))\n`;
      } else if (mapping.transformation === 'case_statement') {
        pyspark += `    df = df.withColumn("${mapping.target}", \n`;
        pyspark += `        when(col("${mapping.source}") == "${mapping.caseConditions?.[0]?.when || 'default'}", "${mapping.caseConditions?.[0]?.then || 'default'}")\n`;
        mapping.caseConditions?.slice(1).forEach(cond => {
          pyspark += `        .when(col("${mapping.source}") == "${cond.when}", "${cond.then}")\n`;
        });
        pyspark += `        .otherwise("${mapping.defaultValue || 'Unknown'}"))\n`;
      } else if (mapping.transformation === 'calculation') {
        pyspark += `    df = df.withColumn("${mapping.target}", expr("${mapping.calculationExpression || mapping.source}"))\n`;
      }
      pyspark += `    \n`;
    });
  } else {
    pyspark += `    # No specific transformations defined\n`;
    pyspark += `    pass\n`;
  }
  
  pyspark += `    return df\n\n`;
  
  pyspark += `# Example usage\n`;
  pyspark += `# spark = SparkSession.builder.appName("${entityName}Consumption").getOrCreate()\n`;
  if (sourceEntities.length > 1) {
    pyspark += `# result_df = process_${entityName.toLowerCase()}_data(${sourceEntities.join('_df, ')}_df)\n`;
  } else {
    pyspark += `# result_df = process_${entityName.toLowerCase()}_data(input_dataframe)\n`;
  }
  pyspark += `# result_df.write.mode("overwrite").saveAsTable("${entityName}")\n`;
  
  return pyspark;
};

const generateConsumptionDMLSQL = (entityName, transformations) => {
  const sourceEntities = transformations.sourceEntities || [];
  const mappings = transformations.mappings || [];
  
  let dml = `-- DML Operations for Consumption Entity: ${entityName}\n`;
  dml += `-- Data Manipulation Language for consumption layer with M:1 mappings\n\n`;
  
  // Insert sample data
  dml += `-- Insert sample consumption data\n`;
  dml += `INSERT INTO ${entityName} (name, created_at) VALUES \n`;
  dml += `  ('Sample Consumption Data 1', CURRENT_TIMESTAMP),\n`;
  dml += `  ('Sample Consumption Data 2', CURRENT_TIMESTAMP),\n`;
  dml += `  ('Sample Consumption Data 3', CURRENT_TIMESTAMP);\n\n`;
  
  // Update operations
  dml += `-- Update operations\n`;
  dml += `UPDATE ${entityName} SET updated_at = CURRENT_TIMESTAMP WHERE name LIKE '%Sample%';\n\n`;
  
  // Delete operations
  dml += `-- Delete operations (be careful with production data)\n`;
  dml += `-- DELETE FROM ${entityName} WHERE created_at < DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY);\n\n`;
  
  // Select operations with M:1 mappings
  dml += `-- Query operations with M:1 mappings\n`;
  if (sourceEntities.length > 1) {
    dml += `-- Using the generated view for complex mappings\n`;
    dml += `SELECT * FROM ${entityName}_view ORDER BY created_at DESC LIMIT 10;\n\n`;
    
    dml += `-- Direct table query (if view not available)\n`;
    dml += `SELECT * FROM ${entityName} ORDER BY created_at DESC LIMIT 10;\n\n`;
    
    // Generate sample JOIN queries
    dml += `-- Sample JOIN queries for M:1 relationships\n`;
    dml += `SELECT \n`;
    dml += `  ${entityName}.*,\n`;
    sourceEntities.forEach((entity, index) => {
      if (index < sourceEntities.length - 1) {
        dml += `  ${entity}.name AS ${entity}_name,\n`;
      } else {
        dml += `  ${entity}.name AS ${entity}_name\n`;
      }
    });
    dml += `FROM ${entityName}\n`;
    
    for (let i = 0; i < sourceEntities.length; i++) {
      const entity = sourceEntities[i];
      if (i === 0) {
        dml += `  LEFT JOIN ${entity} ON ${entityName}.id = ${entity}.id\n`;
      } else {
        dml += `  LEFT JOIN ${entity} ON ${entityName}.id = ${entity}.id\n`;
      }
    }
    dml += `ORDER BY ${entityName}.created_at DESC\n`;
    dml += `LIMIT 10;\n`;
  } else {
    dml += `SELECT * FROM ${entityName} ORDER BY created_at DESC LIMIT 10;\n`;
  }
  
  return dml;
};

const generateConsumptionDMLPySpark = (entityName, transformations) => {
  const sourceEntities = transformations.sourceEntities || [];
  const mappings = transformations.mappings || [];
  
  let dml = `# DML Operations for Consumption Entity: ${entityName}\n`;
  dml += `# Data Manipulation Language for consumption layer with M:1 mappings\n\n`;
  
  // Import statements
  dml += `from pyspark.sql import SparkSession\n`;
  dml += `from pyspark.sql.functions import *\n\n`;
  
  // Data operations
  dml += `# Initialize Spark session\n`;
  dml += `spark = SparkSession.builder.appName("${entityName}DML").getOrCreate()\n\n`;
  
  // Insert operations
  dml += `# Insert sample consumption data\n`;
  dml += `sample_data = [\n`;
  dml += `    ("Sample Consumption Data 1",),\n`;
  dml += `    ("Sample Consumption Data 2",),\n`;
  dml += `    ("Sample Consumption Data 3",)\n`;
  dml += `]\n`;
  dml += `\n`;
  dml += `sample_df = spark.createDataFrame(sample_data, ["name"])\n`;
  dml += `sample_df = sample_df.withColumn("created_at", current_timestamp())\n`;
  dml += `sample_df = sample_df.withColumn("updated_at", current_timestamp())\n`;
  dml += `\n`;
  dml += `# Write to table\n`;
  dml += `sample_df.write.mode("append").saveAsTable("${entityName}")\n\n`;
  
  // Update operations
  dml += `# Update operations using SQL\n`;
  dml += `spark.sql(f"""\n`;
  dml += `    UPDATE ${entityName} \n`;
  dml += `    SET updated_at = CURRENT_TIMESTAMP \n`;
  dml += `    WHERE name LIKE '%Sample%'\n`;
  dml += `""")\n\n`;
  
  // Query operations with M:1 mappings
  dml += `# Query operations with M:1 mappings\n`;
  if (sourceEntities.length > 1) {
    dml += `# Using the generated view for complex mappings\n`;
    dml += `result_df = spark.sql(f"SELECT * FROM {entityName}_view ORDER BY created_at DESC LIMIT 10")\n`;
    dml += `result_df.show()\n\n`;
    
    dml += `# Direct table query (if view not available)\n`;
    dml += `result_df = spark.sql(f"SELECT * FROM {entityName} ORDER BY created_at DESC LIMIT 10")\n`;
    dml += `result_df.show()\n\n`;
    
    // Generate sample JOIN queries
    dml += `# Sample JOIN queries for M:1 relationships\n`;
    dml += `join_query = f"""\n`;
    dml += `    SELECT \n`;
    dml += `      ${entityName}.*,\n`;
    sourceEntities.forEach((entity, index) => {
      if (index < sourceEntities.length - 1) {
        dml += `      ${entity}.name AS ${entity}_name,\n`;
      } else {
        dml += `      ${entity}.name AS ${entity}_name\n`;
      }
    });
    dml += `    FROM ${entityName}\n`;
    
    for (let i = 0; i < sourceEntities.length; i++) {
      const entity = sourceEntities[i];
      if (i === 0) {
        dml += `      LEFT JOIN ${entity} ON ${entityName}.id = ${entity}.id\n`;
      } else {
        dml += `      LEFT JOIN ${entity} ON ${entityName}.id = ${entity}.id\n`;
      }
    }
    dml += `    ORDER BY ${entityName}.created_at DESC\n`;
    dml += `    LIMIT 10\n`;
    dml += `"""\n\n`;
    
    dml += `join_result_df = spark.sql(join_query)\n`;
    dml += `join_result_df.show()\n`;
  } else {
    dml += `result_df = spark.sql(f"SELECT * FROM {entityName} ORDER BY created_at DESC LIMIT 10")\n`;
    dml += `result_df.show()\n`;
  }
  
  return dml;
};

module.exports = {
  generateConsumptionArtifacts,
  generateConsumptionDiffs,
  getStoredConsumptionArtifacts,
  pushConsumptionArtifactsToGitHub,
};
