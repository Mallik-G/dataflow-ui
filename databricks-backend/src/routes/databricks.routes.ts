import { Router } from 'express';
import { DatabricksService } from '../services/databricks.service';

const router = Router();
const databricksService = new DatabricksService();

// Test connection
router.post('/test', async (req, res, next) => {
  try {
    const config = req.body;
    const result = await databricksService.testConnection(config);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Execute query
router.post('/query', async (req, res, next) => {
  try {
    const { config, sql } = req.body;
    const result = await databricksService.executeQuery(config, sql);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get table metadata
router.post('/metadata/table', async (req, res, next) => {
  try {
    const { config, catalog, schema, table } = req.body;
    const result = await databricksService.getTableMetadata(config, catalog, schema, table);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// List tables
router.post('/tables/list', async (req, res, next) => {
  try {
    const { config, catalog, schema } = req.body;
    const result = await databricksService.listTables(config, catalog, schema);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Create DLT pipeline
router.post('/dlt/create', async (req, res, next) => {
  try {
    const { config, name, code } = req.body;
    const result = await databricksService.createDLTPipeline(config, name, code);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Upload notebook
router.post('/notebook/upload', async (req, res, next) => {
  try {
    const { config, path, content, language } = req.body;
    const result = await databricksService.uploadNotebook(config, path, content, language);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
