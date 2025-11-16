const { Op } = require('sequelize');
const SourceMaster = require('../../models/SourceMaster');
const SchemaMaster = require('../../models/SchemaMaster');
const axios = require('axios');

// add or update source
const addSource = async (req, res) => {
  try {
    const {
      sourceMasterId,
      sourceName,
      selectedCatalog,
      selectedSchema,
      description,
      selectedTables,
      selectedTablesMapping,
    } = req.body;

    const existingTables = await SourceMaster.findAll({
      where: {
        tables: {
          [Op.contains]: selectedTables.map((table) => table.toLowerCase()),
        },
      },
    });
    const existingSources = await SourceMaster.findAll({
      where: {
        source_name: sourceName?.toLowerCase(),
      },
    });

    if (existingTables.length > 0 && existingSources.length == 0) {
      return res.status(200).json({
        status: 400,
        message: 'Tables already exists in any bucket',
        data: existingTables,
      });
    }

    let source = await SourceMaster.upsert(
      {
        source_name: sourceName?.toLowerCase(),
        description,
        catalog: selectedCatalog,
        schema: selectedSchema.map((schema) => schema.toLowerCase()),
        tables: selectedTables.map((table) => table.toLowerCase()),
        table_schema_mapping: selectedTablesMapping,
      },
      { source_master_id: sourceMasterId }
    );

    source = source?.toJSON ? source.toJSON() : source;

    Object.entries(selectedTablesMapping).forEach(([schema, tables]) => {
      tables.forEach(async (table) => {
        console.log('Schema:', schema, 'Table:', table);
        let details = await axios.get(
          `${process.env.LLM_URL}/api/v1/catalogs/${selectedCatalog}/schemas/${schema}/tables/${table}`
        );
        await SchemaMaster.create({
          source_name: sourceName?.toLowerCase(),
          source_master_id: source?.[0]?.source_master_id,
          name: details?.data?.name,
          description: details?.data?.comment,
          ddl: 'ddl',
          schema: details?.data?.columns,
          ingestion_type: 'raw',
          creation_date: new Date(),
          created_by: details?.data?.owner,
          modify_date: new Date(),
        });
      });
    });

    let message = 'Source added successfully';
    if (existingSources.length > 0) {
      message = 'Source updated successfully';
    }
    return res.status(200).json({
      status: 200,
      message: message,
      data: source,
    });
  } catch (error) {
    console.error('Error adding source:', error);
    return res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

const getAllSources = async (req, res) => {
  try {
    const sources = await SourceMaster.findAll();
    return res.status(200).json({
      message: 'All sources fetched successfully',
      data: sources,
    });
  } catch (error) {
    console.error('Error fetching all sources:', error);
    return res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

module.exports = {
  addSource,
  getAllSources,
};
