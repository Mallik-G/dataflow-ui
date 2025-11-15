import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from './config/logger';
import llmRoutes from './routes/llm.routes';
import ragRoutes from './routes/rag.routes';
import { errorHandler } from './utils/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'llm-backend', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/llm', llmRoutes);
app.use('/api/rag', ragRoutes);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`LLM backend listening on port ${PORT}`);
});

export default app;
