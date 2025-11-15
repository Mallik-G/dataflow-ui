import { Router } from 'express';
import { RAGService } from '../services/rag.service';

const router = Router();
const ragService = new RAGService();

// Store feedback for RAG learning
router.post('/feedback', async (req, res, next) => {
  try {
    const { mappingId, yaml, userFeedback, correctedMapping } = req.body;
    const result = await ragService.storeFeedback({
      mappingId,
      yaml,
      userFeedback,
      correctedMapping,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Query similar patterns from RAG
router.post('/query', async (req, res, next) => {
  try {
    const { query, limit, filter } = req.body;
    const results = await ragService.querySimilarPatterns(query, limit, filter);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

// Index new pattern or example
router.post('/index', async (req, res, next) => {
  try {
    const { content, metadata } = req.body;
    const result = await ragService.indexDocument(content, metadata);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get learning statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await ragService.getLearningStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;
