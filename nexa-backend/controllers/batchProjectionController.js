const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const BatchProjectionService = require('../services/batchProjectionService');

// Configure AWS
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Helper function to read CSV data from S3
const readCSVFromS3 = async (bucket, key) => {
  try {
    const params = {
      Bucket: bucket,
      Key: key,
    };

    const data = await s3.getObject(params).promise();
    const csvContent = data.Body.toString('utf-8');
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i]
          .split(',')
          .map((v) => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rows.push(row);
      }
    }

    return { headers, rows };
  } catch (error) {
    console.error('Error reading CSV from S3:', error);
    throw error;
  }
};

// Helper function to read AI-generated data
const readAIData = async (entityName) => {
  try {
    const dataDir = path.join(__dirname, '../data');

    // Special handling for gold_customers_360 and products_360
    if (entityName === 'gold_customers_360') {
      const [customers, orders, reviews] = await Promise.all([
        new Promise((resolve, reject) => {
          const results = [];
          fs.createReadStream(path.join(dataDir, 'customers.csv'))
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
        }),
        new Promise((resolve, reject) => {
          const results = [];
          fs.createReadStream(path.join(dataDir, 'orders.csv'))
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
        }),
        new Promise((resolve, reject) => {
          const results = [];
          fs.createReadStream(path.join(dataDir, 'customer_reviews.csv'))
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
        }),
      ]);

      // Generate gold customers 360 data
      const premiumCustomers = customers.filter(
        (c) => c.membership_level === 'Premium' && c.is_active === 'true'
      );

      const goldData = premiumCustomers.map((customer) => {
        const customerOrders = orders.filter(
          (o) => o.customer_id === customer.customer_id
        );
        const customerReviews = reviews.filter(
          (r) => r.customer_id === customer.customer_id
        );

        return {
          customer_id: customer.customer_id,
          customer_name: customer.customer_name,
          email: customer.email,
          city: customer.city,
          state: customer.state,
          membership_level: customer.membership_level,
          total_orders: customerOrders.length,
          total_spent: customerOrders
            .reduce(
              (sum, order) => sum + parseFloat(order.total_amount || 0),
              0
            )
            .toFixed(2),
          last_order_date:
            customerOrders.length > 0
              ? customerOrders.reduce(
                  (latest, order) =>
                    new Date(order.order_date) > new Date(latest)
                      ? order.order_date
                      : latest,
                  customerOrders[0].order_date
                )
              : '',
          avg_rating:
            customerReviews.length > 0
              ? (
                  customerReviews.reduce(
                    (sum, review) => sum + parseFloat(review.rating || 0),
                    0
                  ) / customerReviews.length
                ).toFixed(2)
              : '0.00',
        };
      });

      return {
        headers: Object.keys(goldData[0] || {}),
        rows: goldData,
      };
    } else if (entityName === 'products_360') {
      const [products, orderItems, reviews, inventory] = await Promise.all([
        new Promise((resolve, reject) => {
          const results = [];
          fs.createReadStream(path.join(dataDir, 'products.csv'))
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
        }),
        new Promise((resolve, reject) => {
          const results = [];
          fs.createReadStream(path.join(dataDir, 'order_items.csv'))
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
        }),
        new Promise((resolve, reject) => {
          const results = [];
          fs.createReadStream(path.join(dataDir, 'customer_reviews.csv'))
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
        }),
        new Promise((resolve, reject) => {
          const results = [];
          fs.createReadStream(path.join(dataDir, 'product_inventory.csv'))
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
        }),
      ]);

      const prodData = products.map((product) => {
        const productOrderItems = orderItems.filter(
          (oi) => oi.product_id === product.product_id
        );
        const productReviews = reviews.filter(
          (r) => r.product_id === product.product_id
        );
        const productInventory = inventory.find(
          (inv) => inv.product_id === product.product_id
        );

        return {
          product_id: product.product_id,
          product_name: product.product_name,
          category: product.category,
          brand: product.brand,
          price: product.price,
          total_sold: productOrderItems.reduce(
            (sum, item) => sum + parseInt(item.quantity || 0),
            0
          ),
          avg_rating:
            productReviews.length > 0
              ? (
                  productReviews.reduce(
                    (sum, review) => sum + parseFloat(review.rating || 0),
                    0
                  ) / productReviews.length
                ).toFixed(2)
              : '0.00',
          inventory_available: productInventory
            ? parseInt(productInventory.quantity_available || 0)
            : 0,
          last_restock_date: productInventory
            ? productInventory.last_restock_date
            : '',
        };
      });

      return {
        headers: Object.keys(prodData[0] || {}),
        rows: prodData,
      };
    }

    // For all other AI entities, read from the consumptionfiles directory
    const consumptionFilesDir = path.join(dataDir, 'consumptionfiles');
    const filePath = path.join(consumptionFilesDir, `${entityName}.csv`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`AI entity file not found: ${entityName}.csv`);
    }

    const results = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    if (results.length === 0) {
      throw new Error(`No data found in AI entity file: ${entityName}.csv`);
    }

    return {
      headers: Object.keys(results[0]),
      rows: results,
    };
  } catch (error) {
    console.error('Error reading AI data:', error);
    throw error;
  }
};

// Helper function to convert data to different formats
const convertToFormat = (data, format, compression) => {
  const { headers, rows } = data;

  if (format === 'CSV') {
    let csvContent = headers.join(',') + '\n';
    rows.forEach((row) => {
      const values = headers.map((header) => {
        const value = row[header] || '';
        return `"${value}"`;
      });
      csvContent += values.join(',') + '\n';
    });
    return csvContent;
  } else if (format === 'JSON') {
    return JSON.stringify(rows, null, 2);
  } else if (format === 'Parquet') {
    // For simplicity, we'll return CSV for now since Parquet requires additional libraries
    // In production, you'd use a library like 'parquetjs' or 'apache-arrow'
    let csvContent = headers.join(',') + '\n';
    rows.forEach((row) => {
      const values = headers.map((header) => {
        const value = row[header] || '';
        return `"${value}"`;
      });
      csvContent += values.join(',') + '\n';
    });
    return csvContent;
  }

  throw new Error(`Unsupported format: ${format}`);
};

// Test projection endpoint
const testProjection = async (req, res) => {
  try {
    const { entityName, selectedEntities, settings, isTest } = req.body;

    console.log('Testing projection for:', entityName);
    console.log('Selected entities:', Object.keys(selectedEntities));
    console.log('Settings:', settings);

    const results = [];
    let totalRecords = 0;

    // Process each selected entity
    for (const [entityKey, entityData] of Object.entries(selectedEntities)) {
      const { entity, attributes, source } = entityData;

      console.log(
        `Processing ${entityKey} (${source}) with attributes:`,
        attributes
      );

      let data;

      if (source === 'AI') {
        data = await readAIData(entityKey);
      } else {
        // S3 source
        const s3Data = await readCSVFromS3(
          process.env.AWS_S3_BUCKET_NAME,
          entity.key
        );
        data = s3Data;
      }

      // Filter data to only include selected attributes
      const filteredRows = data.rows.map((row) => {
        const filteredRow = {};
        attributes.forEach((attr) => {
          if (data.headers.includes(attr)) {
            filteredRow[attr] = row[attr];
          }
        });
        return filteredRow;
      });

      const filteredData = {
        headers: attributes.filter((attr) => data.headers.includes(attr)),
        rows: filteredRows,
      };

      results.push({
        entity: entityKey,
        data: filteredData,
        recordCount: filteredRows.length,
      });

      totalRecords += filteredRows.length;
    }

    // Generate separate files for each selected entity
    if (results.length === 0) {
      throw new Error('No data to project');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = settings.outputFormat.toLowerCase();
    const generatedFiles = [];

    // Generate a file for each selected entity
    for (const result of results) {
      const projectionData = result.data;

      // Convert to requested format
      const formattedData = convertToFormat(
        projectionData,
        settings.outputFormat,
        settings.compression
      );

      // Generate filename for this entity
      const filename = `projection_${result.entity}_${timestamp}.${extension}`;
      const s3Key = `projections/${filename}`;

      // Upload to S3
      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: s3Key,
        Body: formattedData,
        ContentType:
          settings.outputFormat === 'JSON' ? 'application/json' : 'text/csv',
        Metadata: {
          'entity-name': result.entity,
          'projection-type': isTest ? 'test' : 'scheduled',
          'output-format': settings.outputFormat,
          compression: settings.compression,
          'record-count': result.recordCount.toString(),
          'generated-at': new Date().toISOString(),
        },
      };

      const uploadResult = await s3.upload(uploadParams).promise();

      console.log(
        `Projection file for ${result.entity} uploaded successfully:`,
        uploadResult.Location
      );

      generatedFiles.push({
        entity: result.entity,
        fileUrl: uploadResult.Location,
        recordCount: result.recordCount,
        fileSize: `${(formattedData.length / 1024).toFixed(2)} KB`,
        filename: filename,
        s3Key: s3Key,
      });
    }

    res.json({
      success: true,
      message: `Test projection completed successfully. Generated ${results.length} files with ${totalRecords} total records.`,
      files: generatedFiles,
      totalRecordCount: totalRecords,
      totalFileCount: results.length,
    });
  } catch (error) {
    console.error('Test projection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test projection',
      error: error.message,
    });
  }
};

// Save batch projection settings
const saveProjectionSettings = async (req, res) => {
  try {
    const { entityName, selectedEntities, settings, schedule, output } =
      req.body;

    console.log('Saving projection settings for:', entityName);
    console.log('Schedule:', schedule);
    console.log('Output:', output);

    // Calculate next run time based on schedule
    let nextRunAt = null;
    if (schedule && schedule.enabled) {
      // For now, set next run to 1 hour from now
      // In production, you'd calculate based on cron expression
      nextRunAt = new Date(Date.now() + 60 * 60 * 1000);
    }

    const projectionData = {
      entityName,
      selectedEntities,
      settings,
      schedule,
      output,
      createdBy: req.user?.id || 'system',
      updatedBy: req.user?.id || 'system',
    };

    const result = await BatchProjectionService.createProjection(
      projectionData
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Batch projection settings saved successfully',
        projectionId: result.projection.id,
        projection: result.projection,
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to save projection settings',
        error: result.message,
      });
    }
  } catch (error) {
    console.error('Save settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save projection settings',
      error: error.message,
    });
  }
};

// Get all projection settings
const getProjectionSettings = async (req, res) => {
  try {
    const { status, entityName, createdBy } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (entityName) filters.entityName = entityName;
    if (createdBy) filters.createdBy = createdBy;

    const result = await BatchProjectionService.getAllProjections(filters);

    res.json({
      success: true,
      projections: result.projections,
      total: result.total,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get projection settings',
      error: error.message,
    });
  }
};

// Delete projection settings
const deleteProjectionSettings = async (req, res) => {
  try {
    const { projectionId } = req.params;

    const result = await BatchProjectionService.deleteProjection(projectionId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Projection settings deleted successfully',
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error('Delete settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete projection settings',
      error: error.message,
    });
  }
};

// Get a single projection by ID
const getProjectionById = async (req, res) => {
  try {
    const { projectionId } = req.params;

    const result = await BatchProjectionService.getProjectionById(projectionId);

    if (result.success) {
      res.json({
        success: true,
        projection: result.projection,
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error('Get projection by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get projection',
      error: error.message,
    });
  }
};

// Update projection settings
const updateProjectionSettings = async (req, res) => {
  try {
    const { projectionId } = req.params;
    const updateData = req.body;

    // Calculate next run time if schedule is being updated
    if (updateData.schedule && updateData.schedule.enabled) {
      updateData.nextRunAt = new Date(Date.now() + 60 * 60 * 1000);
    }

    updateData.updatedBy = req.user?.id || 'system';

    const result = await BatchProjectionService.updateProjection(
      projectionId,
      updateData
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Projection settings updated successfully',
        projection: result.projection,
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update projection settings',
      error: error.message,
    });
  }
};

// Update projection status
const updateProjectionStatus = async (req, res) => {
  try {
    const { projectionId } = req.params;
    const { status } = req.body;

    const result = await BatchProjectionService.updateStatus(
      projectionId,
      status,
      req.user?.id || 'system'
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Projection status updated successfully',
        projection: result.projection,
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update projection status',
      error: error.message,
    });
  }
};

// Get projection statistics
const getProjectionStats = async (req, res) => {
  try {
    const result = await BatchProjectionService.getProjectionStats();

    res.json({
      success: true,
      stats: result.stats,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get projection statistics',
      error: error.message,
    });
  }
};

module.exports = {
  testProjection,
  saveProjectionSettings,
  getProjectionSettings,
  getProjectionById,
  updateProjectionSettings,
  updateProjectionStatus,
  deleteProjectionSettings,
  getProjectionStats,
};
