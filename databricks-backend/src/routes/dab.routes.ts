import { Router } from 'express';
import { DABService } from '../services/dab.service';

const router = Router();
const dabService = new DABService();

// Generate DAB bundle from project YAML
router.post('/bundle/generate', async (req, res, next) => {
  try {
    const { projectPath, environment } = req.body;
    const result = await dabService.generateBundle(projectPath, environment);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Preview deployment plan (dry run)
router.post('/plan', async (req, res, next) => {
  try {
    const { bundlePath, environment } = req.body;
    const plan = await dabService.previewPlan(bundlePath, environment);
    res.json(plan);
  } catch (error) {
    next(error);
  }
});

// Deploy bundle
router.post('/deploy', async (req, res, next) => {
  try {
    const { bundlePath, environment, commit, branch, user } = req.body;
    const result = await dabService.deploy(bundlePath, environment, commit, branch, user);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Validate bundle
router.post('/bundle/validate', async (req, res, next) => {
  try {
    const { bundlePath } = req.body;
    const result = await dabService.validateBundle(bundlePath);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
