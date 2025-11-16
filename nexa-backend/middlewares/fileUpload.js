const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { mkdirSync, existsSync } = require("fs");

const MIME_TYPE_MAP = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/msword": "doc",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "text/csv": "csv",
};

const fileFilter = (req, file, callback) => {
  const isValid = !!MIME_TYPE_MAP[file.mimetype];
  let error = isValid ? null : new Error("Invalid mime type!");
  callback(error, isValid);
};

const localStorage = multer.diskStorage({
  destination: async (req, file, callback) => {
    if (req.user && req.user.id) {
      if (!existsSync(`uploads/images/${req.user.id}`))
        mkdirSync(`./uploads/images/${req.user.id}`, { recursive: true });
      callback(null, `uploads/images/${req.user.id}`);
    } else {
      const time = Date.now();
      req.user = { ...req.user, tempFolderName: time };
      if (!existsSync(`uploads/images/${time}`))
        mkdirSync(`./uploads/images/${time}`, { recursive: true });
      callback(null, `uploads/images/${time}`);
    }
  },

  filename: (req, file, callback) => {
    const ext = MIME_TYPE_MAP[file.mimetype];
    callback(null, uuidv4() + "." + ext);
  },
});

const fileUpload = multer({
  limits: 50000000,
  storage: localStorage,
  fileFilter,
});

module.exports = fileUpload;
