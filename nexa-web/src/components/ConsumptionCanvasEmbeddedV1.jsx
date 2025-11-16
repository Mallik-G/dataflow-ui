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

function CustomEdge({ id, sourceX, sourceY, targetX, targetY, style = {} }) {
  const [edgePath] = useMemo(() => {
    const offset = Math.abs(targetX - sourceX) * 0.3;
    const controlPoint1X = sourceX + offset;
    const controlPoint1Y = sourceY;
    const controlPoint2X = targetX - offset;
    const controlPoint2Y = targetY;

    const curvedPath = `M ${sourceX} ${sourceY} C ${controlPoint1X} ${controlPoint1Y} ${controlPoint2X} ${controlPoint2Y} ${targetX} ${targetY}`;

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
                      strokeWidth: 1,
                      strokeDasharray: "none", // Creates dashed lines
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
                    strokeWidth: 1,
                    strokeDasharray: "none", // Creates dashed lines
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
                  [data.isCuratedFile ? "right" : "left"]: -8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: data.isCuratedFile ? "#7366ff" : "#7366ff",
                  border: `2px solid #fff`,
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  boxShadow: `0 0 0 3px ${
                    data.isCuratedFile ? "#7366ff" : "#7366ff"
                  }44`,
                  zIndex: 2,
                  cursor: "pointer",
                }}
                isConnectable={isConnectable}
              />
              <Handle
                type="target"
                position={data.isCuratedFile ? Position.Right : Position.Left}
                id={`${id}-collapsed-target`}
                style={{
                  [data.isCuratedFile ? "right" : "left"]: -8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: data.isCuratedFile ? "#7366ff" : "#7366ff",
                  border: `2px solid #fff`,
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  boxShadow: `0 0 0 3px ${
                    data.isCuratedFile ? "#7366ff" : "#7366ff"
                  }44`,
                  zIndex: 2,
                  cursor: "pointer",
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
                      right: -8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "#48bb78",
                      border: `2px solid #fff`,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      boxShadow: `0 0 0 3px #48bb7844`,
                      zIndex: 2,
                      cursor: "pointer",
                    }}
                    isConnectable={isConnectable}
                  />
                  <Handle
                    type="target"
                    position={Position.Right}
                    id={`${id}-collapsed-target-right`}
                    style={{
                      right: -8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "#48bb78",
                      border: `2px solid #fff`,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      boxShadow: `0 0 0 3px #48bb7844`,
                      zIndex: 2,
                      cursor: "pointer",
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
                  </div>
                )}
                {/* Source handle - Right side for curated, both sides for consumption */}
                <Handle
                  type="source"
                  position={data.isCuratedFile ? Position.Right : Position.Left}
                  id={`${id}-${attr.value || attr.name}`}
                  style={{
                    [data.isCuratedFile ? "right" : "left"]: -8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background:
                      data.isCuratedFile ||
                      (data.isConsumptionFile &&
                        !data.isCuratedFile &&
                        Position.Left ===
                          (data.isCuratedFile ? Position.Right : Position.Left))
                        ? "#7366ff"
                        : "#48bb78",
                    border: `2px solid #fff`,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    boxShadow: `0 0 0 3px ${
                      data.isCuratedFile ||
                      (data.isConsumptionFile &&
                        !data.isCuratedFile &&
                        Position.Left ===
                          (data.isCuratedFile ? Position.Right : Position.Left))
                        ? "#7366ff"
                        : "#48bb78"
                    }44`,
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
                    [data.isCuratedFile ? "right" : "left"]: -8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background:
                      data.isCuratedFile ||
                      (data.isConsumptionFile &&
                        !data.isCuratedFile &&
                        Position.Left ===
                          (data.isCuratedFile ? Position.Right : Position.Left))
                        ? "#7366ff"
                        : "#48bb78",
                    border: `2px solid #fff`,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    boxShadow: `0 0 0 3px ${
                      data.isCuratedFile ||
                      (data.isConsumptionFile &&
                        !data.isCuratedFile &&
                        Position.Left ===
                          (data.isCuratedFile ? Position.Right : Position.Left))
                        ? "#7366ff"
                        : "#48bb78"
                    }44`,
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
                        right: -8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "#48bb78",
                        border: `2px solid #fff`,
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        boxShadow: `0 0 0 3px #48bb7844`,
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
                        right: -8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "#48bb78",
                        border: `2px solid #fff`,
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        boxShadow: `0 0 0 3px #48bb7844`,
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

// Function to find the correct handle ID for a given attribute name
const findHandleId = (node, attributeName) => {
  if (!node.data.attributes) return null;

  // Try exact match first
  const exactMatch = node.data.attributes.find(
    (attr) =>
      (attr.name || attr.value).toLowerCase() === attributeName.toLowerCase()
  );
  if (exactMatch) {
    return `${node.id}-${exactMatch.value || exactMatch.name}-right`;
  }

  // Try partial match
  const partialMatch = node.data.attributes.find((attr) => {
    const attrName = (attr.name || attr.value).toLowerCase();
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
            strokeWidth: 1,
            strokeDasharray: "none", // Creates dashed lines
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
          strokeWidth: 1,
          strokeDasharray: "none", // Creates dashed lines
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
          strokeWidth: 1,
          strokeDasharray: "none", // Creates dashed lines
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

function ConsumptionCanvasEmbedded({
  uploadedFiles: propUploadedFiles,
  rawEntities: propRawEntities,
  curatedEntities: propCuratedEntities,
  fileData: propFileData,
  consumptionFiles: propConsumptionFiles,
}) {
  /**
   * ConsumptionCanvasEmbedded Component
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
          //   relatedCuratedEntities.forEach((curatedId) => {

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
            const uniformSpacing = 80;
            const consumptionStartX = 1200; // Positioned further to the right of curated nodes

            const consumptionNode = {
              id: `360-consumption-${nodeIdCounter}`,
              type: "entity",
              position: {
                x: consumptionStartX,
                y: 100 + i * uniformSpacing,
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
                  stroke: "#7366ff",
                  strokeWidth: 1,
                  strokeDasharray: "none",
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
              // Create header-to-header connection (always visible)
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

              // Create field-level connection (for expanded state)
              const fieldEdgeId = `gold-field-${sourceNode.id}-${targetNode.id}-${goldMapping.sourceAttribute}-${goldMapping.targetAttribute}`;

              // Always create the edge - React Flow will handle missing handles gracefully
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

          // Replace initial nodes with dynamic nodes
          setNodes(dynamicNodes);
          setEdges(mappingEdges);

          const silverToGoldEdges = mappingEdges.filter(
            (e) => e.data?.relationshipType === "field_mapping"
          );
          const goldToGoldEdges = mappingEdges.filter(
            (e) => e.data?.relationshipType === "gold_to_gold_field" || e.data?.relationshipType === "gold_to_gold_header"
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
                strokeWidth: 1,
                strokeDasharray: "none", // Creates dashed lines
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
    const expandedConsumptionIds = Array.from(expandedConsumptionEntities);

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
          const uniformSpacing = 80;
          const consumptionStartX = 1200; // Increased gap from curated entities
          const consumptionStartY = 100;

          // Calculate position considering actual expanded heights of previous nodes
          let calculatedY = consumptionStartY;
          for (let i = 0; i < consumptionNodeIndex; i++) {
            const previousNode = consumptionNodes[i];
            const previousNodeHeight =
              calculateConsumptionEntityHeight(previousNode);
            calculatedY += previousNodeHeight + uniformSpacing;
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
        const uniformSpacing = 80; // Uniform spacing for all entities
        const curatedStartX = 50; // Left side
        const curatedStartY = 100; // Top starting position

        // Calculate position considering actual expanded heights of previous nodes
        let calculatedY = curatedStartY;
        for (let i = 0; i < nodeIndex; i++) {
          const previousNode = visibleCuratedNodes[i];
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
          strokeWidth: 1,
          strokeDasharray: "none", // Creates dashed lines
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
    </div>
  );
}

export default ConsumptionCanvasEmbedded;
