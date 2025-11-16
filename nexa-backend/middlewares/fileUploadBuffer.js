const multer = require('multer');

// Memory storage - files are stored in memory as buffers
const memoryStorage = multer.memoryStorage();

// MIME type mapping for validation
const MIME_TYPE_MAP = {
  'text/csv': 'csv',
  'application/json': 'json',
  'text/tab-separated-values': 'tsv',
};

const fileFilter = (req, file, callback) => {
  // Check MIME type first
  const isValidMimeType = !!MIME_TYPE_MAP[file.mimetype];

  // If MIME type is not valid, check file extension as fallback
  if (!isValidMimeType) {
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    const validExtensions = ['csv', 'json', 'tsv'];
    const isValidExtension = validExtensions.includes(fileExtension);

    if (isValidExtension) {
      // Accept the file even if MIME type is wrong
      callback(null, true);
      return;
    }
  }

  const error = isValidMimeType
    ? null
    : new Error(
        'Invalid mime type! Only .csv, .json, and .tsv files are allowed.'
      );
  callback(error, isValidMimeType);
};

const fileUploadBuffer = multer({
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  storage: memoryStorage,
  fileFilter,
});

module.exports = fileUploadBuffer;
