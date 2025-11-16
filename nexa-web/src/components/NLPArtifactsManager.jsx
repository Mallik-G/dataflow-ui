import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  BiFolder,
  BiFile,
  BiEdit,
  BiTrash,
  BiShow,
  BiRefresh,
} from "react-icons/bi";
import {
  Modal,
  Button,
  Table,
  Badge,
  Card,
  Row,
  Col,
  Form,
  Alert,
  Spinner,
  Pagination,
  Accordion,
  Tabs,
  Tab,
} from "react-bootstrap";

const NLPArtifactsManager = ({ show, onHide, entityName = null }) => {
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedArtifact, setSelectedArtifact] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingArtifact, setEditingArtifact] = useState(null);
  const [stats, setStats] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("accepted");

  // Fetch artifacts on component mount
  useEffect(() => {
    if (show) {
      fetchArtifacts();
      fetchStats();
    }
  }, [show, currentPage, searchTerm, filterStatus, entityName]);

  const fetchArtifacts = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = "/api/nlp-artifacts";
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        status: filterStatus,
      });

      if (entityName) {
        url = `/api/nlp-artifacts/entity/${entityName}`;
      } else {
        if (searchTerm) {
          params.append("search", searchTerm);
        }
      }

      const response = await axios.get(`${url}?${params}`);

      if (response.data.success) {
        if (entityName) {
          setArtifacts(response.data.data);
          setTotalPages(1);
        } else {
          setArtifacts(response.data.data.artifacts);
          setTotalPages(response.data.data.pagination.totalPages);
        }
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      console.error("Error fetching NLP artifacts:", error);
      setError("Failed to fetch NLP artifacts");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get("/api/nlp-artifacts/stats");
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleViewArtifact = (artifact) => {
    setSelectedArtifact(artifact);
    setShowViewModal(true);
  };

  const handleEditArtifact = (artifact) => {
    setEditingArtifact(artifact);
    setShowEditModal(true);
  };

  const handleDeleteArtifact = async (artifactId) => {
    if (window.confirm("Are you sure you want to delete this NLP artifact?")) {
      try {
        const response = await axios.delete(`/api/nlp-artifacts/${artifactId}`);
        if (response.data.success) {
          fetchArtifacts();
          fetchStats();
        } else {
          setError(response.data.message);
        }
      } catch (error) {
        console.error("Error deleting artifact:", error);
        setError("Failed to delete artifact");
      }
    }
  };

  const handleUpdateArtifact = async (updatedData) => {
    try {
      const response = await axios.put(
        `/api/nlp-artifacts/${editingArtifact.id}`,
        updatedData
      );
      if (response.data.success) {
        setShowEditModal(false);
        setEditingArtifact(null);
        fetchArtifacts();
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      console.error("Error updating artifact:", error);
      setError("Failed to update artifact");
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status) => {
    const variants = {
      accepted: "success",
      archived: "warning",
      deleted: "danger",
    };
    return <Badge bg={variants[status] || "secondary"}>{status}</Badge>;
  };

  const renderArtifactsTable = () => {
    if (loading) {
      return (
        <div className="text-center py-4">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      );
    }

    if (error) {
      return <Alert variant="danger">{error}</Alert>;
    }

    if (artifacts.length === 0) {
      return <Alert variant="info">No transformation artifacts found.</Alert>;
    }

    return (
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Entity</th>
            <th>Description</th>
            <th>Status</th>
            <th>Accepted At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {artifacts.map((artifact) => (
            <tr key={artifact.id}>
              <td>
                <strong>{artifact.entityName}</strong>
                <br />
                <small className="text-muted">
                  {artifact.curatedEntityName}
                </small>
              </td>
              <td>
                <div className="text-truncate" style={{ maxWidth: "300px" }}>
                  {artifact.nlpDescription}
                </div>
              </td>
              <td>{getStatusBadge(artifact.status)}</td>
              <td>
                {/* <Clock className="me-1" /> */}
                {formatDate(artifact.acceptedAt)}
              </td>
              <td>
                <Button
                  size="sm"
                  variant="outline-primary"
                  className="me-1"
                  onClick={() => handleViewArtifact(artifact)}
                >
                  <BiShow />
                </Button>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  className="me-1"
                  onClick={() => handleEditArtifact(artifact)}
                >
                  <BiEdit />
                </Button>
                <Button
                  size="sm"
                  variant="outline-danger"
                  onClick={() => handleDeleteArtifact(artifact.id)}
                >
                  <BiTrash />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  const renderStats = () => {
    if (!stats) return null;

    return (
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>{stats.total}</Card.Title>
              <Card.Text>Total Artifacts</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>{stats.accepted}</Card.Title>
              <Card.Text>Accepted</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>{stats.archived}</Card.Title>
              <Card.Text>Archived</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>{stats.deleted}</Card.Title>
              <Card.Text>Deleted</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    );
  };

  return (
    <>
      <Modal show={show} onHide={onHide} size="xl" dialogClassName="modal-xl">
        <Modal.Header closeButton>
          <Modal.Title>
            <BiFolder className="me-2" />
            Accepted Transformations
            {entityName && (
              <Badge bg="info" className="ms-2">
                {entityName}
              </Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {renderStats()}

          <Row className="mb-3">
            {/* <Col md={6}>
              <Form.Control
                type="text"
                placeholder="Search artifacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Col> */}
            <Col md={3}>
              <Form.Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="accepted">Accepted</option>
                {/* <option value="archived">Archived</option> */}
                <option value="deleted">Deleted</option>
              </Form.Select>
            </Col>
            <Col md={3}>
              <Button variant="outline-secondary" onClick={fetchArtifacts}>
                <BiRefresh className="me-1" />
                Refresh
              </Button>
            </Col>
          </Row>

          {renderArtifactsTable()}

          {totalPages > 1 && (
            <div className="d-flex justify-content-center mt-3">
              <Pagination>
                <Pagination.First
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                />
                <Pagination.Prev
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                />

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, currentPage - 2) + i;
                  if (pageNum > totalPages) return null;

                  return (
                    <Pagination.Item
                      key={pageNum}
                      active={pageNum === currentPage}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Pagination.Item>
                  );
                })}

                <Pagination.Next
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                />
                <Pagination.Last
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                />
              </Pagination>
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* View Artifact Modal */}
      <Modal
        show={showViewModal}
        onHide={() => setShowViewModal(false)}
        size="xl"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <BiFile className="me-2" />
            NLP Artifact Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedArtifact && (
            <Tabs defaultActiveKey="details" className="mb-3">
              <Tab eventKey="details" title="Details">
                <Row>
                  <Col md={6}>
                    <h6>Entity Information</h6>
                    <p>
                      <strong>Entity Name:</strong>{" "}
                      {selectedArtifact.entityName}
                    </p>
                    <p>
                      <strong>Curated Entity:</strong>{" "}
                      {selectedArtifact.curatedEntityName}
                    </p>
                    <p>
                      <strong>Status:</strong>{" "}
                      {getStatusBadge(selectedArtifact.status)}
                    </p>
                    <p>
                      <strong>Accepted At:</strong>{" "}
                      {formatDate(selectedArtifact.acceptedAt)}
                    </p>
                    <p>
                      <strong>Created By:</strong> {selectedArtifact.createdBy}
                    </p>
                  </Col>
                  <Col md={6}>
                    <h6>Description</h6>
                    <p>{selectedArtifact.nlpDescription}</p>
                    {selectedArtifact.notes && (
                      <>
                        <h6>Notes</h6>
                        <p>{selectedArtifact.notes}</p>
                      </>
                    )}
                  </Col>
                </Row>
              </Tab>
              <Tab eventKey="sql" title="SQL Code">
                <pre className="bg-light p-3 rounded">
                  <code>
                    {selectedArtifact.sqlCode || "No SQL code available"}
                  </code>
                </pre>
              </Tab>
              <Tab eventKey="pyspark" title="PySpark Code">
                <pre className="bg-light p-3 rounded">
                  <code>
                    {selectedArtifact.pysparkCode ||
                      "No PySpark code available"}
                  </code>
                </pre>
              </Tab>
              <Tab eventKey="columns" title="Entity Columns">
                <ul>
                  {selectedArtifact.entityColumns?.map((column, index) => (
                    <li key={index}>{column}</li>
                  )) || <li>No columns available</li>}
                </ul>
              </Tab>
            </Tabs>
          )}
        </Modal.Body>
      </Modal>

      {/* Edit Artifact Modal */}
      <Modal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <BiEdit className="me-2" />
            Edit NLP Artifact
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editingArtifact && (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>NLP Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={editingArtifact.nlpDescription}
                  onChange={(e) =>
                    setEditingArtifact({
                      ...editingArtifact,
                      nlpDescription: e.target.value,
                    })
                  }
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>SQL Code</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={5}
                  value={editingArtifact.sqlCode}
                  onChange={(e) =>
                    setEditingArtifact({
                      ...editingArtifact,
                      sqlCode: e.target.value,
                    })
                  }
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>PySpark Code</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={5}
                  value={editingArtifact.pysparkCode}
                  onChange={(e) =>
                    setEditingArtifact({
                      ...editingArtifact,
                      pysparkCode: e.target.value,
                    })
                  }
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Notes</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={editingArtifact.notes || ""}
                  onChange={(e) =>
                    setEditingArtifact({
                      ...editingArtifact,
                      notes: e.target.value,
                    })
                  }
                />
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => handleUpdateArtifact(editingArtifact)}
          >
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default NLPArtifactsManager;
