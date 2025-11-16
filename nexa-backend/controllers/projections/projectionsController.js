const Projections = require('../../models/Projections');

const createProjection = async (req, res) => {
  try {
    const {
      projection_name,
      description,
      source_entities,
      target_layer,
      projection_type,
      schedule_time,
      frequency,
      time_of_day,
      legacy_projection,
      projection_sources,
      status,
      pii_suppressed,
      created_by,
      projection_target,
    } = req.body;
    if (
      !projection_name ||
      !description ||
      !source_entities ||
      !target_layer ||
      !projection_type ||
      (projection_type === 'batch' && !schedule_time) ||
      (projection_type === 'batch' && !frequency) ||
      (projection_type === 'batch' && !time_of_day) ||
      !projection_sources ||
      !created_by ||
      !projection_target
    ) {
      return res.status(200).json({
        success: false,
        message: 'Missing required fields',
      });
    }
    const projection = await Projections.create({
      projection_name,
      description,
      source_entities,
      target_layer,
      projection_type,
      schedule_time,
      frequency,
      time_of_day,
      legacy_projection,
      projection_sources,
      status,
      pii_suppressed,
      created_by,
      creation_date: new Date(),
      modify_date: new Date(),
      modify_by: created_by,
      projection_target,
    });

    return res.status(200).json({
      success: true,
      message: 'Projection created successfully',
      projection: projection,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

const getAllProjections = async (req, res) => {
  try {
    const projections = await Projections.findAll({
      order: [['createdAt', 'DESC']],
      attributes: {
        exclude: ['createdAt', 'updatedAt', 'deletedAt'],
      },
    });
    return res.status(200).json({
      success: true,
      message: 'All projections fetched successfully',
      projections: projections,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

const getProjectionById = async (req, res) => {
  try {
    const { projection_id } = req.params;
    const projection = await Projections.findByPk(projection_id);
    return res.status(200).json({
      success: true,
      message: 'Projection fetched successfully',
      projection: projection,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

const deleteProjection = async (req, res) => {
  try {
    const { projection_id } = req.params;
    const projection = await Projections.findByPk(projection_id);
    if (!projection) {
      return res.status(200).json({
        success: false,
        message: 'Projection not found or already deleted',
      });
    }
    await projection.destroy();
    return res.status(200).json({
      success: true,
      message: 'Projection deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

const updateProjection = async (req, res) => {
  try {
    const { projection_id } = req.params;
    const {
      projection_name,
      description,
      source_entities,
      target_layer,
      projection_type,
      schedule_time,
      frequency,
      time_of_day,
      legacy_projection,
      projection_sources,
      status,
      pii_suppressed,
      created_by,
      projection_target,
    } = req.body;

    const projection = await Projections.findByPk(projection_id);
    if (!projection) {
      return res.status(200).json({
        success: false,
        message: 'Projection not found',
      });
    }
    await projection.update({
      projection_name,
      description,
      source_entities,
      target_layer,
      projection_type,
      schedule_time,
      frequency,
      time_of_day,
      legacy_projection,
      projection_sources,
      status,
      pii_suppressed,
      created_by,
      projection_target,
    });
    return res.status(200).json({
      success: true,
      message: 'Projection updated successfully',
      projection: projection,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

module.exports = {
  createProjection,
  getAllProjections,
  deleteProjection,
  getProjectionById,
  updateProjection,
};
