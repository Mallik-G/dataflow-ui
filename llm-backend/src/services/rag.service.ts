import { Pool } from 'pg';
import OpenAI from 'openai';
import { logger } from '../config/logger';
import { RAGDocument, RAGQueryResult, FeedbackRequest } from '../models/types';

export class RAGService {
  private db: Pool;
  private openai: OpenAI;

  constructor() {
    this.db = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'nexa_rag',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.initializeDatabase();
  }

  private async initializeDatabase() {
    // Create tables with pgvector extension for embeddings
    const createTablesSQL = `
      CREATE EXTENSION IF NOT EXISTS vector;

      CREATE TABLE IF NOT EXISTS rag_documents (
        id VARCHAR(36) PRIMARY KEY,
        content TEXT NOT NULL,
        metadata JSONB NOT NULL,
        embedding vector(1536),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS feedback_history (
        id SERIAL PRIMARY KEY,
        mapping_id VARCHAR(36) NOT NULL,
        yaml TEXT NOT NULL,
        user_feedback TEXT NOT NULL,
        corrected_mapping JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_rag_embedding ON rag_documents USING ivfflat (embedding vector_cosine_ops);
      CREATE INDEX IF NOT EXISTS idx_rag_metadata ON rag_documents USING gin (metadata);
    `;

    try {
      await this.db.query(createTablesSQL);
      logger.info('RAG database tables initialized');
    } catch (error: any) {
      logger.error('Failed to initialize RAG database', { error: error.message });
    }
  }

  /**
   * Store user feedback for learning
   */
  async storeFeedback(feedback: FeedbackRequest): Promise<{ success: boolean; documentId?: string }> {
    logger.info('Storing feedback for RAG learning', { mappingId: feedback.mappingId });

    try {
      // Store feedback in history
      await this.db.query(
        `INSERT INTO feedback_history (mapping_id, yaml, user_feedback, corrected_mapping)
         VALUES ($1, $2, $3, $4)`,
        [feedback.mappingId, feedback.yaml, feedback.userFeedback, JSON.stringify(feedback.correctedMapping)]
      );

      // Index as RAG document for future reference
      const document: RAGDocument = {
        id: crypto.randomUUID(),
        content: `Feedback: ${feedback.userFeedback}\n\nYAML:\n${feedback.yaml}\n\nCorrected Mapping:\n${JSON.stringify(feedback.correctedMapping, null, 2)}`,
        metadata: {
          type: 'feedback',
          source: feedback.mappingId,
          tags: ['user-correction', 'learning'],
          createdAt: new Date().toISOString(),
        },
      };

      const result = await this.indexDocument(document.content, document.metadata);

      logger.info('Feedback stored successfully', { documentId: result.documentId });

      return { success: true, documentId: result.documentId };
    } catch (error: any) {
      logger.error('Failed to store feedback', { error: error.message });
      throw error;
    }
  }

  /**
   * Query similar patterns from RAG using vector similarity
   */
  async querySimilarPatterns(
    query: string,
    limit: number = 5,
    filter?: { type?: string; tags?: string[] }
  ): Promise<RAGQueryResult> {
    logger.info('Querying RAG for similar patterns', { limit, filter });

    try {
      // Generate embedding for query
      const embedding = await this.generateEmbedding(query);

      // Build SQL query with optional filters
      let sql = `
        SELECT id, content, metadata, 1 - (embedding <=> $1::vector) AS similarity
        FROM rag_documents
      `;
      const params: any[] = [`[${embedding.join(',')}]`];

      if (filter?.type) {
        sql += ` WHERE metadata->>'type' = $2`;
        params.push(filter.type);
      }

      sql += ` ORDER BY embedding <=> $1::vector LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await this.db.query(sql, params);

      const documents: RAGDocument[] = result.rows.map((row) => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata,
      }));

      const similarity = result.rows.map((row) => row.similarity);

      logger.info('RAG query completed', { resultCount: documents.length });

      return {
        documents,
        similarity,
        totalResults: documents.length,
      };
    } catch (error: any) {
      logger.error('Failed to query RAG', { error: error.message });
      throw error;
    }
  }

  /**
   * Index a new document into RAG
   */
  async indexDocument(content: string, metadata: any): Promise<{ success: boolean; documentId: string }> {
    logger.info('Indexing document into RAG', { type: metadata.type });

    try {
      const documentId = crypto.randomUUID();
      const embedding = await this.generateEmbedding(content);

      await this.db.query(
        `INSERT INTO rag_documents (id, content, metadata, embedding)
         VALUES ($1, $2, $3, $4::vector)`,
        [documentId, content, JSON.stringify(metadata), `[${embedding.join(',')}]`]
      );

      logger.info('Document indexed successfully', { documentId });

      return { success: true, documentId };
    } catch (error: any) {
      logger.error('Failed to index document', { error: error.message });
      throw error;
    }
  }

  /**
   * Get learning statistics
   */
  async getLearningStats(): Promise<{
    totalDocuments: number;
    documentsByType: Record<string, number>;
    totalFeedback: number;
    recentFeedback: number;
  }> {
    logger.info('Getting RAG learning statistics');

    try {
      const totalDocsResult = await this.db.query('SELECT COUNT(*) as count FROM rag_documents');
      const totalDocs = parseInt(totalDocsResult.rows[0].count);

      const docsByTypeResult = await this.db.query(`
        SELECT metadata->>'type' as type, COUNT(*) as count
        FROM rag_documents
        GROUP BY metadata->>'type'
      `);

      const documentsByType: Record<string, number> = {};
      for (const row of docsByTypeResult.rows) {
        documentsByType[row.type] = parseInt(row.count);
      }

      const totalFeedbackResult = await this.db.query('SELECT COUNT(*) as count FROM feedback_history');
      const totalFeedback = parseInt(totalFeedbackResult.rows[0].count);

      const recentFeedbackResult = await this.db.query(`
        SELECT COUNT(*) as count FROM feedback_history
        WHERE created_at > NOW() - INTERVAL '7 days'
      `);
      const recentFeedback = parseInt(recentFeedbackResult.rows[0].count);

      return {
        totalDocuments: totalDocs,
        documentsByType,
        totalFeedback,
        recentFeedback,
      };
    } catch (error: any) {
      logger.error('Failed to get learning stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate embedding using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  }
}
