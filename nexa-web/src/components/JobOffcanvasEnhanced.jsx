import React, { useEffect, useState } from "react";
import {
  Offcanvas,
  Form,
  Row,
  Col,
  Button,
  OverlayTrigger,
  Tooltip,
  Card,
  Badge,
  Tab,
  Tabs,
  Accordion,
  Table,
  Alert,
} from "react-bootstrap";
import {
  BiChevronDown,
  BiChevronUp,
  BiSolidData,
  BiGridAlt,
  BiSolidLockAlt,
  BiSolidXCircle,
  BiSolidCheckCircle,
  BiUser,
  BiPencil,
  BiTime,
  BiServer,
  BiCodeAlt,
  BiLinkExternal,
  BiTask,
  BiGitBranch,
} from "react-icons/bi";
import axios from "axios";
import moment from "moment";

const JobOffcanvasEnhanced = ({ show, handleClose, jobId, jobStatus }) => {
  const [collapseOpen, setCollapseOpen] = useState(false);
  const [jobDetails, setJobDetails] = useState({});
  const [jobRuns, setJobRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [loading, setLoading] = useState(false);

  const getJobDetails = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_LLM_URL}/api/v1/jobs/${jobId}`
      );
      if (response.status === 200) {
        setJobDetails(response.data);
      }
    } catch (error) {
      console.error("Error fetching job details:", error);
    }
  };

  const getJobRuns = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_LLM_URL}/api/v1/jobs/${jobId}/runs?limit=50`
      );
      if (response.status === 200) {
        setJobRuns(response.data.runs || []);
      }
    } catch (error) {
      console.error("Error fetching job runs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDuration = (start, end) => {
    if (!start || !end) return "N/A";
    const startDate = new Date(start);
    const endDate = new Date(end);

    let diffInSeconds = Math.floor((endDate - startDate) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds}s`;
    }

    const minutes = Math.floor(diffInSeconds / 60);
    const seconds = diffInSeconds % 60;

    if (minutes < 60) {
      return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes > 0
      ? `${hours}hr ${remainingMinutes}m`
      : `${hours}hr`;
  };

  const formatDuration = (milliseconds) => {
    if (!milliseconds) return "N/A";
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const getJobTasks = () => {
    const settings = jobDetails?.settings;
    if (!settings) return [];

    // Handle both single task and multi-task jobs
    if (settings.tasks && Array.isArray(settings.tasks)) {
      return settings.tasks;
    }

    // Legacy single-task jobs
    const singleTask = [];
    if (settings.notebook_task) {
      singleTask.push({ task_key: "main", notebook_task: settings.notebook_task });
    } else if (settings.spark_jar_task) {
      singleTask.push({ task_key: "main", spark_jar_task: settings.spark_jar_task });
    } else if (settings.spark_python_task) {
      singleTask.push({ task_key: "main", spark_python_task: settings.spark_python_task });
    } else if (settings.python_wheel_task) {
      singleTask.push({ task_key: "main", python_wheel_task: settings.python_wheel_task });
    }

    return singleTask;
  };

  const getTaskType = (task) => {
    if (task.notebook_task) return "Notebook";
    if (task.spark_jar_task) return "Spark JAR";
    if (task.spark_python_task) return "Spark Python";
    if (task.python_wheel_task) return "Python Wheel";
    if (task.spark_submit_task) return "Spark Submit";
    if (task.pipeline_task) return "Delta Live Tables";
    if (task.sql_task) return "SQL";
    return "Unknown";
  };

  const getTaskDetails = (task) => {
    if (task.notebook_task) {
      return task.notebook_task.notebook_path || "N/A";
    }
    if (task.spark_jar_task) {
      return task.spark_jar_task.main_class_name || "N/A";
    }
    if (task.spark_python_task) {
      return task.spark_python_task.python_file || "N/A";
    }
    if (task.python_wheel_task) {
      return task.python_wheel_task.package_name || "N/A";
    }
    if (task.pipeline_task) {
      return task.pipeline_task.pipeline_id || "N/A";
    }
    if (task.sql_task) {
      return task.sql_task.query?.query_id || task.sql_task.file?.path || "N/A";
    }
    return "N/A";
  };

  const getRunStateBadge = (state, resultState) => {
    // Life cycle state: PENDING, RUNNING, TERMINATING, TERMINATED, SKIPPED, INTERNAL_ERROR
    // Result state: SUCCESS, FAILED, TIMEOUT, CANCELED

    if (state === "RUNNING" || state === "PENDING") {
      return <Badge bg="info">{state}</Badge>;
    }

    if (state === "TERMINATED") {
      if (resultState === "SUCCESS") {
        return <Badge bg="success">SUCCESS</Badge>;
      } else if (resultState === "FAILED") {
        return <Badge bg="danger">FAILED</Badge>;
      } else if (resultState === "TIMEOUT") {
        return <Badge bg="warning">TIMEOUT</Badge>;
      } else if (resultState === "CANCELED") {
        return <Badge bg="secondary">CANCELED</Badge>;
      }
    }

    return <Badge bg="secondary">{state || "UNKNOWN"}</Badge>;
  };

  useEffect(() => {
    if (jobId != null) {
      getJobDetails();
      getJobRuns();
    }
  }, [jobId]);

  const tasks = getJobTasks();

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
          {jobDetails?.job_name}{" "}
          <Badge
            pill
            bg={jobStatus === "failed" ? "danger" : "success"}
            className="px-2"
          >
            {jobStatus === "failed" ? (
              <BiSolidXCircle color="#D32F2F" />
            ) : (
              <BiSolidCheckCircle color="#2E7D32" />
            )}{" "}
            {jobStatus}
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
              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title d-flex gap-2 align-item-center mb-2">
                    <h6 className="fw-medium m-0">Job ID</h6>
                  </div>
                  <div className="data-value text-muted">
                    {jobDetails?.job_id}
                  </div>
                </div>
              </Col>
              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title d-flex gap-2 align-item-center mb-2">
                    <h6 className="fw-medium m-0">Creator</h6>
                  </div>
                  <div className="data-value d-flex gap-2 align-items-center text-muted">
                    <BiUser size={18} />
                    <span>{jobDetails?.creator_user_name || "N/A"}</span>
                  </div>
                </div>
              </Col>
              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title d-flex gap-2 align-item-center mb-2">
                    <h6 className="fw-medium m-0">Run As</h6>
                  </div>
                  <div className="data-value d-flex gap-2 align-items-center text-muted">
                    <BiUser size={18} />
                    <span>{jobDetails?.run_as_user_name || "N/A"}</span>
                  </div>
                </div>
              </Col>
              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title d-flex gap-2 align-item-center mb-2">
                    <h6 className="fw-medium m-0">Schedule</h6>
                  </div>
                  <div className="data-value text-muted">
                    {jobDetails?.schedule
                      ? `${jobDetails.schedule_interval || ""} ${jobDetails.schedule}`
                      : "Manual"}
                  </div>
                </div>
              </Col>

              {/* Health Metrics */}
              {jobDetails?.health && (
                <>
                  <Col md={12}>
                    <h6 className="fw-medium mt-2">Health Metrics</h6>
                  </Col>
                  <Col md={4}>
                    <div className="job-item border rounded-3 p-3">
                      <div className="data-title mb-2">
                        <small className="text-muted">Health Score</small>
                      </div>
                      <div className="data-value h4 mb-0">
                        {jobDetails.health.health_score
                          ? `${Math.round(jobDetails.health.health_score * 100)}%`
                          : "N/A"}
                      </div>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="job-item border rounded-3 p-3">
                      <div className="data-title mb-2">
                        <small className="text-muted">Consecutive Failures</small>
                      </div>
                      <div className="data-value h4 mb-0 text-danger">
                        {jobDetails.health.consecutive_failures || 0}
                      </div>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="job-item border rounded-3 p-3">
                      <div className="data-title mb-2">
                        <small className="text-muted">Avg Runtime</small>
                      </div>
                      <div className="data-value h4 mb-0">
                        {jobDetails.health.avg_runtime_seconds
                          ? formatDuration(jobDetails.health.avg_runtime_seconds * 1000)
                          : "N/A"}
                      </div>
                    </div>
                  </Col>
                </>
              )}

              {/* Configuration */}
              <Col md={12}>
                <h6 className="fw-medium mt-2">Configuration</h6>
              </Col>
              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title mb-2">
                    <small className="text-muted">Timeout</small>
                  </div>
                  <div className="data-value">
                    {jobDetails?.timeout_seconds
                      ? `${Math.floor(jobDetails.timeout_seconds / 3600)}h ${Math.floor((jobDetails.timeout_seconds % 3600) / 60)}m`
                      : "No timeout"}
                  </div>
                </div>
              </Col>
              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title mb-2">
                    <small className="text-muted">Max Concurrent Runs</small>
                  </div>
                  <div className="data-value">
                    {jobDetails?.max_concurrent_runs || "1"}
                  </div>
                </div>
              </Col>

              {/* Tags */}
              {jobDetails?.tags && Object.keys(jobDetails.tags).length > 0 && (
                <Col md={12}>
                  <div className="job-item border rounded-3 p-3">
                    <div className="data-title mb-2">
                      <h6 className="fw-medium m-0">Tags</h6>
                    </div>
                    <div className="data-value d-flex gap-2 flex-wrap">
                      {Object.entries(jobDetails.tags).map(([key, value]) => (
                        <Badge key={key} bg="primary" pill>
                          {key}: {value}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Col>
              )}
            </Row>
          </Tab>

          {/* Tasks Tab */}
          <Tab eventKey="tasks" title={`Tasks (${tasks.length})`}>
            {tasks.length === 0 ? (
              <Alert variant="info">No tasks configured for this job.</Alert>
            ) : (
              <div className="d-grid gap-3">
                {tasks.map((task, index) => (
                  <Card key={index}>
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                          <h6 className="mb-1">
                            <BiTask className="me-2" />
                            {task.task_key || `Task ${index + 1}`}
                          </h6>
                          <Badge bg="secondary">{getTaskType(task)}</Badge>
                        </div>
                        {task.depends_on && task.depends_on.length > 0 && (
                          <div className="text-end">
                            <small className="text-muted d-block">Depends on:</small>
                            {task.depends_on.map((dep, i) => (
                              <Badge key={i} bg="light" text="dark" className="me-1">
                                <BiGitBranch className="me-1" />
                                {dep.task_key}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mb-2">
                        <small className="text-muted">Details:</small>
                        <div className="text-break">
                          <code className="text-primary">{getTaskDetails(task)}</code>
                        </div>
                      </div>

                      {task.libraries && task.libraries.length > 0 && (
                        <div className="mb-2">
                          <small className="text-muted">Libraries:</small>
                          <div className="d-flex gap-1 flex-wrap mt-1">
                            {task.libraries.map((lib, i) => (
                              <Badge key={i} bg="info" pill>
                                {lib.pypi?.package || lib.maven?.coordinates || lib.jar || lib.whl || "Library"}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {task.timeout_seconds && (
                        <div>
                          <small className="text-muted">
                            <BiTime className="me-1" />
                            Timeout: {formatDuration(task.timeout_seconds * 1000)}
                          </small>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                ))}
              </div>
            )}
          </Tab>

          {/* Runs Tab */}
          <Tab eventKey="runs" title="Runs">
            {loading ? (
              <div className="text-center py-4">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : jobRuns.length === 0 ? (
              <Alert variant="info">No run history available.</Alert>
            ) : (
              <div className="d-grid gap-2">
                {jobRuns.map((run) => (
                  <Card key={run.run_id}>
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                          <h6 className="mb-2">
                            Run #{run.run_id}
                            {run.run_page_url && (
                              <a
                                href={run.run_page_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ms-2"
                              >
                                <BiLinkExternal size={16} />
                              </a>
                            )}
                          </h6>
                          <div className="d-flex gap-2 flex-wrap">
                            {getRunStateBadge(run.life_cycle_state, run.result_state)}
                            {run.trigger && (
                              <Badge bg="secondary">
                                Trigger: {run.trigger}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-end">
                          <small className="text-muted d-block">
                            {moment(run.start_time).format("MMM DD, YYYY HH:mm")}
                          </small>
                          <small className="text-muted">
                            Duration: {getDuration(run.start_time, run.end_time)}
                          </small>
                        </div>
                      </div>

                      {/* Timing Breakdown */}
                      <div className="mb-2">
                        <Row className="g-2">
                          {run.setup_duration && (
                            <Col xs={4}>
                              <small className="text-muted d-block">Setup</small>
                              <small>{formatDuration(run.setup_duration)}</small>
                            </Col>
                          )}
                          {run.execution_duration && (
                            <Col xs={4}>
                              <small className="text-muted d-block">Execution</small>
                              <small>{formatDuration(run.execution_duration)}</small>
                            </Col>
                          )}
                          {run.cleanup_duration && (
                            <Col xs={4}>
                              <small className="text-muted d-block">Cleanup</small>
                              <small>{formatDuration(run.cleanup_duration)}</small>
                            </Col>
                          )}
                        </Row>
                      </div>

                      {/* Cluster Info */}
                      {run.cluster_instance && (
                        <div className="mb-2">
                          <small className="text-muted">
                            <BiServer className="me-1" />
                            Cluster: {run.cluster_instance.cluster_id || "N/A"}
                          </small>
                        </div>
                      )}

                      {/* Error Message */}
                      {run.error_message && (
                        <Alert variant="danger" className="mb-0 mt-2">
                          <small>
                            <strong>Error:</strong> {run.error_message}
                          </small>
                        </Alert>
                      )}
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

export default JobOffcanvasEnhanced;
