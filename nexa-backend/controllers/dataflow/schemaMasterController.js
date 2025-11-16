const SchemaMaster = require('../../models/SchemaMaster');
const { Sequelize, Op } = require('sequelize');

//save single schema coming from external api to schema_master table
const saveSchemaMaster = async (req, res) => {
  try {
    // Destructure incoming data (from API or frontend)
    const {
      source_name,
      name,
      description,
      ddl,
      schema,
      ingestion_type,
      commit_id,
      creation_date,
      created_by,
      modify_date,
      modify_by,
    } = req.body;

    // ✅ Basic validation
    if (!name || !ingestion_type || !creation_date || !created_by) {
      return res.status(400).json({
        message:
          'Missing required fields: name, ingestion_type, creation_date, created_by',
      });
    }

    // ✅ Create entry
    const newSchema = await SchemaMaster.create({
      source_name,
      name,
      description,
      ddl,
      schema,
      ingestion_type,
      commit_id,
      creation_date,
      created_by,
      modify_date,
      modify_by,
    });

    // ✅ Success response
    return res.status(201).json({
      message: 'SchemaMaster entry created successfully',
      data: newSchema,
    });
  } catch (error) {
    console.error('Error saving raw file schema:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get raw file schema',
      error: error.message,
    });
  }
};

// save multiple/ bulk create
const createMultipleSchemas = async (req, res) => {
  try {
    const schemas = req.body; // expecting an array of objects
    // ✅ Check if it's an array
    if (!Array.isArray(schemas) || schemas.length === 0) {
      return res.status(400).json({
        message: 'Request body must be a non-empty array of schema objects',
      });
    }
    // ✅ Basic validation for each object
    const invalidItems = schemas.filter(
      (item) =>
        !item.name ||
        !item.ingestion_type ||
        !item.creation_date ||
        !item.created_by
    );
    if (invalidItems.length > 0) {
      return res.status(400).json({
        message:
          'Some records are missing required fields: name, ingestion_type, creation_date, created_by',
        invalidItems,
      });
    }
    // ✅ Bulk insert all records
    const result = await SchemaMaster.bulkCreate(schemas, {
      batchSize: 1000,
      validate: true,
    });
    return res.status(201).json({
      message: `${result.length} SchemaMaster records created successfully`,
    });
  } catch (error) {
    console.error('Error during bulk insert:', error);
    return res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

// get all schemas
const getGroupedSchemasCount = async (req, res) => {
  const { ingestion_type } = req.query;
  try {
    //group by source_name
    const schemas = await SchemaMaster.findAll({
      where: { ingestion_type },
      attributes: [
        'source_name',
        [Sequelize.fn('COUNT', Sequelize.col('entity_id')), 'total_schemas'],
      ],
      group: ['source_name'],
    });
    return res.status(200).json({
      message: 'All schemas fetched successfully',
      data: schemas,
    });
  } catch (error) {
    console.error('Error fetching all schemas:', error);
    return res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

// get all schemas
const getAllSchemas = async (req, res) => {
  let { ingestion_type, sourceIds, attributes } = req.query;
  console.log('sourceIds:', sourceIds);
  try {
    let whereClause = {};
    if (ingestion_type) {
      whereClause.ingestion_type = ingestion_type;
    }
    if (sourceIds) {
      whereClause.source_master_id = {
        [Op.contains]: sourceIds,
      };
    }
    let query = {
      where: whereClause,
    };
    if (attributes) {
      attributes = attributes.split(',');
      query.attributes = attributes;
    }
    const schemas = await SchemaMaster.findAndCountAll(query);
    return res.status(200).json({
      message: 'All schemas fetched successfully',
      totalCount: schemas.count,
      data: schemas.rows,
    });
  } catch (error) {
    console.error('Error fetching all schemas:', error);
    return res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

module.exports = {
  saveSchemaMaster,
  createMultipleSchemas,
  getGroupedSchemasCount,
  getAllSchemas,
};
