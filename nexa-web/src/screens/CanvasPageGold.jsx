import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";

import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";

import PresenceIndicator from "../components/PresenceIndicator";
import CollaborationBanner from "../components/CollaborationBanner";
import { usePresence } from "../hooks/usePresence";

// Add CSS for spinner animation
const spinnerStyles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Inject the styles
if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = spinnerStyles;
  document.head.appendChild(styleSheet);
}

// Custom edge component with remove button
function CustomEdge({ id, sourceX, sourceY, targetX, targetY, style = {} }) {
  const [edgePath] = useMemo(() => {
    // Create a smooth curved path using cubic Bezier curve
    const offset = Math.abs(targetX - sourceX) * 0.3;
    const controlPoint1X = sourceX + offset;
    const controlPoint1Y = sourceY;
    const controlPoint2X = targetX - offset;
    const controlPoint2Y = targetY;

    const curvedPath = `M ${sourceX} ${sourceY} C ${controlPoint1X} ${controlPoint1Y} ${controlPoint2X} ${controlPoint2Y} ${targetX} ${targetY}`;

    return [curvedPath];
  }, [sourceX, sourceY, targetX, targetY]);

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd="url(#react-flow__arrowhead)"
      />
      {/* Remove button hidden for now
      <foreignObject
        width={24}
        height={24}
        x={labelX - 12}
        y={labelY - 12}
        className="edgebutton-foreignobject"
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <button
          className="edgebutton"
          onClick={handleRemoveClick}
          style={{
            width: 24,
            height: 24,
            background: selected ? "#ff4444" : "#ff6666",
            border: "2px solid #fff",
            borderRadius: "50%",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: "bold",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
            opacity: selected ? 1 : 0.7,
            transition: "all 0.2s ease",
          }}
          title="Remove mapping"
          onMouseEnter={(e) => {
            e.target.style.background = "#ff4444";
            e.target.style.opacity = 1;
          }}
          onMouseLeave={(e) => {
            e.target.style.background = selected ? "#ff4444" : "#ff6666";
            e.target.style.opacity = selected ? 1 : 0.7;
          }}
        >
          ×
        </button>
      </foreignObject>
      */}
    </>
  );
}

// Custom edge for gold-to-gold mappings that connects from right side to right side
function GoldToGoldEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
}) {
  const [edgePath] = useMemo(() => {
    const control1X = sourceX + 100;
    const control2X = targetX + 100;

    const curvedPath = `M ${sourceX} ${sourceY} C ${control1X} ${sourceY} ${control2X} ${targetY} ${targetX} ${targetY}`;

    return [curvedPath];
  }, [sourceX, sourceY, targetX, targetY]);

  return (
    <path
      id={id}
      style={style}
      className="react-flow__edge-path"
      d={edgePath}
      markerEnd="url(#react-flow__arrowhead)"
    />
  );
}

// Define edge types outside component to prevent React Flow warnings
const createEdgeTypes = (setEdges) => ({
  custom: (props) => (
    <CustomEdge
      {...props}
      data={{
        ...props.data,
        onRemove: (edgeId) => {
          setEdges((eds) => eds.filter((e) => e.id !== edgeId));
        },
      }}
    />
  ),
  goldToGold: (props) => (
    <GoldToGoldEdge
      {...props}
      data={{
        ...props.data,
        onRemove: (edgeId) => {
          setEdges((eds) => eds.filter((e) => e.id !== edgeId));
        },
      }}
    />
  ),
});

// Define node types outside component to prevent React Flow warnings
const createNodeTypes = (setNodes, setEdges, edges) => ({
  entity: (props) => (
    <EntityNode
      {...props}
      setNodes={setNodes}
      setEdges={setEdges}
      edges={edges}
    />
  ),
});

// Custom node for editable entity (adapted for curated/consumption files)
const EntityNode = React.memo(
  ({ id, data, selected, isConnectable, setNodes, setEdges, edges }) => {
  const [editingField, setEditingField] = useState(null);
  const [fieldEditValue, setFieldEditValue] = useState("");
    const [isCollapsed, setIsCollapsed] = useState(() => {
      // Initialize based on the global expansion state
      if (data.isConsumptionFile) {
        return !data.isExpanded;
      } else {
        return !data.isExpanded;
      }
    });

  const entityName = data.label;

    // Sync local collapsed state with global expansion state
    useEffect(() => {
      setIsCollapsed(!data.isExpanded);
    }, [data.isExpanded]);
  const scdType2 = data.scdType2 || false;
  // Use data.attributes directly instead of local state to avoid sync issues
  const attributes = data.attributes || [];

    const toggleCollapsed = useCallback(() => {
      setIsCollapsed(!isCollapsed);

      // Also trigger the hierarchical view toggle
      if (data.onToggleExpansion) {
        data.onToggleExpansion(id);
      }
    }, [isCollapsed, data.onToggleExpansion, id]);

    // Node styling based on entity type - matching the images exactly
    const nodeColor = data.isCuratedFile ? "#8B5CF6" : "#10B981"; // Purple for curated, green for consumption
    const nodeBg = "#ffffff";
    const borderColor = data.isCuratedFile ? "#8B5CF6" : "#10B981";

  // Delete field (curated only)
    const deleteField = useCallback(
      (fieldName) => {
        const fieldToDelete = attributes.find(
          (attr) => attr.name === fieldName
        );
    const fieldValue = fieldToDelete?.value || fieldName;

        const updatedAttrs = attributes.filter(
          (attr) => attr.name !== fieldName
        );
    if (setNodes) {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, attributes: updatedAttrs } }
            : n
        )
      );
    }
    // Remove any edges targeting this field
    if (setEdges && edges) {
      setEdges((eds) =>
        eds.filter(
          (e) => e.target !== id || e.targetHandle !== `${id}-${fieldValue}`
        )
      );
    }
      },
      [attributes, id, setNodes, setEdges, edges]
    );

  // Rename field (curated only)
    const startEditField = useCallback(
      (fieldName) => {
    const field = attributes.find((attr) => attr.name === fieldName);
    const displayValue = field?.label || fieldName;
    setEditingField(fieldName);
    setFieldEditValue(displayValue);
      },
      [attributes]
    );

    const saveEditField = useCallback(
      (oldName) => {
    const trimmed = fieldEditValue.trim();
    if (!trimmed) return;

    // Check for duplicate column names (case-insensitive)
    const existingColumn = attributes.find(
      (attr) =>
        attr.name !== oldName &&
        (attr.label || attr.name).toLowerCase() === trimmed.toLowerCase()
    );

    if (existingColumn) {
      alert(
        `Column "${trimmed}" already exists. Please choose a different name.`
      );
      return;
    }

    const updatedAttrs = attributes.map((attr) =>
      attr.name === oldName ? { ...attr, label: trimmed } : attr
    );
    setEditingField(null);
    setFieldEditValue("");
    if (setNodes) {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, attributes: updatedAttrs } }
            : n
        )
      );
    }

    // Auto-map the renamed column to unmapped curated columns
    if (data.isConsumptionFile && data.allNodes) {
          const curatedNodes = data.allNodes.filter(
            (n) => n.data.isCuratedFile
          );
      const existingMappings = edges.filter(
        (e) => e.data?.relationshipType === "field_mapping"
      );

      if (curatedNodes.length > 0) {
        const curatedColumns = curatedNodes.flatMap(
          (node) => node.data.attributes || []
        );

        // Get unmapped curated columns
        const mappedCuratedColumns = new Set(
          existingMappings.map((mapping) => mapping.sourceColumn)
        );
        const unmappedCuratedColumns = curatedColumns.filter(
          (col) => !mappedCuratedColumns.has(col.name)
        );

        // Find the renamed column
        const renamedColumn = updatedAttrs.find(
          (attr) => attr.name === oldName
        );
        if (renamedColumn && unmappedCuratedColumns.length > 0) {
          const suggestions = smartMappingEngine(
            unmappedCuratedColumns,
            [renamedColumn],
            existingMappings
          );

          // Find suggestions specifically for the renamed column
          const renamedColumnSuggestions = suggestions.filter(
            (s) => s.consumptionColumn === renamedColumn.value
          );

          if (renamedColumnSuggestions.length > 0) {
            const bestSuggestion = renamedColumnSuggestions[0];

            // Auto-create the mapping
            const sourceNode = curatedNodes.find((n) =>
              n.data.attributes?.some(
                (attr) => attr.name === bestSuggestion.curatedColumn
              )
            );

            if (sourceNode) {
              const newEdge = {
                id: `auto-${sourceNode.id}-${
                  bestSuggestion.curatedColumn
                }-${id}-${renamedColumn.value}-${Date.now()}`,
                source: sourceNode.id,
                sourceHandle: `${sourceNode.id}-${bestSuggestion.curatedColumn}`,
                target: id,
                targetHandle: `${id}-${renamedColumn.value}`,
                    animated: false,
                    style: { 
                      stroke: "#000000", 
                      strokeWidth: 2,
                      strokeDasharray: "5,5", // Creates dashed lines
                    },
                data: {
                  relationshipType: "field_mapping",
                  sourceColumn: bestSuggestion.curatedColumn,
                  targetColumn: renamedColumn.value,
                  transformation: "direct",
                  autoGenerated: true,
                  reason: bestSuggestion.reason,
                },
              };

                  // Validate the edge before adding it
                  if (validateEdge(newEdge, [sourceNode, { id, data }])) {
              setEdges((eds) => [...eds, newEdge]);
            }
          }
        }
      }
    }
        }
      },
      [fieldEditValue, attributes, id, setNodes, data, edges, setEdges]
    );

  // Add new column (curated only)
    const addColumn = useCallback(() => {
    // Generate a unique name with timestamp to avoid conflicts
    const timestamp = Date.now();
    const newName = `new_field_${timestamp}`;

    // Check if this name already exists (shouldn't happen with timestamp, but just in case)
    const existingColumn = attributes.find(
      (attr) =>
        (attr.label || attr.name).toLowerCase() === newName.toLowerCase()
    );

    if (existingColumn) {
      alert(`Column "${newName}" already exists. Please try again.`);
      return;
    }

    const newAttr = {
      name: newName,
      type: "string",
      label: newName,
      value: newName,
    };
    const updatedAttrs = [...attributes, newAttr];
    if (setNodes) {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, attributes: updatedAttrs } }
            : n
        )
      );
    }

    // Use smart mapping engine to find potential mappings for the new column
    if (data.allNodes && data.isConsumptionFile) {
      const curatedNodes = data.allNodes.filter((n) => n.data.isCuratedFile);
      const existingMappings = edges.filter(
        (e) => e.data?.relationshipType === "field_mapping"
      );

      if (curatedNodes.length > 0) {
        const curatedColumns = curatedNodes.flatMap(
          (node) => node.data.attributes || []
        );

        // Get unmapped curated columns
        const mappedCuratedColumns = new Set(
          existingMappings.map((mapping) => mapping.sourceColumn)
        );
        const unmappedCuratedColumns = curatedColumns.filter(
          (col) => !mappedCuratedColumns.has(col.name)
        );

        // Only proceed if there are unmapped curated columns
        if (unmappedCuratedColumns.length > 0) {
          const suggestions = smartMappingEngine(
            unmappedCuratedColumns,
            [newAttr],
            existingMappings
          );

          // Find suggestions specifically for the new column
          const newColumnSuggestions = suggestions.filter(
            (s) => s.consumptionColumn === newName
          );

          if (newColumnSuggestions.length > 0) {
            const bestSuggestion = newColumnSuggestions[0];

            // Auto-create the mapping
            const sourceNode = curatedNodes.find((n) =>
              n.data.attributes?.some(
                (attr) => attr.name === bestSuggestion.curatedColumn
              )
            );

            if (sourceNode) {
              const newEdge = {
                id: `auto-${sourceNode.id}-${bestSuggestion.curatedColumn}-${id}-${newName}-${timestamp}`,
                source: sourceNode.id,
                sourceHandle: `${sourceNode.id}-${bestSuggestion.curatedColumn}`,
                target: id,
                targetHandle: `${id}-${newName}`,
                  animated: false,
                  style: { 
                    stroke: "#000000", 
                    strokeWidth: 2,
                    strokeDasharray: "5,5", // Creates dashed lines
                  },
                data: {
                  relationshipType: "field_mapping",
                  sourceColumn: bestSuggestion.curatedColumn,
                  targetColumn: newName,
                  transformation: "direct",
                  autoGenerated: true,
                  reason: bestSuggestion.reason,
                },
              };

                // Validate the edge before adding it
                if (validateEdge(newEdge, [sourceNode, { id, data }])) {
              setEdges((eds) => [...eds, newEdge]);
                }
            }
          }
        }
      }
    }

    // Also call the column added handler
    if (data.onColumnAdded) {
      data.onColumnAdded(id, newAttr.value);
    }
    }, [attributes, id, setNodes, data, edges, setEdges]);

  return (
    <div
      style={{
        background: nodeBg,
          border: `2px solid ${borderColor}`,
          borderRadius: 6,
        padding: 0,
          minWidth: 300,
          maxWidth: 360,
          boxShadow: selected
            ? "0 0 0 2px #7366ff"
            : "0 1px 3px rgba(0,0,0,0.1)",
        fontFamily: "Inter, sans-serif",
        position: "relative",
      }}
    >
        {/* Auto-Generated label */}
        <div
          style={{
            position: "absolute",
            top: -6,
            left: 12,
            background: "#DBEAFE",
            color: "#1E40AF",
            fontSize: 9,
            fontWeight: 600,
            padding: "1px 6px",
            borderRadius: 3,
            zIndex: 10,
            border: "1px solid #BFDBFE",
          }}
        >
          Auto-Generated
        </div>

        {/* Entity header with icons */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
            padding: "14px 16px 10px 16px",
            borderBottom: isCollapsed ? "none" : `1px solid ${borderColor}25`,
          }}
        >
          {/* Left side - Plus icon and entity name */}
          <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
            {/* Plus icon on the left */}
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#F3F4F6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 10,
                cursor: "pointer",
                border: "1px solid #E5E7EB",
              }}
              title="Add field"
            >
              <span
                style={{ fontSize: 12, color: "#6B7280", fontWeight: "bold" }}
              >
                +
              </span>
            </div>

            <span
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: "#374151",
                wordBreak: "break-word",
                lineHeight: "1.3",
                maxWidth: "160px",
              }}
            >
          {entityName}
        </span>

        {scdType2 && (
          <span
            style={{
                  background: "#1F2937",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: 9,
                  borderRadius: 3,
                  padding: "1px 5px",
                  marginLeft: 6,
            }}
          >
            SCD2
          </span>
        )}
          </div>

          {/* Right side - Action icons */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {/* Paperclip icon */}
            <div
                style={{
                width: 14,
                height: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#6B7280",
                fontSize: 10,
                }}
              title="Attach file"
            >
              📎
      </div>

            {/* Link icon */}
            <div
                style={{
                width: 14,
                height: 14,
                  display: "flex",
                  alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#6B7280",
                fontSize: 10,
                }}
              title="Link entity"
            >
              🔗
            </div>

            {/* Dropdown arrow */}
            <div
              style={{
                width: 14,
                height: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#6B7280",
                fontSize: 10,
              }}
              onClick={toggleCollapsed}
              title={isCollapsed ? "Expand entity" : "Collapse entity"}
            >
              {isCollapsed ? "▶" : "▼"}
            </div>

            {/* Three dots menu */}
            <div
              style={{
                width: 14,
                height: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#6B7280",
                fontSize: 12,
                fontWeight: "bold",
              }}
              title="More options"
            >
              ⋮
            </div>
          </div>
        </div>
        {/* Field list - only show when expanded */}
        {!isCollapsed && (
          <div style={{ padding: "6px 0 4px 0" }}>
        {attributes.map((attr, idx) => (
          <div
            key={`${id}-${attr.name}-${idx}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
                  padding: "0 16px",
                  height: 28,
              borderBottom:
                    idx < attributes.length - 1 ? "1px solid #f3f4f6" : "none",
              position: "relative",
            }}
          >
            {/* Left side - Field name and type */}
            <div style={{ display: "flex", alignItems: "center" }}>
              {/* Field name/type (editable for consumption) */}
              {data.isConsumptionFile && editingField === attr.name ? (
                <input
                  data-no-drag
                  value={fieldEditValue}
                  onChange={(e) => setFieldEditValue(e.target.value)}
                  onBlur={() => saveEditField(attr.name)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEditField(attr.name);
                  }}
                  style={{
                    fontWeight: 700,
                    color: nodeColor,
                    fontSize: 14,
                    border: `1.5px solid ${nodeColor}`,
                    borderRadius: 6,
                    padding: "2px 6px",
                    width: 90,
                  }}
                  autoFocus
                />
              ) : (
                <span
                  data-no-drag
                  style={{
                        fontWeight: 500,
                        color: "#374151",
                        fontSize: 11,
                    cursor: data.isConsumptionFile ? "pointer" : "default",
                        wordBreak: "break-word",
                        lineHeight: "1.3",
                        maxWidth: "160px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                  }}
                  onClick={
                    data.isConsumptionFile
                      ? () => startEditField(attr.name)
                      : undefined
                  }
                      title={
                        data.isConsumptionFile
                          ? "Click to rename"
                          : attr.label || attr.name
                      }
                >
                  {attr.label || attr.name}
                </span>
              )}
              <span
                style={{
                      color: "#9CA3AF",
                  fontWeight: 400,
                      fontSize: 9,
                      marginLeft: 6,
                }}
              >
                ({attr.type})
              </span>
            </div>

            {/* Right side - Action buttons for consumption fields */}
            {data.isConsumptionFile && (
              <div data-no-drag style={{ display: "flex", gap: 4 }}>
                <button
                  data-no-drag
                  style={{
                        background: "#000000",
                        color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    padding: "2px 6px",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 10,
                  }}
                  onClick={() => data.onRuleClick?.(id, attr.name, "nlp")}
                  title="Edit NLP Rule"
                >
                  NLP
                </button>
                <button
                  data-no-drag
                  style={{
                        background: "#000000",
                        color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    padding: "2px 6px",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 10,
                  }}
                  onClick={() => data.onRuleClick?.(id, attr.name, "dq")}
                  title="Edit DQ Rule"
                >
                  DQ
                </button>
                <button
                  data-no-drag
                  style={{
                        background: "#000000",
                        color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    padding: "2px 6px",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 10,
                  }}
                      onClick={() =>
                        data.onRuleClick?.(id, attr.name, "operator")
                      }
                  title="Edit Operator Rule"
                >
                  Op
                </button>
                <span
                  data-no-drag
                  style={{
                        color: "#000000",
                    cursor: "pointer",
                    fontSize: 14,
                    marginLeft: 2,
                  }}
                  title="Delete field"
                  onClick={() => deleteField(attr.name)}
                >
                  🗑️
                </span>
              </div>
            )}
                {/* Source handle - Right side for curated, both sides for consumption */}
            <Handle
              type="source"
                  position={data.isCuratedFile ? Position.Right : Position.Left}
              id={`${id}-${attr.value || attr.name}`}
              style={{
                    [data.isCuratedFile ? "right" : "left"]: -16,
                top: "50%",
                transform: "translateY(-50%)",
                background: "#fff",
                border: `3px solid ${nodeColor}`,
                width: 18,
                height: 18,
                borderRadius: "50%",
                boxShadow: `0 0 0 2px ${nodeColor}22`,
                zIndex: 2,
                cursor: "pointer",
              }}
              isConnectable={isConnectable}
            />
                {/* Target handle - Right side for curated, both sides for consumption */}
            <Handle
              type="target"
                  position={data.isCuratedFile ? Position.Right : Position.Left}
              id={`${id}-${attr.value || attr.name}`}
              style={{
                    [data.isCuratedFile ? "right" : "left"]: -16,
                top: "50%",
                transform: "translateY(-50%)",
                background: "#fff",
                border: `3px solid ${nodeColor}`,
                width: 18,
                height: 18,
                borderRadius: "50%",
                boxShadow: `0 0 0 2px ${nodeColor}22`,
                zIndex: 2,
                cursor: "pointer",
              }}
              isConnectable={isConnectable}
            />
                {/* Additional right-side handles for consumption entities only */}
                {data.isConsumptionFile && (
                  <>
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={`${id}-${attr.value || attr.name}-right`}
                      style={{
                        right: -16,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "#fff",
                        border: `3px solid ${nodeColor}`,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        boxShadow: `0 0 0 2px ${nodeColor}22`,
                        zIndex: 2,
                        cursor: "pointer",
                      }}
                      isConnectable={isConnectable}
                    />
                    <Handle
                      type="target"
                      position={Position.Right}
                      id={`${id}-${attr.value || attr.name}-right`}
                      style={{
                        right: -16,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "#fff",
                        border: `3px solid ${nodeColor}`,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        boxShadow: `0 0 0 2px ${nodeColor}22`,
                        zIndex: 2,
                        cursor: "pointer",
                      }}
                      isConnectable={isConnectable}
                    />
                  </>
                )}
          </div>
        ))}
        {/* Add new column button for consumption tables */}
        {data.isConsumptionFile && (
              <div style={{ padding: "6px 16px 10px 16px" }}>
            <button
              onClick={addColumn}
              style={{
                    background: "#F3F4F6",
                    color: "#374151",
                    border: "1px solid #D1D5DB",
                    borderRadius: 4,
                    padding: "4px 12px",
                    fontWeight: 600,
                    fontSize: 11,
                cursor: "pointer",
                width: "100%",
              }}
            >
              + Add Column
            </button>
          </div>
        )}
      </div>
        )}

        {/* Collapsed state indicator */}
        {isCollapsed && (
          <div
            style={{
              padding: "6px 16px 10px 16px",
              color: "#6B7280",
              fontSize: "10px",
              fontWeight: "500",
              textAlign: "center",
              borderTop: `1px solid #f3f4f6`,
            }}
          >
            {data.isConsumptionFile
              ? `${attributes.length} fields • Click ▶ to expand and show related entities`
              : `${attributes.length} field${
                  attributes.length !== 1 ? "s" : ""
                } • Click ▶ to expand`}
          </div>
        )}
    </div>
  );
}
);

// Initial nodes for the canvas (empty - no default entities)
const initialNodes = [];

// Initial edges for the canvas - start empty and generate mappings after mount
const initialEdges = [];

// Function to read gold-to-gold mappings
const readGoldToGoldMappingFile = async () => {
  try {
    // Read the actual CSV file from the mappings folder
    const response = await fetch("/mappings/gold_data_mappings.csv");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvContent = await response.text();
    const lines = csvContent.split("\n");
    const mappings = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const [
          sourceEntity,
          sourceAttribute,
          targetEntity,
          targetAttribute,
          relationshipType,
        ] = line.split(",").map((col) => col.trim());

        if (
          sourceEntity &&
          sourceAttribute &&
          targetEntity &&
          targetAttribute &&
          relationshipType
        ) {
          mappings.push({
            sourceEntity: sourceEntity.toLowerCase(),
            sourceAttribute: sourceAttribute.toLowerCase(),
            targetEntity: targetEntity.toLowerCase(),
            targetAttribute: targetAttribute.toLowerCase(),
            relationshipType: relationshipType
              .toLowerCase()
              .replace(/\s+/g, "_"),
          });
        }
      }
    }

    return mappings;
  } catch {
    return [];
  }
};

// Function to find the correct handle ID for a given attribute name
const findHandleId = (node, attributeName) => {
  if (!node.data.attributes) return null;

  // Try exact match first
  const exactMatch = node.data.attributes.find(
    (attr) =>
      attr.name.toLowerCase() === attributeName.toLowerCase() ||
      attr.value.toLowerCase() === attributeName.toLowerCase()
  );
  if (exactMatch) {
    return `${node.id}-${exactMatch.value || exactMatch.name}-right`;
  }

  // Try partial match
  const partialMatch = node.data.attributes.find(
    (attr) =>
      attr.name.toLowerCase().includes(attributeName.toLowerCase()) ||
      attr.value.toLowerCase().includes(attributeName.toLowerCase()) ||
      attributeName.toLowerCase().includes(attr.name.toLowerCase()) ||
      attributeName.toLowerCase().includes(attr.value.toLowerCase())
  );
  if (partialMatch) {
    return `${node.id}-${partialMatch.value || partialMatch.name}-right`;
  }

  return null;
};

// Function to auto-generate field mappings between curated and consumption files
const generateFieldMappings = (curatedNode, consumptionNode) => {
  const mappings = [];
  const curatedAttrs = curatedNode.data.attributes || [];
  const consumptionAttrs = consumptionNode.data.attributes || [];

  // First, handle ID fields with strict matching
  const idFields = [
    "id",
    "customer_id",
    "user_id",
    "order_id",
    "product_id",
    "account_id",
    "entity_id",
  ];

  curatedAttrs.forEach((curatedAttr) => {
    const curatedName = curatedAttr.name.toLowerCase();
    const isIdField = idFields.some(
      (idField) => curatedName === idField || curatedName.includes("id")
    );
    
    if (isIdField) {
      // For ID fields, only look for exact matches or very specific ID field matches
      const exactMatch = consumptionAttrs.find((consumptionAttr) => {
          const consumptionValue = consumptionAttr.value.toLowerCase();
        return (
          consumptionValue === curatedName ||
          (consumptionValue.includes("id") &&
                  (consumptionValue === curatedName || 
              consumptionValue === "id" ||
              consumptionValue === curatedName.replace("_id", "id")))
      );
      });

      if (exactMatch) {
        const edge = {
          id: `auto-${curatedNode.id}-${curatedAttr.name}-${
            consumptionNode.id
          }-${exactMatch.value}-${Date.now()}`,
          source: curatedNode.id,
          sourceHandle: `${curatedNode.id}-${
            curatedAttr.value || curatedAttr.name
          }`,
          target: consumptionNode.id,
          targetHandle: `${consumptionNode.id}-${exactMatch.value}`,
          animated: false,
          style: { 
            stroke: "#000000", 
            strokeWidth: 2,
            strokeDasharray: "5,5", // Creates dashed lines
          },
          data: {
            relationshipType: "field_mapping",
            sourceColumn: curatedAttr.name,
            targetColumn: exactMatch.value,
            transformation: "direct",
            autoGenerated: true,
          },
        };

        // Validate the edge before adding it
        if (validateEdge(edge, [curatedNode, consumptionNode])) {
          mappings.push(edge);
        }
      }
      return; // Skip partial matching for ID fields
    }

    // For non-ID fields, use the original logic
    // Try to find exact match first
    const exactMatch = consumptionAttrs.find(
      (consumptionAttr) =>
        consumptionAttr.value.toLowerCase() === curatedAttr.name.toLowerCase()
    );

    if (exactMatch) {
      const edge = {
        id: `auto-${curatedNode.id}-${curatedAttr.name}-${consumptionNode.id}-${
          exactMatch.value
        }-${Date.now()}`,
        source: curatedNode.id,
        sourceHandle: `${curatedNode.id}-${
          curatedAttr.value || curatedAttr.name
        }`,
        target: consumptionNode.id,
        targetHandle: `${consumptionNode.id}-${exactMatch.value}`,
        animated: false,
        style: { 
          stroke: "#000000", 
          strokeWidth: 2,
          strokeDasharray: "5,5", // Creates dashed lines
        },
        data: {
          relationshipType: "field_mapping",
          sourceColumn: curatedAttr.name,
          targetColumn: exactMatch.value,
          transformation: "direct",
          autoGenerated: true,
        },
      };

      // Validate the edge before adding it
      if (validateEdge(edge, [curatedNode, consumptionNode])) {
        mappings.push(edge);
      }
      return;
    }

    // Try to find partial matches (but exclude ID fields from partial matching)
    const partialMatches = consumptionAttrs.filter((consumptionAttr) => {
      const consumptionValue = consumptionAttr.value.toLowerCase();
      
      // Skip if consumption field is an ID field
      const isConsumptionIdField = idFields.some(
        (idField) =>
          consumptionValue === idField || consumptionValue.includes("id")
      );
      
      if (isConsumptionIdField) {
        return false; // Don't use ID fields for partial matching
      }

      const curatedName = curatedAttr.name.toLowerCase();

      // Check for common patterns
      return (
        consumptionValue.includes(curatedName) ||
        curatedName.includes(consumptionValue) ||
        consumptionValue.replace(/[^a-z]/g, "") ===
          curatedName.replace(/[^a-z]/g, "") ||
        consumptionValue
          .replace(/[^a-z]/g, "")
          .includes(curatedName.replace(/[^a-z]/g, "")) ||
        curatedName
          .replace(/[^a-z]/g, "")
          .includes(consumptionValue.replace(/[^a-z]/g, ""))
      );
    });

    if (partialMatches.length > 0) {
      const bestMatch = partialMatches[0];
      const edge = {
        id: `auto-${curatedNode.id}-${curatedAttr.name}-${consumptionNode.id}-${
          bestMatch.value
        }-${Date.now()}`,
        source: curatedNode.id,
        sourceHandle: `${curatedNode.id}-${
          curatedAttr.value || curatedAttr.name
        }`,
        target: consumptionNode.id,
        targetHandle: `${consumptionNode.id}-${bestMatch.value}`,
        animated: false,
        style: { 
          stroke: "#000000", 
          strokeWidth: 2,
          strokeDasharray: "5,5", // Creates dashed lines
        },
        data: {
          relationshipType: "field_mapping",
          sourceColumn: curatedAttr.name,
          targetColumn: bestMatch.value,
          transformation: "rename",
          autoGenerated: true,
        },
      };

      // Validate the edge before adding it
      if (validateEdge(edge, [curatedNode, consumptionNode])) {
        mappings.push(edge);
      }
    }
  });

  return mappings;
};

// Helper function to validate edge creation
const validateEdge = (edge, nodes) => {
  // Check if source node exists
  const sourceNode = nodes.find((n) => n.id === edge.source);
  if (!sourceNode) {
    return false;
  }

  // Check if target node exists
  const targetNode = nodes.find((n) => n.id === edge.target);
  if (!targetNode) {
    return false;
  }

  // Check if source handle exists (for curated nodes, handles are on the right)
  const sourceAttr = sourceNode.data.attributes?.find(
    (attr) =>
      attr.name === edge.data?.sourceColumn ||
      attr.value === edge.data?.sourceColumn
  );
  if (!sourceAttr) {
    return false;
  }

  // Check if target handle exists (for consumption nodes, handles are on the left)
  const targetAttr = targetNode.data.attributes?.find(
    (attr) =>
      attr.name === edge.data?.targetColumn ||
      attr.value === edge.data?.targetColumn
  );
  if (!targetAttr) {
    return false;
  }

  return true;
};

// Smart mapping engine to identify potential field mappings
const smartMappingEngine = (
  curatedColumns,
  consumptionColumns,
  existingMappings
) => {
  const suggestions = [];

  // Get unmapped curated columns
  const mappedCuratedColumns = new Set(
    existingMappings.map((mapping) => mapping.sourceColumn)
  );
  const unmappedCuratedColumns = curatedColumns.filter(
    (col) => !mappedCuratedColumns.has(col.name)
  );

  // Get unmapped consumption columns
  const mappedConsumptionColumns = new Set(
    existingMappings.map((mapping) => mapping.targetColumn)
  );
  const unmappedConsumptionColumns = consumptionColumns.filter(
    (col) => !mappedConsumptionColumns.has(col.value || col.name)
  );

  unmappedCuratedColumns.forEach((curatedCol) => {
    unmappedConsumptionColumns.forEach((consumptionCol) => {
      const consumptionValue = consumptionCol.value || consumptionCol.name;
      const consumptionLabel = consumptionCol.label || consumptionCol.name;

      // Try matching against both the value and the label
      const score1 = calculateSimilarityScore(
        curatedCol.name,
        consumptionValue
      );
      const score2 = calculateSimilarityScore(
        curatedCol.name,
        consumptionLabel
      );
      const score = Math.max(score1, score2);

      // Lower threshold to catch more potential matches, including custom column names
      if (score > 0.15) {
        suggestions.push({
          curatedColumn: curatedCol.name,
          consumptionColumn: consumptionValue,
          score: score,
          reason: getSimilarityReason(curatedCol.name, consumptionLabel, score),
        });
      }
    });
  });

  // Sort by score (highest first)
  return suggestions.sort((a, b) => b.score - a.score);
};

// Calculate similarity score between two column names
const calculateSimilarityScore = (name1, name2) => {
  const n1 = name1.toLowerCase();
  const n2 = name2.toLowerCase();

  // Exact match
  if (n1 === n2) return 1.0;

  // Contains match
  if (n1.includes(n2) || n2.includes(n1)) return 0.9;

  // Special handling for ID-related patterns (only this one is kept as it's very common)
  const idPatterns = ["id", "identifier", "key", "index", "_id"];
  const hasIdPattern1 = idPatterns.some((pattern) => n1.includes(pattern));
  const hasIdPattern2 = idPatterns.some((pattern) => n2.includes(pattern));

  if (hasIdPattern1 && hasIdPattern2) {
    return 0.85; // High score for ID-related matches
  }

  // Word-based similarity (completely dynamic approach)
  const words1 = n1.split(/[_\s-]+/);
  const words2 = n2.split(/[_\s-]+/);

  let wordMatches = 0;
  let totalWords = Math.max(words1.length, words2.length);

  words1.forEach((word1) => {
    words2.forEach((word2) => {
      if (word1 === word2) wordMatches++;
      else if (word1.includes(word2) || word2.includes(word1))
        wordMatches += 0.5;
      // Special handling for ID patterns
      else if (idPatterns.includes(word1) && idPatterns.includes(word2))
        wordMatches += 0.8;
      // Handle partial word matches (more flexible)
      else if (word1.length > 2 && word2.length > 2) {
        const similarity = calculateLevenshteinSimilarity(word1, word2);
        if (similarity > 0.7) wordMatches += similarity * 0.6;
      }
    });
  });

  const wordScore = wordMatches / totalWords;

  // Character-based similarity (Levenshtein distance)
  const charScore = calculateLevenshteinSimilarity(n1, n2);

  // Completely dynamic approach - no hard-coded patterns
  // Weighted combination with emphasis on flexible matching
  return wordScore * 0.7 + charScore * 0.3;
};

// Calculate Levenshtein distance similarity
const calculateLevenshteinSimilarity = (str1, str2) => {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[str2.length][str1.length];
  const maxLength = Math.max(str1.length, str2.length);
  return 1 - distance / maxLength;
};

// Get reason for similarity
const getSimilarityReason = (name1, name2) => {
  const n1 = name1.toLowerCase();
  const n2 = name2.toLowerCase();

  if (n1 === n2) return "Exact match";
  if (n1.includes(n2) || n2.includes(n1)) return "Contains match";

  const words1 = n1.split(/[_\s-]+/);
  const words2 = n2.split(/[_\s-]+/);

  const commonWords = words1.filter((word1) =>
    words2.some(
      (word2) =>
        word1 === word2 || word1.includes(word2) || word2.includes(word1)
    )
  );

  if (commonWords.length > 0) {
    return `Common words: ${commonWords.join(", ")}`;
  }

  // Check for similar character patterns
  const charSimilarity = calculateLevenshteinSimilarity(n1, n2);
  if (charSimilarity > 0.7) {
    return `Similar character pattern (${Math.round(
      charSimilarity * 100
    )}% similarity)`;
  }

  return "Similar naming pattern";
};

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
  const [relationshipType, setRelationshipType] = useState("mapping");

  useEffect(() => {
    if (open && relationship) {
      setSourceNodeId(relationship.source || "");
      setTargetNodeId(relationship.target || "");
      setSourceColumn(relationship.data?.sourceColumn || "");
      setTargetColumn(relationship.data?.targetColumn || "");
      setRelationshipType(relationship.data?.relationshipType || "mapping");
    } else if (open) {
      // Reset for new relationship
      setSourceNodeId("");
      setTargetNodeId("");
      setSourceColumn("");
      setTargetColumn("");
      setRelationshipType("mapping");
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
                  {node.data.label} (
                  {node.data.isCuratedFile
                    ? "Curated"
                    : node.data.isConsumptionFile
                    ? "Consumption"
                    : "Custom"}
                  )
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
                  {node.data.label} (
                  {node.data.isCuratedFile
                    ? "Curated"
                    : node.data.isConsumptionFile
                    ? "Consumption"
                    : "Custom"}
                  )
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
              <option value="mapping">Field Mapping</option>
              <option value="foreign_key">Foreign Key</option>
              <option value="one_to_one">One-to-One</option>
              <option value="one_to_many">One-to-Many</option>
              <option value="many_to_many">Many-to-Many</option>
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
                {entity.data?.isCuratedFile
                  ? "Curated File"
                  : entity.data?.isConsumptionFile
                  ? "Consumption File"
                  : "Custom Entity"}
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

// 360 Degree View Modal Component
function Create360ViewModal({ open, onClose, curatedNodes, onCreate360View }) {
  const [selectedTables, setSelectedTables] = useState([]);
  const [viewName, setViewName] = useState("360° Customer View");

  useEffect(() => {
    if (open) {
      setSelectedTables([]);
      setViewName("360° Customer View");
    }
  }, [open]);

  const handleCreate = () => {
    if (selectedTables.length === 0) {
      alert("Please select at least one curated table");
      return;
    }
    if (!viewName.trim()) {
      alert("Please enter a name for the 360° view");
      return;
    }
    onCreate360View(viewName, selectedTables);
    onClose();
  };

  const toggleTableSelection = (tableId) => {
    setSelectedTables((prev) =>
      prev.includes(tableId)
        ? prev.filter((id) => id !== tableId)
        : [...prev, tableId]
    );
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
          <h3 style={{ margin: 0, color: "#7366ff" }}>Create 360° View</h3>
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
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontWeight: "600",
            }}
          >
            View Name:
          </label>
          <input
            type="text"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "14px",
            }}
            placeholder="Enter 360° view name"
          />
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontWeight: "600",
            }}
          >
            Select Curated Tables:
          </label>
          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              border: "1px solid #ddd",
              borderRadius: "4px",
              padding: "0.5rem",
            }}
          >
            {curatedNodes.map((node) => (
              <div
                key={node.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0.5rem",
                  borderBottom: "1px solid #eee",
                  cursor: "pointer",
                  background: selectedTables.includes(node.id)
                    ? "#f0f8ff"
                    : "transparent",
                }}
                onClick={() => toggleTableSelection(node.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedTables.includes(node.id)}
                  onChange={() => toggleTableSelection(node.id)}
                  style={{ marginRight: "0.5rem" }}
                />
                <div>
                  <div style={{ fontWeight: "600" }}>{node.data.label}</div>
                  <div style={{ fontSize: "0.8rem", color: "#666" }}>
                    {node.data.attributes?.length || 0} columns
                  </div>
                </div>
              </div>
            ))}
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
            onClick={handleCreate}
            style={{
              background: "#7366ff",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            Create 360° View
          </button>
        </div>
      </div>
    </div>
  );
}

// Generic Relationship Controls Component
function RelationshipControls({
  onClearAll,
  onCleanDuplicates,
  onAddEntity,
  onAutoGenerateMappings,
  onAutoGenerateGoldToGoldMappings,
  onCreate360View,
  showNewEntity = true,
  showRemoveDuplicate = true,
}) {
  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      {showNewEntity && (
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
      )}
      <button
        onClick={onCreate360View}
        style={{
          background: "#28a745",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          padding: "0.5rem 1rem",
          fontSize: "0.8rem",
          cursor: "pointer",
        }}
        title="Create a 360° view from selected curated tables"
      >
        🔄 Create 360° View
      </button>
      <button
        onClick={onAutoGenerateMappings}
        style={{
          background: "#17a2b8",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          padding: "0.5rem 1rem",
          fontSize: "0.8rem",
          cursor: "pointer",
        }}
        title="Auto-generate field mappings between curated and consumption files"
      >
        🔗 Auto Map Fields
      </button>
      <button
        onClick={onAutoGenerateGoldToGoldMappings}
        style={{
          background: "#059669",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          padding: "0.5rem 1rem",
          fontSize: "0.8rem",
          cursor: "pointer",
        }}
        title="Auto-generate gold-to-gold entity relationships"
      >
        🏆 Gold-to-Gold Mappings
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
      {showRemoveDuplicate && (
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

// Modal for editing rules
function RuleModal({
  open,
  ruleType,
  fieldName,
  value,
  onChange,
  onClose,
  onSave,
}) {
  if (!open) return null;
  const label =
    ruleType === "nlp"
      ? "NLP Rule"
      : ruleType === "dq"
      ? "DQ Rule"
      : "Operator Rule";
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.3)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 32,
          minWidth: 340,
          boxShadow: "0 4px 32px #0003",
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 18 }}>
          {label} for field "{fieldName}"
        </h3>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          style={{
            width: "100%",
            fontSize: 15,
            borderRadius: 6,
            border: "1.5px solid #7366ff",
            padding: 8,
            marginBottom: 18,
          }}
        />
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "#eee",
              color: "#333",
              border: "none",
              borderRadius: 6,
              padding: "8px 18px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            style={{
              background: "#7366ff",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "8px 18px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function CanvasPageGold({
  uploadedFiles: propUploadedFiles,
  rawEntities: propRawEntities,
  curatedEntities: propCuratedEntities,
  fileData: propFileData,
  consumptionFiles: propConsumptionFiles,
}) {
  /**
   * CanvasPageGold Component
   * 
   * This component creates a visual canvas for mapping between curated and consumption data files.
   * It receives real file data from the parent component (GoldLandingPage.jsx) and creates:
   * 
   * 1. Curated Table Nodes (Left Side):
   *    - Created from actual uploaded files passed via location.state
   *    - Extracts column headers from CSV files via backend API calls
   *    - Falls back to realistic mock data if file access fails
   *    - Supports up to 8 curated tables
   * 
   * 2. Consumption Table Nodes (Right Side):
   *    - Created from actual consumption files from the landing zone
   *    - Uses outputColumns from consumption file definitions
   *    - Falls back to generated 360° views if no consumption files exist
   *    - Supports up to 6 consumption tables
   * 
   * 3. Automatic Field Mappings:
   *    - Smart mapping engine that matches columns by name similarity
   *    - Creates visual connections between curated and consumption tables
   *    - Supports manual mapping creation and editing
   * 
   * Expected Props from Parent (via location.state):
   * - uploadedFiles: Array of uploaded file names
   * - fileData: Array of file metadata objects with keys/locations
   * - rawEntities: Array of raw entity names
   * - curatedEntities: Array of curated entity names
   * - consumptionFiles: Array of consumption file objects
   * 
   * Features:
   * - Real-time file processing with loading indicators
   * - Robust error handling and fallback mechanisms
   * - Interactive node editing and relationship management
   * - Auto-generation of field mappings
   * - 360° view creation from selected curated tables
   */
  
  const location = useLocation();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // State for dynamic file loading - use props if provided, otherwise fall back to location state
  const [uploadedFiles, setUploadedFiles] = useState(propUploadedFiles || []);
  const [fileData, setFileData] = useState(propFileData || []);
  const [rawEntities, setRawEntities] = useState(propRawEntities || []);
  const [curatedEntities, setCuratedEntities] = useState(
    propCuratedEntities || []
  );
  const [consumptionFiles, setConsumptionFiles] = useState(
    propConsumptionFiles || []
  );
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [fileProcessingStatus, setFileProcessingStatus] = useState("");

  // Collaborative presence tracking
  const flowId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('flowId') || params.get('id') || 'gold-canvas';
  }, [location.search]);

  const { activeUsers, updateStatus } = usePresence('dataflow', flowId);
  const currentUserId = 'current-user-id'; // TODO: Get from auth context

  // State for hierarchical view
  const [expandedConsumptionEntities, setExpandedConsumptionEntities] =
    useState(new Set());
  const [expandedCuratedEntities, setExpandedCuratedEntities] = useState(
    new Set()
  );
  const [initialPositionsSet, setInitialPositionsSet] = useState(false);

  // Function to toggle consumption entity expansion (only one at a time)
  const toggleConsumptionEntity = useCallback(
    (entityId) => {
    setExpandedConsumptionEntities((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(entityId)) {
          // If already expanded, collapse it
        newSet.delete(entityId);

          // Also collapse any curated entities that are only visible because of this consumption entity
          setExpandedCuratedEntities((curatedPrev) => {
            const curatedSet = new Set(curatedPrev);

            // Find curated entities that are mapped to this consumption entity
            const relatedCuratedEntities = edges
              .filter(
                (e) =>
                  e.data?.relationshipType === "field_mapping" &&
                  e.target === entityId
              )
              .map((e) => e.source);

            // Remove curated entities that are only visible because of this consumption entity
            relatedCuratedEntities.forEach((curatedId) => {
              // Check if this curated entity has mappings to other expanded consumption entities
              const hasOtherMappings = edges.some(
                (e) =>
                  e.data?.relationshipType === "field_mapping" &&
                  e.source === curatedId &&
                  e.target !== entityId &&
                  newSet.has(e.target)
              );

              // If no other mappings to expanded consumption entities, collapse it
              if (!hasOtherMappings) {
                curatedSet.delete(curatedId);
              }
            });

            return curatedSet;
          });
        } else {
          // COMMENTED OUT: Collapse all others when expanding a new consumption entity
          // If not expanded, collapse all others and expand this one
          // newSet.clear();
          // newSet.add(entityId);

          // COMMENTED OUT: Hide curated entities not mapped to this consumption entity
          // Hide all curated entities that are not mapped to this consumption entity
          // setExpandedCuratedEntities((curatedPrev) => {
          //   const curatedSet = new Set();

          //   // Find curated entities that are mapped to this consumption entity
          //   const relatedCuratedEntities = edges
          //     .filter(
          //       (e) =>
          //         e.data?.relationshipType === "field_mapping" &&
          //         e.target === entityId
          //     )
          //     .map((e) => e.source);

          //   // Only keep curated entities that are mapped to this consumption entity
          //   // (they will be collapsed by default, but visible)
          //   relatedCuratedEntities.forEach((curatedId) => {
          //     if (curatedPrev.has(curatedId)) {
          //       curatedSet.add(curatedId);
          //     }
          //   });

          //   return curatedSet;
          // });

          // NEW BEHAVIOR: Allow multiple consumption entities to be expanded simultaneously
          newSet.add(entityId);
        }
        return newSet;
      });
    },
    [edges]
  );

  // Function to toggle curated entity expansion (multiple allowed)
  const toggleCuratedEntity = useCallback((entityId) => {
    setExpandedCuratedEntities((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(entityId)) {
        newSet.delete(entityId);
      } else {
        newSet.add(entityId);
      }
      return newSet;
    });
  }, []);

  // Nested canvas state with curated and consumption tables
  const [nestedNodes, setNestedNodes] = useNodesState([
    {
      id: "nested-curated-1",
      type: "entity",
      position: { x: 50, y: 100 },
      data: {
        label: "Curated Customer Data",
        attributes: [
          {
            name: "customer_id",
            type: "string",
            label: "customer_id",
            value: "customer_id",
          },
          {
            name: "first_name",
            type: "string",
            label: "first_name",
            value: "first_name",
          },
          {
            name: "last_name",
            type: "string",
            label: "last_name",
            value: "last_name",
          },
          { name: "email", type: "string", label: "email", value: "email" },
          { name: "phone", type: "string", label: "phone", value: "phone" },
        ],
        scdType2: false,
        isCuratedFile: true,
        onUpdate: () => {},
      },
    },
    {
      id: "nested-consumption-1",
      type: "entity",
      position: { x: 300, y: 100 },
      data: {
        label: "Consumption Customer",
        attributes: [
          {
            name: "customer_id",
            type: "string",
            label: "customer_id",
            value: "customer_id",
          },
          {
            name: "full_name",
            type: "string",
            label: "full_name",
            value: "full_name",
          },
          {
            name: "email_address",
            type: "string",
            label: "email_address",
            value: "email_address",
          },
          {
            name: "contact_number",
            type: "string",
            label: "contact_number",
            value: "contact_number",
          },
        ],
        scdType2: true,
        isConsumptionFile: true,
        onUpdate: () => {},
      },
    },
  ]);
  const [nestedEdges, setNestedEdges] = useEdgesState([]);

  const [relationshipModal, setRelationshipModal] = useState({
    open: false,
    mode: "add",
    relationship: null,
  });
  const [deleteEntityModal, setDeleteEntityModal] = useState({
    open: false,
    entity: null,
  });
  const [ruleModal, setRuleModal] = useState({
    open: false,
    edgeId: null,
    ruleType: null,
    value: "",
    isNested: false,
  });
  const [create360ViewModal, setCreate360ViewModal] = useState({
    open: false,
  });

  // Handler for rule button click (now for field-level rules)
  const handleRuleClick = useCallback(
    (nodeId, fieldName, ruleType) => {
      // Find the node and get existing rule value
      const node = nodes.find((n) => n.id === nodeId);
      const fieldRules = node?.data?.fieldRules || {};
      const value = fieldRules[fieldName]?.[ruleType] || "";
      setRuleModal({ open: true, nodeId, fieldName, ruleType, value });
    },
    [nodes]
  );

  // Process data from consumption landing page and create dynamic nodes
  useEffect(() => {
    // Use props if provided, otherwise fall back to location state
    const dataSource = propUploadedFiles
      ? {
          uploadedFiles: propUploadedFiles,
          fileData: propFileData,
          rawEntities: propRawEntities,
          curatedEntities: propCuratedEntities,
          consumptionFiles: propConsumptionFiles,
        }
      : location.state;

    if (dataSource) {
      if (dataSource.uploadedFiles && dataSource.uploadedFiles.length > 0) {
        setUploadedFiles(dataSource.uploadedFiles);
        setFileData(dataSource.fileData || []);
        setRawEntities(dataSource.rawEntities || []);
        setCuratedEntities(dataSource.curatedEntities || []);
        setConsumptionFiles(dataSource.consumptionFiles || []);

        // Function to create nodes from file URLs
        const createNodesFromFiles = async () => {
          setIsLoadingFiles(true);
          setFileProcessingStatus(
            "Processing files from silver_data and gold_data folders..."
          );

          const dynamicNodes = [];
          let nodeIdCounter = 1;

          // Function to read CSV file content
          const readCSVFile = async (filePath) => {
          try {
              const response = await fetch(filePath);
              if (!response.ok) {
                throw new Error(
                  `Failed to fetch ${filePath}: ${response.statusText}`
                );
              }
              return await response.text();
            } catch {
            return null;
          }
        };

        // Function to extract columns from CSV content
          const extractColumnsFromCSVContent = (csvContent) => {
            if (!csvContent) return [];

          try {
              // Handle BOM if present
              if (csvContent.charCodeAt(0) === 0xfeff) {
                csvContent = csvContent.slice(1);
              }
              
              const lines = csvContent
                .split(/\r?\n/)
                .filter((line) => line.trim());
              if (lines.length === 0) return [];

              const headerLine = lines[0].trim();
              // Handle quoted fields and different delimiters
              let columns = [];
              if (headerLine.includes('"')) {
                // Handle quoted CSV
                columns =
                  headerLine
                    .match(/(".*?"|[^,]+)/g)
                    ?.map((col) => col.trim().replace(/^"|"$/g, "")) || [];
              } else {
                columns = headerLine.split(",").map((col) => col.trim());
              }

              return columns
                .filter((col) => col.length > 0)
                .map((column) => ({
                  name: column,
                  type: "string", // Default type, could be enhanced with data type detection
                  label: column,
                  value: column,
                }));
            } catch {
              return [];
            }
          };

          // Function to read mapping file
          const readMappingFile = async () => {
            try {
              const mappingContent = await readCSVFile(
                "/mappings/Silver_to_Gold360_Mapping_WithEntities.csv"
              );
              if (!mappingContent) return [];

              const lines = mappingContent.split("\n");
              const mappings = [];

              // Skip header line
              for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line) {
                  const [
                    c360Entity,
                    c360Attribute,
                    silverEntity,
                    silverAttribute,
                  ] = line.split(",").map((col) => col.trim());
                  if (
                    c360Entity &&
                    c360Attribute &&
                    silverEntity &&
                    silverAttribute
                  ) {
                    mappings.push({
                      c360Entity,
                      c360Attribute,
                      silverEntity,
                      silverAttribute,
                    });
          }
                }
              }

              return mappings;
            } catch {
          return [];
            }
        };

          // Read mapping file
          const mappings = await readMappingFile();

          // Get unique silver entities from mappings
          const silverEntities = [
            ...new Set(mappings.map((m) => m.silverEntity)),
          ];

          // Create a mapping from C360 entity names to actual file names
          const entityNameToFileName = {
            DimOrder: "dimorder",
            DimOrderItem: "dimorderitem",
            account: "account",
            address: "address",
            contact_point: "contact_point",
            contract: "contract",
            customer_kpi: "customer_kpi",
            customer_party: "customer_party",
            device_resource: "device_resource",
            fact_invoice: "fact_invoice",
            fact_usage: "fact_usage",
            product: "product",
            service: "service",
            subscriber: "subscriber",
            subscriber_kpi: "subscriber_kpi",
            invoice: "invoice",
            payment_method: "payment_method",
            fact_customer_lifecycle: "fact_customer_lifecycle",
            fact_subscriber_lifecycle: "fact_subscriber_lifecycle",
          };

          // Get all gold entities from the gold_data folder
          const allGoldEntities = [
            "account",
            "address",
            "contact_point",
            "contract",
            "customer_kpi",
            "customer_party",
            "device_resource",
            "dimorder",
            "dimorderitem",
            "fact_customer_lifecycle",
            "fact_invoice",
            "fact_subscriber_lifecycle",
            "fact_usage",
            "invoice",
            "payment_method",
            "product",
            "service",
            "subscriber",
            "subscriber_kpi",
          ];

          // Use all gold entities, not just the mapped ones
          const goldEntities = allGoldEntities;

          // Create curated nodes from silver_data files
          setFileProcessingStatus(
            "Creating curated entities from silver_data..."
          );

          const createdSilverNodes = [];
          for (let i = 0; i < silverEntities.length; i++) {
            const silverEntity = silverEntities[i];
            const filename = `${silverEntity}.csv`;
            const filePath = `/silver_data/${filename}`;

            setFileProcessingStatus(
              `Processing curated file ${i + 1}/${
                silverEntities.length
              }: ${filename}`
            );

            // Read CSV file content
            const csvContent = await readCSVFile(filePath);
            let attributes = [];

            if (csvContent) {
              attributes = extractColumnsFromCSVContent(csvContent);
            } else {
              // File could not be read
            }

            // Fallback attributes if file couldn't be read
            if (attributes.length === 0) {
              // Get attributes from mappings for this entity
              const entityMappings = mappings.filter(
                (m) => m.silverEntity === silverEntity
              );
              attributes = entityMappings.map((m) => ({
                name: m.silverAttribute,
                      type: "string",
                label: m.silverAttribute,
                value: m.silverAttribute,
              }));

              // Add common silver data attributes
              attributes.push(
                    {
                      name: "effective_start_date",
                      type: "date",
                      label: "effective_start_date",
                      value: "effective_start_date",
                    },
                    {
                      name: "effective_end_date",
                      type: "date",
                      label: "effective_end_date",
                      value: "effective_end_date",
                    },
                    {
                      name: "is_current",
                      type: "boolean",
                      label: "is_current",
                      value: "is_current",
                    },
                    {
                      name: "source_system",
                      type: "string",
                      label: "source_system",
                      value: "source_system",
                    },
                    {
                      name: "ingestion_timestamp",
                      type: "timestamp",
                      label: "ingestion_timestamp",
                      value: "ingestion_timestamp",
                }
              );
            }

            // Calculate position for single column layout (stacked vertically)
            const verticalSpacing = 150;
            const startX = 50;

            const curatedNode = {
              id: `curated-${nodeIdCounter}`,
              type: "entity",
              position: {
                x: startX,
                y: 100 + i * verticalSpacing,
              },
              data: {
                label: silverEntity,
                attributes: attributes,
                scdType2: false,
                isCuratedFile: true,
                sourceFile: filename,
                onUpdate: () => {},
              },
            };

            dynamicNodes.push(curatedNode);
            createdSilverNodes.push(curatedNode);
            nodeIdCounter++;
          }

          // Create consumption nodes from gold_data files
          setFileProcessingStatus(
            "Creating consumption entities from gold_data..."
          );

          const createdGoldNodes = [];
          for (let i = 0; i < goldEntities.length; i++) {
            const goldEntity = goldEntities[i];
            const filename = `${goldEntity}.csv`;
            const filePath = `/gold_data/${filename}`;

              setFileProcessingStatus(
              `Processing consumption file ${i + 1}/${
                goldEntities.length
              }: ${filename}`
              );

            // Read CSV file content
            const csvContent = await readCSVFile(filePath);
            let attributes = [];

            if (csvContent) {
              attributes = extractColumnsFromCSVContent(csvContent);
            } else {
              // File could not be read
            }

            // Fallback attributes if file couldn't be read
            if (attributes.length === 0) {
              // Get attributes from mappings for this entity
              const entityMappings = mappings.filter(
                (m) => m.c360Entity === goldEntity
              );
              attributes = entityMappings.map((m) => ({
                name: m.c360Attribute,
                      type: "string",
                label: m.c360Attribute,
                value: m.c360Attribute,
              }));
              }

            // Calculate position for consumption nodes - single column layout (stacked vertically)
            const consumptionVerticalSpacing = 150;
            const consumptionStartX = 1000; // Positioned further to the right of curated nodes

            const consumptionNode = {
                id: `360-consumption-${nodeIdCounter}`,
                type: "entity",
                position: {
                x: consumptionStartX,
                y: 100 + i * consumptionVerticalSpacing,
                },
                data: {
                label: goldEntity,
                attributes: attributes,
                  scdType2: true,
                  isConsumptionFile: true,
                sourceFile: filename,
                  onUpdate: () => {},
                },
            };
            dynamicNodes.push(consumptionNode);
            createdGoldNodes.push(consumptionNode);
              nodeIdCounter++;
            }

          // Create edges based on mappings
          setFileProcessingStatus(
            "Creating relationships based on mappings..."
          );
          const mappingEdges = [];

          for (const mapping of mappings) {
            const curatedNode = dynamicNodes.find(
              (n) => n.data.label === mapping.silverEntity
            );
            const mappedGoldEntity = entityNameToFileName[mapping.c360Entity];
            const consumptionNode = dynamicNodes.find(
              (n) => n.data.label === mappedGoldEntity
            );

            if (curatedNode && consumptionNode && mappedGoldEntity) {
              const edgeId = `mapping-${curatedNode.id}-${consumptionNode.id}-${mapping.silverAttribute}-${mapping.c360Attribute}`;

              mappingEdges.push({
                id: edgeId,
                source: curatedNode.id,
                target: consumptionNode.id,
                type: "custom",
                data: {
                  relationshipType: "field_mapping",
                  sourceColumn: mapping.silverAttribute,
                  targetColumn: mapping.c360Attribute,
                  mappingRule: "direct",
                  confidence: 1.0,
                  reason:
                    "Mapped from Silver_to_Gold360_Mapping_WithEntities.csv",
                },
                style: {
                  stroke: "#2563eb",
                  strokeWidth: 2,
                  strokeDasharray: "5,5",
                  },
              });
            }
          }

          // Generate gold-to-gold entity relationships
          setFileProcessingStatus(
            "Creating gold-to-gold entity relationships..."
          );

          // Read gold-to-gold mappings
          const goldToGoldMappings = await readGoldToGoldMappingFile();

          for (const goldMapping of goldToGoldMappings) {
            const sourceNode = dynamicNodes.find(
              (n) => n.data.label === goldMapping.sourceEntity
            );
            const targetNode = dynamicNodes.find(
              (n) => n.data.label === goldMapping.targetEntity
            );

            // Only create edges from right to right (consumption to consumption entities)
            if (
              sourceNode &&
              targetNode &&
              sourceNode.data.isConsumptionFile &&
              targetNode.data.isConsumptionFile
            ) {
              const edgeId = `gold-mapping-${sourceNode.id}-${targetNode.id}-${goldMapping.sourceAttribute}-${goldMapping.targetAttribute}`;

              const sourceHandleId = findHandleId(
                sourceNode,
                goldMapping.sourceAttribute
              );
              const targetHandleId = findHandleId(
                targetNode,
                goldMapping.targetAttribute
              );

              mappingEdges.push({
                id: edgeId,
                source: sourceNode.id,
                sourceHandle: sourceHandleId,
                target: targetNode.id,
                targetHandle: targetHandleId,
                type: "goldToGold", // Use custom gold-to-gold edge type
                data: {
                  relationshipType: "gold_to_gold_mapping",
                  sourceColumn: goldMapping.sourceAttribute,
                  targetColumn: goldMapping.targetAttribute,
                  mappingRule: "gold_entity_relationship",
                  confidence: 1.0,
                  reason: `Gold entity relationship: ${goldMapping.relationshipType} (from gold_data_mappings.csv)`,
                },
                style: {
                  stroke: "#ff0000", // Red color for gold-to-gold relationships to make them more visible
                  strokeWidth: 4,
                  strokeDasharray: "5,5", // Different dash pattern
                },
              });
            }
          }

          // Replace initial nodes with dynamic nodes
          setNodes(dynamicNodes);
          setEdges(mappingEdges);

          const silverToGoldEdges = mappingEdges.filter(
            (e) => e.data?.relationshipType === "field_mapping"
          );
          const goldToGoldEdges = mappingEdges.filter(
            (e) => e.data?.relationshipType === "gold_to_gold_mapping"
          );
          
          setIsLoadingFiles(false);
          setFileProcessingStatus(
            `Canvas loaded with ${createdSilverNodes.length} curated entities and ${createdGoldNodes.length} consumption entities with ${silverToGoldEdges.length} silver-to-gold mappings and ${goldToGoldEdges.length} gold-to-gold mappings`
          );
        };

        // Execute the async function
        createNodesFromFiles();
      }
    } else {
      // If no state data at all, use the default nodes
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [location.state, setNodes, setEdges]);

  // Auto-generate initial field mappings when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      const curatedNodes = nodes.filter((n) => n.data.isCuratedFile);
      const consumptionNodes = nodes.filter((n) => n.data.isConsumptionFile);

      if (curatedNodes.length > 0 && consumptionNodes.length > 0) {
        const existingFieldMappings = edges.filter(
          (e) => e.data?.relationshipType === "field_mapping"
        );

        if (existingFieldMappings.length === 0) {
          const newMappings = [];
          curatedNodes.forEach((curatedNode) => {
            consumptionNodes.forEach((consumptionNode) => {
              // Ensure both nodes have attributes before generating mappings
              if (
                curatedNode.data.attributes?.length > 0 &&
                consumptionNode.data.attributes?.length > 0
              ) {
              const mappings = generateFieldMappings(
                curatedNode,
                consumptionNode
              );
              newMappings.push(...mappings);
              }
            });
          });

          if (newMappings.length > 0) {
            try {
            setEdges((eds) => [...eds, ...newMappings]);
            } catch {
              // Fallback: try to add edges one by one
              newMappings.forEach((mapping) => {
                try {
                  setEdges((eds) => [...eds, mapping]);
                } catch {
                  // Edge could not be added
                }
              });
            }
          }
        }
      }
    }, 1000); // Increased delay to ensure nodes are fully rendered

    return () => clearTimeout(timer);
  }, [nodes, edges, setEdges]);

  // Auto-generate initial field mappings for nested canvas
  useEffect(() => {
    const timer = setTimeout(() => {
      const nestedCuratedNodes = nestedNodes.filter(
        (n) => n.data.isCuratedFile
      );
      const nestedConsumptionNodes = nestedNodes.filter(
        (n) => n.data.isConsumptionFile
      );

      if (nestedCuratedNodes.length > 0 && nestedConsumptionNodes.length > 0) {
        const existingNestedFieldMappings = nestedEdges.filter(
          (e) => e.data?.relationshipType === "field_mapping"
        );

        if (existingNestedFieldMappings.length === 0) {
          const newNestedMappings = [];
          nestedCuratedNodes.forEach((curatedNode) => {
            nestedConsumptionNodes.forEach((consumptionNode) => {
              // Ensure both nodes have attributes before generating mappings
              if (
                curatedNode.data.attributes?.length > 0 &&
                consumptionNode.data.attributes?.length > 0
              ) {
              const mappings = generateFieldMappings(
                curatedNode,
                consumptionNode
              );
              // Update the mappings to have nested-specific IDs
              const nestedMappings = mappings.map((mapping) => ({
                ...mapping,
                id: `nested-${mapping.id}`,
                style: { ...mapping.style, strokeWidth: 1.5 },
              }));
              newNestedMappings.push(...nestedMappings);
              }
            });
          });

          if (newNestedMappings.length > 0) {
            try {
            setNestedEdges((eds) => [...eds, ...newNestedMappings]);
            } catch {
              // Fallback: try to add edges one by one
              newNestedMappings.forEach((mapping) => {
                try {
                  setNestedEdges((eds) => [...eds, mapping]);
                } catch {
                  // Nested edge could not be added
                }
              });
            }
          }
        }
      }
    }, 1200); // Increased delay for nested canvas

    return () => clearTimeout(timer);
  }, [nestedNodes, nestedEdges, setNestedEdges]);

  // Auto-map new columns when they are added to consumption tables
  const handleColumnAdded = useCallback(
    (nodeId, newColumnValue) => {
      const consumptionNode = nodes.find((n) => n.id === nodeId);
      if (!consumptionNode || !consumptionNode.data.isConsumptionFile) return;

      const curatedNodes = nodes.filter((n) => n.data.isCuratedFile);

      curatedNodes.forEach((curatedNode) => {
        const curatedAttrs = curatedNode.data.attributes || [];
        curatedAttrs.forEach((curatedAttr) => {
          // Check if this curated field is already mapped to any consumption field
          const isCuratedMapped = edges.some(
            (e) =>
              e.data?.relationshipType === "field_mapping" &&
              e.source === curatedNode.id &&
              e.sourceHandle === `${curatedNode.id}-${curatedAttr.name}`
          );

          // Check if this consumption column already has a relationship from any curated table
          const isConsumptionMapped = edges.some(
            (e) =>
              e.data?.relationshipType === "field_mapping" &&
              e.target === nodeId &&
              e.targetHandle === `${nodeId}-${newColumnValue}`
          );

          // Check for exact match or partial match
          const exactMatch =
            curatedAttr.name.toLowerCase() === newColumnValue.toLowerCase();
          const partialMatch =
            newColumnValue
              .toLowerCase()
              .includes(curatedAttr.name.toLowerCase()) ||
            curatedAttr.name
              .toLowerCase()
              .includes(newColumnValue.toLowerCase());

          // If not mapped and names match (exact or partial), create a mapping
          if (
            !isCuratedMapped &&
            !isConsumptionMapped &&
            (exactMatch || partialMatch)
          ) {
            const newEdge = {
              id: `auto-${curatedNode.id}-${
                curatedAttr.name
              }-${nodeId}-${newColumnValue}-${Date.now()}`,
              source: curatedNode.id,
              sourceHandle: `${curatedNode.id}-${curatedAttr.name}`,
              target: nodeId,
              targetHandle: `${nodeId}-${newColumnValue}`,
              animated: false,
              style: {
                stroke: exactMatch ? "#28a745" : "#ffc107",
                strokeWidth: exactMatch ? 3 : 2,
                strokeDasharray: "5,5", // Creates dashed lines
              },
              data: {
                relationshipType: "field_mapping",
                sourceColumn: curatedAttr.name,
                targetColumn: newColumnValue,
                transformation: exactMatch ? "direct" : "rename",
                autoGenerated: true,
              },
            };
            setEdges((eds) => [...eds, newEdge]);
          }
        });
      });
    },
    [nodes, edges, setEdges]
  );

  // Example: Add a custom entity
  const addCustomEntity = useCallback(() => {
    const newId = `entity-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        id: newId,
        type: "entity",
        position: {
          x: 100 + Math.random() * 400,
          y: 100 + Math.random() * 300,
        },
        data: {
          label: `Entity ${newId}`,
          attributes: [],
          isNewOrUpdated: true,
          scdType2: false,
          onUpdate,
        },
      },
    ]);
  }, [setNodes]);

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

  // Function to filter nodes for hierarchical view
  const getFilteredNodes = useCallback(() => {
    const consumptionNodes = nodes.filter((n) => n.data.isConsumptionFile);
    const curatedNodes = nodes.filter((n) => n.data.isCuratedFile);
    const expandedConsumptionIds = Array.from(expandedConsumptionEntities);

    // Get curated nodes that are mapped to expanded consumption entities
    const mappedCuratedNodes = curatedNodes.filter((curatedNode) => {
      // Check both directions - curated as source or target
      const hasMappingAsSource = edges.some(
        (edge) =>
          edge.data?.relationshipType === "field_mapping" &&
          edge.source === curatedNode.id &&
          expandedConsumptionEntities.has(edge.target)
      );

      const hasMappingAsTarget = edges.some(
        (edge) =>
          edge.data?.relationshipType === "field_mapping" &&
          edge.target === curatedNode.id &&
          expandedConsumptionEntities.has(edge.source)
      );

      return hasMappingAsSource || hasMappingAsTarget;
    });

    // Get manually expanded curated nodes (independent of consumption entities)
    const manuallyExpandedCuratedNodes = curatedNodes.filter((curatedNode) =>
      expandedCuratedEntities.has(curatedNode.id)
    );

    // Get curated nodes that are mapped to expanded consumption entities
    const mappedCuratedNodesForExpanded =
      expandedConsumptionIds.length > 0 ? mappedCuratedNodes : [];

    // Combine mapped and manually expanded curated nodes
    const visibleCuratedNodes = [
      ...mappedCuratedNodesForExpanded,
      ...manuallyExpandedCuratedNodes.filter(
        (node) =>
          !mappedCuratedNodesForExpanded.some((mapped) => mapped.id === node.id)
      ),
    ];

    // Set initial positions only once when nodes are first created
    if (!initialPositionsSet && nodes.length > 0) {
      const updatedNodes = [...nodes];

      // Create a map to group curated nodes by their mapped consumption entities
      const curatedNodesByConsumption = new Map();
      mappedCuratedNodes.forEach((curatedNode) => {
        const mappedConsumptionEntities = edges
          .filter(
            (edge) =>
              edge.data?.relationshipType === "field_mapping" &&
              edge.source === curatedNode.id &&
              expandedConsumptionEntities.has(edge.target)
          )
          .map((edge) => edge.target);

        mappedConsumptionEntities.forEach((consumptionId) => {
          if (!curatedNodesByConsumption.has(consumptionId)) {
            curatedNodesByConsumption.set(consumptionId, []);
          }
          curatedNodesByConsumption.get(consumptionId).push(curatedNode);
        });
      });

      // Position consumption nodes in a vertical stack (right side)
      const consumptionVerticalSpacing = 50; // Same spacing as curated entities
      const consumptionStartX = 1000; // Right side - increased gap from curated entities
      const consumptionStartY = 100;

      // Calculate dynamic heights for consumption entities
      const calculateConsumptionEntityHeight = (node) => {
        const isExpanded = expandedConsumptionEntities.has(node.id);
        if (!isExpanded) {
          return 70; // Collapsed height (matches new design)
        }

        // Calculate expanded height based on content
        const attributes = node.data.attributes || [];
        const baseHeight = 60; // Header height (matches new design)
        const fieldHeight = 28; // Height per field (matches new UI)
        const padding = 12; // Bottom padding (matches new design)
        const totalFieldsHeight = attributes.length * fieldHeight;

        return baseHeight + totalFieldsHeight + padding;
      };

      // Position consumption nodes with dynamic spacing
      let currentY = consumptionStartY;
      consumptionNodes.forEach((consumptionNode) => {
        const nodeIndex = updatedNodes.findIndex(
          (n) => n.id === consumptionNode.id
        );
        if (nodeIndex !== -1) {
          updatedNodes[nodeIndex] = {
            ...updatedNodes[nodeIndex],
            position: {
              x: consumptionStartX,
              y: currentY,
            },
          };

          // Calculate height for next node positioning
          const nodeHeight = calculateConsumptionEntityHeight(consumptionNode);
          currentY += nodeHeight + consumptionVerticalSpacing;
        }
      });

      // Position curated nodes close to their mapped consumption entities
      curatedNodesByConsumption.forEach((curatedNodesList, consumptionId) => {
        const consumptionNode = consumptionNodes.find(
          (n) => n.id === consumptionId
        );
        if (!consumptionNode) return;

        const consumptionPosition = consumptionNode.position || {
          x: 600,
          y: 100,
        };
        const nodeWidth = 320;
        const nodeHeight = 200;
        const padding = 40;
        const startX = consumptionPosition.x - nodeWidth - padding; // Left of consumption node
        const startY = consumptionPosition.y;

        curatedNodesList.forEach((curatedNode, index) => {
          const nodeIndex = updatedNodes.findIndex(
            (n) => n.id === curatedNode.id
          );
          if (nodeIndex !== -1) {
            updatedNodes[nodeIndex] = {
              ...updatedNodes[nodeIndex],
              position: {
                x: startX,
                y: startY + index * (nodeHeight + padding),
              },
            };
          }
        });
      });

      setNodes(updatedNodes);
      setInitialPositionsSet(true);
    }

    // Filter nodes for display
    // COMMENTED OUT: Hide functionality for consumption entities
    // const visibleConsumptionNodes =
    //   expandedConsumptionIds.length > 0
    //     ? consumptionNodes.filter((n) => expandedConsumptionIds.includes(n.id)) // Only show expanded consumption entity
    //     : consumptionNodes; // Show all consumption nodes when none are expanded

    // Show all consumption nodes (hiding functionality disabled)
    const visibleConsumptionNodes = consumptionNodes;

    const visibleNodes = [
      ...visibleCuratedNodes, // Curated nodes mapped to expanded consumption entities + manually expanded
      ...visibleConsumptionNodes, // Only expanded consumption entity or all if none expanded
    ];

    // Position nodes with dynamic spacing for both curated and consumption entities
    const positionedNodes = visibleNodes.map((n) => {
      let updatedNode = { ...n };

      // If this is a consumption node, position it with dynamic spacing
      if (n.data.isConsumptionFile) {
        // Find the index of this consumption node
        const consumptionNodeIndex = consumptionNodes.findIndex(
          (node) => node.id === n.id
        );

        if (consumptionNodeIndex !== -1) {
          // Calculate dynamic height for consumption entities
          const calculateConsumptionEntityHeight = (node) => {
            const isExpanded = expandedConsumptionEntities.has(node.id);
            if (!isExpanded) {
              return 70; // Collapsed height (matches new design)
            }

            // Calculate expanded height based on content
            const attributes = node.data.attributes || [];
            const baseHeight = 60; // Header height (matches new design)
            const fieldHeight = 28; // Height per field (matches new UI)
            const padding = 12; // Bottom padding (matches new design)
            const totalFieldsHeight = attributes.length * fieldHeight;

            return baseHeight + totalFieldsHeight + padding;
          };

          // Position consumption nodes in a vertical stack
          const consumptionVerticalSpacing = 50;
          const consumptionStartX = 1000; // Increased gap from curated entities
          const consumptionStartY = 100;

          // Calculate position considering actual expanded heights of previous nodes
          let calculatedY = consumptionStartY;
          for (let i = 0; i < consumptionNodeIndex; i++) {
            const previousNode = consumptionNodes[i];
            const previousNodeHeight =
              calculateConsumptionEntityHeight(previousNode);
            calculatedY += previousNodeHeight + consumptionVerticalSpacing;
          }

          updatedNode = {
            ...updatedNode,
            position: {
              x: consumptionStartX,
              y: calculatedY,
            },
          };
        }
      }

      // If this is a curated node, position it in a vertical stack
      if (n.data.isCuratedFile) {
        // Find the index of this curated node among all visible curated nodes
        const visibleCuratedNodes = visibleNodes.filter(
          (node) => node.data.isCuratedFile
        );
        const nodeIndex = visibleCuratedNodes.findIndex(
          (node) => node.id === n.id
        );

        // Calculate actual height of expanded curated entities
        const calculateEntityHeight = (node) => {
          const isExpanded = expandedCuratedEntities.has(node.id);
          if (!isExpanded) {
            return 70; // Collapsed height (matches new design)
          }

          // Calculate expanded height based on content
          const attributes = node.data.attributes || [];
          const baseHeight = 60; // Header height (matches new design)
          const fieldHeight = 28; // Height per field (matches new UI)
          const padding = 12; // Bottom padding (matches new design)
          const totalFieldsHeight = attributes.length * fieldHeight;

          return baseHeight + totalFieldsHeight + padding;
        };

        // Position curated nodes in a vertical stack on the left side
        const curatedVerticalSpacing = 50; // Spacing between entities
        const curatedStartX = 50; // Left side
        const curatedStartY = 100; // Top starting position

        // Calculate position considering actual expanded heights of previous nodes
        let calculatedY = curatedStartY;
        for (let i = 0; i < nodeIndex; i++) {
          const previousNode = visibleCuratedNodes[i];
          const previousNodeHeight = calculateEntityHeight(previousNode);
          calculatedY += previousNodeHeight + curatedVerticalSpacing;
        }

        updatedNode = {
          ...updatedNode,
          position: {
            x: curatedStartX,
            y: calculatedY,
          },
        };
      }

      return {
        ...updatedNode,
      data: {
          ...updatedNode.data,
        onUpdate,
        onDelete: (entity) => setDeleteEntityModal({ open: true, entity }),
        onRuleClick: handleRuleClick,
        onColumnAdded: handleColumnAdded,
        allNodes: nodes,
        uploadedFiles,
        consumptionFiles,
        fileData,
        rawEntities,
        curatedEntities,
          onToggleExpansion: updatedNode.data.isConsumptionFile
            ? toggleConsumptionEntity
            : toggleCuratedEntity,
          isExpanded: updatedNode.data.isConsumptionFile
            ? expandedConsumptionEntities.has(updatedNode.id)
            : expandedCuratedEntities.has(updatedNode.id),
      },
      };
    });

    return positionedNodes;
  }, [
    nodes,
    edges,
    expandedConsumptionEntities,
    expandedCuratedEntities,
    initialPositionsSet,
    setNodes,
    onUpdate,
    handleRuleClick,
    handleColumnAdded,
    uploadedFiles,
    consumptionFiles,
    fileData,
    rawEntities,
    curatedEntities,
    toggleConsumptionEntity,
    toggleCuratedEntity,
  ]);

  // Delete entity
  const deleteEntity = useCallback(
    (entityId) => {
      setNodes((nds) => nds.filter((n) => n.id !== entityId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== entityId && e.target !== entityId)
      );
      setDeleteEntityModal({ open: false, entity: null });
    },
    [setNodes, setEdges]
  );

  // Create 360-degree view from selected curated tables
  const create360View = useCallback(
    (viewName, selectedTableIds) => {
      const selectedTables = nodes.filter((n) =>
        selectedTableIds.includes(n.id)
      );

      if (selectedTables.length === 0) {
        alert("No tables selected for 360° view");
        return;
      }

      // Generate a unique ID for the new 360° view
      const viewId = `360-${Date.now()}`;

      // Collect all unique columns from selected tables
      const allColumns = new Map();
      selectedTables.forEach((table) => {
        const tableColumns = table.data.attributes || [];
        tableColumns.forEach((col) => {
          const key = col.name.toLowerCase();
          if (!allColumns.has(key)) {
            allColumns.set(key, {
              name: col.name,
              type: col.type,
              label: col.label || col.name,
              value: col.value || col.name,
              sourceTable: table.data.label,
            });
          }
        });
      });

      // Create the 360° view node
      const new360View = {
        id: viewId,
        type: "entity",
        position: { x: 500, y: 250 },
        data: {
          label: viewName,
          attributes: Array.from(allColumns.values()),
          scdType2: true,
          isConsumptionFile: true,
          onUpdate: () => {},
        },
      };

      // Add the new 360° view to the canvas
      setNodes((nds) => [...nds, new360View]);

      // Auto-generate mappings from selected curated tables to the new 360° view
      const newMappings = [];
      selectedTables.forEach((curatedTable) => {
        const curatedColumns = curatedTable.data.attributes || [];
        curatedColumns.forEach((curatedCol) => {
          // Find matching column in 360° view
          const matchingCol = allColumns.get(curatedCol.name.toLowerCase());
          if (matchingCol) {
            const newEdge = {
              id: `360-${curatedTable.id}-${curatedCol.name}-${viewId}-${
                matchingCol.name
              }-${Date.now()}`,
              source: curatedTable.id,
              sourceHandle: `${curatedTable.id}-${curatedCol.name}`,
              target: viewId,
              targetHandle: `${viewId}-${matchingCol.name}`,
              animated: false,
              style: { 
                stroke: "#28a745", 
                strokeWidth: 2,
                strokeDasharray: "5,5", // Creates dashed lines
              },
              data: {
                relationshipType: "field_mapping",
                sourceColumn: curatedCol.name,
                targetColumn: matchingCol.name,
                transformation: "direct",
                autoGenerated: true,
                is360View: true,
              },
            };
            newMappings.push(newEdge);
          }
        });
      });

      if (newMappings.length > 0) {
        setEdges((eds) => [...eds, ...newMappings]);
      }

      // Update consumption files state
      setConsumptionFiles((prev) => [
        ...prev,
        {
          id: Date.now(),
          name: viewName,
          description: `360° view created from ${selectedTables.length} curated tables`,
          entities: selectedTables.map((t) => t.data.label),
          outputColumns: Array.from(allColumns.values()).map((col) => col.name),
          createdAt: new Date().toISOString(),
          status: "draft",
        },
      ]);

      alert(
        `Created 360° view "${viewName}" with ${allColumns.size} columns and ${newMappings.length} mappings`
      );
    },
    [nodes, setNodes, setEdges, setConsumptionFiles]
  );

  // Auto-generate field mappings between curated and consumption files
  const autoGenerateFieldMappings = useCallback(() => {
    const curatedNodes = nodes.filter((n) => n.data.isCuratedFile);
    const consumptionNodes = nodes.filter((n) => n.data.isConsumptionFile);

    if (curatedNodes.length === 0 || consumptionNodes.length === 0) {
      alert(
        "Need at least one curated file and one consumption file to generate mappings"
      );
      return;
    }

    // Clear existing field mappings
    setEdges((eds) =>
      eds.filter((e) => e.data?.relationshipType !== "field_mapping")
    );

    // Generate mappings for each curated-consumption pair
    const newMappings = [];
    curatedNodes.forEach((curatedNode) => {
      consumptionNodes.forEach((consumptionNode) => {
        // Ensure both nodes have attributes before generating mappings
        if (
          curatedNode.data.attributes?.length > 0 &&
          consumptionNode.data.attributes?.length > 0
        ) {
        const mappings = generateFieldMappings(curatedNode, consumptionNode);
        newMappings.push(...mappings);
        }
      });
    });

    if (newMappings.length === 0) {
      alert("No field mappings could be automatically generated");
      return;
    }

    // Add unique IDs to prevent duplicates
    const uniqueMappings = newMappings.map((mapping, index) => ({
      ...mapping,
      id: `auto-${Date.now()}-${index}`,
    }));

    setEdges((eds) => [...eds, ...uniqueMappings]);
    alert(`Generated ${uniqueMappings.length} field mappings`);
  }, [nodes, setEdges]);

  // Auto-generate gold-to-gold entity relationships
  const autoGenerateGoldToGoldMappings = useCallback(async () => {
    const consumptionNodes = nodes.filter((n) => n.data.isConsumptionFile);

    if (consumptionNodes.length < 2) {
      alert(
        "Need at least two consumption entities to generate gold-to-gold mappings"
      );
      return;
    }

    // Clear existing gold-to-gold mappings
    setEdges((eds) =>
      eds.filter((e) => e.data?.relationshipType !== "gold_to_gold_mapping")
    );

    // Read gold-to-gold mappings
    const goldToGoldMappings = await readGoldToGoldMappingFile();

    const newGoldMappings = [];
    for (const goldMapping of goldToGoldMappings) {
      const sourceNode = consumptionNodes.find(
        (n) => n.data.label === goldMapping.sourceEntity
      );
      const targetNode = consumptionNodes.find(
        (n) => n.data.label === goldMapping.targetEntity
      );

      // Only create edges from right to right (consumption to consumption entities)
      if (sourceNode && targetNode) {
        const edgeId = `gold-auto-${sourceNode.id}-${targetNode.id}-${goldMapping.sourceAttribute}-${goldMapping.targetAttribute}`;

        const sourceHandleId = findHandleId(
          sourceNode,
          goldMapping.sourceAttribute
        );
        const targetHandleId = findHandleId(
          targetNode,
          goldMapping.targetAttribute
        );

        newGoldMappings.push({
          id: edgeId,
          source: sourceNode.id,
          sourceHandle: sourceHandleId,
          target: targetNode.id,
          targetHandle: targetHandleId,
          type: "goldToGold", // Use custom gold-to-gold edge type
          data: {
            relationshipType: "gold_to_gold_mapping",
            sourceColumn: goldMapping.sourceAttribute,
            targetColumn: goldMapping.targetAttribute,
            mappingRule: "gold_entity_relationship",
            confidence: 1.0,
            reason: `Gold entity relationship: ${goldMapping.relationshipType} (from gold_data_mappings.csv)`,
          },
          style: {
            stroke: "#ff0000", // Red color for gold-to-gold relationships to make them more visible
            strokeWidth: 4,
            strokeDasharray: "5,5", // Different dash pattern
          },
        });
      }
    }

    if (newGoldMappings.length === 0) {
      alert("No gold-to-gold mappings could be automatically generated");
      return;
    }

    setEdges((eds) => [...eds, ...newGoldMappings]);
    alert(
      `Generated ${newGoldMappings.length} gold-to-gold entity relationships`
    );
  }, [nodes, setEdges]);

  // Relationship handlers
  const addRelationship = useCallback(
    (
      sourceNodeId,
      targetNodeId,
      sourceColumn,
      targetColumn,
      relationshipType = "field_mapping"
    ) => {
      const newEdge = {
        id: `rel-${Date.now()}-${Math.random()}`,
        source: sourceNodeId,
        sourceHandle: `${sourceNodeId}-${sourceColumn}`,
        target: targetNodeId,
        targetHandle: `${targetNodeId}-${targetColumn}`,
        animated: false,
        style: {
          stroke: "#28a745",
          strokeWidth: 2,
          strokeDasharray: "5,5", // Creates dashed lines
        },
        data: {
          relationshipType,
          sourceColumn,
          targetColumn,
          transformation: "direct",
        },
      };
      setEdges((eds) => [...eds, newEdge]);
    },
    [setEdges]
  );

  const editRelationship = useCallback(
    (edgeId, updates) => {
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === edgeId
            ? {
                ...edge,
                ...updates,
                style: {
                  stroke: "#28a745",
                  strokeWidth: 2,
                },
                data: {
                  ...edge.data,
                  ...updates.data,
                },
              }
            : edge
        )
      );
    },
    [setEdges]
  );

  const deleteRelationship = useCallback(
    (edgeId) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    },
    [setEdges]
  );

  const deleteAllRelationships = useCallback(() => {
    setEdges([]);
  }, [setEdges]);

  const cleanupDuplicateEdges = useCallback(() => {
    setEdges((eds) => {
      const uniqueEdges = eds.filter(
        (edge, index, self) =>
          index ===
          self.findIndex(
            (e) =>
              e.source === edge.source &&
              e.target === edge.target &&
              e.sourceHandle === edge.sourceHandle &&
              e.targetHandle === edge.targetHandle &&
              e.data?.sourceColumn === edge.data?.sourceColumn
          )
      );
      return uniqueEdges;
    });
  }, [setEdges]);

  // Handle edge connections
  const onConnect = useCallback(
    (params) => {
      // Extract field names from handle IDs
      const sourceField = params.sourceHandle?.split("-").slice(1).join("-");
      const targetField = params.targetHandle?.split("-").slice(1).join("-");
      
      // Find the source and target nodes
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);
      
      if (!sourceField || !targetField || !sourceNode || !targetNode) {
        return;
      }
      
      // Create a proper edge with mapping data
      const newEdge = {
        id: `manual-${params.source}-${sourceField}-${
          params.target
        }-${targetField}-${Date.now()}`,
        source: params.source,
        sourceHandle: params.sourceHandle,
        target: params.target,
        targetHandle: params.targetHandle,
        animated: false,
        style: { 
          stroke: "#000000", 
          strokeWidth: 2,
          strokeDasharray: "5,5", // Creates dashed lines
        },
        data: {
          relationshipType: "field_mapping",
          sourceColumn: sourceField,
          targetColumn: targetField,
          transformation: "manual",
          autoGenerated: false,
        },
      };
      
      // Validate the edge before adding it
      if (validateEdge(newEdge, [sourceNode, targetNode])) {
        setEdges((eds) => [...eds, newEdge]);
      } else {
        // Edge validation failed
      }
    },
    [nodes, setEdges]
  );

  // Save rule
  const handleSaveRule = useCallback(() => {
    if (ruleModal.isNested) {
      // Save rule for nested canvas
      setNestedNodes((nds) =>
        nds.map((n) =>
          n.id === ruleModal.nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  fieldRules: {
                    ...n.data.fieldRules,
                    [ruleModal.fieldName]: {
                      ...n.data.fieldRules?.[ruleModal.fieldName],
                      [ruleModal.ruleType]: ruleModal.value,
                    },
                  },
                },
              }
            : n
        )
      );
    } else {
      // Save rule for main canvas
      setNodes((nds) =>
        nds.map((n) =>
          n.id === ruleModal.nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  fieldRules: {
                    ...n.data.fieldRules,
                    [ruleModal.fieldName]: {
                      ...n.data.fieldRules?.[ruleModal.fieldName],
                      [ruleModal.ruleType]: ruleModal.value,
                    },
                  },
                },
              }
            : n
        )
      );
    }
    setRuleModal({
      open: false,
      nodeId: null,
      fieldName: null,
      ruleType: null,
      value: "",
      isNested: false,
    });
  }, [
    ruleModal.nodeId,
    ruleModal.fieldName,
    ruleModal.ruleType,
    ruleModal.value,
    ruleModal.isNested,
    setNodes,
    setNestedNodes,
  ]);

  // Edge types with custom edge for remove functionality
  const edgeTypes = useMemo(() => createEdgeTypes(setEdges), [setEdges]);

  // Node types
  const nodeTypes = useMemo(
    () => createNodeTypes(setNodes, setEdges, edges),
    [setNodes, setEdges, edges]
  );

  return (
    <div 
      className="canvas-page"
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        margin: "0",
        padding: "0",
        minHeight: "100%",
        borderRadius: "0",
        boxShadow: "none"
      }}
    >
      {/* Back Button */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          zIndex: 1001,
        }}
      >
        <Link
          to="/consumption_landing_page"
          style={{
            background: "#000000",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "12px 20px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            transition: "all 0.2s ease",
            textDecoration: "none",
          }}
          onMouseEnter={(e) => {
            e.target.style.background = "#333333";
            e.target.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.target.style.background = "#000000";
            e.target.style.transform = "translateY(0)";
          }}
        >
          ← Back to Consumption Zone
        </Link>
      </div>

      {/* Canvas Title and Info */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1001,
          textAlign: "center",
        }}
      >
        <h1
          style={{
            margin: "0",
            color: "#000000",
            fontSize: "20px",
            fontWeight: "700",
            textShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}
        >
          Data Canvas - Gold Zone
        </h1>
        {!isLoadingFiles && nodes.length > 0 && (
          <p
            style={{
              margin: "8px 0 0 0",
              color: "#666666",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            {nodes.filter((n) => n.data.isConsumptionFile).length} Consumption
            Entities • {expandedConsumptionEntities.size} Expanded •{" "}
            {nodes.filter((n) => n.data.isCuratedFile).length} Total Curated
          </p>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 1001,
          display: "flex",
          gap: "12px",
          alignItems: "center",
        }}
      >
      <PresenceIndicator
        activeUsers={activeUsers}
        currentUserId={currentUserId}
        maxVisible={5}
        showCount={true}
      />
      <RelationshipControls
        onClearAll={deleteAllRelationships}
        onCleanDuplicates={cleanupDuplicateEdges}
        onAddEntity={addCustomEntity}
        onAutoGenerateMappings={autoGenerateFieldMappings}
          onAutoGenerateGoldToGoldMappings={autoGenerateGoldToGoldMappings}
        onCreate360View={() => setCreate360ViewModal({ open: true })}
        showRemoveDuplicate={true}
        showNewEntity={false}
      />
      </div>

      {/* Collaborative editing banner */}
      <div
        style={{
          position: "absolute",
          top: "80px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1001,
          width: "calc(100% - 40px)",
          maxWidth: "1200px",
        }}
      >
        <CollaborationBanner
          activeUsers={activeUsers}
          currentUserId={currentUserId}
          onRefresh={() => window.location.reload()}
        />
      </div>

      {/* Loading indicator for file processing */}
      {isLoadingFiles && (
        <div
          style={{
            position: "absolute",
            top: "70px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1002,
            background: "rgba(0, 0, 0, 0.95)",
            color: "white",
            padding: "12px 24px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "600",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "16px",
              height: "16px",
              border: "2px solid rgba(255,255,255,0.3)",
              borderTop: "2px solid white",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          {fileProcessingStatus || "Processing files..."}
        </div>
      )}
      
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#ffffff",
          borderRadius: 12,
          position: "relative",
        }}
      >
        <ReactFlow
          nodes={getFilteredNodes()}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          snapToGrid={true}
          snapGrid={[15, 15]}
          style={{ width: "100%", height: "100%" }}
          defaultEdgeOptions={{
            animated: false,
            style: { 
              stroke: "#000000", 
              strokeWidth: 2,
              strokeDasharray: "5,5", // Creates dashed lines
            },
            labelStyle: {
              fill: "#000000",
              fontWeight: 600,
              fontSize: 10,
            },
            labelBgStyle: { fill: "#ffffff", fillOpacity: 0.9 },
          }}
        >
          <MiniMap
            nodeColor={(node) =>
              node.data.isCuratedFile
                ? "#48bb78"
                : node.data.isConsumptionFile
                ? "#ff6b6b"
                : "#7366ff"
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
      </div>
      <DeleteEntityModal
        open={deleteEntityModal.open}
        onClose={() => setDeleteEntityModal({ open: false, entity: null })}
        entity={deleteEntityModal.entity}
        onConfirm={(id) => deleteEntity(id)}
      />
      <RelationshipModal
        open={relationshipModal.open}
        onClose={() =>
          setRelationshipModal({ open: false, mode: "add", relationship: null })
        }
        mode={relationshipModal.mode}
        relationship={relationshipModal.relationship}
        nodes={nodes}
        onSave={(relationshipData) => {
          if (
            relationshipModal.mode === "edit" &&
            relationshipModal.relationship
          ) {
            editRelationship(relationshipModal.relationship.id, {
              source: `${relationshipData.sourceNodeId}-${relationshipData.sourceColumn}`,
              target: `${relationshipData.targetNodeId}-${relationshipData.targetColumn}`,
              data: {
                sourceColumn: relationshipData.sourceColumn,
                targetColumn: relationshipData.targetColumn,
                relationshipType: "field_mapping",
                transformation: "direct",
              },
            });
          } else {
            addRelationship(
              relationshipData.sourceNodeId,
              relationshipData.targetNodeId,
              relationshipData.sourceColumn,
              relationshipData.targetColumn,
              "field_mapping"
            );
          }
        }}
        onDelete={deleteRelationship}
      />
      <RuleModal
        open={ruleModal.open}
        ruleType={ruleModal.ruleType}
        fieldName={ruleModal.fieldName}
        value={ruleModal.value}
        onChange={(val) => setRuleModal((r) => ({ ...r, value: val }))}
        onClose={() =>
          setRuleModal({
            open: false,
            nodeId: null,
            fieldName: null,
            ruleType: null,
            value: "",
            isNested: false,
          })
        }
        onSave={handleSaveRule}
      />
      <Create360ViewModal
        open={create360ViewModal.open}
        onClose={() => setCreate360ViewModal({ open: false })}
        curatedNodes={nodes.filter((n) => n.data.isCuratedFile)}
        onCreate360View={create360View}
      />
    </div>
  );
}

export default CanvasPageGold;
