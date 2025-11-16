import React, { useState, useEffect } from "react";
import {
  Offcanvas,
  Form,
  Button,
  Table,
  Badge,
  Alert,
  Spinner,
  Row,
  Col,
  Card,
} from "react-bootstrap";
import {
  BiGitRepoForked,
  BiFile,
  BiShow,
  BiTrash,
  BiSolidData,
} from "react-icons/bi";

// Common entity component function for displaying entity information in a card format
const EntityInfoCard = ({
  entityName,
  connectors = ["Customer Data Sync", "Product Catalog", "Revenue Forecast"],
  onClose,
  style = {},
}) => {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "12px",
        border: "1px solid #e2e8f0",
        boxShadow:
          "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        overflow: "hidden",
        minWidth: "320px",
        maxWidth: "400px",
        ...style,
      }}
    >
      {/* Header with entity name and icon */}
      <div
        style={{
          background: "#f8fafc",
          padding: "16px 20px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <BiSolidData size={20} />

        <h4
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: "600",
            color: "#1e293b",
            flex: 1,
          }}
        >
          {entityName}
        </h4>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              color: "#64748b",
              padding: "4px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
            }}
            onMouseEnter={(e) => {
              e.target.style.color = "#ef4444";
              e.target.style.background = "#fef2f2";
            }}
            onMouseLeave={(e) => {
              e.target.style.color = "#64748b";
              e.target.style.background = "none";
            }}
            title="Close"
          >
            ×
          </button>
        )}
      </div>

      {/* Body with connectors */}
      <div
        style={{
          padding: "20px",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            marginBottom: "16px",
          }}
        >
          <h5
            style={{
              margin: "0 0 12px 0",
              fontSize: "14px",
              fontWeight: "600",
              color: "#374151",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Connectors
          </h5>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            {connectors.map((connector, index) => (
              <div
                key={index}
                style={{
                  background: "#10b981",
                  color: "white",
                  padding: "6px 12px",
                  borderRadius: "16px",
                  fontSize: "12px",
                  fontWeight: "500",
                  display: "inline-block",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                }}
              >
                {connector}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ConsumptionEntityOffcanvas = ({
  show,
  onHide,
  action,
  entityData,
  allNodes,
  edges = [],
  onConfirmAction,
  columnDescriptions = {},
  viewRecordsData = {},
}) => {
  const [loading, setLoading] = useState(false);
  const [localColumnDescriptions, setLocalColumnDescriptions] = useState({});
  const [sampleRecords, setSampleRecords] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset state when action changes
  useEffect(() => {
    if (show) {
      setLoading(false);
      setLocalColumnDescriptions({});
      // Initialize sample records from persistent data
      const savedSampleRecords =
        viewRecordsData[entityData?.id]?.sampleRecords || [];
      setSampleRecords(savedSampleRecords);
      setConfirmDelete(false);
    }
  }, [show, action, entityData?.id, viewRecordsData]);

  const handleColumnDescription = async () => {
    setLoading(true);
    try {
      // Simulate API call to save descriptions
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (onConfirmAction) {
        // Check if this is for a single column or multiple columns
        const isSingleColumn = entityData?.column && !entityData?.attributes;

        if (isSingleColumn) {
          onConfirmAction("columnDescription", {
            entity: entityData,
            column: entityData.column,
            descriptions: localColumnDescriptions,
          });
        } else {
          onConfirmAction("columnDescription", {
            entity: entityData,
            descriptions: localColumnDescriptions,
          });
        }
      }
      onHide();
    } catch (error) {
      console.error("Error saving column descriptions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewRecords = async () => {
    setLoading(true);
    try {
      // Check if we have cached records
      const cachedRecords = viewRecordsData[entityData?.id]?.sampleRecords;
      if (cachedRecords) {
        setSampleRecords(cachedRecords);
        setLoading(false);
        return;
      }

      // Simulate API call to fetch records
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Generate sample records based on attributes
      const sample =
        entityData.attributes?.slice(0, 5).map((attr, index) => {
          const record = {};
          entityData.attributes.forEach((attribute) => {
            record[attribute.name] = `Sample ${attribute.name} ${index + 1}`;
          });
          return record;
        }) || [];

      setSampleRecords(sample);

      // Save to persistent state
      if (onConfirmAction) {
        onConfirmAction("viewRecords", {
          entity: entityData,
          sampleRecords: sample,
        });
      }
    } catch (error) {
      console.error("Error fetching records:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntity = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (onConfirmAction) {
        onConfirmAction("deleteEntity", {
          entityId: entityData.id,
          entityLabel: entityData.label,
        });
      }
      onHide();
    } catch (error) {
      console.error("Error deleting entity:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (action) {
      case "joinRelations":
        return "Join Relations";
      case "columnDescription":
        return "Column Description";
      case "viewRecords":
        return "View Records";
      case "deleteEntity":
        return "Delete Entity";
      default:
        return "Entity Action";
    }
  };

  const getIcon = () => {
    switch (action) {
      case "joinRelations":
        return <BiGitRepoForked size={20} />;
      case "columnDescription":
        return <BiFile size={20} />;
      case "viewRecords":
        return <BiShow size={20} />;
      case "deleteEntity":
        return <BiTrash size={20} />;
      default:
        return null;
    }
  };

  const renderJoinRelations = () => {
    // Find curated entities that are mapped to this consumption entity
    // Use the value property to maintain relationships even when labels change
    const mappedCuratedEntities = edges
      .filter(
        (edge) =>
          edge.data?.relationshipType === "field_mapping" &&
          (edge.target === entityData?.id ||
            edge.data?.targetEntity === entityData?.value)
      )
      .map((edge) => {
        const sourceNode = allNodes.find(
          (node) =>
            node.id === edge.source ||
            node.data?.value === edge.data?.sourceEntity
        );
        return sourceNode ? sourceNode.data : null;
      })
      .filter(Boolean);

    // Use the common EntityInfoCard component
    return (
      <EntityInfoCard
        entityName={entityData?.label || "Unknown Entity"}
        onClose={onHide}
      />
    );
  };

  const renderColumnDescription = () => {
    // Check if this is for a single column or multiple columns
    const isSingleColumn = entityData?.column && !entityData?.attributes;

    if (isSingleColumn) {
      // Single column description
      const column = entityData.column;
      return (
        <div>
          <Alert variant="info" className="mb-3">
            <strong>Entity:</strong> {entityData?.label}
            <br />
            <strong>Column:</strong> {column.name}
            <br />
            <strong>Type:</strong> {column.type || "string"}
            {column.isPrimaryKey && (
              <>
                <br />
                <strong>Primary Key</strong>
              </>
            )}
          </Alert>

          <div className="mb-3">
            <Form.Label>Edit column description:</Form.Label>
            <Form.Group className="mb-3">
              <Form.Label className="d-flex align-items-center gap-2">
                {column.name}
                <Badge bg={column.isPrimaryKey ? "primary" : "secondary"}>
                  {column.type || "string"}
                </Badge>
                {column.isPrimaryKey && <Badge bg="warning">PK</Badge>}
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                placeholder={`Enter description for ${column.name}`}
                value={
                  localColumnDescriptions[column.name] ||
                  columnDescriptions[`${entityData.id}-${column.name}`] ||
                  column.description ||
                  ""
                }
                onChange={(e) =>
                  setLocalColumnDescriptions({
                    ...localColumnDescriptions,
                    [column.name]: e.target.value,
                  })
                }
              />
            </Form.Group>
          </div>

          <div className="d-flex gap-2 justify-content-end">
            <Button variant="outline-secondary" onClick={onHide}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleColumnDescription}
              disabled={loading}
            >
              {loading ? <Spinner size="sm" /> : "Save Description"}
            </Button>
          </div>
        </div>
      );
    } else {
      // Multiple columns description (existing functionality)
      return (
        <div>
          <Alert variant="info" className="mb-3">
            <strong>Entity:</strong> {entityData?.label}
            <br />
            <strong>Columns:</strong> {entityData?.attributes?.length || 0}
          </Alert>

          <div className="mb-3">
            <Form.Label>Edit column descriptions:</Form.Label>
            {entityData?.attributes?.map((attr) => (
              <Form.Group key={attr.name} className="mb-3">
                <Form.Label className="d-flex align-items-center gap-2">
                  {attr.name}
                  <Badge bg={attr.isPrimaryKey ? "primary" : "secondary"}>
                    {attr.type || "string"}
                  </Badge>
                  {attr.isPrimaryKey && <Badge bg="warning">PK</Badge>}
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  placeholder={`Enter description for ${attr.name}`}
                  value={
                    localColumnDescriptions[attr.name] ||
                    columnDescriptions[entityData.id]?.[attr.name] ||
                    attr.description ||
                    ""
                  }
                  onChange={(e) =>
                    setLocalColumnDescriptions({
                      ...localColumnDescriptions,
                      [attr.name]: e.target.value,
                    })
                  }
                />
              </Form.Group>
            ))}
          </div>

          <div className="d-flex gap-2 justify-content-end">
            <Button variant="outline-secondary" onClick={onHide}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleColumnDescription}
              disabled={loading}
            >
              {loading ? <Spinner size="sm" /> : "Save Descriptions"}
            </Button>
          </div>
        </div>
      );
    }
  };

  const renderViewRecords = () => (
    <div>
      <Alert variant="info" className="mb-3">
        <strong>Entity:</strong> {entityData?.label}
        <br />
        <strong>Showing first 5 records</strong>
      </Alert>

      {loading ? (
        <div className="text-center py-4">
          <Spinner animation="border" />
          <p className="mt-2">Loading records...</p>
        </div>
      ) : sampleRecords.length > 0 ? (
        <div className="mb-3">
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                {entityData?.attributes?.map((attr) => (
                  <th key={attr.name}>{attr.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sampleRecords.map((record, index) => (
                <tr key={index}>
                  {entityData?.attributes?.map((attr) => (
                    <td key={attr.name}>{record[attr.name]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-4">
          <Button variant="primary" onClick={handleViewRecords}>
            Load Sample Records
          </Button>
        </div>
      )}

      <div className="d-flex gap-2 justify-content-end">
        <Button variant="outline-secondary" onClick={onHide}>
          Close
        </Button>
      </div>
    </div>
  );

  const renderDeleteEntity = () => (
    <div>
      {!confirmDelete ? (
        <>
          <Alert variant="warning" className="mb-3">
            <strong>Warning:</strong> This action cannot be undone.
          </Alert>

          <Card className="mb-3">
            <Card.Body>
              <h6>Entity Details:</h6>
              <p>
                <strong>Name:</strong> {entityData?.label}
              </p>
              <p>
                <strong>ID:</strong> {entityData?.id}
              </p>
              <p>
                <strong>Columns:</strong> {entityData?.attributes?.length || 0}
              </p>
              <p>
                <strong>Type:</strong>{" "}
                {entityData?.isConsumptionFile
                  ? "Consumption File"
                  : "Curated File"}
              </p>
            </Card.Body>
          </Card>

          <div className="d-flex gap-2 justify-content-end">
            <Button variant="outline-secondary" onClick={onHide}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteEntity}>
              Delete Entity
            </Button>
          </div>
        </>
      ) : (
        <>
          <Alert variant="danger" className="mb-3">
            <strong>Final Confirmation:</strong>
            <br />
            Are you absolutely sure you want to delete "{entityData?.label}"?
            <br />
            This will remove all mappings and relationships connected to this
            entity.
          </Alert>

          <div className="d-flex gap-2 justify-content-end">
            <Button
              variant="outline-secondary"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteEntity}
              disabled={loading}
            >
              {loading ? <Spinner size="sm" /> : "Confirm Delete"}
            </Button>
          </div>
        </>
      )}
    </div>
  );

  const renderContent = () => {
    switch (action) {
      case "joinRelations":
        return renderJoinRelations();
      case "columnDescription":
        return renderColumnDescription();
      case "viewRecords":
        return renderViewRecords();
      case "deleteEntity":
        return renderDeleteEntity();
      default:
        return <div>Invalid action</div>;
    }
  };

  // For join relations, render a modal popup instead of offcanvas
  if (action === "joinRelations") {
    const popupPosition = entityData?.popupPosition;

    // Calculate popup position
    let popupStyle = {
      position: "absolute",
      top: "50%",
      left: "60%",
      transform: "translateY(-50%)",
    };

    if (popupPosition) {
      // Check if popup would go off-screen to the right
      const popupWidth = 400; // maxWidth
      const screenWidth = window.innerWidth;
      const rightEdge = popupPosition.left + popupWidth;

      let leftPosition = popupPosition.left;

      // If popup would go off-screen to the right, position it to the left of the button
      if (rightEdge > screenWidth - 20) {
        leftPosition = popupPosition.left - popupWidth - 10;
      }

      // Ensure popup doesn't go off-screen to the left
      if (leftPosition < 20) {
        leftPosition = 20;
      }

      // Check vertical positioning
      const popupHeight = 300; // estimated height
      const screenHeight = window.innerHeight;
      const bottomEdge = popupPosition.top + popupHeight;

      let topPosition = popupPosition.top;

      // If popup would go off-screen to the bottom, position it above the button
      if (bottomEdge > screenHeight - 20) {
        topPosition = popupPosition.top - popupHeight - 10;
      }

      // Ensure popup doesn't go off-screen to the top
      if (topPosition < 20) {
        topPosition = 20;
      }

      popupStyle = {
        position: "absolute",
        top: `${topPosition}px`,
        left: `${leftPosition}px`,
        transform: "none",
      };
    }

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "transparent",
          display: show ? "block" : "none",
          zIndex: 1050,
        }}
        onClick={onHide}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            ...popupStyle,
            background: "white",
            borderRadius: "8px",
            maxWidth: "400px",
            width: "90%",
            maxHeight: "80vh",
            overflow: "auto",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
            border: "1px solid #e2e8f0",
          }}
        >
          {renderJoinRelations()}
        </div>
      </div>
    );
  }

  return (
    <Offcanvas
      show={show}
      onHide={onHide}
      placement="end"
      backdrop="static"
      className="size-lg"
    >
      <Offcanvas.Header closeButton>
        <Offcanvas.Title className="d-flex align-items-center gap-2">
          {getIcon()}
          {getTitle()}
        </Offcanvas.Title>
      </Offcanvas.Header>

      <Offcanvas.Body>{renderContent()}</Offcanvas.Body>
    </Offcanvas>
  );
};

export default ConsumptionEntityOffcanvas;
