const { ChangeLog } = require('../models');

const saveCodeChange = async (req, res) => {
  try {
    const {
      type,
      ingestion_type,
      previous_data,
      new_data,
      Old_commit_id,
      created_by = 'admin@gmail.com'
    } = req.body;

    if (!type || !ingestion_type) {
      return res.status(400).json({
        success: false,
        message: 'Type and ingestion_type are required fields'
      });
    }

    if (!['Schema', 'ETL'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be either "Schema" or "ETL"'
      });
    }

    if (!['raw', 'curated', 'consumption'].includes(ingestion_type)) {
      return res.status(400).json({
        success: false,
        message: 'Ingestion type must be one of: raw, curated, consumption'
      });
    }

    const changeLogEntry = await ChangeLog.create({
      type,
      ingestion_type,
      previous_data: previous_data || null,
      new_data: new_data || null,
      Old_commit_id,
      created_by,
      creation_date: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Code change saved successfully',
      data: {
        change_log_id: changeLogEntry.change_log_id,
        type: changeLogEntry.type,
        ingestion_type: changeLogEntry.ingestion_type,
        created_by: changeLogEntry.created_by,
        creation_date: changeLogEntry.creation_date
      }
    });

  } catch (error) {
    console.error('Error saving code change:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save code change',
      error: error.message
    });
  }
};

const getAllChangeLogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, ingestion_type } = req.query;
    
    const offset = (page - 1) * limit;
    const whereClause = {};
    
    if (type) whereClause.type = type;
    if (ingestion_type) whereClause.ingestion_type = ingestion_type;

    const { count, rows } = await ChangeLog.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['creation_date', 'DESC']]
    });

    const changeLogs = rows.map(log => ({
      ...log.toJSON(),
      previous_data: log.previous_data,
      new_data: log.new_data
    }));

    res.json({
      success: true,
      data: changeLogs,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching change logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch change logs',
      error: error.message
    });
  }
};

const getChangeLogById = async (req, res) => {
  try {
    const { id } = req.params;

    const changeLog = await ChangeLog.findByPk(id);

    if (!changeLog) {
      return res.status(404).json({
        success: false,
        message: 'Change log not found'
      });
    }

    const changeLogData = {
      ...changeLog.toJSON(),
      previous_data: changeLog.previous_data,
      new_data: changeLog.new_data
    };

    res.json({
      success: true,
      data: changeLogData
    });

  } catch (error) {
    console.error('Error fetching change log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch change log',
      error: error.message
    });
  }
};

const deleteChangeLog = async (req, res) => {
  try {
    const { id } = req.params;

    const changeLog = await ChangeLog.findByPk(id);

    if (!changeLog) {
      return res.status(404).json({
        success: false,
        message: 'Change log not found'
      });
    }

    await changeLog.destroy();

    res.json({
      success: true,
      message: 'Change log deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting change log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete change log',
      error: error.message
    });
  }
};

module.exports = {
  saveCodeChange,
  getAllChangeLogs,
  getChangeLogById,
  deleteChangeLog
};
