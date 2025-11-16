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

const ConsumptionETLTransformationsManager = ({
  show,
  onHide,
  entityName = null,
}) => {
  const [transformations, setTransformations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTransformation, setSelectedTransformation] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransformation, setEditingTransformation] = useState(null);
  const [stats, setStats] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("accepted");

  // Fetch transformations on component mount
  useEffect(() => {
    if (show) {
      fetchTransformations();
      fetchStats();
    }
  }, [show, currentPage, searchTerm, filterStatus, entityName]);

  const fetchTransformations = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = "/api/consumption-etl/all";
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        status: filterStatus,
      });

      if (entityName) {
        url = `/api/consumption-etl/entity/${entityName}`;
      } else {
        if (searchTerm) {
          params.append("search", searchTerm);
        }
      }

      const response = await axios.get(`${url}?${params}`);

      if (response.data.success) {
        if (entityName) {
          setTransformations(response.data.data);
          setTotalPages(1);
        } else {
          setTransformations(response.data.data);
          setTotalPages(1); // API doesn't return pagination info, so default to 1
        }
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      console.error("Error fetching consumption ETL transformations:", error);
      setError("Failed to fetch consumption ETL transformations");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Since there's no stats endpoint, we'll calculate from the data
      const response = await axios.get("/api/consumption-etl/all");
      if (response.data.success) {
        const data = response.data.data;
        const stats = {
          total: data.length,
          accepted: data.filter((t) => t.status === "accepted").length,
          archived: data.filter((t) => t.status === "archived").length,
          deleted: data.filter((t) => t.status === "deleted").length,
        };
        setStats(stats);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleViewTransformation = (transformation) => {
    setSelectedTransformation(transformation);
    setShowViewModal(true);
  };

  const handleEditTransformation = (transformation) => {
    setEditingTransformation(transformation);
    setShowEditModal(true);
  };

  const handleDeleteTransformation = async (transformationId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this consumption ETL transformation?"
      )
    ) {
      try {
        const response = await axios.delete(
          `/api/consumption-etl/${transformationId}`
        );
        if (response.data.success) {
          fetchTransformations();
          fetchStats();
        } else {
          setError(response.data.message);
        }
      } catch (error) {
        console.error("Error deleting transformation:", error);
        setError("Failed to delete transformation");
      }
    }
  };

  const handleUpdateTransformation = async (updatedData) => {
    try {
      const response = await axios.put(
        `/api/consumption-etl/${editingTransformation.id}/status`,
        updatedData
      );
      if (response.data.success) {
        setShowEditModal(false);
        setEditingTransformation(null);
        fetchTransformations();
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      console.error("Error updating transformation:", error);
      setError("Failed to update transformation");
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
      draft: "secondary",
    };
    return <Badge bg={variants[status] || "secondary"}>{status}</Badge>;
  };

  const getTransformationTypeBadge = (type) => {
    const variants = {
      nlp: "primary",
      operator: "info",
      dq_rules: "warning",
      concatenation: "success",
      custom: "secondary",
    };
    return <Badge bg={variants[type] || "secondary"}>{type}</Badge>;
  };

  const renderTransformationsTable = () => {
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

    if (transformations.length === 0) {
      return (
        <Alert variant="info">No consumption ETL transformations found.</Alert>
      );
    }

    return (
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Entity</th>
            <th>Column</th>
            <th>Type</th>
            <th>Description</th>
            <th>Status</th>
            <th>Accepted At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {transformations.map((transformation) => (
            <tr key={transformation.id}>
              <td>
                <strong>{transformation.entityName}</strong>
              </td>
              <td>
                <Badge bg="light" text="dark">
                  {transformation.columnName}
                </Badge>
              </td>
              <td>
                {getTransformationTypeBadge(transformation.transformationType)}
              </td>
              <td>
                <div className="text-truncate" style={{ maxWidth: "300px" }}>
                  {transformation.nlpDescription || "No description"}
                </div>
              </td>
              <td>{getStatusBadge(transformation.status)}</td>
              <td>{formatDate(transformation.acceptedAt)}</td>
              <td>
                <Button
                  size="sm"
                  variant="outline-primary"
                  className="me-1"
                  onClick={() => handleViewTransformation(transformation)}
                >
                  <BiShow />
                </Button>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  className="me-1"
                  onClick={() => handleEditTransformation(transformation)}
                >
                  <BiEdit />
                </Button>
                <Button
                  size="sm"
                  variant="outline-danger"
                  onClick={() => handleDeleteTransformation(transformation.id)}
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
              <Card.Text>Total Transformations</Card.Text>
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
            Consumption ETL Transformations
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
            <Col md={3}>
              <Form.Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="accepted">Accepted</option>
                <option value="archived">Archived</option>
                <option value="deleted">Deleted</option>
                <option value="draft">Draft</option>
              </Form.Select>
            </Col>
            <Col md={3}>
              <Button
                variant="outline-secondary"
                onClick={fetchTransformations}
              >
                <BiRefresh className="me-1" />
                Refresh
              </Button>
            </Col>
          </Row>

          {renderTransformationsTable()}

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

      {/* View Transformation Modal */}
      <Modal
        show={showViewModal}
        onHide={() => setShowViewModal(false)}
        size="xl"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <BiFile className="me-2" />
            Consumption ETL Transformation Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedTransformation && (
            <Tabs defaultActiveKey="details" className="mb-3">
              <Tab eventKey="details" title="Details">
                <Row>
                  <Col md={6}>
                    <h6>Transformation Information</h6>
                    <p>
                      <strong>Entity Name:</strong>{" "}
                      {selectedTransformation.entityName}
                    </p>
                    <p>
                      <strong>Column Name:</strong>{" "}
                      {selectedTransformation.columnName}
                    </p>
                    <p>
                      <strong>Transformation Type:</strong>{" "}
                      {getTransformationTypeBadge(
                        selectedTransformation.transformationType
                      )}
                    </p>
                    <p>
                      <strong>Status:</strong>{" "}
                      {getStatusBadge(selectedTransformation.status)}
                    </p>
                    <p>
                      <strong>Version:</strong> {selectedTransformation.version}
                    </p>
                  </Col>
                  <Col md={6}>
                    <h6>Timestamps</h6>
                    <p>
                      <strong>Accepted At:</strong>{" "}
                      {formatDate(selectedTransformation.acceptedAt)}
                    </p>
                    <p>
                      <strong>Created By:</strong>{" "}
                      {selectedTransformation.createdBy}
                    </p>
                    {selectedTransformation.updatedBy && (
                      <p>
                        <strong>Updated By:</strong>{" "}
                        {selectedTransformation.updatedBy}
                      </p>
                    )}
                  </Col>
                </Row>
                <Row className="mt-3">
                  <Col md={12}>
                    <h6>Description</h6>
                    <p>
                      {selectedTransformation.nlpDescription ||
                        "No description available"}
                    </p>
                    {selectedTransformation.notes && (
                      <>
                        <h6>Notes</h6>
                        <p>{selectedTransformation.notes}</p>
                      </>
                    )}
                  </Col>
                </Row>
              </Tab>
              <Tab eventKey="sql" title="SQL Code">
                <pre className="bg-light p-3 rounded">
                  <code>
                    {selectedTransformation.sqlCode || "No SQL code available"}
                  </code>
                </pre>
              </Tab>
              <Tab eventKey="pyspark" title="PySpark Code">
                <pre className="bg-light p-3 rounded">
                  <code>
                    {selectedTransformation.pysparkCode ||
                      "No PySpark code available"}
                  </code>
                </pre>
              </Tab>
              <Tab eventKey="columns" title="Entity Columns">
                <ul>
                  {selectedTransformation.entityColumns?.map(
                    (column, index) => <li key={index}>{column}</li>
                  ) || <li>No columns available</li>}
                </ul>
              </Tab>
              <Tab eventKey="rules" title="Transformation Rules">
                <pre className="bg-light p-3 rounded">
                  <code>
                    {selectedTransformation.transformationRules
                      ? JSON.stringify(
                          selectedTransformation.transformationRules,
                          null,
                          2
                        )
                      : "No transformation rules available"}
                  </code>
                </pre>
              </Tab>
            </Tabs>
          )}
        </Modal.Body>
      </Modal>

      {/* Edit Transformation Modal */}
      <Modal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <BiEdit className="me-2" />
            Edit Consumption ETL Transformation
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editingTransformation && (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>NLP Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={editingTransformation.nlpDescription || ""}
                  onChange={(e) =>
                    setEditingTransformation({
                      ...editingTransformation,
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
                  value={editingTransformation.sqlCode || ""}
                  onChange={(e) =>
                    setEditingTransformation({
                      ...editingTransformation,
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
                  value={editingTransformation.pysparkCode || ""}
                  onChange={(e) =>
                    setEditingTransformation({
                      ...editingTransformation,
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
                  value={editingTransformation.notes || ""}
                  onChange={(e) =>
                    setEditingTransformation({
                      ...editingTransformation,
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
            onClick={() => handleUpdateTransformation(editingTransformation)}
          >
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ConsumptionETLTransformationsManager;
