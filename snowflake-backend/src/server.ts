import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from './config/logger';
import snowflakeRoutes from './routes/snowflake.routes';
import { errorHandler } from './utils/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'snowflake-backend', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/snowflake', snowflakeRoutes);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Snowflake backend listening on port ${PORT}`);
});

export default app;
