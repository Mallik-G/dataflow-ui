import OpenAI from 'openai';
import yaml from 'js-yaml';
import { logger } from '../config/logger';
import { ColumnMapping, YAMLGeneration, LLMRequest } from '../models/types';
import { RAGService } from './rag.service';

export class LLMService {
  private openai: OpenAI;
  private ragService: RAGService;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.ragService = new RAGService();
  }

  /**
   * Generate column mappings using LLM with RAG context
   */
  async generateColumnMappings(request: LLMRequest): Promise<ColumnMapping[]> {
    logger.info('Generating column mappings', {
      sourceColumns: request.sourceSchema.length,
      targetColumns: request.targetSchema.length,
    });

    // Query RAG for similar patterns
    const ragContext = await this.ragService.querySimilarPatterns(
      `source: ${JSON.stringify(request.sourceSchema)} target: ${JSON.stringify(request.targetSchema)}`,
      3
    );

    const systemPrompt = `You are an expert data engineer specializing in column mapping and data transformation.
Your task is to generate intelligent column mappings between source and target schemas.

Context from similar patterns:
${ragContext.documents.map((doc) => doc.content).join('\n\n')}

Rules:
- Analyze column names, types, and descriptions
- Identify direct mappings, transformations, aggregations, and window functions
- Provide clear reasoning for each mapping
- Assign confidence scores (0-1)
- Include validation rules where appropriate
- Consider business logic and data quality`;

    const userPrompt = `
Source Schema:
${JSON.stringify(request.sourceSchema, null, 2)}

Target Schema:
${JSON.stringify(request.targetSchema, null, 2)}

${request.transformationContext ? `Context: ${request.transformationContext}` : ''}
${request.businessRules ? `Business Rules:\n${request.businessRules.join('\n')}` : ''}

Generate column mappings in JSON format with the following structure:
{
  "mappings": [
    {
      "sourceColumn": "column_name",
      "targetColumn": "target_column_name",
      "type": "direct|custom|aggregate|window",
      "expression": "SQL expression if not direct",
      "reasoning": "Why this mapping makes sense",
      "confidence": 0.95,
      "validationRules": ["NOT NULL", "CHECK > 0"]
    }
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No response from LLM');

      const result = JSON.parse(content);
      logger.info('Column mappings generated', { count: result.mappings.length });

      return result.mappings;
    } catch (error: any) {
      logger.error('Failed to generate column mappings', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate YAML transformation definition from mappings
   */
  async generateYAML(
    mappings: ColumnMapping[],
    sourceTable: string,
    targetTable: string,
    transformationType: 'simple' | 'complex' = 'simple'
  ): Promise<YAMLGeneration> {
    logger.info('Generating YAML', { mappingCount: mappings.length, type: transformationType });

    const systemPrompt = `You are an expert in generating YAML configuration for data transformations.
Generate production-ready YAML that includes:
- Data sources with joins and filters
- Column transformations (direct, aggregations, window functions, business logic)
- Validation rules
- Complete SQL template with CTEs
- Performance metadata and recommendations

The YAML should be clean, well-structured, and follow best practices.`;

    const userPrompt = `
Generate a YAML transformation definition:

Source Table: ${sourceTable}
Target Table: ${targetTable}
Transformation Type: ${transformationType}

Mappings:
${JSON.stringify(mappings, null, 2)}

${
  transformationType === 'complex'
    ? `
Include:
- Multi-table joins with filters
- Window functions (ROW_NUMBER, RANK, LAG, LEAD)
- Aggregations with GROUP BY
- CASE statements for business logic
- Data quality filters and HAVING conditions
- Complete SQL template using CTEs
`
    : ''
}

Return JSON with structure:
{
  "yaml": "the YAML content as a string",
  "reasoning": "explanation of the transformation logic",
  "warnings": ["any warnings or considerations"],
  "metadata": {
    "version": "1.0",
    "generatedAt": "ISO timestamp",
    "complexity": "simple|medium|complex",
    "estimatedExecutionTime": "estimate"
  }
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No response from LLM');

      const result = JSON.parse(content);

      logger.info('YAML generated successfully', {
        complexity: result.metadata.complexity,
        warnings: result.warnings.length,
      });

      return result;
    } catch (error: any) {
      logger.error('Failed to generate YAML', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate reasoning explanation for transformation
   */
  async generateReasoning(yaml: string, context?: string): Promise<string> {
    logger.info('Generating reasoning for YAML');

    const systemPrompt = `You are a technical writer specializing in data engineering.
Explain the transformation logic in clear, concise language that both technical and business users can understand.`;

    const userPrompt = `
Explain this data transformation YAML:

${yaml}

${context ? `Context: ${context}` : ''}

Provide a clear explanation covering:
1. What data sources are being used
2. What transformations are being applied
3. What business logic is implemented
4. What the output will look like`;

    try {
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
      });

      const reasoning = response.choices[0].message.content || '';
      logger.info('Reasoning generated successfully');

      return reasoning;
    } catch (error: any) {
      logger.error('Failed to generate reasoning', { error: error.message });
      throw error;
    }
  }

  /**
   * Validate YAML and suggest improvements
   */
  async validateAndSuggest(
    yamlContent: string,
    mappings: ColumnMapping[]
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
  }> {
    logger.info('Validating YAML and mappings');

    // First validate YAML syntax
    let parsedYaml;
    try {
      parsedYaml = yaml.load(yamlContent);
    } catch (error: any) {
      return {
        isValid: false,
        errors: [`YAML syntax error: ${error.message}`],
        warnings: [],
        suggestions: [],
      };
    }

    // Use LLM for semantic validation
    const systemPrompt = `You are a data engineering quality assurance expert.
Review the YAML transformation and column mappings for:
- Correctness and completeness
- Performance issues
- Data quality concerns
- Best practice violations
- Potential runtime errors`;

    const userPrompt = `
Review this transformation:

YAML:
${yamlContent}

Mappings:
${JSON.stringify(mappings, null, 2)}

Return JSON with:
{
  "isValid": true/false,
  "errors": ["critical issues that must be fixed"],
  "warnings": ["potential issues to review"],
  "suggestions": ["optimization and improvement ideas"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No response from LLM');

      const validation = JSON.parse(content);

      logger.info('Validation completed', {
        isValid: validation.isValid,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length,
      });

      return validation;
    } catch (error: any) {
      logger.error('Failed to validate YAML', { error: error.message });
      throw error;
    }
  }
}
