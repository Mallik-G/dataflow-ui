# Databricks notebook source
"""
Nexa Pipeline Observability - DLT Pipeline
===========================================

This DLT pipeline processes event logs from all Nexa-deployed pipelines and creates
aggregated metrics tables for observability.

Architecture:
- BRONZE: dev.nexa_ops.dlt_raw_logs (read-only - all data is from our pipelines)
- SILVER: Event-type specific parsed tables (flow_progress, user_action, etc.)
- GOLD: Aggregated metrics tables (hourly, daily, health, quality, audit)

Key Insight: The 'details' field is a JSON STRING with different schemas per event_type.
We parse each event_type into its own silver table for cleaner processing.

Reference: https://docs.databricks.com/aws/en/ldp/monitor-event-log-schema

Author: Nexa Platform Team
"""

import dlt
from pyspark.sql import functions as F, Window
from pyspark.sql.types import *

# ============================================================================
# SILVER LAYER: Flow Progress Events (Performance & Data Quality)
# ============================================================================


@dlt.table(
    name="flow_progress_events",
    comment="Flow progress events with performance and data quality metrics",
    partition_cols=["event_date"],
)
def flow_progress_events():
    """
    Parse flow_progress events - captures flow execution metrics.
    Most useful for: performance tracking, data quality, backlog monitoring.
    """
    # Define schema for flow_progress details
    flow_progress_schema = StructType(
        [
            StructField("flow_id", StringType(), True),
            StructField("name", StringType(), True),
            StructField("flow_type", StringType(), True),
            StructField("status", StringType(), True),
            StructField("batch_id", LongType(), True),
            StructField("is_continuous", BooleanType(), True),
            StructField(
                "metrics",
                StructType(
                    [
                        StructField("num_input_rows", LongType(), True),
                        StructField("num_output_rows", LongType(), True),
                        StructField("num_target_rows", LongType(), True),
                        StructField("num_target_bytes", LongType(), True),
                        StructField("backlog_bytes", LongType(), True),
                        StructField("duration_ms", LongType(), True),
                    ]
                ),
                True,
            ),
            StructField(
                "data_quality",
                StructType(
                    [
                        StructField("dataset", StringType(), True),
                        StructField(
                            "expectations",
                            ArrayType(
                                StructType(
                                    [
                                        StructField("name", StringType(), True),
                                        StructField("passed_records", LongType(), True),
                                        StructField("failed_records", LongType(), True),
                                    ]
                                )
                            ),
                            True,
                        ),
                    ]
                ),
                True,
            ),
            StructField(
                "source_metrics",
                ArrayType(
                    StructType(
                        [
                            StructField("source_name", StringType(), True),
                            StructField("backlog_bytes", LongType(), True),
                            StructField("backlog_records", LongType(), True),
                            StructField("backlog_seconds", LongType(), True),
                        ]
                    )
                ),
                True,
            ),
        ]
    )

    return (
        spark.readStream.table("dev.nexa_ops.dlt_raw_logs")
        .filter(F.col("event_type") == "flow_progress")
        .select(
            F.col("id").alias("event_id"),
            F.col("timestamp").alias("event_time"),
            F.to_date(F.col("timestamp")).alias("event_date"),
            F.col("level"),
            F.col("message"),
            # Origin
            F.col("origin.pipeline_id").alias("pipeline_id"),
            F.col("origin.pipeline_name").alias("pipeline_name"),
            F.col("origin.update_id").alias("update_id"),
            # Parse details JSON
            F.from_json(F.col("details"), flow_progress_schema).alias("details_parsed"),
        )
        .select(
            "event_id",
            "event_time",
            "event_date",
            "level",
            "message",
            "pipeline_id",
            "pipeline_name",
            "update_id",
            # Flow info
            F.col("details_parsed.flow_id").alias("flow_id"),
            F.col("details_parsed.name").alias("flow_name"),
            F.col("details_parsed.flow_type").alias("flow_type"),
            F.col("details_parsed.status").alias("status"),
            F.col("details_parsed.batch_id").alias("batch_id"),
            F.col("details_parsed.is_continuous").alias("is_continuous"),
            # Metrics
            F.col("details_parsed.metrics.num_input_rows").alias("num_input_rows"),
            F.col("details_parsed.metrics.num_output_rows").alias("num_output_rows"),
            F.col("details_parsed.metrics.num_target_rows").alias("num_target_rows"),
            F.col("details_parsed.metrics.backlog_bytes").alias("backlog_bytes"),
            F.col("details_parsed.metrics.duration_ms").alias("duration_ms"),
            # Data quality
            F.col("details_parsed.data_quality.dataset").alias("dq_dataset"),
            F.col("details_parsed.data_quality.expectations").alias("dq_expectations"),
            # Source-level metrics (for per-source backlog tracking)
            F.col("details_parsed.source_metrics").alias("source_metrics"),
        )
    )


# ============================================================================
# SILVER LAYER: Update Progress Events (Pipeline Lifecycle)
# ============================================================================


@dlt.table(
    name="update_progress_events",
    comment="Pipeline update lifecycle events (starting, running, completed, failed)",
    partition_cols=["event_date"],
)
def update_progress_events():
    """
    Parse update_progress events - captures pipeline update lifecycle.
    Most useful for: tracking pipeline runs, failures, duration.
    """
    update_progress_schema = StructType(
        [
            StructField("state", StringType(), True),
            StructField("cancellation_cause", StringType(), True),
        ]
    )

    return (
        spark.readStream.table("dev.nexa_ops.dlt_raw_logs")
        .filter(F.col("event_type") == "update_progress")
        .select(
            F.col("id").alias("event_id"),
            F.col("timestamp").alias("event_time"),
            F.to_date(F.col("timestamp")).alias("event_date"),
            F.col("level"),
            F.col("message"),
            F.col("origin.pipeline_id").alias("pipeline_id"),
            F.col("origin.pipeline_name").alias("pipeline_name"),
            F.col("origin.update_id").alias("update_id"),
            F.from_json(F.col("details"), update_progress_schema).alias(
                "details_parsed"
            ),
        )
        .select(
            "event_id",
            "event_time",
            "event_date",
            "level",
            "message",
            "pipeline_id",
            "pipeline_name",
            "update_id",
            F.col("details_parsed.state").alias("state"),
            F.col("details_parsed.cancellation_cause").alias("cancellation_cause"),
        )
    )


# ============================================================================
# SILVER LAYER: User Action Events (Audit)
# ============================================================================


@dlt.table(
    name="user_action_events",
    comment="User action events for audit and governance",
    partition_cols=["event_date"],
)
def user_action_events():
    """
    Parse user_action events - captures user interactions with pipelines.
    Most useful for: audit logs, tracking who did what and when.
    """
    user_action_schema = StructType(
        [
            StructField("action", StringType(), True),
            StructField("user_name", StringType(), True),
            StructField("comment", StringType(), True),
        ]
    )

    return (
        spark.readStream.table("dev.nexa_ops.dlt_raw_logs")
        .filter(F.col("event_type") == "user_action")
        .select(
            F.col("id").alias("event_id"),
            F.col("timestamp").alias("event_time"),
            F.to_date(F.col("timestamp")).alias("event_date"),
            F.col("level"),
            F.col("message"),
            F.col("origin.pipeline_id").alias("pipeline_id"),
            F.col("origin.pipeline_name").alias("pipeline_name"),
            F.col("origin.user_id").alias(
                "origin_user_id"
            ),  # Changed from 'user' to 'user_id'
            F.from_json(F.col("details"), user_action_schema).alias("details_parsed"),
        )
        .select(
            "event_id",
            "event_time",
            "event_date",
            "level",
            "message",
            "pipeline_id",
            "pipeline_name",
            "origin_user_id",
            F.col("details_parsed.action").alias("action"),
            F.col("details_parsed.user_name").alias("user_name"),
            F.col("details_parsed.comment").alias("comment"),
        )
    )


# ============================================================================
# SILVER LAYER: Deprecation Events (Feature Warnings)
# ============================================================================


@dlt.table(
    name="deprecation_events",
    comment="Deprecation warnings for features that will be removed",
    partition_cols=["event_date"],
)
def deprecation_events():
    """
    Parse deprecation events - warns about deprecated features in use.
    Most useful for: proactive pipeline maintenance, upgrade planning.
    """
    deprecation_schema = StructType(
        [
            StructField("message", StringType(), True),
            StructField("deprecated_feature", StringType(), True),
        ]
    )

    return (
        spark.readStream.table("dev.nexa_ops.dlt_raw_logs")
        .filter(F.col("event_type") == "deprecation")
        .select(
            F.col("id").alias("event_id"),
            F.col("timestamp").alias("event_time"),
            F.to_date(F.col("timestamp")).alias("event_date"),
            F.col("level"),
            F.col("message"),
            F.col("origin.pipeline_id").alias("pipeline_id"),
            F.col("origin.pipeline_name").alias("pipeline_name"),
            F.from_json(F.col("details"), deprecation_schema).alias("details_parsed"),
        )
        .select(
            "event_id",
            "event_time",
            "event_date",
            "level",
            "message",
            "pipeline_id",
            "pipeline_name",
            F.col("details_parsed.message").alias("deprecation_message"),
            F.col("details_parsed.deprecated_feature").alias("deprecated_feature"),
        )
    )


# ============================================================================
# SILVER LAYER: Cluster Resources Events (Performance - Classic Compute)
# ============================================================================


@dlt.table(
    name="cluster_resources_events",
    comment="Cluster resource metrics for classic compute pipelines",
    partition_cols=["event_date"],
)
def cluster_resources_events():
    """
    Parse cluster_resources events - tracks resource utilization.
    Most useful for: cost optimization, right-sizing clusters.
    Only populated for classic compute (not serverless).
    """
    cluster_resources_schema = StructType(
        [
            StructField(
                "autoscale_info",
                StructType(
                    [
                        StructField("current_num_executors", IntegerType(), True),
                        StructField("min_num_executors", IntegerType(), True),
                        StructField("max_num_executors", IntegerType(), True),
                    ]
                ),
                True,
            ),
        ]
    )

    return (
        spark.readStream.table("dev.nexa_ops.dlt_raw_logs")
        .filter(F.col("event_type") == "cluster_resources")
        .select(
            F.col("id").alias("event_id"),
            F.col("timestamp").alias("event_time"),
            F.to_date(F.col("timestamp")).alias("event_date"),
            F.col("origin.pipeline_id").alias("pipeline_id"),
            F.col("origin.pipeline_name").alias("pipeline_name"),
            F.from_json(F.col("details"), cluster_resources_schema).alias(
                "details_parsed"
            ),
        )
        .select(
            "event_id",
            "event_time",
            "event_date",
            "pipeline_id",
            "pipeline_name",
            F.col("details_parsed.autoscale_info.current_num_executors").alias(
                "current_executors"
            ),
            F.col("details_parsed.autoscale_info.min_num_executors").alias(
                "min_executors"
            ),
            F.col("details_parsed.autoscale_info.max_num_executors").alias(
                "max_executors"
            ),
        )
    )


# ============================================================================
# SILVER LAYER: Operation Progress Events (Auto Loader, CDC, Backfill)
# ============================================================================


@dlt.table(
    name="operation_progress_events",
    comment="Operation progress for Auto Loader, CDC, and backfill tracking",
    partition_cols=["event_date"],
)
def operation_progress_events():
    """
    Parse operation_progress events - tracks long-running operations.
    Most useful for: Auto Loader monitoring, CDC tracking, backfill progress.
    """
    operation_progress_schema = StructType(
        [
            StructField("type", StringType(), True),  # AUTO_LOADER_LISTING, etc.
            StructField("status", StringType(), True),  # STARTED, COMPLETED, FAILED
            StructField("duration_ms", LongType(), True),
            StructField(
                "auto_loader_details",
                StructType(
                    [
                        StructField("num_files_listed", LongType(), True),
                        StructField("num_files_added", LongType(), True),
                        StructField("bytes_processed", LongType(), True),
                    ]
                ),
                True,
            ),
        ]
    )

    return (
        spark.readStream.table("dev.nexa_ops.dlt_raw_logs")
        .filter(F.col("event_type") == "operation_progress")
        .select(
            F.col("id").alias("event_id"),
            F.col("timestamp").alias("event_time"),
            F.to_date(F.col("timestamp")).alias("event_date"),
            F.col("level"),
            F.col("message"),
            F.col("origin.pipeline_id").alias("pipeline_id"),
            F.col("origin.pipeline_name").alias("pipeline_name"),
            F.col("origin.flow_name").alias("flow_name"),
            F.from_json(F.col("details"), operation_progress_schema).alias(
                "details_parsed"
            ),
        )
        .select(
            "event_id",
            "event_time",
            "event_date",
            "level",
            "message",
            "pipeline_id",
            "pipeline_name",
            "flow_name",
            F.col("details_parsed.type").alias("operation_type"),
            F.col("details_parsed.status").alias("status"),
            F.col("details_parsed.duration_ms").alias("duration_ms"),
            F.col("details_parsed.auto_loader_details.num_files_listed").alias(
                "files_listed"
            ),
            F.col("details_parsed.auto_loader_details.num_files_added").alias(
                "files_added"
            ),
            F.col("details_parsed.auto_loader_details.bytes_processed").alias(
                "bytes_processed"
            ),
        )
    )


# ============================================================================
# SILVER LAYER: Flow Definition Events (Data Lineage)
# ============================================================================


@dlt.table(
    name="flow_definition_events",
    comment="Flow definitions for lineage and DAG visualization",
    partition_cols=["event_date"],
)
def flow_definition_events():
    """
    Parse flow_definition events - captures DAG structure.
    Most useful for: data lineage, dependency tracking, impact analysis.
    """
    flow_definition_schema = StructType(
        [
            StructField("output_dataset", StringType(), True),
            StructField("input_datasets", ArrayType(StringType()), True),
            StructField("flow_type", StringType(), True),
            StructField("schema", StringType(), True),  # JSON schema
        ]
    )

    return (
        spark.readStream.table("dev.nexa_ops.dlt_raw_logs")
        .filter(F.col("event_type") == "flow_definition")
        .select(
            F.col("id").alias("event_id"),
            F.col("timestamp").alias("event_time"),
            F.to_date(F.col("timestamp")).alias("event_date"),
            F.col("level"),
            F.col("message"),
            F.col("origin.pipeline_id").alias("pipeline_id"),
            F.col("origin.pipeline_name").alias("pipeline_name"),
            F.col("origin.flow_id").alias("flow_id"),
            F.col("origin.flow_name").alias("flow_name"),
            F.from_json(F.col("details"), flow_definition_schema).alias(
                "details_parsed"
            ),
        )
        .select(
            "event_id",
            "event_time",
            "event_date",
            "level",
            "message",
            "pipeline_id",
            "pipeline_name",
            "flow_id",
            "flow_name",
            F.col("details_parsed.output_dataset").alias("output_dataset"),
            F.col("details_parsed.input_datasets").alias("input_datasets"),
            F.col("details_parsed.flow_type").alias("flow_type"),
            F.col("details_parsed.schema").alias("schema_json"),
        )
    )


# ============================================================================
# GOLD LAYER: Hourly Metrics
# ============================================================================


@dlt.table(
    name="dlt_pipeline_metrics_hourly",
    comment="Hourly rollup of pipeline performance metrics",
)
def pipeline_metrics_hourly():
    """
    Aggregate flow_progress events by hour.
    """
    return (
        dlt.read_stream("flow_progress_events")
        .withWatermark("event_time", "2 hours")
        .groupBy(
            F.window(F.col("event_time"), "1 hour").alias("hour_window"),
            "pipeline_id",
            "pipeline_name",
        )
        .agg(
            # Performance metrics
            F.count("*").alias("update_count"),
            F.sum(F.when(F.col("status") == "COMPLETED", 1).otherwise(0)).alias(
                "success_count"
            ),
            F.sum(F.when(F.col("level") == "ERROR", 1).otherwise(0)).alias(
                "failure_count"
            ),
            F.round(F.avg(F.col("duration_ms") / 60000.0), 2).alias("duration_avg_min"),
            F.round(F.max(F.col("duration_ms") / 60000.0), 2).alias("duration_max_min"),
            # Streaming metrics
            F.max(F.col("backlog_bytes") / 1073741824.0).alias("backlog_gb"),
            F.sum("num_output_rows").alias("records_processed"),
            # Metadata
            F.current_timestamp().alias("computed_at"),
        )
        .select(
            "pipeline_id",
            "pipeline_name",
            F.col("hour_window.start").alias("hour_start"),
            "update_count",
            "success_count",
            "failure_count",
            "duration_avg_min",
            "duration_max_min",
            "backlog_gb",
            "records_processed",
            "computed_at",
        )
    )


# ============================================================================
# GOLD LAYER: Daily Health Summary
# ============================================================================


@dlt.table(
    name="dlt_pipeline_health_summary",
    comment="Daily health status summary per pipeline",
)
def pipeline_health_summary():
    """
    Daily summary of pipeline health from update_progress events.
    """
    return (
        dlt.read_stream("update_progress_events")
        .withWatermark("event_time", "2 hours")
        .groupBy("event_date", "pipeline_id", "pipeline_name")
        .agg(
            # Run statistics
            F.count("*").alias("total_events"),
            F.sum(F.when(F.col("state") == "FAILED", 1).otherwise(0)).alias(
                "runs_failed"
            ),
            F.sum(F.when(F.col("state") == "COMPLETED", 1).otherwise(0)).alias(
                "runs_succeeded"
            ),
            F.count(F.when(F.col("state") == "INITIALIZING", 1)).alias("runs_started"),
            # Status tracking
            F.max("event_time").alias("last_update_time"),
            F.max(F.when(F.col("state") == "FAILED", F.col("event_time"))).alias(
                "last_failure_time"
            ),
            F.max(F.when(F.col("state") == "COMPLETED", F.col("event_time"))).alias(
                "last_success_time"
            ),
            F.current_timestamp().alias("computed_at"),
        )
    )


# ============================================================================
# GOLD LAYER: Daily Metrics (from Hourly)
# ============================================================================


@dlt.table(
    name="dlt_pipeline_metrics_daily", comment="Daily rollup of pipeline metrics"
)
def pipeline_metrics_daily():
    """
    Daily aggregation from hourly metrics.
    """
    return (
        dlt.read_stream("dlt_pipeline_metrics_hourly")
        .withColumn("date", F.to_date("hour_start"))
        .groupBy("date", "pipeline_id", "pipeline_name")
        .agg(
            # Performance metrics
            F.sum("update_count").alias("update_count"),
            F.sum("success_count").alias("success_count"),
            F.sum("failure_count").alias("failure_count"),
            F.round(
                F.sum("success_count")
                * 100.0
                / F.nullif(F.sum("success_count") + F.sum("failure_count"), F.lit(0)),
                2,
            ).alias("success_rate"),
            F.round(F.avg("duration_avg_min"), 2).alias("duration_avg_min"),
            F.max("duration_max_min").alias("duration_p95_min"),
            # Streaming metrics
            F.round(F.avg("backlog_gb"), 4).alias("backlog_avg_gb"),
            F.max("backlog_gb").alias("backlog_max_gb"),
            F.sum("records_processed").alias("records_processed"),
            F.current_timestamp().alias("computed_at"),
        )
    )


# ============================================================================
# GOLD LAYER: Data Quality Summary
# ============================================================================


@dlt.table(
    name="dlt_data_quality_summary",
    comment="Daily data quality metrics from expectations",
)
def data_quality_summary():
    """
    Aggregate data quality metrics from flow_progress events.
    """
    from pyspark.sql.functions import explode_outer

    return (
        dlt.read_stream("flow_progress_events")
        .withWatermark("event_time", "2 hours")
        .filter(F.col("dq_expectations").isNotNull())
        .withColumn("expectation", explode_outer("dq_expectations"))
        .groupBy("event_date", "pipeline_id", "pipeline_name", "dq_dataset")
        .agg(
            # Expectation counts
            F.count(F.col("expectation.name")).alias("expectations_defined"),
            F.sum(F.col("expectation.passed_records")).alias("passed_records"),
            F.sum(F.col("expectation.failed_records")).alias("failed_records"),
            # Calculate pass rate
            F.round(
                F.sum(F.col("expectation.passed_records"))
                * 100.0
                / F.nullif(
                    F.sum(F.col("expectation.passed_records"))
                    + F.sum(F.col("expectation.failed_records")),
                    F.lit(0),
                ),
                2,
            ).alias("avg_pass_rate"),
            # Failed expectations count
            F.count(F.when(F.col("expectation.failed_records") > 0, 1)).alias(
                "expectations_with_failures"
            ),
            F.current_timestamp().alias("computed_at"),
        )
    )


# ============================================================================
# GOLD LAYER: Audit Summary
# ============================================================================


@dlt.table(
    name="dlt_audit_summary", comment="Daily audit log of user actions on pipelines"
)
def audit_summary():
    """
    Track user actions for audit and governance.
    """
    return (
        dlt.read_stream("user_action_events")
        .withWatermark("event_time", "2 hours")
        .groupBy("event_date", "pipeline_id", "pipeline_name")
        .agg(
            # User activity
            F.count("*").alias("total_user_actions"),
            F.approx_count_distinct("user_name").alias("unique_users"),
            F.collect_set("action").alias("action_types"),
            F.collect_set("user_name").alias("users_list"),
            # Timestamps
            F.max("event_time").alias("last_modified_time"),
            F.min("event_time").alias("first_action_time"),
            F.current_timestamp().alias("computed_at"),
        )
    )


# ============================================================================
# GOLD LAYER: Deprecation Summary
# ============================================================================


@dlt.table(
    name="dlt_deprecation_summary",
    comment="Summary of deprecated features in use by each pipeline",
)
def deprecation_summary():
    """
    Track deprecated features for proactive maintenance.
    """
    return (
        dlt.read_stream("deprecation_events")
        .withWatermark("event_time", "2 hours")
        .groupBy("pipeline_id", "pipeline_name", "deprecated_feature")
        .agg(
            F.count("*").alias("warning_count"),
            F.max("event_time").alias("last_warning_time"),
            F.first("deprecation_message").alias("deprecation_message"),
            F.current_timestamp().alias("computed_at"),
        )
    )


# ============================================================================
# GOLD LAYER: Current Pipeline Health (Latest State)
# ============================================================================


@dlt.table(
    name="dlt_pipeline_health_current",
    comment="Current health status snapshot per pipeline (latest state)",
)
def pipeline_health_current():
    """
    Latest health status for each pipeline.
    """
    # Get latest summary per pipeline
    latest_summary = (
        dlt.read("dlt_pipeline_health_summary")
        .withColumn(
            "row_num",
            F.row_number().over(
                Window.partitionBy("pipeline_id").orderBy(F.desc("event_date"))
            ),
        )
        .filter(F.col("row_num") == 1)
    )

    return latest_summary.select(
        "pipeline_id",
        "pipeline_name",
        # Determine status
        F.when(F.col("runs_failed") > 0, "critical")
        .when(F.datediff(F.current_date(), F.col("event_date")) > 1, "stale")
        .otherwise("healthy")
        .alias("status"),
        # Calculate health score (0-100)
        F.round(
            F.when(
                F.col("runs_started") > 0,
                F.least(
                    F.lit(100),
                    (F.col("runs_succeeded") * 100.0 / F.col("runs_started")),
                ),
            ).otherwise(F.lit(0)),
            2,
        ).alias("health_score"),
        # Timestamps
        "last_update_time",
        "last_success_time",
        "last_failure_time",
        # Calculate consecutive failures
        F.when(
            (F.col("last_failure_time").isNotNull())
            & (
                (F.col("last_success_time").isNull())
                | (F.col("last_failure_time") > F.col("last_success_time"))
            ),
            F.col("runs_failed"),
        )
        .otherwise(0)
        .alias("consecutive_failures"),
        # Flags
        F.when(F.datediff(F.current_timestamp(), F.col("last_update_time")) > 1, True)
        .otherwise(False)
        .alias("is_stale"),
        F.lit(False).alias("has_cost_anomaly"),
        F.lit(False).alias("has_quality_issues"),
        F.lit(False).alias("has_performance_issues"),
        F.current_timestamp().alias("updated_at"),
    )


# ============================================================================
# GOLD LAYER: Data Lineage Graph
# ============================================================================


@dlt.table(
    name="dlt_lineage_graph", comment="Data lineage graph showing dataset dependencies"
)
def lineage_graph():
    """
    Create lineage graph from flow_definition events.
    Each row represents a dependency: input_dataset -> output_dataset.
    """
    from pyspark.sql.functions import explode_outer

    return (
        dlt.read_stream("flow_definition_events")
        .withWatermark("event_time", "2 hours")
        .withColumn("input_dataset", explode_outer("input_datasets"))
        .groupBy(
            "pipeline_id",
            "pipeline_name",
            "flow_name",
            "output_dataset",
            "input_dataset",
            "flow_type",
        )
        .agg(
            F.max("event_time").alias("last_seen"),
            F.current_timestamp().alias("computed_at"),
        )
    )


# ============================================================================
# GOLD LAYER: Auto Loader Summary
# ============================================================================


@dlt.table(
    name="dlt_autoloader_summary",
    comment="Daily summary of Auto Loader file processing metrics",
)
def autoloader_summary():
    """
    Aggregate Auto Loader metrics from operation_progress events.
    """
    return (
        dlt.read_stream("operation_progress_events")
        .withWatermark("event_time", "2 hours")
        .filter(F.col("operation_type").like("%AUTO_LOADER%"))
        .groupBy("event_date", "pipeline_id", "pipeline_name", "flow_name")
        .agg(
            # Auto Loader metrics
            F.sum("files_listed").alias("total_files_listed"),
            F.sum("files_added").alias("total_files_added"),
            F.round(F.sum("bytes_processed") / 1073741824.0, 4).alias(
                "total_gb_processed"
            ),
            F.count(F.when(F.col("status") == "FAILED", 1)).alias("failed_operations"),
            F.round(F.avg("duration_ms") / 1000.0, 2).alias("avg_duration_sec"),
            F.current_timestamp().alias("computed_at"),
        )
    )


# ============================================================================
# GOLD LAYER: Source-Level Backlog Summary
# ============================================================================


@dlt.table(
    name="dlt_source_backlog_summary",
    comment="Per-source backlog metrics for detailed streaming monitoring",
)
def source_backlog_summary():
    """
    Track backlog per source (Kafka topic, S3 path, etc.) for detailed monitoring.
    """
    from pyspark.sql.functions import explode_outer

    return (
        dlt.read_stream("flow_progress_events")
        .withWatermark("event_time", "2 hours")
        .filter(F.col("source_metrics").isNotNull())
        .withColumn("source_metric", explode_outer("source_metrics"))
        .groupBy(
            "event_date",
            "pipeline_id",
            "pipeline_name",
            "flow_name",
            F.col("source_metric.source_name").alias("source_name"),
        )
        .agg(
            # Backlog metrics per source
            F.max(F.col("source_metric.backlog_bytes") / 1073741824.0).alias(
                "max_backlog_gb"
            ),
            F.avg(F.col("source_metric.backlog_bytes") / 1073741824.0).alias(
                "avg_backlog_gb"
            ),
            F.max(F.col("source_metric.backlog_records")).alias("max_backlog_records"),
            F.max(F.col("source_metric.backlog_seconds") / 3600.0).alias(
                "max_backlog_hours"
            ),
            F.avg(F.col("source_metric.backlog_seconds") / 3600.0).alias(
                "avg_backlog_hours"
            ),
            F.current_timestamp().alias("computed_at"),
        )
    )


# COMMAND ----------
# MAGIC %md
# MAGIC ## Test Queries
# MAGIC
# MAGIC Uncomment to test after pipeline runs:

# COMMAND ----------
# -- Test: View flow progress events
# SELECT * FROM dev.nexa_ops.flow_progress_events ORDER BY event_time DESC LIMIT 10;

# COMMAND ----------
# -- Test: View hourly metrics
# SELECT * FROM dev.nexa_ops.dlt_pipeline_metrics_hourly ORDER BY hour_start DESC LIMIT 10;

# COMMAND ----------
# -- Test: View current pipeline health
# SELECT * FROM dev.nexa_ops.dlt_pipeline_health_current;

# COMMAND ----------
# -- Test: View data quality summary
# SELECT * FROM dev.nexa_ops.dlt_data_quality_summary ORDER BY event_date DESC LIMIT 10;

# COMMAND ----------
# -- Test: View deprecation warnings
# SELECT * FROM dev.nexa_ops.dlt_deprecation_summary;
