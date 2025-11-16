import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Form, Row, Col } from "react-bootstrap";
import axios from "axios";
import {
  BiUpload,
  BiSolidCheckCircle,
  BiSolidXCircle,
  BiTrashAlt,
  BiTrash,
} from "react-icons/bi";

// Upload file to backend /api/upload endpoint
async function uploadFileToBackend(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axios.post("/api/extract-schema", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
}

function WelcomeDemoPage({ userName = "Amit" }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileData, setFileData] = useState([]);
  const [rawEntities, setRawEntities] = useState([]);
  const [curatedEntities, setCuratedEntities] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [allFilesUploaded, setAllFilesUploaded] = useState(false);
  const [multiUploading, setMultiUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Calculate how many file slots are available
  const uploadedCount = uploadedFiles.length;
  const filesToUploadCount = files.filter(
    (f) => !uploadedFiles.includes(f.name)
  ).length;

  // Handle multi-file selection
  const handleMultiFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    processSelectedFiles(selectedFiles);
    // Clear the file input
    e.target.value = "";
  };

  // Process selected files (used by both drag-drop and file input)
  const processSelectedFiles = (selectedFiles) => {
    // Filter for allowed file types
    const allowedFiles = selectedFiles.filter((file) => {
      const extension = file.name.toLowerCase().split(".").pop();
      return ["csv", "json", "tsv"].includes(extension);
    });

    if (allowedFiles.length !== selectedFiles.length) {
      alert(
        "Some files were skipped. Only .csv, .json, and .tsv files are allowed."
      );
    }

    if (allowedFiles.length === 0) return;

    // Add new files to the existing array
    setFiles((prevFiles) => [...prevFiles, ...allowedFiles]);

    // Reset status for newly added files
    const newStatus = { ...uploadStatus };
    allowedFiles.forEach((file) => {
      newStatus[file.name] = "";
    });
    setUploadStatus(newStatus);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    processSelectedFiles(droppedFiles);
  };

  const handleDropzoneClick = () => {
    fileInputRef.current?.click();
  };

  // Handle multi-file upload
  const handleMultiUpload = async () => {
    // Get files that are selected but not yet uploaded
    const filesToUpload = files.filter((f) => !uploadedFiles.includes(f.name));

    console.log("Files to upload:", filesToUpload);
    console.log("All files:", files);
    console.log("Uploaded files:", uploadedFiles);

    if (filesToUpload.length === 0) {
      alert("No new files to extract schemas from.");
      return;
    }

    setMultiUploading(true);

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];

        // Set uploading state for this specific file
        setUploading(true);
        setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));

        const formData = new FormData();
        formData.append("file", file);

        const response = await axios.post("/api/extract-schema", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress((prev) => ({
              ...prev,
              [file.name]: percentCompleted,
            }));
          },
        });

        console.log("Upload response:", response.data);

        // Update file data
        setFileData((prev) => [...prev, response.data]);

        // Update uploaded files
        setUploadedFiles((prev) => {
          const newFiles = [...prev, file.name];
          // Check if at least one file is uploaded
          setAllFilesUploaded(newFiles.length > 0);
          return newFiles;
        });

        // Update entity names
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        setRawEntities((prev) => [...prev, `raw.${baseName}`]);
        setCuratedEntities((prev) => [...prev, `curated.${baseName}`]);

        // Update upload status
        setUploadStatus((prev) => ({
          ...prev,
          [file.name]: "Schema extracted!",
        }));

        // Reset uploading state for this specific file
        setUploading(false);
        setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));
      }
    } catch (error) {
      console.error("Schema extraction failed:", error);

      // Update status for failed files
      filesToUpload.forEach((file) => {
        setUploadStatus((prev) => ({
          ...prev,
          [file.name]: "Failed to extract schema",
        }));
      });

      alert("Some files failed to extract schemas. Please try again.");
    } finally {
      setMultiUploading(false);
    }
  };

  // Remove file from the list
  const removeFile = (fileName) => {
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
    setUploadedFiles((prev) => prev.filter((f) => f !== fileName));
    setFileData((prev) => prev.filter((f) => f.filename !== fileName));
    setRawEntities((prev) =>
      prev.filter((_, index) => {
        const baseName = fileName.replace(/\.[^/.]+$/, "");
        return !prev[index]?.includes(`raw.${baseName}`);
      })
    );
    setCuratedEntities((prev) =>
      prev.filter((_, index) => {
        const baseName = fileName.replace(/\.[^/.]+$/, "");
        return !prev[index]?.includes(`curated.${baseName}`);
      })
    );
    setUploadStatus((prev) => {
      const newStatus = { ...prev };
      delete newStatus[fileName];
      return newStatus;
    });
  };

  function handleUpload(e) {
    e.preventDefault();
    alert(
      "Bulk upload is not supported. Please use the upload button next to each file."
    );
  }

  const handleNext = () => {
    // Check if at least one file is uploaded
    if (uploadedFiles.length === 0) {
      alert("Please extract schemas from at least one file before proceeding.");
      return;
    }

    navigate("/curated_landing_zone", {
      state: {
        uploadedFiles: uploadedFiles,
        fileData: fileData,
        rawEntities: rawEntities,
        curatedEntities: curatedEntities,
      },
    });
  };

  useEffect(() => {
    fetchSchemasFromDatabase();
  }, []);

  const fetchSchemasFromDatabase = async (page = 1, limit = 5) => {
    try {
      // Build query parameters for pagination and search
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      // Use the raw schemas endpoint with pagination
      const response = await axios.get(`/api/raw-schemas?${params.toString()}`);
      console.log("response:", response);

      if (response.data && response.data.success) {
        const totalCount = response.data.totalCount || 0;

        if (totalCount > 0) {
          navigate("/curated_landing_zone");
        }
      }
    } catch (err) {
      console.error("Failed to fetch schemas from database:", err);
    }
  };

  return (
    <>
      <h1 className="h3 fw-medium">Data Flow</h1>
      <p>{userName}, your DR Playground in Ready</p>

      <div className="alert alert-info" role="alert">
        <strong>Schema Extraction Mode:</strong> Files are processed to extract
        their schema and data types automatically. The actual file content is
        not saved - only the schema information is stored in the database for
        data processing workflows.
      </div>

      <div className="mt-4 mb-1 d-flex justify-content-between align-items-center">
        <h3 className="medium fs-6 m-0">
          Schema Extraction ({uploadedCount} schemas extracted, {files.length}{" "}
          total files)
        </h3>
        <Form.Text className="opacity-75 small text-end mb-3 d-block">
          Supported formats: .csv, .json, .tsv
        </Form.Text>
      </div>
      <Row>
        <Col>
          {/* Multi-file upload section */}

          {/* Drag and Drop Zone */}
          <div
            className="rounded p-4 text-center d-flex flex-column justify-content-center h-100"
            style={{
              border: `2px dashed ${isDragOver ? "#7366ff" : "#aaa"}`,
              background: isDragOver ? "#f0f0ff" : "#fafafa",
              cursor: "pointer",
              transition: "all 0.2s ease",
              minHeight: "300px",
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleDropzoneClick}
          >
            <div className="drop-icon mb-4">
              <BiUpload fontSize={60} opacity={0.4} />
            </div>
            <h5 className="fw-semi-bold text-large m-0">
              {isDragOver ? "Drop files here" : "Drag & drop files here"}
            </h5>
            <small>
              or click to browse files (schemas will be extracted automatically)
            </small>
          </div>

          {/* Hidden file input for drag zone */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv,.json,.tsv"
            onChange={handleMultiFileSelect}
            style={{ display: "none" }}
          />
        </Col>

        {/* Display selected files */}

        {files.length > 0 ? (
          <></>
        ) : (
          <Col>
            <div className="bg-light border h-100 d-flex align-items-center justify-content-center rounded text-muted font-secondary fw-semi-bold">
              <span>No files are selected</span>
            </div>
          </Col>
        )}

        {files.length > 0 && (
          <Col>
            {/* <h4 className="mb-3 h6">Selected Files ({files.length}):</h4> */}
            <div className="d-flex flex-column gap-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="d-flex align-items-center gap-2 p-2 ps-3 border rounded bg-light"
                >
                  {uploadStatus[file.name] && (
                    <span className="status-icon">
                      {uploadStatus[file.name] === "Schema extracted!" ? (
                        <BiSolidCheckCircle
                          title={uploadStatus[file.name]}
                          color="green"
                          fontSize={20}
                        />
                      ) : uploadStatus[file.name] ===
                        "Failed to extract schema" ? (
                        <BiSolidXCircle
                          title={uploadStatus[file.name]}
                          color="red"
                          fontSize={20}
                        />
                      ) : null}
                    </span>
                  )}
                  <span className="font-secondary fw-medium">{file.name}</span>
                  <Button
                    type="button"
                    variant="outline-danger btn-icon ms-auto"
                    size="sm"
                    onClick={() => removeFile(file.name)}
                  >
                    <BiTrash size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </Col>
        )}

        {/* Commented out individual file upload section */}
        {/*
          <Form onSubmit={handleUpload}>
            <div className="d-grid gap-2">
              {Array.from({ length: 10 }).map((_, idx) => (
                <div key={idx} className="d-flex gap-4">
                  <Form.Group className="w-100 form-control d-flex justify-content-between align-items-center file-upload">
                    <Form.Control
                      type="file"
                      id={"fileSelect" + idx + 1}
                      className="file-input"
                      accept=".csv,.json,.tsv"
                      onChange={(e) => handleFileChange(idx, e)}
                    ></Form.Control>
                    <span className="text-medium text-muted">{fileName}</span>
                    <Form.Label
                      htmlFor={"fileSelect" + idx + 1}
                      className="btn btn-light btn-sm m-0"
                    >
                      Choose File
                    </Form.Label>

                    {uploadStatus[idx] && (
                      <span className="status-icon">
                        {uploadStatus[idx] === "Uploaded!" ? (
                          <BiSolidCheckCircle
                            title={uploadStatus[idx]}
                            color="green"
                            fontSize={20}
                          />
                        ) : uploadStatus[idx] === "Failed to upload" ? (
                          <BiSolidXCircle
                            title={uploadStatus[idx]}
                            color="red"
                            fontSize={20}
                          />
                        ) : null}
                      </span>
                    )}
                  </Form.Group>
                  <Button
                    variant="primary"
                    style={{ minWidth: "150px" }}
                    type="button"
                    disabled={!files[idx] || uploading[idx]}
                    onClick={() => handleFileUpload(files[idx], idx)}
                  >
                    {uploading[idx] ? "Uploading..." : "Upload"}
                  </Button>
                </div>
              ))}
            </div>
          </Form>
          */}
      </Row>
      <div className="sticky-btns my-4 gap-2 d-flex justify-content-end">
        <Button
          type="button"
          variant="primary"
          className="pill"
          disabled={filesToUploadCount === 0 || multiUploading}
          onClick={handleMultiUpload}
        >
          {multiUploading
            ? "Extracting schemas..."
            : `Extract Schemas (${filesToUploadCount})`}
        </Button>
        <Button
          variant="primary"
          className="pill"
          disabled={!allFilesUploaded}
          onClick={handleNext}
        >
          {allFilesUploaded ? "Next" : "Continue"}
        </Button>
      </div>
    </>
  );
}

export default WelcomeDemoPage;
