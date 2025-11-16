const { ConsumptionFileSchema } = require('../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

class ConsumptionFileSchemaService {
  /**
   * Save or update consumption file schema
   */
  static async saveConsumptionFileSchema(schemaData) {
    try {
      const {
        entityName,
        fileName,
        fileKey,
        fileLocation,
        fileSize,
        contentType,
        schemaAttributes,
        schemaMetadata,
        fileData,
        sourceEntities,
        joinRelationships,
        transformations,
        createdBy,
        updatedBy,
        notes,
      } = schemaData;

      // Generate unique schema ID
      const schemaId = `consumption_schema_${uuidv4()
        .replace(/-/g, '')
        .substring(0, 8)}`;

      // Check if schema already exists for this entity
      const existingSchema = await ConsumptionFileSchema.findOne({
        where: {
          entityName,
          status: {
            [Op.ne]: 'deleted',
          },
        },
      });

      let schema;

      if (existingSchema) {
        // Update existing schema
        schema = await existingSchema.update({
          fileName,
          fileKey,
          fileLocation,
          fileSize,
          contentType,
          schemaAttributes,
          schemaMetadata,
          fileData,
          sourceEntities,
          joinRelationships,
          transformations,
          schemaId: existingSchema.schemaId,
          updatedBy: updatedBy || createdBy || 'system',
          notes,
          lastProcessedAt: new Date(),
          processedCount: existingSchema.processedCount + 1,
        });
      } else {
        // Create new schema
        schema = await ConsumptionFileSchema.create({
          entityName,
          fileName,
          fileKey,
          fileLocation,
          fileSize,
          contentType,
          schemaAttributes,
          schemaMetadata,
          fileData,
          sourceEntities,
          joinRelationships,
          transformations,
          schemaId,
          createdBy: createdBy || 'system',
          updatedBy: updatedBy || createdBy || 'system',
          notes,
          lastProcessedAt: new Date(),
          processedCount: 1,
        });
      }

      return {
        success: true,
        schema: schema.toJSON(),
        message: existingSchema
          ? 'Consumption file schema updated successfully'
          : 'Consumption file schema saved successfully',
      };
    } catch (error) {
      console.error('Error saving consumption file schema:', error);
      throw error;
    }
  }

  /**
   * Get consumption file schema by entity name
   */
  static async getConsumptionFileSchema(entityName) {
    try {
      const schema = await ConsumptionFileSchema.findOne({
        where: {
          entityName,
          status: {
            [Op.ne]: 'deleted',
          },
        },
        order: [['updatedAt', 'DESC']],
      });

      return {
        success: true,
        schema: schema ? schema.toJSON() : null,
        message: schema
          ? 'Consumption file schema found'
          : 'No consumption file schema found for this entity',
      };
    } catch (error) {
      console.error('Error getting consumption file schema:', error);
      throw error;
    }
  }

  /**
   * Get all consumption file schemas with optional filtering
   */
  static async getAllConsumptionFileSchemas(filters = {}, pagination = {}) {
    try {
      const whereClause = {
        status: {
          [Op.ne]: 'deleted',
        },
      };

      // Handle search parameter - search in entityName and fileName
      if (filters.search) {
        whereClause[Op.or] = [
          {
            entityName: {
              [Op.iLike]: `%${filters.search}%`,
            },
          },
          {
            fileName: {
              [Op.iLike]: `%${filters.search}%`,
            },
          },
        ];
      }

      // Handle specific filters
      if (filters.entityName) {
        whereClause.entityName = {
          [Op.iLike]: `%${filters.entityName}%`,
        };
      }

      if (filters.status) {
        whereClause.status = filters.status;
      }

      if (filters.createdBy) {
        whereClause.createdBy = {
          [Op.iLike]: `%${filters.createdBy}%`,
        };
      }

      // Get total count for pagination
      const totalCount = await ConsumptionFileSchema.count({
        where: whereClause,
      });

      // Get paginated results
      const { page = 1, limit = 15, offset = 0 } = pagination;

      const schemas = await ConsumptionFileSchema.findAll({
        where: whereClause,
        order: [['updatedAt', 'DESC']],
        limit: limit,
        offset: offset,
      });

      return {
        success: true,
        schemas: schemas.map((schema) => schema.toJSON()),
        totalCount: totalCount,
        message: `Found ${
          schemas.length
        } consumption file schemas (page ${page} of ${Math.ceil(
          totalCount / limit
        )})`,
      };
    } catch (error) {
      console.error('Error getting all consumption file schemas:', error);
      throw error;
    }
  }

  /**
   * Update consumption file schema status
   */
  static async updateConsumptionFileSchemaStatus(entityName, status) {
    try {
      const schema = await ConsumptionFileSchema.findOne({
        where: {
          entityName,
          status: {
            [Op.ne]: 'deleted',
          },
        },
      });

      if (!schema) {
        return {
          success: false,
          message: 'Consumption file schema not found',
        };
      }

      await schema.update({
        status,
        updatedBy: 'system',
      });

      return {
        success: true,
        schema: schema.toJSON(),
        message: `Consumption file schema status updated to ${status}`,
      };
    } catch (error) {
      console.error('Error updating consumption file schema status:', error);
      throw error;
    }
  }

  /**
   * Delete consumption file schema (soft delete)
   */
  static async deleteConsumptionFileSchema(entityName) {
    try {
      const schema = await ConsumptionFileSchema.findOne({
        where: {
          entityName,
          status: {
            [Op.ne]: 'deleted',
          },
        },
      });

      if (!schema) {
        return {
          success: false,
          message: 'Consumption file schema not found',
        };
      }

      await schema.update({
        status: 'deleted',
        updatedBy: 'system',
      });

      return {
        success: true,
        message: 'Consumption file schema deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting consumption file schema:', error);
      throw error;
    }
  }

  /**
   * Get consumption file schema statistics
   */
  static async getConsumptionFileSchemaStats() {
    try {
      const totalSchemas = await ConsumptionFileSchema.count({
        where: {
          status: {
            [Op.ne]: 'deleted',
          },
        },
      });

      const activeSchemas = await ConsumptionFileSchema.count({
        where: {
          status: 'active',
        },
      });

      const archivedSchemas = await ConsumptionFileSchema.count({
        where: {
          status: 'archived',
        },
      });

      const recentSchemas = await ConsumptionFileSchema.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
          status: {
            [Op.ne]: 'deleted',
          },
        },
      });

      return {
        success: true,
        stats: {
          total: totalSchemas,
          active: activeSchemas,
          archived: archivedSchemas,
          recent: recentSchemas,
        },
        message: 'Consumption file schema statistics retrieved successfully',
      };
    } catch (error) {
      console.error('Error getting consumption file schema stats:', error);
      throw error;
    }
  }

  /**
   * Extract schema from file content
   */
  static extractSchemaFromContent(fileContent, fileName, contentType) {
    try {
      let schemaAttributes = [];
      let schemaMetadata = {};

      const ext = fileName.split('.').pop()?.toLowerCase();

      if (
        ext === 'csv' ||
        ext === 'tsv' ||
        contentType === 'text/csv' ||
        contentType === 'text/tab-separated-values'
      ) {
        // Parse CSV/TSV headers
        const lines = fileContent
          .split(/\r?\n/)
          .filter((line) => line.trim() !== '');

        if (lines.length > 0) {
          const firstLine = lines[0];
          let delimiter = ',';
          if (firstLine.includes('\t')) delimiter = '\t';
          else if (firstLine.includes(';')) delimiter = ';';

          const headers = firstLine
            .split(delimiter)
            .map((h) => h.trim().replace(/^"|"$/g, ''))
            .filter((h) => h.length > 0);

          // Extract sample data for metadata and data type analysis
          if (lines.length > 1) {
            const sampleRows = lines.slice(1, Math.min(101, lines.length));
            const sampleValues = sampleRows[0]
              .split(delimiter)
              .map((v) => v.trim().replace(/^"|"$/g, ''));

            // Determine data types for each column
            schemaAttributes = headers.map((header, index) => {
              const columnValues = sampleRows
                .map((row) => {
                  const values = row.split(delimiter);
                  return values[index]
                    ? values[index].trim().replace(/^"|"$/g, '')
                    : null;
                })
                .filter(
                  (val) => val !== undefined && val !== null && val !== ''
                );

              const dataType = this.determineDataType(columnValues);
              const description = this.generateColumnDescription(
                header,
                dataType
              );

              return {
                name: header,
                dataType: dataType.type,
                nullable: dataType.nullable,
                description: description,
                sampleValues: columnValues.slice(0, 5),
                statistics: dataType.statistics,
              };
            });

            schemaMetadata = {
              sampleValues: sampleValues.slice(0, 5), // First 5 values
              totalRows: lines.length - 1,
              delimiter: delimiter,
              fileType: 'csv',
              analyzedRows: sampleRows.length,
              dataTypes: schemaAttributes.map((attr) => ({
                column: attr.name,
                type: attr.dataType,
                nullable: attr.nullable,
                description: attr.description,
              })),
            };
          } else {
            // No data rows, just headers
            schemaAttributes = headers.map((header) => {
              const description = this.generateColumnDescription(header, {
                type: 'string',
                nullable: true,
              });
              return {
                name: header,
                dataType: 'string',
                nullable: true,
                description: description,
                sampleValues: [],
                statistics: {},
              };
            });

            schemaMetadata = {
              totalRows: 0,
              delimiter: delimiter,
              fileType: 'csv',
              analyzedRows: 0,
              dataTypes: schemaAttributes.map((attr) => ({
                column: attr.name,
                type: attr.dataType,
                nullable: attr.nullable,
                description: attr.description,
              })),
            };
          }
        }
      } else if (ext === 'json' || contentType === 'application/json') {
        // Parse JSON structure
        let json;
        try {
          if (typeof fileContent === 'object') {
            json = fileContent;
          } else {
            json = JSON.parse(fileContent);
          }

          if (Array.isArray(json) && json.length > 0) {
            const headers = Object.keys(json[0]);
            const sampleData = json.slice(0, Math.min(100, json.length));

            // Determine data types for each column
            schemaAttributes = headers.map((header) => {
              const columnValues = sampleData
                .map((row) => row[header])
                .filter((val) => val !== undefined && val !== null);

              const dataType = this.determineDataType(columnValues);
              const description = this.generateColumnDescription(
                header,
                dataType
              );

              return {
                name: header,
                dataType: dataType.type,
                nullable: dataType.nullable,
                description: description,
                sampleValues: columnValues.slice(0, 5),
                statistics: dataType.statistics,
              };
            });

            schemaMetadata = {
              sampleValues: Object.values(json[0]).slice(0, 5),
              totalRows: json.length,
              fileType: 'json',
              isArray: true,
              analyzedRows: sampleData.length,
              dataTypes: schemaAttributes.map((attr) => ({
                column: attr.name,
                type: attr.dataType,
                nullable: attr.nullable,
                description: attr.description,
              })),
            };
          } else if (typeof json === 'object') {
            const headers = Object.keys(json);
            const columnValues = Object.values(json);

            schemaAttributes = headers.map((header, index) => {
              const dataType = this.determineDataType([columnValues[index]]);
              const description = this.generateColumnDescription(
                header,
                dataType
              );

              return {
                name: header,
                dataType: dataType.type,
                nullable: dataType.nullable,
                description: description,
                sampleValues: [columnValues[index]],
                statistics: dataType.statistics,
              };
            });

            schemaMetadata = {
              sampleValues: Object.values(json).slice(0, 5),
              fileType: 'json',
              isArray: false,
              dataTypes: schemaAttributes.map((attr) => ({
                column: attr.name,
                type: attr.dataType,
                nullable: attr.nullable,
                description: attr.description,
              })),
            };
          }
        } catch (e) {
          console.error('Failed to parse JSON:', e);
          schemaAttributes = [
            {
              name: 'id',
              dataType: 'integer',
              nullable: false,
              description: 'Unique identifier for the record',
              sampleValues: [],
              statistics: {},
            },
            {
              name: 'name',
              dataType: 'string',
              nullable: true,
              description: 'Name or title of the record',
              sampleValues: [],
              statistics: {},
            },
            {
              name: 'type',
              dataType: 'string',
              nullable: true,
              description: 'Type or category of the record',
              sampleValues: [],
              statistics: {},
            },
            {
              name: 'created_at',
              dataType: 'datetime',
              nullable: true,
              description: 'Timestamp when the record was created',
              sampleValues: [],
              statistics: {},
            },
          ];
          schemaMetadata = {
            error: 'Failed to parse JSON structure',
            fileType: 'json',
            dataTypes: schemaAttributes.map((attr) => ({
              column: attr.name,
              type: attr.dataType,
              nullable: attr.nullable,
              description: attr.description,
            })),
          };
        }
      } else {
        // Default fallback
        schemaAttributes = [
          {
            name: 'id',
            dataType: 'integer',
            nullable: false,
            description: 'Unique identifier for the record',
            sampleValues: [],
            statistics: {},
          },
          {
            name: 'name',
            dataType: 'string',
            nullable: true,
            description: 'Name or title of the record',
            sampleValues: [],
            statistics: {},
          },
          {
            name: 'type',
            dataType: 'string',
            nullable: true,
            description: 'Type or category of the record',
            sampleValues: [],
            statistics: {},
          },
          {
            name: 'created_at',
            dataType: 'datetime',
            nullable: true,
            description: 'Timestamp when the record was created',
            sampleValues: [],
            statistics: {},
          },
        ];
        schemaMetadata = {
          error: 'Unsupported file type',
          fileType: ext || 'unknown',
          dataTypes: schemaAttributes.map((attr) => ({
            column: attr.name,
            type: attr.dataType,
            nullable: attr.nullable,
            description: attr.description,
          })),
        };
      }

      return {
        schemaAttributes,
        schemaMetadata,
      };
    } catch (error) {
      console.error('Error extracting schema from content:', error);
      const fallbackAttributes = [
        {
          name: 'id',
          dataType: 'integer',
          nullable: false,
          description: 'Unique identifier for the record',
          sampleValues: [],
          statistics: {},
        },
        {
          name: 'name',
          dataType: 'string',
          nullable: true,
          description: 'Name or title of the record',
          sampleValues: [],
          statistics: {},
        },
        {
          name: 'type',
          dataType: 'string',
          nullable: true,
          description: 'Type or category of the record',
          sampleValues: [],
          statistics: {},
        },
        {
          name: 'created_at',
          dataType: 'datetime',
          nullable: true,
          description: 'Timestamp when the record was created',
          sampleValues: [],
          statistics: {},
        },
      ];
      return {
        schemaAttributes: fallbackAttributes,
        schemaMetadata: {
          error: error.message,
          fileType: 'unknown',
          dataTypes: fallbackAttributes.map((attr) => ({
            column: attr.name,
            type: attr.dataType,
            nullable: attr.nullable,
            description: attr.description,
          })),
        },
      };
    }
  }

  /**
   * Determine data type based on sample values
   */
  static determineDataType(values) {
    if (!values || values.length === 0) {
      return { type: 'string', nullable: true, statistics: {} };
    }

    const nonNullValues = values.filter(
      (val) => val !== null && val !== undefined && val !== ''
    );
    const nullCount = values.length - nonNullValues.length;
    const nullable = nullCount > 0;

    if (nonNullValues.length === 0) {
      return { type: 'string', nullable: true, statistics: { nullCount } };
    }

    // Check for boolean
    const booleanValues = ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'];
    const isBoolean = nonNullValues.every((val) =>
      booleanValues.includes(val.toString().toLowerCase())
    );
    if (isBoolean) {
      return {
        type: 'boolean',
        nullable,
        statistics: {
          nullCount,
          trueCount: nonNullValues.filter((v) =>
            ['true', '1', 'yes', 'y'].includes(v.toString().toLowerCase())
          ).length,
          falseCount: nonNullValues.filter((v) =>
            ['false', '0', 'no', 'n'].includes(v.toString().toLowerCase())
          ).length,
        },
      };
    }

    // Check for integer
    const isInteger = nonNullValues.every((val) => {
      const num = Number(val);
      return !isNaN(num) && Number.isInteger(num);
    });
    if (isInteger) {
      const numbers = nonNullValues.map((val) => Number(val));
      return {
        type: 'integer',
        nullable,
        statistics: {
          nullCount,
          min: Math.min(...numbers),
          max: Math.max(...numbers),
          avg: numbers.reduce((a, b) => a + b, 0) / numbers.length,
        },
      };
    }

    // Check for decimal/float
    const isDecimal = nonNullValues.every((val) => {
      const num = Number(val);
      return !isNaN(num) && !Number.isInteger(num);
    });
    if (isDecimal) {
      const numbers = nonNullValues.map((val) => Number(val));
      return {
        type: 'decimal',
        nullable,
        statistics: {
          nullCount,
          min: Math.min(...numbers),
          max: Math.max(...numbers),
          avg: numbers.reduce((a, b) => a + b, 0) / numbers.length,
        },
      };
    }

    // Check for date/datetime
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
      /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO datetime
      /^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}/, // MM/DD/YYYY HH:MM
    ];

    const isDate = nonNullValues.every((val) => {
      const str = val.toString();
      return (
        datePatterns.some((pattern) => pattern.test(str)) ||
        !isNaN(Date.parse(str))
      );
    });
    if (isDate) {
      const dates = nonNullValues.map((val) => new Date(val));
      const validDates = dates.filter((date) => !isNaN(date.getTime()));
      return {
        type: 'datetime',
        nullable,
        statistics: {
          nullCount,
          minDate: validDates.length > 0 ? Math.min(...validDates) : null,
          maxDate: validDates.length > 0 ? Math.max(...validDates) : null,
        },
      };
    }

    // Default to string
    const uniqueValues = [...new Set(nonNullValues)];
    return {
      type: 'string',
      nullable,
      statistics: {
        nullCount,
        uniqueCount: uniqueValues.length,
        maxLength: Math.max(...nonNullValues.map((v) => v.toString().length)),
        minLength: Math.min(...nonNullValues.map((v) => v.toString().length)),
      },
    };
  }

  /**
   * Generate auto description for a column based on its name and data type
   */
  static generateColumnDescription(columnName, dataType) {
    const name = columnName.toLowerCase();
    const type = dataType.type;

    // Common patterns for column descriptions
    if (name.includes('id') || name.endsWith('_id')) {
      return `Unique identifier for the ${name
        .replace(/_id$/, '')
        .replace(/_/g, ' ')}`;
    }
    if (name.includes('name') || name.endsWith('_name')) {
      return `Name or title of the ${name
        .replace(/_name$/, '')
        .replace(/_/g, ' ')}`;
    }
    if (name.includes('email')) {
      return 'Email address of the user or contact';
    }
    if (name.includes('phone')) {
      return 'Phone number of the user or contact';
    }
    if (name.includes('address')) {
      return 'Physical address or location information';
    }
    if (name.includes('created') || name.includes('created_at')) {
      return 'Timestamp when the record was created';
    }
    if (name.includes('updated') || name.includes('updated_at')) {
      return 'Timestamp when the record was last updated';
    }
    if (name.includes('date')) {
      return 'Date information for the record';
    }
    if (name.includes('time')) {
      return 'Time information for the record';
    }
    if (
      name.includes('amount') ||
      name.includes('price') ||
      name.includes('cost')
    ) {
      return `Monetary ${
        type === 'decimal' ? 'amount' : 'value'
      } for the record`;
    }
    if (name.includes('quantity') || name.includes('count')) {
      return `Numeric ${type === 'integer' ? 'count' : 'quantity'} value`;
    }
    if (name.includes('status')) {
      return 'Current status or state of the record';
    }
    if (name.includes('type') || name.includes('category')) {
      return 'Classification or category of the record';
    }
    if (name.includes('description') || name.includes('desc')) {
      return 'Detailed description or notes about the record';
    }
    if (name.includes('url') || name.includes('link')) {
      return 'Web URL or link associated with the record';
    }
    if (name.includes('is_') || name.includes('has_')) {
      return `Boolean flag indicating whether the record ${name.replace(
        /^is_|has_/,
        ''
      )}`;
    }

    // Generic descriptions based on data type
    switch (type) {
      case 'boolean':
        return `Boolean flag for ${name.replace(/_/g, ' ')}`;
      case 'integer':
        return `Integer value for ${name.replace(/_/g, ' ')}`;
      case 'decimal':
        return `Decimal/numeric value for ${name.replace(/_/g, ' ')}`;
      case 'datetime':
        return `Date and time information for ${name.replace(/_/g, ' ')}`;
      case 'string':
      default:
        return `Text information for ${name.replace(/_/g, ' ')}`;
    }
  }
}

module.exports = ConsumptionFileSchemaService;
