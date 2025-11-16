import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  BiPencil,
  BiLink,
  BiChevronDown,
  BiChevronUp,
  BiTrash,
  BiDotsVerticalRounded,
  BiFile,
  BiShow,
  BiGitRepoForked,
} from "react-icons/bi";

import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from "react-flow-renderer";

const spinnerStyles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = spinnerStyles;
  document.head.appendChild(styleSheet);
}

// Separate component for the remove entity button
const RemoveEntityButton = ({ edgeId, labelX, labelY, onShowDeleteModal }) => {
  const handleRemoveClick = () => {
    if (onShowDeleteModal) {
      onShowDeleteModal(edgeId);
    }
  };

  return (
    <foreignObject
      width={24}
      height={24}
      x={labelX - 12}
      y={labelY - 12}
      className="edgebutton-foreignobject"
      requiredExtensions="http://www.w3.org/1999/xhtml"
    >
      <div
        style={{
          width: "24px",
          height: "24px",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#6B7280",
        }}
        title="Remove mapping"
        onClick={handleRemoveClick}
        onMouseEnter={(e) => {
          e.target.style.background = "#f3f4f6";
          e.target.style.color = "#ef4444";
          e.target.style.borderColor = "#ef4444";
        }}
        onMouseLeave={(e) => {
          e.target.style.background = "#ffffff";
          e.target.style.color = "#6B7280";
          e.target.style.borderColor = "#e5e7eb";
        }}
      >
        <BiTrash size={14} />
      </div>
    </foreignObject>
  );
};

function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  data,
}) {
  const [edgePath, labelX, labelY] = useMemo(() => {
    const offset = Math.abs(targetX - sourceX) * 0.3;
    const controlPoint1X = sourceX + offset;
    const controlPoint1Y = sourceY;
    const controlPoint2X = targetX - offset;
    const controlPoint2Y = targetY;

    const curvedPath = `M ${sourceX} ${sourceY} C ${controlPoint1X} ${controlPoint1Y} ${controlPoint2X} ${controlPoint2Y} ${targetX} ${targetY}`;

    const labelX = (sourceX + targetX) / 2;
    const labelY = (sourceY + targetY) / 2;

    return [curvedPath, labelX, labelY];
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
      {/* Only show delete button for field-to-field mappings, not header-to-header */}
      {/* {data?.relationshipType === "field_mapping" &&
        !data?.sourceHandle?.includes("collapsed") &&
        !data?.targetHandle?.includes("collapsed") &&
        !data?.isSourceCollapsed &&
        !data?.isTargetCollapsed && (
          <RemoveEntityButton
            edgeId={id}
            labelX={labelX}
            labelY={labelY}
            onShowDeleteModal={data?.onShowDeleteModal}
          />
        )} */}
    </>
  );
}

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

const createEdgeTypes = (
  setEdges,
  setShowDeleteModal,
  setEdgeToDelete,
  expandedConsumptionEntities,
  expandedCuratedEntities
) => ({
  custom: (props) => {
    const sourceNodeId = props.source;
    const targetNodeId = props.target;
    const isSourceCollapsed =
      sourceNodeId &&
      !expandedConsumptionEntities.has(sourceNodeId) &&
      !expandedCuratedEntities.has(sourceNodeId);
    const isTargetCollapsed =
      targetNodeId &&
      !expandedConsumptionEntities.has(targetNodeId) &&
      !expandedCuratedEntities.has(targetNodeId);

    return (
      <CustomEdge
        {...props}
        data={{
          ...props.data,
          isSourceCollapsed,
          isTargetCollapsed,
          onRemove: (edgeId) => {
            setEdges((eds) => eds.filter((e) => e.id !== edgeId));
          },
          onShowDeleteModal: (edgeId) => {
            setEdgeToDelete(edgeId);
            setShowDeleteModal(true);
          },
        }}
      />
    );
  },
  goldToGold: (props) => (
    <GoldToGoldEdge
      {...props}
      data={{
        ...props.data,
        onRemove: (edgeId) => {
          setEdges((eds) => eds.filter((e) => e.id !== edgeId));
        },
        onShowDeleteModal: (edgeId) => {
          setEdgeToDelete(edgeId);
          setShowDeleteModal(true);
        },
      }}
    />
  ),
});

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

// Function to identify primary key candidates based on common patterns
const identifyPrimaryKey = (attributes) => {
  if (!attributes || attributes.length === 0) return null;

  // Common primary key patterns
  const primaryKeyPatterns = [
    /^id$/i,
    /^.*_id$/i,
    /^.*id$/i,
    /^key$/i,
    /^.*_key$/i,
    /^pk_/i,
    /^primary_key$/i,
    /^uuid$/i,
    /^guid$/i,
    /^.*_uuid$/i,
    /^.*_guid$/i,
  ];

  // First, check for exact matches with common primary key names
  for (const attr of attributes) {
    const attrName = attr.name.toLowerCase();
    if (primaryKeyPatterns.some((pattern) => pattern.test(attrName))) {
      return attr.name;
    }
  }

  // If no pattern match, look for attributes that might be primary keys based on naming
  const potentialKeys = attributes.filter((attr) => {
    const attrName = attr.name.toLowerCase();
    return (
      attrName.includes("id") ||
      attrName.includes("key") ||
      attrName.includes("code")
    );
  });

  if (potentialKeys.length > 0) {
    // Return the first potential key, preferring shorter names
    return potentialKeys.sort((a, b) => a.name.length - b.name.length)[0].name;
  }

  // If still no match, return the first attribute as fallback
  return attributes[0].name;
};

// Function to analyze and mark primary keys in attributes
const analyzeAndMarkPrimaryKeys = (attributes) => {
  if (!attributes || attributes.length === 0) return attributes;

  const primaryKeyName = identifyPrimaryKey(attributes);

  return attributes.map((attr) => ({
    ...attr,
    isPrimaryKey: attr.name === primaryKeyName,
  }));
};

const EntityNode = React.memo(
  ({ id, data, selected, isConnectable, setNodes, setEdges, edges }) => {
    const [editingField, setEditingField] = useState(null);
    const [fieldEditValue, setFieldEditValue] = useState("");
    const [showMenu, setShowMenu] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(() => {
      if (data.isConsumptionFile) {
        return !data.isExpanded;
      } else {
        return !data.isExpanded;
      }
    });

    // Close menu when clicking outside
    useEffect(() => {
      const handleClickOutside = () => {
        if (showMenu) {
          setShowMenu(false);
        }
      };

      if (showMenu) {
        document.addEventListener("click", handleClickOutside);
        return () => {
          document.removeEventListener("click", handleClickOutside);
        };
      }
    }, [showMenu]);

    const entityName = data.label;

    useEffect(() => {
      setIsCollapsed(!data.isExpanded);
    }, [data.isExpanded]);
    const scdType2 = data.scdType2 || false;
    const attributes = data.attributes || [];

    const toggleCollapsed = useCallback(() => {
      setIsCollapsed(!isCollapsed);

      if (data.onToggleExpansion) {
        data.onToggleExpansion(id);
      }
    }, [isCollapsed, data.onToggleExpansion, id]);

    const nodeColor = data.isCuratedFile ? "#8B5CF6" : "#10B981";
    const nodeBg = "#ffffff";
    const borderColor = data.isCuratedFile ? "#8B5CF6" : "#10B981";

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
          setEditingField(null);
          setFieldEditValue("");
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
                    id: `auto-${sourceNode.id}-${bestSuggestion.curatedColumn}-${id}-${renamedColumn.value}`,
                    source: sourceNode.id,
                    sourceHandle: `${sourceNode.id}-${bestSuggestion.curatedColumn}`,
                    target: id,
                    targetHandle: `${id}-${renamedColumn.value}`,
                    animated: false,
                    style: {
                      stroke: "#000000",
                      strokeWidth: 1,
                      strokeDasharray: "none",
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
      const newName = `new_field_${Math.random().toString(36).substr(2, 9)}`;

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
                  id: `auto-${sourceNode.id}-${bestSuggestion.curatedColumn}-${id}-${newName}`,
                  source: sourceNode.id,
                  sourceHandle: `${sourceNode.id}-${bestSuggestion.curatedColumn}`,
                  target: id,
                  targetHandle: `${id}-${newName}`,
                  animated: false,
                  style: {
                    stroke: "#000000",
                    strokeWidth: 1,
                    strokeDasharray: "none",
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
          border: `1px solid black`,
          borderTop: `3px solid ${borderColor}`,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          borderBottomLeftRadius: data?.isExpanded ? 6 : 2,
          borderBottomRightRadius: data?.isExpanded ? 6 : 2,
          padding: 0,
          width: 400,
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
            top: -30,
            right: 12,
            background: "#DBEAFE",
            color: "#1E40AF",
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 12,
            zIndex: 10,
            border: "1px solid #BFDBFE",
            boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
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
            padding: "14px 16px",
            borderBottom: isCollapsed ? "none" : `1px solid ${borderColor}25`,
            position: "relative",
            background: `${borderColor}10`,
          }}
        >
          {/* Left side - Entity name */}
          <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <span
              style={{
                fontWeight: 600,
                fontSize: 13,
                // color: "#374151",
                color: borderColor,
                wordBreak: "break-word",
                lineHeight: "1.3",
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

            {/* Primary Key Summary */}
            {attributes.some((attr) => attr.isPrimaryKey) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginLeft: "8px",
                  background: "#EFF6FF",
                  border: "1px solid #BFDBFE",
                  borderRadius: "4px",
                  padding: "2px 6px",
                }}
                title={`Primary Key: ${
                  attributes.find((attr) => attr.isPrimaryKey)?.name
                }`}
              >
                <span
                  style={{
                    background: "#2563EB",
                    color: "#FFFFFF",
                    fontSize: 8,
                    fontWeight: "bold",
                    padding: "1px 3px",
                    borderRadius: "2px",
                    marginRight: "4px",
                  }}
                >
                  PK
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "#2563EB",
                    fontWeight: 500,
                  }}
                >
                  {attributes.find((attr) => attr.isPrimaryKey)?.name}
                </span>
              </div>
            )}
          </div>

          {/* Right side - Action icons */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {/* Edit icon */}
            <div
              style={{
                width: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#6B7280",
                fontSize: 10,
              }}
              title="Edit entity"
            >
              <BiPencil size={12} />
            </div>

            {/* Link icon */}
            {data.isConsumptionFile && (
              <div
                style={{
                  width: 20,
                  height: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#6B7280",
                  fontSize: 10,
                }}
                title="Link entity"
              >
                <BiLink size={12} />
              </div>
            )}

            {/* Dropdown arrow */}
            <div
              style={{
                width: 20,
                height: 20,
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
              {isCollapsed ? (
                <BiChevronDown size={20} />
              ) : (
                <BiChevronUp size={20} />
              )}
            </div>
          </div>

          {/* Collapsed state edge handlers */}
          {isCollapsed && (
            <>
              {/* Left handle for consumption entities, right handle for curated entities */}
              <Handle
                type="source"
                position={data.isCuratedFile ? Position.Right : Position.Left}
                id={`${id}-collapsed-source`}
                style={{
                  [data.isCuratedFile ? "right" : "left"]: -2.5,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: data.isCuratedFile ? "#7366ff" : "#7366ff",
                  border: `1px solid #fff`,
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  boxShadow: `0 0 0 1px ${
                    data.isCuratedFile ? "#7366ff" : "#7366ff"
                  }44`,
                  zIndex: 10,
                  cursor: "crosshair",
                }}
                isConnectable={isConnectable}
              />
              <Handle
                type="target"
                position={data.isCuratedFile ? Position.Right : Position.Left}
                id={`${id}-collapsed-target`}
                style={{
                  [data.isCuratedFile ? "right" : "left"]: -2.5,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: data.isCuratedFile ? "#7366ff" : "#7366ff",
                  border: `1px solid #fff`,
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  boxShadow: `0 0 0 1px ${
                    data.isCuratedFile ? "#7366ff" : "#7366ff"
                  }44`,
                  zIndex: 10,
                  cursor: "crosshair",
                }}
                isConnectable={isConnectable}
              />

              {/* Right handle for consumption entities only */}
              {data.isConsumptionFile && (
                <>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`${id}-collapsed-source-right`}
                    style={{
                      right: -2.5,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "#48bb78",
                      border: `1px solid #fff`,
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      boxShadow: `0 0 0 1px #48bb7844`,
                      zIndex: 10,
                      cursor: "crosshair",
                    }}
                    isConnectable={isConnectable}
                  />
                  <Handle
                    type="target"
                    position={Position.Right}
                    id={`${id}-collapsed-target-right`}
                    style={{
                      right: -2.5,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "#48bb78",
                      border: `1px solid #fff`,
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      boxShadow: `0 0 0 1px #48bb7844`,
                      zIndex: 10,
                      cursor: "crosshair",
                    }}
                    isConnectable={isConnectable}
                  />
                </>
              )}
            </>
          )}
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
                        fontWeight: attr.isPrimaryKey ? 700 : 500,
                        color: attr.isPrimaryKey ? "#2563EB" : nodeColor,
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
                        fontWeight: attr.isPrimaryKey ? 700 : 500,
                        color: attr.isPrimaryKey ? "#2563EB" : "#374151",
                        fontSize: 11,
                        cursor: data.isConsumptionFile ? "pointer" : "default",
                        wordBreak: "break-word",
                        lineHeight: "1.3",
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
                      color: attr.isPrimaryKey ? "#2563EB" : "#9CA3AF",
                      fontWeight: attr.isPrimaryKey ? 600 : 400,
                      fontSize: 9,
                      marginLeft: 6,
                    }}
                  >
                    ({attr.type})
                  </span>
                </div>

                {/* Right side - Primary Key Indicator and Action buttons */}
                <div
                  data-no-drag
                  style={{ display: "flex", gap: 4, alignItems: "center" }}
                >
                  {/* Primary Key Indicator */}
                  {attr.isPrimaryKey && (
                    <div
                      style={{
                        background: "#2563EB",
                        color: "#FFFFFF",
                        fontSize: 8,
                        fontWeight: "bold",
                        padding: "1px 4px",
                        borderRadius: "3px",
                        border: "1px solid #1D4ED8",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                      }}
                      title="Primary Key"
                    >
                      PK
                    </div>
                  )}

                  {/* Action buttons for consumption fields */}
                  {data.isConsumptionFile && (
                    <div
                      data-no-drag
                      style={{
                        color: "#6B7280",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 20,
                        height: 20,
                      }}
                      title="Delete field"
                      onClick={() => deleteField(attr.name)}
                    >
                      <BiTrash size={12} />
                    </div>
                  )}
                </div>
                {/* Source handle - Right side for curated, both sides for consumption */}
                <Handle
                  type="source"
                  position={data.isCuratedFile ? Position.Right : Position.Left}
                  id={`${id}-${attr.value || attr.name}`}
                  style={{
                    [data.isCuratedFile ? "right" : "left"]: -2.5,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: attr.isPrimaryKey
                      ? "#2563EB"
                      : data.isCuratedFile ||
                        (data.isConsumptionFile &&
                          !data.isCuratedFile &&
                          Position.Left ===
                            (data.isCuratedFile
                              ? Position.Right
                              : Position.Left))
                      ? "#7366ff"
                      : "#48bb78",
                    border: `1px solid #fff`,
                    width: attr.isPrimaryKey ? 7 : 5,
                    height: attr.isPrimaryKey ? 7 : 5,
                    borderRadius: "50%",
                    boxShadow: `0 0 0 1px ${
                      attr.isPrimaryKey
                        ? "#2563EB"
                        : data.isCuratedFile ||
                          (data.isConsumptionFile &&
                            !data.isCuratedFile &&
                            Position.Left ===
                              (data.isCuratedFile
                                ? Position.Right
                                : Position.Left))
                        ? "#7366ff"
                        : "#48bb78"
                    }44`,
                    zIndex: attr.isPrimaryKey ? 15 : 10,
                    cursor: "crosshair",
                  }}
                  isConnectable={isConnectable}
                />
                {/* Target handle - Right side for curated, both sides for consumption */}
                <Handle
                  type="target"
                  position={data.isCuratedFile ? Position.Right : Position.Left}
                  id={`${id}-${attr.value || attr.name}`}
                  style={{
                    [data.isCuratedFile ? "right" : "left"]: -2.5,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: attr.isPrimaryKey
                      ? "#2563EB"
                      : data.isCuratedFile ||
                        (data.isConsumptionFile &&
                          !data.isCuratedFile &&
                          Position.Left ===
                            (data.isCuratedFile
                              ? Position.Right
                              : Position.Left))
                      ? "#7366ff"
                      : "#48bb78",
                    border: `1px solid #fff`,
                    width: attr.isPrimaryKey ? 7 : 5,
                    height: attr.isPrimaryKey ? 7 : 5,
                    borderRadius: "50%",
                    boxShadow: `0 0 0 1px ${
                      attr.isPrimaryKey
                        ? "#2563EB"
                        : data.isCuratedFile ||
                          (data.isConsumptionFile &&
                            !data.isCuratedFile &&
                            Position.Left ===
                              (data.isCuratedFile
                                ? Position.Right
                                : Position.Left))
                        ? "#7366ff"
                        : "#48bb78"
                    }44`,
                    zIndex: attr.isPrimaryKey ? 15 : 10,
                    cursor: "crosshair",
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
                        right: -2.5,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: attr.isPrimaryKey ? "#2563EB" : "#48bb78",
                        border: `1px solid #fff`,
                        width: attr.isPrimaryKey ? 7 : 5,
                        height: attr.isPrimaryKey ? 7 : 5,
                        borderRadius: "50%",
                        boxShadow: `0 0 0 1px ${
                          attr.isPrimaryKey ? "#2563EB" : "#48bb78"
                        }44`,
                        zIndex: attr.isPrimaryKey ? 15 : 10,
                        cursor: "crosshair",
                      }}
                      isConnectable={isConnectable}
                    />
                    <Handle
                      type="target"
                      position={Position.Right}
                      id={`${id}-${attr.value || attr.name}-right`}
                      style={{
                        right: -2.5,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: attr.isPrimaryKey ? "#2563EB" : "#48bb78",
                        border: `1px solid #fff`,
                        width: attr.isPrimaryKey ? 7 : 5,
                        height: attr.isPrimaryKey ? 7 : 5,
                        borderRadius: "50%",
                        boxShadow: `0 0 0 1px ${
                          attr.isPrimaryKey ? "#2563EB" : "#48bb78"
                        }44`,
                        zIndex: attr.isPrimaryKey ? 15 : 10,
                        cursor: "crosshair",
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

        {/* Action icons for consumption entities - positioned outside the header */}
        {data.isConsumptionFile && (
          <div
            style={{
              position: "absolute",
              right: -40,
              top: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              zIndex: 10,
            }}
          >
            {/* Three dots icon - always visible */}
            <div
              style={{
                width: "24px",
                height: "24px",
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#6B7280",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              title="More options"
            >
              <BiDotsVerticalRounded size={14} />
            </div>

            {/* Context menu icons - only visible when three dots is clicked */}
            {showMenu && (
              <>
                {/* Join Relations icon */}
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#6B7280",
                    rotate: "-90deg",
                  }}
                  title="Join Relations"
                >
                  <BiGitRepoForked size={14} />
                </div>

                {/* Column Description icon */}
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#6B7280",
                  }}
                  title="Column Description"
                >
                  <BiFile size={14} />
                </div>

                {/* View 10 Records icon */}
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#6B7280",
                  }}
                  title="View 10 Records"
                >
                  <BiShow size={14} />
                </div>

                {/* Delete icon */}
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#6B7280",
                  }}
                  title="Delete"
                >
                  <BiTrash size={14} />
                </div>
              </>
            )}
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

const findHandleId = (node, attributeName) => {
  if (!node.data.attributes) return null;

  const exactMatch = node.data.attributes.find(
    (attr) =>
      (attr.value || attr.name).toLowerCase() === attributeName.toLowerCase()
  );
  if (exactMatch) {
    return `${node.id}-${exactMatch.value || exactMatch.name}-right`;
  }

  const partialMatch = node.data.attributes.find((attr) => {
    const attrName = (attr.value || attr.name).toLowerCase();
    return (
      attrName.includes(attributeName.toLowerCase()) ||
      attributeName.toLowerCase().includes(attrName)
    );
  });
  if (partialMatch) {
    return `${node.id}-${partialMatch.value || partialMatch.name}-right`;
  }

  return null;
};

const readGoldToGoldMappingFile = async () => {
  try {
    const response = await fetch("/mappings/gold_data_mappings.csv");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvContent = await response.text();
    const lines = csvContent.split("\n");
    const mappings = [];

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

const generateFieldMappings = (
  curatedNode,
  consumptionNode,
  existingEdges = []
) => {
  const mappings = [];
  const curatedAttrs = curatedNode.data.attributes || [];
  const consumptionAttrs = consumptionNode.data.attributes || [];

  // Create a set of existing mappings to check for duplicates
  const existingMappingKeys = new Set();
  existingEdges.forEach((edge) => {
    if (edge.data?.relationshipType === "field_mapping") {
      const key = `${edge.source}-${edge.data.sourceColumn}-${edge.target}-${edge.data.targetColumn}`;
      existingMappingKeys.add(key);
    }
  });

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
        // Check if this mapping already exists
        const mappingKey = `${curatedNode.id}-${curatedAttr.name}-${consumptionNode.id}-${exactMatch.value}`;
        if (!existingMappingKeys.has(mappingKey)) {
          const edge = {
            id: `auto-${curatedNode.id}-${curatedAttr.name}-${consumptionNode.id}-${exactMatch.value}`,
            source: curatedNode.id,
            sourceHandle: `${curatedNode.id}-${
              curatedAttr.value || curatedAttr.name
            }`,
            target: consumptionNode.id,
            targetHandle: `${consumptionNode.id}-${
              exactMatch.value || exactMatch.name
            }`,
            animated: false,
            style: {
              stroke: "#000000",
              strokeWidth: 1,
              strokeDasharray: "none",
            },
            data: {
              relationshipType: "field_mapping",
              sourceColumn: curatedAttr.name,
              targetColumn: exactMatch.value,
              transformation: "direct",
              autoGenerated: true,
            },
          };

          if (validateEdge(edge, [curatedNode, consumptionNode])) {
            mappings.push(edge);
            // Add to existing mappings set to prevent duplicates within this generation
            existingMappingKeys.add(mappingKey);
          }
        }
      }
      return;
    }

    const exactMatch = consumptionAttrs.find(
      (consumptionAttr) =>
        consumptionAttr.value.toLowerCase() === curatedAttr.name.toLowerCase()
    );

    if (exactMatch) {
      // Check if this mapping already exists
      const mappingKey = `${curatedNode.id}-${curatedAttr.name}-${consumptionNode.id}-${exactMatch.value}`;
      if (!existingMappingKeys.has(mappingKey)) {
        const edge = {
          id: `auto-${curatedNode.id}-${curatedAttr.name}-${consumptionNode.id}-${exactMatch.value}`,
          source: curatedNode.id,
          sourceHandle: `${curatedNode.id}-${
            curatedAttr.value || curatedAttr.name
          }`,
          target: consumptionNode.id,
          targetHandle: `${consumptionNode.id}-${
            exactMatch.value || exactMatch.name
          }`,
          animated: false,
          style: {
            stroke: "#000000",
            strokeWidth: 1,
            strokeDasharray: "none",
          },
          data: {
            relationshipType: "field_mapping",
            sourceColumn: curatedAttr.name,
            targetColumn: exactMatch.value,
            transformation: "direct",
            autoGenerated: true,
          },
        };

        if (validateEdge(edge, [curatedNode, consumptionNode])) {
          mappings.push(edge);
          // Add to existing mappings set to prevent duplicates within this generation
          existingMappingKeys.add(mappingKey);
        }
      }
      return;
    }

    const partialMatches = consumptionAttrs.filter((consumptionAttr) => {
      const consumptionValue = consumptionAttr.value.toLowerCase();

      const isConsumptionIdField = idFields.some(
        (idField) =>
          consumptionValue === idField || consumptionValue.includes("id")
      );

      if (isConsumptionIdField) {
        return false;
      }

      const curatedName = curatedAttr.name.toLowerCase();

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
      // Check if this mapping already exists
      const mappingKey = `${curatedNode.id}-${curatedAttr.name}-${consumptionNode.id}-${bestMatch.value}`;
      if (!existingMappingKeys.has(mappingKey)) {
        const edge = {
          id: `auto-${curatedNode.id}-${curatedAttr.name}-${consumptionNode.id}-${bestMatch.value}`,
          source: curatedNode.id,
          sourceHandle: `${curatedNode.id}-${
            curatedAttr.value || curatedAttr.name
          }`,
          target: consumptionNode.id,
          targetHandle: `${consumptionNode.id}-${
            bestMatch.value || bestMatch.name
          }`,
          animated: false,
          style: {
            stroke: "#000000",
            strokeWidth: 1,
            strokeDasharray: "none",
          },
          data: {
            relationshipType: "field_mapping",
            sourceColumn: curatedAttr.name,
            targetColumn: bestMatch.value,
            transformation: "rename",
            autoGenerated: true,
          },
        };

        if (validateEdge(edge, [curatedNode, consumptionNode])) {
          mappings.push(edge);
          // Add to existing mappings set to prevent duplicates within this generation
          existingMappingKeys.add(mappingKey);
        }
      }
    }
  });

  return mappings;
};

const validateEdge = (edge, nodes) => {
  const sourceNode = nodes.find((n) => n.id === edge.source);
  if (!sourceNode) {
    return false;
  }

  const targetNode = nodes.find((n) => n.id === edge.target);
  if (!targetNode) {
    return false;
  }

  const sourceAttr = sourceNode.data.attributes?.find(
    (attr) =>
      attr.name === edge.data?.sourceColumn ||
      attr.value === edge.data?.sourceColumn
  );
  if (!sourceAttr) {
    return false;
  }

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

const smartMappingEngine = (
  curatedColumns,
  consumptionColumns,
  existingMappings
) => {
  const suggestions = [];

  const mappedCuratedColumns = new Set(
    existingMappings.map((mapping) => mapping.sourceColumn)
  );
  const unmappedCuratedColumns = curatedColumns.filter(
    (col) => !mappedCuratedColumns.has(col.name)
  );

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

      const score1 = calculateSimilarityScore(
        curatedCol.name,
        consumptionValue
      );
      const score2 = calculateSimilarityScore(
        curatedCol.name,
        consumptionLabel
      );
      const score = Math.max(score1, score2);

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

  return suggestions.sort((a, b) => b.score - a.score);
};

const calculateSimilarityScore = (name1, name2) => {
  const n1 = name1.toLowerCase();
  const n2 = name2.toLowerCase();

  if (n1 === n2) return 1.0;

  if (n1.includes(n2) || n2.includes(n1)) return 0.9;

  const idPatterns = ["id", "identifier", "key", "index", "_id"];
  const hasIdPattern1 = idPatterns.some((pattern) => n1.includes(pattern));
  const hasIdPattern2 = idPatterns.some((pattern) => n2.includes(pattern));

  if (hasIdPattern1 && hasIdPattern2) {
    return 0.85;
  }

  const words1 = n1.split(/[_\s-]+/);
  const words2 = n2.split(/[_\s-]+/);

  let wordMatches = 0;
  let totalWords = Math.max(words1.length, words2.length);

  words1.forEach((word1) => {
    words2.forEach((word2) => {
      if (word1 === word2) wordMatches++;
      else if (word1.includes(word2) || word2.includes(word1))
        wordMatches += 0.5;
      else if (idPatterns.includes(word1) && idPatterns.includes(word2))
        wordMatches += 0.8;
      else if (word1.length > 2 && word2.length > 2) {
        const similarity = calculateLevenshteinSimilarity(word1, word2);
        if (similarity > 0.7) wordMatches += similarity * 0.6;
      }
    });
  });

  const wordScore = wordMatches / totalWords;
  const charScore = calculateLevenshteinSimilarity(n1, n2);

  return wordScore * 0.7 + charScore * 0.3;
};

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

  const charSimilarity = calculateLevenshteinSimilarity(n1, n2);
  if (charSimilarity > 0.7) {
    return `Similar character pattern (${Math.round(
      charSimilarity * 100
    )}% similarity)`;
  }

  return "Similar naming pattern";
};

function ConsumptionCanvasEmbedded({
  uploadedFiles: propUploadedFiles,
  rawEntities: propRawEntities,
  curatedEntities: propCuratedEntities,
  fileData: propFileData,
  consumptionFiles: propConsumptionFiles,
  searchTerm = "",
}) {
  const location = useLocation();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

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

  const [expandedConsumptionEntities, setExpandedConsumptionEntities] =
    useState(new Set());
  const [expandedCuratedEntities, setExpandedCuratedEntities] = useState(
    new Set()
  );
  const [initialPositionsSet, setInitialPositionsSet] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [edgeToDelete, setEdgeToDelete] = useState(null);

  const toggleConsumptionEntity = useCallback(
    (entityId) => {
      setExpandedConsumptionEntities((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(entityId)) {
          // Collapsing: remove the entity and its parents
          newSet.delete(entityId);

          // Find all consumption entities that this entity depends on (have this entity as source)
          const parentEntities = edges
            .filter(
              (e) =>
                (e.data?.relationshipType === "field_mapping" ||
                  e.data?.relationshipType === "gold_to_gold_field") &&
                e.source === entityId &&
                nodes.find((n) => n.id === e.target)?.data.isConsumptionFile
            )
            .map((e) => e.target);

          // Remove parent entities from expanded set
          parentEntities.forEach((parentId) => {
            newSet.delete(parentId);
          });

          setExpandedCuratedEntities((curatedPrev) => {
            const curatedSet = new Set(curatedPrev);

            const relatedCuratedEntities = edges
              .filter(
                (e) =>
                  e.data?.relationshipType === "field_mapping" &&
                  e.target === entityId
              )
              .map((e) => e.source);

            relatedCuratedEntities.forEach((curatedId) => {
              const hasOtherMappings = edges.some(
                (e) =>
                  e.data?.relationshipType === "field_mapping" &&
                  e.source === curatedId &&
                  e.target !== entityId &&
                  newSet.has(e.target)
              );

              if (!hasOtherMappings) {
                curatedSet.delete(curatedId);
              }
            });

            return curatedSet;
          });
        } else {
          // Expanding: add the entity and expand parent entities
          newSet.add(entityId);

          // Find all consumption entities that this entity depends on (have this entity as source)
          const parentEntities = edges
            .filter(
              (e) =>
                (e.data?.relationshipType === "field_mapping" ||
                  e.data?.relationshipType === "gold_to_gold_field") &&
                e.source === entityId &&
                nodes.find((n) => n.id === e.target)?.data.isConsumptionFile
            )
            .map((e) => e.target);

          // Add parent entities to expanded set
          parentEntities.forEach((parentId) => {
            newSet.add(parentId);
          });
        }
        return newSet;
      });
    },
    [edges, nodes]
  );

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

  useEffect(() => {
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

        const createNodesFromFiles = async () => {
          setIsLoadingFiles(true);
          setFileProcessingStatus(
            "Processing files from silver_data and gold_data folders..."
          );

          const dynamicNodes = [];
          let nodeIdCounter = 1;

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

          const extractColumnsFromCSVContent = (csvContent) => {
            if (!csvContent) return [];

            try {
              if (csvContent.charCodeAt(0) === 0xfeff) {
                csvContent = csvContent.slice(1);
              }

              const lines = csvContent
                .split(/\r?\n/)
                .filter((line) => line.trim());
              if (lines.length === 0) return [];

              const headerLine = lines[0].trim();
              let columns = [];
              if (headerLine.includes('"')) {
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
                  type: "string",
                  label: column,
                  value: column,
                }));
            } catch {
              return [];
            }
          };

          const readMappingFile = async () => {
            try {
              const mappingContent = await readCSVFile(
                "/mappings/Silver_to_Gold360_Mapping_WithEntities.csv"
              );
              if (!mappingContent) return [];

              const lines = mappingContent.split("\n");
              const mappings = [];

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

          const mappings = await readMappingFile();

          const silverEntities = [
            ...new Set(mappings.map((m) => m.silverEntity)),
          ];

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

          const goldEntities = allGoldEntities;

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

            const csvContent = await readCSVFile(filePath);
            let attributes = [];

            if (csvContent) {
              attributes = extractColumnsFromCSVContent(csvContent);
            }

            if (attributes.length === 0) {
              const entityMappings = mappings.filter(
                (m) => m.silverEntity === silverEntity
              );
              attributes = entityMappings.map((m) => ({
                name: m.silverAttribute,
                type: "string",
                label: m.silverAttribute,
                value: m.silverAttribute,
              }));

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

            const uniformSpacing = 80;
            const startX = 50;

            const curatedNode = {
              id: `curated-${nodeIdCounter}`,
              type: "entity",
              position: {
                x: startX,
                y: 100 + i * uniformSpacing,
              },
              data: {
                label: silverEntity,
                attributes: analyzeAndMarkPrimaryKeys(attributes),
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

            const csvContent = await readCSVFile(filePath);
            let attributes = [];

            if (csvContent) {
              attributes = extractColumnsFromCSVContent(csvContent);
            }

            if (attributes.length === 0) {
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

            const uniformSpacing = 80;
            const consumptionStartX = 1200;

            const consumptionNode = {
              id: `360-consumption-${nodeIdCounter}`,
              type: "entity",
              position: {
                x: consumptionStartX,
                y: 100 + i * uniformSpacing,
              },
              data: {
                label: goldEntity,
                attributes: analyzeAndMarkPrimaryKeys(attributes),
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
                  stroke: "#7366ff",
                  strokeWidth: 1,
                  strokeDasharray: "none",
                },
              });
            }
          }

          setFileProcessingStatus(
            "Creating gold-to-gold entity relationships..."
          );

          const goldToGoldMappings = await readGoldToGoldMappingFile();

          for (const goldMapping of goldToGoldMappings) {
            const sourceNode = dynamicNodes.find(
              (n) => n.data.label === goldMapping.sourceEntity
            );
            const targetNode = dynamicNodes.find(
              (n) => n.data.label === goldMapping.targetEntity
            );

            if (
              sourceNode &&
              targetNode &&
              sourceNode.data.isConsumptionFile &&
              targetNode.data.isConsumptionFile
            ) {
              const headerEdgeId = `gold-header-${sourceNode.id}-${targetNode.id}-${goldMapping.sourceAttribute}-${goldMapping.targetAttribute}`;

              mappingEdges.push({
                id: headerEdgeId,
                source: sourceNode.id,
                sourceHandle: `${sourceNode.id}-collapsed-source-right`,
                target: targetNode.id,
                targetHandle: `${targetNode.id}-collapsed-target-right`,
                type: "goldToGold",
                data: {
                  relationshipType: "gold_to_gold_header",
                  sourceColumn: goldMapping.sourceAttribute,
                  targetColumn: goldMapping.targetAttribute,
                  mappingRule: "gold_entity_relationship",
                  confidence: 1.0,
                  reason: `Gold entity relationship: ${goldMapping.relationshipType} (from gold_data_mappings.csv)`,
                },
                style: {
                  stroke: "#48bb78",
                  strokeWidth: 1,
                  strokeDasharray: "none",
                },
              });

              const fieldEdgeId = `gold-field-${sourceNode.id}-${targetNode.id}-${goldMapping.sourceAttribute}-${goldMapping.targetAttribute}`;

              const sourceHandleId =
                findHandleId(sourceNode, goldMapping.sourceAttribute) ||
                `${sourceNode.id}-${goldMapping.sourceAttribute}-right`;
              const targetHandleId =
                findHandleId(targetNode, goldMapping.targetAttribute) ||
                `${targetNode.id}-${goldMapping.targetAttribute}-right`;

              mappingEdges.push({
                id: fieldEdgeId,
                source: sourceNode.id,
                sourceHandle: sourceHandleId,
                target: targetNode.id,
                targetHandle: targetHandleId,
                type: "goldToGold",
                data: {
                  relationshipType: "gold_to_gold_field",
                  sourceColumn: goldMapping.sourceAttribute,
                  targetColumn: goldMapping.targetAttribute,
                  mappingRule: "gold_entity_relationship",
                  confidence: 1.0,
                  reason: `Gold entity relationship: ${goldMapping.relationshipType} (from gold_data_mappings.csv)`,
                },
                style: {
                  stroke: "#48bb78",
                  strokeWidth: 1,
                  strokeDasharray: "none",
                },
              });
            }
          }

          setNodes(dynamicNodes);
          setEdges(mappingEdges);

          const silverToGoldEdges = mappingEdges.filter(
            (e) => e.data?.relationshipType === "field_mapping"
          );
          const goldToGoldEdges = mappingEdges.filter(
            (e) =>
              e.data?.relationshipType === "gold_to_gold_field" ||
              e.data?.relationshipType === "gold_to_gold_header"
          );

          setIsLoadingFiles(false);
          setFileProcessingStatus(
            `Canvas loaded with ${createdSilverNodes.length} curated entities and ${createdGoldNodes.length} consumption entities with ${silverToGoldEdges.length} silver-to-gold mappings and ${goldToGoldEdges.length} gold-to-gold mappings`
          );
        };

        createNodesFromFiles();
      }
    } else {
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
                  consumptionNode,
                  edges
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
              id: `auto-${curatedNode.id}-${curatedAttr.name}-${nodeId}-${newColumnValue}`,
              source: curatedNode.id,
              sourceHandle: `${curatedNode.id}-${
                curatedAttr.value || curatedAttr.name
              }`,
              target: nodeId,
              targetHandle: `${nodeId}-${newColumnValue}`,
              animated: false,
              style: {
                stroke: exactMatch ? "#28a745" : "#ffc107",
                strokeWidth: 1,
                strokeDasharray: "none",
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

    // Filter consumption nodes based on search term
    const filteredConsumptionNodes = consumptionNodes.filter((node) => {
      if (!searchTerm.trim()) return true;
      return node.data.label.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Filter edges based on consumption entity expansion state
    const filteredEdges = edges.filter((edge) => {
      // Always show gold-to-gold header edges (always visible)
      if (edge.data?.relationshipType === "gold_to_gold_header") {
        return true;
      }
      // Always show gold-to-gold field edges for now
      if (edge.data?.relationshipType === "gold_to_gold_field") {
        return true;
      }
      // Keep all other edge types
      return true;
    });

    // Update edges state with filtered edges
    if (JSON.stringify(filteredEdges) !== JSON.stringify(edges)) {
      setEdges(filteredEdges);
    }

    // Get manually expanded curated nodes (independent of consumption entities)
    const manuallyExpandedCuratedNodes = curatedNodes.filter((curatedNode) =>
      expandedCuratedEntities.has(curatedNode.id)
    );

    // Show curated entities that are related to expanded consumption entities
    const relatedCuratedNodes = curatedNodes.filter((curatedNode) => {
      // Check if this curated node has mappings to any expanded consumption entities
      const hasMappingToExpandedConsumption = edges.some(
        (edge) =>
          edge.data?.relationshipType === "field_mapping" &&
          edge.source === curatedNode.id &&
          expandedConsumptionEntities.has(edge.target)
      );
      return hasMappingToExpandedConsumption;
    });

    const visibleCuratedNodes =
      expandedConsumptionEntities.size > 0
        ? [...relatedCuratedNodes, ...manuallyExpandedCuratedNodes]
        : manuallyExpandedCuratedNodes;

    // Get curated nodes that are mapped to expanded consumption entities (for positioning only)
    const mappedCuratedNodes = visibleCuratedNodes.filter((curatedNode) => {
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
      const uniformSpacing = 80; // Reduced spacing for all entities
      const consumptionStartX = 1200; // Right side - increased gap from curated entities
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
          currentY += nodeHeight + uniformSpacing;
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
        const nodeWidth = 400;
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

    // Show all consumption nodes (hiding functionality disabled)
    const visibleConsumptionNodes = filteredConsumptionNodes;

    const visibleNodes = [
      ...visibleCuratedNodes, // Curated nodes mapped to expanded consumption entities + manually expanded
      ...visibleConsumptionNodes, // Only expanded consumption entity or all if none expanded
    ];

    // Position nodes with dynamic spacing for both curated and consumption entities
    const positionedNodes = visibleNodes.map((n) => {
      let updatedNode = { ...n };

      // Determine if this node is expanded
      const isExpanded = n.data.isConsumptionFile
        ? expandedConsumptionEntities.has(n.id)
        : expandedCuratedEntities.has(n.id);

      // Calculate position based on expanded/collapsed state
      if (n.data.isConsumptionFile) {
        // For consumption nodes, find their position among expanded vs collapsed
        const expandedConsumptionNodes = visibleNodes.filter(
          (node) =>
            node.data.isConsumptionFile &&
            expandedConsumptionEntities.has(node.id)
        );
        const collapsedConsumptionNodes = visibleNodes.filter(
          (node) =>
            node.data.isConsumptionFile &&
            !expandedConsumptionEntities.has(node.id)
        );

        let nodeIndex;
        if (isExpanded) {
          // Position among expanded consumption nodes
          nodeIndex = expandedConsumptionNodes.findIndex(
            (node) => node.id === n.id
          );
        } else {
          // Position among collapsed consumption nodes (after all expanded)
          nodeIndex = collapsedConsumptionNodes.findIndex(
            (node) => node.id === n.id
          );
        }

        // Calculate dynamic height for consumption entities
        const calculateConsumptionEntityHeight = (node) => {
          const isNodeExpanded = expandedConsumptionEntities.has(node.id);
          if (!isNodeExpanded) {
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
        const uniformSpacing = 80;
        const consumptionStartX = 1200; // Increased gap from curated entities
        const consumptionStartY = 0; // Start from top of page

        // Calculate position considering expanded vs collapsed order
        let calculatedY = consumptionStartY;

        if (isExpanded) {
          // For expanded nodes, calculate position among expanded nodes only
          for (let i = 0; i < nodeIndex; i++) {
            const previousNode = expandedConsumptionNodes[i];
            const previousNodeHeight =
              calculateConsumptionEntityHeight(previousNode);
            calculatedY += previousNodeHeight + uniformSpacing;
          }
        } else {
          // For collapsed nodes, first add all expanded nodes, then position among collapsed
          // Add heights of all expanded consumption nodes
          for (let i = 0; i < expandedConsumptionNodes.length; i++) {
            const previousNode = expandedConsumptionNodes[i];
            const previousNodeHeight =
              calculateConsumptionEntityHeight(previousNode);
            calculatedY += previousNodeHeight + uniformSpacing;
          }

          // Then add heights of collapsed consumption nodes up to current node
          for (let i = 0; i < nodeIndex; i++) {
            const previousNode = collapsedConsumptionNodes[i];
            const previousNodeHeight =
              calculateConsumptionEntityHeight(previousNode);
            calculatedY += previousNodeHeight + uniformSpacing;
          }
        }

        updatedNode = {
          ...updatedNode,
          position: {
            x: consumptionStartX,
            y: calculatedY,
          },
        };
      }

      // If this is a curated node, position it in a vertical stack
      if (n.data.isCuratedFile) {
        // For curated nodes, keep them in their original positions (no expanded/collapsed grouping)
        const curatedNodeIndex = visibleNodes
          .filter((node) => node.data.isCuratedFile)
          .findIndex((node) => node.id === n.id);

        // Calculate actual height of curated entities
        const calculateEntityHeight = (node) => {
          const isNodeExpanded = expandedCuratedEntities.has(node.id);
          if (!isNodeExpanded) {
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

        // Position curated nodes in a vertical stack on the left side (original positioning)
        const uniformSpacing = 80; // Uniform spacing for all entities
        const curatedStartX = 50; // Left side
        const curatedStartY = 100; // Start from original position

        // Calculate position in original order (no expanded/collapsed grouping)
        let calculatedY = curatedStartY;
        for (let i = 0; i < curatedNodeIndex; i++) {
          const previousNode = visibleNodes.filter(
            (node) => node.data.isCuratedFile
          )[i];
          const previousNodeHeight = calculateEntityHeight(previousNode);
          calculatedY += previousNodeHeight + uniformSpacing;
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
    handleColumnAdded,
    uploadedFiles,
    consumptionFiles,
    fileData,
    rawEntities,
    curatedEntities,
    toggleConsumptionEntity,
    toggleCuratedEntity,
    searchTerm,
  ]);

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

      // Check if this is a valid connection (curated to consumption)
      const isCuratedToConsumption =
        sourceNode.data.isCuratedFile && targetNode.data.isConsumptionFile;

      const isConsumptionToCurated =
        sourceNode.data.isConsumptionFile && targetNode.data.isCuratedFile;

      if (!isCuratedToConsumption && !isConsumptionToCurated) {
        return;
      }

      // Check if this mapping already exists
      const existingEdge = edges.find(
        (e) =>
          e.source === params.source &&
          e.target === params.target &&
          e.data?.sourceColumn === sourceField &&
          e.data?.targetColumn === targetField
      );

      if (existingEdge) {
        return;
      }

      // Create a proper edge with mapping data
      const newEdge = {
        id: `manual-${params.source}-${sourceField}-${params.target}-${targetField}`,
        source: params.source,
        sourceHandle: params.sourceHandle,
        target: params.target,
        targetHandle: params.targetHandle,
        animated: false,
        style: {
          stroke: "#000000",
          strokeWidth: 1,
          strokeDasharray: "none",
        },
        data: {
          relationshipType: "field_mapping",
          sourceColumn: sourceField,
          targetColumn: targetField,
          transformation: "manual",
          autoGenerated: false,
        },
      };

      setEdges((eds) => [...eds, newEdge]);
    },
    [nodes, setEdges, edges]
  );

  // Edge types with custom edge for remove functionality
  const edgeTypes = useMemo(
    () =>
      createEdgeTypes(
        setEdges,
        setShowDeleteModal,
        setEdgeToDelete,
        expandedConsumptionEntities,
        expandedCuratedEntities
      ),
    [
      setEdges,
      setShowDeleteModal,
      setEdgeToDelete,
      expandedConsumptionEntities,
      expandedCuratedEntities,
    ]
  );

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
        boxShadow: "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
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
          flex: 1,
          overflow: "hidden",
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
          connectionMode="loose"
          deleteKeyCode="Delete"
          multiSelectionKeyCode="Shift"
          defaultEdgeOptions={{
            animated: false,
            style: {
              stroke: "#000000",
              strokeWidth: 1,
              strokeDasharray: "none",
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
          {/* <Controls
            style={{
              background: "#fff",
              borderRadius: 8,
              boxShadow: "0 4px 16px rgba(115,102,255,0.12)",
            }}
          /> */}
          <Background
            color="#eee"
            gap={16}
            size={1}
            style={{ background: "#f7f6ff" }}
          />
        </ReactFlow>
      </div>

      {/* Custom Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={() => {
            setShowDeleteModal(false);
            setEdgeToDelete(null);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "8px",
              padding: "24px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: "16px" }}>
              <h3
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#1f2937",
                }}
              >
                Delete Mapping
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#6b7280",
                  lineHeight: "1.5",
                }}
              >
                Are you sure you want to delete this field mapping? This action
                cannot be undone.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setEdgeToDelete(null);
                }}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  background: "#ffffff",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (edgeToDelete && setEdges) {
                    setEdges((eds) => {
                      const updatedEdges = eds.filter(
                        (e) => e.id !== edgeToDelete
                      );

                      // Find the deleted edge to get source and target info
                      const deletedEdge = eds.find(
                        (e) => e.id === edgeToDelete
                      );
                      if (
                        deletedEdge &&
                        deletedEdge.data?.relationshipType === "field_mapping"
                      ) {
                        const sourceNodeId = deletedEdge.source;

                        // Check if the source (curated) node still has any mappings to expanded consumption entities
                        const remainingMappings = updatedEdges.filter(
                          (e) =>
                            e.data?.relationshipType === "field_mapping" &&
                            e.source === sourceNodeId &&
                            expandedConsumptionEntities.has(e.target)
                        );

                        // If no remaining mappings to expanded entities, collapse the curated entity
                        if (remainingMappings.length === 0) {
                          setExpandedCuratedEntities((prev) => {
                            const newSet = new Set(prev);
                            newSet.delete(sourceNodeId);
                            return newSet;
                          });
                        }
                      }

                      return updatedEdges;
                    });
                  }
                  setShowDeleteModal(false);
                  setEdgeToDelete(null);
                }}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "6px",
                  background: "#ef4444",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConsumptionCanvasEmbedded;
