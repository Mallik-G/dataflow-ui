import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from "react-flow-renderer";
import { Button } from "react-bootstrap";
import { BiPlus, BiCategory, BiBarChartAlt2 } from "react-icons/bi";

// Custom node for editable entity
function EntityNode({ id, data, selected, isConnectable }) {
  const [editing, setEditing] = useState(false);
  const [entityName, setEntityName] = useState(data.label);
  const [attributes, setAttributes] = useState(data.attributes || []);
  const [newAttr, setNewAttr] = useState("");
  const [newType, setNewType] = useState("string");
  const [scdType2, setSCDType2] = useState(data.scdType2 || false);

  // Add attribute
  const addAttr = () => {
    if (!newAttr.trim()) return;
    setAttributes((attrs) => [
      ...attrs,
      { name: newAttr, type: newType, isNew: true },
    ]);
    setNewAttr("");
    setNewType("string");
    data.onUpdate(
      id,
      entityName,
      [...attributes, { name: newAttr, type: newType, isNew: true }],
      true,
      scdType2
    );
  };

  // Remove attribute
  const removeAttr = (idx) => {
    const updated = attributes.filter((_, i) => i !== idx);
    setAttributes(updated);
    data.onUpdate(id, entityName, updated, true, scdType2);
  };

  // Save entity name
  const saveName = () => {
    setEditing(false);
    data.onUpdate(id, entityName, attributes, true, scdType2);
  };

  // Toggle SCD Type 2
  const toggleSCDType2 = () => {
    setSCDType2((val) => {
      data.onUpdate(id, entityName, attributes, true, !val);
      return !val;
    });
  };

  return (
    <div
      style={{
        background: data.isNewOrUpdated ? "#fff0fa" : "#f7f6ff",
        border: `2px solid ${data.isNewOrUpdated ? "#ff6bcb" : "#7366ff"}`,
        borderRadius: 12,
        padding: 15,
        minWidth: 200,
        maxWidth: 250,
        fontSize: 13,
        boxShadow: selected
          ? "0 0 0 2px #ff6bcb"
          : "0 4px 16px rgba(115,102,255,0.12)",
        position: "relative",
        transition: "all 0.2s ease",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: "#7366ff",
          width: 8,
          height: 8,
          border: "2px solid #fff",
          boxShadow: "0 0 0 2px #7366ff",
        }}
        isConnectable={isConnectable}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 8,
          justifyContent: "space-between",
          borderBottom: "2px solid rgba(115,102,255,0.1)",
          paddingBottom: 8,
        }}
      >
        {editing ? (
          <>
            <input
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              style={{
                fontWeight: 700,
                fontSize: 14,
                width: "80%",
                border: "2px solid #7366ff",
                borderRadius: 6,
                padding: "4px 8px",
                outline: "none",
              }}
              autoFocus
            />
            <button
              style={{
                marginLeft: 6,
                background: "#7366ff",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "4px 8px",
                cursor: "pointer",
              }}
              onClick={saveName}
            >
              Save
            </button>
          </>
        ) : (
          <>
            <span
              style={{
                fontWeight: 900,
                color: data.isNewOrUpdated ? "#ff6bcb" : "#7366ff",
                fontSize: 14,
              }}
            >
              {entityName}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button
              style={{
                fontSize: 11,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#7366ff",
              }}
              onClick={() => setEditing(true)}
                title="Edit entity name"
            >
              ✏️
            </button>
              <button
                style={{
                  fontSize: 11,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#dc3545",
                }}
                onClick={() => {
                  if (data.onDelete) {
                    data.onDelete({ id, label: entityName, data });
                  }
                }}
                title="Delete entity"
              >
                🗑️
              </button>
            </div>
          </>
        )}
        <button
          style={{
            marginLeft: 8,
            background: scdType2 ? "#ff6bcb" : "#eee",
            color: scdType2 ? "#fff" : "#7366ff",
            border: "none",
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          title="Mark as SCD Type 2"
          onClick={toggleSCDType2}
        >
          {scdType2 ? "SCD Type 2" : "Mark SCD2"}
        </button>
      </div>
      {scdType2 && (
        <div
          style={{
            color: "#ff6bcb",
            fontWeight: 900,
            fontSize: 12,
            marginBottom: 8,
            background: "#fff0fa",
            padding: "4px 8px",
            borderRadius: 6,
            display: "inline-block",
          }}
        >
          SCD Type 2
        </div>
      )}
      {data.isFileNode && (
        <div
          style={{
            background: data.isParentTable ? "#fff3cd" : "#e8f4fd",
            padding: "6px 8px",
            borderRadius: "6px",
            marginBottom: "8px",
            fontSize: "11px",
            color: data.isParentTable ? "#856404" : "#0066cc",
            fontWeight: "600",
            border: data.isParentTable ? "1px solid #ffeaa7" : "none",
          }}
        >
          {data.isParentTable ? "👑 Parent Table" : "📁 File Node"}
          {data.rawEntity && (
            <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>
              Raw: {data.rawEntity}
            </div>
          )}
          {data.curatedEntity && (
            <div style={{ fontSize: "10px", color: "#666" }}>
              Curated: {data.curatedEntity}
            </div>
          )}
          {data.primaryKey && (
            <div
              style={{ fontSize: "10px", color: "#28a745", fontWeight: "600" }}
            >
              PK: {data.primaryKey}
            </div>
          )}
          {data.recordCount > 0 && (
            <div style={{ fontSize: "10px", color: "#666" }}>
              Records: {data.recordCount.toLocaleString()}
            </div>
          )}
        </div>
      )}
      <div
        style={{
          fontWeight: 700,
          color: "#888",
          fontSize: 12,
          marginBottom: 8,
          marginTop: 8,
        }}
      >
        Attributes:
      </div>
      <ul
        style={{
          padding: 0,
          margin: 0,
          listStyle: "none",
          maxHeight: "200px",
          overflowY: "auto",
        }}
      >
        {attributes.map((attr, idx) => (
          <li
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 4,
              background: "#fff",
              padding: "4px 8px",
              borderRadius: 6,
              boxShadow: "0 1px 4px rgba(115,102,255,0.08)",
            }}
          >
            <span
              style={{
                color: attr.isPrimaryKey
                  ? "#28a745"
                  : attr.isNew
                  ? "#ff6bcb"
                  : "#7366ff",
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {attr.name}
              {attr.isPrimaryKey && (
                <span
                  style={{
                    fontSize: "10px",
                    color: "#28a745",
                    marginLeft: "4px",
                    fontWeight: "900",
                  }}
                >
                  🔑
                </span>
              )}
            </span>
            <span
              style={{
                color: "#aaa",
                fontSize: 11,
                marginLeft: 4,
              }}
            >
              ({attr.type})
            </span>
            <button
              style={{
                marginLeft: "auto",
                fontSize: 11,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#ff6bcb",
              }}
              onClick={() => removeAttr(idx)}
            >
              🗑️
            </button>
            <Handle
              type="source"
              position={Position.Right}
              id={attr.name}
              style={{
                top: 12,
                background: attr.isNew ? "#ff6bcb" : "#7366ff",
                width: 8,
                height: 8,
                border: "2px solid #fff",
                boxShadow: "0 0 0 2px #7366ff",
                right: -8,
              }}
              isConnectable={isConnectable}
            />
          </li>
        ))}
      </ul>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          background: "#fff",
          padding: "8px",
          borderRadius: 6,
          boxShadow: "0 1px 4px rgba(115,102,255,0.08)",
        }}
      >
        <input
          value={newAttr}
          onChange={(e) => setNewAttr(e.target.value)}
          placeholder="Add attribute"
          style={{
            fontSize: 12,
            width: 80,
            border: "2px solid #7366ff",
            borderRadius: 6,
            padding: "4px 8px",
            outline: "none",
          }}
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          style={{
            fontSize: 12,
            marginLeft: 4,
            border: "2px solid #7366ff",
            borderRadius: 6,
            padding: "4px 8px",
            outline: "none",
          }}
        >
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="date">date</option>
          <option value="boolean">boolean</option>
        </select>
        <button
          style={{
            marginLeft: 4,
            fontSize: 12,
            background: "#7366ff",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "4px 8px",
            cursor: "pointer",
          }}
          onClick={addAttr}
        >
          +
        </button>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: "#7366ff",
          width: 8,
          height: 8,
          border: "2px solid #fff",
          boxShadow: "0 0 0 2px #7366ff",
        }}
        isConnectable={isConnectable}
      />
    </div>
  );
}

// Initial nodes for the canvas (fallback when no files are uploaded)
const initialNodes = [
  {
    id: "1",
    type: "entity",
    position: { x: 100, y: 100 },
    data: {
      label: "Party",
      attributes: [
        { name: "party_id", type: "string" },
        { name: "name", type: "string" },
        { name: "type", type: "string" },
      ],
      scdType2: false,
      onUpdate: () => {},
    },
  },
  {
    id: "2",
    type: "entity",
    position: { x: 400, y: 100 },
    data: {
      label: "Product",
      attributes: [
        { name: "product_id", type: "string" },
        { name: "name", type: "string" },
        { name: "category", type: "string" },
      ],
      scdType2: false,
      onUpdate: () => {},
    },
  },
  {
    id: "3",
    type: "entity",
    position: { x: 250, y: 300 },
    data: {
      label: "Subscription",
      attributes: [
        { name: "subscription_id", type: "string" },
        { name: "party_id", type: "string" },
        { name: "product_id", type: "string" },
        { name: "start_date", type: "date" },
        { name: "end_date", type: "date" },
      ],
      scdType2: true,
      onUpdate: () => {},
    },
  },
];

// Initial edges for the canvas
const initialEdges = [
  {
    id: "e1-3",
    source: "1",
    target: "3",
    label: "party_id",
    animated: true,
    style: { stroke: "#7366ff", strokeWidth: 2 },
    labelStyle: { fill: "#7366ff", fontWeight: 600, fontSize: 12 },
    labelBgStyle: { fill: "#fff", fillOpacity: 0.8 },
  },
  {
    id: "e2-3",
    source: "2",
    target: "3",
    label: "product_id",
    animated: true,
    style: { stroke: "#7366ff", strokeWidth: 2 },
    labelStyle: { fill: "#7366ff", fontWeight: 600, fontSize: 12 },
    labelBgStyle: { fill: "#fff", fillOpacity: 0.8 },
  },
];

// New Entity Modal Component
function NewEntityModal({ open, onClose, onAddCustomEntity, onUploadFile }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === "text/csv" || file.name.endsWith(".csv"))) {
      setSelectedFile(file);
    } else {
      alert("Please select a valid CSV file");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      console.log(
        "Starting upload process in modal for file:",
        selectedFile.name
      );
      await onUploadFile(selectedFile);
      console.log("Upload completed successfully");
      setSelectedFile(null);
      onClose();
    } catch (error) {
      console.error("Upload failed in modal:", error);
      alert(`Upload failed: ${error.message || "Unknown error occurred"}`);
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "2rem",
          maxWidth: "500px",
          boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <h3 style={{ margin: 0, color: "#7366ff" }}>Add New Entity</h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "#666",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <div style={{ marginBottom: "1.5rem" }}>
            <h4 style={{ color: "#7366ff", marginBottom: "1rem" }}>
              Option 1: Upload CSV File
            </h4>
            <div
              style={{
                border: "2px dashed #7366ff",
                borderRadius: "8px",
                padding: "2rem",
                textAlign: "center",
                background: "#f8f9ff",
              }}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                style={{ display: "none" }}
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                style={{
                  cursor: "pointer",
                  display: "block",
                }}
              >
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📁</div>
                <div style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
                  {selectedFile
                    ? selectedFile.name
                    : "Click to select CSV file"}
                </div>
                <div style={{ fontSize: "0.9rem", color: "#666" }}>
                  {selectedFile ? "File selected" : "or drag and drop here"}
                </div>
              </label>
            </div>
            {selectedFile && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                style={{
                  background: "#28a745",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  cursor: uploading ? "not-allowed" : "pointer",
                  width: "100%",
                  marginTop: "1rem",
                  opacity: uploading ? 0.7 : 1,
                }}
              >
                {uploading ? "Uploading..." : "Upload & Create Entity"}
              </button>
            )}
          </div>

          <div
            style={{
              borderTop: "1px solid #eee",
              paddingTop: "1.5rem",
              marginTop: "1.5rem",
            }}
          >
            <h4 style={{ color: "#7366ff", marginBottom: "1rem" }}>
              Option 2: Create Custom Entity
            </h4>
            <p style={{ color: "#666", marginBottom: "1rem" }}>
              Create a custom entity with manually defined attributes and
              relationships.
            </p>
            <button
              onClick={() => {
                onAddCustomEntity();
                onClose();
              }}
              style={{
                background: "#7366ff",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                cursor: "pointer",
                width: "100%",
              }}
            >
              Create Custom Entity
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Delete Entity Confirmation Modal
function DeleteEntityModal({ open, onClose, entity, onConfirm }) {
  if (!open || !entity) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "2rem",
          maxWidth: "500px",
          boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <h3 style={{ margin: 0, color: "#dc3545" }}>Delete Entity</h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "#666",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ color: "#666", marginBottom: "1rem" }}>
            Are you sure you want to delete the entity{" "}
            <strong>"{entity.label}"</strong>?
          </p>

          {entity.data?.isFileNode && (
            <div
              style={{
                background: "#fff3cd",
                padding: "1rem",
                borderRadius: "8px",
                border: "1px solid #ffeaa7",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  fontWeight: "600",
                  color: "#856404",
                  marginBottom: "0.5rem",
                }}
              >
                ⚠️ File Node Warning
              </div>
              <div style={{ fontSize: "0.9rem", color: "#856404" }}>
                This entity represents an uploaded file. Deleting it will:
                <ul style={{ margin: "0.5rem 0 0 1rem", padding: 0 }}>
                  <li>Remove the entity from the canvas</li>
                  <li>Delete all relationships connected to this entity</li>
                  <li>Not affect the actual uploaded file in storage</li>
                </ul>
              </div>
            </div>
          )}

          <div
            style={{
              background: "#f8f9fa",
              padding: "1rem",
              borderRadius: "8px",
              border: "1px solid #dee2e6",
            }}
          >
            <div style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
              Entity Details:
            </div>
            <div style={{ fontSize: "0.9rem", color: "#666" }}>
              <div>
                <strong>Name:</strong> {entity.label}
              </div>
              <div>
                <strong>Type:</strong>{" "}
                {entity.data?.isFileNode ? "File Node" : "Custom Entity"}
              </div>
              <div>
                <strong>Attributes:</strong>{" "}
                {entity.data?.attributes?.length || 0} columns
              </div>
              {entity.data?.primaryKey && (
                <div>
                  <strong>Primary Key:</strong> {entity.data.primaryKey}
                </div>
              )}
              {entity.data?.recordCount > 0 && (
                <div>
                  <strong>Records:</strong>{" "}
                  {entity.data.recordCount.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "#6c757d",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(entity.id)}
            style={{
              background: "#dc3545",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            Delete Entity
          </button>
        </div>
      </div>
    </div>
  );
}

// Relationship Management Modal Component
function RelationshipModal({
  open,
  onClose,
  mode,
  relationship,
  nodes,
  onSave,
  onDelete,
}) {
  const [sourceNodeId, setSourceNodeId] = useState("");
  const [targetNodeId, setTargetNodeId] = useState("");
  const [sourceColumn, setSourceColumn] = useState("");
  const [targetColumn, setTargetColumn] = useState("");
  const [relationshipType, setRelationshipType] = useState("foreign_key");
  const [confidence, setConfidence] = useState("medium");

  useEffect(() => {
    if (open && relationship) {
      setSourceNodeId(relationship.source || "");
      setTargetNodeId(relationship.target || "");
      setSourceColumn(relationship.data?.sourceColumn || "");
      setTargetColumn(relationship.data?.targetColumn || "");
      setRelationshipType(relationship.data?.relationshipType || "foreign_key");
      setConfidence(relationship.data?.confidence || "medium");
    } else if (open) {
      // Reset for new relationship
      setSourceNodeId("");
      setTargetNodeId("");
      setSourceColumn("");
      setTargetColumn("");
      setRelationshipType("foreign_key");
      setConfidence("medium");
    }
  }, [open, relationship]);

  const handleSave = () => {
    if (!sourceNodeId || !targetNodeId || !sourceColumn || !targetColumn) {
      alert("Please fill in all fields");
      return;
    }

    if (sourceNodeId === targetNodeId) {
      alert("Source and target cannot be the same");
      return;
    }

    const relationshipData = {
      sourceNodeId,
      targetNodeId,
      sourceColumn,
      targetColumn,
      relationshipType,
      confidence,
    };

    onSave(relationshipData);
    onClose();
  };

  const handleDelete = () => {
    if (relationship && relationship.id) {
      onDelete(relationship.id);
      onClose();
    }
  };

  const sourceNode = nodes.find((n) => n.id === sourceNodeId);
  const targetNode = nodes.find((n) => n.id === targetNodeId);
  const sourceColumns =
    sourceNode?.data?.attributes?.map((attr) => attr.name) || [];
  const targetColumns =
    targetNode?.data?.attributes?.map((attr) => attr.name) || [];

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "2rem",
          maxWidth: "600px",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <h3 style={{ margin: 0, color: "#7366ff" }}>
            {mode === "edit" ? "Edit Relationship" : "Add New Relationship"}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "#666",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          {/* Source Node */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "600",
              }}
            >
              Source Table:
            </label>
            <select
              value={sourceNodeId}
              onChange={(e) => {
                setSourceNodeId(e.target.value);
                setSourceColumn("");
              }}
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              <option value="">-- Select Source Table --</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.data.label}
                </option>
              ))}
            </select>
          </div>

          {/* Target Node */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "600",
              }}
            >
              Target Table:
            </label>
            <select
              value={targetNodeId}
              onChange={(e) => {
                setTargetNodeId(e.target.value);
                setTargetColumn("");
              }}
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              <option value="">-- Select Target Table --</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.data.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          {/* Source Column */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "600",
              }}
            >
              Source Column:
            </label>
            <select
              value={sourceColumn}
              onChange={(e) => setSourceColumn(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
              disabled={!sourceNodeId}
            >
              <option value="">-- Select Source Column --</option>
              {sourceColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          {/* Target Column */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "600",
              }}
            >
              Target Column:
            </label>
            <select
              value={targetColumn}
              onChange={(e) => setTargetColumn(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
              disabled={!targetNodeId}
            >
              <option value="">-- Select Target Column --</option>
              {targetColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          {/* Relationship Type */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "600",
              }}
            >
              Relationship Type:
            </label>
            <select
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              <option value="foreign_key">Foreign Key</option>
              <option value="one_to_one">One-to-One</option>
              <option value="one_to_many">One-to-Many</option>
              <option value="many_to_many">Many-to-Many</option>
            </select>
          </div>

          {/* Confidence Level */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "600",
              }}
            >
              Confidence Level:
            </label>
            <select
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "flex-end",
          }}
        >
          {mode === "edit" && (
            <button
              onClick={handleDelete}
              style={{
                background: "#dc3545",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                cursor: "pointer",
                marginRight: "auto",
              }}
            >
              Delete Relationship
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: "#ccc",
              color: "#333",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: "#7366ff",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            {mode === "edit" ? "Update" : "Create"} Relationship
          </button>
        </div>
      </div>
    </div>
  );
}

// Field Mapping Modal Component
function FieldMappingModal({
  open,
  onClose,
  sourceFile,
  targetFile,
  onSaveMapping,
}) {
  const [mappings, setMappings] = useState({});
  const [transformationRules, setTransformationRules] = useState({});

  useEffect(() => {
    if (open && sourceFile && targetFile) {
      // Initialize mappings based on existing data
      const initialMappings = {};
      sourceFile.columns?.forEach((col) => {
        // Try to find matching column in target
        const matchingCol = targetFile.columns?.find(
          (tCol) =>
            tCol.toLowerCase() === col.toLowerCase() ||
            tCol.toLowerCase().includes(col.toLowerCase()) ||
            col.toLowerCase().includes(tCol.toLowerCase())
        );
        if (matchingCol) {
          initialMappings[col] = matchingCol;
        }
      });
      setMappings(initialMappings);
    }
  }, [open, sourceFile, targetFile]);

  const handleSave = () => {
    onSaveMapping(mappings, transformationRules);
    onClose();
  };

  if (!open || !sourceFile || !targetFile) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "2rem",
          maxWidth: "90vw",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <h3 style={{ margin: 0, color: "#7366ff" }}>
            Field Mapping: {sourceFile.name} → {targetFile.name}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "#666",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "2rem",
          }}
        >
          {/* Source File */}
          <div>
            <h4 style={{ color: "#7366ff", marginBottom: "1rem" }}>
              Source: {sourceFile.name}
            </h4>
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              {sourceFile.columns?.map((col, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "0.5rem",
                    border: "1px solid #eee",
                    marginBottom: "0.5rem",
                    borderRadius: "4px",
                    background: mappings[col] ? "#f0f8ff" : "#fff",
                  }}
                >
                  <div style={{ fontWeight: "600", color: "#333" }}>{col}</div>
                  <div style={{ fontSize: "0.8rem", color: "#666" }}>
                    Type: {sourceFile.columnTypes?.[col] || "unknown"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Target File */}
          <div>
            <h4 style={{ color: "#7366ff", marginBottom: "1rem" }}>
              Target: {targetFile.name}
            </h4>
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              {targetFile.columns?.map((col, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "0.5rem",
                    border: "1px solid #eee",
                    marginBottom: "0.5rem",
                    borderRadius: "4px",
                    background: Object.values(mappings).includes(col)
                      ? "#f0f8ff"
                      : "#fff",
                  }}
                >
                  <div style={{ fontWeight: "600", color: "#333" }}>{col}</div>
                  <div style={{ fontSize: "0.8rem", color: "#666" }}>
                    Type: {targetFile.columnTypes?.[col] || "unknown"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mapping Table */}
        <div style={{ marginTop: "2rem" }}>
          <h4 style={{ color: "#7366ff", marginBottom: "1rem" }}>
            Field Mappings
          </h4>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f7f6ff" }}>
                <th
                  style={{
                    padding: "0.5rem",
                    textAlign: "left",
                    borderBottom: "2px solid #7366ff",
                  }}
                >
                  Source Field
                </th>
                <th
                  style={{
                    padding: "0.5rem",
                    textAlign: "left",
                    borderBottom: "2px solid #7366ff",
                  }}
                >
                  Target Field
                </th>
                <th
                  style={{
                    padding: "0.5rem",
                    textAlign: "left",
                    borderBottom: "2px solid #7366ff",
                  }}
                >
                  Transformation
                </th>
                <th
                  style={{
                    padding: "0.5rem",
                    textAlign: "left",
                    borderBottom: "2px solid #7366ff",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sourceFile.columns?.map((sourceCol, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "0.5rem" }}>{sourceCol}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <select
                      value={mappings[sourceCol] || ""}
                      onChange={(e) =>
                        setMappings((prev) => ({
                          ...prev,
                          [sourceCol]: e.target.value,
                        }))
                      }
                      style={{
                        width: "100%",
                        padding: "0.25rem",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                      }}
                    >
                      <option value="">-- Select Target Field --</option>
                      {targetFile.columns?.map((targetCol) => (
                        <option key={targetCol} value={targetCol}>
                          {targetCol}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <select
                      value={transformationRules[sourceCol] || "none"}
                      onChange={(e) =>
                        setTransformationRules((prev) => ({
                          ...prev,
                          [sourceCol]: e.target.value,
                        }))
                      }
                      style={{
                        width: "100%",
                        padding: "0.25rem",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                      }}
                    >
                      <option value="none">No Transformation</option>
                      <option value="uppercase">To Uppercase</option>
                      <option value="lowercase">To Lowercase</option>
                      <option value="trim">Trim Whitespace</option>
                      <option value="date_format">Date Format</option>
                      <option value="number_format">Number Format</option>
                    </select>
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <button
                      onClick={() =>
                        setMappings((prev) => {
                          const newMappings = { ...prev };
                          delete newMappings[sourceCol];
                          return newMappings;
                        })
                      }
                      style={{
                        background: "#ff6bcb",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        padding: "0.25rem 0.5rem",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                      }}
                    >
                      Clear
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "flex-end",
            marginTop: "2rem",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "#ccc",
              color: "#333",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: "#7366ff",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            Save Mapping
          </button>
        </div>
      </div>
    </div>
  );
}

// Generic Relationship Controls Component
function RelationshipControls({
  onRecalculate,
  onAddRelation,
  onClearAll,
  onCleanDuplicates,
  onAddEntity,
  showAllButtons = true,
}) {
  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <button
        onClick={onAddEntity}
        style={{
          background: "#7366ff",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          padding: "0.5rem 1rem",
          fontSize: "0.8rem",
          cursor: "pointer",
        }}
        title="Add a new custom entity"
      >
        + New Entity
      </button>
      {showAllButtons && (
        <button
          onClick={onRecalculate}
          style={{
            background: "#17a2b8",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "0.5rem 1rem",
            fontSize: "0.8rem",
            cursor: "pointer",
          }}
          title="Re-generate relationships between all uploaded files"
        >
          🔄 Re-generate
        </button>
      )}
      <button
        onClick={onAddRelation}
        style={{
          background: "#28a745",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          padding: "0.5rem 1rem",
          fontSize: "0.8rem",
          cursor: "pointer",
        }}
      >
        + Add Relation
      </button>
      <button
        onClick={onClearAll}
        style={{
          background: "#dc3545",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          padding: "0.5rem 1rem",
          fontSize: "0.8rem",
          cursor: "pointer",
        }}
      >
        Clear All
      </button>
      {showAllButtons && (
        <button
          onClick={onCleanDuplicates}
          style={{
            background: "#ffc107",
            color: "#333",
            border: "none",
            borderRadius: "4px",
            padding: "0.5rem 1rem",
            fontSize: "0.8rem",
            cursor: "pointer",
          }}
          title="Remove duplicate relationships"
        >
          🧹 Clean Duplicates
        </button>
      )}
    </div>
  );
}

function CanvasPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState("canvas");
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // File integration state
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileData, setFileData] = useState([]);
  const [rawEntities, setRawEntities] = useState([]);
  const [curatedEntities, setCuratedEntities] = useState([]);
  const [fieldMappings, setFieldMappings] = useState({});
  const [mappingModal, setMappingModal] = useState({
    open: false,
    sourceFile: null,
    targetFile: null,
  });
  const [relationshipModal, setRelationshipModal] = useState({
    open: false,
    mode: "add", // "add", "edit"
    relationship: null,
  });
  const [deleteEntityModal, setDeleteEntityModal] = useState({
    open: false,
    entity: null,
  });
  const [newEntityModal, setNewEntityModal] = useState({
    open: false,
  });

  // Function to extract columns from file content
  const extractColumnsFromFile = async (fileData) => {
    if (!fileData || !fileData.key) {
      console.log("No file data or key available for column extraction");
      return [];
    }

    try {
      console.log("Extracting columns from file:", fileData.key);

      // Get file metadata from backend to get the S3 location
      const metadataResponse = await axios.get(
        `/api/file/${encodeURIComponent(fileData.key)}`
      );
      const locationUrl = metadataResponse.data.location || fileData.location;

      if (!locationUrl) {
        console.error("No location URL found for file:", fileData.key);
        return [];
      }

      // Fetch the actual file content from S3
      const fileResponse = await axios.get(locationUrl);
      let fileContent = fileResponse.data;

      console.log("File content type:", typeof fileContent);

      // Handle different response formats
      if (typeof fileContent === "string") {
        // Remove BOM if present
        if (fileContent.charCodeAt(0) === 0xfeff) {
          fileContent = fileContent.slice(1);
        }
      } else if (typeof fileContent === "object") {
        // If it's already parsed JSON, convert back to string for processing
        fileContent = JSON.stringify(fileContent, null, 2);
      }

      // Extract columns based on file type
      const filename = fileData.key.split("/").pop() || "";
      const ext = filename.split(".").pop()?.toLowerCase();
      let columns = [];

      if (ext === "csv" || ext === "tsv") {
        // Parse CSV/TSV headers
        const lines = fileContent
          .split(/\r?\n/)
          .filter((line) => line.trim() !== "");
        if (lines.length > 0) {
          const firstLine = lines[0];
          let delimiter = ",";
          if (firstLine.includes("\t")) delimiter = "\t";
          else if (firstLine.includes(";")) delimiter = ";";

          columns = firstLine
            .split(delimiter)
            .map((h) => h.trim().replace(/^"|"$/g, ""));
        }
      } else if (ext === "json") {
        // Parse JSON structure
        let json;
        try {
          if (typeof fileContent === "object") {
            json = fileContent;
          } else {
            json = JSON.parse(fileContent);
          }

          if (Array.isArray(json) && json.length > 0) {
            columns = Object.keys(json[0]);
          } else if (typeof json === "object") {
            columns = Object.keys(json);
          }
        } catch (e) {
          console.error("Failed to parse JSON:", e);
          columns = [];
        }
      }

      console.log("Extracted columns:", columns);
      return columns;
    } catch (error) {
      console.error("Error extracting columns from file:", error);
      return [];
    }
  };

  // Function to infer data types from sample data
  const inferColumnTypes = async (fileData, columns) => {
    if (!fileData || !fileData.key || columns.length === 0) {
      return {};
    }

    try {
      // Get file metadata from backend to get the S3 location
      const metadataResponse = await axios.get(
        `/api/file/${encodeURIComponent(fileData.key)}`
      );
      const locationUrl = metadataResponse.data.location || fileData.location;

      if (!locationUrl) {
        return {};
      }

      // Fetch the actual file content from S3
      const fileResponse = await axios.get(locationUrl);
      let fileContent = fileResponse.data;

      // Handle different response formats
      if (typeof fileContent === "string") {
        if (fileContent.charCodeAt(0) === 0xfeff) {
          fileContent = fileContent.slice(1);
        }
      } else if (typeof fileContent === "object") {
        fileContent = JSON.stringify(fileContent, null, 2);
      }

      const filename = fileData.key.split("/").pop() || "";
      const ext = filename.split(".").pop()?.toLowerCase();
      const columnTypes = {};

      if (ext === "csv" || ext === "tsv") {
        // Parse CSV/TSV and analyze sample data
        const lines = fileContent
          .split(/\r?\n/)
          .filter((line) => line.trim() !== "");
        if (lines.length > 1) {
          const firstLine = lines[0];
          let delimiter = ",";
          if (firstLine.includes("\t")) delimiter = "\t";
          else if (firstLine.includes(";")) delimiter = ";";

          const headers = firstLine
            .split(delimiter)
            .map((h) => h.trim().replace(/^"|"$/g, ""));

          // Analyze first few rows to infer types
          const sampleRows = lines.slice(1, Math.min(10, lines.length));

          headers.forEach((header, colIndex) => {
            const sampleValues = sampleRows
              .map((row) => {
                const values = row
                  .split(delimiter)
                  .map((v) => v.trim().replace(/^"|"$/g, ""));
                return values[colIndex] || "";
              })
              .filter((v) => v !== "");

            if (sampleValues.length === 0) {
              columnTypes[header] = "string";
              return;
            }

            // Type inference logic
            const allNumbers = sampleValues.every((v) => !isNaN(v) && v !== "");
            const allDates = sampleValues.every((v) => {
              const date = new Date(v);
              return !isNaN(date.getTime()) && v !== "";
            });
            const allBooleans = sampleValues.every((v) =>
              ["true", "false", "1", "0", "yes", "no"].includes(v.toLowerCase())
            );

            if (allNumbers) {
              columnTypes[header] = "number";
            } else if (allDates) {
              columnTypes[header] = "date";
            } else if (allBooleans) {
              columnTypes[header] = "boolean";
            } else {
              columnTypes[header] = "string";
            }
          });
        }
      } else if (ext === "json") {
        // For JSON, analyze the structure
        let json;
        try {
          if (typeof fileContent === "object") {
            json = fileContent;
          } else {
            json = JSON.parse(fileContent);
          }

          if (Array.isArray(json) && json.length > 0) {
            const sampleItem = json[0];
            columns.forEach((column) => {
              const value = sampleItem[column];
              if (typeof value === "number") {
                columnTypes[column] = "number";
              } else if (typeof value === "boolean") {
                columnTypes[column] = "boolean";
              } else if (value && !isNaN(new Date(value).getTime())) {
                columnTypes[column] = "date";
              } else {
                columnTypes[column] = "string";
              }
            });
          }
        } catch (e) {
          console.error("Failed to parse JSON for type inference:", e);
        }
      }

      console.log("Inferred column types:", columnTypes);
      return columnTypes;
    } catch (error) {
      console.error("Error inferring column types:", error);
      return {};
    }
  };

  // Function to analyze file content for primary key candidates
  const analyzePrimaryKeyCandidates = async (fileData, columns) => {
    if (!fileData || !fileData.key || columns.length === 0) {
      return { primaryKey: null, uniqueColumns: [], recordCount: 0 };
    }

    try {
      // Get file metadata from backend to get the S3 location
      const metadataResponse = await axios.get(
        `/api/file/${encodeURIComponent(fileData.key)}`
      );
      const locationUrl = metadataResponse.data.location || fileData.location;

      if (!locationUrl) {
        return { primaryKey: null, uniqueColumns: [], recordCount: 0 };
      }

      // Fetch the actual file content from S3
      const fileResponse = await axios.get(locationUrl);
      let fileContent = fileResponse.data;

      // Handle different response formats
      if (typeof fileContent === "string") {
        if (fileContent.charCodeAt(0) === 0xfeff) {
          fileContent = fileContent.slice(1);
        }
      } else if (typeof fileContent === "object") {
        fileContent = JSON.stringify(fileContent, null, 2);
      }

      const filename = fileData.key.split("/").pop() || "";
      const ext = filename.split(".").pop()?.toLowerCase();
      const uniqueColumns = [];
      let recordCount = 0;

      if (ext === "csv" || ext === "tsv") {
        // Parse CSV/TSV and analyze data
        const lines = fileContent
          .split(/\r?\n/)
          .filter((line) => line.trim() !== "");
        if (lines.length > 1) {
          const firstLine = lines[0];
          let delimiter = ",";
          if (firstLine.includes("\t")) delimiter = "\t";
          else if (firstLine.includes(";")) delimiter = ";";

          const headers = firstLine
            .split(delimiter)
            .map((h) => h.trim().replace(/^"|"$/g, ""));
          const dataRows = lines.slice(1);
          recordCount = dataRows.length;

          // Analyze each column for uniqueness
          headers.forEach((header, colIndex) => {
            const values = dataRows
              .map((row) => {
                const rowValues = row
                  .split(delimiter)
                  .map((v) => v.trim().replace(/^"|"$/g, ""));
                return rowValues[colIndex] || "";
              })
              .filter((v) => v !== "");

            const uniqueValues = new Set(values);
            const uniquenessRatio = uniqueValues.size / values.length;

            // Consider a column as unique if it has high uniqueness ratio
            if (uniquenessRatio > 0.95 && values.length > 0) {
              uniqueColumns.push({
                name: header,
                uniquenessRatio: uniquenessRatio,
                uniqueCount: uniqueValues.size,
                totalCount: values.length,
              });
            }
          });
        }
      } else if (ext === "json") {
        // For JSON, analyze the structure
        let json;
        try {
          if (typeof fileContent === "object") {
            json = fileContent;
          } else {
            json = JSON.parse(fileContent);
          }

          if (Array.isArray(json) && json.length > 0) {
            recordCount = json.length;

            columns.forEach((column) => {
              const values = json
                .map((item) => item[column])
                .filter((v) => v !== undefined && v !== "");
              const uniqueValues = new Set(values);
              const uniquenessRatio = uniqueValues.size / values.length;

              if (uniquenessRatio > 0.95 && values.length > 0) {
                uniqueColumns.push({
                  name: column,
                  uniquenessRatio: uniquenessRatio,
                  uniqueCount: uniqueValues.size,
                  totalCount: values.length,
                });
              }
            });
          }
        } catch (e) {
          console.error("Failed to parse JSON for primary key analysis:", e);
        }
      }

      // Sort unique columns by uniqueness ratio and total count
      uniqueColumns.sort((a, b) => {
        if (Math.abs(a.uniquenessRatio - b.uniquenessRatio) < 0.01) {
          return b.totalCount - a.totalCount;
        }
        return b.uniquenessRatio - a.uniquenessRatio;
      });

      // Select the best primary key candidate
      const primaryKey =
        uniqueColumns.length > 0 ? uniqueColumns[0].name : null;

      console.log("Primary key analysis:", {
        filename,
        primaryKey,
        uniqueColumns,
        recordCount,
      });

      return { primaryKey, uniqueColumns, recordCount };
    } catch (error) {
      console.error("Error analyzing primary key candidates:", error);
      return { primaryKey: null, uniqueColumns: [], recordCount: 0 };
    }
  };

  // Function to detect relationships between tables
  const detectRelationships = (fileNodes) => {
    const relationships = [];

    // Create a map of primary keys by table
    const primaryKeyMap = {};
    fileNodes.forEach((node) => {
      if (node.data.primaryKey) {
        primaryKeyMap[node.data.label] = node.data.primaryKey;
      }
    });

    // Find foreign key relationships
    fileNodes.forEach((sourceNode) => {
      const sourceColumns = sourceNode.data.attributes.map((attr) => attr.name);

      fileNodes.forEach((targetNode) => {
        if (sourceNode.id === targetNode.id) return; // Skip self

        const targetPrimaryKey = targetNode.data.primaryKey;
        if (!targetPrimaryKey) return;

        // Look for foreign key patterns
        const foreignKeyPatterns = [
          targetPrimaryKey, // Exact match
          `${targetPrimaryKey}_id`, // Common pattern
          `${targetPrimaryKey}Id`, // CamelCase pattern
          `${targetPrimaryKey.toLowerCase()}_id`, // Lowercase pattern
          `${targetPrimaryKey.toLowerCase()}Id`, // Lowercase camelCase
        ];

        // Check if any source column matches foreign key patterns
        const matchingColumn = sourceColumns.find((col) =>
          foreignKeyPatterns.some(
            (pattern) => col.toLowerCase() === pattern.toLowerCase()
          )
        );

        if (matchingColumn) {
          relationships.push({
            source: sourceNode.id,
            target: targetNode.id,
            sourceColumn: matchingColumn,
            targetColumn: targetPrimaryKey,
            relationshipType: "foreign_key",
            confidence: "high",
          });
        }

        // Also check for table name patterns in column names
        const tableName = targetNode.data.label.replace(/\.[^/.]+$/, ""); // Remove extension
        const tableNamePatterns = [
          `${tableName}_id`,
          `${tableName}Id`,
          `${tableName.toLowerCase()}_id`,
          `${tableName.toLowerCase()}Id`,
        ];

        const tableNameMatchingColumn = sourceColumns.find((col) =>
          tableNamePatterns.some(
            (pattern) => col.toLowerCase() === pattern.toLowerCase()
          )
        );

        if (tableNameMatchingColumn && !matchingColumn) {
          relationships.push({
            source: sourceNode.id,
            target: targetNode.id,
            sourceColumn: tableNameMatchingColumn,
            targetColumn: targetPrimaryKey,
            relationshipType: "foreign_key",
            confidence: "medium",
          });
        }
      });
    });

    console.log("Detected relationships:", relationships);
    return relationships;
  };

  // Function to identify the main parent table
  const identifyMainParentTable = (fileNodes) => {
    if (fileNodes.length === 0) return null;

    // Score each table based on various factors
    const tableScores = fileNodes.map((node) => {
      let score = 0;
      const data = node.data;

      // Factor 1: Number of relationships (more relationships = higher score)
      const outgoingRelationships = fileNodes.filter(
        (otherNode) =>
          otherNode.id !== node.id &&
          otherNode.data.attributes.some((attr) =>
            attr.name
              .toLowerCase()
              .includes(data.primaryKey?.toLowerCase() || "")
          )
      ).length;
      score += outgoingRelationships * 10;

      // Factor 2: Record count (more records = higher score)
      score += (data.recordCount || 0) / 100;

      // Factor 3: Number of attributes (more attributes = higher score)
      score += data.attributes.length * 2;

      // Factor 4: Has primary key (bonus points)
      if (data.primaryKey) {
        score += 50;
      }

      // Factor 5: Table name patterns (common parent table names)
      const tableName = data.label.toLowerCase();
      const parentTablePatterns = [
        "customer",
        "user",
        "account",
        "party",
        "entity",
        "master",
        "product",
        "item",
        "goods",
        "service",
        "order",
        "transaction",
        "sale",
        "purchase",
      ];

      if (parentTablePatterns.some((pattern) => tableName.includes(pattern))) {
        score += 20;
      }

      return {
        nodeId: node.id,
        tableName: data.label,
        score: score,
        outgoingRelationships,
        recordCount: data.recordCount || 0,
        attributeCount: data.attributes.length,
        hasPrimaryKey: !!data.primaryKey,
      };
    });

    // Sort by score and return the highest scoring table
    tableScores.sort((a, b) => b.score - a.score);

    console.log("Table scores for parent identification:", tableScores);

    return tableScores.length > 0 ? tableScores[0] : null;
  };

  // Load data from location state (from CuratedLandingZone)
  useEffect(() => {
    const stateData = location.state;
    console.log("CanvasPage - Location state:", stateData); // Debug log

    if (stateData) {
      if (stateData.uploadedFiles && stateData.uploadedFiles.length > 0) {
        console.log(
          "CanvasPage - Setting uploaded files:",
          stateData.uploadedFiles
        );
        console.log("CanvasPage - File data:", stateData.fileData);
        console.log("CanvasPage - Raw entities:", stateData.rawEntities);
        console.log(
          "CanvasPage - Curated entities:",
          stateData.curatedEntities
        );

        setUploadedFiles(stateData.uploadedFiles);
        setFileData(stateData.fileData || []);
        setRawEntities(stateData.rawEntities || []);
        setCuratedEntities(stateData.curatedEntities || []);

        // Extract columns and create nodes from uploaded files
        const processFilesAndCreateNodes = async () => {
          const fileNodes = [];

          for (let idx = 0; idx < stateData.uploadedFiles.length; idx++) {
            const filename = stateData.uploadedFiles[idx];
            const fileDataItem = stateData.fileData?.[idx];

            console.log(`Processing file ${idx + 1}:`, filename);

            // Extract columns from file content
            let columns = [];
            let columnTypes = {};

            if (fileDataItem) {
              columns = await extractColumnsFromFile(fileDataItem);
              if (columns.length > 0) {
                columnTypes = await inferColumnTypes(fileDataItem, columns);
              }
            }

            // If no columns extracted, use fallback
            if (columns.length === 0) {
              columns = ["id", "name", "type", "created_at"];
              columnTypes = {
                id: "string",
                name: "string",
                type: "string",
                created_at: "date",
              };
            }

            // Analyze primary key candidates and record count
            let primaryKeyAnalysis = {
              primaryKey: null,
              uniqueColumns: [],
              recordCount: 0,
            };
            if (fileDataItem && columns.length > 0) {
              primaryKeyAnalysis = await analyzePrimaryKeyCandidates(
                fileDataItem,
                columns
              );
            }

            const node = {
          id: `file-${idx + 1}`,
          type: "entity",
          position: {
            x: 100 + idx * 300,
            y: 100 + (idx % 2) * 200,
          },
          data: {
            label: filename,
                attributes: columns.map((col) => ({
                name: col,
                  type: columnTypes[col] || "string",
                isNew: true,
                  isPrimaryKey: col === primaryKeyAnalysis.primaryKey,
                })),
            isNewOrUpdated: true,
            scdType2: false,
            onUpdate: () => {},
            isFileNode: true,
            rawEntity: stateData.rawEntities?.[idx],
            curatedEntity: stateData.curatedEntities?.[idx],
                fileData: fileDataItem,
                extractedColumns: columns,
                columnTypes: columnTypes,
                primaryKey: primaryKeyAnalysis.primaryKey,
                uniqueColumns: primaryKeyAnalysis.uniqueColumns,
                recordCount: primaryKeyAnalysis.recordCount,
          },
            };

            fileNodes.push(node);
            console.log(
              `Created node for ${filename} with ${columns.length} columns:`,
              columns
            );
          }

        console.log("CanvasPage - Created file nodes:", fileNodes);
        setNodes(fileNodes.length > 0 ? fileNodes : initialNodes);

          // After creating nodes, detect relationships and identify parent table
          if (fileNodes.length > 1) {
            const relationships = detectRelationships(fileNodes);
            const parentTable = identifyMainParentTable(fileNodes);

            console.log("Parent table identified:", parentTable);
            console.log("Relationships detected:", relationships);

            // Create edges from relationships
            const relationshipEdges = relationships.map((rel, idx) => ({
              id: `rel-${idx + 1}`,
              source: rel.source,
              target: rel.target,
              label: `${rel.sourceColumn} → ${rel.targetColumn}`,
              animated: true,
              style: {
                stroke: rel.confidence === "high" ? "#28a745" : "#ffc107",
                strokeWidth: rel.confidence === "high" ? 3 : 2,
              },
              labelStyle: {
                fill: rel.confidence === "high" ? "#28a745" : "#ffc107",
                fontWeight: 600,
                fontSize: 11,
              },
              labelBgStyle: {
                fill: "#fff",
                fillOpacity: 0.9,
              },
              data: {
                relationshipType: rel.relationshipType,
                confidence: rel.confidence,
                sourceColumn: rel.sourceColumn,
                targetColumn: rel.targetColumn,
              },
            }));

            setEdges(relationshipEdges);

            // Highlight the parent table
            if (parentTable) {
              setNodes((prevNodes) =>
                prevNodes.map((node) =>
                  node.id === parentTable.nodeId
                    ? { ...node, data: { ...node.data, isParentTable: true } }
                    : node
                )
              );
            }
          }
        };

        processFilesAndCreateNodes();
      } else {
        console.log("CanvasPage - No uploaded files found in state data");
      }
    } else {
      console.log("CanvasPage - No state data found");
    }
  }, [location.state]);

  // Fallback: Try to load data from localStorage if no state data
  useEffect(() => {
    if (uploadedFiles.length === 0) {
      try {
        const storedFiles = localStorage.getItem("uploadedFiles");
        const storedFileData = localStorage.getItem("fileData");
        const storedRawEntities = localStorage.getItem("rawEntities");
        const storedCuratedEntities = localStorage.getItem("curatedEntities");

        if (storedFiles) {
          console.log("CanvasPage - Loading files from localStorage");
          const files = JSON.parse(storedFiles);
          const fileData = storedFileData ? JSON.parse(storedFileData) : [];
          const rawEntities = storedRawEntities
            ? JSON.parse(storedRawEntities)
            : [];
          const curatedEntities = storedCuratedEntities
            ? JSON.parse(storedCuratedEntities)
            : [];

          setUploadedFiles(files);
          setFileData(fileData);
          setRawEntities(rawEntities);
          setCuratedEntities(curatedEntities);

          // Extract columns and create nodes from stored files
          const processStoredFilesAndCreateNodes = async () => {
            const fileNodes = [];

            for (let idx = 0; idx < files.length; idx++) {
              const filename = files[idx];
              const fileDataItem = fileData[idx];

              console.log(`Processing stored file ${idx + 1}:`, filename);

              // Extract columns from file content
              let columns = [];
              let columnTypes = {};

              if (fileDataItem) {
                columns = await extractColumnsFromFile(fileDataItem);
                if (columns.length > 0) {
                  columnTypes = await inferColumnTypes(fileDataItem, columns);
                }
              }

              // If no columns extracted, use fallback
              if (columns.length === 0) {
                columns = ["id", "name", "type", "created_at"];
                columnTypes = {
                  id: "string",
                  name: "string",
                  type: "string",
                  created_at: "date",
                };
              }

              // Analyze primary key candidates and record count
              let primaryKeyAnalysis = {
                primaryKey: null,
                uniqueColumns: [],
                recordCount: 0,
              };
              if (fileDataItem && columns.length > 0) {
                primaryKeyAnalysis = await analyzePrimaryKeyCandidates(
                  fileDataItem,
                  columns
                );
              }

              const node = {
                id: `file-${idx + 1}`,
                type: "entity",
                position: {
                  x: 100 + idx * 300,
                  y: 100 + (idx % 2) * 200,
                },
                data: {
                  label: filename,
                  attributes: columns.map((col) => ({
                    name: col,
                    type: columnTypes[col] || "string",
                    isNew: true,
                    isPrimaryKey: col === primaryKeyAnalysis.primaryKey,
                  })),
                  isNewOrUpdated: true,
                  scdType2: false,
                  onUpdate: () => {},
                  isFileNode: true,
                  rawEntity: rawEntities[idx],
                  curatedEntity: curatedEntities[idx],
                  fileData: fileDataItem,
                  extractedColumns: columns,
                  columnTypes: columnTypes,
                  primaryKey: primaryKeyAnalysis.primaryKey,
                  uniqueColumns: primaryKeyAnalysis.uniqueColumns,
                  recordCount: primaryKeyAnalysis.recordCount,
                },
              };

              fileNodes.push(node);
              console.log(
                `Created node for stored file ${filename} with ${columns.length} columns:`,
                columns
              );
            }

            console.log(
              "CanvasPage - Created file nodes from localStorage:",
              fileNodes
            );
            setNodes(fileNodes.length > 0 ? fileNodes : initialNodes);

            // After creating nodes, detect relationships and identify parent table
            if (fileNodes.length > 1) {
              const relationships = detectRelationships(fileNodes);
              const parentTable = identifyMainParentTable(fileNodes);

              console.log(
                "Parent table identified (localStorage):",
                parentTable
              );
              console.log(
                "Relationships detected (localStorage):",
                relationships
              );

              // Create edges from relationships
              const relationshipEdges = relationships.map((rel, idx) => ({
                id: `rel-${idx + 1}`,
                source: rel.source,
                target: rel.target,
                label: `${rel.sourceColumn} → ${rel.targetColumn}`,
                animated: true,
                style: {
                  stroke: rel.confidence === "high" ? "#28a745" : "#ffc107",
                  strokeWidth: rel.confidence === "high" ? 3 : 2,
                },
                labelStyle: {
                  fill: rel.confidence === "high" ? "#28a745" : "#ffc107",
                  fontWeight: 600,
                  fontSize: 11,
                },
                labelBgStyle: {
                  fill: "#fff",
                  fillOpacity: 0.9,
                },
                data: {
                  relationshipType: rel.relationshipType,
                  confidence: rel.confidence,
                  sourceColumn: rel.sourceColumn,
                  targetColumn: rel.targetColumn,
                },
              }));

              setEdges(relationshipEdges);

              // Highlight the parent table
              if (parentTable) {
                setNodes((prevNodes) =>
                  prevNodes.map((node) =>
                    node.id === parentTable.nodeId
                      ? { ...node, data: { ...node.data, isParentTable: true } }
                      : node
                  )
                );
              }
            }
          };

          processStoredFilesAndCreateNodes();
        }
      } catch (error) {
        console.error("CanvasPage - Error loading from localStorage:", error);
      }
    }
  }, [uploadedFiles.length]);

  // Update entity name/attributes/SCD flag
  const onUpdate = useCallback(
    (id, label, attributes, isNewOrUpdated, scdType2) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  label,
                  attributes,
                  isNewOrUpdated: true,
                  scdType2,
                },
              }
            : n
        )
      );
    },
    [setNodes]
  );

  // Add new entity node (custom entity)
  const addCustomEntity = useCallback(() => {
    const newId = (nodes.length + 1).toString();
    setNodes((nds) =>
      nds.concat({
        id: newId,
        type: "entity",
        position: {
          x: 200 + Math.random() * 200,
          y: 100 + Math.random() * 300,
        },
        data: {
          label: `Entity ${newId}`,
          attributes: [],
          isNewOrUpdated: true,
          scdType2: false,
          onUpdate,
        },
      })
    );
  }, [nodes, setNodes, onUpdate]);

  // Open new entity modal
  const addEntity = useCallback(() => {
    setNewEntityModal({ open: true });
  }, []);

  // Close new entity modal
  const closeNewEntityModal = useCallback(() => {
    setNewEntityModal({ open: false });
  }, []);

  // Handle file upload and create entity
  const handleFileUpload = useCallback(
    async (file) => {
      console.log("handleFileUpload called with file:", file);

      try {
        console.log("Starting file upload process for:", file.name);

        // First, upload the file to the backend
        console.log("Uploading file to backend...");
        const formData = new FormData();
        formData.append("file", file);
        
        const uploadResponse = await axios.post("/api/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        
        console.log("Backend upload response:", uploadResponse.data);

        // Read the file content for local processing
        const text = await file.text();
        console.log("File content read, length:", text.length);

        const lines = text.split("\n").filter((line) => line.trim() !== "");
        console.log("Lines after filtering:", lines.length);

        if (lines.length === 0) {
          throw new Error("File appears to be empty or contains no valid data");
        }

        const headers = lines[0]
          .split(",")
          .map((h) => h.trim().replace(/"/g, ""));
        console.log("Extracted headers:", headers);

        if (headers.length === 0) {
          throw new Error("No valid headers found in CSV file");
        }

        // Extract sample data for type inference
        const sampleData = lines.slice(1, Math.min(6, lines.length)).join("\n");
        console.log("Sample data extracted for type inference");

        // Infer column types with error handling
        let columnTypes = {};
        try {
          columnTypes = await inferColumnTypes(sampleData, headers);
          console.log("Column types inferred:", columnTypes);
        } catch (typeError) {
          console.warn(
            "Type inference failed, using default types:",
            typeError
          );
          columnTypes = headers.reduce((acc, header) => {
            acc[header] = "string";
            return acc;
          }, {});
        }

        // Analyze primary key candidates with error handling
        let primaryKey = null;
        try {
          const primaryKeyAnalysis = await analyzePrimaryKeyCandidates(
            sampleData,
            headers
          );
          console.log("Primary key analysis result:", primaryKeyAnalysis);
          primaryKey = primaryKeyAnalysis.primaryKey || headers[0]; // Extract primaryKey from result object
        } catch (keyError) {
          console.warn("Primary key analysis failed:", keyError);
          primaryKey = headers[0]; // Use first column as fallback
        }

        // Create file data object with backend response data
        const fileDataObj = {
          ...uploadResponse.data, // Include backend response data
          columns: headers,
          columnTypes,
          primaryKey,
          recordCount: Math.max(0, lines.length - 1),
          content: text,
        };
        console.log("File data object created:", fileDataObj);

        // Add to uploadedFiles and related arrays
        setUploadedFiles((prev) => {
          console.log("Updating uploadedFiles, current:", prev);
          return [...prev, file.name];
        });

        setFileData((prev) => {
          console.log("Updating fileData, current:", prev);
          return [...prev, fileDataObj];
        });

        // Generate entity names based on filename
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        const rawEntityName = `raw.${baseName}`;
        const curatedEntityName = `curated.${baseName}`;

        setRawEntities((prev) => {
          console.log("Updating rawEntities, current:", prev);
          return [...prev, rawEntityName];
        });

        setCuratedEntities((prev) => {
          console.log("Updating curatedEntities, current:", prev);
          return [...prev, curatedEntityName];
        });

        // Create node for the uploaded file
        const newId = (nodes.length + 1).toString();
        const newNode = {
          id: newId,
          type: "entity",
          position: {
            x: 200 + Math.random() * 200,
            y: 100 + Math.random() * 300,
          },
          data: {
            label: file.name,
            attributes: headers.map((header) => ({
              name: header,
              type: columnTypes[header] || "string",
              isPrimaryKey: header === primaryKey,
              isNew: true,
            })),
            isNewOrUpdated: true,
            scdType2: false,
            isFileNode: true,
            primaryKey,
            recordCount: Math.max(0, lines.length - 1),
            onUpdate,
          },
        };
        console.log("New node created:", newNode);

        setNodes((prev) => {
          console.log("Updating nodes, current count:", prev.length);
          const updatedNodes = [...prev, newNode];

          // Auto-detect relationships for the new file
          setTimeout(() => {
            autoDetectRelationshipsForNewFile(newNode, updatedNodes);
          }, 100);

          return updatedNodes;
        });

        // Save to localStorage for persistence with error handling
        try {
          const storedFiles = JSON.parse(
            localStorage.getItem("uploadedFiles") || "[]"
          );
          const storedFileData = JSON.parse(
            localStorage.getItem("fileData") || "[]"
          );
          const storedRawEntities = JSON.parse(
            localStorage.getItem("rawEntities") || "[]"
          );
          const storedCuratedEntities = JSON.parse(
            localStorage.getItem("curatedEntities") || "[]"
          );

          localStorage.setItem(
            "uploadedFiles",
            JSON.stringify([...storedFiles, file.name])
          );
          localStorage.setItem(
            "fileData",
            JSON.stringify([...storedFileData, fileDataObj])
          );
          localStorage.setItem(
            "rawEntities",
            JSON.stringify([...storedRawEntities, rawEntityName])
          );
          localStorage.setItem(
            "curatedEntities",
            JSON.stringify([...storedCuratedEntities, curatedEntityName])
          );

          console.log("Data saved to localStorage successfully");
        } catch (storageError) {
          console.error("Failed to save to localStorage:", storageError);
          // Don't throw here, as the main functionality should still work
        }

        console.log("File upload process completed successfully:", file.name);
      } catch (error) {
        console.error("Error processing uploaded file:", error);

        // Fallback: Create a simple entity with basic information
        try {
          console.log("Attempting fallback entity creation");

          const newId = (nodes.length + 1).toString();
          const fallbackNode = {
            id: newId,
            type: "entity",
            position: {
              x: 200 + Math.random() * 200,
              y: 100 + Math.random() * 300,
            },
            data: {
              label: file.name,
              attributes: [
                { name: "id", type: "string", isPrimaryKey: true, isNew: true },
                { name: "data", type: "string", isNew: true },
              ],
              isNewOrUpdated: true,
              scdType2: false,
              isFileNode: true,
              primaryKey: "id",
              recordCount: 0,
              onUpdate,
            },
          };

          setNodes((prev) => [...prev, fallbackNode]);
          setUploadedFiles((prev) => [...prev, file.name]);

          console.log("Fallback entity created successfully");
          alert(
            `File uploaded with basic entity. Some processing failed: ${error.message}`
          );
        } catch (fallbackError) {
          console.error("Fallback also failed:", fallbackError);
          alert(`Failed to process file: ${error.message}`);
          throw error;
        }
      }
    },
    [nodes, setNodes, onUpdate, inferColumnTypes, analyzePrimaryKeyCandidates]
  );

  // Auto-detect relationships for newly uploaded files
  const autoDetectRelationshipsForNewFile = useCallback(
    (newNode, allNodes) => {
      console.log(
        "Auto-detecting relationships for new file:",
        newNode.data.label
      );

      const newFileColumns = newNode.data.attributes.map((attr) => attr.name);
      const newFilePrimaryKey = newNode.data.primaryKey;

      // Find potential relationships with existing files
      const detectedRelationships = [];

      allNodes.forEach((existingNode) => {
        if (existingNode.id === newNode.id) return; // Skip self
        if (!existingNode.data.isFileNode) return; // Only check file nodes

        const existingFileColumns = existingNode.data.attributes.map(
          (attr) => attr.name
        );
        const existingFilePrimaryKey = existingNode.data.primaryKey;

        // Check if new file has foreign keys to existing files
        newFileColumns.forEach((newColumn) => {
          // Pattern 1: Direct primary key match
          if (newColumn === existingFilePrimaryKey) {
            detectedRelationships.push({
              source: newNode.id,
              target: existingNode.id,
              sourceColumn: newColumn,
              targetColumn: existingFilePrimaryKey,
              relationshipType: "foreign_key",
              confidence: "high",
              reason: "Direct primary key match",
            });
          }

          // Pattern 2: Common foreign key patterns
          const foreignKeyPatterns = [
            `${existingFilePrimaryKey}_id`,
            `${existingFilePrimaryKey}Id`,
            `${existingFilePrimaryKey.toLowerCase()}_id`,
            `${existingFilePrimaryKey.toLowerCase()}Id`,
          ];

          if (
            foreignKeyPatterns.some(
              (pattern) => newColumn.toLowerCase() === pattern.toLowerCase()
            )
          ) {
            detectedRelationships.push({
              source: newNode.id,
              target: existingNode.id,
              sourceColumn: newColumn,
              targetColumn: existingFilePrimaryKey,
              relationshipType: "foreign_key",
              confidence: "high",
              reason: "Foreign key pattern match",
            });
          }

          // Pattern 3: Table name based patterns
          const tableName = existingNode.data.label.replace(/\.[^/.]+$/, ""); // Remove extension
          const tableNamePatterns = [
            `${tableName}_id`,
            `${tableName}Id`,
            `${tableName.toLowerCase()}_id`,
            `${tableName.toLowerCase()}Id`,
          ];

          if (
            tableNamePatterns.some(
              (pattern) => newColumn.toLowerCase() === pattern.toLowerCase()
            )
          ) {
            detectedRelationships.push({
              source: newNode.id,
              target: existingNode.id,
              sourceColumn: newColumn,
              targetColumn: existingFilePrimaryKey,
              relationshipType: "foreign_key",
              confidence: "medium",
              reason: "Table name pattern match",
            });
          }
        });

        // Check if existing files have foreign keys to the new file
        existingFileColumns.forEach((existingColumn) => {
          // Pattern 1: Direct primary key match
          if (existingColumn === newFilePrimaryKey) {
            detectedRelationships.push({
              source: existingNode.id,
              target: newNode.id,
              sourceColumn: existingColumn,
              targetColumn: newFilePrimaryKey,
              relationshipType: "foreign_key",
              confidence: "high",
              reason: "Direct primary key match (reverse)",
            });
          }

          // Pattern 2: Common foreign key patterns
          const foreignKeyPatterns = [
            `${newFilePrimaryKey}_id`,
            `${newFilePrimaryKey}Id`,
            `${newFilePrimaryKey.toLowerCase()}_id`,
            `${newFilePrimaryKey.toLowerCase()}Id`,
          ];

          if (
            foreignKeyPatterns.some(
              (pattern) =>
                existingColumn.toLowerCase() === pattern.toLowerCase()
            )
          ) {
            detectedRelationships.push({
              source: existingNode.id,
              target: newNode.id,
              sourceColumn: existingColumn,
              targetColumn: newFilePrimaryKey,
              relationshipType: "foreign_key",
              confidence: "high",
              reason: "Foreign key pattern match (reverse)",
            });
          }

          // Pattern 3: Table name based patterns
          const newTableName = newNode.data.label.replace(/\.[^/.]+$/, ""); // Remove extension
          const tableNamePatterns = [
            `${newTableName}_id`,
            `${newTableName}Id`,
            `${newTableName.toLowerCase()}_id`,
            `${newTableName.toLowerCase()}Id`,
          ];

          if (
            tableNamePatterns.some(
              (pattern) =>
                existingColumn.toLowerCase() === pattern.toLowerCase()
            )
          ) {
            detectedRelationships.push({
              source: existingNode.id,
              target: newNode.id,
              sourceColumn: existingColumn,
              targetColumn: newFilePrimaryKey,
              relationshipType: "foreign_key",
              confidence: "medium",
              reason: "Table name pattern match (reverse)",
            });
          }
        });
      });

      // Remove duplicates based on source, target, and sourceColumn
      const uniqueRelationships = detectedRelationships.filter(
        (rel, index, self) =>
          index ===
          self.findIndex(
            (r) =>
              r.source === rel.source &&
              r.target === rel.target &&
              r.sourceColumn === rel.sourceColumn
          )
      );

      console.log("Detected relationships for new file:", uniqueRelationships);

      // Create edges for detected relationships
      if (uniqueRelationships.length > 0) {
        const newEdges = uniqueRelationships.map((rel, idx) => ({
          id: `auto-rel-${Date.now()}-${idx}`,
          source: rel.source,
          target: rel.target,
          label: `${rel.sourceColumn} → ${rel.targetColumn}`,
          animated: true,
          style: {
            stroke: rel.confidence === "high" ? "#28a745" : "#ffc107",
            strokeWidth: rel.confidence === "high" ? 3 : 2,
          },
          labelStyle: {
            fill: rel.confidence === "high" ? "#28a745" : "#ffc107",
            fontWeight: 600,
            fontSize: 11,
          },
          labelBgStyle: {
            fill: "#fff",
            fillOpacity: 0.9,
          },
          data: {
            relationshipType: rel.relationshipType,
            confidence: rel.confidence,
            sourceColumn: rel.sourceColumn,
            targetColumn: rel.targetColumn,
            autoDetected: true,
            reason: rel.reason,
          },
        }));

        setEdges((prev) => [...prev, ...newEdges]);

        // Clean up any duplicates that might have been created
        setTimeout(() => {
          cleanupDuplicateEdges();
        }, 200);

        // Show notification about auto-detected relationships
        if (uniqueRelationships.length > 0) {
          const highConfidenceCount = uniqueRelationships.filter(
            (r) => r.confidence === "high"
          ).length;
          const mediumConfidenceCount = uniqueRelationships.filter(
            (r) => r.confidence === "medium"
          ).length;

          let message = `Auto-detected ${uniqueRelationships.length} relationship(s) for ${newNode.data.label}:`;
          if (highConfidenceCount > 0) {
            message += `\n• ${highConfidenceCount} high confidence`;
          }
          if (mediumConfidenceCount > 0) {
            message += `\n• ${mediumConfidenceCount} medium confidence`;
          }
          message += `\n\nReview and edit relationships as needed.`;

          // You can replace this with a proper notification system
          console.log(message);
          alert(message);
        }
      }
    },
    [setEdges]
  );

  // Clean up duplicate edges
  const cleanupDuplicateEdges = useCallback(() => {
    setEdges((prev) => {
      const uniqueEdges = prev.filter(
        (edge, index, self) =>
          index ===
          self.findIndex(
            (e) =>
              e.source === edge.source &&
              e.target === edge.target &&
              e.data?.sourceColumn === edge.data?.sourceColumn
          )
      );

      if (uniqueEdges.length !== prev.length) {
        console.log(
          `Cleaned up ${prev.length - uniqueEdges.length} duplicate edges`
        );
      }

      return uniqueEdges;
    });
  }, []);

  // On connect (draw edge)
  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: {
              stroke: "#7366ff",
              strokeWidth: 2,
            },
            labelStyle: {
              fill: "#7366ff",
              fontWeight: 600,
              fontSize: 12,
            },
            labelBgStyle: {
              fill: "#fff",
              fillOpacity: 0.8,
            },
          },
          eds
        )
      ),
    [setEdges]
  );

  // Field mapping functions
  const openMappingModal = (sourceFile, targetFile) => {
    setMappingModal({
      open: true,
      sourceFile,
      targetFile,
    });
  };

  const closeMappingModal = () => {
    setMappingModal({
      open: false,
      sourceFile: null,
      targetFile: null,
    });
  };

  const saveFieldMapping = (
    sourceFile,
    targetFile,
    mappings,
    transformations
  ) => {
    const mappingKey = `${sourceFile.name}_${targetFile.name}`;
    setFieldMappings((prev) => ({
      ...prev,
      [mappingKey]: {
        sourceFile: sourceFile.name,
        targetFile: targetFile.name,
        mappings,
        transformations,
        timestamp: new Date().toISOString(),
      },
    }));
  };

  // Relationship management functions
  const openRelationshipModal = (mode = "add", relationship = null) => {
    setRelationshipModal({
      open: true,
      mode,
      relationship,
    });
  };

  const closeRelationshipModal = () => {
    setRelationshipModal({
      open: false,
      mode: "add",
      relationship: null,
    });
  };

  const addRelationship = (
    sourceNodeId,
    targetNodeId,
    sourceColumn,
    targetColumn,
    relationshipType = "foreign_key",
    confidence = "medium"
  ) => {
    const newEdge = {
      id: `rel-${Date.now()}`,
      source: sourceNodeId,
      target: targetNodeId,
      label: `${sourceColumn} → ${targetColumn}`,
      animated: true,
      style: {
        stroke: confidence === "high" ? "#28a745" : "#ffc107",
        strokeWidth: confidence === "high" ? 3 : 2,
      },
      labelStyle: {
        fill: confidence === "high" ? "#28a745" : "#ffc107",
        fontWeight: 600,
        fontSize: 11,
      },
      labelBgStyle: {
        fill: "#fff",
        fillOpacity: 0.9,
      },
      data: {
        relationshipType,
        confidence,
        sourceColumn,
        targetColumn,
      },
    };

    setEdges((prev) => [...prev, newEdge]);
    console.log("Added new relationship:", newEdge);
  };

  const editRelationship = (edgeId, updates) => {
    setEdges((prev) =>
      prev.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              ...updates,
              label: `${
                updates.data?.sourceColumn || edge.data?.sourceColumn
              } → ${updates.data?.targetColumn || edge.data?.targetColumn}`,
              style: {
                stroke:
                  updates.data?.confidence === "high" ? "#28a745" : "#ffc107",
                strokeWidth: updates.data?.confidence === "high" ? 3 : 2,
              },
              labelStyle: {
                fill:
                  updates.data?.confidence === "high" ? "#28a745" : "#ffc107",
                fontWeight: 600,
                fontSize: 11,
              },
              data: {
                ...edge.data,
                ...updates.data,
              },
            }
          : edge
      )
    );
    console.log("Updated relationship:", edgeId, updates);
  };

  const deleteRelationship = (edgeId) => {
    setEdges((prev) => prev.filter((edge) => edge.id !== edgeId));
    console.log("Deleted relationship:", edgeId);
  };

  const deleteAllRelationships = () => {
    setEdges((prev) => prev.filter((edge) => !edge.data?.relationshipType));
    console.log("Deleted all relationships");
  };

  // Entity deletion functions
  const openDeleteEntityModal = useCallback((entity) => {
    setDeleteEntityModal({
      open: true,
      entity,
    });
  }, []);

  const closeDeleteEntityModal = useCallback(() => {
    setDeleteEntityModal({
      open: false,
      entity: null,
    });
  }, []);

  const deleteEntity = useCallback(
    (entityId) => {
      // Find the entity to get its label (filename)
      const entityToDelete = nodes.find((node) => node.id === entityId);
      const entityLabel = entityToDelete?.data?.label;

      // Remove the entity node
      setNodes((prev) => prev.filter((node) => node.id !== entityId));

      // Remove all edges connected to this entity
      setEdges((prev) =>
        prev.filter(
          (edge) => edge.source !== entityId && edge.target !== entityId
        )
      );

      // If it's a file node, also remove from uploadedFiles and related arrays
      if (entityToDelete?.data?.isFileNode && entityLabel) {
        const deletedIndex = uploadedFiles.findIndex(
          (filename) => filename === entityLabel
        );

        if (deletedIndex !== -1) {
          setUploadedFiles((prev) =>
            prev.filter((filename) => filename !== entityLabel)
          );
          setFileData((prev) => prev.filter((_, idx) => idx !== deletedIndex));
          setRawEntities((prev) =>
            prev.filter((_, idx) => idx !== deletedIndex)
          );
          setCuratedEntities((prev) =>
            prev.filter((_, idx) => idx !== deletedIndex)
          );
        }
      }

      console.log("Deleted entity:", entityId, entityLabel);
      closeDeleteEntityModal();
    },
    [nodes, edges, uploadedFiles, closeDeleteEntityModal]
  );

  // Inject onUpdate and onDelete into all nodes
  const nodesWithUpdate = nodes.map((n) => ({
    ...n,
    data: { ...n.data, onUpdate, onDelete: openDeleteEntityModal },
  }));

  // Memoize nodeTypes to prevent React Flow warnings
  const nodeTypes = useMemo(
    () => ({
      entity: EntityNode,
    }),
    []
  );

  // Re-calculate relationships between all uploaded files
  const recalculateRelationships = useCallback(() => {
    console.log("Re-calculating relationships for all files...");

    // Get all file nodes
    const fileNodes = nodes.filter((node) => node.data.isFileNode);

    if (fileNodes.length < 2) {
      alert("Need at least 2 files to detect relationships");
      return;
    }

    // Remove existing relationship edges
    setEdges((prev) => prev.filter((edge) => !edge.data?.relationshipType));

    // Detect new relationships
    const relationships = detectRelationships(fileNodes);

    if (relationships.length === 0) {
      alert("No relationships detected between the uploaded files");
      return;
    }

    // Create new edges from detected relationships
    const newEdges = relationships.map((rel, idx) => ({
      id: `recalc-rel-${Date.now()}-${idx}`,
      source: rel.source,
      target: rel.target,
      label: `${rel.sourceColumn} → ${rel.targetColumn}`,
      animated: true,
      style: {
        stroke: rel.confidence === "high" ? "#28a745" : "#ffc107",
        strokeWidth: rel.confidence === "high" ? 3 : 2,
      },
      labelStyle: {
        fill: rel.confidence === "high" ? "#28a745" : "#ffc107",
        fontWeight: 600,
        fontSize: 11,
      },
      labelBgStyle: {
        fill: "#fff",
        fillOpacity: 0.9,
      },
      data: {
        relationshipType: rel.relationshipType,
        confidence: rel.confidence,
        sourceColumn: rel.sourceColumn,
        targetColumn: rel.targetColumn,
        recalculated: true,
        timestamp: new Date().toISOString(),
      },
    }));

    // Add new edges
    setEdges((prev) => [...prev, ...newEdges]);

    // Identify and highlight parent table
    const parentTable = identifyMainParentTable(fileNodes);
    if (parentTable) {
      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === parentTable.nodeId
            ? { ...node, data: { ...node.data, isParentTable: true } }
            : { ...node, data: { ...node.data, isParentTable: false } }
        )
      );
    }

    // Show notification
    const highConfidenceCount = relationships.filter(
      (r) => r.confidence === "high"
    ).length;
    const mediumConfidenceCount = relationships.filter(
      (r) => r.confidence === "medium"
    ).length;

    let message = `Re-calculated ${relationships.length} relationship(s):`;
    if (highConfidenceCount > 0) {
      message += `\n• ${highConfidenceCount} high confidence`;
    }
    if (mediumConfidenceCount > 0) {
      message += `\n• ${mediumConfidenceCount} medium confidence`;
    }
    if (parentTable) {
      message += `\n• Parent table: ${parentTable.tableName}`;
    }

    alert(message);
    console.log("Relationship re-calculation completed:", relationships);
  }, [nodes, setEdges, setNodes, detectRelationships, identifyMainParentTable]);

  return (
    <>
      <header className="d-flex justify-content-between mb-4">
        <h1 className="h3 fw-medium mb-0">DR.ai Canvas</h1>

        <div className="d-flex gap-2 align-items-center">
          <Button
            variant="outline-secondary btn-icon"
            title="New Entity"
            onClick={addEntity}
          >
            <BiPlus />
          </Button>

          <div className="d-flex gap-2 p-1 rounded bg-light">
            <Button
              variant={viewMode === "graph" ? "primary" : "default"}
              // className={`view-btn ${viewMode === "graph" ? "active" : ""}`}
              onClick={() => setViewMode("graph")}
            >
              <BiBarChartAlt2 size="20" /> View
            </Button>

            <Button
              variant={viewMode === "canvas" ? "primary" : "default"}
              // className={`view-btn ${viewMode === "canvas" ? "active" : ""}`}
              onClick={() => setViewMode("canvas")}
            >
              <BiCategory size="20" /> Canvas View
            </Button>
          </div>
        </div>
      </header>
      <div style={{ height: 700 }}>
        <div
          style={{
            width: "100%",
            height: 600,
            background: "#f7f6ff",
            borderRadius: 12,
          }}
        >
          {viewMode === "canvas" ? (
            <ReactFlow
              nodes={nodesWithUpdate}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              defaultEdgeOptions={{
                animated: true,
                style: { stroke: "#7366ff", strokeWidth: 2 },
                labelStyle: { fill: "#7366ff", fontWeight: 600, fontSize: 12 },
                labelBgStyle: { fill: "#fff", fillOpacity: 0.8 },
              }}
            >
              <MiniMap
                nodeColor={(node) =>
                  node.data.isNewOrUpdated ? "#ff6bcb" : "#7366ff"
                }
                maskColor="rgba(115,102,255,0.1)"
              />
              <Controls
                style={{
                  background: "#fff",
                  borderRadius: 8,
                  boxShadow: "0 4px 16px rgba(115,102,255,0.12)",
                }}
              />
              <Background
                color="#eee"
                gap={16}
                size={1}
                style={{ background: "#f7f6ff" }}
              />
            </ReactFlow>
          ) : (
            <div className="graph-view">
              <div className="graph-container">
                {nodes.map((node) => (
                  <div key={node.id} className="graph-node">
                    <div className="graph-node-header">
                      <span className="graph-node-title">
                        {node.data.label}
                      </span>
                      {node.data.scdType2 && (
                        <span className="graph-node-scd">SCD Type 2</span>
                      )}
                    </div>
                    <div className="graph-node-attributes">
                      {node.data.attributes.map((attr, idx) => (
                        <div key={idx} className="graph-attribute">
                          <span className="attribute-name">{attr.name}</span>
                          <span className="attribute-type">({attr.type})</span>
                        </div>
                      ))}
                    </div>
                    <div className="graph-node-connections">
                      {edges
                        .filter(
                          (edge) =>
                            edge.source === node.id || edge.target === node.id
                        )
                        .map((edge) => (
                          <div key={edge.id} className="graph-connection">
                            {edge.source === node.id ? "→ " : "← "}
                            {edge.label}
                            {edge.source === node.id
                              ? ` → ${
                                  nodes.find((n) => n.id === edge.target)?.data
                                    .label
                                }`
                              : ` ← ${
                                  nodes.find((n) => n.id === edge.source)?.data
                                    .label
                                }`}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <p style={{ marginTop: "2rem", color: "#7366ff", textAlign: "center" }}>
          {viewMode === "canvas"
            ? "Drag nodes, create new entities, edit names/attributes, mark SCD Type 2, and connect them to build your ERD. New/updated entities and attributes are pink."
            : "Graph view showing entity relationships and attributes. Toggle between views to see different representations of your data model."}
        </p>
      </div>
    </>
  );
}

export default CanvasPage;
