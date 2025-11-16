import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import ColumnETLModal from "../components/ColumnETLModal";
import { Row, Col, Button, Form, Table, Alert, Badge } from "react-bootstrap";
import {
  BiAnalyse,
  BiCog,
  BiError,
  BiSolidCheckCircle,
  BiSolidXCircle,
} from "react-icons/bi";
import LoadingOverlay from "../components/LoadingOverlay";

function BatchProjectionsPage() {
  const { entityName } = useParams();
  const navigate = useNavigate();
  const [etlModal, setEtlModal] = useState({ open: false, column: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // State for consumption files and their attributes
  const [consumptionFiles, setConsumptionFiles] = useState([]);
  const [fileAttributes, setFileAttributes] = useState({});
  const [projectionMappings, setProjectionMappings] = useState({});

  // State for projection settings
  const [projectionSettings, setProjectionSettings] = useState({
    schedule: "Daily",
    startTime: "09:00",
    timeZone: "UTC",
    outputFormat: "Parquet",
    compression: "None",
  });

  // State for saved settings
  const [savedSettings, setSavedSettings] = useState([]);

  // Fetch consumption files and their attributes on component mount
  useEffect(() => {
    fetchConsumptionFiles();
    loadSavedSettings();
  }, []);

  const loadSavedSettings = () => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("batchProjectionSettings") || "[]"
      );
      const entitySettings = saved.filter(
        (setting) => setting.entityName === entityName
      );
      setSavedSettings(entitySettings);
      console.log(
        "Loaded saved settings for entity:",
        entityName,
        entitySettings
      );
    } catch (err) {
      console.error("Error loading saved settings:", err);
    }
  };

  const fetchConsumptionFiles = async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch all consumption files from S3
      const response = await axios.get("/api/consumption/files");
      let allFiles = [];

      if (response.data.success) {
        allFiles = response.data.files;
        console.log(
          "S3 consumption files:",
          allFiles.map((f) => ({
            name: f.name || f.entityName,
            source: "S3",
            key: f.key,
          }))
        );
      }

      // Also fetch AI-generated consumption files
      try {
        const aiResponse = await axios.get("/api/ai-consumption-files");
        if (aiResponse.data.files) {
          console.log(
            "AI consumption files:",
            aiResponse.data.files.map((f) => ({
              name: f.name || f.entityName,
              source: "AI",
              id: f.id,
            }))
          );

          // Create a map to track existing files and avoid duplicates
          const existingFiles = new Map();
          allFiles.forEach((file) => {
            const key = file.name || file.entityName;
            existingFiles.set(key, { ...file, source: "S3" });
          });

          // Add AI files, but only if they don't already exist
          aiResponse.data.files.forEach((aiFile) => {
            const key = aiFile.name || aiFile.entityName;
            if (!existingFiles.has(key)) {
              existingFiles.set(key, { ...aiFile, source: "AI" });
              console.log(`Added new AI file: ${key}`);
            } else {
              // If AI file exists, replace the S3 version with AI version (has more metadata)
              const existing = existingFiles.get(key);
              console.log(
                `Replaced ${existing.source} file with AI file: ${key} (was: ${existing.source})`
              );
              existingFiles.set(key, { ...aiFile, source: "AI" });
            }
          });

          // Convert back to array
          allFiles = Array.from(existingFiles.values());
        }
      } catch (err) {
        console.error("Failed to fetch AI consumption files:", err);
        // Continue with S3 files only
      }

      console.log(
        "Final unique files:",
        allFiles.map((f) => ({
          name: f.name || f.entityName,
          source: f.source || "unknown",
          outputColumns: f.outputColumns ? f.outputColumns.length : 0,
        }))
      );

      // Auto-select the file that matches the entityName parameter
      const updatedFiles = allFiles.map((file) => {
        const fileName = file.name || file.entityName;
        return {
          ...file,
          selected: fileName === entityName, // Auto-select the matching file
        };
      });

      setConsumptionFiles(updatedFiles);

      // Fetch attributes for each file
      const attributesMap = {};
      console.log("Starting to fetch attributes for", allFiles.length, "files");

      for (const file of allFiles) {
        try {
          const fileName = file.name || file.entityName;
          console.log(`Processing file: ${fileName}, source: ${file.source}`);

          // For AI-generated files, use outputColumns as attributes
          if (file.outputColumns) {
            attributesMap[fileName] = file.outputColumns.map((col) => col.name);
            console.log(
              `AI file ${fileName} attributes (${attributesMap[fileName].length}):`,
              attributesMap[fileName]
            );
          } else {
            console.warn(`AI file ${fileName} has no outputColumns`);
            attributesMap[fileName] = [];
          }
        } catch (err) {
          console.error(
            `Failed to fetch columns for ${file.name || file.entityName}:`,
            err
          );
          attributesMap[file.name || file.entityName] = [];
        }
      }

      console.log("Final attributes map:", attributesMap);
      setFileAttributes(attributesMap);

      // Auto-select all attributes for the auto-selected file
      const autoSelectedFile = updatedFiles.find((file) => file.selected);
      if (autoSelectedFile) {
        const fileName = autoSelectedFile.name || autoSelectedFile.entityName;
        const attributes = attributesMap[fileName] || [];
        const autoMappings = {};
        attributes.forEach((attr) => {
          autoMappings[attr] = true; // Select all attributes by default
        });
        setProjectionMappings((prev) => ({
          ...prev,
          [fileName]: autoMappings,
        }));
        console.log(
          `Auto-selected all attributes for ${fileName}:`,
          autoMappings
        );
      }
    } catch (err) {
      console.error("Failed to fetch consumption files:", err);
      setError("Failed to load consumption files. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEntitySelection = (entityName, selected) => {
    setConsumptionFiles((prev) =>
      prev.map((file) => {
        const fileName = file.name || file.entityName;
        return fileName === entityName ? { ...file, selected } : file;
      })
    );
  };

  const handleAttributeSelection = (entityName, attribute, selected) => {
    setProjectionMappings((prev) => ({
      ...prev,
      [entityName]: {
        ...prev[entityName],
        [attribute]: selected,
      },
    }));
  };

  const handleEntityTransformation = () => {
    setEtlModal({ open: true, column: entityName });
  };

  const handleSettingChange = (setting, value) => {
    setProjectionSettings((prev) => ({
      ...prev,
      [setting]: value,
    }));
  };

  const getSelectedEntitiesAndAttributes = () => {
    const selectedEntities = consumptionFiles.filter((file) => file.selected);
    const mappings = {};

    selectedEntities.forEach((file) => {
      const fileName = file.name || file.entityName;
      const attributes = fileAttributes[fileName] || [];
      const selectedAttributes = attributes.filter(
        (attr) => projectionMappings[fileName]?.[attr] !== false
      );

      if (selectedAttributes.length > 0) {
        mappings[fileName] = {
          entity: file,
          attributes: selectedAttributes,
          source: file.source || "S3",
        };
      }
    });

    return mappings;
  };

  const handleTestProjection = async () => {
    const selectedMappings = getSelectedEntitiesAndAttributes();

    if (Object.keys(selectedMappings).length === 0) {
      alert(
        "Please select at least one entity and its attributes for projection."
      );
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    try {
      const testData = {
        entityName,
        selectedEntities: selectedMappings,
        settings: projectionSettings,
        isTest: true,
      };

      const response = await axios.post(
        "/api/batch-projections/test",
        testData
      );

      if (response.data.success) {
        setTestResult({
          success: true,
          message: response.data.message,
          files: response.data.files || [],
          totalRecordCount: response.data.totalRecordCount,
          totalFileCount: response.data.totalFileCount,
        });
      } else {
        setTestResult({
          success: false,
          message: response.data.message || "Test projection failed",
        });
      }
    } catch (err) {
      console.error("Test projection error:", err);
      setTestResult({
        success: false,
        message: err.response?.data?.message || "Failed to test projection",
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    const selectedMappings = getSelectedEntitiesAndAttributes();

    if (Object.keys(selectedMappings).length === 0) {
      alert(
        "Please select at least one entity and its attributes for projection."
      );
      return;
    }

    setSaveLoading(true);

    try {
      const settingsData = {
        id: `projection_${entityName}_${Date.now()}`,
        entityName,
        selectedEntities: selectedMappings,
        settings: projectionSettings,
        schedule: {
          frequency: projectionSettings.schedule,
          startTime: projectionSettings.startTime,
          timeZone: projectionSettings.timeZone,
        },
        output: {
          format: projectionSettings.outputFormat,
          compression: projectionSettings.compression,
        },
        createdAt: new Date().toISOString(),
        status: "active",
      };

      // Save to localStorage
      const existingSettings = JSON.parse(
        localStorage.getItem("batchProjectionSettings") || "[]"
      );
      const updatedSettings = [...existingSettings, settingsData];
      localStorage.setItem(
        "batchProjectionSettings",
        JSON.stringify(updatedSettings)
      );

      // Also save to backend (if available)
      try {
        const response = await axios.post(
          "/api/batch-projections/save",
          settingsData
        );

        if (response.data.success) {
          alert(
            "Batch projection settings saved successfully to both local storage and server!"
          );
        } else {
          alert(
            "Settings saved to local storage. Server save failed: " +
              (response.data.message || "Unknown error")
          );
        }
      } catch (err) {
        console.error("Server save error:", err);
        alert(
          "Settings saved to local storage. Server save failed: " +
            (err.response?.data?.message || "Network error")
        );
      }

      console.log("Settings saved to localStorage:", settingsData);
    } catch (err) {
      console.error("Save settings error:", err);
      alert("Failed to save settings: " + err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return <LoadingOverlay text="Loading consumption files..." />;
  }

  if (error) {
    return (
      <div className="position-absolute w-100 h-100 d-flex flex-column justify-content-center align-items-center">
        <div className="text-center">
          <div className="text-danger mb-4 font-secondary fs-4 fw-medium">
            <div className="icon mb-4">
              <BiError size={100} />
            </div>
            {error}
          </div>
          <Button
            variant="danger pill"
            size="lg"
            style={{ minWidth: "120px" }}
            onClick={fetchConsumptionFiles}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="d-flex justify-content-between mb-4">
        <h1 className="h3 fw-semi-bold m-0">Batch Projections Setup</h1>
        <div className="d-flex gap-2">
          <Button
            variant="outline-secondary"
            onClick={handleTestProjection}
            disabled={testLoading}
          >
            <BiAnalyse size={18} />{" "}
            {testLoading ? "Testing..." : "Test Projection"}
          </Button>
          <Button
            variant="outline-secondary"
            onClick={() => navigate("/batch-projections-settings")}
            title="View all saved settings"
          >
            <BiCog size={18} /> View All Settings
          </Button>
        </div>
      </header>

      <ColumnETLModal
        open={etlModal.open}
        onClose={() => setEtlModal({ open: false, column: "" })}
        column={etlModal.column}
        entityColumns={[]}
      />

      {/* Auto-selection indicator */}
      {consumptionFiles.some((file) => file.selected) && (
        <Alert variant="success">
          <div className="alert-icon">
            <BiSolidCheckCircle color="green" size={24} />
          </div>
          <div className="alert-text text-start">
            Auto-selected: <strong>{entityName}</strong> - All attributes are
            pre-selected for your convenience
          </div>
        </Alert>
      )}

      {testResult && (
        <Alert variant={testResult.success ? "success" : "danger"}>
          <div className="alert-icon">
            {testResult.success ? (
              <BiSolidCheckCircle color="green" size={24} />
            ) : (
              <BiSolidXCircle color="red" size={24} />
            )}
          </div>
          <div className="alert-text">
            <h5>{testResult.success ? "Test Successful" : "Test Failed"}</h5>
            <p>{testResult.message}</p>

            {testResult.success && (
              <>
                <div className="d-flex flex-wrap gap-4">
                  <p>
                    <strong>Total Records:</strong>{" "}
                    {testResult.totalRecordCount}
                  </p>
                  <p>
                    <strong>Files Generated:</strong>{" "}
                    {testResult.totalFileCount}
                  </p>
                </div>
                {testResult.files && testResult.files.length > 0 && (
                  <div className="d-flex gap-4">
                    <p className="m-0">
                      <strong>Generated Files:</strong>
                    </p>
                    <div className="d-flex flex-wrap gap-2">
                      {testResult.files.map((file, index) => (
                        <div key={index}>
                          <a
                            href={file.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ marginRight: "1rem" }}
                          >
                            📄 {file.entity} ({file.recordCount} records,{" "}
                            {file.fileSize})
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Alert>
      )}

      <h3 className="fs-6 fw-semi-bold">Entity Selection & Mapping</h3>
      {consumptionFiles.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "2rem",
            background: "#f8f9fa",
            borderRadius: "8px",
            border: "1px solid #dee2e6",
          }}
        >
          <p style={{ color: "#6c757d", margin: "0" }}>
            No consumption files found. Create consumption files first to
            configure batch projections.
          </p>
        </div>
      ) : (
        <div className="table-view border rounded mb-4">
          <Table>
            <thead>
              <tr>
                <th>Consumption Entity</th>
                <th>Consumption Attributes</th>
                <th>Projection Entity</th>
                <th>Projection Attributes</th>
              </tr>
            </thead>
            <tbody>
              {consumptionFiles.map((file, index) => {
                const fileName = file.name || file.entityName;
                const fileAttributesList = fileAttributes[fileName] || [];

                return (
                  <tr key={fileName}>
                    <td>
                      <div className="d-flex align-items-center gap-3">
                        <Form.Check
                          type="checkbox"
                          id={`entity-${index}-${fileName}`} // ✅ Unique ID
                          checked={file.selected || false}
                          label={fileName}
                          onChange={(e) =>
                            handleEntitySelection(fileName, e.target.checked)
                          }
                        />

                        {file.selected && (
                          <Badge pill bg="success">
                            AUTO
                          </Badge>
                        )}
                        {file.source && (
                          <Badge
                            title={`Source: ${file.source}`}
                            pill
                            bg="primary"
                          >
                            {file.source}
                          </Badge>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="bp-attributes-list">
                        {fileAttributesList.length > 0 ? (
                          fileAttributesList.map((attr, attrIndex) => (
                            <div
                              key={`${fileName}-${attr}`}
                              className="bp-attribute-item"
                            >
                              <Form.Check
                                type="checkbox"
                                id={`attribute-${index}${attrIndex}`}
                                checked={
                                  projectionMappings[fileName]?.[attr] ?? true
                                }
                                onChange={(e) =>
                                  handleAttributeSelection(
                                    fileName,
                                    attr,
                                    e.target.checked
                                  )
                                }
                                label={attr}
                              />
                            </div>
                          ))
                        ) : (
                          <div
                            style={{
                              color: "#6c757d",
                              fontStyle: "italic",
                            }}
                          >
                            Loading attributes...
                          </div>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="text-muted">{fileName}</div>
                    </td>

                    <td>
                      <div className="d-flex flex-column gap-2">
                        {fileAttributesList.length > 0 ? (
                          fileAttributesList.map((attr) => (
                            <div key={`${fileName}-${attr}`}>
                              <span className="bg-light px-3 py-1 rounded text-medium d-inline-block">
                                {attr}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div
                            style={{
                              color: "#6c757d",
                              fontStyle: "italic",
                            }}
                          >
                            Loading attributes...
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      <div className="">
        <h5 className="mb-4 fs-6">Projection Settings</h5>
        <Form.Group className="mb-3">
          <Row>
            <Col md={3}>
              <Form.Label>Schedule</Form.Label>
            </Col>
            <Col md={4}>
              <Form.Select
                value={projectionSettings.schedule}
                onChange={(e) =>
                  handleSettingChange("schedule", e.target.value)
                }
              >
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
                <option>Custom</option>
              </Form.Select>
            </Col>
          </Row>
        </Form.Group>

        <Form.Group className="mb-3">
          <Row>
            <Col md={3}>
              <Form.Label>Start Time</Form.Label>
            </Col>
            <Col md={4}>
              <Form.Control
                type="time"
                value={projectionSettings.startTime}
                onChange={(e) =>
                  handleSettingChange("startTime", e.target.value)
                }
              />
            </Col>
          </Row>
        </Form.Group>
        <Form.Group className="mb-3">
          <Row>
            <Col md={3}>
              <Form.Label>Time Zone</Form.Label>
            </Col>
            <Col md={4}>
              <Form.Select
                value={projectionSettings.timeZone}
                onChange={(e) =>
                  handleSettingChange("timeZone", e.target.value)
                }
              >
                <option>UTC</option>
                <option>EST</option>
                <option>PST</option>
              </Form.Select>
            </Col>
          </Row>
        </Form.Group>

        <h5 className="my-4 fs-6">Output Settings</h5>
        <Form.Group className="mb-3">
          <Row>
            <Col md={3}>
              <Form.Label>Output Format</Form.Label>
            </Col>
            <Col md={4}>
              <Form.Select
                value={projectionSettings.outputFormat}
                onChange={(e) =>
                  handleSettingChange("outputFormat", e.target.value)
                }
              >
                <option>Parquet</option>
                <option>CSV</option>
                <option>JSON</option>
              </Form.Select>
            </Col>
          </Row>
        </Form.Group>
        <Form.Group className="mb-3">
          <Row>
            <Col md={3}>
              <Form.Label>Compression</Form.Label>
            </Col>
            <Col md={4}>
              <Form.Select
                value={projectionSettings.compression}
                onChange={(e) =>
                  handleSettingChange("compression", e.target.value)
                }
              >
                <option>None</option>
                <option>GZIP</option>
                <option>Snappy</option>
              </Form.Select>
            </Col>
          </Row>
        </Form.Group>
      </div>

      {/* Saved Settings Section */}
      {savedSettings.length > 0 && (
        <div className="bp-section">
          <h3>Saved Projection Settings</h3>
          <div className="bp-saved-settings">
            {savedSettings.map((setting, index) => (
              <div key={setting.id} className="bp-saved-setting-item">
                <div className="bp-saved-setting-header">
                  <h4>Configuration {index + 1}</h4>
                  <span className="bp-saved-setting-date">
                    {new Date(setting.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="bp-saved-setting-details">
                  <p>
                    <strong>Schedule:</strong> {setting.schedule.frequency} at{" "}
                    {setting.schedule.startTime} ({setting.schedule.timeZone})
                  </p>
                  <p>
                    <strong>Output:</strong> {setting.output.format} with{" "}
                    {setting.output.compression} compression
                  </p>
                  <p>
                    <strong>Entities:</strong>{" "}
                    {Object.keys(setting.selectedEntities).join(", ")}
                  </p>
                </div>
                <div className="bp-saved-setting-actions">
                  <button
                    className="hero-btn secondary"
                    onClick={() => {
                      // Load this configuration
                      setProjectionSettings(setting.settings);
                      // Set selected entities
                      const updatedFiles = consumptionFiles.map((file) => {
                        const fileName = file.name || file.entityName;
                        return {
                          ...file,
                          selected: setting.selectedEntities[fileName]
                            ? true
                            : false,
                        };
                      });
                      setConsumptionFiles(updatedFiles);
                      // Set attribute mappings
                      setProjectionMappings(setting.selectedEntities);
                      alert("Configuration loaded successfully!");
                    }}
                  >
                    Load Configuration
                  </button>
                  <button
                    className="hero-btn danger"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Are you sure you want to delete this saved configuration?"
                        )
                      ) {
                        const updatedSettings = savedSettings.filter(
                          (s) => s.id !== setting.id
                        );
                        setSavedSettings(updatedSettings);
                        localStorage.setItem(
                          "batchProjectionSettings",
                          JSON.stringify(updatedSettings)
                        );
                        alert("Configuration deleted successfully!");
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sticky-btns my-4 gap-2 d-flex justify-content-end">
        <Button variant="outline-secondary pill" onClick={() => navigate(-1)}>
          Back
        </Button>
        <Button
          variant="primary pill"
          onClick={handleSaveSettings}
          disabled={saveLoading}
        >
          {saveLoading ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </>
  );
}

export default BatchProjectionsPage;
