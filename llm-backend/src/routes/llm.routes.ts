import { Router } from 'express';
import { LLMService } from '../services/llm.service';

const router = Router();
const llmService = new LLMService();

// Generate column mappings
router.post('/mappings/generate', async (req, res, next) => {
  try {
    const { sourceSchema, targetSchema, transformationContext, businessRules } = req.body;
    const mappings = await llmService.generateColumnMappings({
      sourceSchema,
      targetSchema,
      transformationContext,
      businessRules,
    });
    res.json(mappings);
  } catch (error) {
    next(error);
  }
});

// Generate YAML from mappings
router.post('/yaml/generate', async (req, res, next) => {
  try {
    const { mappings, sourceTable, targetTable, transformationType } = req.body;
    const yaml = await llmService.generateYAML(mappings, sourceTable, targetTable, transformationType);
    res.json(yaml);
  } catch (error) {
    next(error);
  }
});

// Generate reasoning for transformation
router.post('/reasoning/generate', async (req, res, next) => {
  try {
    const { yaml, context } = req.body;
    const reasoning = await llmService.generateReasoning(yaml, context);
    res.json(reasoning);
  } catch (error) {
    next(error);
  }
});

// Validate and suggest improvements
router.post('/validate', async (req, res, next) => {
  try {
    const { yaml, mappings } = req.body;
    const validation = await llmService.validateAndSuggest(yaml, mappings);
    res.json(validation);
  } catch (error) {
    next(error);
  }
});

export default router;
