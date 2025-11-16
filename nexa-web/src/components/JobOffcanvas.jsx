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
} from "react-icons/bi";
import axios from "axios";
import moment from "moment";

const JobOffcanvas = ({ show, handleClose, jobId, jobStatus }) => {
  const [collapseOpen, setCollapseOpen] = useState(false);
  const [jobDetails, setJobDetails] = useState({});
  const [jobLogs, setJobLogs] = useState([]);

  const getJobDetails = async () => {
    const response = await axios.get(
      `${import.meta.env.VITE_LLM_URL}/api/v1/jobs/${jobId}`
    );
    if (response.status == 200) {
      setJobDetails(response.data);
    }
  };

  const getJobLogs = async () => {
    const response = await axios.get(
      `${import.meta.env.VITE_LLM_URL}/api/v1/jobs/${jobId}/runs`
    );
    console.log(response?.data?.runs);
    if (response?.status == 200) {
      setJobLogs(response?.data?.runs);
    }
  };

  const getDuration = (start, end) => {
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

  useEffect(() => {
    if (jobId != null || jobId != undefined) {
      getJobDetails();
      getJobLogs();
    }
  }, [jobId]);

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
            {jobStatus == "failed" ? (
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
          defaultActiveKey="job-details"
          className="mb-4 justify-content-start position-sticky bg-white"
        >
          {/* Job Details - Start */}
          <Tab eventKey="job-details" title="Jobs Details">
            <Row className="g-3">
              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title d-flex gap-2 align-item-center mb-3">
                    <h5 className="fw-medium text-medium m-0">Job ID</h5>
                  </div>
                  <div className="data-value d-flex gap-2 align-items-center text-muted">
                    <BiSolidCheckCircle color={"#2E7D32"} size={20} />{" "}
                    {jobDetails?.job_id}
                  </div>
                </div>
              </Col>
              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title d-flex gap-2 align-item-center mb-3">
                    <h5 className="fw-medium text-medium m-0">Creator</h5>
                  </div>
                  <div className="data-value d-flex gap-2 align-items-center text-muted">
                    <BiUser size={20} />{" "}
                    <span>{jobDetails?.creator_user_name}</span>
                  </div>
                </div>
              </Col>
              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title d-flex gap-2 align-item-center mb-3">
                    <h5 className="fw-medium text-medium m-0">Run as</h5>
                    <OverlayTrigger
                      placement="right"
                      overlay={
                        <Tooltip>
                          Lorem ipsum dolor sit amet consectetur adipisicing
                          elit.
                        </Tooltip>
                      }
                    >
                      <Button variant="outline-secondary btn-icon-info">
                        !
                      </Button>
                    </OverlayTrigger>

                    <Button className="h-auto p-0 ms-auto" variant="default">
                      <BiPencil size={18} />
                    </Button>
                  </div>

                  <div className="data-value d-flex gap-2 align-items-center text-muted">
                    <BiUser size={20} />{" "}
                    <span>{jobDetails?.run_as_user_name}</span>
                  </div>
                </div>
              </Col>
              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title d-flex gap-2 align-item-center mb-3">
                    <h5 className="fw-medium text-medium m-0">Tags</h5>
                    <OverlayTrigger
                      placement="right"
                      overlay={
                        <Tooltip>
                          Lorem ipsum dolor sit amet consectetur adipisicing
                          elit.
                        </Tooltip>
                      }
                    >
                      <Button variant="outline-secondary btn-icon-info">
                        !
                      </Button>
                    </OverlayTrigger>
                  </div>
                  <div className="data-value d-flex gap-2 align-items-center text-muted">
                    {Object?.values?.(jobDetails?.tags || {})?.map(
                      (tag, index) => (
                        <div className="d-flex gap-2">
                          <Badge bg="primary" pill key={index}>
                            {tag}
                          </Badge>
                        </div>
                      )
                    )}
                    <a href="#">+ Add Tag</a>
                  </div>
                </div>
              </Col>
              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title d-flex gap-2 align-item-center mb-3">
                    <h5 className="fw-medium text-medium m-0">Description</h5>
                  </div>
                  <div className="data-value d-flex gap-2 align-items-center text-muted">
                    <a href="#">+ Add Description</a>
                  </div>
                </div>
              </Col>
              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title d-flex gap-2 align-item-center mb-3">
                    <h5 className="fw-medium text-medium m-0">Lineage</h5>
                    <OverlayTrigger
                      placement="right"
                      overlay={
                        <Tooltip>
                          Lorem ipsum dolor sit amet consectetur adipisicing
                          elit.
                        </Tooltip>
                      }
                    >
                      <Button variant="outline-secondary btn-icon-info">
                        !
                      </Button>
                    </OverlayTrigger>
                  </div>
                  <div className="data-value d-flex gap-2 align-items-center text-muted">
                    No Lineage information for this job.
                  </div>
                </div>
              </Col>
              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title d-flex gap-2 align-item-center mb-3">
                    <h5 className="fw-medium text-medium m-0">
                      Git <span className="text-muted">(Not Configured)</span>
                    </h5>
                  </div>
                  <div className="data-value d-flex gap-2 align-items-center text-muted">
                    <a href="#">+ Add Git settings</a>
                  </div>
                </div>
              </Col>
              <Col md={6}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title d-flex gap-2 align-item-center mb-3">
                    <h5 className="fw-medium text-medium m-0">
                      Jira Ticket ID
                    </h5>
                  </div>
                  <div className="data-value d-flex gap-2 align-items-center text-muted">
                    Ticket ID: 873HDRR
                  </div>
                </div>
              </Col>
              <Col md={12}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title d-flex gap-2 align-item-center mb-3">
                    <h5 className="fw-medium text-medium m-0">
                      Schedules & Triggers
                    </h5>
                    <OverlayTrigger
                      placement="right"
                      overlay={
                        <Tooltip>
                          Lorem ipsum dolor sit amet consectetur adipisicing
                          elit.
                        </Tooltip>
                      }
                    >
                      <Button variant="outline-secondary btn-icon-info">
                        !
                      </Button>
                    </OverlayTrigger>
                  </div>
                  <div className="data-value d-flex gap-2 align-items-center text-muted">
                    {jobDetails?.schedule_interval + " " + jobDetails?.schedule}
                  </div>
                </div>
              </Col>
              <Col md={12}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title d-flex gap-2 align-item-center mb-3">
                    <h5 className="fw-medium text-medium m-0">
                      NL Description
                    </h5>
                    <OverlayTrigger
                      placement="right"
                      overlay={
                        <Tooltip>
                          Lorem ipsum dolor sit amet consectetur adipisicing
                          elit.
                        </Tooltip>
                      }
                    >
                      <Button variant="outline-secondary btn-icon-info">
                        !
                      </Button>
                    </OverlayTrigger>
                  </div>
                  <div className="data-value d-flex gap-2 align-items-center text-muted">
                    Lorem, ipsum dolor sit amet consectetur adipisicing elit.
                    Deleniti quasi consequuntur, porro voluptatem voluptatum
                    illum a veniam nemo non tenetur.
                  </div>
                </div>
              </Col>
              <Col md={12}>
                <div className="job-item border rounded-3 p-3">
                  <div className="data-title d-flex gap-2 align-item-center mb-3">
                    <h5 className="fw-medium text-medium m-0">
                      Additional Comments
                    </h5>
                  </div>
                  <div className="data-value d-flex gap-2 align-items-center text-muted">
                    <div className="job-comments d-flex flex-column gap-3">
                      <div className="job-comments-item">
                        <p className="comment-text m-0">
                          Lorem, ipsum dolor sit amet consectetur adipisicing
                          elit. Sunt, animi.
                        </p>
                        <span className="comment-date text-small">
                          July 15, 2025, 11:29 AM
                        </span>
                      </div>
                      <div className="job-comments-item">
                        <p className="comment-text m-0">
                          Lorem, ipsum dolor sit amet consectetur adipisicing
                          elit. Sunt, animi.
                        </p>
                        <span className="comment-date text-small">
                          July 15, 2025, 11:29 AM
                        </span>
                      </div>
                      <div className="job-comments-item">
                        <p className="comment-text m-0">
                          Lorem, ipsum dolor sit amet consectetur adipisicing
                          elit. Sunt, animi.
                        </p>
                        <span className="comment-date text-small">
                          July 15, 2025, 11:29 AM
                        </span>
                      </div>
                      <a href="#">+ Add Comments</a>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          </Tab>
          {/* Job Details - End */}

          {/* Job Logs - Start */}
          <Tab eventKey="job-logs" title="Logs">
            <div className="logs d-grid gap-3">
              {jobLogs.map((item) => (
                <a
                  href={item?.run_page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="logs-item border p-3 rounded-3 d-flex gap-3">
                    <div>
                      {true ? (
                        <Badge bg="danger">
                          <BiSolidXCircle color="#D32F2F" size={20} />
                        </Badge>
                      ) : (
                        <Badge bg="success">
                          <BiSolidCheckCircle color="#2E7D32" size={20} />
                        </Badge>
                      )}
                    </div>
                    <div>
                      <h5 className="fw-medium text-medium">
                        {moment(item?.created_time).format(
                          "YYYY-MM-DD HH:mm:00"
                        )}
                      </h5>
                      <p className="m-0 text-muted">
                        {item?.error_message || "Job completed successfully"}
                      </p>
                    </div>
                    <span className="text-muted ms-auto text-nowrap">
                      {getDuration(item?.start_time, item?.end_time)}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </Tab>
          {/* Job Logs - End */}
        </Tabs>
      </Offcanvas.Body>
    </Offcanvas>
  );
};

export default JobOffcanvas;
