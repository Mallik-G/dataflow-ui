import { Router } from 'express';
import { SnowflakeService } from '../services/snowflake.service';

const router = Router();
const snowflakeService = new SnowflakeService();

// Test connection
router.post('/test', async (req, res, next) => {
  try {
    const config = req.body;
    const result = await snowflakeService.testConnection(config);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Execute query
router.post('/query', async (req, res, next) => {
  try {
    const { config, sql } = req.body;
    const result = await snowflakeService.executeQuery(config, sql);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get table metadata
router.post('/metadata/table', async (req, res, next) => {
  try {
    const { config, database, schema, table } = req.body;
    const result = await snowflakeService.getTableMetadata(config, database, schema, table);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// List tables in schema
router.post('/tables/list', async (req, res, next) => {
  try {
    const { config, database, schema } = req.body;
    const result = await snowflakeService.listTables(config, database, schema);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Create table
router.post('/table/create', async (req, res, next) => {
  try {
    const { config, sql } = req.body;
    const result = await snowflakeService.createTable(config, sql);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
