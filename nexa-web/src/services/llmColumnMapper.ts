import { DataProfile, ColumnMapping } from '../types/columnMapping';

export interface LLMMapperRequest {
  sourceTable: DataProfile;
  targetTable: DataProfile;
  context?: {
    businessRules?: string[];
    dataDictionary?: Record<string, string>;
    previousFeedback?: string;
  };
}

export interface LLMMapperResponse {
  yaml: string;
  mappings: ColumnMapping[];
  reasoning: string;
  confidence: number;
}

/**
 * LLM-powered column mapper service
 * Simulates calling an LLM RAG endpoint that returns intelligent column mappings
 */
export class LLMColumnMapper {
  // In production, replace with your actual endpoint
  // private static endpoint = '/api/generate';

  /**
   * Generate column mappings using LLM
   */
  static async generateMappings(
    request: LLMMapperRequest
  ): Promise<LLMMapperResponse> {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // In production, this would be:
    // const response = await fetch(this.endpoint, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(request),
    // });
    // const data = await response.json();
    // return this.parseResponse(data.yaml);

    // For now, simulate LLM response
    return this.simulateLLMResponse(request);
  }

  /**
   * Simulate LLM response (replace with actual API call in production)
   */
  private static simulateLLMResponse(
    request: LLMMapperRequest
  ): LLMMapperResponse {
    const { sourceTable, targetTable, context } = request;

    // Generate YAML response based on tables
    const yaml = this.generateYAML(sourceTable, targetTable, context?.previousFeedback);
    const mappings = this.parseYAML(yaml);

    // Generate reasoning
    const reasoning = this.generateReasoning(mappings, context?.previousFeedback);

    return {
      yaml,
      mappings,
      reasoning,
      confidence: 0.92,
    };
  }

  /**
   * Generate YAML configuration for column mappings with complex transformations
   */
  private static generateYAML(
    sourceTable: DataProfile,
    targetTable: DataProfile,
    feedback?: string
  ): string {
    const yaml = `# AI-Generated Advanced Column Mapping Configuration
# Source: ${sourceTable.tableName}
# Target: ${targetTable.tableName}
# Generated: ${new Date().toISOString()}
# Confidence: 94%
${feedback ? `# Applied Feedback: ${feedback}\n` : ''}
# =============================================================================
# TRANSFORMATION STRATEGY
# =============================================================================
# - Multi-table joins with orders and order_items
# - Window functions for customer ranking and analytics
# - Aggregations for lifetime value calculations
# - Filtered data quality with business rules
# - Complex derived columns with business logic
# =============================================================================

data_sources:
  primary:
    table: raw.customers
    alias: c

  joins:
    - table: raw.orders
      alias: o
      type: LEFT
      condition: o.customer_id = c.customer_id
      filters:
        - "o.status IN ('completed', 'shipped')"
        - "o.order_date >= DATEADD(year, -2, CURRENT_DATE)"

    - table: raw.order_items
      alias: oi
      type: LEFT
      condition: oi.order_id = o.order_id

transformations:
  # ============= DIRECT MAPPINGS =============
  - source_column: customer_id
    target_column: id
    type: direct
    expression: c.customer_id
    reasoning: "Primary key with table alias for join clarity"
    confidence: 0.99
    validation:
      - NOT NULL
      - UNIQUE

  - source_column: email
    target_column: contact_email
    type: direct
    expression: LOWER(TRIM(c.email))
    reasoning: "Normalize email to lowercase and remove whitespace"
    confidence: 0.97
    validation:
      - NOT NULL
      - "email LIKE '%@%.%'"

  # ============= DERIVED COLUMNS =============
  - source_column: first_name, last_name
    target_column: full_name
    type: concat
    expression: "CONCAT_WS(' ', INITCAP(c.first_name), INITCAP(c.last_name))"
    reasoning: "Concatenate with null safety and proper capitalization"
    confidence: 0.95

  - source_column: created_at
    target_column: registration_date
    type: date_format
    expression: "DATE_TRUNC('day', c.created_at)"
    reasoning: "Truncate to day precision for analytics"
    confidence: 0.96

  - source_column: phone_number
    target_column: phone
    type: custom
    expression: "REGEXP_REPLACE(c.phone_number, '[^0-9]', '')"
    reasoning: "Extract only numeric digits from phone"
    confidence: 0.93

  # ============= AGGREGATIONS =============
  - source_column: orders.amount
    target_column: lifetime_value
    type: custom
    expression: "COALESCE(SUM(o.amount), 0)"
    reasoning: "Calculate total customer spend with null handling"
    confidence: 0.94
    group_by: c.customer_id, c.email, c.first_name, c.last_name, c.created_at, c.phone_number

  - source_column: orders.order_id
    target_column: total_orders
    type: custom
    expression: "COUNT(DISTINCT o.order_id)"
    reasoning: "Count unique orders per customer"
    confidence: 0.96
    group_by: c.customer_id, c.email, c.first_name, c.last_name, c.created_at, c.phone_number

  - source_column: order_items.quantity
    target_column: total_items_purchased
    type: custom
    expression: "COALESCE(SUM(oi.quantity), 0)"
    reasoning: "Sum all items across all orders"
    confidence: 0.93
    group_by: c.customer_id, c.email, c.first_name, c.last_name, c.created_at, c.phone_number

  # ============= WINDOW FUNCTIONS =============
  - source_column: orders.amount
    target_column: customer_rank_by_revenue
    type: custom
    expression: |
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(SUM(o.amount), 0) DESC
      )
    reasoning: "Rank customers by lifetime value for segmentation"
    confidence: 0.92
    window_function: true

  - source_column: orders.order_date
    target_column: days_since_last_order
    type: custom
    expression: |
      DATEDIFF(day,
        MAX(o.order_date),
        CURRENT_DATE
      )
    reasoning: "Calculate recency for churn prediction"
    confidence: 0.91
    group_by: c.customer_id, c.email, c.first_name, c.last_name, c.created_at, c.phone_number

  - source_column: orders.amount
    target_column: avg_order_value
    type: custom
    expression: |
      CASE
        WHEN COUNT(DISTINCT o.order_id) > 0
        THEN SUM(o.amount) / COUNT(DISTINCT o.order_id)
        ELSE 0
      END
    reasoning: "Average order value with division by zero protection"
    confidence: 0.94
    group_by: c.customer_id, c.email, c.first_name, c.last_name, c.created_at, c.phone_number

  # ============= BUSINESS LOGIC =============
  - source_column: created_at, orders.amount
    target_column: customer_segment
    type: custom
    expression: |
      CASE
        WHEN COALESCE(SUM(o.amount), 0) >= 10000 THEN 'VIP'
        WHEN COALESCE(SUM(o.amount), 0) >= 5000 THEN 'Premium'
        WHEN COALESCE(SUM(o.amount), 0) >= 1000 THEN 'Standard'
        WHEN COUNT(DISTINCT o.order_id) > 0 THEN 'Active'
        ELSE 'Inactive'
      END
    reasoning: "Segment customers based on spend and activity"
    confidence: 0.89
    group_by: c.customer_id, c.email, c.first_name, c.last_name, c.created_at, c.phone_number

  - source_column: orders.order_date
    target_column: is_active_last_90_days
    type: custom
    expression: |
      CASE
        WHEN MAX(o.order_date) >= DATEADD(day, -90, CURRENT_DATE)
        THEN TRUE
        ELSE FALSE
      END
    reasoning: "Boolean flag for recent activity (90-day window)"
    confidence: 0.96
    group_by: c.customer_id, c.email, c.first_name, c.last_name, c.created_at, c.phone_number

# =============================================================================
# DATA QUALITY RULES
# =============================================================================
filters:
  - condition: "c.email IS NOT NULL"
    reasoning: "Exclude customers without valid email"

  - condition: "c.created_at >= '2020-01-01'"
    reasoning: "Only include customers from 2020 onwards"

  - condition: "c.customer_id NOT IN (SELECT customer_id FROM raw.blacklist)"
    reasoning: "Exclude blacklisted customers"

having_conditions:
  - condition: "COUNT(DISTINCT o.order_id) >= 0"
    reasoning: "Include all customers even with zero orders"

# =============================================================================
# UNMAPPED COLUMNS
# =============================================================================
unmapped_source_columns:
  - address      # Skipped - PII concerns, map to separate table
  - ssn          # Skipped - Sensitive data, requires encryption

unmapped_target_columns: []

# =============================================================================
# SQL GENERATION TEMPLATE
# =============================================================================
sql_template: |
  WITH customer_metrics AS (
    SELECT
      c.customer_id,
      c.email,
      c.first_name,
      c.last_name,
      c.created_at,
      c.phone_number,
      COALESCE(SUM(o.amount), 0) as total_revenue,
      COUNT(DISTINCT o.order_id) as order_count,
      MAX(o.order_date) as last_order_date
    FROM raw.customers c
    LEFT JOIN raw.orders o
      ON o.customer_id = c.customer_id
      AND o.status IN ('completed', 'shipped')
      AND o.order_date >= DATEADD(year, -2, CURRENT_DATE)
    LEFT JOIN raw.order_items oi
      ON oi.order_id = o.order_id
    WHERE c.email IS NOT NULL
      AND c.created_at >= '2020-01-01'
      AND c.customer_id NOT IN (SELECT customer_id FROM raw.blacklist)
    GROUP BY c.customer_id, c.email, c.first_name, c.last_name, c.created_at, c.phone_number
    HAVING COUNT(DISTINCT o.order_id) >= 0
  )
  SELECT
    customer_id as id,
    LOWER(TRIM(email)) as contact_email,
    CONCAT_WS(' ', INITCAP(first_name), INITCAP(last_name)) as full_name,
    DATE_TRUNC('day', created_at) as registration_date,
    REGEXP_REPLACE(phone_number, '[^0-9]', '') as phone,
    total_revenue as lifetime_value,
    order_count as total_orders,
    COALESCE(SUM(quantity), 0) as total_items_purchased,
    ROW_NUMBER() OVER (ORDER BY total_revenue DESC) as customer_rank_by_revenue,
    DATEDIFF(day, last_order_date, CURRENT_DATE) as days_since_last_order,
    CASE
      WHEN order_count > 0 THEN total_revenue / order_count
      ELSE 0
    END as avg_order_value,
    CASE
      WHEN total_revenue >= 10000 THEN 'VIP'
      WHEN total_revenue >= 5000 THEN 'Premium'
      WHEN total_revenue >= 1000 THEN 'Standard'
      WHEN order_count > 0 THEN 'Active'
      ELSE 'Inactive'
    END as customer_segment,
    CASE
      WHEN last_order_date >= DATEADD(day, -90, CURRENT_DATE) THEN TRUE
      ELSE FALSE
    END as is_active_last_90_days
  FROM customer_metrics

# =============================================================================
# WARNINGS & SUGGESTIONS
# =============================================================================
warnings:
  - "Address and SSN columns excluded due to PII concerns"
  - "Using 2-year rolling window for order data - adjust if needed"
  - "Window function for ranking may be expensive on large datasets"

suggestions:
  - "Consider partitioning target table by registration_date for performance"
  - "Add indexes on customer_id, email, and customer_segment"
  - "Set up incremental refresh using last_order_date watermark"
  - "Monitor query performance on ROW_NUMBER() with large datasets"
  - "Consider materialized view for real-time customer_segment updates"

metadata:
  estimated_row_reduction: "15%"
  complexity_score: 8.5
  performance_tier: "Medium"
  recommended_refresh: "Daily"
`;

    return yaml;
  }

  /**
   * Parse YAML response into ColumnMapping[]
   * In production, use a proper YAML parser like js-yaml
   */
  private static parseYAML(_yaml: string): ColumnMapping[] {
    const mappings: ColumnMapping[] = [
      // Direct mappings
      {
        id: 'mapping-customer_id-id',
        sourceColumn: 'customer_id',
        targetColumn: 'id',
        transformationType: 'direct',
        transformationExpression: 'c.customer_id',
        confidence: 0.99,
        isAIGenerated: true,
        isApproved: false,
      },
      {
        id: 'mapping-email-contact_email',
        sourceColumn: 'email',
        targetColumn: 'contact_email',
        transformationType: 'direct',
        transformationExpression: 'LOWER(TRIM(c.email))',
        confidence: 0.97,
        isAIGenerated: true,
        isApproved: false,
      },
      {
        id: 'mapping-first_name+last_name-full_name',
        sourceColumn: 'first_name, last_name',
        targetColumn: 'full_name',
        transformationType: 'concat',
        transformationExpression: "CONCAT_WS(' ', INITCAP(c.first_name), INITCAP(c.last_name))",
        confidence: 0.95,
        isAIGenerated: true,
        isApproved: false,
      },
      {
        id: 'mapping-created_at-registration_date',
        sourceColumn: 'created_at',
        targetColumn: 'registration_date',
        transformationType: 'date_format',
        transformationExpression: "DATE_TRUNC('day', c.created_at)",
        confidence: 0.96,
        isAIGenerated: true,
        isApproved: false,
      },
      {
        id: 'mapping-phone_number-phone',
        sourceColumn: 'phone_number',
        targetColumn: 'phone',
        transformationType: 'custom',
        transformationExpression: "REGEXP_REPLACE(c.phone_number, '[^0-9]', '')",
        confidence: 0.93,
        isAIGenerated: true,
        isApproved: false,
      },

      // Aggregations
      {
        id: 'mapping-orders.amount-lifetime_value',
        sourceColumn: 'orders.amount',
        targetColumn: 'lifetime_value',
        transformationType: 'custom',
        transformationExpression: 'COALESCE(SUM(o.amount), 0)',
        confidence: 0.94,
        isAIGenerated: true,
        isApproved: false,
      },
      {
        id: 'mapping-orders.order_id-total_orders',
        sourceColumn: 'orders.order_id',
        targetColumn: 'total_orders',
        transformationType: 'custom',
        transformationExpression: 'COUNT(DISTINCT o.order_id)',
        confidence: 0.96,
        isAIGenerated: true,
        isApproved: false,
      },
      {
        id: 'mapping-order_items.quantity-total_items_purchased',
        sourceColumn: 'order_items.quantity',
        targetColumn: 'total_items_purchased',
        transformationType: 'custom',
        transformationExpression: 'COALESCE(SUM(oi.quantity), 0)',
        confidence: 0.93,
        isAIGenerated: true,
        isApproved: false,
      },

      // Window functions & analytics
      {
        id: 'mapping-orders.amount-customer_rank_by_revenue',
        sourceColumn: 'orders.amount',
        targetColumn: 'customer_rank_by_revenue',
        transformationType: 'custom',
        transformationExpression: 'ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(o.amount), 0) DESC)',
        confidence: 0.92,
        isAIGenerated: true,
        isApproved: false,
      },
      {
        id: 'mapping-orders.order_date-days_since_last_order',
        sourceColumn: 'orders.order_date',
        targetColumn: 'days_since_last_order',
        transformationType: 'custom',
        transformationExpression: 'DATEDIFF(day, MAX(o.order_date), CURRENT_DATE)',
        confidence: 0.91,
        isAIGenerated: true,
        isApproved: false,
      },
      {
        id: 'mapping-orders.amount-avg_order_value',
        sourceColumn: 'orders.amount',
        targetColumn: 'avg_order_value',
        transformationType: 'custom',
        transformationExpression:
          'CASE WHEN COUNT(DISTINCT o.order_id) > 0 THEN SUM(o.amount) / COUNT(DISTINCT o.order_id) ELSE 0 END',
        confidence: 0.94,
        isAIGenerated: true,
        isApproved: false,
      },

      // Business logic
      {
        id: 'mapping-created_at+orders.amount-customer_segment',
        sourceColumn: 'created_at, orders.amount',
        targetColumn: 'customer_segment',
        transformationType: 'custom',
        transformationExpression:
          "CASE WHEN COALESCE(SUM(o.amount), 0) >= 10000 THEN 'VIP' WHEN COALESCE(SUM(o.amount), 0) >= 5000 THEN 'Premium' WHEN COALESCE(SUM(o.amount), 0) >= 1000 THEN 'Standard' WHEN COUNT(DISTINCT o.order_id) > 0 THEN 'Active' ELSE 'Inactive' END",
        confidence: 0.89,
        isAIGenerated: true,
        isApproved: false,
      },
      {
        id: 'mapping-orders.order_date-is_active_last_90_days',
        sourceColumn: 'orders.order_date',
        targetColumn: 'is_active_last_90_days',
        transformationType: 'custom',
        transformationExpression:
          'CASE WHEN MAX(o.order_date) >= DATEADD(day, -90, CURRENT_DATE) THEN TRUE ELSE FALSE END',
        confidence: 0.96,
        isAIGenerated: true,
        isApproved: false,
      },
    ];

    return mappings;
  }

  /**
   * Generate reasoning for the complex mappings
   */
  private static generateReasoning(
    mappings: ColumnMapping[],
    feedback?: string
  ): string {
    let reasoning = `Analyzed ${mappings.length} column mappings with advanced SQL transformations including joins, aggregations, and window functions.\n\n`;

    reasoning += `**Multi-Table Join Strategy:**\n`;
    reasoning += `• Primary table: raw.customers (c)\n`;
    reasoning += `• LEFT JOIN raw.orders (o) - filtered for completed/shipped orders in last 2 years\n`;
    reasoning += `• LEFT JOIN raw.order_items (oi) - for quantity aggregations\n`;
    reasoning += `• Preserves all customers even without orders (LEFT JOIN)\n\n`;

    reasoning += `**Key Transformations:**\n`;
    reasoning += `• Direct Mappings: customer_id → id, email (normalized), phone (digits only)\n`;
    reasoning += `• Derived Column: CONCAT_WS for full_name with NULL safety and INITCAP\n`;
    reasoning += `• Aggregations: SUM(amount) for lifetime_value, COUNT orders, SUM quantities\n`;
    reasoning += `• Window Function: ROW_NUMBER() OVER for customer ranking by revenue\n`;
    reasoning += `• Analytics: Average order value with division-by-zero protection\n`;
    reasoning += `• Recency: DATEDIFF for days_since_last_order (churn prediction)\n\n`;

    reasoning += `**Business Logic:**\n`;
    reasoning += `• Customer Segmentation: VIP (≥$10k), Premium (≥$5k), Standard (≥$1k), Active, Inactive\n`;
    reasoning += `• Activity Flag: is_active_last_90_days for retention analysis\n`;
    reasoning += `• Data Quality Filters: Valid email, customers since 2020, blacklist exclusion\n\n`;

    reasoning += `**Performance Considerations:**\n`;
    reasoning += `• Used CTEs for clarity and potential query plan optimization\n`;
    reasoning += `• Window function may be expensive - consider materialized view\n`;
    reasoning += `• 2-year rolling window reduces data volume by ~15%\n`;
    reasoning += `• Recommended: Daily refresh with incremental loads\n`;

    if (feedback) {
      reasoning += `\n**Applied User Feedback:**\n${feedback}\n`;
    }

    reasoning += `\n✅ Confidence: 89-99% across mappings. Complex transformations validated.`;

    return reasoning;
  }

  /**
   * Regenerate mappings based on user feedback
   */
  static async regenerateMappings(
    originalRequest: LLMMapperRequest,
    feedback: string,
    _rejectedMappings?: ColumnMapping[]
  ): Promise<LLMMapperResponse> {
    const requestWithFeedback: LLMMapperRequest = {
      ...originalRequest,
      context: {
        ...originalRequest.context,
        previousFeedback: feedback,
      },
    };

    return this.generateMappings(requestWithFeedback);
  }
}
