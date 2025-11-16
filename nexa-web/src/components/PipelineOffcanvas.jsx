import React, { useEffect, useState } from "react";
import {
  Offcanvas,
  Row,
  Col,
  Button,
  Badge,
  Tab,
  Tabs,
  Card,
  Alert,
  Table,
} from "react-bootstrap";
import {
  BiSolidXCircle,
  BiSolidCheckCircle,
  BiServer,
  BiCodeAlt,
  BiLinkExternal,
  BiData,
  BiTime,
  BiGitBranch,
  BiBell,
} from "react-icons/bi";
import axios from "axios";
import moment from "moment";

const PipelineOffcanvas = ({ show, handleClose, pipelineId }) => {
  const [pipelineDetails, setpipelineDetails] = useState(null);
  const [pipelineUpdates, setPipelineUpdates] = useState([]);
  const [pipelineEvents, setPipelineEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const getPipelineDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_LLM_URL}/api/v1/pipelines/${pipelineId}`
      );
      if (response.status === 200) {
        setpipelineDetails(response.data);
      }
    } catch (error) {
      console.error("Error fetching pipeline details:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPipelineUpdates = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_LLM_URL}/api/v1/pipelines/${pipelineId}/updates`
      );
      if (response.status === 200) {
        setPipelineUpdates(response.data.updates || []);
      }
    } catch (error) {
      console.error("Error fetching pipeline updates:", error);
    }
  };

  const getPipelineEvents = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_LLM_URL}/api/v1/pipelines/${pipelineId}/events?max_results=50`
      );
      if (response.status === 200) {
        setPipelineEvents(response.data.events || []);
      }
    } catch (error) {
      console.error("Error fetching pipeline events:", error);
    }
  };

  useEffect(() => {
    if (pipelineId) {
      getPipelineDetails();
      getPipelineUpdates();
      getPipelineEvents();
    }
  }, [pipelineId]);

  const formatDuration = (milliseconds) => {
    if (!milliseconds) return "N/A";
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const getLibraryType = (library) => {
    if (library.notebook) return "Notebook";
    if (library.file) return "File";
    if (library.jar) return "JAR";
    if (library.maven) return "Maven";
    if (library.pypi) return "PyPI";
    if (library.whl) return "Wheel";
    return "Unknown";
  };

  const getLibraryDetails = (library) => {
    if (library.notebook) return library.notebook.path;
    if (library.file) return library.file.path;
    if (library.jar) return library.jar;
    if (library.maven) return library.maven.coordinates;
    if (library.pypi) return library.pypi.package;
    if (library.whl) return library.whl;
    return "N/A";
  };

  const getUpdateStateBadge = (state) => {
    const stateMap = {
      QUEUED: { variant: "secondary", label: "Queued" },
      RUNNING: { variant: "info", label: "Running" },
      COMPLETED: { variant: "success", label: "Completed" },
      FAILED: { variant: "danger", label: "Failed" },
      CANCELED: { variant: "warning", label: "Canceled" },
    };

    const config = stateMap[state] || { variant: "secondary", label: state || "Unknown" };
    return <Badge bg={config.variant}>{config.label}</Badge>;
  };

  const getEventLevelBadge = (level) => {
    const levelMap = {
      INFO: { variant: "info", label: "Info" },
      WARN: { variant: "warning", label: "Warning" },
      ERROR: { variant: "danger", label: "Error" },
      METRICS: { variant: "secondary", label: "Metrics" },
    };

    const config = levelMap[level] || { variant: "secondary", label: level || "Unknown" };
    return <Badge bg={config.variant}>{config.label}</Badge>;
  };

  if (loading || !pipelineDetails) {
    return (
      <Offcanvas
        show={show}
        onHide={handleClose}
        placement="end"
        backdrop="static"
        className="size-md"
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Pipeline Details</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <div className="text-center py-4">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </Offcanvas.Body>
      </Offcanvas>
    );
  }

  const spec = pipelineDetails.spec || {};
  const libraries = spec.libraries || [];
  const clusters = spec.clusters || [];

  return (
    <Offcanvas
      show={show}
      onHide={handleClose}
      placement="end"
      backdrop="static"
      className="size-md"
    >
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>
          {pipelineDetails.name || "Pipeline"}{" "}
          <Badge
            pill
            bg={pipelineDetails.health === "HEALTHY" ? "success" : "danger"}
            className="px-2"
          >
            {pipelineDetails.health === "HEALTHY" ? (
              <BiSolidCheckCircle color="#2E7D32" />
            ) : (
              <BiSolidXCircle color="#D32F2F" />
            )}{" "}
            {pipelineDetails.health || "Unknown"}
          </Badge>
        </Offcanvas.Title>
      </Offcanvas.Header>

      <Offcanvas.Body className="pt-0">
        <Tabs
          defaultActiveKey="overview"
          className="mb-4 justify-content-start position-sticky bg-white"
        >
          {/* Overview Tab */}
          <Tab eventKey="overview" title="Overview">
            <Row className="g-3">
              <Col md={12}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title mb-2">
                    <h6 className="fw-medium m-0">Pipeline ID</h6>
                  </div>
                  <div className="data-value text-muted" style={{ wordBreak: "break-all" }}>
                    {pipelineDetails.pipeline_id}
                  </div>
                </div>
              </Col>

              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title mb-2">
                    <h6 className="fw-medium m-0">State</h6>
                  </div>
                  <div className="data-value">
                    <Badge bg={pipelineDetails.state === "RUNNING" ? "success" : "secondary"}>
                      {pipelineDetails.state || "Unknown"}
                    </Badge>
                  </div>
                </div>
              </Col>

              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title mb-2">
                    <h6 className="fw-medium m-0">Creator</h6>
                  </div>
                  <div className="data-value text-muted">
                    {pipelineDetails.creator_user_name || "N/A"}
                  </div>
                </div>
              </Col>

              <Col md={12}>
                <h6 className="fw-medium mt-2">Configuration</h6>
              </Col>

              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title mb-2">
                    <small className="text-muted">Mode</small>
                  </div>
                  <div className="data-value">
                    <Badge bg={spec.continuous ? "info" : "secondary"} pill>
                      {spec.continuous ? "Continuous" : "Triggered"}
                    </Badge>
                  </div>
                </div>
              </Col>

              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title mb-2">
                    <small className="text-muted">Environment</small>
                  </div>
                  <div className="data-value">
                    <Badge bg={spec.development ? "warning" : "success"} pill>
                      {spec.development ? "Development" : "Production"}
                    </Badge>
                  </div>
                </div>
              </Col>

              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title mb-2">
                    <small className="text-muted">Photon</small>
                  </div>
                  <div className="data-value">
                    {spec.photon ? (
                      <Badge bg="success" pill>Enabled</Badge>
                    ) : (
                      <span className="text-muted">Disabled</span>
                    )}
                  </div>
                </div>
              </Col>

              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title mb-2">
                    <small className="text-muted">Serverless</small>
                  </div>
                  <div className="data-value">
                    {spec.serverless ? (
                      <Badge bg="primary" pill>Enabled</Badge>
                    ) : (
                      <span className="text-muted">Disabled</span>
                    )}
                  </div>
                </div>
              </Col>

              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title mb-2">
                    <small className="text-muted">Edition</small>
                  </div>
                  <div className="data-value text-muted">
                    {spec.edition || "N/A"}
                  </div>
                </div>
              </Col>

              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title mb-2">
                    <small className="text-muted">Channel</small>
                  </div>
                  <div className="data-value text-muted">
                    {spec.channel || "N/A"}
                  </div>
                </div>
              </Col>

              {spec.catalog && (
                <Col md={12}>
                  <div className="job-item border rounded-3 p-3">
                    <div className="data-title mb-2">
                      <h6 className="fw-medium m-0">Target Location</h6>
                    </div>
                    <div className="data-value">
                      <Badge bg="info" className="me-1">Catalog: {spec.catalog}</Badge>
                      {spec.schema_name && (
                        <Badge bg="info" className="me-1">Schema: {spec.schema_name}</Badge>
                      )}
                      {spec.target && (
                        <Badge bg="info">Target: {spec.target}</Badge>
                      )}
                    </div>
                  </div>
                </Col>
              )}

              {spec.storage && (
                <Col md={12}>
                  <div className="job-item border rounded-3 p-3">
                    <div className="data-title mb-2">
                      <small className="text-muted">Storage Location</small>
                    </div>
                    <div className="data-value text-muted">
                      <code>{spec.storage}</code>
                    </div>
                  </div>
                </Col>
              )}
            </Row>
          </Tab>

          {/* Libraries Tab */}
          <Tab eventKey="libraries" title={`Libraries (${libraries.length})`}>
            {libraries.length === 0 ? (
              <Alert variant="info">No libraries configured for this pipeline.</Alert>
            ) : (
              <div className="d-grid gap-2">
                {libraries.map((library, index) => (
                  <Card key={index}>
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <Badge bg="secondary">{getLibraryType(library)}</Badge>
                        </div>
                      </div>
                      <div className="text-break">
                        <code className="text-primary">{getLibraryDetails(library)}</code>
                      </div>
                    </Card.Body>
                  </Card>
                ))}
              </div>
            )}
          </Tab>

          {/* Clusters Tab */}
          <Tab eventKey="clusters" title={`Clusters (${clusters.length})`}>
            {clusters.length === 0 ? (
              <Alert variant="info">
                {spec.serverless
                  ? "Pipeline uses serverless compute - no cluster configuration needed."
                  : "No cluster configuration available."}
              </Alert>
            ) : (
              <div className="d-grid gap-3">
                {clusters.map((cluster, index) => (
                  <Card key={index}>
                    <Card.Body>
                      <h6 className="mb-3">
                        <BiServer className="me-2" />
                        {cluster.label || `Cluster ${index + 1}`}
                      </h6>
                      <Row className="g-2">
                        {cluster.node_type_id && (
                          <Col md={6}>
                            <small className="text-muted d-block">Node Type</small>
                            <small>{cluster.node_type_id}</small>
                          </Col>
                        )}
                        {cluster.num_workers !== undefined && (
                          <Col md={6}>
                            <small className="text-muted d-block">Workers</small>
                            <small>{cluster.num_workers}</small>
                          </Col>
                        )}
                        {cluster.autoscale && (
                          <Col md={12}>
                            <small className="text-muted d-block">Autoscale</small>
                            <small>
                              Min: {cluster.autoscale.min_workers}, Max: {cluster.autoscale.max_workers}
                            </small>
                          </Col>
                        )}
                      </Row>
                    </Card.Body>
                  </Card>
                ))}
              </div>
            )}
          </Tab>

          {/* Updates Tab */}
          <Tab eventKey="updates" title="Updates">
            {pipelineUpdates.length === 0 ? (
              <Alert variant="info">No update history available.</Alert>
            ) : (
              <div className="d-grid gap-2">
                {pipelineUpdates.map((update) => (
                  <Card key={update.update_id}>
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <h6 className="mb-2">
                            Update #{update.update_id?.substring(0, 8)}...
                          </h6>
                          <div className="d-flex gap-2">
                            {getUpdateStateBadge(update.state)}
                            {update.cause && (
                              <Badge bg="secondary">
                                {update.cause}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-end">
                          <small className="text-muted d-block">
                            {moment(update.creation_time).format("MMM DD, YYYY HH:mm")}
                          </small>
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                ))}
              </div>
            )}
          </Tab>

          {/* Events Tab */}
          <Tab eventKey="events" title="Events">
            {pipelineEvents.length === 0 ? (
              <Alert variant="info">No events available.</Alert>
            ) : (
              <div className="d-grid gap-2">
                {pipelineEvents.slice(0, 20).map((event) => (
                  <Card key={event.id}>
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="flex-grow-1">
                          {getEventLevelBadge(event.level)}
                          <p className="mb-0 mt-2 small">{event.message}</p>
                        </div>
                        <div className="text-end ms-2">
                          <small className="text-muted text-nowrap">
                            {moment(event.timestamp).format("HH:mm:ss")}
                          </small>
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                ))}
              </div>
            )}
          </Tab>
        </Tabs>
      </Offcanvas.Body>
    </Offcanvas>
  );
};

export default PipelineOffcanvas;
