const express = require('express');
const router = express.Router();
const {
  createProjection,
  getAllProjections,
  deleteProjection,
  getProjectionById,
  updateProjection,
} = require('../../controllers/projections/projectionsController');

router.post('/', createProjection);
router.get('/', getAllProjections);
router.get('/:projection_id', getProjectionById);
router.delete('/:projection_id', deleteProjection);
router.put('/:projection_id', updateProjection);

module.exports = router;
