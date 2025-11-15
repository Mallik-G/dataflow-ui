import { Router } from 'express';
import { DeploymentStateService } from '../services/deploymentState.service';

const router = Router();
const deploymentStateService = new DeploymentStateService();

// Get deployment history
router.get('/history', async (req, res, next) => {
  try {
    const { environment, limit } = req.query;
    const history = await deploymentStateService.getDeploymentHistory(
      environment as string,
      parseInt(limit as string) || 50
    );
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Get current state for environment
router.get('/state/:environment', async (req, res, next) => {
  try {
    const { environment } = req.params;
    const state = await deploymentStateService.getEnvironmentState(environment);
    res.json(state);
  } catch (error) {
    next(error);
  }
});

// Get resource inventory
router.get('/resources/:environment', async (req, res, next) => {
  try {
    const { environment } = req.params;
    const { resourceType } = req.query;
    const resources = await deploymentStateService.getResourceInventory(
      environment,
      resourceType as string
    );
    res.json(resources);
  } catch (error) {
    next(error);
  }
});

// Detect drift
router.get('/drift/:environment', async (req, res, next) => {
  try {
    const { environment } = req.params;
    const drift = await deploymentStateService.detectDrift(environment);
    res.json(drift);
  } catch (error) {
    next(error);
  }
});

// Get deployment by ID
router.get('/:deploymentId', async (req, res, next) => {
  try {
    const { deploymentId } = req.params;
    const deployment = await deploymentStateService.getDeployment(deploymentId);
    res.json(deployment);
  } catch (error) {
    next(error);
  }
});

export default router;
