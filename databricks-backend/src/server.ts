import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from './config/logger';
import databricksRoutes from './routes/databricks.routes';
import dabRoutes from './routes/dab.routes';
import deploymentRoutes from './routes/deployment.routes';
import { errorHandler } from './utils/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'databricks-backend', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/databricks', databricksRoutes);
app.use('/api/dab', dabRoutes);
app.use('/api/deployments', deploymentRoutes);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Databricks backend listening on port ${PORT}`);
});

export default app;
