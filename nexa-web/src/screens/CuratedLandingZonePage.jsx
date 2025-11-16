/**
 * CuratedLandingZonePage - Manages the curated data landing zone
 *
 * This component handles:
 * - Entity schema management and mapping
 * - Artifact generation (DDL, DML, and Transformations)
 * - GitHub integration for artifact version control
 * - NLP artifacts (transformations) integration with DDL/DML artifacts
 *
 * Key Features:
 * - Generates DDL (Data Definition Language) artifacts
 * - Generates DML (Data Manipulation Language) artifacts
 * - Integrates accepted NLP artifacts (transformations) into the artifact generation pipeline
 * - Pushes all artifacts (DDL, DML, and Transformations) to GitHub
 * - Provides side-by-side diff views for all artifact types
 */

import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import aiIcon from "../assets/ai-icon.svg";
import {
  BiSearch,
  BiFilter,
  BiPencil,
  BiTrash,
  BiShow,
  BiChevronUp,
  BiSolidData,
  BiChevronRight,
  BiChevronDown,
  BiExpandVertical,
  BiCopyAlt,
  BiGitBranch,
  BiCheckCircle,
} from "react-icons/bi";
import {
  Image,
  Button,
  Form,
  Table,
  OverlayTrigger,
  Tooltip,
  Modal,
  InputGroup,
  Badge,
  Collapse,
  Accordion,
  Alert,
  Card,
  Row,
  Col,
} from "react-bootstrap";
import axios from "axios";
import EditEntityMappingsPage from "./EditEntityMappingsPage";
import ColumnETLModal from "../components/ColumnETLModal";
import NLPArtifactsManager from "../components/NLPArtifactsManager";

function CuratedLandingZonePage() {
  const location = useLocation();
  const { ingestion_type, selectedSources } = location.state;

  const navigate = useNavigate();
  const inputRef = useRef(null);
  // Core data state
  const [entities, setEntities] = useState([]);
  const [rawEntities, setRawEntities] = useState([]);
  const [curatedEntities, setCuratedEntities] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileData, setFileData] = useState([]);
  const [curatedFileStatus, setCuratedFileStatus] = useState({});

  // UI state
  const [editingEntity, setEditingEntity] = useState(null);
  const [newProcessedName, setNewProcessedName] = useState("");
  const [inputValues, setInputValues] = useState({});
  const [viewingRecords, setViewingRecords] = useState(null);
  const [sampleRecords, setSampleRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsError, setRecordsError] = useState("");
  const [debugInfo, setDebugInfo] = useState({});
  const [openRows, setOpenRows] = useState({});
  const [isLoadingSchemas, setIsLoadingSchemas] = useState(false);

  // Auto-mapping state
  const [autoMappedEntities, setAutoMappedEntities] = useState(new Set());
  const [isAutoMapping, setIsAutoMapping] = useState(false);
  const [autoMappingSuccess, setAutoMappingSuccess] = useState(null);
  const [autoMappingProgress, setAutoMappingProgress] = useState({
    current: 0,
    total: 0,
    currentEntity: "",
  });

  // Search and pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [entitiesPerPage] = useState(15);
  const [sortBy, setSortBy] = useState("worked_upon");

  // Modal states
  const [editNameModal, setEditNameModal] = useState({
    open: false,
    entityIndex: null,
    newName: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [availableCuratedNames, setAvailableCuratedNames] = useState([]);
  const [rawAttributes, setRawAttributes] = useState([]);

  // Pagination
  const [totalEntities, setTotalEntities] = useState(0);
  const totalPages = Math.ceil(totalEntities / entitiesPerPage);
  const indexOfLastEntity = currentPage * entitiesPerPage;
  const indexOfFirstEntity = indexOfLastEntity - entitiesPerPage;
  const currentEntities = entities;

  useEffect(() => {
    console.log("ingestion_type:", ingestion_type);
    console.log("selectedSources:", selectedSources);
    getEntitySchemas(); // fetch all entities from database
  }, [ingestion_type, selectedSources]);

  const getEntitySchemas = async () => {
    const response = await axios.get("/api/schema-master/all-schemas", {
      params: { ingestion_type, sourceIds: selectedSources },
    });
    console.log("response:", response);
  };

  // Debounce search term to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to first page when debounced search term changes and refetch data
  useEffect(() => {
    setCurrentPage(1);
    fetchSchemasFromDatabase(1, entitiesPerPage, debouncedSearchTerm, sortBy);
  }, [debouncedSearchTerm, sortBy]);

  // Refetch data when page changes
  useEffect(() => {
    fetchSchemasFromDatabase(
      currentPage,
      entitiesPerPage,
      debouncedSearchTerm,
      sortBy
    );
  }, [currentPage]);

  // Function to fetch control columns with mock LLM descriptions
  const fetchControlColumnsWithDescriptions = async () => {
    try {
      // Mock LLM call to get control columns with descriptions
      const response = await axios.get("/api/control-columns/descriptions");
      return response.data.controlColumns || [];
    } catch (error) {
      // Fallback control columns with mock LLM descriptions
      return [
        {
          name: "_ingest_timestamp",
          description:
            "Records when data was ingested into the system. Automatically populated by the data pipeline.",
          llmGenerated: true,
          llmResponse:
            "This column tracks the timestamp when data was first ingested into our data lake. It's essential for data lineage and audit trails.",
        },
        {
          name: "_source_system",
          description:
            "Identifies the source system that provided the data. Used for data lineage tracking.",
          llmGenerated: true,
          llmResponse:
            "This field identifies the originating system that provided the data. Critical for data governance and source tracking.",
        },
        {
          name: "_record_status",
          description:
            "Status after validation (valid/quarantined/error). Indicates data quality assessment.",
          llmGenerated: true,
          llmResponse:
            "This column indicates the validation status of each record. Values include 'valid', 'quarantined', or 'error' based on data quality checks.",
        },
        {
          name: "_update_timestamp",
          description:
            "Last update time in the silver/curated layer. Tracks when the record was last modified.",
          llmGenerated: true,
          llmResponse:
            "Tracks the last modification timestamp in the curated layer. Important for change tracking and data freshness monitoring.",
        },
        {
          name: "_batch_id",
          description:
            "Associates records with a specific processing batch. Used for batch processing and error tracking.",
          llmGenerated: true,
          llmResponse:
            "Links records to specific processing batches. Essential for batch processing, error tracking, and reprocessing workflows.",
        },
        {
          name: "_created_by",
          description:
            "Process or user that created the record. Tracks data origin and responsibility.",
          llmGenerated: true,
          llmResponse:
            "Identifies the process or user responsible for creating this record. Important for accountability and audit trails.",
        },
        {
          name: "_updated_by",
          description:
            "Process or user that last updated the record. Maintains audit trail of changes.",
          llmGenerated: true,
          llmResponse:
            "Tracks who or what process last modified the record. Critical for maintaining complete audit trails of data changes.",
        },
      ];
    }
  };

  // Function to create automatic 1:1 mappings
  const createAutoMappings = async (entityName, schemaAttributes) => {
    try {
      setIsAutoMapping(true);

      // Extract column names from schema attributes
      const columns = schemaAttributes.map((attr) =>
        typeof attr === "string" ? attr : attr.name
      );

      // Get control columns with descriptions
      const controlColumns = await fetchControlColumnsWithDescriptions();

      // Create 1:1 mappings for all columns
      const mappings = [
        // Raw to curated mappings (1:1)
        ...columns.map((column) => ({
          raw: column,
          curated: column,
          autogenerated: true,
          llmGenerated: true,
          llmResponse: `Automatically mapped ${column} from raw to curated layer with 1:1 relationship. This column appears to be a standard business field that should be preserved as-is.`,
        })),
        // Control columns (entity-level metadata)
        ...controlColumns.map((controlCol) => ({
          raw: "", // No raw column mapping for control columns
          curated: controlCol.name,
          autogenerated: true,
          isControlColumn: true,
          isEntityLevel: true,
          llmGenerated: true,
          llmResponse: controlCol.llmResponse,
        })),
      ];

      // Create transformations object
      const transformations = {
        entityName: entityName,
        curatedEntityName: entityName.replace("raw.", "curated."),
        rawAttributes: columns,
        curatedAttributes: [
          ...columns,
          "updated_at",
          "version",
          "is_deleted",
          ...controlColumns.map((col) => col.name),
        ],
        mappings: mappings,
        columnRules: {},
        operatorRules: {},
        concatenationRules: [],
        entityNLPRules: [],
        columnDescriptions: {
          ...Object.fromEntries(
            controlColumns.map((col) => [col.name, col.description])
          ),
        },
        autoGenerated: true,
        generatedBy: "LLM",
        generationTimestamp: new Date().toISOString(),
      };

      // Save transformations to backend
      const response = await axios.post("/api/transformations/save", {
        entityName: entityName,
        transformations: transformations,
      });

      // Mark entity as auto-mapped
      setAutoMappedEntities((prev) => new Set([...prev, entityName]));

      // Show success notification
      setAutoMappingSuccess({
        entityName: entityName,
        message: `Successfully created intelligent mappings for ${entityName.replace(
          "raw.",
          ""
        )} with ${columns.length} columns and ${
          controlColumns.length
        } control columns.`,
      });

      // Clear success notification after 5 seconds
      setTimeout(() => setAutoMappingSuccess(null), 5000);

      return transformations;
    } catch (error) {
      throw error;
    } finally {
      setIsAutoMapping(false);
    }
  };

  const toggleRow = async (idx) => {
    const entity = entities[idx];
    if (!entity) return;

    const isExpanding = !openRows[idx];

    // Simply toggle the row expansion - auto-mappings are created on page load
    setOpenRows((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };
  // Additional modal states
  const [etlModal, setEtlModal] = useState({ open: false, column: null });
  const [entityArtifacts, setEntityArtifacts] = useState({});

  const handleAcceptEntityNLP = async (nlpData) => {
    try {
      // Convert curated entity name to raw entity name for consistent storage
      // e.g., "curated.users" -> "users"
      const rawEntityName = nlpData.entityName.replace("curated.", "");

      // Save NLP artifact to database and create file (separate from entity artifacts)
      try {
        const response = await axios.post("/api/nlp-artifacts", {
          entityName: rawEntityName,
          curatedEntityName: nlpData.entityName,
          nlpDescription: nlpData.nlpDescription || "",
          sqlCode: nlpData.sqlCode || "",
          pysparkCode: nlpData.pysparkCode || "",
          entityColumns: nlpData.entityColumns || [],
          createdBy: "system",
          notes: `NLP artifact accepted for ${nlpData.entityName}`,
          metadata: {
            source: "nlp_generation",
            entityType: "curated",
            acceptedVia: "curated_landing_zone_page",
          },
        });

        if (response.data.success) {
          // console.log("NLP artifact saved successfully:", response.data.data);
        } else {
          console.warn("Failed to save NLP artifact:", response.data.message);
        }
      } catch (dbError) {
        console.error("Error saving NLP artifact to database:", dbError);
        // Continue with the process even if database save fails
      }

      // Show success message
      alert(
        `Entity NLP transformation for ${nlpData.entityName} has been saved to accepted artifacts folder!`
      );
    } catch (error) {
      console.error("Error accepting entity NLP:", error);
      throw error;
    }
  };

  // Artifacts and GitHub state
  const [artifactsModal, setArtifactsModal] = useState({
    open: false,
    artifacts: null,
  });
  const [diffModal, setDiffModal] = useState({
    open: false,
    diff: null,
    entityName: "",
  });
  const [isGeneratingArtifacts, setIsGeneratingArtifacts] = useState(false);
  const [isPushingToGitHub, setIsPushingToGitHub] = useState(false);
  const [githubConnection, setGithubConnection] = useState(null);
  const [allDiffs, setAllDiffs] = useState({});
  const [isGeneratingAllDiffs, setIsGeneratingAllDiffs] = useState(false);
  const [isPushingAllToGitHub, setIsPushingAllToGitHub] = useState(false);
  const [allDiffsModal, setAllDiffsModal] = useState({
    open: false,
    diffs: {},
  });
  const [successDialog, setSuccessDialog] = useState({
    open: false,
    message: null,
    commitUrl: null,
    repositoryUrl: null,
    prUrl: null,
  });

  // NLP Artifacts state
  const [showNLPArtifactsModal, setShowNLPArtifactsModal] = useState(false);
  const [acceptedNLPArtifacts, setAcceptedNLPArtifacts] = useState([]);
  const [isLoadingNLPArtifacts, setIsLoadingNLPArtifacts] = useState(false);

  // Load persisted data from localStorage on component mount
  useEffect(() => {
    try {
      const persistedStatus = localStorage.getItem("curatedFileStatus");
      if (persistedStatus) {
        const parsedStatus = JSON.parse(persistedStatus);
        setCuratedFileStatus(parsedStatus);
      }
    } catch (error) {}
  }, []);

  useEffect(() => {
    try {
      const persistedAutoMapped = localStorage.getItem("autoMappedEntities");
      if (persistedAutoMapped) {
        const parsedAutoMapped = JSON.parse(persistedAutoMapped);
        setAutoMappedEntities(new Set(parsedAutoMapped));
      }
    } catch (error) {}
  }, []);

  useEffect(() => {
    try {
      const persistedArtifacts = localStorage.getItem("entityArtifacts");
      if (persistedArtifacts) {
        const parsedArtifacts = JSON.parse(persistedArtifacts);
        setEntityArtifacts(parsedArtifacts);
      }
    } catch (error) {}
  }, []);

  // Persist data to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(
        "curatedFileStatus",
        JSON.stringify(curatedFileStatus)
      );
    } catch (error) {}
  }, [curatedFileStatus]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "autoMappedEntities",
        JSON.stringify([...autoMappedEntities])
      );
    } catch (error) {}
  }, [autoMappedEntities]);

  useEffect(() => {
    try {
      localStorage.setItem("entityArtifacts", JSON.stringify(entityArtifacts));
    } catch (error) {}
  }, [entityArtifacts]);

  // Main data fetching effect
  useEffect(() => {
    const fetchData = async () => {
      await fetchSchemasFromDatabase(
        currentPage,
        entitiesPerPage,
        debouncedSearchTerm,
        sortBy
      );

      const stateData = location.state;
      if (stateData) {
        if (stateData.curatedFileGenerated && stateData.curatedFileInfo) {
          const entityName = stateData.curatedFileInfo?.entityName;
          if (entityName) {
            setCuratedFileStatus((prev) => ({
              ...prev,
              [entityName]: {
                generated: true,
                fileInfo: stateData.curatedFileInfo,
                timestamp: new Date().toISOString(),
              },
            }));
          }
        }

        if (stateData.nameUpdated && stateData.curatedEntities) {
          setCuratedEntities(stateData.curatedEntities);
          setEntities((prev) =>
            prev.map((entity, idx) => ({
              ...entity,
              curated: stateData.curatedEntities[idx] || entity.curated,
            }))
          );
        }
      }
    };

    fetchData();
  }, [location.state, sortBy]);

  // Merge incoming status with current on navigation
  useEffect(() => {
    const stateData = location.state;
    if (stateData && stateData.curatedFileStatus) {
      setCuratedFileStatus((prev) => ({
        ...prev,
        ...stateData.curatedFileStatus,
      }));
    }
  }, [location.state]);

  // Clean up orphaned status entries
  useEffect(() => {
    if (rawEntities.length > 0) {
      setCuratedFileStatus((prev) => {
        const updated = { ...prev };
        let hasChanges = false;

        Object.keys(updated).forEach((entityName) => {
          if (!rawEntities.includes(entityName)) {
            delete updated[entityName];
            hasChanges = true;
          }
        });

        return hasChanges ? updated : prev;
      });
    }
  }, [entities, rawEntities, curatedEntities]);

  // Initialize GitHub connection and NLP artifacts
  useEffect(() => {
    checkGitHubConnection();
    fetchAcceptedNLPArtifacts();
  }, []);

  // Helper function to get schema from entity data (from database)
  const getEntitySchema = (entity) => {
    // Find the entity in our entities array which contains schema data
    const entityData = entities.find((e) => e.raw === entity.raw);

    if (entityData && entityData.schemaAttributes) {
      return {
        rawAttributes: entityData.schemaAttributes,
        dataTypes: entityData.schemaMetadata?.dataTypes || {},
        constraints: entityData.schemaMetadata?.constraints || {},
        schemaMetadata: entityData.schemaMetadata || {},
      };
    }

    // Fallback to default schema if no schema data found
    return {
      rawAttributes: ["id", "name", "type", "created_at"],
      dataTypes: {
        id: "VARCHAR(50)",
        name: "VARCHAR(255)",
        type: "VARCHAR(100)",
        created_at: "TIMESTAMP",
      },
      constraints: {
        id: ["PRIMARY KEY", "NOT NULL"],
        name: ["NOT NULL"],
      },
    };
  };

  // Helper function to extract complete entity schema for artifact generation
  const extractEntitySchema = async (entity) => {
    const entityName = entity.raw.replace("raw.", "");
    const curatedEntityName = entity.curated.replace("curated.", "");

    // Get the basic schema data
    const schemaData = getEntitySchema(entity);

    // Extract raw attributes (handle both string arrays and object arrays)
    const rawAttributes = Array.isArray(schemaData.rawAttributes)
      ? schemaData.rawAttributes.map((attr) =>
          typeof attr === "string" ? attr : attr.name
        )
      : ["id", "name", "type", "created_at"];

    // Create curated attributes (raw + control columns)
    const curatedAttributes = [
      ...rawAttributes,
      "updated_at",
      "version",
      "is_deleted",
      "_ingest_timestamp",
      "_source_system",
      "_record_status",
      "_update_timestamp",
      "_batch_id",
      "_created_by",
      "_updated_by",
    ];

    // Create mappings (1:1 mapping for now, can be enhanced later)
    const mappings = rawAttributes.map((attr) => ({
      raw: attr,
      curated: attr,
      transformation: "direct_mapping",
    }));

    // Try to fetch saved transformations to get new columns and other transformation data
    let savedTransformations = null;
    try {
      const response = await axios.get(
        `/api/transformations/${encodeURIComponent(entity.raw)}`
      );
      if (response.data && response.data.transformations) {
        savedTransformations = response.data.transformations;
      }
    } catch (error) {
      // No saved transformations found, use defaults
      console.error(
        `No saved transformations found for ${entity.raw}:`,
        error.message
      );
    }

    // Merge saved transformations with basic schema
    const finalMappings = savedTransformations?.mappings || mappings;
    const finalCuratedAttributes =
      savedTransformations?.curatedAttributes || curatedAttributes;
    const newColumns = savedTransformations?.newColumns || [];
    const columnRules = savedTransformations?.columnRules || {};
    const operatorRules = savedTransformations?.operatorRules || {};
    const concatenationRules = savedTransformations?.concatenationRules || [];
    const entityNLPRules = savedTransformations?.entityNLPRules || [];
    const columnDescriptions = savedTransformations?.columnDescriptions || {};

    return {
      entityName: entityName,
      curatedEntityName: curatedEntityName,
      rawAttributes: rawAttributes,
      curatedAttributes: finalCuratedAttributes,
      mappings: finalMappings,
      dataTypes: schemaData.dataTypes || {},
      constraints: schemaData.constraints || {},
      newColumns: newColumns,
      columnRules: columnRules,
      operatorRules: operatorRules,
      concatenationRules: concatenationRules,
      entityNLPRules: entityNLPRules,
      columnDescriptions: columnDescriptions,
    };
  };

  // Auto-refresh curated file status periodically
  useEffect(() => {
    if (entities.length === 0) return;

    const initialCheck = async () => {
      await checkExistingCuratedFiles();
    };

    const getRefreshInterval = () => {
      const completedCount = Object.keys(curatedFileStatus).filter(
        (key) => curatedFileStatus[key]?.generated
      ).length;
      const totalCount = entities.length;

      return completedCount === totalCount && totalCount > 0 ? 120000 : 30000;
    };

    const intervalId = setInterval(async () => {
      await checkExistingCuratedFiles();
    }, getRefreshInterval());

    initialCheck();
    return () => clearInterval(intervalId);
  }, [entities, curatedFileStatus]);

  // Function to check for existing curated files in S3
  const checkExistingCuratedFiles = async () => {
    if (isRefreshingStatus) return;

    try {
      setIsRefreshingStatus(true);

      const response = await axios.get("/api/curated/files");
      const curatedFiles = response.data?.files || [];

      const updatedStatus = { ...curatedFileStatus };
      let hasChanges = false;

      entities.forEach((entity) => {
        const entityBaseName = entity.raw.replace("raw.", "");
        const curatedFileName = `${entityBaseName}.csv`;

        const existingFile = curatedFiles.find(
          (file) =>
            file.key === `curated/${curatedFileName}` ||
            file.key.endsWith(`/${curatedFileName}`)
        );

        if (existingFile && !updatedStatus[entity.raw]?.generated) {
          updatedStatus[entity.raw] = {
            generated: true,
            fileInfo: {
              entityName: entity.raw,
              curatedEntityName: entity.curated,
              curatedFileKey: existingFile.key,
              curatedFileLocation: existingFile.location || existingFile.url,
              fileSize: existingFile.size || 0,
              recordCount: existingFile.recordCount || 0,
              generatedAt:
                existingFile.lastModified || new Date().toISOString(),
              transformationsApplied: {
                nlpTransformations: 0,
                dqValidations: 0,
                operatorFilters: 0,
                newColumns: 0,
                concatenations: 0,
              },
              entityLevelMetadata: {
                controlColumns: [
                  "_ingest_timestamp",
                  "_source_system",
                  "_record_status",
                  "_update_timestamp",
                  "_batch_id",
                  "_created_by",
                  "_updated_by",
                ],
                controlColumnsCount: 7,
                note: "Control columns are preserved in mappings for data lineage but not included in curated file",
              },
            },
            timestamp: existingFile.lastModified || new Date().toISOString(),
            source: "existing_file",
            fileSize: existingFile.size,
            lastModified: existingFile.lastModified,
          };
          hasChanges = true;
        }
      });

      if (hasChanges) {
        setCuratedFileStatus(updatedStatus);
      }
    } catch (error) {
      // Don't fail the entire process if this check fails
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  const [showMappedModal, setShowMappedModal] = useState(false);

  const handleEntityNameUpdate = (updateData) => {
    setEntities((prevEntities) =>
      prevEntities.map((entity) =>
        entity.raw === updateData.entityName
          ? { ...entity, curated: updateData.newCuratedName }
          : entity
      )
    );
  };

  const handleChangeMapping = (idx) => {
    if (!entities[idx]) return;

    const currentProcessedName = entities[idx].curated;
    const availableNames = curatedEntities.filter(
      (name) => name !== null && name !== undefined
    );
    setAvailableCuratedNames(availableNames);
    setEditingEntity(idx);
    setNewProcessedName(currentProcessedName);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.value = currentProcessedName;
      }
    }, 0);

    setShowMappedModal(true);
  };

  const handleSaveMapping = async (idx) => {
    const entity = entities[idx];
    const newProcessedNameValue = inputValues[idx] || entities[idx].curated;

    const updatedEntities = [...entities];
    updatedEntities[idx].curated = newProcessedNameValue;
    setEntities(updatedEntities);

    const updatedCuratedEntities = [...curatedEntities];
    updatedCuratedEntities[idx] = newProcessedNameValue;
    setCuratedEntities(updatedCuratedEntities);

    setEditingEntity(null);
    setNewProcessedName("");

    setInputValues((prev) => {
      const newValues = { ...prev };
      delete newValues[idx];
      return newValues;
    });
  };

  const handleDeleteEntity = (idx) => {
    if (
      window.confirm(
        `Are you sure you want to delete ${entities[idx].curated}?`
      )
    ) {
      const entityToDelete = entities[idx];
      const updatedEntities = entities.filter((_, i) => i !== idx);
      setEntities(updatedEntities);

      setCuratedFileStatus((prev) => {
        const updatedStatus = { ...prev };
        delete updatedStatus[entityToDelete.raw];
        return updatedStatus;
      });
    }
  };

  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  const handleEditEntityName = (idx) => {
    setEditNameModal({
      open: true,
      entityIndex: idx,
      newName: entities[idx].curated.replace("curated.", ""),
    });
    setShowEditModal(true);
  };

  const saveEntityName = () => {
    if (!editNameModal.newName.trim()) {
      alert("Please enter a valid entity name.");
      return;
    }

    const newCuratedName = `curated.${editNameModal.newName.trim()}`;

    const nameExists = entities.some(
      (entity, index) =>
        index !== editNameModal.entityIndex && entity.curated === newCuratedName
    );

    if (nameExists) {
      alert(
        "An entity with this name already exists. Please choose a different name."
      );
      return;
    }

    setIsEditing(true);

    const updatedEntities = entities.map((entity, index) =>
      index === editNameModal.entityIndex
        ? { ...entity, curated: newCuratedName }
        : entity
    );

    const updatedCuratedEntities = curatedEntities.map((entity, index) =>
      index === editNameModal.entityIndex ? newCuratedName : entity
    );

    setEntities(updatedEntities);
    setCuratedEntities(updatedCuratedEntities);

    setEditNameModal({ open: false, entityIndex: null, newName: "" });
    setIsEditing(false);
  };

  // Check GitHub connection
  const checkGitHubConnection = async () => {
    try {
      const response = await axios.get("/api/github/active");

      if (response.data.success && response.data.data) {
        setGithubConnection(response.data.data);
      } else {
        setGithubConnection(null);
      }
    } catch (error) {
      setGithubConnection(null);
    }
  };

  // Fetch accepted NLP artifacts
  const fetchAcceptedNLPArtifacts = async () => {
    try {
      setIsLoadingNLPArtifacts(true);
      const response = await axios.get(
        "/api/nlp-artifacts?status=accepted&limit=100"
      );

      if (response.data.success) {
        const artifacts =
          response.data.data.artifacts || response.data.data || [];
        setAcceptedNLPArtifacts(artifacts);
      } else {
        console.error("Failed to fetch NLP artifacts:", response.data.message);
        setAcceptedNLPArtifacts([]);
      }
    } catch (error) {
      console.error("Error fetching NLP artifacts:", error);
      setAcceptedNLPArtifacts([]);
    } finally {
      setIsLoadingNLPArtifacts(false);
    }
  };

  // Generate artifacts for all entities (DDL, DML, and Transformations)
  const generateAllArtifacts = async () => {
    if (entities.length === 0) {
      alert("No entities found to generate artifacts for.");
      return;
    }

    setIsGeneratingArtifacts(true);
    try {
      const allArtifacts = {};

      // Generate artifacts for each entity
      for (const entity of entities) {
        const entityName = entity.raw.replace("raw.", "");
        const curatedEntityName = entity.curated.replace("curated.", "");

        // Extract schema and attributes from entity (now async)
        const schemaData = await extractEntitySchema(entity);

        // Create transformations object with schema-based attributes
        const transformations = {
          entityName: schemaData.entityName,
          curatedEntityName: schemaData.curatedEntityName,
          rawAttributes: schemaData.rawAttributes,
          curatedAttributes: schemaData.curatedAttributes,
          mappings: schemaData.mappings,
          dataTypes: schemaData.dataTypes,
          constraints: schemaData.constraints,
          newColumns: schemaData.newColumns,
          columnRules: schemaData.columnRules,
          operatorRules: schemaData.operatorRules,
          concatenationRules: schemaData.concatenationRules,
          entityNLPRules: schemaData.entityNLPRules,
          columnDescriptions: schemaData.columnDescriptions,
        };

        // Call the backend to generate artifacts
        const response = await axios.post("/api/artifacts/generate", {
          entityName: entityName,
          curatedEntityName: curatedEntityName,
          transformations: transformations,
        });

        // Use backend-generated artifacts
        const backendArtifacts = response.data.data.artifacts;

        allArtifacts[entityName] = {
          sql: backendArtifacts?.sql || "",
          pyspark: backendArtifacts?.pyspark || "",
          dmlSql: backendArtifacts?.dmlSql || "",
          dmlPySpark: backendArtifacts?.dmlPySpark || "",
          // Include all other backend-generated artifacts
          // ...backendArtifacts,
        };
      }

      // Fetch accepted NLP artifacts to include transformations
      await fetchAcceptedNLPArtifacts();

      // Merge NLP artifacts with generated artifacts for entities that have them
      acceptedNLPArtifacts.forEach((nlpArtifact) => {
        const entityName = nlpArtifact.entityName;
        if (allArtifacts[entityName]) {
          // Add NLP artifacts to the existing artifacts
          allArtifacts[entityName] = {
            ...allArtifacts[entityName],
            nlpSql: nlpArtifact.sqlCode || "",
            nlpPySpark: nlpArtifact.pysparkCode || "",
            nlpDescription: nlpArtifact.nlpDescription || "",
            nlpColumns: nlpArtifact.entityColumns || [],
            nlpNotes: nlpArtifact.notes || "",
            nlpAcceptedAt: nlpArtifact.acceptedAt || "",
          };
        } else {
          // Create new entry for entities that only have NLP artifacts
          allArtifacts[entityName] = {
            sql: "",
            pyspark: "",
            dmlSql: "",
            dmlPySpark: "",
            nlpSql: nlpArtifact.sqlCode || "",
            nlpPySpark: nlpArtifact.pysparkCode || "",
            nlpDescription: nlpArtifact.nlpDescription || "",
            nlpColumns: nlpArtifact.entityColumns || [],
            nlpNotes: nlpArtifact.notes || "",
            nlpAcceptedAt: nlpArtifact.acceptedAt || "",
          };
        }
      });

      setArtifactsModal({ open: true, artifacts: allArtifacts });
    } catch (error) {
      alert("Failed to generate artifacts. Please try again.");
    } finally {
      setIsGeneratingArtifacts(false);
    }
  };

  // Generate diffs for all entities (DDL, DML, and Transformations)
  const generateAllDiffs = async () => {
    if (!githubConnection) {
      alert("Please configure GitHub connection in settings first.");
      return;
    }

    setIsGeneratingAllDiffs(true);
    setAllDiffs({});

    // Initialize progress
    const totalEntities = entities.length;

    try {
      // Prepare all entities data for batch processing
      const entitiesData = await Promise.all(
        entities.map(async (entity) => {
          const entityName = entity.raw.replace("raw.", "");
          const schemaData = await extractEntitySchema(entity);

          return {
            entityName: entityName,
            transformations: {
              entityName: schemaData.entityName,
              curatedEntityName: schemaData.curatedEntityName,
              rawAttributes: schemaData.rawAttributes,
              curatedAttributes: schemaData.curatedAttributes,
              mappings: schemaData.mappings,
              dataTypes: schemaData.dataTypes,
              constraints: schemaData.constraints,
              newColumns: schemaData.newColumns,
              columnRules: schemaData.columnRules,
              operatorRules: schemaData.operatorRules,
              concatenationRules: schemaData.concatenationRules,
              entityNLPRules: schemaData.entityNLPRules,
              columnDescriptions: schemaData.columnDescriptions,
            },
          };
        })
      );

      const githubConfig = {
        repositoryUrl: githubConnection.repositoryUrl,
        branch: githubConnection.branch,
        username: githubConnection.username,
        password: githubConnection.password,
      };

      // Fetch accepted NLP artifacts to include in diffs
      await fetchAcceptedNLPArtifacts();

      // Call the new optimized endpoint that processes all entities in parallel
      const response = await axios.post("/api/artifacts/generate-all-diffs", {
        entities: entitiesData,
        githubConfig: githubConfig,
        folderPath: "curated",
      });

      const {
        diffs: allDiffs,
        artifacts: allArtifacts,
        summary,
      } = response.data.data;

      // Transform the response to match the expected format
      const transformedDiffs = {};

      for (const [entityName, diffData] of Object.entries(allDiffs)) {
        // Find the original entity to get schema data
        const entity = entities.find(
          (e) => e.raw.replace("raw.", "") === entityName
        );
        // Since extractEntitySchema is now async, we'll need to handle this differently
        // For now, we'll use a basic schema extraction
        const schemaData = entity
          ? {
              entityName: entityName,
              curatedEntityName: entity.curated.replace("curated.", ""),
              rawAttributes: entity.schemaAttributes || [],
              curatedAttributes: entity.schemaAttributes
                ? [
                    ...entity.schemaAttributes,
                    "updated_at",
                    "version",
                    "is_deleted",
                  ]
                : [],
              mappings: entity.schemaAttributes
                ? entity.schemaAttributes.map((attr) => ({
                    raw: typeof attr === "string" ? attr : attr.name,
                    curated: typeof attr === "string" ? attr : attr.name,
                    transformation: "direct_mapping",
                  }))
                : [],
              dataTypes: {},
              constraints: {},
              newColumns: [],
            }
          : null;

        if (diffData.success === false) {
          // Handle failed diff generation
          transformedDiffs[entityName] = {
            diff: {
              error: diffData.error,
              summary: {
                total: 0,
                new: 0,
                modified: 0,
                unchanged: 0,
                deleted: 0,
              },
            },
            artifacts: null,
            schema: schemaData,
            previousVersions: diffData.previousVersions || {
              sql: null,
              pyspark: null,
            },
          };
        } else {
          // Handle successful diff generation
          // Check if there are accepted NLP artifacts for this entity
          const nlpArtifact = acceptedNLPArtifacts.find(
            (nlp) => nlp.entityName === entityName
          );

          // Merge base artifacts with NLP artifacts if they exist
          const mergedArtifacts = allArtifacts[entityName]
            ? {
                ...allArtifacts[entityName],
                ...(nlpArtifact && {
                  nlpSql: nlpArtifact.sqlCode || "",
                  nlpPySpark: nlpArtifact.pysparkCode || "",
                  nlpDescription: nlpArtifact.nlpDescription || "",
                  nlpColumns: nlpArtifact.entityColumns || [],
                  nlpNotes: nlpArtifact.notes || "",
                  nlpAcceptedAt: nlpArtifact.acceptedAt || "",
                }),
              }
            : null;

          transformedDiffs[entityName] = {
            diff: diffData,
            artifacts: mergedArtifacts,
            schema: schemaData,
            previousVersions: diffData.previousVersions || {
              sql: null,
              pyspark: null,
              nlpSql: null,
              nlpPySpark: null,
            },
          };
        }
      }

      setAllDiffs(transformedDiffs);

      // Update the modal state with the generated diffs
      setAllDiffsModal((prev) => ({
        ...prev,
        diffs: transformedDiffs,
      }));

      // Show success message with summary
      if (summary.failed > 0) {
      }
    } catch (error) {
      alert("Failed to generate diffs for all entities. Please try again.");
    } finally {
      setIsGeneratingAllDiffs(false);
    }
  };

  // Push artifacts to GitHub (DDL, DML, and Transformations)
  const pushArtifactsToGitHub = async () => {
    if (!githubConnection) {
      alert("Please configure GitHub connection in settings first.");
      return;
    }

    setIsPushingToGitHub(true);
    try {
      const githubConfig = {
        repositoryUrl: githubConnection.repositoryUrl,
        branch: githubConnection.branch,
        username: githubConnection.username,
        password: githubConnection.password,
      };

      // Get file data for this entity to extract actual attributes
      const entity = entities.find(
        (e) => e.raw.replace("raw.", "") === diffModal.entityName
      );
      const fileIndex = entities.findIndex((e) => e.raw === entity?.raw);
      const fileInfo = fileData[fileIndex];

      // Extract attributes from the actual file data
      let rawAttributes = [];
      let curatedAttributes = [];
      let mappings = [];

      if (fileInfo && fileInfo.sampleData && fileInfo.sampleData.length > 0) {
        // Extract raw attributes from sample data
        rawAttributes = Object.keys(fileInfo.sampleData[0]);

        // Create curated attributes (raw + control columns)
        curatedAttributes = [
          ...rawAttributes,
          "_ingest_timestamp",
          "_source_system",
          "_record_status",
          "_update_timestamp",
          "_batch_id",
          "_created_by",
          "_updated_by",
        ];

        // Create mappings based on actual attributes
        mappings = rawAttributes.map((attr) => ({
          raw: attr,
          curated: attr,
          isNewColumn: false,
          isControlColumn: false,
        }));
      } else {
        // Fallback to basic attributes if no sample data available
        rawAttributes = [
          "id",
          "name",
          "description",
          "created_at",
          "updated_at",
        ];
        curatedAttributes = [
          ...rawAttributes,
          "_ingest_timestamp",
          "_source_system",
          "_record_status",
          "_update_timestamp",
          "_batch_id",
          "_created_by",
          "_updated_by",
        ];
        mappings = rawAttributes.map((attr) => ({
          raw: attr,
          curated: attr,
          isNewColumn: false,
          isControlColumn: false,
        }));
      }

      // Check if there are accepted NLP artifacts for this entity
      const nlpArtifact = acceptedNLPArtifacts.find(
        (nlp) => nlp.entityName === diffModal.entityName
      );

      // Create transformations object with NLP artifacts if they exist
      const transformations = {
        entityName: diffModal.entityName,
        curatedEntityName: diffModal.entityName,
        rawAttributes: rawAttributes,
        curatedAttributes: curatedAttributes,
        mappings: mappings,
        columnRules: {},
        operatorRules: {},
        concatenationRules: [],
        entityNLPRules: nlpArtifact ? [nlpArtifact] : [],
        // Include NLP artifacts in the transformations
        nlpArtifacts: nlpArtifact
          ? {
              sqlCode: nlpArtifact.sqlCode || "",
              pysparkCode: nlpArtifact.pysparkCode || "",
              nlpDescription: nlpArtifact.nlpDescription || "",
              entityColumns: nlpArtifact.entityColumns || [],
              notes: nlpArtifact.notes || "",
              acceptedAt: nlpArtifact.acceptedAt || "",
            }
          : null,
      };

      const response = await axios.post("/api/artifacts/generate", {
        entityName: diffModal.entityName,
        transformations: transformations,
        pushToGitHub: true,
        githubConfig: githubConfig,
        folderPath: "curated",
      });

      // Extract commit URL and SHA from response
      const githubPush = response.data?.data?.githubPush;
      const commitUrl =
        githubPush?.commit_url ||
        response.data?.data?.commit_url ||
        response.data?.commit_url;
      const commitSha =
        githubPush?.commit_sha ||
        response.data?.data?.commit_sha ||
        response.data?.commit_sha;

      if (commitUrl) {
        const successMessage = `✅ Artifacts pushed to GitHub successfully!

📝 Commit Details:
• Repository: ${githubConfig.repositoryUrl}
• Branch: ${githubConfig.branch}
• Entity: ${diffModal.entityName}
• Commit SHA: ${commitSha || "N/A"}

🔗 Commit URL: ${commitUrl}

Click "OK" to open the commit in a new tab and view all changes.`;

        if (confirm(successMessage)) {
          window.open(commitUrl, "_blank");
        }
      } else {
        const fallbackMessage = `✅ Artifacts pushed to GitHub successfully!

📝 Commit Details:
• Repository: ${githubConfig.repositoryUrl}
• Branch: ${githubConfig.branch}
• Entity: ${diffModal.entityName}
• Commit SHA: ${commitSha || "N/A"}

Note: Commit URL not available. You can check your GitHub repository for the latest commit.`;

        alert(fallbackMessage);
      }

      setDiffModal({
        open: false,
        diff: null,
        entityName: "",
        artifacts: null,
      });
    } catch (error) {
      console.error("Failed to push to GitHub:", error);
      alert(
        "Failed to push to GitHub. Please check your connection and try again."
      );
    } finally {
      setIsPushingToGitHub(false);
    }
  };

  // Push all artifacts to GitHub (DDL, DML, and Transformations)
  const pushAllArtifactsToGitHub = async () => {
    if (!githubConnection) {
      alert("Please configure GitHub connection in settings first.");
      return;
    }

    if (Object.keys(allDiffs).length === 0) {
      alert("Please generate diffs first before pushing to GitHub.");
      return;
    }

    setIsPushingAllToGitHub(true);
    try {
      const githubConfig = {
        repositoryUrl: githubConnection.repositoryUrl,
        branch: githubConnection.branch,
        username: githubConnection.username,
        password: githubConnection.password,
      };

      // Collect all artifacts first
      const allArtifacts = [];
      const entityNames = [];

      for (const [entityName, diffData] of Object.entries(allDiffs)) {
        // Get entity and extract schema using the new function
        const entity = entities.find(
          (e) => e.raw.replace("raw.", "") === entityName
        );

        if (!entity) {
          console.error(`Entity not found: ${entityName}`);
          continue;
        }

        // Extract schema using the new function
        const schemaData = await extractEntitySchema(entity);
        const {
          rawAttributes,
          curatedAttributes,
          mappings,
          dataTypes,
          constraints,
          curatedEntityName,
          newColumns,
          columnRules,
          operatorRules,
          concatenationRules,
          entityNLPRules,
          columnDescriptions,
        } = schemaData;

        // Generate artifacts for this entity
        const response = await axios.post("/api/artifacts/generate", {
          entityName: entityName,
          transformations: {
            entityName: entityName,
            curatedEntityName: curatedEntityName,
            rawAttributes: rawAttributes,
            curatedAttributes: curatedAttributes,
            mappings: mappings,
            dataTypes: dataTypes,
            constraints: constraints,
            newColumns: newColumns,
            columnRules: columnRules,
            operatorRules: operatorRules,
            concatenationRules: concatenationRules,
            entityNLPRules: entityNLPRules,
            columnDescriptions: columnDescriptions,
          },
          pushToGitHub: false, // Don't push individually
        });

        // Get the base artifacts from the response
        const baseArtifacts = response.data.data.artifacts;

        // Check if there are accepted NLP artifacts for this entity
        const nlpArtifact = acceptedNLPArtifacts.find(
          (nlp) => nlp.entityName === entityName
        );

        // Merge base artifacts with NLP artifacts if they exist
        const mergedArtifacts = {
          ...baseArtifacts,
          ...(nlpArtifact && {
            nlpSql: nlpArtifact.sqlCode || "",
            nlpPySpark: nlpArtifact.pysparkCode || "",
            nlpDescription: nlpArtifact.nlpDescription || "",
            nlpColumns: nlpArtifact.entityColumns || [],
            nlpNotes: nlpArtifact.notes || "",
            nlpAcceptedAt: nlpArtifact.acceptedAt || "",
          }),
        };

        // Add artifacts to the collection
        allArtifacts.push({
          entityName: entityName,
          artifacts: mergedArtifacts,
        });
        entityNames.push(entityName);
      }

      // Create a new branch name with timestamp
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const newBranchName = `nexa-ai-${timestamp}`;

      const pushResponse = await axios.post(
        "/api/artifacts/push-all-to-github",
        {
          artifacts: allArtifacts,
          githubConfig: githubConfig,
          newBranchName: newBranchName,
          createPR: true,
          targetBranch: "main",
          folderPath: "curated",
        }
      );

      const prUrl =
        pushResponse.data?.data?.pr_url || pushResponse.data?.pr_url;
      const commitUrl =
        pushResponse.data?.data?.commit_url || pushResponse.data?.commit_url;
      const commitSha =
        pushResponse.data?.data?.commit_sha || pushResponse.data?.commit_sha;

      // Close the all diffs dialog
      setAllDiffsModal({ open: false, diffs: {} });

      // Show success message in a separate dialog
      const successMessage = `✅ All artifacts pushed to GitHub successfully!

📝 Pull Request Details:
• Repository: ${githubConfig.repositoryUrl}
• New Branch: ${newBranchName}
• Target Branch: main
• Entities pushed: ${entityNames.join(", ")}
• Total entities: ${entityNames.length}
• Commit SHA: ${commitSha || "N/A"}

A pull request has been created for code review. Click the links below to view the PR or repository on GitHub.`;

      // Show success dialog
      setSuccessDialog({
        open: true,
        message: successMessage,
        commitUrl: commitUrl,
        prUrl: prUrl,
        repositoryUrl: githubConfig.repositoryUrl,
      });

      // Clear the diffs after successful push
      setAllDiffs({});
    } catch (error) {
      console.error("Failed to push all artifacts to GitHub:", error);
      alert(
        "Failed to push all artifacts to GitHub. Please check your connection and try again."
      );
    } finally {
      setIsPushingAllToGitHub(false);
    }
  };

  // Function to check for existing transformations and update auto-mapped entities
  const checkExistingTransformations = async (entities) => {
    try {
      const existingTransformations = new Set();

      // First pass: check which entities already have transformations
      for (const entity of entities) {
        try {
          const response = await axios.get(
            `/api/transformations/${encodeURIComponent(entity.raw)}`
          );
          if (response.data && response.data.transformations) {
            existingTransformations.add(entity.raw);
          } else {
            entitiesNeedingTransformations.push(entity);
          }
        } catch (error) {
          // Entity has no transformations, add to list for auto-mapping
          entitiesNeedingTransformations.push(entity);
        }
      }

      // Update auto-mapped entities with existing transformations
      setAutoMappedEntities((prev) => {
        const updated = new Set([...prev, ...existingTransformations]);
        return updated;
      });

      // Second pass: create auto-mappings for entities that need them
      if (entitiesNeedingTransformations.length > 0) {
        setIsAutoMapping(true);
        setAutoMappingProgress({
          current: 0,
          total: entitiesNeedingTransformations.length,
          currentEntity: "",
        });

        try {
          // Create auto-mappings for all entities that need them
          for (let i = 0; i < entitiesNeedingTransformations.length; i++) {
            const entity = entitiesNeedingTransformations[i];

            // Update progress
            setAutoMappingProgress({
              current: i + 1,
              total: entitiesNeedingTransformations.length,
              currentEntity: entity.raw.replace("raw.", ""),
            });

            await createAutoMappings(entity.raw, entity.schemaAttributes);
          }

          // Show success notification for all entities
          setAutoMappingSuccess({
            entityName: "Multiple Entities",
            message: `Successfully created intelligent mappings for ${entitiesNeedingTransformations.length} entities with control columns and descriptions.`,
          });

          // Clear success notification after 5 seconds
          setTimeout(() => setAutoMappingSuccess(null), 5000);
        } catch (error) {
          console.error(
            "Failed to create auto-mappings for some entities:",
            error
          );
          // Show error notification
          setAutoMappingSuccess({
            entityName: "Error",
            message: `Failed to create auto-mappings for some entities. Please try expanding individual rows to create mappings manually.`,
          });
          setTimeout(() => setAutoMappingSuccess(null), 5000);
        } finally {
          setIsAutoMapping(false);
          setAutoMappingProgress({ current: 0, total: 0, currentEntity: "" });
        }
      }
    } catch (error) {
      console.error("Error checking existing transformations:", error);
      setIsAutoMapping(false);
    }
  };

  // Function to fetch schemas from database instead of S3
  const fetchSchemasFromDatabase = async (
    page = 1,
    limit = 15,
    search = "",
    sort = "worked_upon"
  ) => {
    try {
      setIsLoadingSchemas(true);

      // Build query parameters for pagination and search
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy: sort,
      });

      if (search.trim()) {
        params.append("search", search.trim());
      }

      // Use the raw schemas endpoint with pagination
      const response = await axios.get(`/api/raw-schemas?${params.toString()}`);

      if (response.data && response.data.success) {
        const schemas = response.data.schemas || [];
        const totalCount = response.data.totalCount || 0;

        // Set total entities count for pagination
        setTotalEntities(totalCount);

        // Extract entity information from schemas
        const entities = schemas.map((schema) => {
          const entityName = schema.entityName;
          const baseName = entityName.replace("raw.", "");

          return {
            raw: entityName,
            curated: `curated.${baseName}`,
            filename: schema.fileName || `${baseName}.csv`,
            description: schema.notes || "",
            recordCount: schema.schemaMetadata?.recordCount || 0,
            status: schema.status || "schema_extracted",
            schemaAttributes: schema.schemaAttributes || [],
            schemaMetadata: schema.schemaMetadata || {},
            createdAt: schema.createdAt,
            updatedAt: schema.updatedAt,
            hasBeenWorkedUpon: schema.hasBeenWorkedUpon || false,
            transformationInfo: schema.transformationInfo || null,
          };
        });

        // Set entities from database schemas
        setEntities(entities);
        setRawEntities(entities.map((e) => e.raw));
        setCuratedEntities(entities.map((e) => e.curated));
        setUploadedFiles(entities.map((e) => e.filename));

        // Create file data structure for compatibility
        const fileData = entities.map((entity) => ({
          key: `schema-only/${entity.raw}_${Date.now()}`,
          location: `schema-only://${entity.raw}`,
          size: entity.schemaMetadata?.fileSize || 0,
          lastModified: entity.updatedAt || entity.createdAt,
          schemaAttributes: entity.schemaAttributes,
          schemaMetadata: entity.schemaMetadata,
        }));

        setFileData(fileData);

        // Check for existing curated files
        await checkExistingCuratedFiles();

        // Check for existing transformations and update auto-mapped entities
        await checkExistingTransformations(entities);
      } else {
        setEntities([]);
        setRawEntities([]);
        setCuratedEntities([]);
        setUploadedFiles([]);
        setFileData([]);
      }
    } catch (err) {
      console.error("Failed to fetch schemas from database:", err);
      setEntities([]);
      setRawEntities([]);
      setCuratedEntities([]);
      setUploadedFiles([]);
      setFileData([]);
    } finally {
      setIsLoadingSchemas(false);
    }
  };

  // Function to render side-by-side diff view
  const renderSideBySideDiff = (
    filePath,
    newContent,
    previousContent,
    fileType
  ) => {
    if (!newContent) return null;

    const newLines = newContent.split("\n");
    const oldLines = previousContent ? previousContent.split("\n") : [];

    // Determine if this is a new file or modified file
    const isNewFile = !previousContent;

    return (
      <div className="mb-4">
        <h6
          className={`${
            fileType === "sql"
              ? "text-primary"
              : fileType === "pyspark"
              ? "text-info"
              : "text-warning"
          }`}
        >
          📄 {filePath.split("/").pop()}
        </h6>
        <div className="border rounded">
          <div className="bg-light p-2 border-bottom">
            <div className="row">
              <div className="col-6">
                <small className="text-muted">
                  <strong>
                    {isNewFile ? "No Previous Version" : "Previous Version"}
                  </strong>
                  {!isNewFile && " (will be replaced)"}
                </small>
              </div>
              <div className="col-6">
                <small className="text-success">
                  <strong>{isNewFile ? "New File" : "New Version"}</strong>
                  {" (will be created)"}
                </small>
              </div>
            </div>
          </div>
          <div className="row g-0">
            {/* Left Side - Previous Version */}
            <div className="col-6 border-end">
              <div
                style={{
                  background: "#f8f9fa",
                  padding: "1rem",
                  fontSize: "11px",
                  maxHeight: "400px",
                  overflow: "auto",
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  lineHeight: "1.4",
                  minHeight: "200px",
                }}
              >
                {isNewFile ? (
                  <div className="text-muted text-center py-4">
                    <div className="mb-2">
                      <BiGitBranch size={24} />
                    </div>
                    <small>No previous version</small>
                    <br />
                    <small>This will be a new file</small>
                  </div>
                ) : (
                  oldLines.map((line, index) => {
                    const isRemoved = !newLines.includes(line);
                    return (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                        }}
                      >
                        <span
                          style={{
                            color: "#6c757d",
                            marginRight: "10px",
                            minWidth: "30px",
                            textAlign: "right",
                            fontSize: "10px",
                            userSelect: "none",
                          }}
                        >
                          {index + 1}
                        </span>
                        <span
                          style={{
                            color: isRemoved ? "#dc3545" : "#6c757d",
                            marginRight: "10px",
                            minWidth: "20px",
                            textAlign: "right",
                            fontWeight: "bold",
                            fontSize: "12px",
                          }}
                        >
                          {isRemoved ? "-" : " "}
                        </span>
                        <span
                          style={{
                            color: isRemoved ? "#dc3545" : "#000",
                            flex: 1,
                            backgroundColor: isRemoved
                              ? "#ffeaea"
                              : "transparent",
                            padding: "1px 4px",
                            borderRadius: "2px",
                          }}
                        >
                          {line}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            {/* Right Side - New Version */}
            <div className="col-6">
              <div
                style={{
                  background: "#f8f9fa",
                  padding: "1rem",
                  fontSize: "11px",
                  maxHeight: "400px",
                  overflow: "auto",
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  lineHeight: "1.4",
                  minHeight: "200px",
                }}
              >
                {newLines.map((line, index) => {
                  const isNew = !oldLines.includes(line);
                  return (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                      }}
                    >
                      <span
                        style={{
                          color: "#6c757d",
                          marginRight: "10px",
                          minWidth: "30px",
                          textAlign: "right",
                          fontSize: "10px",
                          userSelect: "none",
                        }}
                      >
                        {index + 1}
                      </span>
                      <span
                        style={{
                          color: isNew ? "#28a745" : "#6c757d",
                          marginRight: "10px",
                          minWidth: "20px",
                          textAlign: "right",
                          fontWeight: "bold",
                          fontSize: "12px",
                        }}
                      >
                        {isNew ? "+" : " "}
                      </span>
                      <span
                        style={{
                          color: isNew ? "#28a745" : "#000",
                          flex: 1,
                          backgroundColor: isNew ? "#e8f5e8" : "transparent",
                          padding: "1px 4px",
                          borderRadius: "2px",
                        }}
                      >
                        {line}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>
        {`
          .card-view-item.worked-upon {
            border-left: 4px solid #28a745 !important;
            background-color: #f8fff9 !important;
            box-shadow: 0 2px 8px rgba(40, 167, 69, 0.1) !important;
          }
          
          .card-view-item.worked-upon:hover {
            background-color: #f0fff4 !important;
            box-shadow: 0 4px 12px rgba(40, 167, 69, 0.15) !important;
          }
          
          .card-view-item.worked-upon .card-body {
            border-left: none;
          }
        `}
      </style>
      <header className="d-flex justify-content-between align-items-center">
        <h1 className="h4 fw-semi-bold m-0">Curated Zone</h1>

        <div className="d-flex justify-content-between gap-2">
          <Form.Group className="filters-search">
            <Button variant="light">
              <BiSearch />
            </Button>
            <Form.Control
              className="bg-transparent"
              aria-label="Search"
              placeholder="Search Source & Target Entities"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Form.Group>
          <Button variant="outline-secondary" className="px-3">
            <BiFilter fontSize="24" /> Filter
          </Button>
        </div>
      </header>
      {/* Auto-mapping notification */}
      {isAutoMapping && (
        <Alert variant="info" className="mb-3">
          <div className="d-flex align-items-center">
            <div className="spinner spinner-sm me-2"></div>
            <strong>🤖 AI Assistant is working...</strong>
            <span className="ms-2">
              {autoMappingProgress.total > 1 ? (
                <>
                  Creating intelligent mappings for{" "}
                  {autoMappingProgress.current} of {autoMappingProgress.total}{" "}
                  entities
                  {autoMappingProgress.currentEntity && (
                    <span className="ms-2 text-muted">
                      (Currently: {autoMappingProgress.currentEntity})
                    </span>
                  )}
                </>
              ) : (
                "Creating intelligent 1:1 mappings and adding control columns with descriptions. This ensures your data is properly structured for the curated layer."
              )}
            </span>
          </div>
          {autoMappingProgress.total > 1 && (
            <div className="mt-2">
              <div className="progress" style={{ height: "8px" }}>
                <div
                  className="progress-bar"
                  role="progressbar"
                  style={{
                    width: `${
                      (autoMappingProgress.current /
                        autoMappingProgress.total) *
                      100
                    }%`,
                  }}
                  aria-valuenow={autoMappingProgress.current}
                  aria-valuemin="0"
                  aria-valuemax={autoMappingProgress.total}
                ></div>
              </div>
            </div>
          )}
        </Alert>
      )}
      {/* Auto-mapping success notification */}
      {autoMappingSuccess && (
        <Alert
          variant="success"
          className="mb-3"
          dismissible
          onClose={() => setAutoMappingSuccess(null)}
        >
          <div className="d-flex align-items-center">
            <strong>
              ✅ {autoMappingSuccess.entityName.replace("raw.", "")} - Mappings
              Created!
            </strong>
            <span className="ms-2">{autoMappingSuccess.message}</span>
          </div>
        </Alert>
      )}

      <div className="card-view">
        <div className="card-view-header">
          <Card className="rounded-bottom-0">
            <Card.Header className="border-0 bg-transparent py-3">
              <Row>
                <Col md={6}>Raw Entity</Col>
                <Col md={4}>Recommended Curated Entity</Col>
                <Col md={2} className="text-center">
                  Actions
                </Col>
              </Row>
            </Card.Header>
          </Card>
        </div>
        <div className="card-view-list gap-3 d-grid">
          {isLoadingSchemas ? (
            <div className="text-center border rounded rounded-4 rounded-top-0 bg-white py-5">
              <div className="text-muted py-5">
                <div className="spinner spinner-sm mx-auto mb-3"></div>
                <h5>Loading schemas...</h5>
                <p>Fetching schema data from database</p>
              </div>
            </div>
          ) : currentEntities.length === 0 ? (
            <div>
              <div className="text-center py-5">
                <div className="text-muted">
                  <BiSolidData size={48} className="mb-3" />
                  <h5>
                    {searchTerm.trim()
                      ? "No matching entities found"
                      : totalEntities === 0
                      ? "No schemas found"
                      : "No entities on this page"}
                  </h5>
                  <p>
                    {searchTerm.trim()
                      ? `No entities match "${searchTerm}". Try a different search term.`
                      : totalEntities === 0
                      ? "Upload files in the Welcome Demo page to extract schemas and see them here."
                      : "No entities to display on this page."}
                  </p>
                  {!searchTerm.trim() && (
                    <Button
                      variant="primary"
                      onClick={() => navigate("/welcome_demo")}
                    >
                      Go to Welcome Demo
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            currentEntities.map((e, idx) => (
              <>
                <Card
                  key={idx}
                  className={`card-view-item ${
                    openRows[idx] ? " is-expanded" : ""
                  } ${e.hasBeenWorkedUpon ? "worked-upon" : ""}`}
                >
                  <Card.Body>
                    <Row>
                      <Col md={4}>
                        <div className="d-flex gap-2">
                          <div>
                            <BiSolidData color="#9CA3AF" size={20} />
                          </div>
                          <div className="flex-fill d-flex gap-2 flex-wrap">
                            <span className="fw-medium">{e.raw}</span>
                            <div>
                              <Badge variant="primary">SCD2</Badge>
                              {autoMappedEntities.has(e.raw) && (
                                <Badge variant="info" className="ms-1">
                                  LLM Mapped
                                </Badge>
                              )}
                              {isAutoMapping &&
                                !autoMappedEntities.has(e.raw) && (
                                  <Badge variant="warning" className="ms-1">
                                    Mapping...
                                  </Badge>
                                )}
                              {e.hasBeenWorkedUpon && (
                                <OverlayTrigger
                                  placement="top"
                                  overlay={
                                    <Tooltip>
                                      {e.transformationInfo?.updatedBy
                                        ? `Last worked on by ${
                                            e.transformationInfo.updatedBy
                                          } on ${new Date(
                                            e.transformationInfo.lastTransformationUpdate
                                          ).toLocaleDateString()}`
                                        : `Last worked on ${new Date(
                                            e.transformationInfo.lastTransformationUpdate
                                          ).toLocaleDateString()}`}
                                    </Tooltip>
                                  }
                                >
                                  <Badge variant="success" className="ms-1">
                                    Worked On
                                  </Badge>
                                </OverlayTrigger>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="default btn-icon"
                            size="sm"
                            onClick={() => toggleRow(idx)}
                            aria-controls={`collapse-row-${idx}`}
                            aria-expanded={openRows[idx] || false}
                          >
                            {openRows[idx] ? (
                              <BiChevronUp size={20} opacity={0.7} />
                            ) : (
                              <BiChevronDown size={20} opacity={0.7} />
                            )}
                          </Button>
                        </div>

                        <div className="border p-2 rounded mt-2 d-flex gap-2">
                          <span className="flex-fill">
                            This table contains customer profile information
                          </span>
                          <div
                            className="align-items-end d-flex flex-shrink-0"
                            style={{ width: "12px" }}
                          >
                            <Image src={aiIcon} alt="" />
                          </div>
                        </div>
                      </Col>
                      <Col
                        md={2}
                        className="d-flex gap-2 justify-content-center"
                      >
                        <Button
                          variant="outline-secondary btn-icon"
                          size="sm"
                          onClick={() =>
                            setEtlModal({
                              open: true,
                              column: e.curated,
                            })
                          }
                        >
                          <Image src={aiIcon} alt="" />
                        </Button>
                        <OverlayTrigger
                          placement="top"
                          overlay={<Tooltip>Delete</Tooltip>}
                        >
                          <Button
                            variant="outline-secondary btn-icon"
                            size="sm"
                            onClick={() => handleDeleteEntity(idx)}
                          >
                            <BiTrash />
                          </Button>
                        </OverlayTrigger>
                      </Col>

                      <Col md={4}>
                        <div className="curated-name d-flex gap-3 align-items-center">
                          <div className="curated-title d-inline-flex flex-fill align-items-center gap-2 overflow-hidden">
                            <div>
                              <BiSolidData color="#9CA3AF" size={20} />
                            </div>
                            <div className="overflow-hidden text-truncate">
                              <span
                                className="fw-medium text-truncate"
                                title={e.curated}
                              >
                                {e.curated}
                              </span>
                            </div>
                            <Button
                              variant="defaults btn-icon btn-edit"
                              size="sm"
                              onClick={() => handleEditEntityName(idx)}
                              title="Edit entity name"
                            >
                              <BiPencil size={16} />
                            </Button>
                          </div>
                          <div className="d-inline-flex align-items-center">
                            <BiCheckCircle color="green" size={20} />
                          </div>

                          <Button
                            variant="default btn-icon"
                            size="sm"
                            onClick={() => handleChangeMapping(idx)}
                            disabled={
                              editingEntity !== null && editingEntity !== idx
                            }
                          >
                            <BiExpandVertical size={20} />
                          </Button>
                        </div>
                        <div className="border p-2 rounded mt-2 d-flex gap-2">
                          <span className="flex-fill">
                            This table contains customer profile information
                          </span>
                          <div
                            className="align-items-end d-flex flex-shrink-0"
                            style={{ width: "12px" }}
                          >
                            <Image src={aiIcon} alt="" />
                          </div>
                        </div>
                      </Col>

                      <Col md={2}>
                        <div className="d-flex gap-2 justify-content-center">
                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>View 10 records</Tooltip>}
                          >
                            <Button
                              variant="outline-secondary btn-icon"
                              size="sm"
                            >
                              <BiShow />
                            </Button>
                          </OverlayTrigger>
                        </div>
                      </Col>
                    </Row>

                    <Collapse in={openRows[idx]}>
                      <div id={`collapse-row-${idx}`} className="py-3">
                        <EditEntityMappingsPage
                          entityName={e.raw}
                          uploadedFiles={uploadedFiles}
                          rawEntities={rawEntities}
                          curatedEntities={curatedEntities}
                          fileData={fileData}
                          isChildComponent={true}
                          onEntityNameUpdate={handleEntityNameUpdate}
                        />
                      </div>
                    </Collapse>
                  </Card.Body>
                </Card>
              </>
            ))
          )}
        </div>

        {/* Pagination Controls */}
        {totalEntities > entitiesPerPage && (
          <div className="d-flex justify-content-between align-items-center my-3">
            <div className="text-muted">
              Showing {indexOfFirstEntity + 1} to{" "}
              {Math.min(indexOfLastEntity, totalEntities)} of {totalEntities}{" "}
              entities
            </div>
            <div className="d-flex gap-2">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>

              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={
                      currentPage === pageNum ? "primary" : "outline-secondary"
                    }
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}

              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
      {/* Records View Modal */}
      {viewingRecords !== null && (
        <>
          <Modal
            size="xl"
            scrollable
            backdrop="static"
            show={showViewModal}
            onHide={() => setShowViewModal(false)}
            centered
          >
            <Modal.Header closeButton>
              <Modal.Title>View Records</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p>
                <span className="text-muted">Curated File Records:</span>{" "}
                {entities[viewingRecords]?.curated}
              </p>

              {loadingRecords ? (
                <div className="p-5 d-flex jsutify-content-center flex-column font-secondary text-center">
                  <div className="spinner spinner-sm mx-auto"></div>
                  <span>Loading records...</span>
                </div>
              ) : recordsError ? (
                <div
                  style={{
                    color: "red",
                    fontWeight: 500,
                    textAlign: "center",
                    margin: "1rem 0",
                  }}
                >
                  {recordsError}
                  {debugInfo.fileContent && (
                    <>
                      <div
                        style={{
                          marginTop: 12,
                          color: "#888",
                          fontSize: 13,
                        }}
                      >
                        <b>Raw file content:</b>
                        <pre
                          style={{
                            background: "#f7f7f7",
                            padding: 8,
                            borderRadius: 4,
                            maxHeight: 200,
                            overflow: "auto",
                          }}
                        >
                          {debugInfo.fileContent}
                        </pre>
                      </div>
                      {debugInfo.lines && (
                        <div
                          style={{
                            marginTop: 8,
                            color: "#888",
                            fontSize: 13,
                          }}
                        >
                          <b>Parsed lines:</b>
                          <pre
                            style={{
                              background: "#f7f7f7",
                              padding: 8,
                              borderRadius: 4,
                              maxHeight: 120,
                              overflow: "auto",
                            }}
                          >
                            {JSON.stringify(debugInfo.lines, null, 2)}
                          </pre>
                        </div>
                      )}
                      {debugInfo.headers && (
                        <div
                          style={{
                            marginTop: 8,
                            color: "#888",
                            fontSize: 13,
                          }}
                        >
                          <b>Parsed headers:</b>{" "}
                          <code>{JSON.stringify(debugInfo.headers)}</code>
                        </div>
                      )}
                      {debugInfo.delimiter && (
                        <div
                          style={{
                            marginTop: 8,
                            color: "#888",
                            fontSize: 13,
                          }}
                        >
                          <b>Detected delimiter:</b>{" "}
                          <code>{JSON.stringify(debugInfo.delimiter)}</code>
                        </div>
                      )}
                    </>
                  )}
                  {debugInfo.error && (
                    <div
                      style={{
                        marginTop: 12,
                        color: "#888",
                        fontSize: 13,
                      }}
                    >
                      <b>Error:</b> <code>{debugInfo.error}</code>
                    </div>
                  )}
                </div>
              ) : sampleRecords.length > 0 ? (
                <div className="table-view">
                  <Table responsive>
                    <thead>
                      <tr>
                        {Object.keys(sampleRecords[0]).map((key) => (
                          <th key={key}>{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sampleRecords.map((record, idx) => (
                        <tr key={idx}>
                          {Object.values(record).map((value, valIdx) => (
                            <td key={valIdx}>
                              {typeof value === "boolean"
                                ? value
                                  ? "Yes"
                                  : "No"
                                : String(value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <div>No records found in file.</div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={() => setShowViewModal(false)}
              >
                Close
              </Button>
            </Modal.Footer>
          </Modal>
        </>
      )}
      <div className="sticky-btns my-4 gap-2 d-flex justify-content-between">
        <div className="d-flex gap-2">
          <Button variant="light" title="View Data & PII Classifications">
            View Classifications
          </Button>
          <Button variant="light" title="View your changes">
            My Changes
          </Button>
        </div>
        <div className="d-flex gap-2">
          <Button
            variant="outline-primary"
            title="Generate all Schemas, Entities, Mappings, Code Pipelines and Deployment Artefacts"
            onClick={generateAllArtifacts}
            disabled={isGeneratingArtifacts || entities.length === 0}
          >
            {isGeneratingArtifacts ? "🔄 Generating..." : "Generate Artefacts"}
          </Button>
          <Button
            variant="outline-secondary"
            title="View and manage accepted transformation artifacts"
            onClick={() => setShowNLPArtifactsModal(true)}
          >
            📁 Accepted Transformations
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              navigate("/consumption_landing_page", {
                state: {
                  uploadedFiles: uploadedFiles,
                  rawEntities: rawEntities,
                  curatedEntities: curatedEntities,
                  fileData: fileData,
                },
              })
            }
          >
            Continue to Consumption <BiChevronRight size={20} />
          </Button>
        </div>
      </div>
      {/* Edit Name Modal */}
      {editNameModal.open && (
        <>
          <Modal
            show={showEditModal}
            onHide={() => setShowEditModal(false)}
            centered
            backdrop="static"
          >
            <Modal.Header closeButton>
              <Modal.Title>Edit Entity Name</Modal.Title>
            </Modal.Header>

            <Modal.Body>
              <p>
                <span className="text-muted">Current entity: </span>
                <strong>{entities[editNameModal.entityIndex]?.curated}</strong>
              </p>

              <Form.Group>
                <Form.Label>New Entity Name:</Form.Label>

                <InputGroup className="mb-3">
                  <InputGroup.Text className="small">curated.</InputGroup.Text>
                  <Form.Control
                    type="text"
                    value={editNameModal.newName}
                    onChange={(e) =>
                      setEditNameModal((prev) => ({
                        ...prev,
                        newName: e.target.value,
                      }))
                    }
                    placeholder="Enter new entity name"
                    autoFocus
                  />
                </InputGroup>
              </Form.Group>
              <p>
                <span className="text-muted">The full name will be: </span>
                <strong>curated.{editNameModal.newName}</strong>
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="outline-secondary"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={saveEntityName}
                disabled={isEditing || !editNameModal.newName.trim()}
              >
                {isEditing ? "Saving..." : "Save Name"}
              </Button>
            </Modal.Footer>
          </Modal>
        </>
      )}
      {/* Edit Mapped Modal */}
      <>
        <Modal
          show={showMappedModal}
          onHide={() => setShowMappedModal(false)}
          centered
          backdrop="static"
        >
          <Modal.Header closeButton>
            <Modal.Title>Edit Mapped Name</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            <Form.Select
              value={newProcessedName}
              onChange={(e) => setNewProcessedName(e.target.value)}
            >
              {availableCuratedNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Form.Select>
            <div className="d-flex gap-2"></div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline-secondary"
              onClick={() => setShowMappedModal(false)}
            >
              Cancel
            </Button>
            <Button onClick={() => handleSaveMapping(idx)} variant="primary">
              Save
            </Button>
          </Modal.Footer>
        </Modal>
      </>
      {/* Artifacts Modal */}
      {artifactsModal.open && (
        <Modal
          size="xl"
          show={artifactsModal.open}
          onHide={() =>
            setArtifactsModal({
              open: false,
              artifacts: null,
            })
          }
          centered
          scrollable
        >
          <Modal.Header closeButton>
            <div className="d-flex justify-content-between align-items-center w-100">
              <Modal.Title>Generated Artifacts for All Entities</Modal.Title>
            </div>
          </Modal.Header>
          <Modal.Body>
            {/* Fixed Generate All Diffs Button */}
            {githubConnection && entities.length > 0 && (
              <div
                style={{
                  position: "sticky",
                  top: "0",
                  backgroundColor: "white",
                  padding: "15px",
                  margin: "-15px -15px 15px -15px",
                  borderBottom: "1px solid #dee2e6",
                  zIndex: 10,
                  borderRadius: "6px 6px 0 0",
                }}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1">
                      <BiGitBranch /> GitHub Integration
                    </h6>
                    <small className="text-muted">
                      Generate and review all diffs for {entities.length}{" "}
                      entities
                    </small>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <div className="text-end">
                      <small className="text-success">
                        ✅ {githubConnection.repositoryName} (
                        {githubConnection.branch})
                      </small>
                    </div>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => {
                        setAllDiffsModal({ open: true, diffs: {} });
                        generateAllDiffs();
                      }}
                      disabled={isGeneratingAllDiffs && allDiffsModal.open}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {allDiffsModal.open && isGeneratingAllDiffs ? (
                        <>
                          <div
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                          >
                            <span className="visually-hidden">Loading...</span>
                          </div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <BiGitBranch /> Generate All Diffs
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <p className="text-muted mb-3">
              Generated SQL and PySpark code for all entities. Each entity's
              artifacts are displayed in collapsible sections below.
            </p>

            <Accordion defaultActiveKey="0">
              {/* DDL Folder */}
              <Accordion.Item eventKey="ddl">
                <Accordion.Header>
                  🏗️ DDL (Data Definition Language)
                  <Badge bg="primary" className="ms-2">
                    {Object.keys(artifactsModal.artifacts || {}).length}{" "}
                    Entities
                  </Badge>
                </Accordion.Header>
                <Accordion.Body>
                  <small className="text-muted mb-3 d-block">
                    Schema definitions, table structures, and transformation
                    logic
                  </small>

                  {Object.entries(artifactsModal.artifacts || {}).map(
                    ([entityName, artifacts], index) => (
                      <div key={index} className="mb-4 p-3 border rounded">
                        <h6 className="text-primary mb-3">📁 {entityName}</h6>

                        {/* SQL Code */}
                        <div className="mb-3">
                          <h6>🔗 SQL Code</h6>
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
                            {artifacts?.sql || ""}
                          </pre>
                          <div className="d-flex justify-content-end">
                            <Button
                              variant="outline-secondary btn-icon"
                              size="sm"
                              onClick={() => {
                                const content = artifacts?.sql || "";
                                navigator.clipboard.writeText(content);
                                alert("SQL code copied to clipboard!");
                              }}
                            >
                              <BiCopyAlt />
                            </Button>
                          </div>
                        </div>

                        {/* PySpark Code */}
                        <div className="mb-3">
                          <h6>🐍 PySpark Code</h6>
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
                            {artifacts?.pyspark || ""}
                          </pre>
                          <div className="d-flex justify-content-end">
                            <Button
                              variant="outline-secondary btn-icon"
                              size="sm"
                              onClick={() => {
                                const content = artifacts?.pyspark || "";
                                navigator.clipboard.writeText(content);
                                alert("PySpark code copied to clipboard!");
                              }}
                            >
                              <BiCopyAlt />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </Accordion.Body>
              </Accordion.Item>

              {/* DML Folder */}
              <Accordion.Item eventKey="dml">
                <Accordion.Header>
                  📝 DML (Data Manipulation Language)
                  <Badge bg="warning" className="ms-2">
                    {Object.keys(artifactsModal.artifacts || {}).length}{" "}
                    Entities
                  </Badge>
                </Accordion.Header>
                <Accordion.Body>
                  <small className="text-muted mb-3 d-block">
                    Data insertion, updates, and deletion operations. DML
                    artifacts are generated when pushing to GitHub.
                  </small>

                  {Object.entries(artifactsModal.artifacts || {}).map(
                    ([entityName, artifacts], index) => (
                      <div key={index} className="mb-4 p-3 border rounded">
                        <h6 className="text-warning mb-3">📁 {entityName}</h6>

                        {/* DML SQL Code */}
                        <div className="mb-3">
                          <h6>🔗 DML SQL Code</h6>
                          {artifacts?.dmlSql ? (
                            <>
                              <pre
                                style={{
                                  background: "#fff3cd",
                                  padding: "1rem",
                                  borderRadius: "4px",
                                  fontSize: "12px",
                                  maxHeight: "300px",
                                  overflow: "auto",
                                  fontFamily: "monospace",
                                  border: "1px solid #ffc107",
                                }}
                              >
                                {artifacts.dmlSql}
                              </pre>
                              <div className="d-flex justify-content-end">
                                <Button
                                  variant="outline-warning btn-icon"
                                  size="sm"
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      artifacts.dmlSql
                                    );
                                    alert("DML SQL code copied to clipboard!");
                                  }}
                                >
                                  <BiCopyAlt />
                                </Button>
                              </div>
                            </>
                          ) : (
                            <div className="text-center p-4 text-muted">
                              <div className="mb-2">
                                <BiGitBranch size={24} />
                              </div>
                              <p className="mb-0">
                                DML SQL code not yet generated
                              </p>
                              <small>
                                DML artifacts will be created when pushing to
                                GitHub
                              </small>
                            </div>
                          )}
                        </div>

                        {/* DML PySpark Code */}
                        <div className="mb-3">
                          <h6>🐍 DML PySpark Code</h6>
                          {artifacts?.dmlPySpark ? (
                            <>
                              <pre
                                style={{
                                  background: "#fff3cd",
                                  padding: "1rem",
                                  borderRadius: "4px",
                                  fontSize: "12px",
                                  maxHeight: "300px",
                                  overflow: "auto",
                                  fontFamily: "monospace",
                                  border: "1px solid #ffc107",
                                }}
                              >
                                {artifacts.dmlPySpark}
                              </pre>
                              <div className="d-flex justify-content-end">
                                <Button
                                  variant="outline-warning btn-icon"
                                  size="sm"
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      artifacts.dmlPySpark
                                    );
                                    alert(
                                      "DML PySpark code copied to clipboard!"
                                    );
                                  }}
                                >
                                  <BiCopyAlt />
                                </Button>
                              </div>
                            </>
                          ) : (
                            <div className="text-center p-4 text-muted">
                              <div className="mb-2">
                                <BiGitBranch size={24} />
                              </div>
                              <p className="mb-0">
                                DML PySpark code not yet generated
                              </p>
                              <small>
                                DML artifacts will be created when pushing to
                                GitHub
                              </small>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </Accordion.Body>
              </Accordion.Item>

              {/* Transformations Folder */}
              <Accordion.Item eventKey="transformations">
                <Accordion.Header>
                  🔄 Transformations
                  <Badge bg="success" className="ms-2">
                    {acceptedNLPArtifacts.length} Entities
                  </Badge>
                </Accordion.Header>
                <Accordion.Body>
                  <small className="text-muted mb-3 d-block">
                    AI-generated transformations and business logic from
                    accepted transformation artifacts
                  </small>

                  {isLoadingNLPArtifacts ? (
                    <div className="text-center p-4">
                      <div
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                      >
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      Loading accepted NLP artifacts...
                    </div>
                  ) : acceptedNLPArtifacts.length > 0 ? (
                    acceptedNLPArtifacts.map((artifact) => (
                      <div
                        key={artifact.id}
                        className="mb-4 p-3 border rounded"
                      >
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <h6 className="text-success mb-0">
                            📁 {artifact.entityName}
                          </h6>
                          <Badge bg="success" size="sm">
                            Accepted
                          </Badge>
                        </div>

                        {/* Transformation Description */}
                        <div className="mb-3">
                          <h6 className="text-muted">📝 Description</h6>
                          <p className="text-muted mb-2">
                            {artifact.nlpDescription}
                          </p>
                          <small className="text-muted">
                            Accepted on:{" "}
                            {new Date(artifact.acceptedAt).toLocaleString()}
                          </small>
                        </div>

                        {/* Transformation SQL Code */}
                        {artifact.sqlCode && (
                          <div className="mb-3">
                            <h6>🔗 Transformation SQL Code</h6>
                            <pre
                              style={{
                                background: "#e8f5e8",
                                padding: "1rem",
                                borderRadius: "4px",
                                fontSize: "12px",
                                maxHeight: "300px",
                                overflow: "auto",
                                fontFamily: "monospace",
                                border: "1px solid #28a745",
                              }}
                            >
                              {artifact.sqlCode}
                            </pre>
                            <div className="d-flex justify-content-end">
                              <Button
                                variant="outline-success btn-icon"
                                size="sm"
                                onClick={() => {
                                  const content = artifact.sqlCode || "";
                                  navigator.clipboard.writeText(content);
                                  alert(
                                    "Transformation SQL code copied to clipboard!"
                                  );
                                }}
                              >
                                <BiCopyAlt />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Transformation PySpark Code */}
                        {artifact.pysparkCode && (
                          <div className="mb-3">
                            <h6>🐍 Transformation PySpark Code</h6>
                            <pre
                              style={{
                                background: "#e8f5e8",
                                padding: "1rem",
                                borderRadius: "4px",
                                fontSize: "12px",
                                maxHeight: "300px",
                                overflow: "auto",
                                fontFamily: "monospace",
                                border: "1px solid #28a745",
                              }}
                            >
                              {artifact.pysparkCode}
                            </pre>
                            <div className="d-flex justify-content-end">
                              <Button
                                variant="outline-success btn-icon"
                                size="sm"
                                onClick={() => {
                                  const content = artifact.pysparkCode || "";
                                  navigator.clipboard.writeText(content);
                                  alert(
                                    "Transformation PySpark code copied to clipboard!"
                                  );
                                }}
                              >
                                <BiCopyAlt />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Entity Columns */}
                        {artifact.entityColumns &&
                          artifact.entityColumns.length > 0 && (
                            <div className="mb-3">
                              <h6>🏷️ Entity Columns</h6>
                              <div className="d-flex flex-wrap gap-1">
                                {artifact.entityColumns.map((column, index) => (
                                  <Badge
                                    key={index}
                                    bg="light"
                                    text="dark"
                                    className="me-1"
                                  >
                                    {column}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Notes */}
                        {artifact.notes && (
                          <div className="mb-3">
                            <h6>📋 Notes</h6>
                            <p className="text-muted mb-0">{artifact.notes}</p>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center p-4 text-muted">
                      <p>No accepted transformation artifacts found.</p>
                      <small>
                        Accepted transformation artifacts will appear here. Use
                        the AI assistant to generate and accept transformations.
                      </small>
                    </div>
                  )}
                </Accordion.Body>
              </Accordion.Item>
            </Accordion>

            {/* GitHub Integration Section */}
            <div className="mt-4 p-3 border rounded bg-light">
              <h6 className="mb-3">
                <BiGitBranch /> GitHub Integration
              </h6>

              {githubConnection ? (
                <div>
                  <Alert variant="success">
                    <strong>✅ GitHub Connected</strong>
                    <br />
                    Repository: {githubConnection.repositoryName} (
                    {githubConnection.branch})
                    <br />
                    <small className="text-muted">
                      Use the "Generate All Diffs" button at the top-right of
                      the page to generate and review all diffs.
                    </small>
                  </Alert>
                </div>
              ) : (
                <div className="text-center p-3">
                  <p className="text-warning mb-2">
                    ⚠️ No GitHub connection configured
                  </p>
                  <small className="text-muted">
                    Configure GitHub connection in Settings to enable diff
                    generation and artifact pushing.
                  </small>
                </div>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() =>
                setArtifactsModal({
                  open: false,
                  artifacts: null,
                })
              }
            >
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      )}
      {/* Diff Modal */}
      {diffModal.open && (
        <Modal
          size="xl"
          show={diffModal.open}
          onHide={() =>
            setDiffModal({
              open: false,
              diff: null,
              entityName: "",
              artifacts: null,
            })
          }
          centered
          scrollable
        >
          <Modal.Header closeButton>
            <Modal.Title>GitHub Diff for {diffModal.entityName}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {diffModal.diff ? (
              <div>
                <Alert variant="info">
                  <strong>Diff Summary:</strong>{" "}
                  {diffModal.diff.summary &&
                  typeof diffModal.diff.summary === "object" ? (
                    <span>
                      Total: {diffModal.diff.summary.total || 0}, New:{" "}
                      {diffModal.diff.summary.new || 0}, Modified:{" "}
                      {diffModal.diff.summary.modified || 0}, Unchanged:{" "}
                      {diffModal.diff.summary.unchanged || 0}, Deleted:{" "}
                      {diffModal.diff.summary.deleted || 0}
                    </span>
                  ) : (
                    String(diffModal.diff.summary || "No summary available")
                  )}
                </Alert>

                <div className="mb-3">
                  <h6>📊 Changes Summary</h6>

                  {/* New Files */}
                  {diffModal.diff.newFiles &&
                    diffModal.diff.newFiles.length > 0 && (
                      <div className="mb-2">
                        <h6 className="text-success">🆕 New Files:</h6>
                        <ul>
                          {diffModal.diff.newFiles.map((file, index) => (
                            <li key={index}>
                              <strong>{file.path}</strong> ({file.size} bytes)
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {/* Modified Files */}
                  {diffModal.diff.modifiedFiles &&
                    diffModal.diff.modifiedFiles.length > 0 && (
                      <div className="mb-2">
                        <h6 className="text-warning">📝 Modified Files:</h6>
                        <ul>
                          {diffModal.diff.modifiedFiles.map((file, index) => (
                            <li key={index}>
                              <strong>{file.path}</strong>
                              <span className="text-muted">
                                {" "}
                                (Size: {file.existingSize} → {file.newSize}{" "}
                                bytes)
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {/* Unchanged Files */}
                  {diffModal.diff.unchangedFiles &&
                    diffModal.diff.unchangedFiles.length > 0 && (
                      <div className="mb-2">
                        <h6 className="text-info">✅ Unchanged Files:</h6>
                        <ul>
                          {diffModal.diff.unchangedFiles.map((file, index) => (
                            <li key={index}>
                              <strong>{file.path}</strong> ({file.size} bytes)
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {/* Deleted Files */}
                  {diffModal.diff.deletedFiles &&
                    diffModal.diff.deletedFiles.length > 0 && (
                      <div className="mb-2">
                        <h6 className="text-danger">🗑️ Deleted Files:</h6>
                        <ul>
                          {diffModal.diff.deletedFiles.map((file, index) => (
                            <li key={index}>
                              <strong>{file.path}</strong> ({file.size} bytes)
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>

                {/* File Content Preview */}
                <div className="mb-3">
                  <h6>🔍 File Content Preview</h6>
                  <p className="text-muted">
                    This shows what will be created or modified in your GitHub
                    repository with the new folder structure.
                  </p>

                  {/* DDL Files Preview */}
                  <div className="mb-4">
                    <h6 className="text-primary">
                      🏗️ DDL (Data Definition Language) Files
                    </h6>

                    {/* SQL File Preview */}
                    {diffModal.artifacts?.artifacts?.sql && (
                      <div className="mb-3">
                        <h6 className="text-primary">
                          📄 SQL File: curated/ddl/{diffModal.entityName}/sql/
                          {diffModal.entityName}_transform.sql
                        </h6>
                        <pre
                          style={{
                            background: "#f8f9fa",
                            padding: "1rem",
                            borderRadius: "4px",
                            fontSize: "11px",
                            maxHeight: "200px",
                            overflow: "auto",
                            fontFamily: "monospace",
                            border: "1px solid #dee2e6",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {diffModal.artifacts.artifacts.sql}
                        </pre>
                      </div>
                    )}

                    {/* PySpark File Preview */}
                    {diffModal.artifacts?.artifacts?.pyspark && (
                      <div className="mb-3">
                        <h6 className="text-primary">
                          📄 PySpark File: curated/ddl/{diffModal.entityName}
                          /pyspark/{diffModal.entityName}_transform.py
                        </h6>
                        <pre
                          style={{
                            background: "#f8f9fa",
                            padding: "1rem",
                            borderRadius: "4px",
                            fontSize: "11px",
                            maxHeight: "200px",
                            overflow: "auto",
                            fontFamily: "monospace",
                            border: "1px solid #dee2e6",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {diffModal.artifacts.artifacts.pyspark}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Transformations Files Preview */}
                  <div className="mb-4">
                    <h6 className="text-success">🔄 Transformations Files</h6>

                    {/* Check if there are accepted NLP artifacts for this entity */}
                    {(() => {
                      const nlpArtifact = acceptedNLPArtifacts.find(
                        (nlp) => nlp.entityName === diffModal.entityName
                      );

                      if (nlpArtifact) {
                        return (
                          <>
                            {/* Transformations SQL File Preview */}
                            {nlpArtifact.sqlCode && (
                              <div className="mb-3">
                                <h6 className="text-success">
                                  📄 Transformations SQL File:
                                  curated/transformations/{diffModal.entityName}
                                  /sql/{diffModal.entityName}_nlp_transform.sql
                                </h6>
                                <pre
                                  style={{
                                    background: "#e8f5e8",
                                    padding: "1rem",
                                    borderRadius: "4px",
                                    fontSize: "11px",
                                    maxHeight: "200px",
                                    overflow: "auto",
                                    fontFamily: "monospace",
                                    border: "1px solid #28a745",
                                    whiteSpace: "pre-wrap",
                                  }}
                                >
                                  {nlpArtifact.sqlCode}
                                </pre>
                              </div>
                            )}

                            {/* Transformations PySpark File Preview */}
                            {nlpArtifact.pysparkCode && (
                              <div className="mb-3">
                                <h6 className="text-success">
                                  📄 Transformations PySpark File:
                                  curated/transformations/{diffModal.entityName}
                                  /pyspark/{diffModal.entityName}
                                  _nlp_transform.py
                                </h6>
                                <pre
                                  style={{
                                    background: "#e8f5e8",
                                    padding: "1rem",
                                    borderRadius: "4px",
                                    fontSize: "11px",
                                    maxHeight: "200px",
                                    overflow: "auto",
                                    fontFamily: "monospace",
                                    border: "1px solid #28a745",
                                    whiteSpace: "pre-wrap",
                                  }}
                                >
                                  {nlpArtifact.pysparkCode}
                                </pre>
                              </div>
                            )}

                            {/* Transformation Description */}
                            {nlpArtifact.nlpDescription && (
                              <div className="mb-3">
                                <h6 className="text-muted">📝 Description</h6>
                                <p className="text-muted mb-2">
                                  {nlpArtifact.nlpDescription}
                                </p>
                                <small className="text-muted">
                                  Accepted on:{" "}
                                  {new Date(
                                    nlpArtifact.acceptedAt
                                  ).toLocaleString()}
                                </small>
                              </div>
                            )}
                          </>
                        );
                      } else {
                        return (
                          <p className="text-muted">
                            No transformation artifacts found for this entity.
                            Transformation artifacts will be saved in the
                            curated/transformations/{diffModal.entityName}{" "}
                            folder when available.
                          </p>
                        );
                      }
                    })()}
                  </div>

                  {/* DML Files Preview */}
                  <div className="mb-4">
                    <h6 className="text-warning">
                      📝 DML (Data Manipulation Language) Files
                    </h6>

                    {/* DML SQL File Preview */}
                    {diffModal.artifacts?.artifacts?.dmlSql && (
                      <div className="mb-3">
                        <h6 className="text-warning">
                          📄 DML SQL File: curated/dml/{diffModal.entityName}
                          /sql/
                          {diffModal.entityName}_dml.sql
                        </h6>
                        <pre
                          style={{
                            background: "#fff3cd",
                            padding: "1rem",
                            borderRadius: "4px",
                            fontSize: "11px",
                            maxHeight: "200px",
                            overflow: "auto",
                            fontFamily: "monospace",
                            border: "1px solid #ffc107",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {diffModal.artifacts.artifacts.dmlSql}
                        </pre>
                      </div>
                    )}

                    {/* DML PySpark File Preview */}
                    {diffModal.artifacts?.artifacts?.dmlPySpark && (
                      <div className="mb-3">
                        <h6 className="text-warning">
                          📄 DML PySpark File: curated/dml/
                          {diffModal.entityName}
                          /pyspark/{diffModal.entityName}_dml.py
                        </h6>
                        <pre
                          style={{
                            background: "#fff3cd",
                            padding: "1rem",
                            borderRadius: "4px",
                            fontSize: "11px",
                            maxHeight: "200px",
                            overflow: "auto",
                            fontFamily: "monospace",
                            border: "1px solid #ffc107",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {diffModal.artifacts.artifacts.dmlPySpark}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-4">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2">Generating diff...</p>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() =>
                setDiffModal({
                  open: false,
                  diff: null,
                  entityName: "",
                  artifacts: null,
                })
              }
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={pushArtifactsToGitHub}
              disabled={isPushingToGitHub || !diffModal.diff}
            >
              {isPushingToGitHub ? "🔄 Pushing..." : "Push to GitHub"}
            </Button>
          </Modal.Footer>
        </Modal>
      )}
      {/* All Diffs Modal */}
      {allDiffsModal.open && (
        <Modal
          size="xl"
          show={allDiffsModal.open}
          onHide={() => setAllDiffsModal({ open: false, diffs: {} })}
          centered
          scrollable
        >
          <Modal.Header closeButton>
            <Modal.Title>
              <BiGitBranch /> All Diffs Generated
              {Object.keys(allDiffsModal.diffs).length > 0 && (
                <Badge bg="success" className="ms-2">
                  {Object.keys(allDiffsModal.diffs).length} Entities
                </Badge>
              )}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {isGeneratingAllDiffs ? (
              <div className="text-center p-5">
                <div className="spinner-border mb-3" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <h6 className="mb-3">Generating diffs for all entities...</h6>

                <small className="text-muted">
                  This may take a few moments depending on the number of
                  entities
                </small>
              </div>
            ) : Object.keys(allDiffsModal.diffs).length > 0 ? (
              <div>
                <Alert variant="success">
                  <strong>✅ All Diffs Generated Successfully!</strong>
                  <br />
                  Generated diffs for {
                    Object.keys(allDiffsModal.diffs).length
                  }{" "}
                  entities. Review the changes below and push to GitHub when
                  ready.
                </Alert>

                {/* Summary Cards */}
                <div className="mb-4">
                  <h6>📊 Diff Summary</h6>
                  <div className="row">
                    {Object.entries(allDiffsModal.diffs).map(
                      ([entityName, diffData]) => (
                        <div key={entityName} className="col-md-6 mb-2">
                          <div className="card border-success">
                            <div className="card-body p-2">
                              <h6 className="card-title mb-1">{entityName}</h6>
                              <small className="text-muted">
                                {(() => {
                                  const summary = diffData.diff?.summary;
                                  if (summary && typeof summary === "object") {
                                    return `New: ${
                                      summary.new || 0
                                    }, Modified: ${
                                      summary.modified || 0
                                    }, Unchanged: ${summary.unchanged || 0}`;
                                  }
                                  return "Diff generated";
                                })()}
                              </small>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Push All Button */}
                <div className="mb-4">
                  <div className="d-flex gap-2 align-items-center">
                    <Button
                      variant="success"
                      size="lg"
                      onClick={pushAllArtifactsToGitHub}
                      disabled={isPushingAllToGitHub}
                    >
                      {isPushingAllToGitHub ? (
                        <>
                          <div
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                          >
                            <span className="visually-hidden">Loading...</span>
                          </div>
                          Pushing All to GitHub...
                        </>
                      ) : (
                        <>
                          <BiGitBranch /> Push All to GitHub
                        </>
                      )}
                    </Button>
                    <small className="text-info">
                      This will push artifacts for{" "}
                      {Object.keys(allDiffsModal.diffs).length} entities to
                      GitHub
                    </small>
                  </div>
                </div>

                {/* Detailed Diffs */}
                <div>
                  <h6>🔍 Detailed Diffs</h6>
                  <p className="text-muted mb-3">
                    Showing artifacts organized in the structured folder format:
                    ddl/, transformations/, and dml/ folders. Each entity's
                    artifacts are displayed below with their respective file
                    paths.
                  </p>
                  <Accordion>
                    {Object.entries(allDiffsModal.diffs).map(
                      ([entityName, diffData], index) => {
                        return (
                          <Accordion.Item
                            key={index}
                            eventKey={index.toString()}
                          >
                            <Accordion.Header>
                              📄 {entityName} - Artifacts & Diff Details
                            </Accordion.Header>
                            <Accordion.Body>
                              {diffData.diff ? (
                                <div>
                                  <Alert variant="info">
                                    <strong>Diff Summary:</strong>{" "}
                                    {diffData.diff.summary &&
                                    typeof diffData.diff.summary ===
                                      "object" ? (
                                      <span>
                                        Total:{" "}
                                        {diffData.diff.summary.total || 0}, New:{" "}
                                        {diffData.diff.summary.new || 0},
                                        Modified:{" "}
                                        {diffData.diff.summary.modified || 0},
                                        Unchanged:{" "}
                                        {diffData.diff.summary.unchanged || 0},
                                        Deleted:{" "}
                                        {diffData.diff.summary.deleted || 0}
                                      </span>
                                    ) : (
                                      String(
                                        diffData.diff.summary ||
                                          "No summary available"
                                      )
                                    )}
                                  </Alert>

                                  <div className="mb-3">
                                    <h6>📊 Changes Summary</h6>

                                    {/* New Files */}
                                    {diffData.diff.newFiles &&
                                      diffData.diff.newFiles.length > 0 && (
                                        <div className="mb-2">
                                          <h6 className="text-success">
                                            🆕 New Files:
                                          </h6>
                                          <ul>
                                            {diffData.diff.newFiles.map(
                                              (file, fileIndex) => (
                                                <li key={fileIndex}>
                                                  <strong>{file.path}</strong> (
                                                  {file.size} bytes)
                                                </li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}

                                    {/* Modified Files */}
                                    {diffData.diff.modifiedFiles &&
                                      diffData.diff.modifiedFiles.length >
                                        0 && (
                                        <div className="mb-2">
                                          <h6 className="text-warning">
                                            📝 Modified Files:
                                          </h6>
                                          <ul>
                                            {diffData.diff.modifiedFiles.map(
                                              (file, fileIndex) => (
                                                <li key={fileIndex}>
                                                  <strong>{file.path}</strong>
                                                  <span className="text-muted">
                                                    {" "}
                                                    (Size: {
                                                      file.existingSize
                                                    } → {file.newSize} bytes)
                                                  </span>
                                                </li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}

                                    {/* Deleted Files */}
                                    {diffData.diff.deletedFiles &&
                                      diffData.diff.deletedFiles.length > 0 && (
                                        <div className="mb-2">
                                          <h6 className="text-danger">
                                            🗑️ Deleted Files:
                                          </h6>
                                          <ul>
                                            {diffData.diff.deletedFiles.map(
                                              (file, fileIndex) => (
                                                <li key={fileIndex}>
                                                  <strong>{file.path}</strong> (
                                                  {file.size} bytes)
                                                </li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                  </div>

                                  {/* File Content Preview and Side-by-Side Diffs for only new/modified files */}
                                  {/* DDL Files Preview and Diff */}
                                  <div className="mb-4">
                                    <h6 className="text-primary">
                                      🏗️ DDL (Data Definition Language) Files
                                    </h6>

                                    {/* SQL File Side-by-Side Diff */}
                                    {((diffData.diff.newFiles || []).some((f) =>
                                      f.path.endsWith(
                                        `${entityName}_transform.sql`
                                      )
                                    ) ||
                                      (diffData.diff.modifiedFiles || []).some(
                                        (f) =>
                                          f.path.endsWith(
                                            `${entityName}_transform.sql`
                                          )
                                      )) &&
                                      diffData.artifacts?.artifacts?.sql &&
                                      renderSideBySideDiff(
                                        `curated/ddl/${entityName}/sql/${entityName}_transform.sql`,
                                        diffData.artifacts.artifacts.sql,
                                        diffData.previousVersions?.sql,
                                        "sql"
                                      )}

                                    {/* PySpark File Side-by-Side Diff */}
                                    {((diffData.diff.newFiles || []).some((f) =>
                                      f.path.endsWith(
                                        `${entityName}_transform.py`
                                      )
                                    ) ||
                                      (diffData.diff.modifiedFiles || []).some(
                                        (f) =>
                                          f.path.endsWith(
                                            `${entityName}_transform.py`
                                          )
                                      )) &&
                                      diffData.artifacts?.artifacts?.pyspark &&
                                      renderSideBySideDiff(
                                        `curated/ddl/${entityName}/pyspark/${entityName}_transform.py`,
                                        diffData.artifacts.artifacts.pyspark,
                                        diffData.previousVersions?.pyspark,
                                        "pyspark"
                                      )}
                                  </div>

                                  {/* DML Files Preview and Diff */}
                                  <div className="mb-4">
                                    <h6 className="text-warning">
                                      📝 DML (Data Manipulation Language) Files
                                    </h6>

                                    {/* DML SQL File Side-by-Side Diff */}
                                    {((diffData.diff.newFiles || []).some((f) =>
                                      f.path.endsWith(`${entityName}_dml.sql`)
                                    ) ||
                                      (diffData.diff.modifiedFiles || []).some(
                                        (f) =>
                                          f.path.endsWith(
                                            `${entityName}_dml.sql`
                                          )
                                      )) &&
                                      diffData.artifacts?.artifacts?.dmlSql &&
                                      renderSideBySideDiff(
                                        `curated/dml/${entityName}/sql/${entityName}_dml.sql`,
                                        diffData.artifacts.artifacts.dmlSql,
                                        diffData.previousVersions?.dmlSql,
                                        "dml"
                                      )}

                                    {/* DML PySpark File Side-by-Side Diff */}
                                    {((diffData.diff.newFiles || []).some((f) =>
                                      f.path.endsWith(`${entityName}_dml.py`)
                                    ) ||
                                      (diffData.diff.modifiedFiles || []).some(
                                        (f) =>
                                          f.path.endsWith(
                                            `${entityName}_dml.py`
                                          )
                                      )) &&
                                      diffData.artifacts?.artifacts
                                        ?.dmlPySpark &&
                                      renderSideBySideDiff(
                                        `curated/dml/${entityName}/pyspark/${entityName}_dml.py`,
                                        diffData.artifacts.artifacts.dmlPySpark,
                                        diffData.previousVersions?.dmlPySpark,
                                        "dml"
                                      )}
                                  </div>

                                  {/* Transformations Files Preview and Diff */}
                                  <div className="mb-4">
                                    <h6 className="text-success">
                                      🔄 Transformations Files
                                    </h6>

                                    {/* Transformations SQL File Side-by-Side Diff */}
                                    {((diffData.diff.newFiles || []).some((f) =>
                                      f.path.endsWith(
                                        `${entityName}_nlp_transform.sql`
                                      )
                                    ) ||
                                      (diffData.diff.modifiedFiles || []).some(
                                        (f) =>
                                          f.path.endsWith(
                                            `${entityName}_nlp_transform.sql`
                                          )
                                      )) &&
                                      diffData.artifacts?.artifacts?.nlpSql &&
                                      renderSideBySideDiff(
                                        `curated/transformations/${entityName}/sql/${entityName}_nlp_transform.sql`,
                                        diffData.artifacts.artifacts.nlpSql,
                                        diffData.previousVersions?.nlpSql,
                                        "nlp"
                                      )}

                                    {/* Transformations PySpark File Side-by-Side Diff */}
                                    {((diffData.diff.newFiles || []).some((f) =>
                                      f.path.endsWith(
                                        `${entityName}_nlp_transform.py`
                                      )
                                    ) ||
                                      (diffData.diff.modifiedFiles || []).some(
                                        (f) =>
                                          f.path.endsWith(
                                            `${entityName}_nlp_transform.py`
                                          )
                                      )) &&
                                      diffData.artifacts?.artifacts
                                        ?.nlpPySpark &&
                                      renderSideBySideDiff(
                                        `curated/transformations/${entityName}/pyspark/${entityName}_nlp_transform.py`,
                                        diffData.artifacts.artifacts.nlpPySpark,
                                        diffData.previousVersions?.nlpPySpark,
                                        "nlp"
                                      )}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center p-4">
                                  <div className="spinner-border" role="status">
                                    <span className="visually-hidden">
                                      Loading...
                                    </span>
                                  </div>
                                  <p className="mt-2">Generating diff...</p>
                                </div>
                              )}
                            </Accordion.Body>
                          </Accordion.Item>
                        );
                      }
                    )}
                  </Accordion>
                </div>
              </div>
            ) : (
              <div className="text-center p-5">
                <p className="text-muted">
                  No diffs generated yet. Click the button to start generating
                  diffs.
                </p>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setAllDiffsModal({ open: false, diffs: {} })}
            >
              Close
            </Button>
            {Object.keys(allDiffsModal.diffs).length > 0 && (
              <Button
                variant="success"
                onClick={pushAllArtifactsToGitHub}
                disabled={isPushingAllToGitHub}
              >
                {isPushingAllToGitHub ? "🔄 Pushing..." : "Push All to GitHub"}
              </Button>
            )}
          </Modal.Footer>
        </Modal>
      )}
      {/* Success Dialog */}
      {successDialog.open && (
        <Modal
          show={successDialog.open}
          onHide={() =>
            setSuccessDialog({
              open: false,
              message: null,
              commitUrl: null,
              repositoryUrl: null,
              prUrl: null,
            })
          }
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>🎉 Successfully Pushed to GitHub!</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div style={{ whiteSpace: "pre-line", fontSize: "14px" }}>
              {successDialog.message}
            </div>

            <div className="mt-4">
              <h6>Quick Links:</h6>
              <div className="d-flex flex-column gap-2">
                {successDialog.prUrl && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => window.open(successDialog.prUrl, "_blank")}
                    className="text-start"
                  >
                    🔀 View Pull Request on GitHub
                  </Button>
                )}
                {successDialog.commitUrl && (
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() =>
                      window.open(successDialog.commitUrl, "_blank")
                    }
                    className="text-start"
                  >
                    📝 View Commit on GitHub
                  </Button>
                )}
                {successDialog.repositoryUrl && (
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() =>
                      window.open(successDialog.repositoryUrl, "_blank")
                    }
                    className="text-start"
                  >
                    📁 View Repository:{" "}
                    {successDialog.repositoryUrl.split("/").slice(-2).join("/")}
                  </Button>
                )}
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() =>
                setSuccessDialog({
                  open: false,
                  message: null,
                  commitUrl: null,
                  repositoryUrl: null,
                  prUrl: null,
                })
              }
            >
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      )}
      <ColumnETLModal
        open={etlModal.open}
        handleClose={() => setEtlModal({ ...etlModal, open: false })}
        column={etlModal.column}
        entityColumns={rawAttributes}
        onAcceptCode={handleAcceptEntityNLP}
      />
      {/* NLP Artifacts Manager Modal */}
      <NLPArtifactsManager
        show={showNLPArtifactsModal}
        onHide={() => setShowNLPArtifactsModal(false)}
        entityName={null}
      />
    </>
  );
}

export default CuratedLandingZonePage;
