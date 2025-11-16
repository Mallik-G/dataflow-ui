import React, { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Form,
  Table,
  Badge,
  Spinner,
  Alert,
} from "react-bootstrap";
import { BiSearch, BiX, BiCopyAlt, BiEdit, BiTrash } from "react-icons/bi";
import axios from "axios";

const CanvasAcceptedTransformations = ({ show, onHide, entityName }) => {
  const [transformations, setTransformations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTransformation, setSelectedTransformation] = useState(null);
  const [editingTransformation, setEditingTransformation] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Fetch accepted transformations
  const fetchTransformations = async () => {
    setLoading(true);
    try {
      // Mock data for now - replace with actual API call
      const mockTransformations = [
        {
          id: 1,
          name: "Customer Data Transformation",
          description: "Transform raw customer data into curated format",
          sqlCode: `-- Customer transformation SQL
SELECT 
  customer_id,
  UPPER(customer_name) as customer_name,
  LOWER(email) as email,
  created_date
FROM raw_customers
WHERE status = 'active';`,
          pysparkCode: `# Customer transformation PySpark
from pyspark.sql.functions import upper, lower, col

def transform_customers(df):
    return df.select(
        col("customer_id"),
        upper(col("customer_name")).alias("customer_name"),
        lower(col("email")).alias("email"),
        col("created_date")
    ).filter(col("status") == "active")`,
          status: "accepted",
          createdAt: "2024-01-15T10:30:00Z",
          entityName: entityName || "customers",
        },
        {
          id: 2,
          name: "Order Aggregation",
          description: "Aggregate order data by customer and date",
          sqlCode: `-- Order aggregation SQL
SELECT 
  customer_id,
  DATE(order_date) as order_date,
  COUNT(*) as total_orders,
  SUM(order_amount) as total_amount
FROM raw_orders
GROUP BY customer_id, DATE(order_date);`,
          pysparkCode: `# Order aggregation PySpark
from pyspark.sql.functions import date_format, count, sum, col

def aggregate_orders(df):
    return df.groupBy(
        col("customer_id"),
        date_format(col("order_date"), "yyyy-MM-dd").alias("order_date")
    ).agg(
        count("*").alias("total_orders"),
        sum("order_amount").alias("total_amount")
    )`,
          status: "accepted",
          createdAt: "2024-01-14T15:45:00Z",
          entityName: entityName || "orders",
        },
      ];

      setTransformations(mockTransformations);
    } catch (error) {
      console.error("Error fetching transformations:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load transformations when component mounts
  useEffect(() => {
    if (show) {
      fetchTransformations();
    }
  }, [show, entityName]);

  // Filter transformations based on search term
  const filteredTransformations = transformations.filter(
    (transformation) =>
      transformation.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transformation.description
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      transformation.entityName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Copy code to clipboard
  const copyToClipboard = (content, type) => {
    navigator.clipboard.writeText(content);
    alert(`${type} code copied to clipboard!`);
  };

  // Edit transformation
  const handleEdit = (transformation) => {
    setEditingTransformation({ ...transformation });
    setIsEditing(true);
  };

  // Save edited transformation
  const handleSaveEdit = async () => {
    if (!editingTransformation) return;

    try {
      // Mock API call - replace with actual update
      setTransformations((prev) =>
        prev.map((t) =>
          t.id === editingTransformation.id ? editingTransformation : t
        )
      );

      setEditingTransformation(null);
      setIsEditing(false);
      alert("Transformation updated successfully!");
    } catch (error) {
      console.error("Error updating transformation:", error);
      alert("Failed to update transformation");
    }
  };

  // Delete transformation
  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this transformation?"))
      return;

    try {
      // Mock API call - replace with actual delete
      setTransformations((prev) => prev.filter((t) => t.id !== id));
      alert("Transformation deleted successfully!");
    } catch (error) {
      console.error("Error deleting transformation:", error);
      alert("Failed to delete transformation");
    }
  };

  // View transformation details
  const handleView = (transformation) => {
    setSelectedTransformation(transformation);
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      {/* Main Modal */}
      <Modal size="xl" show={show} onHide={onHide} centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title>
            📁 Accepted Transformations
            {entityName && (
              <Badge bg="info" className="ms-2">
                {entityName}
              </Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Search Bar */}
          <div className="mb-4">
            <div className="position-relative d-inline-block w-100">
              <Form.Control
                size="lg"
                aria-label="Search transformations"
                placeholder="Search transformations by name, description, or entity..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="ps-4 pe-4"
              />
              <div
                className="position-absolute start-0 top-50 translate-middle-y d-flex align-items-center justify-content-center"
                style={{
                  width: "38px",
                  height: "38px",
                  pointerEvents: "none",
                }}
              >
                <BiSearch size={18} />
              </div>
              {searchTerm && (
                <div
                  className="position-absolute end-0 top-50 translate-middle-y d-flex align-items-center justify-content-center cursor-pointer"
                  style={{
                    width: "38px",
                    height: "38px",
                    cursor: "pointer",
                  }}
                  onClick={() => setSearchTerm("")}
                  title="Clear search"
                >
                  <BiX size={20} />
                </div>
              )}
            </div>
          </div>

          {/* Transformations List */}
          {loading ? (
            <div className="text-center p-5">
              <Spinner animation="border" size="lg" />
              <p className="mt-3 text-muted">Loading transformations...</p>
            </div>
          ) : filteredTransformations.length === 0 ? (
            <Alert variant="info" className="text-center">
              {searchTerm
                ? "No transformations found matching your search."
                : "No accepted transformations found."}
            </Alert>
          ) : (
            <div className="transformations-list">
              {filteredTransformations.map((transformation) => (
                <div
                  key={transformation.id}
                  className="transformation-item border rounded p-3 mb-3"
                >
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="flex-grow-1">
                      <h6 className="mb-1 text-primary">
                        {transformation.name}
                      </h6>
                      <p className="text-muted mb-2 small">
                        {transformation.description}
                      </p>
                      <div className="d-flex gap-3 align-items-center">
                        <Badge bg="success">{transformation.status}</Badge>
                        <Badge bg="secondary">
                          {transformation.entityName}
                        </Badge>
                        <small className="text-muted">
                          Created: {formatDate(transformation.createdAt)}
                        </small>
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handleView(transformation)}
                        title="View details"
                      >
                        View
                      </Button>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => handleEdit(transformation)}
                        title="Edit transformation"
                      >
                        <BiEdit size={14} />
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDelete(transformation.id)}
                        title="Delete transformation"
                      >
                        <BiTrash size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* View Transformation Details Modal */}
      <Modal
        size="xl"
        show={!!selectedTransformation}
        onHide={() => setSelectedTransformation(null)}
        centered
        scrollable
      >
        <Modal.Header closeButton>
          <Modal.Title>{selectedTransformation?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedTransformation && (
            <>
              <div className="mb-4">
                <h6>Description</h6>
                <p className="text-muted">
                  {selectedTransformation.description}
                </p>
                <div className="d-flex gap-3">
                  <Badge bg="success">{selectedTransformation.status}</Badge>
                  <Badge bg="secondary">
                    {selectedTransformation.entityName}
                  </Badge>
                  <small className="text-muted">
                    Created: {formatDate(selectedTransformation.createdAt)}
                  </small>
                </div>
              </div>

              {/* SQL Code */}
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6>🔗 SQL Code</h6>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(selectedTransformation.sqlCode, "SQL")
                    }
                  >
                    <BiCopyAlt /> Copy
                  </Button>
                </div>
                <pre
                  style={{
                    background: "#f8f9fa",
                    padding: "1rem",
                    borderRadius: "4px",
                    fontSize: "12px",
                    maxHeight: "300px",
                    overflow: "auto",
                    fontFamily: "monospace",
                    border: "1px solid #dee2e6",
                  }}
                >
                  {selectedTransformation.sqlCode}
                </pre>
              </div>

              {/* PySpark Code */}
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6>🐍 PySpark Code</h6>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(
                        selectedTransformation.pysparkCode,
                        "PySpark"
                      )
                    }
                  >
                    <BiCopyAlt /> Copy
                  </Button>
                </div>
                <pre
                  style={{
                    background: "#f8f9fa",
                    padding: "1rem",
                    borderRadius: "4px",
                    fontSize: "12px",
                    maxHeight: "300px",
                    overflow: "auto",
                    fontFamily: "monospace",
                    border: "1px solid #dee2e6",
                  }}
                >
                  {selectedTransformation.pysparkCode}
                </pre>
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>

      {/* Edit Transformation Modal */}
      <Modal
        size="xl"
        show={isEditing}
        onHide={() => {
          setIsEditing(false);
          setEditingTransformation(null);
        }}
        centered
        scrollable
      >
        <Modal.Header closeButton>
          <Modal.Title>Edit Transformation</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editingTransformation && (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Name</Form.Label>
                <Form.Control
                  type="text"
                  value={editingTransformation.name}
                  onChange={(e) =>
                    setEditingTransformation({
                      ...editingTransformation,
                      name: e.target.value,
                    })
                  }
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={editingTransformation.description}
                  onChange={(e) =>
                    setEditingTransformation({
                      ...editingTransformation,
                      description: e.target.value,
                    })
                  }
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>SQL Code</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={10}
                  value={editingTransformation.sqlCode}
                  onChange={(e) =>
                    setEditingTransformation({
                      ...editingTransformation,
                      sqlCode: e.target.value,
                    })
                  }
                  style={{ fontFamily: "monospace", fontSize: "12px" }}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>PySpark Code</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={10}
                  value={editingTransformation.pysparkCode}
                  onChange={(e) =>
                    setEditingTransformation({
                      ...editingTransformation,
                      pysparkCode: e.target.value,
                    })
                  }
                  style={{ fontFamily: "monospace", fontSize: "12px" }}
                />
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setIsEditing(false);
              setEditingTransformation(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveEdit}
            disabled={!editingTransformation?.name?.trim()}
          >
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default CanvasAcceptedTransformations;
