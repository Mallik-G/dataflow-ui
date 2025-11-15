"""Database models for Unity Catalog metadata."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class CatalogMetadata(SQLModel, table=True):
    """
    Flat table storing all Unity Catalog metadata (catalogs, schemas, tables, columns, etc.)
    for fast bulk retrieval and LLM context.

    This table uses a single-table design with JSONB for flexibility, making it easy
    to provide complete catalog metadata in a single query with tags and privileges.
    """

    __tablename__ = "catalog_metadata"
    __table_args__ = (
        Index("idx_metadata_entity_type", "entity_type"),
        Index("idx_metadata_parent", "parent_path"),
        Index("idx_metadata_entity_path", "entity_path"),
        Index(
            "idx_metadata_jsonb",
            "metadata",
            postgresql_using="gin",
            postgresql_ops={"metadata": "jsonb_path_ops"},
        ),
    )

    # Primary key
    id: Optional[int] = Field(default=None, primary_key=True)

    # Entity identification
    entity_type: str = Field(
        sa_column=Column(String(50), nullable=False),
        description="Type of entity: 'catalog', 'schema', 'table', 'column', 'volume', 'function'",
    )
    entity_path: str = Field(
        sa_column=Column(String(1000), nullable=False),
        description="Full path to entity, e.g., 'main.bronze.customers.customer_id'",
    )
    entity_name: str = Field(
        sa_column=Column(String(500), nullable=False), description="Name of the entity"
    )
    parent_path: Optional[str] = Field(
        default=None,
        sa_column=Column(String(1000)),
        description="Path to parent entity, e.g., 'main.bronze.customers' for a column",
    )

    # Flexible metadata storage (all properties from system tables)
    metadata_json: dict = Field(
        sa_column=Column("metadata", JSONB, nullable=False),
        description="Complete metadata from Databricks system tables in JSONB format",
    )

    # Tracking
    synced_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime, nullable=False),
        description="When this record was last synced from Databricks",
    )
    is_active: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False),
        description="False if entity was deleted in Databricks since last sync",
    )

    class Config:
        """Pydantic configuration."""

        json_schema_extra = {
            "example": {
                "entity_type": "column",
                "entity_path": "main.bronze.customers.customer_id",
                "entity_name": "customer_id",
                "parent_path": "main.bronze.customers",
                "metadata": {
                    "table_catalog": "main",
                    "table_schema": "bronze",
                    "table_name": "customers",
                    "column_name": "customer_id",
                    "ordinal_position": 1,
                    "is_nullable": "NO",
                    "data_type": "BIGINT",
                    "column_comment": "Unique customer identifier",
                },
                "is_active": True,
            }
        }
