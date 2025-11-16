import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import aiIcon from "../assets/ai-icon.svg";
import EditConsumptionEntityMappingsPage from "./EditGoldEntityMappingsPage";
import CanvasHeader from "../components/CanvasHeader";
import CanvasArtifactsGenerator from "../components/CanvasArtifactsGenerator";
import ConsumptionETLTransformationsManager from "../components/ConsumptionETLTransformationsManager";
import {
  Button,
  Form,
  Table,
  OverlayTrigger,
  Tooltip,
  Badge,
  Image,
  Modal,
  Collapse,
  Accordion,
  Alert,
  Card,
  Row,
  Col,
} from "react-bootstrap";
import {
  BiBarChartAlt2,
  BiPlus,
  BiShuffle,
  BiSearch,
  BiFilter,
  BiMenu,
  BiCategory,
  BiPencil,
  // BiTrash,
  BiShow,
  BiSpreadsheet,
  BiSolidData,
  BiChevronDown,
  BiChevronUp,
  BiChevronLeft,
  BiChevronRight,
  BiCopyAlt,
  BiGitBranch,
} from "react-icons/bi";
import axios from "axios";
import Papa from "papaparse";
import ConsumptionCanvasEmbedded from "../components/ConsumptionCanvasEmbedded";

function ConsumptionLandingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [entities, setEntities] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [rawEntities, setRawEntities] = useState([]);
  const [curatedEntities, setCuratedEntities] = useState([]);
  const [fileData, setFileData] = useState([]);

  // New state for consumption files and mappings
  const [consumptionFiles, setConsumptionFiles] = useState([]);
  const [showCreateConsumptionModal, setShowCreateConsumptionModal] =
    useState(false);
  const [newConsumptionFile, setNewConsumptionFile] = useState({
    name: "",
    description: "",
    entities: [],
    joinRelationships: [],
  });
  const [editingConsumptionFile, setEditingConsumptionFile] = useState(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [currentMapping, setCurrentMapping] = useState({
    primaryKey: "",
    targetEntity: "",
    foreignKey: "",
    joinType: "INNER",
  });

  const [showDescModal, setShowDescModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleDescShow = (file) => {
    setSelectedFile(file);
    setShowDescModal(true);
  };

  const [openId, setOpenId] = useState(null);
  const handleToggle = (id) => {
    setOpenId(openId === id ? null : id);
  };

  // Add state for stepper/modal
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [selectedEntities, setSelectedEntities] = useState([]); // Step 1
  const [outputColumns, setOutputColumns] = useState([]); // [{name, sourceEntity, sourceField, aggregation, groupBy}]
  const [consumptionFileName, setConsumptionFileName] = useState(""); // Step 3
  const [consumptionFileDesc, setConsumptionFileDesc] = useState("");

  // New state for fetching real columns for selected entities
  const [entityColumnsMap, setEntityColumnsMap] = useState({});
  const [loadingColumns, setLoadingColumns] = useState(false);

  // --- BEGIN: AI Service Fetch for Consumption Files ---
  const [consumptionData, setConsumptionData] = useState({});
  const [csvLoaded, setCsvLoaded] = useState(false);
  const [loadingAI, setLoadingAI] = useState(true);

  // Pagination state for consumption files
  const [currentPage, setCurrentPage] = useState(1);
  const [entitiesPerPage, setEntitiesPerPage] = useState(15);
  const [totalEntities, setTotalEntities] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  // View Records modal state
  const [viewingRecords, setViewingRecords] = useState(null); // file.name
  const [sampleRecords, setSampleRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsError, setRecordsError] = useState("");

  // View Entities modal state
  const [showViewEntitiesModal, setShowViewEntitiesModal] = useState(false);

  // Show Join Relations modal state
  const [showJoinRelationsModal, setShowJoinRelationsModal] = useState(false);
  const [selectedFileForRelations, setSelectedFileForRelations] =
    useState(null);

  // Add Entity to Consumption modal state
  const [showAddEntityModal, setShowAddEntityModal] = useState(false);
  const [newJoinRelationship, setNewJoinRelationship] = useState({
    primaryKey: "",
    targetEntity: "",
    foreignKey: "",
    joinType: "INNER",
  });
  const [loadingColumnsForJoin, setLoadingColumnsForJoin] = useState({});

  // View state for tabular menu
  const [currentView, setCurrentView] = useState(
    searchParams.get("view") || "table"
  ); // "table" or "canvas"
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCanvasHeader, setExpandedCanvasHeader] = useState(null);

  // --- BEGIN: Artifacts Generation State (from CuratedLandingZonePage) ---
  const [entityArtifacts, setEntityArtifacts] = useState({}); // Store entity artifacts (SQL, PySpark code)
  const [entityNLPData, setEntityNLPData] = useState({}); // Store entity NLP transformations

  // Artifacts generation state
  const [artifactsModal, setArtifactsModal] = useState({
    open: false,
    artifacts: null,
  });
  const [diffModal, setDiffModal] = useState({
    open: false,
    diff: null,
    entityName: "",
  });
  // const [isGeneratingArtifacts, setIsGeneratingArtifacts] = useState(false);
  const [isGeneratingDiff, setIsGeneratingDiff] = useState(false);
  const [isPushingToGitHub, setIsPushingToGitHub] = useState(false);
  const [githubConnection, setGithubConnection] = useState(null);
  const [allDiffs, setAllDiffs] = useState({});
  const [isGeneratingAllDiffs, setIsGeneratingAllDiffs] = useState(false);
  const [isPushingAllToGitHub, setIsPushingAllToGitHub] = useState(false);
  const [allDiffsModal, setAllDiffsModal] = useState({
    open: false,
    diffs: {},
  });
  const [diffGenerationProgress, setDiffGenerationProgress] = useState({
    current: 0,
    total: 0,
    percentage: 0,
    currentEntity: "",
  });
  const [successDialog, setSuccessDialog] = useState({
    open: false,
    message: null,
    commitUrl: null,
    repositoryUrl: null,
    prUrl: null,
  });
  // --- END: Artifacts Generation State ---

  // Canvas header modals state
  const [showArtifactsGenerator, setShowArtifactsGenerator] = useState(false);
  const [showAcceptedTransformations, setShowAcceptedTransformations] =
    useState(false);

  // Function to handle switching to canvas view from EditGoldEntityMappingsPage
  const handleSwitchToCanvas = (entityName, records) => {
    setCurrentView("canvas");
  };

  // Debounce search term to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load persisted artifacts from localStorage on component mount
  useEffect(() => {
    try {
      const persistedArtifacts = localStorage.getItem("entityArtifacts");
      if (persistedArtifacts) {
        const parsedArtifacts = JSON.parse(persistedArtifacts);
        setEntityArtifacts(parsedArtifacts);
      }
    } catch (error) {
      console.error("Error loading persisted artifacts:", error);
    }
  }, []);

  // Persist artifacts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("entityArtifacts", JSON.stringify(entityArtifacts));
  }, [entityArtifacts]);

  // Check GitHub connection on component mount
  useEffect(() => {
    checkGitHubConnection();
  }, []);

  // Function to check GitHub connection
  const checkGitHubConnection = async () => {
    try {
      const response = await axios.get("/api/github/active");

      if (response.data.success && response.data.data) {
        setGithubConnection(response.data.data);
      } else {
        setGithubConnection(null);

        // Debug: Check if there are any connections at all
        try {
          const debugResponse = await axios.get("/api/github/debug");
        } catch (debugError) {}
      }
    } catch (error) {
      setGithubConnection(null);
    }
  };

  // Function to handle accepting entity NLP data
  const handleAcceptEntityNLP = async (nlpData) => {
    try {
      // Convert curated entity name to raw entity name for consistent storage
      // e.g., "curated.users" -> "users"
      const rawEntityName = nlpData.entityName.replace("curated.", "");

      // Store the entity NLP data
      setEntityNLPData((prev) => ({
        ...prev,
        [rawEntityName]: nlpData,
      }));

      // Add the generated SQL and PySpark code directly to the entity artifacts
      const newArtifacts = {
        sql: nlpData.sqlCode || "",
        pyspark: nlpData.pysparkCode || "",
        nlpDescription: nlpData.nlpDescription || "",
        entityColumns: nlpData.entityColumns || [],
      };

      setEntityArtifacts((prev) => {
        const updated = {
          ...prev,
          [rawEntityName]: newArtifacts,
        };
        return updated;
      });

      // Show success message
      alert(
        `Entity NLP transformation for ${nlpData.entityName} has been added to artefacts!`
      );
    } catch (error) {
      console.error("Error accepting entity NLP:", error);
      throw error;
    }
  };

  // Clear entity artifacts for a specific entity
  const clearEntityArtifacts = (entityName) => {
    // Convert curated entity name to raw entity name for consistent lookup
    const rawEntityName = entityName.replace("curated.", "");

    setEntityArtifacts((prev) => {
      const newArtifacts = { ...prev };
      delete newArtifacts[rawEntityName];
      return newArtifacts;
    });

    setEntityNLPData((prev) => {
      const newNLPData = { ...prev };
      delete newNLPData[rawEntityName];
      return newNLPData;
    });
  };

  // Extract entity schema for consumption files
  const extractEntitySchema = (consumptionFile) => {
    const entityName = consumptionFile.name;
    const consumptionEntityName = `consumption.${consumptionFile.name}`;

    // Get entities and their attributes from the consumption file
    const entities = consumptionFile.entities || [];
    const joinRelationships = consumptionFile.joinRelationships || [];
    const outputColumns = consumptionFile.outputColumns || [];

    // Create raw attributes from output columns
    const rawAttributes = outputColumns.map((col) => col.name);

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

    return {
      entityName: entityName,
      curatedEntityName: consumptionEntityName,
      rawAttributes: rawAttributes,
      curatedAttributes: curatedAttributes,
      mappings: mappings,
      dataTypes: {},
      constraints: {},
      entities: entities,
      joinRelationships: joinRelationships,
      outputColumns: outputColumns,
    };
  };

  // Generate all artifacts for consumption files
  const generateAllArtifacts = async () => {
    if (consumptionFiles.length === 0) {
      alert("No consumption files found to generate artifacts for.");
      return;
    }

    // setIsGeneratingArtifacts(true);
    try {
      const allArtifacts = {};

      // Generate artifacts for each consumption file
      for (const consumptionFile of consumptionFiles) {
        const entityName = consumptionFile.name;

        // Extract schema and attributes from consumption file
        const schemaData = extractEntitySchema(consumptionFile);

        // Create transformations object with schema-based attributes
        const transformations = {
          entityName: schemaData.entityName,
          curatedEntityName: schemaData.curatedEntityName,
          rawAttributes: schemaData.rawAttributes,
          curatedAttributes: schemaData.curatedAttributes,
          mappings: schemaData.mappings,
          dataTypes: schemaData.dataTypes,
          constraints: schemaData.constraints,
          entities: schemaData.entities,
          joinRelationships: schemaData.joinRelationships,
          outputColumns: schemaData.outputColumns,
          columnRules: {},
          operatorRules: {},
          concatenationRules: [],
          entityNLPRules: [],
        };

        // Call the backend to generate artifacts
        const response = await axios.post("/api/artifacts/generate", {
          entityName: entityName,
          curatedEntityName: schemaData.curatedEntityName,
          transformations: transformations,
        });

        // Use only backend-generated artifacts (NLP artifacts are stored separately)
        const backendArtifacts = response.data.data.artifacts;

        allArtifacts[entityName] = {
          sql: backendArtifacts?.sql || "",
          pyspark: backendArtifacts?.pyspark || "",
          // Include all other backend-generated artifacts
          // ...backendArtifacts,
        };
      }

      setArtifactsModal({ open: true, artifacts: allArtifacts });
    } catch (error) {
      alert("Failed to generate artifacts. Please try again.");
    } finally {
      // setIsGeneratingArtifacts(false);
    }
  };

  // Function to fetch AI consumption files with pagination
  const fetchAIConsumptionFiles = async (page = 1, limit = 15, search = "") => {
    setLoadingAI(true);
    try {
      // Build query parameters for pagination and search
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (search.trim()) {
        params.append("search", search.trim());
      }

      const res = await axios.get(
        `/api/ai-consumption-files?${params.toString()}`
      );
      setConsumptionData(res.data.consumptionData || {});

      // Update pagination state
      setTotalEntities(res.data.totalCount || 0);
      setTotalPages(res.data.totalPages || 0);

      // Replace consumption files with new paginated data
      const filesFromBackend = Array.isArray(res.data.files)
        ? res.data.files
        : [];
      setConsumptionFiles(filesFromBackend);
    } catch (err) {
      console.error("Error fetching AI consumption files:", err);
      // Set empty arrays on error to prevent further issues
      setConsumptionData({});
      setConsumptionFiles([]);
      setTotalEntities(0);
      setTotalPages(0);
    }
    setLoadingAI(false);
  };

  // Reset to first page when debounced search term changes and refetch data
  useEffect(() => {
    setCurrentPage(1);
    fetchAIConsumptionFiles(1, entitiesPerPage, debouncedSearchTerm);
  }, [debouncedSearchTerm]);

  // Refetch data when page changes
  useEffect(() => {
    fetchAIConsumptionFiles(currentPage, entitiesPerPage, debouncedSearchTerm);
  }, [currentPage]);

  useEffect(() => {
    fetchAIConsumptionFiles();
  }, []);

  // Load silver data files as curated entities
  useEffect(() => {
    const loadSilverDataFiles = async () => {
      try {
        // List of silver data files
        const silverDataFiles = [
          "silver_analyticsengine_customer_kpi.csv",
          "silver_analyticsengine_subscriber_kpi.csv",
          "silver_billingsystem_account.csv",
          "silver_billingsystem_contract.csv",
          "silver_billingsystem_customer_kpi.csv",
          "silver_billingsystem_customer_party.csv",
          "silver_billingsystem_dimorder.csv",
          "silver_billingsystem_dimorderitem.csv",
          "silver_billingsystem_invoice.csv",
          "silver_billingsystem_payment_method.csv",
          "silver_catalogdb_product.csv",
          "silver_provisioning_device_resource.csv",
          "silver_provisioning_service.csv",
          "silver_provisioning_subscriber.csv",
          "silver_salesforce_account.csv",
          "silver_salesforce_address.csv",
          "silver_salesforce_contact_point.csv",
          "silver_salesforce_customer_party.csv",
          "silver_salesforce_dimorder.csv",
          "silver_salesforce_dimorderitem.csv",
          "silver_usageplatform_fact_usage.csv",
        ];

        // Create file data objects for silver data files
        const silverFileData = silverDataFiles.map((filename) => ({
          key: `silver_data/${filename}`,
          location: `/silver_data/${filename}`,
          filename: filename,
          isSilverData: true,
        }));

        // Create entity names for silver data files
        const silverRawEntities = silverDataFiles.map(
          (filename) => `raw.${filename.replace(/\.[^/.]+$/, "")}`
        );
        const silverCuratedEntities = silverDataFiles.map(
          (filename) => `curated.${filename.replace(/\.[^/.]+$/, "")}`
        );

        // Add silver data to existing state
        setUploadedFiles((prev) => [...prev, ...silverDataFiles]);
        setFileData((prev) => [...prev, ...silverFileData]);
        setRawEntities((prev) => [...prev, ...silverRawEntities]);
        setCuratedEntities((prev) => [...prev, ...silverCuratedEntities]);
        setEntities((prev) => [
          ...prev,
          ...silverDataFiles.map((filename, idx) => ({
            raw: silverRawEntities[idx],
            curated: silverCuratedEntities[idx],
            filename: filename,
            isSilverData: true,
          })),
        ]);
      } catch (error) {
        console.error("Error loading silver data files:", error);
      }
    };

    loadSilverDataFiles();
  }, []);

  // Check for data passed from previous pages
  useEffect(() => {
    const stateData = location.state;
    if (
      stateData &&
      stateData.uploadedFiles &&
      stateData.uploadedFiles.length > 0
    ) {
      setUploadedFiles(stateData.uploadedFiles);
      setFileData(stateData.fileData || []);
      setRawEntities(stateData.rawEntities || []);
      setCuratedEntities(stateData.curatedEntities || []);
      setEntities(
        stateData.uploadedFiles.map((filename, idx) => ({
          raw:
            stateData.rawEntities[idx] ||
            `raw.${filename.replace(/\.[^/.]+$/, "")}`,
          curated:
            stateData.curatedEntities[idx] ||
            `curated.${filename.replace(/\.[^/.]+$/, "")}`,
          filename: filename,
        }))
      );
    }
  }, [location.state]);

  // Fetch real columns for selected entities from curated files (like EditEntityMappingsPage)
  useEffect(() => {
    async function fetchColumnsForEntities() {
      if (
        createStep === 2 &&
        selectedEntities.length > 0 &&
        fileData.length > 0
      ) {
        setLoadingColumns(true);
        const newMap = {};
        for (const entity of selectedEntities) {
          // Find the fileData for this entity (match by curated entity name)
          const idx = curatedEntities.findIndex((e) => e === entity);
          const fileInfo = fileData[idx];
          if (!fileInfo) continue;
          try {
            // Get file metadata from backend to get the S3 location
            const metadataResponse = await axios.get(
              `/api/file/${encodeURIComponent(fileInfo.key)}`
            );
            const locationUrl =
              metadataResponse.data.location || fileInfo.location;
            // Fetch the actual file content (CSV)
            const fileResponse = await axios.get(locationUrl);
            let fileContent = fileResponse.data;
            if (typeof fileContent === "string") {
              if (fileContent.charCodeAt(0) === 0xfeff)
                fileContent = fileContent.slice(1);
            } else if (typeof fileContent === "object") {
              fileContent = JSON.stringify(fileContent, null, 2);
            }
            // Parse CSV header
            const lines = fileContent
              .split(/\r?\n/)
              .filter((line) => line.trim() !== "");
            if (lines.length > 0) {
              const firstLine = lines[0];
              let delimiter = ",";
              if (firstLine.includes("\t")) delimiter = "\t";
              else if (firstLine.includes(";")) delimiter = ";";
              const columns = firstLine
                .split(delimiter)
                .map((h) => h.trim().replace(/^"|"$/g, ""));
              newMap[entity] = columns;
            }
          } catch (err) {
            newMap[entity] = [];
          }
        }
        setEntityColumnsMap(newMap);
        setLoadingColumns(false);
      }
      if (createStep !== 2) setEntityColumnsMap({});
    }
    fetchColumnsForEntities();
  }, [createStep, selectedEntities, fileData, curatedEntities]);

  const getEntityColumns = (entityName) => {
    return entityColumnsMap[entityName] || [];
  };

  const handleCreateConsumptionFile = () => {
    setNewConsumptionFile({
      name: "",
      description: "",
      entities: [],
      joinRelationships: [],
    });
    setShowCreateConsumptionModal(true);
  };

  const saveConsumptionFile = () => {
    if (!newConsumptionFile.name.trim()) {
      alert("Please enter a consumption file name.");
      return;
    }

    if (newConsumptionFile.entities.length === 0) {
      alert("Please add at least one entity to the consumption file.");
      return;
    }

    const consumptionFile = {
      id: Date.now(),
      name: newConsumptionFile.name.trim(),
      description: newConsumptionFile.description.trim(),
      entities: [...(newConsumptionFile.entities || [])],
      joinRelationships: [...(newConsumptionFile.joinRelationships || [])],
      createdAt: new Date().toISOString(),
      status: "draft",
    };

    setConsumptionFiles((prev) => [...prev, consumptionFile]);
    setShowCreateConsumptionModal(false);
    setNewConsumptionFile({
      name: "",
      description: "",
      entities: [],
      joinRelationships: [],
    });
  };

  const addEntityToConsumption = () => {
    if (!newConsumptionFile.entities.length) {
      // Add first entity (no join relationship needed)
      const firstEntity = entities[0];
      if (firstEntity) {
        setNewConsumptionFile((prev) => ({
          ...prev,
          entities: [firstEntity.curated],
        }));
      }
    } else {
      // Add additional entity with join relationship
      setShowMappingModal(true);
    }
  };

  const saveMapping = () => {
    if (
      !currentMapping.sourceEntity ||
      !currentMapping.primaryKey ||
      !currentMapping.targetEntity ||
      !currentMapping.foreignKey
    ) {
      alert("Please fill in all mapping fields.");
      return;
    }

    // Add the target entity to the consumption file
    setNewConsumptionFile((prev) => ({
      ...prev,
      entities: [...prev.entities, currentMapping.targetEntity],
      joinRelationships: [...prev.joinRelationships, { ...currentMapping }],
    }));

    setShowMappingModal(false);
    setCurrentMapping({
      primaryKey: "",
      targetEntity: "",
      foreignKey: "",
      joinType: "INNER",
    });
  };

  const removeEntityFromConsumption = (entityName) => {
    setNewConsumptionFile((prev) => ({
      ...prev,
      entities: prev.entities.filter((entity) => entity !== entityName),
      joinRelationships: prev.joinRelationships.filter(
        (rel) =>
          rel.targetEntity !== entityName && rel.sourceEntity !== entityName
      ),
    }));
  };

  const removeJoinRelationship = (index) => {
    setNewConsumptionFile((prev) => ({
      ...prev,
      joinRelationships: prev.joinRelationships.filter((_, i) => i !== index),
    }));
  };

  const handleDeleteConsumptionFile = (id) => {
    if (
      window.confirm("Are you sure you want to delete this consumption file?")
    ) {
      setConsumptionFiles((prev) => prev.filter((file) => file.id !== id));
    }
  };

  const handleEditConsumptionFile = (consumptionFile) => {
    setEditingConsumptionFile(consumptionFile);
    setNewConsumptionFile({
      name: consumptionFile.name,
      description: consumptionFile.description,
      entities: [...consumptionFile.entities],
      joinRelationships: [...consumptionFile.joinRelationships],
    });
    setShowCreateConsumptionModal(true);
  };

  const updateConsumptionFile = () => {
    if (!newConsumptionFile.name.trim()) {
      alert("Please enter a consumption file name.");
      return;
    }

    const updatedFile = {
      ...editingConsumptionFile,
      name: newConsumptionFile.name.trim(),
      description: newConsumptionFile.description.trim(),
      entities: [...newConsumptionFile.entities],
      joinRelationships: [...newConsumptionFile.joinRelationships],
      updatedAt: new Date().toISOString(),
    };

    setConsumptionFiles((prev) =>
      prev.map((file) =>
        file.id === editingConsumptionFile.id ? updatedFile : file
      )
    );
    setShowCreateConsumptionModal(false);
    setEditingConsumptionFile(null);
    setNewConsumptionFile({
      name: "",
      description: "",
      entities: [],
      joinRelationships: [],
    });
  };

  const getAvailableEntities = () => {
    return entities
      .map((entity) => entity.curated)
      .filter((entity) => !newConsumptionFile.entities.includes(entity));
  };

  // Helper: get all other selected entities for join options
  const getOtherEntities = (entity) =>
    selectedEntities.filter((e) => e !== entity);

  // Step 1: Entity selection UI
  const renderStep1 = () => (
    <div style={{ padding: 24, minWidth: 400 }}>
      <h3 style={{ color: "#7366ff" }}>Step 1: Select Entities</h3>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 500 }}>
          Choose curated entities to include:
        </label>
        <div style={{ marginTop: 8 }}>
          {curatedEntities.map((entity, idx) => (
            <div key={entity}>
              <label>
                <input
                  type="checkbox"
                  checked={selectedEntities.includes(entity)}
                  onChange={(e) => {
                    setSelectedEntities((prev) =>
                      e.target.checked
                        ? [...prev, entity]
                        : prev.filter((en) => en !== entity)
                    );
                  }}
                />
                <span style={{ marginLeft: 8 }}>{entity}</span>
              </label>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
        <button
          onClick={() => setShowCreateFlow(false)}
          style={{ padding: "8px 16px" }}
        >
          Cancel
        </button>
        <button
          onClick={() => setCreateStep(2)}
          disabled={selectedEntities.length < 2}
          style={{
            padding: "8px 16px",
            background: selectedEntities.length < 2 ? "#ccc" : "#7366ff",
            color: "white",
            border: "none",
            borderRadius: 4,
          }}
        >
          Next
        </button>
      </div>
    </div>
  );

  // Step 2: Output column builder UI
  const aggregationOptions = ["NONE", "SUM", "MAX", "MIN", "COUNT"];
  const renderStep2 = () => (
    <div style={{ padding: 24, minWidth: 700 }}>
      <h3 style={{ color: "#7366ff" }}>Step 2: Define Output Columns</h3>
      <div style={{ marginBottom: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa" }}>
              <th>Output Column Name</th>
              <th>Source Entity</th>
              <th>Source Field</th>
              <th>Aggregation</th>
              <th>Group By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {outputColumns.map((col, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    type="text"
                    value={col.name}
                    onChange={(e) =>
                      setOutputColumns((prev) =>
                        prev.map((c, i) =>
                          i === idx ? { ...c, name: e.target.value } : c
                        )
                      )
                    }
                    placeholder="e.g. id, name, total_amount_spent"
                    style={{ width: 140 }}
                  />
                </td>
                <td>
                  <select
                    value={col.sourceEntity}
                    onChange={(e) =>
                      setOutputColumns((prev) =>
                        prev.map((c, i) =>
                          i === idx
                            ? {
                                ...c,
                                sourceEntity: e.target.value,
                                sourceField: "",
                                groupBy: "",
                              }
                            : c
                        )
                      )
                    }
                  >
                    <option value="">Select</option>
                    {selectedEntities.map((entity) => (
                      <option key={entity} value={entity}>
                        {entity}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={col.sourceField}
                    onChange={(e) =>
                      setOutputColumns((prev) =>
                        prev.map((c, i) =>
                          i === idx ? { ...c, sourceField: e.target.value } : c
                        )
                      )
                    }
                    disabled={!col.sourceEntity}
                  >
                    <option value="">Select</option>
                    {col.sourceEntity &&
                      getEntityColumns(col.sourceEntity).map((field) => (
                        <option key={field} value={field}>
                          {field}
                        </option>
                      ))}
                  </select>
                </td>
                <td>
                  <select
                    value={col.aggregation || "NONE"}
                    onChange={(e) =>
                      setOutputColumns((prev) =>
                        prev.map((c, i) =>
                          i === idx ? { ...c, aggregation: e.target.value } : c
                        )
                      )
                    }
                    disabled={!col.sourceField}
                  >
                    {aggregationOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={col.groupBy || ""}
                    onChange={(e) =>
                      setOutputColumns((prev) =>
                        prev.map((c, i) =>
                          i === idx ? { ...c, groupBy: e.target.value } : c
                        )
                      )
                    }
                    disabled={
                      !(
                        col.aggregation &&
                        col.aggregation !== "NONE" &&
                        col.sourceEntity
                      )
                    }
                  >
                    <option value="">None</option>
                    {col.sourceEntity &&
                      getEntityColumns(col.sourceEntity).map((field) => (
                        <option key={field} value={field}>
                          {field}
                        </option>
                      ))}
                  </select>
                </td>
                <td>
                  <button
                    onClick={() =>
                      setOutputColumns((prev) =>
                        prev.filter((_, i) => i !== idx)
                      )
                    }
                    style={{
                      background: "#dc3545",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      padding: "2px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={6}>
                <button
                  onClick={() =>
                    setOutputColumns((prev) => [
                      ...prev,
                      {
                        name: "",
                        sourceEntity: "",
                        sourceField: "",
                        aggregation: "NONE",
                        groupBy: "",
                      },
                    ])
                  }
                  style={{
                    background: "#7366ff",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    padding: "6px 16px",
                    cursor: "pointer",
                  }}
                >
                  + Add Output Column
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
      >
        <button
          onClick={() => setCreateStep(1)}
          style={{ padding: "8px 16px" }}
        >
          Back
        </button>
        <button
          onClick={() => setCreateStep(3)}
          disabled={
            outputColumns.length === 0 ||
            outputColumns.some(
              (col) => !col.name || !col.sourceEntity || !col.sourceField
            )
          }
          style={{
            padding: "8px 16px",
            background:
              outputColumns.length === 0 ||
              outputColumns.some(
                (col) => !col.name || !col.sourceEntity || !col.sourceField
              )
                ? "#ccc"
                : "#7366ff",
            color: "white",
            border: "none",
            borderRadius: 4,
          }}
        >
          Next
        </button>
      </div>
    </div>
  );

  // Step 3: Name and save
  const renderStep3 = () => (
    <div style={{ padding: 24, minWidth: 400 }}>
      <h3 style={{ color: "#7366ff" }}>Step 3: Name Consumption File</h3>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 500 }}>Consumption File Name:</label>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
          }}
        >
          <span style={{ color: "#7366ff", fontWeight: 500 }}>
            consumption.
          </span>
          <input
            type="text"
            value={consumptionFileName}
            onChange={(e) => setConsumptionFileName(e.target.value)}
            placeholder="Enter file name"
            style={{
              flex: 1,
              padding: 8,
              border: "2px solid #7366ff",
              borderRadius: 4,
            }}
          />
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 500 }}>Description:</label>
        <textarea
          value={consumptionFileDesc}
          onChange={(e) => setConsumptionFileDesc(e.target.value)}
          placeholder="Describe this consumption file..."
          style={{
            width: "100%",
            minHeight: 60,
            padding: 8,
            border: "2px solid #7366ff",
            borderRadius: 4,
          }}
        />
      </div>
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
      >
        <button
          onClick={() => setCreateStep(2)}
          style={{ padding: "8px 16px" }}
        >
          Back
        </button>
        <button
          onClick={() => {
            setConsumptionFiles((prev) => [
              ...prev,
              {
                id: Date.now(),
                name: consumptionFileName.trim(),
                description: consumptionFileDesc.trim(),
                entities: [...selectedEntities],
                outputColumns: [...outputColumns],
                createdAt: new Date().toISOString(),
                status: "draft",
              },
            ]);
            setShowCreateFlow(false);
            setCreateStep(1);
            setSelectedEntities([]);
            setOutputColumns([]);
            setConsumptionFileName("");
            setConsumptionFileDesc("");
          }}
          disabled={!consumptionFileName.trim()}
          style={{
            padding: "8px 16px",
            background: !consumptionFileName.trim() ? "#ccc" : "#7366ff",
            color: "white",
            border: "none",
            borderRadius: 4,
          }}
        >
          Create
        </button>
      </div>
    </div>
  );

  // Handler for View Records button
  const handleViewRecords = (fileName) => {
    setViewingRecords(fileName);
    setLoadingRecords(true);
    setRecordsError("");
    let records = [];

    // Handle AI-generated files from consumptionData
    const fileData = consumptionData[fileName];
    if (fileData && Array.isArray(fileData)) {
      records = fileData.slice(0, 10);
    }

    setTimeout(() => {
      setSampleRecords(records);
      setLoadingRecords(false);
    }, 300); // Simulate loading
  };
  const closeRecordsView = () => {
    setViewingRecords(null);
    setSampleRecords([]);
    setLoadingRecords(false);
    setRecordsError("");
  };

  // Handler for Show Join Relations button
  const handleShowJoinRelations = (file) => {
    setSelectedFileForRelations(file);
    setShowJoinRelationsModal(true);
  };

  const closeJoinRelationsView = () => {
    setShowJoinRelationsModal(false);
    setSelectedFileForRelations(null);
  };

  // Helper function to get available entities for joining
  const getAvailableEntitiesForJoin = () => {
    if (!selectedFileForRelations) return [];
    const currentEntities = selectedFileForRelations.entities || [];
    return curatedEntities.filter(
      (entity) => !currentEntities.includes(entity)
    );
  };

  // Helper function to get columns for an entity
  const getEntityColumnsForJoin = (entityName) => {
    // First try to get from the entity columns map (for selected entities in create flow)
    if (entityColumnsMap[entityName]) {
      return entityColumnsMap[entityName];
    }

    // Try to get from the existing getEntityColumns function
    const existingColumns = getEntityColumns(entityName);
    if (existingColumns.length > 0) {
      return existingColumns;
    }

    // Handle AI-generated files from consumptionData
    if (consumptionData[entityName] && consumptionData[entityName].length > 0) {
      const columns = Object.keys(consumptionData[entityName][0]);

      return columns;
    }

    // For curated entities, return common column names based on entity type
    const entityIndex = curatedEntities.findIndex((e) => e === entityName);

    if (entityIndex >= 0) {
      let fallbackColumns = [];

      if (entityName.toLowerCase().includes("customer")) {
        fallbackColumns = [
          "customer_id",
          "customer_name",
          "email",
          "phone",
          "address",
          "created_at",
        ];
      } else if (entityName.toLowerCase().includes("order")) {
        fallbackColumns = [
          "order_id",
          "customer_id",
          "order_date",
          "total_amount",
          "status",
          "created_at",
        ];
      } else if (entityName.toLowerCase().includes("product")) {
        fallbackColumns = [
          "product_id",
          "product_name",
          "category",
          "price",
          "description",
          "created_at",
        ];
      } else if (entityName.toLowerCase().includes("payment")) {
        fallbackColumns = [
          "payment_id",
          "order_id",
          "amount",
          "payment_method",
          "payment_date",
          "status",
        ];
      } else if (entityName.toLowerCase().includes("review")) {
        fallbackColumns = [
          "review_id",
          "customer_id",
          "product_id",
          "rating",
          "comment",
          "review_date",
        ];
      } else if (entityName.toLowerCase().includes("inventory")) {
        fallbackColumns = [
          "inventory_id",
          "product_id",
          "warehouse_id",
          "quantity",
          "last_updated",
        ];
      } else if (entityName.toLowerCase().includes("warehouse")) {
        fallbackColumns = [
          "warehouse_id",
          "warehouse_name",
          "location",
          "capacity",
          "created_at",
        ];
      } else if (entityName.toLowerCase().includes("shipping")) {
        fallbackColumns = [
          "shipping_id",
          "order_id",
          "tracking_number",
          "shipping_method",
          "shipping_date",
          "status",
        ];
      } else {
        fallbackColumns = ["id", "name", "created_at", "updated_at"];
      }

      return fallbackColumns;
    }

    return [];
  };

  // Handle adding entity to consumption file
  const handleAddEntityToConsumption = () => {
    setNewJoinRelationship({
      primaryKey: "",
      targetEntity: "",
      foreignKey: "",
      joinType: "INNER",
    });
    setShowAddEntityModal(true);
  };

  // Fetch columns for entities when they're selected in the add entity modal
  const fetchColumnsForEntity = async (entityName) => {
    if (!entityName) return;

    // Check if we already have columns for this entity
    if (entityColumnsMap[entityName]) {
      return;
    }

    // Set loading state for this entity
    setLoadingColumnsForJoin((prev) => ({
      ...prev,
      [entityName]: true,
    }));

    const entityIndex = curatedEntities.findIndex((e) => e === entityName);

    if (entityIndex >= 0 && fileData[entityIndex]) {
      try {
        // Get file metadata from backend to get the S3 location
        const metadataResponse = await axios.get(
          `/api/file/${encodeURIComponent(fileData[entityIndex].key)}`
        );

        const locationUrl =
          metadataResponse.data.location || fileData[entityIndex].location;

        // Fetch the actual file content (CSV)
        const fileResponse = await axios.get(locationUrl);
        let fileContent = fileResponse.data;

        if (typeof fileContent === "string") {
          if (fileContent.charCodeAt(0) === 0xfeff)
            fileContent = fileContent.slice(1);
        } else if (typeof fileContent === "object") {
          fileContent = JSON.stringify(fileContent, null, 2);
        }

        // Parse CSV header
        const lines = fileContent
          .split(/\r?\n/)
          .filter((line) => line.trim() !== "");

        if (lines.length > 0) {
          const firstLine = lines[0];

          let delimiter = ",";
          if (firstLine.includes("\t")) delimiter = "\t";
          else if (firstLine.includes(";")) delimiter = ";";

          const columns = firstLine
            .split(delimiter)
            .map((h) => h.trim().replace(/^"|"$/g, ""));

          // Update the entity columns map
          setEntityColumnsMap((prev) => {
            const newMap = {
              ...prev,
              [entityName]: columns,
            };

            return newMap;
          });
        }
      } catch (err) {
        console.error(`Error fetching columns for ${entityName}:`, err);
      }
    }

    // Clear loading state for this entity
    setLoadingColumnsForJoin((prev) => ({
      ...prev,
      [entityName]: false,
    }));
  };

  // Save the new join relationship
  const saveNewJoinRelationship = () => {
    if (
      !newJoinRelationship.primaryKey ||
      !newJoinRelationship.targetEntity ||
      !newJoinRelationship.foreignKey
    ) {
      alert("Please fill in all fields for the join relationship.");
      return;
    }

    // Create the join relationship with the consumption file as source
    const joinRelationship = {
      sourceEntity: selectedFileForRelations.name, // Use consumption file name as source
      primaryKey: newJoinRelationship.primaryKey,
      targetEntity: newJoinRelationship.targetEntity,
      foreignKey: newJoinRelationship.foreignKey,
      joinType: newJoinRelationship.joinType,
    };

    // Update the consumption file with new entity and relationship
    const updatedFile = {
      ...selectedFileForRelations,
      entities: [
        ...(selectedFileForRelations.entities || []),
        newJoinRelationship.targetEntity,
      ],
      joinRelationships: [
        ...(selectedFileForRelations.joinRelationships || []),
        joinRelationship,
      ],
    };

    // Update the consumption files list
    setConsumptionFiles((prev) =>
      prev.map((file) =>
        file.id === selectedFileForRelations.id ? updatedFile : file
      )
    );

    // Update the selected file for relations
    setSelectedFileForRelations(updatedFile);

    // Close modal and reset form
    setShowAddEntityModal(false);
    setNewJoinRelationship({
      primaryKey: "",
      targetEntity: "",
      foreignKey: "",
      joinType: "INNER",
    });
  };

  const closeAddEntityModal = () => {
    setShowAddEntityModal(false);
    setNewJoinRelationship({
      primaryKey: "",
      targetEntity: "",
      foreignKey: "",
      joinType: "INNER",
    });
  };

  // Generate all diffs for consumption files
  const generateAllDiffs = async () => {
    if (!githubConnection) {
      alert("Please configure GitHub connection in settings first.");
      return;
    }

    setIsGeneratingAllDiffs(true);
    setAllDiffs({});

    // Initialize progress
    const totalFiles = consumptionFiles.length;
    setDiffGenerationProgress({
      current: 0,
      total: totalFiles,
      percentage: 0,
      currentEntity: "Preparing...",
    });

    try {
      // Prepare all consumption files data for batch processing
      const consumptionFilesData = consumptionFiles.map((consumptionFile) => {
        const entityName = consumptionFile.name;
        const schemaData = extractEntitySchema(consumptionFile);

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
            entities: schemaData.entities,
            joinRelationships: schemaData.joinRelationships,
            outputColumns: schemaData.outputColumns,
            columnRules: {},
            operatorRules: {},
            concatenationRules: [],
            entityNLPRules: [],
          },
        };
      });

      const githubConfig = {
        repositoryUrl: githubConnection.repositoryUrl,
        branch: githubConnection.branch,
        username: githubConnection.username,
        password: githubConnection.password,
      };

      // Update progress to show processing
      setDiffGenerationProgress({
        current: 0,
        total: totalFiles,
        percentage: 0,
        currentEntity: "Processing all consumption files...",
      });

      // Call the new optimized endpoint that processes all consumption files in parallel
      const response = await axios.post("/api/artifacts/generate-all-diffs", {
        entities: consumptionFilesData,
        githubConfig: githubConfig,
        folderPath: "consumption",
      });

      const {
        diffs: allDiffs,
        artifacts: allArtifacts,
        summary,
      } = response.data.data;

      // Transform the response to match the expected format
      const transformedDiffs = {};

      for (const [entityName, diffData] of Object.entries(allDiffs)) {
        // Find the original consumption file to get schema data
        const consumptionFile = consumptionFiles.find(
          (f) => f.name === entityName
        );
        const schemaData = consumptionFile
          ? extractEntitySchema(consumptionFile)
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
          transformedDiffs[entityName] = {
            diff: diffData,
            artifacts: allArtifacts[entityName],
            schema: schemaData,
            previousVersions: diffData.previousVersions || {
              sql: null,
              pyspark: null,
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
        console.warn(
          `${summary.failed} consumption files failed to generate diffs`
        );
      }

      // Reset progress
      setDiffGenerationProgress({
        current: 0,
        total: 0,
        percentage: 0,
        currentEntity: "",
      });
    } catch (error) {
      alert(
        "Failed to generate diffs for all consumption files. Please try again."
      );

      // Reset progress on error
      setDiffGenerationProgress({
        current: 0,
        total: 0,
        percentage: 0,
        currentEntity: "",
      });
    } finally {
      setIsGeneratingAllDiffs(false);
    }
  };

  // Push all artifacts to GitHub
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
        // Get consumption file and extract schema using the new function
        const consumptionFile = consumptionFiles.find(
          (f) => f.name === entityName
        );

        if (!consumptionFile) {
          console.error(`Consumption file not found: ${entityName}`);
          continue;
        }

        // Extract schema using the new function
        const schemaData = extractEntitySchema(consumptionFile);
        const {
          rawAttributes,
          curatedAttributes,
          mappings,
          dataTypes,
          constraints,
          curatedEntityName,
          entities,
          joinRelationships,
          outputColumns,
        } = schemaData;

        // Generate artifacts for this consumption file
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
            entities: entities,
            joinRelationships: joinRelationships,
            outputColumns: outputColumns,
            columnRules: {},
            operatorRules: {},
            concatenationRules: [],
            entityNLPRules: [],
          },
          pushToGitHub: false, // Don't push individually
        });

        // Add artifacts to the collection
        allArtifacts.push({
          entityName: entityName,
          artifacts: response.data.data.artifacts,
        });
        entityNames.push(entityName);
      }

      // Create a new branch name with timestamp
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const newBranchName = `nexa-ai-consumption-${timestamp}`;

      const pushResponse = await axios.post(
        "/api/artifacts/push-all-to-github",
        {
          artifacts: allArtifacts,
          githubConfig: githubConfig,
          newBranchName: newBranchName,
          createPR: true,
          targetBranch: "main",
          folderPath: "consumption", // Specify consumption folder
        }
      );

      const { success, data } = pushResponse.data;

      if (success) {
        const prUrl =
          pushResponse.data?.data?.pr_url || pushResponse.data?.pr_url;
        const commitUrl =
          pushResponse.data?.data?.commit_url || pushResponse.data?.commit_url;
        const commitSha =
          pushResponse.data?.data?.commit_sha || pushResponse.data?.commit_sha;

        // Close the diffs modal
        setAllDiffsModal({ open: false, diffs: {} });

        // Show success dialog with links
        const successMessage = `✅ All consumption file artifacts pushed to GitHub successfully!
          📝 Pull Request Details:
          • Repository: ${githubConfig.repositoryUrl}
          • New Branch: ${newBranchName}
          • Target Branch: main
          • Consumption files pushed: ${entityNames.join(", ")}
          • Total consumption files: ${entityNames.length}
          • Commit SHA: ${commitSha || "N/A"}

          A pull request has been created for code review. Click the links below to view the PR or repository on GitHub.
        `;

        setSuccessDialog({
          open: true,
          message: successMessage,
          commitUrl: commitUrl,
          prUrl: prUrl,
          repositoryUrl: githubConfig.repositoryUrl,
        });
      } else {
        alert("Failed to push artifacts to GitHub. Please try again.");
      }
    } catch (error) {
      console.error("Error pushing artifacts to GitHub:", error);
      alert("Failed to push artifacts to GitHub. Please try again.");
    } finally {
      setIsPushingAllToGitHub(false);
    }
  };

  document.body.classList.remove("is-canvas", "is-table");
  document.body.classList.add(
    currentView === "canvas" ? "is-canvas" : "is-table"
  );

  return (
    <>
      {currentView === "canvas" ? (
        <CanvasHeader
          toggleCurrentView={setCurrentView}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          expandedCanvasHeader={expandedCanvasHeader}
          setExpandedCanvasHeader={setExpandedCanvasHeader}
        />
      ) : (
        <>
          <header className="d-flex justify-content-between align-items-center">
            <h1 className="h4 fw-semi-bold m-0">Consumption Zone</h1>

            <div className="d-flex gap-2 align-items-center">
              {/* Search component */}
              <div className="filters-search">
                <Button variant="light">
                  <BiSearch size={18} />
                </Button>
                <Form.Control
                  type="text"
                  placeholder="Search consumption entities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent"
                />
              </div>
              <Button variant="outline-secondary" className="px-3">
                <BiFilter fontSize="24" /> Filter
              </Button>

              <div className="p-2 rounded bg-white">
                <Button
                  variant={currentView === "table" ? "primary" : "default"}
                  onClick={() => setCurrentView("table")}
                >
                  <BiMenu fontSize="20" />
                  Table View
                </Button>
                <Button
                  variant={currentView === "canvas" ? "primary" : "default"}
                  onClick={() => setCurrentView("canvas")}
                >
                  <BiCategory fontSize="20" /> Canvas View
                </Button>
              </div>
            </div>
          </header>
        </>
      )}

      {currentView === "table" ? (
        <>
          <div className="switch-view">
            {/* Consumption Files Table */}
            <div className="">
              {loadingAI ? (
                <div className="bg-white p-5 text-center border rounded rounded-3 mt-3">
                  <span className="fs-1 mb-4 d-block">🤖</span>
                  <h5 className="fw-semi-bold text-primary text-large">
                    AI is analyzing your data and generating consumption
                    files...
                  </h5>
                  <p className="text-muted m-0">This may take a few moments</p>
                </div>
              ) : consumptionFiles.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    background: "#f8f9fa",
                    borderRadius: "8px",
                    border: "1px solid #dee2e6",
                  }}
                >
                  <p style={{ color: "#6c757d", margin: "0" }}>
                    No consumption files created yet. Click "Create Consumption
                    File" to get started.
                  </p>
                </div>
              ) : (
                <div className="card-view">
                  <div className="card-view-header">
                    <Card className="rounded-bottom-0">
                      <Card.Header className="border-0 bg-transparent py-3">
                        <Row>
                          <Col md={5}>Curated Entity</Col>
                          <Col md={3}>Consumption Entity</Col>
                          <Col md={2} className="text-center">
                            Status
                          </Col>
                          <Col md={2} className="text-center">
                            Actions
                          </Col>
                        </Row>
                      </Card.Header>
                    </Card>
                  </div>

                  <div className="card-view-list gap-3 d-grid">
                    {consumptionFiles.map((file) => (
                      <>
                        <Card key={file.id} className="card-view-item">
                          <Card.Body key={file.id}>
                            <Row>
                              <Col md={3}>
                                <div className="d-inline-flex gap-2 align-items-center">
                                  <BiSolidData color="#9CA3AF" size={20} />
                                  <span className="fw-semi-bold flex-fill">
                                    curated.{file.name}
                                  </span>
                                  <Badge
                                    variant="primary"
                                    onClick={handleSwitchToCanvas}
                                  >
                                    +60
                                  </Badge>
                                </div>
                                <div className="border p-2 rounded mt-2 d-flex gap-2">
                                  <span className="flex-fill">
                                    This table contains customer profile
                                    information
                                  </span>
                                  <div
                                    className="align-items-end d-flex flex-shrink-0"
                                    style={{ width: "12px" }}
                                  >
                                    <Image src={aiIcon} alt="" />
                                  </div>
                                </div>
                              </Col>

                              <Col md={2} className="text-center">
                                <Button
                                  variant="outline-secondary btn-icon"
                                  size="sm"
                                  onClick={handleSwitchToCanvas}
                                >
                                  <Image src={aiIcon} alt="" />
                                </Button>
                              </Col>
                              <Col md="3">
                                <div className="curated-name d-flex gap-3 align-items-center">
                                  <div className="curated-title d-inline-flex flex-fill align-items-center gap-2 overflow-hidden">
                                    <div>
                                      <BiSolidData color="#9CA3AF" size={20} />
                                    </div>
                                    <div className="overflow-hidden text-truncate">
                                      <span
                                        className="fw-medium text-success text-truncate"
                                        title={file.name}
                                      >
                                        consumption.{file.name}
                                      </span>
                                    </div>
                                  </div>

                                  <Button
                                    variant="default btn-icon"
                                    size="sm"
                                    className="justify-content-end"
                                    onClick={() => handleToggle(file.id)}
                                    aria-expanded={openId === file.id}
                                  >
                                    {openId === file.id ? (
                                      <BiChevronUp size={20} opacity={0.7} />
                                    ) : (
                                      <BiChevronDown size={20} opacity={0.7} />
                                    )}
                                  </Button>
                                </div>

                                <div className="border p-2 rounded mt-2 d-flex gap-2">
                                  <span className="flex-fill">
                                    This table contains customer profile
                                    information
                                  </span>
                                  <div
                                    className="align-items-end d-flex flex-shrink-0"
                                    style={{ width: "12px" }}
                                  >
                                    <Image src={aiIcon} alt="" />
                                  </div>
                                </div>
                              </Col>
                              <Col md={2} className="text-center">
                                <Badge
                                  pill
                                  bg={
                                    file.status === "draft"
                                      ? "pending"
                                      : file.status === "ai-generated"
                                      ? "primary"
                                      : "success"
                                  }
                                >
                                  {file.status === "ai-generated"
                                    ? "AI-generated"
                                    : file.status}
                                </Badge>
                              </Col>

                              <Col md={2} className="text-center">
                                <OverlayTrigger
                                  placement="top"
                                  overlay={
                                    <Tooltip>
                                      Configure batch projections
                                    </Tooltip>
                                  }
                                >
                                  <Button
                                    variant="outline-secondary btn-icon"
                                    size="sm"
                                    onClick={() =>
                                      navigate(
                                        `/batch-projections/${encodeURIComponent(
                                          file.name
                                        )}`
                                      )
                                    }
                                  >
                                    <BiBarChartAlt2 />
                                  </Button>
                                </OverlayTrigger>

                                {/* <OverlayTrigger
                                  placement="top"
                                  overlay={
                                    <Tooltip>
                                      View entities and join Relationships
                                    </Tooltip>
                                  }
                                >
                                  <Button
                                    variant="outline-secondary btn-icon"
                                    size="sm"
                                    onClick={() =>
                                      handleShowJoinRelations(file)
                                    }
                                  >
                                    <BiShuffle />
                                  </Button>
                                </OverlayTrigger> */}
                              </Col>
                            </Row>

                            <Collapse in={openId === file.id}>
                              <div id={`collapse-${file.id}`} className="pt-3">
                                {(() => {
                                  console.log(
                                    "Rendering EditConsumptionEntityMappingsPage for file:",
                                    file.name
                                  );
                                  console.log(
                                    "Consumption data keys:",
                                    Object.keys(consumptionData)
                                  );
                                  console.log(
                                    "File data:",
                                    consumptionData[file.name]
                                  );
                                  console.log("Loading AI:", loadingAI);

                                  if (loadingAI) {
                                    return (
                                      <div>Loading consumption data...</div>
                                    );
                                  }

                                  return (
                                    <EditConsumptionEntityMappingsPage
                                      entityName={file.name}
                                      consumptionData={consumptionData}
                                      records={consumptionData[file.name] || []}
                                      onSwitchToCanvas={handleSwitchToCanvas}
                                    />
                                  );
                                })()}
                              </div>
                            </Collapse>
                          </Card.Body>
                        </Card>
                      </>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {!loadingAI && consumptionFiles.length > 0 && totalPages > 0 && (
              <div className="d-flex justify-content-between align-items-center mt-4 mb-3">
                <div className="d-flex align-items-center gap-3">
                  <span className="text-muted">
                    Showing {(currentPage - 1) * entitiesPerPage + 1} to{" "}
                    {Math.min(currentPage * entitiesPerPage, totalEntities)} of{" "}
                    {totalEntities} entities
                  </span>
                  <div className="d-flex align-items-center gap-2">
                    <span className="text-muted">Show:</span>
                    <select
                      value={entitiesPerPage}
                      onChange={(e) => {
                        const newLimit = parseInt(e.target.value);
                        setEntitiesPerPage(newLimit);
                        setCurrentPage(1);
                        fetchAIConsumptionFiles(
                          1,
                          newLimit,
                          debouncedSearchTerm
                        );
                      }}
                      className="form-select form-select-sm"
                      style={{ width: "auto" }}
                    >
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                    <span className="text-muted">per page</span>
                  </div>
                </div>

                <div className="d-flex gap-2">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <BiChevronLeft /> First
                  </Button>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <BiChevronLeft /> Previous
                  </Button>

                  {/* Page Numbers */}
                  <div className="d-flex gap-1">
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

                      // Ensure pageNum is within valid range
                      if (pageNum < 1 || pageNum > totalPages) {
                        return null;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={
                            currentPage === pageNum
                              ? "primary"
                              : "outline-secondary"
                          }
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          style={{ minWidth: "40px" }}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next <BiChevronRight />
                  </Button>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    Last <BiChevronRight />
                  </Button>
                </div>
              </div>
            )}

            <div className="sticky-btns my-4 gap-2 d-flex justify-content-between">
              <div className="d-flex gap-2">
                <Button variant="light" title="View Data & PII Classifications">
                  View Classifications
                </Button>
                <Button variant="light" title="View your changes">
                  My Changes
                </Button>
                {/* <Button variant="light" title="Data Quality Recommendations">
              DQ Recommendations
            </Button> */}
              </div>

              {/* Stepper Modal for Creating Consumption File */}
              {showCreateFlow && (
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
                    zIndex: 2000,
                  }}
                >
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: 12,
                      padding: "2rem",
                      maxWidth: "900px",
                      maxHeight: "90vh",
                      overflow: "auto",
                      boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
                    }}
                  >
                    <div
                      style={{
                        marginBottom: 24,
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "#7366ff" }}>
                        Create Consumption File
                      </span>
                      <span style={{ color: "#bbb" }}>|</span>
                      <span
                        style={{ color: createStep === 1 ? "#7366ff" : "#bbb" }}
                      >
                        1. Entities
                      </span>
                      <span style={{ color: "#bbb" }}>&rarr;</span>
                      <span
                        style={{ color: createStep === 2 ? "#7366ff" : "#bbb" }}
                      >
                        2. Output Columns
                      </span>
                      <span style={{ color: "#bbb" }}>&rarr;</span>
                      <span
                        style={{ color: createStep === 3 ? "#7366ff" : "#bbb" }}
                      >
                        3. Name
                      </span>
                      <button
                        onClick={() => setShowCreateFlow(false)}
                        style={{
                          marginLeft: "auto",
                          background: "none",
                          border: "none",
                          fontSize: 24,
                          color: "#666",
                          cursor: "pointer",
                        }}
                      >
                        ×
                      </button>
                    </div>
                    {createStep === 1 && renderStep1()}
                    {createStep === 2 && renderStep2()}
                    {createStep === 3 && renderStep3()}
                  </div>
                </div>
              )}

              {/* Commented out previous generate artefacts button */}
              {/* <div>
                <Button
                  variant="primary"
                  title="Generate all Schemas, Entities, Mappings, Code Pipelines and Deployment Artefacts"
                  onClick={generateAllArtifacts}
                  disabled={
                    isGeneratingArtifacts || consumptionFiles.length === 0
                  }
                >
                  {isGeneratingArtifacts
                    ? "🔄 Generating..."
                    : "Generate Artefacts"}
                </Button>
              </div> */}

              {/* New canvas header buttons */}
              <div className="d-flex gap-3 align-items-center">
                <Button
                  variant="outline-primary"
                  onClick={() => setShowArtifactsGenerator(true)}
                  title="Generate all Schemas, Entities, Mappings, Code Pipelines and Deployment Artefacts"
                >
                  🚀 Generate Artefacts
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={() => setShowAcceptedTransformations(true)}
                  title="View and manage accepted transformation artifacts"
                >
                  📁 Accepted Transformations
                </Button>
              </div>
            </div>

            {/* View Records Modal */}
            {viewingRecords && (
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
                  zIndex: 2000,
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
                      marginBottom: "1rem",
                    }}
                  >
                    <h3 style={{ margin: 0, color: "#7366ff" }}>
                      {viewingRecords.replace(/_/g, " ")} Records
                    </h3>
                    <button
                      onClick={closeRecordsView}
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
                  <div style={{ overflow: "auto", maxHeight: "60vh" }}>
                    {loadingRecords ? (
                      <div
                        style={{
                          textAlign: "center",
                          color: "#7366ff",
                          fontWeight: 500,
                          fontSize: 18,
                        }}
                      >
                        Loading records...
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
                      </div>
                    ) : sampleRecords.length > 0 ? (
                      <table
                        style={{ width: "100%", borderCollapse: "collapse" }}
                      >
                        <thead>
                          <tr style={{ background: "#f8f9fa" }}>
                            {Object.keys(sampleRecords[0]).map((key) => (
                              <th
                                key={key}
                                style={{
                                  padding: "0.5rem",
                                  textAlign: "left",
                                  borderBottom: "2px solid #7366ff",
                                  color: "#7366ff",
                                  fontWeight: 600,
                                }}
                              >
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sampleRecords.map((record, idx) => (
                            <tr
                              key={idx}
                              style={{ borderBottom: "1px solid #eee" }}
                            >
                              {Object.values(record).map((value, valIdx) => (
                                <td
                                  key={valIdx}
                                  style={{
                                    padding: "0.5rem",
                                    fontSize: "0.9rem",
                                  }}
                                >
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
                      </table>
                    ) : (
                      <div
                        style={{
                          color: "#888",
                          textAlign: "center",
                          margin: "1rem 0",
                        }}
                      >
                        No records found in file.
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: "1rem", textAlign: "center" }}>
                    <button
                      className="hero-btn secondary"
                      onClick={closeRecordsView}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* View Entities Modal */}
            {showViewEntitiesModal && (
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
                  zIndex: 2000,
                }}
              >
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    padding: "2rem",
                    maxWidth: "600px",
                    maxHeight: "80vh",
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
                      Available Curated Entities
                    </h3>
                    <button
                      onClick={() => setShowViewEntitiesModal(false)}
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

                  <div style={{ marginBottom: "1rem" }}>
                    <p style={{ color: "#666", marginBottom: "1rem" }}>
                      These are the curated entities available for creating
                      consumption files:
                    </p>

                    {curatedEntities.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "2rem",
                          background: "#f8f9fa",
                          borderRadius: "8px",
                          border: "1px solid #dee2e6",
                        }}
                      >
                        <p style={{ color: "#6c757d", margin: "0" }}>
                          No curated entities available. Please upload files
                          first.
                        </p>
                      </div>
                    ) : (
                      <div style={{ maxHeight: "400px", overflow: "auto" }}>
                        <table
                          style={{ width: "100%", borderCollapse: "collapse" }}
                        >
                          <thead>
                            <tr style={{ background: "#f7f6ff" }}>
                              <th
                                style={{
                                  padding: "0.75rem",
                                  textAlign: "left",
                                  borderBottom: "2px solid #7366ff",
                                  color: "#7366ff",
                                  fontWeight: 600,
                                }}
                              >
                                Entity Name
                              </th>
                              <th
                                style={{
                                  padding: "0.75rem",
                                  textAlign: "left",
                                  borderBottom: "2px solid #7366ff",
                                  color: "#7366ff",
                                  fontWeight: 600,
                                }}
                              >
                                Source File
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {curatedEntities.map((entity, idx) => (
                              <tr
                                key={idx}
                                style={{ borderBottom: "1px solid #eee" }}
                              >
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    fontSize: "0.9rem",
                                    fontWeight: "500",
                                  }}
                                >
                                  {entity}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    fontSize: "0.9rem",
                                    color: "#666",
                                  }}
                                >
                                  {uploadedFiles[idx] || "Unknown"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: "center" }}>
                    <button
                      className="hero-btn secondary"
                      onClick={() => setShowViewEntitiesModal(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Show Join Relations Modal */}
            {showJoinRelationsModal && selectedFileForRelations && (
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
                  zIndex: 2000,
                }}
              >
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    padding: "2rem",
                    maxWidth: "800px",
                    maxHeight: "80vh",
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
                      Join Relations: {selectedFileForRelations.name}
                    </h3>
                    <button
                      onClick={closeJoinRelationsView}
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
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "1rem",
                      }}
                    >
                      <h4 style={{ color: "#7366ff", margin: 0 }}>
                        Entities (
                        {selectedFileForRelations.entities?.length || 0})
                      </h4>
                      <button
                        onClick={handleAddEntityToConsumption}
                        style={{
                          background: "#7366ff",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          padding: "0.5rem 1rem",
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        ➕ Add Curated Entity
                      </button>
                    </div>
                    {selectedFileForRelations.entities &&
                    selectedFileForRelations.entities.length > 0 ? (
                      <div
                        style={{
                          background: "#f8f9fa",
                          padding: "1rem",
                          borderRadius: "8px",
                          marginBottom: "1rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                          }}
                        >
                          {selectedFileForRelations.entities.map(
                            (entity, idx) => {
                              // Try to find the source file for this entity
                              const entityIndex = curatedEntities.findIndex(
                                (e) => e === entity
                              );
                              const sourceFile =
                                entityIndex >= 0
                                  ? uploadedFiles[entityIndex]
                                  : null;

                              return (
                                <div
                                  key={idx}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    background: "#fff",
                                    padding: "0.75rem",
                                    borderRadius: "6px",
                                    border: "1px solid #dee2e6",
                                  }}
                                >
                                  <div
                                    style={{
                                      background: "#7366ff",
                                      color: "white",
                                      padding: "0.5rem 0.75rem",
                                      borderRadius: "4px",
                                      fontSize: "0.85rem",
                                      fontWeight: "500",
                                      minWidth: "150px",
                                      textAlign: "center",
                                    }}
                                  >
                                    {entity}
                                  </div>
                                  {sourceFile && (
                                    <>
                                      <span
                                        style={{
                                          color: "#666",
                                          fontSize: "0.9rem",
                                        }}
                                      >
                                        from
                                      </span>
                                      <div
                                        style={{
                                          background: "#f8f9fa",
                                          color: "#495057",
                                          padding: "0.25rem 0.5rem",
                                          borderRadius: "4px",
                                          fontSize: "0.8rem",
                                          border: "1px solid #dee2e6",
                                        }}
                                      >
                                        {sourceFile}
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          background: "#f8f9fa",
                          padding: "1rem",
                          borderRadius: "8px",
                          textAlign: "center",
                          color: "#6c757d",
                        }}
                      >
                        No entities defined
                      </div>
                    )}
                  </div>

                  {/* Entity-Level Join Relationships */}
                  <div style={{ marginBottom: "2rem" }}>
                    <h4 style={{ color: "#7366ff", marginBottom: "1rem" }}>
                      Entity-Level Join Relationships
                    </h4>
                    {selectedFileForRelations.joinRelationships &&
                    selectedFileForRelations.joinRelationships.length > 0 ? (
                      <div
                        style={{
                          background: "#f8f9fa",
                          padding: "1rem",
                          borderRadius: "8px",
                          marginBottom: "1rem",
                        }}
                      >
                        <div style={{ marginBottom: "1rem" }}>
                          <p
                            style={{
                              color: "#666",
                              fontSize: "0.9rem",
                              marginBottom: "1rem",
                            }}
                          >
                            Visual representation of how entities are joined
                            together:
                          </p>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "1rem",
                              alignItems: "center",
                            }}
                          >
                            {selectedFileForRelations.joinRelationships.map(
                              (rel, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    background: "#fff",
                                    padding: "0.75rem",
                                    borderRadius: "8px",
                                    border: "1px solid #dee2e6",
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                  }}
                                >
                                  <div
                                    style={{
                                      background: "#7366ff",
                                      color: "white",
                                      padding: "0.5rem 0.75rem",
                                      borderRadius: "6px",
                                      fontSize: "0.85rem",
                                      fontWeight: "500",
                                      minWidth: "120px",
                                      textAlign: "center",
                                    }}
                                  >
                                    {rel.sourceEntity}
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.25rem",
                                    }}
                                  >
                                    <span
                                      style={{
                                        padding: "0.25rem 0.5rem",
                                        borderRadius: "4px",
                                        fontSize: "0.75rem",
                                        backgroundColor:
                                          rel.joinType === "INNER"
                                            ? "#d4edda"
                                            : rel.joinType === "LEFT"
                                            ? "#fff3cd"
                                            : rel.joinType === "RIGHT"
                                            ? "#f8d7da"
                                            : "#e9ecef",
                                        color:
                                          rel.joinType === "INNER"
                                            ? "#155724"
                                            : rel.joinType === "LEFT"
                                            ? "#856404"
                                            : rel.joinType === "RIGHT"
                                            ? "#721c24"
                                            : "#6c757d",
                                        fontWeight: "600",
                                      }}
                                    >
                                      {rel.joinType}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: "1.2rem",
                                        color: "#7366ff",
                                      }}
                                    >
                                      →
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      background: "#7366ff",
                                      color: "white",
                                      padding: "0.5rem 0.75rem",
                                      borderRadius: "6px",
                                      fontSize: "0.85rem",
                                      fontWeight: "500",
                                      minWidth: "120px",
                                      textAlign: "center",
                                    }}
                                  >
                                    {rel.targetEntity}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>

                        {/* Join Path Summary */}
                        <div
                          style={{
                            marginTop: "1rem",
                            padding: "1rem",
                            background: "#fff",
                            borderRadius: "6px",
                            border: "1px solid #dee2e6",
                          }}
                        >
                          <h5
                            style={{
                              color: "#7366ff",
                              marginBottom: "0.5rem",
                              fontSize: "0.9rem",
                            }}
                          >
                            Join Path Summary:
                          </h5>
                          <div style={{ fontSize: "0.85rem", color: "#666" }}>
                            {(() => {
                              const entities =
                                selectedFileForRelations.entities || [];
                              const relationships =
                                selectedFileForRelations.joinRelationships ||
                                [];

                              if (entities.length === 0)
                                return "No entities defined";
                              if (relationships.length === 0)
                                return "No join relationships defined";

                              // Build join path
                              let joinPath = entities[0];
                              for (let i = 0; i < relationships.length; i++) {
                                const rel = relationships[i];
                                joinPath += ` ${rel.joinType} JOIN ${rel.targetEntity}`;
                              }

                              return joinPath;
                            })()}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          background: "#f8f9fa",
                          padding: "1rem",
                          borderRadius: "8px",
                          textAlign: "center",
                          color: "#6c757d",
                        }}
                      >
                        No entity-level join relationships defined
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: "2rem" }}>
                    <h4 style={{ color: "#7366ff", marginBottom: "1rem" }}>
                      Attribute-Level Join Details (
                      {selectedFileForRelations.joinRelationships?.length || 0})
                    </h4>
                    {selectedFileForRelations.joinRelationships &&
                    selectedFileForRelations.joinRelationships.length > 0 ? (
                      <div
                        style={{
                          background: "#f8f9fa",
                          padding: "1rem",
                          borderRadius: "8px",
                          marginBottom: "1rem",
                        }}
                      >
                        <p
                          style={{
                            color: "#666",
                            fontSize: "0.9rem",
                            marginBottom: "1rem",
                          }}
                        >
                          Detailed field-level join mappings showing which
                          columns are used to connect entities:
                        </p>
                        <table
                          style={{ width: "100%", borderCollapse: "collapse" }}
                        >
                          <thead>
                            <tr style={{ background: "#f7f6ff" }}>
                              <th
                                style={{
                                  padding: "0.75rem",
                                  textAlign: "left",
                                  borderBottom: "2px solid #7366ff",
                                  color: "#7366ff",
                                  fontWeight: 600,
                                }}
                              >
                                Source Entity
                              </th>
                              <th
                                style={{
                                  padding: "0.75rem",
                                  textAlign: "left",
                                  borderBottom: "2px solid #7366ff",
                                  color: "#7366ff",
                                  fontWeight: 600,
                                }}
                              >
                                Primary Key
                              </th>
                              <th
                                style={{
                                  padding: "0.75rem",
                                  textAlign: "left",
                                  borderBottom: "2px solid #7366ff",
                                  color: "#7366ff",
                                  fontWeight: 600,
                                }}
                              >
                                Target Entity
                              </th>
                              <th
                                style={{
                                  padding: "0.75rem",
                                  textAlign: "left",
                                  borderBottom: "2px solid #7366ff",
                                  color: "#7366ff",
                                  fontWeight: 600,
                                }}
                              >
                                Foreign Key
                              </th>
                              <th
                                style={{
                                  padding: "0.75rem",
                                  textAlign: "left",
                                  borderBottom: "2px solid #7366ff",
                                  color: "#7366ff",
                                  fontWeight: 600,
                                }}
                              >
                                Join Type
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedFileForRelations.joinRelationships.map(
                              (rel, idx) => (
                                <tr
                                  key={idx}
                                  style={{ borderBottom: "1px solid #eee" }}
                                >
                                  <td
                                    style={{
                                      padding: "0.75rem",
                                      fontSize: "0.9rem",
                                      fontWeight: "500",
                                    }}
                                  >
                                    {rel.sourceEntity}
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.75rem",
                                      fontSize: "0.9rem",
                                    }}
                                  >
                                    <code>{rel.primaryKey}</code>
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.75rem",
                                      fontSize: "0.9rem",
                                      fontWeight: "500",
                                    }}
                                  >
                                    {rel.targetEntity}
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.75rem",
                                      fontSize: "0.9rem",
                                    }}
                                  >
                                    <code>{rel.foreignKey}</code>
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.75rem",
                                      fontSize: "0.9rem",
                                    }}
                                  >
                                    <span
                                      style={{
                                        padding: "0.25rem 0.5rem",
                                        borderRadius: "4px",
                                        fontSize: "0.8rem",
                                        backgroundColor:
                                          rel.joinType === "INNER"
                                            ? "#d4edda"
                                            : "#fff3cd",
                                        color:
                                          rel.joinType === "INNER"
                                            ? "#155724"
                                            : "#856404",
                                      }}
                                    >
                                      {rel.joinType}
                                    </span>
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : selectedFileForRelations.outputColumns &&
                      selectedFileForRelations.outputColumns.length > 0 ? (
                      <div
                        style={{
                          background: "#f8f9fa",
                          padding: "1rem",
                          borderRadius: "8px",
                          marginBottom: "1rem",
                        }}
                      >
                        <h5
                          style={{ color: "#7366ff", marginBottom: "0.5rem" }}
                        >
                          Output Columns:
                        </h5>
                        <table
                          style={{ width: "100%", borderCollapse: "collapse" }}
                        >
                          <thead>
                            <tr style={{ background: "#f7f6ff" }}>
                              <th
                                style={{
                                  padding: "0.5rem",
                                  textAlign: "left",
                                  borderBottom: "2px solid #7366ff",
                                  color: "#7366ff",
                                  fontWeight: 600,
                                  fontSize: "0.9rem",
                                }}
                              >
                                Column Name
                              </th>
                              <th
                                style={{
                                  padding: "0.5rem",
                                  textAlign: "left",
                                  borderBottom: "2px solid #7366ff",
                                  color: "#7366ff",
                                  fontWeight: 600,
                                  fontSize: "0.9rem",
                                }}
                              >
                                Source Entity
                              </th>
                              <th
                                style={{
                                  padding: "0.5rem",
                                  textAlign: "left",
                                  borderBottom: "2px solid #7366ff",
                                  color: "#7366ff",
                                  fontWeight: 600,
                                  fontSize: "0.9rem",
                                }}
                              >
                                Source Field
                              </th>
                              <th
                                style={{
                                  padding: "0.5rem",
                                  textAlign: "left",
                                  borderBottom: "2px solid #7366ff",
                                  color: "#7366ff",
                                  fontWeight: 600,
                                  fontSize: "0.9rem",
                                }}
                              >
                                Aggregation
                              </th>
                              <th
                                style={{
                                  padding: "0.5rem",
                                  textAlign: "left",
                                  borderBottom: "2px solid #7366ff",
                                  color: "#7366ff",
                                  fontWeight: 600,
                                  fontSize: "0.9rem",
                                }}
                              >
                                Group By
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedFileForRelations.outputColumns.map(
                              (col, idx) => (
                                <tr
                                  key={idx}
                                  style={{ borderBottom: "1px solid #eee" }}
                                >
                                  <td
                                    style={{
                                      padding: "0.5rem",
                                      fontSize: "0.85rem",
                                      fontWeight: "500",
                                    }}
                                  >
                                    <code>{col.name}</code>
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.5rem",
                                      fontSize: "0.85rem",
                                    }}
                                  >
                                    {col.sourceEntity}
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.5rem",
                                      fontSize: "0.85rem",
                                    }}
                                  >
                                    <code>{col.sourceField}</code>
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.5rem",
                                      fontSize: "0.85rem",
                                    }}
                                  >
                                    <span
                                      style={{
                                        padding: "0.2rem 0.4rem",
                                        borderRadius: "3px",
                                        fontSize: "0.75rem",
                                        backgroundColor:
                                          col.aggregation === "NONE"
                                            ? "#e9ecef"
                                            : "#d4edda",
                                        color:
                                          col.aggregation === "NONE"
                                            ? "#6c757d"
                                            : "#155724",
                                      }}
                                    >
                                      {col.aggregation || "NONE"}
                                    </span>
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.5rem",
                                      fontSize: "0.85rem",
                                    }}
                                  >
                                    {col.groupBy ? (
                                      <code>{col.groupBy}</code>
                                    ) : (
                                      "-"
                                    )}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div
                        style={{
                          background: "#f8f9fa",
                          padding: "1rem",
                          borderRadius: "8px",
                          textAlign: "center",
                          color: "#6c757d",
                        }}
                      >
                        No attribute-level join relationships defined
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: "center" }}>
                    <button
                      className="hero-btn secondary"
                      onClick={closeJoinRelationsView}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Add Entity to Consumption Modal */}
            {showAddEntityModal && (
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
                  zIndex: 2000,
                }}
              >
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    padding: "2rem",
                    maxWidth: "600px",
                    maxHeight: "80vh",
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
                      Add Curated Entity to Consumption File
                    </h3>
                    <button
                      onClick={closeAddEntityModal}
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
                    <p
                      style={{
                        color: "#666",
                        fontSize: "0.9rem",
                        marginBottom: "1rem",
                      }}
                    >
                      Add a curated entity to your consumption file by defining
                      a join relationship with an existing entity:
                    </p>

                    <div style={{ marginBottom: "1rem" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          fontWeight: "500",
                        }}
                      >
                        Curated Entity to Add:
                      </label>
                      <select
                        value={newJoinRelationship.targetEntity}
                        onChange={(e) => {
                          const selectedEntity = e.target.value;

                          setNewJoinRelationship((prev) => ({
                            ...prev,
                            targetEntity: selectedEntity,
                            foreignKey: "",
                          }));
                          // Fetch columns for the selected entity
                          if (selectedEntity) {
                            fetchColumnsForEntity(selectedEntity);
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          border: "2px solid #dee2e6",
                          borderRadius: "6px",
                          fontSize: "0.9rem",
                        }}
                      >
                        <option value="">Select curated entity to add</option>
                        {getAvailableEntitiesForJoin().map((entity) => (
                          <option key={entity} value={entity}>
                            {entity}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ marginBottom: "1rem" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          fontWeight: "500",
                        }}
                      >
                        Consumption File Primary Key:
                      </label>
                      <select
                        value={newJoinRelationship.primaryKey}
                        onChange={(e) =>
                          setNewJoinRelationship((prev) => ({
                            ...prev,
                            primaryKey: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          border: "2px solid #dee2e6",
                          borderRadius: "6px",
                          fontSize: "0.9rem",
                        }}
                      >
                        <option value="">
                          Select primary key from consumption file
                        </option>
                        {(() => {
                          const consumptionFileName =
                            selectedFileForRelations?.name;

                          const columns =
                            getEntityColumnsForJoin(consumptionFileName);

                          return columns.map((column) => (
                            <option key={column} value={column}>
                              {column}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>

                    <div style={{ marginBottom: "1rem" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          fontWeight: "500",
                        }}
                      >
                        Existing Entity Primary Key:
                      </label>
                      <select
                        value={newJoinRelationship.primaryKey}
                        onChange={(e) =>
                          setNewJoinRelationship((prev) => ({
                            ...prev,
                            primaryKey: e.target.value,
                          }))
                        }
                        disabled={
                          !newJoinRelationship.sourceEntity ||
                          loadingColumnsForJoin[
                            newJoinRelationship.sourceEntity
                          ]
                        }
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          border: "2px solid #dee2e6",
                          borderRadius: "6px",
                          fontSize: "0.9rem",
                        }}
                      >
                        <option value="">
                          {loadingColumnsForJoin[
                            newJoinRelationship.sourceEntity
                          ]
                            ? "Loading columns..."
                            : "Select primary key"}
                        </option>
                        {newJoinRelationship.sourceEntity &&
                          !loadingColumnsForJoin[
                            newJoinRelationship.sourceEntity
                          ] &&
                          getEntityColumnsForJoin(
                            newJoinRelationship.sourceEntity
                          ).map((column) => (
                            <option key={column} value={column}>
                              {column}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div style={{ marginBottom: "1rem" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          fontWeight: "500",
                        }}
                      >
                        Curated Entity Foreign Key:
                      </label>
                      <select
                        value={newJoinRelationship.foreignKey}
                        onChange={(e) =>
                          setNewJoinRelationship((prev) => ({
                            ...prev,
                            foreignKey: e.target.value,
                          }))
                        }
                        disabled={
                          !newJoinRelationship.targetEntity ||
                          loadingColumnsForJoin[
                            newJoinRelationship.targetEntity
                          ]
                        }
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          border: "2px solid #dee2e6",
                          borderRadius: "6px",
                          fontSize: "0.9rem",
                        }}
                      >
                        <option value="">
                          {loadingColumnsForJoin[
                            newJoinRelationship.targetEntity
                          ]
                            ? "Loading columns..."
                            : "Select foreign key"}
                        </option>
                        {newJoinRelationship.targetEntity &&
                          !loadingColumnsForJoin[
                            newJoinRelationship.targetEntity
                          ] &&
                          getEntityColumnsForJoin(
                            newJoinRelationship.targetEntity
                          ).map((column) => (
                            <option key={column} value={column}>
                              {column}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div style={{ marginBottom: "1.5rem" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          fontWeight: "500",
                        }}
                      >
                        Join Type:
                      </label>
                      <select
                        value={newJoinRelationship.joinType}
                        onChange={(e) =>
                          setNewJoinRelationship((prev) => ({
                            ...prev,
                            joinType: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          border: "2px solid #dee2e6",
                          borderRadius: "6px",
                          fontSize: "0.9rem",
                        }}
                      >
                        <option value="INNER">INNER JOIN</option>
                        <option value="LEFT">LEFT JOIN</option>
                        <option value="RIGHT">RIGHT JOIN</option>
                        <option value="FULL">FULL JOIN</option>
                      </select>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "1rem",
                    }}
                  >
                    <button
                      onClick={closeAddEntityModal}
                      style={{
                        padding: "0.75rem 1.5rem",
                        border: "2px solid #dee2e6",
                        borderRadius: "6px",
                        background: "white",
                        color: "#666",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveNewJoinRelationship}
                      disabled={
                        !newJoinRelationship.primaryKey ||
                        !newJoinRelationship.targetEntity ||
                        !newJoinRelationship.foreignKey
                      }
                      style={{
                        padding: "0.75rem 1.5rem",
                        border: "none",
                        borderRadius: "6px",
                        background:
                          !newJoinRelationship.primaryKey ||
                          !newJoinRelationship.targetEntity ||
                          !newJoinRelationship.foreignKey
                            ? "#ccc"
                            : "#7366ff",
                        color: "white",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                      }}
                    >
                      Add Curated Entity
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Edit Mapped Modal */}
          <>
            <Modal
              show={showDescModal}
              onHide={() => setShowDescModal(false)}
              centered
              backdrop="static"
            >
              <Modal.Header closeButton>
                <Modal.Title>Column Description</Modal.Title>
              </Modal.Header>

              <Modal.Body>
                {selectedFile ? (
                  <>
                    <p>{selectedFile.description || "No description"}</p>
                    {selectedFile.recordCount && (
                      <span>({selectedFile.recordCount} records)</span>
                    )}
                  </>
                ) : (
                  <p>No Descritpion</p>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="outline-secondary"
                  onClick={() => setShowDescModal(false)}
                >
                  Cancel
                </Button>
              </Modal.Footer>
            </Modal>
          </>
        </>
      ) : currentView === "canvas" ? (
        <>
          <div className="canvas-view">
            <ConsumptionCanvasEmbedded
              uploadedFiles={uploadedFiles}
              rawEntities={rawEntities}
              curatedEntities={curatedEntities}
              fileData={fileData}
              consumptionFiles={consumptionFiles}
              searchTerm={searchTerm}
              expandedCanvasHeader={expandedCanvasHeader}
              setExpandedCanvasHeader={setExpandedCanvasHeader}
            />
          </div>
        </>
      ) : (
        <></>
      )}

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
              <Modal.Title>
                Generated Artifacts for All Consumption Files
              </Modal.Title>
            </div>
          </Modal.Header>
          <Modal.Body>
            {/* Fixed Generate All Diffs Button */}
            {githubConnection && consumptionFiles.length > 0 && (
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
                      Generate and review all diffs for{" "}
                      {consumptionFiles.length} consumption files
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
              Generated SQL and PySpark code for all consumption files. Each
              file's artifacts are displayed in collapsible sections below.
            </p>

            <Accordion defaultActiveKey="0">
              {Object.entries(artifactsModal.artifacts || {}).map(
                ([entityName, artifacts], index) => (
                  <Accordion.Item key={index} eventKey={index.toString()}>
                    <Accordion.Header>
                      📁 {entityName}
                      {entityArtifacts[entityName] && (
                        <span className="ms-2 badge bg-success">
                          + NLP Code
                        </span>
                      )}
                    </Accordion.Header>
                    <Accordion.Body>
                      {/* SQL Code */}
                      <div className="mb-3">
                        <h6>🔗 SQL Code</h6>
                        <pre
                          style={{
                            background: "#f8f9fa",
                            padding: "1rem",
                            borderRadius: "4px",
                            fontSize: "12px",
                            maxHeight: "400px",
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
                            maxHeight: "400px",
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

                      {/* Clear Artifacts Button for NLP Generated Content */}
                      {entityArtifacts[entityName] && (
                        <div className="mt-3 pt-3 border-top">
                          <div className="d-flex justify-content-between align-items-center">
                            <small className="text-muted">
                              This consumption file has NLP-generated code
                              appended to the backend artifacts
                            </small>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Are you sure you want to clear the NLP-generated artifacts for ${entityName}?`
                                  )
                                ) {
                                  clearEntityArtifacts(entityName);
                                  // Refresh the artifacts modal to reflect changes
                                  setArtifactsModal((prev) => ({ ...prev }));
                                }
                              }}
                            >
                              🗑️ Clear NLP Artifacts
                            </Button>
                          </div>
                        </div>
                      )}
                    </Accordion.Body>
                  </Accordion.Item>
                )
              )}
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
                  {Object.keys(allDiffsModal.diffs).length} Consumption Files
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
                <h6 className="mb-3">
                  Generating diffs for all consumption files...
                </h6>

                <small className="text-muted">
                  This may take a few moments depending on the number of
                  consumption files
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
                  consumption files. Review the changes below and push to GitHub
                  when ready.
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
                      {Object.keys(allDiffsModal.diffs).length} consumption
                      files to GitHub in the consumption folder
                    </small>
                  </div>
                </div>

                {/* Detailed Diffs */}
                <div>
                  <h6>🔍 Detailed Diffs</h6>
                  {(() => {
                    // Check if there are any consumption files with new or modified files
                    const consumptionFilesWithChanges = Object.entries(
                      allDiffsModal.diffs
                    ).filter(([entityName, diffData]) => {
                      const hasNewOrModified =
                        (diffData.diff?.newFiles?.length || 0) > 0 ||
                        (diffData.diff?.modifiedFiles?.length || 0) > 0;
                      return hasNewOrModified;
                    });

                    if (consumptionFilesWithChanges.length === 0) {
                      return (
                        <div className="text-center p-4">
                          <div className="mb-3">
                            <BiGitBranch size={48} className="text-muted" />
                          </div>
                          <h6 className="text-muted">No Changes Detected</h6>
                          <p className="text-muted mb-0">
                            All files are up to date. No new or modified files
                            to display in the detailed diffs.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <Accordion>
                        {Object.entries(allDiffsModal.diffs).map(
                          ([entityName, diffData], index) => {
                            // Only show if there are new or modified files
                            const hasNewOrModified =
                              (diffData.diff?.newFiles?.length || 0) > 0 ||
                              (diffData.diff?.modifiedFiles?.length || 0) > 0;
                            if (!hasNewOrModified) return null;
                            return (
                              <Accordion.Item
                                key={index}
                                eventKey={index.toString()}
                              >
                                <Accordion.Header>
                                  📄 {entityName} - Diff Details
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
                                            {diffData.diff.summary.total || 0},
                                            New:{" "}
                                            {diffData.diff.summary.new || 0},
                                            Modified:{" "}
                                            {diffData.diff.summary.modified ||
                                              0}
                                            , Unchanged:{" "}
                                            {diffData.diff.summary.unchanged ||
                                              0}
                                            , Deleted:{" "}
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
                                                      <strong>
                                                        {file.path}
                                                      </strong>{" "}
                                                      ({file.size} bytes)
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
                                                      <strong>
                                                        {file.path}
                                                      </strong>
                                                      <span className="text-muted">
                                                        {" "}
                                                        (Size:{" "}
                                                        {
                                                          file.existingSize
                                                        } → {file.newSize}{" "}
                                                        bytes)
                                                      </span>
                                                    </li>
                                                  )
                                                )}
                                              </ul>
                                            </div>
                                          )}

                                        {/* Deleted Files */}
                                        {diffData.diff.deletedFiles &&
                                          diffData.diff.deletedFiles.length >
                                            0 && (
                                            <div className="mb-2">
                                              <h6 className="text-danger">
                                                🗑️ Deleted Files:
                                              </h6>
                                              <ul>
                                                {diffData.diff.deletedFiles.map(
                                                  (file, fileIndex) => (
                                                    <li key={fileIndex}>
                                                      <strong>
                                                        {file.path}
                                                      </strong>{" "}
                                                      ({file.size} bytes)
                                                    </li>
                                                  )
                                                )}
                                              </ul>
                                            </div>
                                          )}
                                      </div>

                                      {/* File Content Preview and Side-by-Side Diffs for only new/modified files */}
                                      {/* SQL File Preview and Diff */}
                                      {((diffData.diff.newFiles || []).some(
                                        (f) =>
                                          f.path.endsWith(
                                            `${entityName}_transform.sql`
                                          )
                                      ) ||
                                        (
                                          diffData.diff.modifiedFiles || []
                                        ).some((f) =>
                                          f.path.endsWith(
                                            `${entityName}_transform.sql`
                                          )
                                        )) &&
                                        diffData.artifacts?.artifacts?.sql && (
                                          <>
                                            <div className="mb-3">
                                              <h6 className="text-primary">
                                                📄 SQL File: consumption/
                                                {entityName}
                                                /sql/{entityName}_transform.sql
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
                                                {
                                                  diffData.artifacts.artifacts
                                                    .sql
                                                }
                                              </pre>
                                            </div>
                                            {/* Side-by-side diff for SQL */}
                                            <div className="mb-4">
                                              <h6 className="text-primary">
                                                🔄 SQL Changes: consumption/
                                                {entityName}/sql/{entityName}
                                                _transform.sql
                                              </h6>
                                              <div className="border rounded">
                                                <div className="bg-light p-2 border-bottom">
                                                  <div className="row">
                                                    <div className="col-6">
                                                      <small className="text-muted">
                                                        <strong>
                                                          Previous Version
                                                        </strong>{" "}
                                                        (if exists)
                                                      </small>
                                                    </div>
                                                    <div className="col-6">
                                                      <small className="text-success">
                                                        <strong>
                                                          New Version
                                                        </strong>{" "}
                                                        (will be created)
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
                                                      {diffData.previousVersions
                                                        ?.sql ? (
                                                        diffData.previousVersions.sql
                                                          .split("\n")
                                                          .map(
                                                            (line, index) => {
                                                              const newLines =
                                                                diffData.artifacts.artifacts.sql.split(
                                                                  "\n"
                                                                );
                                                              const isRemoved =
                                                                !newLines.includes(
                                                                  line
                                                                );
                                                              return (
                                                                <div
                                                                  key={index}
                                                                  style={{
                                                                    display:
                                                                      "flex",
                                                                    alignItems:
                                                                      "flex-start",
                                                                  }}
                                                                >
                                                                  <span
                                                                    style={{
                                                                      color:
                                                                        "#6c757d",
                                                                      marginRight:
                                                                        "10px",
                                                                      minWidth:
                                                                        "30px",
                                                                      textAlign:
                                                                        "right",
                                                                      fontSize:
                                                                        "10px",
                                                                      userSelect:
                                                                        "none",
                                                                    }}
                                                                  >
                                                                    {index + 1}
                                                                  </span>
                                                                  <span
                                                                    style={{
                                                                      color:
                                                                        isRemoved
                                                                          ? "#dc3545"
                                                                          : "#6c757d",
                                                                      marginRight:
                                                                        "10px",
                                                                      minWidth:
                                                                        "20px",
                                                                      textAlign:
                                                                        "center",
                                                                      fontSize:
                                                                        "10px",
                                                                      userSelect:
                                                                        "none",
                                                                    }}
                                                                  >
                                                                    {isRemoved
                                                                      ? "-"
                                                                      : " "}
                                                                  </span>
                                                                  <span
                                                                    style={{
                                                                      color:
                                                                        isRemoved
                                                                          ? "#dc3545"
                                                                          : "#6c757d",
                                                                      textDecoration:
                                                                        isRemoved
                                                                          ? "line-through"
                                                                          : "none",
                                                                    }}
                                                                  >
                                                                    {line}
                                                                  </span>
                                                                </div>
                                                              );
                                                            }
                                                          )
                                                      ) : (
                                                        <div className="text-muted text-center">
                                                          No previous version
                                                          available
                                                        </div>
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
                                                      {diffData.artifacts.artifacts.sql
                                                        .split("\n")
                                                        .map((line, index) => {
                                                          const previousLines =
                                                            diffData
                                                              .previousVersions
                                                              ?.sql
                                                              ? diffData.previousVersions.sql.split(
                                                                  "\n"
                                                                )
                                                              : [];
                                                          const isAdded =
                                                            !previousLines.includes(
                                                              line
                                                            );
                                                          return (
                                                            <div
                                                              key={index}
                                                              style={{
                                                                display: "flex",
                                                                alignItems:
                                                                  "flex-start",
                                                              }}
                                                            >
                                                              <span
                                                                style={{
                                                                  color:
                                                                    "#6c757d",
                                                                  marginRight:
                                                                    "10px",
                                                                  minWidth:
                                                                    "30px",
                                                                  textAlign:
                                                                    "right",
                                                                  fontSize:
                                                                    "10px",
                                                                  userSelect:
                                                                    "none",
                                                                }}
                                                              >
                                                                {index + 1}
                                                              </span>
                                                              <span
                                                                style={{
                                                                  color: isAdded
                                                                    ? "#28a745"
                                                                    : "#6c757d",
                                                                  marginRight:
                                                                    "10px",
                                                                  minWidth:
                                                                    "20px",
                                                                  textAlign:
                                                                    "center",
                                                                  fontSize:
                                                                    "10px",
                                                                  userSelect:
                                                                    "none",
                                                                }}
                                                              >
                                                                {isAdded
                                                                  ? "+"
                                                                  : " "}
                                                              </span>
                                                              <span
                                                                style={{
                                                                  color: isAdded
                                                                    ? "#28a745"
                                                                    : "#6c757d",
                                                                  backgroundColor:
                                                                    isAdded
                                                                      ? "#d4edda"
                                                                      : "transparent",
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
                                          </>
                                        )}

                                      {/* PySpark File Preview and Diff */}
                                      {((diffData.diff.newFiles || []).some(
                                        (f) =>
                                          f.path.endsWith(
                                            `${entityName}_transform.py`
                                          )
                                      ) ||
                                        (
                                          diffData.diff.modifiedFiles || []
                                        ).some((f) =>
                                          f.path.endsWith(
                                            `${entityName}_transform.py`
                                          )
                                        )) &&
                                        diffData.artifacts?.artifacts
                                          ?.pyspark && (
                                          <>
                                            <div className="mb-3">
                                              <h6 className="text-primary">
                                                📄 PySpark File: consumption/
                                                {entityName}
                                                /pyspark/{entityName}
                                                _transform.py
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
                                                {
                                                  diffData.artifacts.artifacts
                                                    .pyspark
                                                }
                                              </pre>
                                            </div>
                                            {/* Side-by-side diff for PySpark */}
                                            <div className="mb-4">
                                              <h6 className="text-primary">
                                                🔄 PySpark Changes: consumption/
                                                {entityName}/pyspark/
                                                {entityName}
                                                _transform.py
                                              </h6>
                                              <div className="border rounded">
                                                <div className="bg-light p-2 border-bottom">
                                                  <div className="row">
                                                    <div className="col-6">
                                                      <small className="text-muted">
                                                        <strong>
                                                          Previous Version
                                                        </strong>{" "}
                                                        (if exists)
                                                      </small>
                                                    </div>
                                                    <div className="col-6">
                                                      <small className="text-success">
                                                        <strong>
                                                          New Version
                                                        </strong>{" "}
                                                        (will be created)
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
                                                      {diffData.previousVersions
                                                        ?.pyspark ? (
                                                        diffData.previousVersions.pyspark
                                                          .split("\n")
                                                          .map(
                                                            (line, index) => {
                                                              const newLines =
                                                                diffData.artifacts.artifacts.pyspark.split(
                                                                  "\n"
                                                                );
                                                              const isRemoved =
                                                                !newLines.includes(
                                                                  line
                                                                );
                                                              return (
                                                                <div
                                                                  key={index}
                                                                  style={{
                                                                    display:
                                                                      "flex",
                                                                    alignItems:
                                                                      "flex-start",
                                                                  }}
                                                                >
                                                                  <span
                                                                    style={{
                                                                      color:
                                                                        "#6c757d",
                                                                      marginRight:
                                                                        "10px",
                                                                      minWidth:
                                                                        "30px",
                                                                      textAlign:
                                                                        "right",
                                                                      fontSize:
                                                                        "10px",
                                                                      userSelect:
                                                                        "none",
                                                                    }}
                                                                  >
                                                                    {index + 1}
                                                                  </span>
                                                                  <span
                                                                    style={{
                                                                      color:
                                                                        isRemoved
                                                                          ? "#dc3545"
                                                                          : "#6c757d",
                                                                      marginRight:
                                                                        "10px",
                                                                      minWidth:
                                                                        "20px",
                                                                      textAlign:
                                                                        "center",
                                                                      fontSize:
                                                                        "10px",
                                                                      userSelect:
                                                                        "none",
                                                                    }}
                                                                  >
                                                                    {isRemoved
                                                                      ? "-"
                                                                      : " "}
                                                                  </span>
                                                                  <span
                                                                    style={{
                                                                      color:
                                                                        isRemoved
                                                                          ? "#dc3545"
                                                                          : "#6c757d",
                                                                      textDecoration:
                                                                        isRemoved
                                                                          ? "line-through"
                                                                          : "none",
                                                                    }}
                                                                  >
                                                                    {line}
                                                                  </span>
                                                                </div>
                                                              );
                                                            }
                                                          )
                                                      ) : (
                                                        <div className="text-muted text-center">
                                                          No previous version
                                                          available
                                                        </div>
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
                                                      {diffData.artifacts.artifacts.pyspark
                                                        .split("\n")
                                                        .map((line, index) => {
                                                          const previousLines =
                                                            diffData
                                                              .previousVersions
                                                              ?.pyspark
                                                              ? diffData.previousVersions.pyspark.split(
                                                                  "\n"
                                                                )
                                                              : [];
                                                          const isAdded =
                                                            !previousLines.includes(
                                                              line
                                                            );
                                                          return (
                                                            <div
                                                              key={index}
                                                              style={{
                                                                display: "flex",
                                                                alignItems:
                                                                  "flex-start",
                                                              }}
                                                            >
                                                              <span
                                                                style={{
                                                                  color:
                                                                    "#6c757d",
                                                                  marginRight:
                                                                    "10px",
                                                                  minWidth:
                                                                    "30px",
                                                                  textAlign:
                                                                    "right",
                                                                  fontSize:
                                                                    "10px",
                                                                  userSelect:
                                                                    "none",
                                                                }}
                                                              >
                                                                {index + 1}
                                                              </span>
                                                              <span
                                                                style={{
                                                                  color: isAdded
                                                                    ? "#28a745"
                                                                    : "#6c757d",
                                                                  marginRight:
                                                                    "10px",
                                                                  minWidth:
                                                                    "20px",
                                                                  textAlign:
                                                                    "center",
                                                                  fontSize:
                                                                    "10px",
                                                                  userSelect:
                                                                    "none",
                                                                }}
                                                              >
                                                                {isAdded
                                                                  ? "+"
                                                                  : " "}
                                                              </span>
                                                              <span
                                                                style={{
                                                                  color: isAdded
                                                                    ? "#28a745"
                                                                    : "#6c757d",
                                                                  backgroundColor:
                                                                    isAdded
                                                                      ? "#d4edda"
                                                                      : "transparent",
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
                                          </>
                                        )}
                                    </div>
                                  ) : (
                                    <Alert variant="danger">
                                      <strong>Error:</strong> No diff data
                                      available
                                    </Alert>
                                  )}
                                </Accordion.Body>
                              </Accordion.Item>
                            );
                          }
                        )}
                      </Accordion>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="text-center p-4">
                <p className="text-muted">No diffs generated yet.</p>
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

      {/* Canvas Header Modals */}
      <CanvasArtifactsGenerator
        show={showArtifactsGenerator}
        onHide={() => setShowArtifactsGenerator(false)}
        entityData={null} // No specific entity data for gold landing page
        githubConnection={githubConnection}
      />

      <ConsumptionETLTransformationsManager
        show={showAcceptedTransformations}
        onHide={() => setShowAcceptedTransformations(false)}
        entityName={null} // No specific entity name for gold landing page
      />
    </>
  );
}

export default ConsumptionLandingPage;
