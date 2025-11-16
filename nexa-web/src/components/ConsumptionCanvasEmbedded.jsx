import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import {
  BiPencil,
  BiChevronDown,
  BiChevronUp,
  BiLink,
  BiTrash,
  BiDotsVerticalRounded,
  BiFile,
  BiShow,
  BiSolidData,
  BiListUl,
} from "react-icons/bi";
import ConsumptionEntityOffcanvas from "./ConsumptionEntityOffcanvas";
import ConsumptionColumnETLModal from "./ConsumptionColumnETLModal";
import aiIcon from "../assets/ai-icon.svg";
import geminiIcon from "../assets/icons8-gemini-ai-480.png";

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
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd="url(#react-flow__arrowhead)"
      />
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

const createNodeTypes = (
  setNodes,
  setEdges,
  edges,
  setOffcanvasEntityData,
  setOffcanvasAction,
  setShowOffcanvas,
  setExpandedCanvasHeader,
  setEtlModal,
  nodes
) => ({
  entity: (props) => (
    <EntityNode
      {...props}
      setNodes={setNodes}
      setEdges={setEdges}
      edges={edges}
      nodes={nodes}
      setOffcanvasEntityData={setOffcanvasEntityData}
      setOffcanvasAction={setOffcanvasAction}
      setShowOffcanvas={setShowOffcanvas}
      setExpandedCanvasHeader={setExpandedCanvasHeader}
      setEtlModal={setEtlModal}
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
  ({
    id,
    data,
    selected,
    isConnectable,
    setNodes,
    setEdges,
    edges,
    nodes,
    setOffcanvasEntityData,
    setOffcanvasAction,
    setShowOffcanvas,
    setExpandedCanvasHeader,
    setEtlModal,
  }) => {
    const [editingField, setEditingField] = useState(null);
    const [fieldEditValue, setFieldEditValue] = useState("");
    const [showMenu, setShowMenu] = useState(false);
    const [hoveredAttribute, setHoveredAttribute] = useState(null);
    const [isCollapsed, setIsCollapsed] = useState(() => {
      if (data.isConsumptionFile) {
        return !data.isExpanded;
      } else {
        return !data.isExpanded;
      }
    });
    const [isEditingEntityName, setIsEditingEntityName] = useState(false);
    const [entityNameEditValue, setEntityNameEditValue] = useState("");

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
    const attributes = useMemo(() => data.attributes || [], [data.attributes]);

    const toggleCollapsed = useCallback(() => {
      setIsCollapsed(!isCollapsed);

      if (data.onToggleExpansion) {
        data.onToggleExpansion(id);
      }
    }, [isCollapsed, data, id]);

    const nodeColor = data.isCuratedFile ? "#8B5CF6" : "#10B981";
    const nodeBg = "#ffffff";
    const borderColor = data.isCuratedFile ? "#8B5CF6" : "#10B981";

    // Generate auto-description based on attributes
    const generateAutoDescription = useCallback(() => {
      if (!attributes || attributes.length === 0) {
        return "No data structure available";
      }

      const entityName = data.label.toLowerCase();
      const totalColumns = attributes.length;

      // Analyze column patterns
      const dateColumns = attributes.filter(
        (attr) =>
          attr.name.toLowerCase().includes("date") ||
          attr.name.toLowerCase().includes("time") ||
          attr.name.toLowerCase().includes("created") ||
          attr.name.toLowerCase().includes("updated") ||
          attr.type?.toLowerCase().includes("date")
      );
      const idColumns = attributes.filter(
        (attr) => attr.name.toLowerCase().includes("id") && !attr.isPrimaryKey
      );
      const nameColumns = attributes.filter(
        (attr) =>
          attr.name.toLowerCase().includes("name") ||
          attr.name.toLowerCase().includes("title") ||
          attr.name.toLowerCase().includes("description")
      );
      const amountColumns = attributes.filter(
        (attr) =>
          attr.name.toLowerCase().includes("amount") ||
          attr.name.toLowerCase().includes("price") ||
          attr.name.toLowerCase().includes("cost") ||
          attr.name.toLowerCase().includes("value") ||
          attr.name.toLowerCase().includes("total") ||
          attr.name.toLowerCase().includes("sum") ||
          attr.name.toLowerCase().includes("revenue") ||
          attr.name.toLowerCase().includes("sales")
      );
      const emailColumns = attributes.filter(
        (attr) =>
          attr.name.toLowerCase().includes("email") ||
          attr.name.toLowerCase().includes("mail")
      );
      const phoneColumns = attributes.filter(
        (attr) =>
          attr.name.toLowerCase().includes("phone") ||
          attr.name.toLowerCase().includes("mobile") ||
          attr.name.toLowerCase().includes("tel")
      );
      const addressColumns = attributes.filter(
        (attr) =>
          attr.name.toLowerCase().includes("address") ||
          attr.name.toLowerCase().includes("street") ||
          attr.name.toLowerCase().includes("city") ||
          attr.name.toLowerCase().includes("state") ||
          attr.name.toLowerCase().includes("zip") ||
          attr.name.toLowerCase().includes("postal") ||
          attr.name.toLowerCase().includes("country")
      );
      const statusColumns = attributes.filter(
        (attr) =>
          attr.name.toLowerCase().includes("status") ||
          attr.name.toLowerCase().includes("state") ||
          attr.name.toLowerCase().includes("active") ||
          attr.name.toLowerCase().includes("enabled")
      );

      // Generate business-focused descriptions based on patterns
      if (
        entityName.includes("customer") ||
        entityName.includes("user") ||
        entityName.includes("client")
      ) {
        if (
          emailColumns.length > 0 &&
          phoneColumns.length > 0 &&
          addressColumns.length > 0
        ) {
          return "Customer contact and profile information with full address details";
        } else if (emailColumns.length > 0 && phoneColumns.length > 0) {
          return "Customer contact information and profile data";
        } else if (emailColumns.length > 0) {
          return "Customer profile and contact information";
        } else {
          return "Customer or user profile data";
        }
      }

      if (
        entityName.includes("order") ||
        entityName.includes("purchase") ||
        entityName.includes("transaction")
      ) {
        if (amountColumns.length > 0 && dateColumns.length > 0) {
          return "Order or transaction records with pricing and timing information";
        } else if (amountColumns.length > 0) {
          return "Order or transaction data with financial details";
        } else if (dateColumns.length > 0) {
          return "Order or transaction records with timing information";
        } else {
          return "Order or transaction data";
        }
      }

      if (
        entityName.includes("product") ||
        entityName.includes("item") ||
        entityName.includes("goods")
      ) {
        if (amountColumns.length > 0 && nameColumns.length > 0) {
          return "Product catalog with pricing and descriptive information";
        } else if (amountColumns.length > 0) {
          return "Product information with pricing data";
        } else if (nameColumns.length > 0) {
          return "Product catalog and descriptive information";
        } else {
          return "Product or item information";
        }
      }

      if (
        entityName.includes("employee") ||
        entityName.includes("staff") ||
        entityName.includes("personnel")
      ) {
        if (emailColumns.length > 0 && phoneColumns.length > 0) {
          return "Employee contact and profile information";
        } else if (emailColumns.length > 0) {
          return "Employee profile and contact data";
        } else {
          return "Employee or staff information";
        }
      }

      if (entityName.includes("inventory") || entityName.includes("stock")) {
        if (amountColumns.length > 0 && dateColumns.length > 0) {
          return "Inventory tracking with stock levels and timing data";
        } else if (amountColumns.length > 0) {
          return "Inventory or stock level information";
        } else {
          return "Inventory or stock management data";
        }
      }

      if (entityName.includes("sales") || entityName.includes("revenue")) {
        if (amountColumns.length > 0 && dateColumns.length > 0) {
          return "Sales and revenue tracking with financial and timing data";
        } else if (amountColumns.length > 0) {
          return "Sales and revenue information";
        } else {
          return "Sales or revenue data";
        }
      }

      if (
        entityName.includes("log") ||
        entityName.includes("audit") ||
        entityName.includes("history")
      ) {
        if (dateColumns.length > 0) {
          return "Activity logs or audit trail with timestamp information";
        } else {
          return "Activity logs or audit records";
        }
      }

      if (entityName.includes("address") || entityName.includes("location")) {
        if (addressColumns.length > 0) {
          return "Address and location information";
        } else {
          return "Location or address data";
        }
      }

      if (
        entityName.includes("category") ||
        entityName.includes("type") ||
        entityName.includes("classification")
      ) {
        if (nameColumns.length > 0) {
          return "Categorization or classification system";
        } else {
          return "Category or type classification data";
        }
      }

      if (
        entityName.includes("payment") ||
        entityName.includes("billing") ||
        entityName.includes("invoice")
      ) {
        if (amountColumns.length > 0 && dateColumns.length > 0) {
          return "Payment or billing records with financial and timing data";
        } else if (amountColumns.length > 0) {
          return "Payment or billing information with financial details";
        } else if (dateColumns.length > 0) {
          return "Payment or billing records with timing information";
        } else {
          return "Payment or billing data";
        }
      }

      if (
        entityName.includes("shipping") ||
        entityName.includes("delivery") ||
        entityName.includes("transport")
      ) {
        if (dateColumns.length > 0 && addressColumns.length > 0) {
          return "Shipping or delivery tracking with location and timing data";
        } else if (dateColumns.length > 0) {
          return "Shipping or delivery information with timing data";
        } else if (addressColumns.length > 0) {
          return "Shipping or delivery data with location information";
        } else {
          return "Shipping or delivery information";
        }
      }

      if (entityName.includes("account") || entityName.includes("financial")) {
        if (amountColumns.length > 0 && dateColumns.length > 0) {
          return "Financial account information with balance and transaction history";
        } else if (amountColumns.length > 0) {
          return "Financial account data with balance information";
        } else if (dateColumns.length > 0) {
          return "Financial account records with transaction history";
        } else {
          return "Financial account information";
        }
      }

      // Generic descriptions based on column patterns
      if (
        emailColumns.length > 0 &&
        phoneColumns.length > 0 &&
        addressColumns.length > 0
      ) {
        return "Contact and profile information with full address details";
      }

      if (amountColumns.length > 0 && dateColumns.length > 0) {
        return "Financial or transactional data with timing information";
      }

      if (dateColumns.length > 0 && statusColumns.length > 0) {
        return "Status tracking with timestamp information";
      }

      if (nameColumns.length > 0 && dateColumns.length > 0) {
        return "Descriptive data with timing information";
      }

      if (amountColumns.length > 0) {
        return "Financial or quantitative data";
      }

      if (dateColumns.length > 0) {
        return "Time-based or historical data";
      }

      if (nameColumns.length > 0) {
        return "Descriptive or reference data";
      }

      if (idColumns.length > 0) {
        return "Reference or lookup data";
      }

      // Fallback description
      return `Data structure with ${totalColumns} field${
        totalColumns !== 1 ? "s" : ""
      }`;
    }, [attributes, data.label]);

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

    // Controller for Join Relations functionality
    const handleJoinRelations = useCallback(
      (event) => {
        // Close the menu first
        setShowMenu(false);

        // Get button position for popup positioning
        const buttonRect = event?.currentTarget?.getBoundingClientRect();
        const popupPosition = buttonRect
          ? {
              top: buttonRect.top,
              left: buttonRect.right + 10, // 10px offset to the right
              width: buttonRect.width,
              height: buttonRect.height,
            }
          : null;

        // Logic to show join relations or open join dialog
        const entityData = {
          id: id,
          label: data.label,
          attributes: attributes,
          isConsumptionFile: data.isConsumptionFile,
          popupPosition: popupPosition,
        };

        // You can customize this based on your specific join relations requirements
        if (data.onJoinRelations) {
          data.onJoinRelations(entityData);
        } else {
          // Open offcanvas for join relations
          setOffcanvasEntityData(entityData);
          setOffcanvasAction("joinRelations");
          setShowOffcanvas(true);
        }
      },
      [
        id,
        data,
        attributes,
        setShowMenu,
        setOffcanvasEntityData,
        setOffcanvasAction,
        setShowOffcanvas,
      ]
    );

    // Controller for individual Column Description functionality
    const handleIndividualColumnDescription = useCallback(
      (attr) => {
        // Logic to show/edit individual column description
        const columnInfo = {
          id: id,
          label: data.label,
          column: {
            name: attr.name,
            type: attr.type || "string",
            description: attr.description || "",
            isPrimaryKey: attr.isPrimaryKey || false,
          },
          entityType: data.isConsumptionFile ? "consumption" : "curated",
        };

        // Open offcanvas for column description
        setOffcanvasEntityData(columnInfo);
        setOffcanvasAction("columnDescription");
        setShowOffcanvas(true);
      },
      [id, data, setOffcanvasEntityData, setOffcanvasAction, setShowOffcanvas]
    );

    // Controller for Delete Entity functionality
    const handleDeleteEntity = useCallback(() => {
      // Close the menu first
      setShowMenu(false);

      // Logic to delete the entire entity
      const entityData = {
        id: id,
        label: data.label,
        attributes: attributes,
        isConsumptionFile: data.isConsumptionFile,
      };

      if (data.onDeleteEntity) {
        data.onDeleteEntity(id, data.label);
      } else {
        // Open offcanvas for delete confirmation
        setOffcanvasEntityData(entityData);
        setOffcanvasAction("deleteEntity");
        setShowOffcanvas(true);
      }
    }, [
      id,
      data,
      attributes,
      setShowMenu,
      setOffcanvasEntityData,
      setOffcanvasAction,
      setShowOffcanvas,
    ]);

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
                  // Check for existing mappings to prevent duplicates
                  const existingMappingByValue = existingMappings.find(
                    (edge) =>
                      edge.data?.relationshipType === "field_mapping" &&
                      edge.data.sourceEntity === sourceNode.data.value &&
                      edge.data.sourceColumn === bestSuggestion.curatedColumn &&
                      edge.data.targetEntity === data.value &&
                      edge.data.targetColumn === renamedColumn.value
                  );

                  if (!existingMappingByValue) {
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
                        sourceEntity: sourceNode.data.value, // Original entity name
                        targetEntity: data.value, // Original entity name
                        sourceEntityLabel: sourceNode.data.label, // Current display name
                        targetEntityLabel: data.label, // Current display name
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
        }
      },
      [fieldEditValue, attributes, id, setNodes, data, edges, setEdges]
    );

    // Start editing entity name
    const startEditEntityName = useCallback(() => {
      setIsEditingEntityName(true);
      setEntityNameEditValue(data.label || "");
    }, [data.label]);

    // Save entity name edit
    const saveEntityNameEdit = useCallback(() => {
      const trimmed = entityNameEditValue.trim();
      if (!trimmed) {
        // If empty, revert to original name
        setIsEditingEntityName(false);
        setEntityNameEditValue("");
        return;
      }

      // Check for duplicate entity names (case-insensitive)
      const existingEntity = data.allNodes?.find(
        (node) =>
          node.id !== id &&
          node.data.label.toLowerCase() === trimmed.toLowerCase()
      );

      if (existingEntity) {
        alert(
          `Entity "${trimmed}" already exists. Please choose a different name.`
        );
        return;
      }

      // Update the entity with new label while preserving the original value
      if (setNodes) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    label: trimmed,
                    value: data.value || data.label, // Preserve original name as value
                  },
                }
              : n
          )
        );
      }

      // Update all edges that reference this entity to use the new label
      if (setEdges) {
        setEdges((eds) =>
          eds.map((edge) => {
            if (edge.source === id) {
              return {
                ...edge,
                data: {
                  ...edge.data,
                  sourceEntityLabel: trimmed, // Update display label
                  // Keep sourceEntity as original value for mapping integrity
                },
              };
            }
            if (edge.target === id) {
              return {
                ...edge,
                data: {
                  ...edge.data,
                  targetEntityLabel: trimmed, // Update display label
                  // Keep targetEntity as original value for mapping integrity
                },
              };
            }
            return edge;
          })
        );
      }

      // Prevent duplicate mappings by checking if any existing mappings would conflict
      // after the entity rename
      if (setEdges && data.allNodes) {
        const currentEdges = edges.filter(
          (e) => e.data?.relationshipType === "field_mapping"
        );

        // Get all consumption entities (including the renamed one)
        const consumptionNodes = data.allNodes.filter(
          (n) => n.data.isConsumptionFile
        );
        const curatedNodes = data.allNodes.filter((n) => n.data.isCuratedFile);

        // Check for potential duplicate mappings
        const duplicateMappings = [];

        currentEdges.forEach((edge) => {
          if (edge.data?.relationshipType === "field_mapping") {
            const sourceNode = curatedNodes.find((n) => n.id === edge.source);
            const targetNode = consumptionNodes.find(
              (n) => n.id === edge.target
            );

            if (sourceNode && targetNode) {
              // Check if there are multiple edges with the same source and target columns
              const similarEdges = currentEdges.filter(
                (e) =>
                  e.data?.relationshipType === "field_mapping" &&
                  e.data.sourceColumn === edge.data.sourceColumn &&
                  e.data.targetColumn === edge.data.targetColumn &&
                  e.id !== edge.id
              );

              if (similarEdges.length > 0) {
                duplicateMappings.push(...similarEdges);
              }
            }
          }
        });

        // Remove duplicate mappings, keeping only the first one
        if (duplicateMappings.length > 0) {
          const duplicateIds = [...new Set(duplicateMappings.map((e) => e.id))];
          setEdges((eds) =>
            eds.filter((edge) => !duplicateIds.includes(edge.id))
          );
        }
      }

      setIsEditingEntityName(false);
      setEntityNameEditValue("");
    }, [
      entityNameEditValue,
      id,
      data.allNodes,
      data.label,
      data.value,
      setNodes,
      setEdges,
    ]);

    // Cancel entity name edit
    const cancelEntityNameEdit = useCallback(() => {
      setIsEditingEntityName(false);
      setEntityNameEditValue(data.label || "");
    }, [data.label]);

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
                // Check for existing mappings to prevent duplicates
                const existingMappingByValue = existingMappings.find(
                  (edge) =>
                    edge.data?.relationshipType === "field_mapping" &&
                    edge.data.sourceEntity === sourceNode.data.value &&
                    edge.data.sourceColumn === bestSuggestion.curatedColumn &&
                    edge.data.targetEntity === data.value &&
                    edge.data.targetColumn === newName
                );

                if (!existingMappingByValue) {
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
                      sourceEntity: sourceNode.data.value, // Original entity name
                      targetEntity: data.value, // Original entity name
                      sourceEntityLabel: sourceNode.data.label, // Current display name
                      targetEntityLabel: data.label, // Current display name
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
      }

      // Also call the column added handler
      if (data.onColumnAdded) {
        data.onColumnAdded(id, newAttr.value);
      }
    }, [attributes, id, setNodes, data, edges, setEdges]);

    // ETL handler for column transformations
    const handleETL = useCallback(
      (column) => {
        setEtlModal({
          open: true,
          column: column.name,
          entity: data,
        });
      },
      [data]
    );

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

        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
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
              <BiSolidData size={12} style={{ marginRight: 4 }} />

              {isEditingEntityName ? (
                <input
                  value={entityNameEditValue}
                  onChange={(e) => setEntityNameEditValue(e.target.value)}
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: borderColor,
                    border: `2px solid ${borderColor}`,
                    borderRadius: 4,
                    padding: "2px 6px",
                    outline: "none",
                    background: "#fff",
                    minWidth: "120px",
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      saveEntityNameEdit();
                    } else if (e.key === "Escape") {
                      cancelEntityNameEdit();
                    }
                  }}
                  onBlur={saveEntityNameEdit}
                />
              ) : (
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: borderColor,
                    wordBreak: "break-word",
                    lineHeight: "1.3",
                    cursor: "pointer",
                    padding: "2px 4px",
                    borderRadius: 3,
                    transition: "background-color 0.2s",
                  }}
                  onClick={startEditEntityName}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = `${borderColor}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = "transparent";
                  }}
                  title="Click to rename entity"
                >
                  {entityName}
                </span>
              )}

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

          {/* Auto-description */}
          <div
            style={{
              padding: "8px 16px",
              background: "#F9FAFB",
              borderTop: `1px solid ${borderColor}25`,
              fontSize: 11,
              color: "#6B7280",
              lineHeight: "1.4",
              fontStyle: "italic",
            }}
          >
            {generateAutoDescription()}
          </div>
        </div>

        {/* Gemini AI Image - only show when expanded */}
        {!isCollapsed && (
          <div style={{ 
            padding: "3px", 
            textAlign: "center",
            marginBottom: "-49px",
            left: "-211px",
            position: "absolute",
            border: "1px solid #2f6de9",
            borderRadius: "6px",
            marginTop: "3px"          }}>
            <img
              src={geminiIcon}
              alt="Gemini AI"
              //title="Gemini AI Assistant"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                cursor: "pointer",
                transition: "transform 0.2s ease",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedCanvasHeader((prev) => {
                  if (prev?.visible && prev?.entityId === id) {
                    return null; // collapse
                  }
                  return {
                    tab: "workspace",
                    visible: true,
                    entityId: id,
                    entityData: data,
                  };
                });
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "scale(1.1)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "scale(1)";
              }}
            />
          </div>
        )}

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
                onMouseEnter={() => setHoveredAttribute(attr.name)}
                onMouseLeave={() => setHoveredAttribute(null)}
              >
                {/* Left side - Field name and type */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  {/* Field name/type (editable for consumption) */}

                  <img
                    src={aiIcon}
                    alt="ETL Transformation"
                    title="ETL Transformation"
                    style={{
                      cursor: "pointer",
                      width: "12px",
                      height: "12px",
                    }}
                    onClick={() => handleETL(attr)}
                  />

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
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 44,
                        height: 20,
                        gap: 4,
                      }}
                    >
                      {hoveredAttribute === attr.name && (
                        <>
                          <BiFile
                            size={12}
                            title="Column Description"
                            style={{ cursor: "pointer" }}
                            onClick={() =>
                              handleIndividualColumnDescription(attr)
                            }
                          />

                          <BiTrash
                            size={12}
                            title="Delete field"
                            style={{ cursor: "pointer" }}
                            onClick={() => deleteField(attr.name)}
                          />
                        </>
                      )}
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
                {/* Column ETL Modal */}
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
                    // Collect all mappings for this entity using the global nodes and edges
                    const entityMappings = collectAllMappingsForArtifacts(
                      nodes,
                      edges
                    );

                    setExpandedCanvasHeader({
                      tab: "workspace",
                      visible: true,
                      entityId: id,
                      entityData: {
                        ...data,
                        mappings: entityMappings.mappings,
                        sourceEntities: entityMappings.sourceEntities,
                      },
                    });
                  }}
                  title="Toggle ETL Modal"
                >
                  <BiListUl size={14} />
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedCanvasHeader({
                      tab: "records",
                      visible: true,
                      entityId: id,
                      entityData: data,
                    });
                  }}
                >
                  <BiShow size={14} />
                </div>

                {/* Connectors icon */}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    handleJoinRelations(e);
                  }}
                >
                  <BiLink size={14} />
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
                  title="Delete Entity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteEntity();
                  }}
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

const findHandleId = (node, attributeName, isNodeExpanded = false) => {
  if (!node.data.attributes) return null;

  // If node is collapsed, return the collapsed handle ID
  if (!isNodeExpanded) {
    if (node.data.isConsumptionFile) {
      return `${node.id}-collapsed-source-right`;
    } else {
      return `${node.id}-collapsed-source`;
    }
  }

  // Normalize attribute names for better matching
  const normalizedAttributeName = attributeName.toLowerCase().replace(/_/g, "");

  const exactMatch = node.data.attributes.find((attr) => {
    const attrName = (attr.value || attr.name).toLowerCase().replace(/_/g, "");
    return attrName === normalizedAttributeName;
  });

  if (exactMatch) {
    return `${node.id}-${exactMatch.value || exactMatch.name}-right`;
  }

  const partialMatch = node.data.attributes.find((attr) => {
    const attrName = (attr.value || attr.name).toLowerCase().replace(/_/g, "");
    return (
      attrName.includes(normalizedAttributeName) ||
      normalizedAttributeName.includes(attrName)
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

// Function to collect all mappings for artifacts generation
const collectAllMappingsForArtifacts = (nodes, edges) => {
  const mappings = [];
  const sourceEntities = new Set();

  edges.forEach((edge) => {
    if (edge.data?.relationshipType === "field_mapping") {
      const sourceNode = nodes?.find((n) => n.id === edge.source);
      const targetNode = nodes?.find((n) => n.id === edge.target);

      if (sourceNode && targetNode) {
        sourceEntities.add(sourceNode.data.value);
        sourceEntities.add(targetNode.data.value);

        mappings.push({
          source: edge.data.sourceColumn,
          target: edge.data.targetColumn,
          sourceEntity: edge.data.sourceEntity,
          targetEntity: edge.data.targetEntity,
          transformation: edge.data.transformation || "direct_mapping",
          joinCondition: edge.data.transformationConfig?.joinCondition || null,
          isPrimaryKey: edge.data.sourceColumn.toLowerCase().includes("id"),
          caseConditions: edge.data.transformationConfig?.caseConditions || [],
          aggregationFunction:
            edge.data.transformationConfig?.aggregationFunction || null,
          sourceFields: edge.data.transformationConfig?.sourceFields || [],
          calculationExpression:
            edge.data.transformationConfig?.calculationExpression || null,
          defaultValue: edge.data.transformationConfig?.defaultValue || null,
        });
      }
    }
  });

  return {
    mappings,
    sourceEntities: Array.from(sourceEntities),
  };
};

// Enhanced function to update mapping transformations when manually modified
const updateMappingTransformation = (edge, sourceNode, targetNode) => {
  const sourceAttrs = sourceNode.data.attributes || [];
  const targetAttrs = targetNode.data.attributes || [];

  // Get the source and target columns
  const sourceColumn = edge.data.sourceColumn;
  const targetColumn = edge.data.targetColumn;

  // Find the source and target attributes
  const sourceAttr = sourceAttrs.find((attr) => attr.name === sourceColumn);
  const targetAttr = targetAttrs.find((attr) => attr.name === targetColumn);

  if (!sourceAttr || !targetAttr) return edge;

  // Analyze the relationship and determine optimal transformation
  const sourceName = sourceAttr.name.toLowerCase();
  const targetName = targetAttr.name.toLowerCase();

  let transformationType = "direct_mapping";
  let joinCondition = null;
  let sourceFields = [];
  let aggregationFunction = null;
  let caseConditions = [];
  let calculationExpression = null;
  let defaultValue = null;

  // Check for ID field relationships
  if (sourceName.includes("id") || targetName.includes("id")) {
    transformationType = "direct_mapping";
    joinCondition = `${sourceNode.data.value}.${sourceColumn} = ${targetNode.data.value}.${targetColumn}`;
  }
  // Check for name concatenation opportunities
  else if (sourceName.includes("name") || targetName.includes("name")) {
    const relatedNameFields = sourceAttrs.filter(
      (attr) =>
        attr.name.toLowerCase().includes("first") ||
        attr.name.toLowerCase().includes("last") ||
        attr.name.toLowerCase().includes("middle") ||
        attr.name.toLowerCase().includes("full")
    );
    if (relatedNameFields.length > 1) {
      transformationType = "concatenation";
      sourceFields = relatedNameFields.map((attr) => attr.name);
      defaultValue = "";
    }
  }
  // Check for numeric aggregation opportunities
  else if (
    sourceName.includes("amount") ||
    sourceName.includes("total") ||
    targetName.includes("amount") ||
    targetName.includes("total")
  ) {
    const numericFields = sourceAttrs.filter(
      (attr) =>
        attr.name.toLowerCase().includes("amount") ||
        attr.name.toLowerCase().includes("price") ||
        attr.name.toLowerCase().includes("cost") ||
        attr.name.toLowerCase().includes("total")
    );
    if (numericFields.length > 1) {
      transformationType = "aggregation";
      aggregationFunction = "SUM";
      sourceFields = numericFields.map((attr) => attr.name);
    }
  }
  // Check for status/category case statements
  else if (
    sourceName.includes("status") ||
    sourceName.includes("type") ||
    targetName.includes("status") ||
    targetName.includes("type")
  ) {
    transformationType = "case_statement";
    caseConditions = [
      { when: "active", then: "ACTIVE" },
      { when: "inactive", then: "INACTIVE" },
      { when: "pending", then: "PENDING" },
      { when: "completed", then: "COMPLETED" },
    ];
    defaultValue = "UNKNOWN";
  }

  // Update the edge with new transformation configuration
  return {
    ...edge,
    data: {
      ...edge.data,
      transformation: transformationType,
      transformationConfig: {
        joinCondition,
        sourceFields,
        aggregationFunction,
        caseConditions,
        calculationExpression,
        defaultValue,
      },
    },
  };
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
  const existingMappingValues = new Set();

  existingEdges.forEach((edge) => {
    if (edge.data?.relationshipType === "field_mapping") {
      // Check by node IDs
      const key = `${edge.source}-${edge.data.sourceColumn}-${edge.target}-${edge.data.targetColumn}`;
      existingMappingKeys.add(key);

      // Also check by entity values to prevent duplicates when entity names change
      if (edge.data.sourceEntity && edge.data.targetEntity) {
        const valueKey = `${edge.data.sourceEntity}-${edge.data.sourceColumn}-${edge.data.targetEntity}-${edge.data.targetColumn}`;
        existingMappingValues.add(valueKey);
      }
    }
  });

  // Enhanced mapping configuration for different transformation types
  const mappingConfig = {
    // Direct mappings (1:1 field relationships)
    direct: {
      priority: 1,
      conditions: ["exact_match", "id_field_match", "semantic_match"],
    },
    // Concatenation mappings (multiple fields to single field)
    concatenation: {
      priority: 2,
      conditions: ["name_fields", "address_fields", "contact_fields"],
    },
    // Aggregation mappings (multiple records to single value)
    aggregation: {
      priority: 3,
      conditions: ["numeric_fields", "date_fields", "status_fields"],
    },
    // Case statement mappings (conditional transformations)
    case_statement: {
      priority: 4,
      conditions: ["status_fields", "type_fields", "category_fields"],
    },
    // Calculation mappings (mathematical operations)
    calculation: {
      priority: 5,
      conditions: ["numeric_fields", "financial_fields"],
    },
  };

  const idFields = [
    "id",
    "customer_id",
    "user_id",
    "order_id",
    "product_id",
    "account_id",
    "entity_id",
  ];

  // Enhanced mapping generation with transformation types
  curatedAttrs.forEach((curatedAttr) => {
    const curatedName = curatedAttr.name.toLowerCase();
    const isIdField = idFields.some(
      (idField) => curatedName === idField || curatedName.includes("id")
    );

    // Determine transformation type based on field characteristics
    let transformationType = "direct_mapping";
    let joinCondition = null;
    let sourceFields = [];
    let aggregationFunction = null;
    let caseConditions = [];
    let calculationExpression = null;
    let defaultValue = null;

    if (isIdField) {
      transformationType = "direct_mapping";
      // Generate join condition for ID fields
      joinCondition = `${curatedNode.data.value}.${curatedAttr.name} = ${consumptionNode.data.value}.${curatedAttr.name}`;
    } else if (curatedName.includes("name") || curatedName.includes("full")) {
      // Check for concatenation opportunities
      const nameFields = curatedAttrs.filter(
        (attr) =>
          attr.name.toLowerCase().includes("first") ||
          attr.name.toLowerCase().includes("last") ||
          attr.name.toLowerCase().includes("middle")
      );
      if (nameFields.length > 1) {
        transformationType = "concatenation";
        sourceFields = nameFields.map((attr) => attr.name);
        defaultValue = "";
      }
    } else if (
      curatedName.includes("amount") ||
      curatedName.includes("total") ||
      curatedName.includes("sum")
    ) {
      // Check for aggregation opportunities
      const numericFields = curatedAttrs.filter(
        (attr) =>
          attr.name.toLowerCase().includes("amount") ||
          attr.name.toLowerCase().includes("price") ||
          attr.name.toLowerCase().includes("cost")
      );
      if (numericFields.length > 1) {
        transformationType = "aggregation";
        aggregationFunction = "SUM";
        sourceFields = numericFields.map((attr) => attr.name);
      }
    } else if (curatedName.includes("status") || curatedName.includes("type")) {
      // Check for case statement opportunities
      transformationType = "case_statement";
      caseConditions = [
        { when: "active", then: "ACTIVE" },
        { when: "inactive", then: "INACTIVE" },
        { when: "pending", then: "PENDING" },
      ];
      defaultValue = "UNKNOWN";
    }

    if (isIdField) {
      // First try exact match
      let idFieldMatch = consumptionAttrs.find((consumptionAttr) => {
        const consumptionValue = consumptionAttr.value.toLowerCase();
        return (
          consumptionValue === curatedName ||
          (consumptionValue.includes("id") &&
            (consumptionValue === curatedName ||
              consumptionValue === "id" ||
              consumptionValue === curatedName.replace("_id", "id")))
        );
      });

      // If no exact match, try to find the best ID field match
      if (!idFieldMatch) {
        // Look for consumption attributes that contain the same entity type as the curated attribute
        const curatedEntityType = curatedName.replace(/_id$/, ""); // e.g., "contract_id" -> "contract"

        // Handle complex entity names like "silver_billingsystem_contract_id"
        const simpleCuratedEntityType = curatedEntityType.split("_").pop(); // Get the last part after splitting by underscore

        idFieldMatch = consumptionAttrs.find((consumptionAttr) => {
          const consumptionValue = consumptionAttr.value.toLowerCase();

          // Check if consumption field contains the same entity type
          if (
            consumptionValue.includes(curatedEntityType) &&
            consumptionValue.includes("id")
          ) {
            return true;
          }

          // Check if consumption field contains the simplified entity type
          if (
            consumptionValue.includes(simpleCuratedEntityType) &&
            consumptionValue.includes("id")
          ) {
            return true;
          }

          // Check for common ID field patterns
          if (consumptionValue === "id" || consumptionValue === "entity_id") {
            return true;
          }

          // Check if the consumption field name suggests it's the same entity type
          const consumptionEntityType = consumptionValue.replace(/_id$/, "");
          if (consumptionEntityType === curatedEntityType) {
            return true;
          }

          // Check if the consumption field name suggests it's the same simplified entity type
          if (consumptionEntityType === simpleCuratedEntityType) {
            return true;
          }

          return false;
        });

        if (idFieldMatch) {
          // Check if this mapping already exists by both ID and value
          const mappingKey = `${curatedNode.id}-${curatedAttr.name}-${consumptionNode.id}-${idFieldMatch.value}`;
          const mappingValueKey = `${curatedNode.data.value}-${curatedAttr.name}-${consumptionNode.data.value}-${idFieldMatch.value}`;

          if (
            !existingMappingKeys.has(mappingKey) &&
            !existingMappingValues.has(mappingValueKey)
          ) {
            const edge = {
              id: `auto-${curatedNode.id}-${curatedAttr.name}-${consumptionNode.id}-${idFieldMatch.value}`,
              source: curatedNode.id,
              sourceHandle: `${curatedNode.id}-${
                curatedAttr.value || curatedAttr.name
              }`,
              target: consumptionNode.id,
              targetHandle: `${consumptionNode.id}-${
                idFieldMatch.value || idFieldMatch.name
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
                targetColumn: idFieldMatch.value,
                sourceEntity: curatedNode.data.value, // Original entity name
                targetEntity: consumptionNode.data.value, // Original entity name
                sourceEntityLabel: curatedNode.data.label, // Current display name
                targetEntityLabel: consumptionNode.data.label, // Current display name
                transformation: transformationType,
                transformationConfig: {
                  joinCondition,
                  sourceFields,
                  aggregationFunction,
                  caseConditions,
                  calculationExpression,
                  defaultValue,
                },
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

      const exactNameMatch = consumptionAttrs.find(
        (consumptionAttr) =>
          consumptionAttr.value.toLowerCase() === curatedAttr.name.toLowerCase()
      );

      if (exactNameMatch) {
        // Check if this mapping already exists by both ID and value
        const mappingKey = `${curatedNode.id}-${curatedAttr.name}-${consumptionNode.id}-${exactNameMatch.value}`;
        const mappingValueKey = `${curatedNode.data.value}-${curatedAttr.name}-${consumptionNode.data.value}-${exactNameMatch.value}`;

        if (
          !existingMappingKeys.has(mappingKey) &&
          !existingMappingValues.has(mappingValueKey)
        ) {
          const edge = {
            id: `auto-${curatedNode.id}-${curatedAttr.name}-${consumptionNode.id}-${exactNameMatch.value}`,
            source: curatedNode.id,
            sourceHandle: `${curatedNode.id}-${
              curatedAttr.value || curatedAttr.name
            }`,
            target: consumptionNode.id,
            targetHandle: `${consumptionNode.id}-${
              exactNameMatch.value || exactNameMatch.name
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
              targetColumn: exactNameMatch.value,
              sourceEntity: curatedNode.data.value, // Original entity name
              targetEntity: consumptionNode.data.value, // Original entity name
              sourceEntityLabel: curatedNode.data.label, // Current display name
              targetEntityLabel: consumptionNode.data.label, // Current display name
              transformation: transformationType,
              transformationConfig: {
                joinCondition,
                sourceFields,
                aggregationFunction,
                caseConditions,
                calculationExpression,
                defaultValue,
              },
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
        const curatedName = curatedAttr.name.toLowerCase();

        // For ID fields, try to find semantic matches
        if (curatedName.includes("id") && consumptionValue.includes("id")) {
          // Extract entity types from both names
          const curatedEntityType = curatedName
            .replace(/_id$/, "")
            .replace(/^.*_/, "");
          const consumptionEntityType = consumptionValue
            .replace(/_id$/, "")
            .replace(/^.*_/, "");

          // Also try to extract the simplified entity type (last part after underscore)
          const simpleCuratedEntityType = curatedName
            .replace(/_id$/, "")
            .split("_")
            .pop();
          const simpleConsumptionEntityType = consumptionValue
            .replace(/_id$/, "")
            .split("_")
            .pop();

          // If both are ID fields, try to match by entity type
          if (curatedEntityType && consumptionEntityType) {
            if (curatedEntityType === consumptionEntityType) {
              return true;
            }

            // Check for common entity type patterns
            const commonPatterns = [
              { curated: "account", consumption: "account" },
              { curated: "contract", consumption: "account" }, // contract_id can map to account_id
              { curated: "customer", consumption: "customer" },
              { curated: "order", consumption: "order" },
              { curated: "product", consumption: "product" },
              { curated: "user", consumption: "user" },
              { curated: "subscriber", consumption: "subscriber" },
              { curated: "invoice", consumption: "invoice" },
              { curated: "payment", consumption: "payment" },
              { curated: "service", consumption: "service" },
              { curated: "device", consumption: "device" },
              // Add more specific mappings for common business scenarios
              { curated: "billing", consumption: "account" }, // billing system entities often map to account
              { curated: "salesforce", consumption: "account" }, // Salesforce entities often map to account
              { curated: "provisioning", consumption: "account" }, // Provisioning entities often map to account
            ];

            for (const pattern of commonPatterns) {
              if (
                curatedEntityType.includes(pattern.curated) &&
                consumptionEntityType.includes(pattern.consumption)
              ) {
                return true;
              }
            }
          }

          // Also try matching by simplified entity types
          if (simpleCuratedEntityType && simpleConsumptionEntityType) {
            if (simpleCuratedEntityType === simpleConsumptionEntityType) {
              return true;
            }

            // Check for common simplified entity type patterns
            const commonPatterns = [
              { curated: "account", consumption: "account" },
              { curated: "contract", consumption: "account" }, // contract_id can map to account_id
              { curated: "customer", consumption: "customer" },
              { curated: "order", consumption: "order" },
              { curated: "product", consumption: "product" },
              { curated: "user", consumption: "user" },
              { curated: "subscriber", consumption: "subscriber" },
              { curated: "invoice", consumption: "invoice" },
              { curated: "payment", consumption: "payment" },
              { curated: "service", consumption: "service" },
              { curated: "device", consumption: "device" },
              // Add more specific mappings for common business scenarios
              { curated: "billing", consumption: "account" }, // billing system entities often map to account
              { curated: "salesforce", consumption: "account" }, // Salesforce entities often map to account
              { curated: "provisioning", consumption: "account" }, // Provisioning entities often map to account
            ];

            for (const pattern of commonPatterns) {
              if (
                simpleCuratedEntityType.includes(pattern.curated) &&
                simpleConsumptionEntityType.includes(pattern.consumption)
              ) {
                return true;
              }
            }
          }
        }

        // General partial matching for non-ID fields
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

        // Check if this mapping already exists by both ID and value
        const mappingKey = `${curatedNode.id}-${curatedAttr.name}-${consumptionNode.id}-${bestMatch.value}`;
        const mappingValueKey = `${curatedNode.data.value}-${curatedAttr.name}-${consumptionNode.data.value}-${bestMatch.value}`;

        if (
          !existingMappingKeys.has(mappingKey) &&
          !existingMappingValues.has(mappingValueKey)
        ) {
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
              sourceEntity: curatedNode.data.value, // Original entity name
              targetEntity: consumptionNode.data.value, // Original entity name
              sourceEntityLabel: curatedNode.data.label, // Current display name
              targetEntityLabel: consumptionNode.data.label, // Current display name
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
  setExpandedCanvasHeader,
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

  // Offcanvas state for consumption entity actions
  const [showOffcanvas, setShowOffcanvas] = useState(false);
  const [offcanvasAction, setOffcanvasAction] = useState(null);
  const [offcanvasEntityData, setOffcanvasEntityData] = useState(null);

  // Persistent state for offcanvas data
  const [columnDescriptions, setColumnDescriptions] = useState({});
  const [viewRecordsData, setViewRecordsData] = useState({});

  // ETL state for column transformations
  const [etlModal, setEtlModal] = useState({
    open: false,
    column: null,
    entity: null,
  });

  // Handler for offcanvas actions
  const handleOffcanvasAction = useCallback(
    (action, data) => {
      switch (action) {
        case "columnDescription": {
          // Handle column description action
          if (data.column) {
            // Single column description
            // Save to persistent state
            const entityKey = `${data.entity.id}-${data.column.name}`;
            setColumnDescriptions((prev) => ({
              ...prev,
              [entityKey]: data.descriptions[data.column.name] || "",
            }));
          } else {
            // Multiple column descriptions
            // Save to persistent state
            const entityKey = data.entity.id;
            setColumnDescriptions((prev) => ({
              ...prev,
              [entityKey]: data.descriptions,
            }));
          }
          break;
        }
        case "viewRecords": {
          // Handle view records action
          // Save to persistent state
          const viewKey = data.entity.id;
          setViewRecordsData((prev) => ({
            ...prev,
            [viewKey]: data,
          }));
          break;
        }
        case "deleteEntity":
          // Handle delete entity action
          if (data.entityId && setNodes && setEdges) {
            setNodes((nds) => nds.filter((node) => node.id !== data.entityId));
            setEdges((eds) =>
              eds.filter(
                (edge) =>
                  edge.source !== data.entityId && edge.target !== data.entityId
              )
            );
          }
          break;
        default:
      }
    },
    [setNodes, setEdges]
  );

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
          // Expanding: add only the clicked entity, don't auto-expand parent entities
          newSet.add(entityId);
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
                value: silverEntity, // Preserve original name for mappings
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
                value: goldEntity, // Preserve original name for mappings
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
              (n) => n.data.value === mapping.silverEntity
            );
            const mappedGoldEntity = entityNameToFileName[mapping.c360Entity];
            const consumptionNode = dynamicNodes.find(
              (n) => n.data.value === mappedGoldEntity
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
                  sourceEntity: curatedNode.data.value, // Original entity name
                  targetEntity: consumptionNode.data.value, // Original entity name
                  sourceEntityLabel: curatedNode.data.label, // Current display name
                  targetEntityLabel: consumptionNode.data.label, // Current display name
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
              (n) => n.data.value === goldMapping.sourceEntity
            );
            const targetNode = dynamicNodes.find(
              (n) => n.data.value === goldMapping.targetEntity
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
                  sourceEntity: sourceNode.data.value, // Original entity name
                  targetEntity: targetNode.data.value, // Original entity name
                  sourceEntityLabel: sourceNode.data.label, // Current display name
                  targetEntityLabel: targetNode.data.label, // Current display name
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
                findHandleId(
                  sourceNode,
                  goldMapping.sourceAttribute,
                  sourceNode.data.isExpanded
                ) || `${sourceNode.id}-${goldMapping.sourceAttribute}-right`;
              const targetHandleId =
                findHandleId(
                  targetNode,
                  goldMapping.targetAttribute,
                  targetNode.data.isExpanded
                ) || `${targetNode.id}-${goldMapping.targetAttribute}-right`;

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
                  sourceEntity: sourceNode.data.value, // Original entity name
                  targetEntity: targetNode.data.value, // Original entity name
                  sourceEntityLabel: sourceNode.data.label, // Current display name
                  targetEntityLabel: targetNode.data.label, // Current display name
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

          // Update edge labels to reflect current entity names
          mappingEdges.forEach((edge) => {
            if (edge.data) {
              const sourceNode = dynamicNodes.find((n) => n.id === edge.source);
              const targetNode = dynamicNodes.find((n) => n.id === edge.target);
              if (sourceNode && targetNode) {
                edge.data.sourceEntityLabel = sourceNode.data.label;
                edge.data.targetEntityLabel = targetNode.data.label;
              }
            }
          });

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

  // Reposition canvas when entities are collapsed
  useEffect(() => {
    const timer = setTimeout(() => {
      // Check if we have any expanded entities
      const hasExpandedCurated = expandedCuratedEntities.size > 0;
      const hasExpandedConsumption = expandedConsumptionEntities.size > 0;

      // Only reposition if no entities are expanded
      if (!hasExpandedCurated && !hasExpandedConsumption && nodes.length > 0) {
        const reactFlowElement = document.querySelector(".react-flow");
        if (reactFlowElement && reactFlowElement.__reactFlowInstance) {
          const reactFlowInstance = reactFlowElement.__reactFlowInstance;

          // Simple repositioning
          reactFlowInstance.setViewport({
            x: -150, // Move left to center
            y: 0, // Keep at top
            zoom: 0.9,
          });
        }
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [expandedCuratedEntities, expandedConsumptionEntities, nodes]);

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

    // Reorder consumption nodes so related entities are positioned together
    const reorderedConsumptionNodes = [...visibleConsumptionNodes];

    // For each expanded entity, move related collapsed entities to be positioned after it
    expandedConsumptionEntities.forEach((expandedId) => {
      const relatedCollapsedEntities = reorderedConsumptionNodes.filter(
        (node) =>
          !expandedConsumptionEntities.has(node.id) && // Not expanded
          node.data.isConsumptionFile && // Is consumption entity
          edges.some(
            (
              edge // Has relationship with expanded entity
            ) =>
              (edge.data?.relationshipType === "field_mapping" ||
                edge.data?.relationshipType === "gold_to_gold_field") &&
              ((edge.source === expandedId && edge.target === node.id) ||
                (edge.target === expandedId && edge.source === node.id))
          )
      );

      // Remove related entities from their current positions
      relatedCollapsedEntities.forEach((relatedEntity) => {
        const index = reorderedConsumptionNodes.findIndex(
          (n) => n.id === relatedEntity.id
        );
        if (index > -1) {
          reorderedConsumptionNodes.splice(index, 1);
        }
      });

      // Find the expanded entity's position
      const expandedIndex = reorderedConsumptionNodes.findIndex(
        (n) => n.id === expandedId
      );
      if (expandedIndex > -1) {
        // Insert related entities after the expanded entity
        reorderedConsumptionNodes.splice(
          expandedIndex + 1,
          0,
          ...relatedCollapsedEntities
        );
      }
    });

    const visibleNodes = [
      ...visibleCuratedNodes, // Curated nodes mapped to expanded consumption entities + manually expanded
      ...reorderedConsumptionNodes, // Reordered consumption nodes with related entities grouped
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

      // Determine transformation type and configuration for the new mapping
      const sourceAttrs = sourceNode.data.attributes || [];
      const targetAttrs = targetNode.data.attributes || [];

      const sourceAttr = sourceAttrs.find((attr) => attr.name === sourceField);
      const targetAttr = targetAttrs.find((attr) => attr.name === targetField);

      let transformationType = "direct_mapping";
      let joinCondition = null;
      let sourceFields = [];
      let aggregationFunction = null;
      let caseConditions = [];
      let calculationExpression = null;
      let defaultValue = null;

      if (sourceAttr && targetAttr) {
        const sourceName = sourceAttr.name.toLowerCase();
        const targetName = targetAttr.name.toLowerCase();

        // Check for ID field relationships
        if (sourceName.includes("id") || targetName.includes("id")) {
          transformationType = "direct_mapping";
          joinCondition = `${sourceNode.data.value}.${sourceField} = ${targetNode.data.value}.${targetField}`;
        }
        // Check for name concatenation opportunities
        else if (sourceName.includes("name") || targetName.includes("name")) {
          const relatedNameFields = sourceAttrs.filter(
            (attr) =>
              attr.name.toLowerCase().includes("first") ||
              attr.name.toLowerCase().includes("last") ||
              attr.name.toLowerCase().includes("middle") ||
              attr.name.toLowerCase().includes("full")
          );
          if (relatedNameFields.length > 1) {
            transformationType = "concatenation";
            sourceFields = relatedNameFields.map((attr) => attr.name);
            defaultValue = "";
          }
        }
        // Check for numeric aggregation opportunities
        else if (
          sourceName.includes("amount") ||
          sourceName.includes("total") ||
          targetName.includes("amount") ||
          targetName.includes("total")
        ) {
          const numericFields = sourceAttrs.filter(
            (attr) =>
              attr.name.toLowerCase().includes("amount") ||
              attr.name.toLowerCase().includes("price") ||
              attr.name.toLowerCase().includes("cost") ||
              attr.name.toLowerCase().includes("total")
          );
          if (numericFields.length > 1) {
            transformationType = "aggregation";
            aggregationFunction = "SUM";
            sourceFields = numericFields.map((attr) => attr.name);
          }
        }
        // Check for status/category case statements
        else if (
          sourceName.includes("status") ||
          sourceName.includes("type") ||
          targetName.includes("status") ||
          targetName.includes("type")
        ) {
          transformationType = "case_statement";
          caseConditions = [
            { when: "active", then: "ACTIVE" },
            { when: "inactive", then: "INACTIVE" },
            { when: "pending", then: "PENDING" },
            { when: "completed", then: "COMPLETED" },
          ];
          defaultValue = "UNKNOWN";
        }
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
          sourceEntity: sourceNode.data.value,
          targetEntity: targetNode.data.value,
          sourceEntityLabel: sourceNode.data.label,
          targetEntityLabel: targetNode.data.label,
          transformation: transformationType,
          transformationConfig: {
            joinCondition,
            sourceFields,
            aggregationFunction,
            caseConditions,
            calculationExpression,
            defaultValue,
          },
          autoGenerated: false,
        },
      };

      setEdges((eds) => [...eds, newEdge]);
    },
    [nodes, setEdges, edges]
  );

  // Handle edge updates (when mappings are modified)
  const onEdgeUpdate = useCallback(
    (oldEdge, newConnection) => {
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id === oldEdge.id) {
            // Update the edge with new connection
            const updatedEdge = {
              ...edge,
              source: newConnection.source,
              target: newConnection.target,
              sourceHandle: newConnection.sourceHandle,
              targetHandle: newConnection.targetHandle,
            };

            // Update transformation configuration based on new connection
            const sourceNode = nodes.find((n) => n.id === newConnection.source);
            const targetNode = nodes.find((n) => n.id === newConnection.target);

            if (sourceNode && targetNode) {
              return updateMappingTransformation(
                updatedEdge,
                sourceNode,
                targetNode
              );
            }

            return updatedEdge;
          }
          return edge;
        })
      );
    },
    [nodes, setEdges]
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
    () =>
      createNodeTypes(
        setNodes,
        setEdges,
        edges,
        setOffcanvasEntityData,
        setOffcanvasAction,
        setShowOffcanvas,
        setExpandedCanvasHeader,
        setEtlModal
        // nodes
      ),
    [
      setNodes,
      setEdges,
      edges,
      setOffcanvasEntityData,
      setOffcanvasAction,
      setShowOffcanvas,
      setExpandedCanvasHeader,
      setEtlModal,
      // nodes,
    ]
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
          onEdgeUpdate={onEdgeUpdate}
          defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
          onInit={(reactFlowInstance) => {
            setTimeout(() => {
              // Simple approach: just set a basic centered position
              reactFlowInstance.setViewport({
                x: -200, // Move left to center
                y: 0, // Keep at top
                zoom: 0.9,
              });
            }, 100);
          }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
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

      {/* Consumption Entity Offcanvas */}
      <ConsumptionEntityOffcanvas
        show={showOffcanvas}
        onHide={() => setShowOffcanvas(false)}
        action={offcanvasAction}
        entityData={offcanvasEntityData}
        allNodes={nodes}
        edges={edges}
        onConfirmAction={handleOffcanvasAction}
        columnDescriptions={columnDescriptions}
        viewRecordsData={viewRecordsData}
      />

      {/* Column ETL Modal */}
      <ConsumptionColumnETLModal
        open={etlModal.open}
        handleClose={() => setEtlModal({ ...etlModal, open: false })}
        column={etlModal.column}
        entityColumns={
          etlModal.entity?.attributes?.map((attr) => attr.name) || []
        }
        onAcceptCode={async (code) => {
          try {
            if (code.isConsumptionEntity) {
              // Save consumption ETL transformation to database
              const response = await axios.post("/api/consumption-etl/save", {
                entityName: code.entityName,
                columnName: code.columnName,
                transformationType: "nlp",
                nlpDescription: code.nlpDescription,
                sqlCode: code.sqlCode,
                pysparkCode: code.pysparkCode,
                entityColumns: code.entityColumns,
                createdBy: "system",
                notes: `ETL transformation accepted for ${code.entityName} column ${code.columnName}`,
                metadata: {
                  source: "etl_generation",
                  entityType: "consumption",
                  acceptedVia: "consumption_canvas",
                },
              });

              if (response.data.success) {
                alert(
                  `ETL transformation for ${code.entityName} has been saved successfully!`
                );
              } else {
                alert("Failed to save ETL transformation. Please try again.");
              }
            } else {
              // Handle curated entity transformations (existing logic)
            }
          } catch (error) {
            // Provide more specific error messages
            if (error.code === "ERR_NETWORK") {
              alert(
                "Network error: Backend server is not accessible. Please ensure the backend is running."
              );
            } else if (error.response?.status === 404) {
              alert(
                "404 Error: The endpoint /api/consumption-etl/save was not found. Please check if the backend routes are properly configured."
              );
            } else if (error.response?.status === 500) {
              alert(
                "Server error: Backend encountered an error. Please check the backend logs."
              );
            } else {
              alert(`Failed to save ETL transformation: ${error.message}`);
            }
          }

          setEtlModal({ ...etlModal, open: false });
        }}
      />
    </div>
  );
}

export default ConsumptionCanvasEmbedded;
