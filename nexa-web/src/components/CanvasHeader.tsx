import React, { useState, useEffect, useCallback } from "react";
import {
  Button,
  Form,
  Nav,
  CloseButton,
  Image,
  Table,
  Spinner,
  Alert,
  TabContainer,
  Card,
  TabContent,
  TabPane,
} from "react-bootstrap";
import axios from "axios";
import {
  BiMenu,
  BiFilter,
  BiSearch,
  BiCategory,
  BiShow,
  BiListUl,
  BiExpand,
  BiUser,
  BiSolidUser,
  BiRefresh,
  BiX,
  BiTrash,
  BiPlus,
  BiPencil,
  BiCopyAlt,
  BiSave,
} from "react-icons/bi";
import { BiSolidData } from "react-icons/bi";
import { useNavigate } from "react-router-dom";
import aiIcon from "../assets/ai-icon.svg";
import Chatbot from "./Chatbot";
import { FaRegFolder } from "react-icons/fa6";
import ConsumptionColumnETLModal from "./ConsumptionColumnETLModal";
import CanvasArtifactsGenerator from "./CanvasArtifactsGenerator";
import ConsumptionETLTransformationsManager from "./ConsumptionETLTransformationsManager";

function CanvasHeader({
  toggleCurrentView,
  searchTerm,
  setSearchTerm,
  expandedCanvasHeader,
  setExpandedCanvasHeader,
}) {
  const [activeTab, setActiveTab] = useState("workspace");

  // Sample records generator state
  const [sampleRecords, setSampleRecords] = useState<any[]>([]);
  const [isGeneratingRecords, setIsGeneratingRecords] = useState(false);
  // NLP-to-code generation state
  const [nlpInput, setNlpInput] = useState("");
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<{
    id?: number;
    sql: string;
    pyspark: string;
    nlpDescription: string;
  } | null>(null);
  const [codeGenerationError, setCodeGenerationError] = useState<string | null>(
    null
  );

  // Edit state for code
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [editableSqlCode, setEditableSqlCode] = useState("");
  const [editablePySparkCode, setEditablePySparkCode] = useState("");

  // Workspace codes state
  const [savedWorkspaceCodes, setSavedWorkspaceCodes] = useState<any[]>([]);
  const [loadingWorkspaceCodes, setLoadingWorkspaceCodes] = useState(false);
  const [workspaceSearchTerm, setWorkspaceSearchTerm] = useState("");

  // Artifacts and transformations state
  const [showArtifactsGenerator, setShowArtifactsGenerator] = useState(false);
  const [showAcceptedTransformations, setShowAcceptedTransformations] =
    useState(false);
  const [githubConnection, setGithubConnection] = useState(null);

  // Sample records generator function
  const generateSampleRecords = async () => {
    if (!expandedCanvasHeader?.entityData?.attributes) {
      alert("No entity data available for sample generation");
      return;
    }

    setIsGeneratingRecords(true);

    try {
      const attributes = expandedCanvasHeader.entityData.attributes;
      const records: Record<string, any>[] = [];

      // Validate attributes before processing
      const validAttributes = attributes.filter((attr) => {
        if (!attr || !attr.name) {
          console.warn("Skipping invalid attribute:", attr);
          return false;
        }
        return true;
      });

      if (validAttributes.length === 0) {
        alert("No valid attributes found for sample generation");
        return;
      }

      for (let i = 0; i < 10; i++) {
        const record: Record<string, any> = {};
        validAttributes.forEach((attr) => {
          try {
            const value = generateSampleValue(attr, i);
            // Ensure we never store null/undefined values
            record[attr.name] =
              value !== null && value !== undefined
                ? value
                : `Sample_${attr.name}_${i + 1}`;
          } catch (attrError) {
            console.warn(
              `Error generating value for attribute ${attr.name}:`,
              attrError
            );
            record[attr.name] = `Sample_${attr.name}_${i + 1}`;
          }
        });
        records.push(record);
      }

      // Validate that all records have values
      const validatedRecords = records.map((record) => {
        const validatedRecord: Record<string, any> = {};
        Object.entries(record).forEach(([key, value]) => {
          validatedRecord[key] =
            value !== null && value !== undefined
              ? value
              : `Sample_${key}_${Math.random().toString(36).substr(2, 5)}`;
        });
        return validatedRecord;
      });

      setSampleRecords(validatedRecords);
    } catch (error) {
      console.error("Error generating sample records:", error);
      alert(
        "Failed to generate sample records: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsGeneratingRecords(false);
    }
  };

  // Mock SQL code generation
  const generateMockSQLCode = useCallback(
    (nlpText: string, entityName: string, attributes: any[]) => {
      const lowerNlp = nlpText.toLowerCase();
      const entityNameLower = entityName.toLowerCase();

      // Extract key words from NLP
      const hasFilter =
        lowerNlp.includes("filter") ||
        lowerNlp.includes("where") ||
        lowerNlp.includes("condition");
      const hasAggregate =
        lowerNlp.includes("sum") ||
        lowerNlp.includes("count") ||
        lowerNlp.includes("average") ||
        lowerNlp.includes("group");
      const hasJoin =
        lowerNlp.includes("join") ||
        lowerNlp.includes("combine") ||
        lowerNlp.includes("merge");
      const hasTransform =
        lowerNlp.includes("transform") ||
        lowerNlp.includes("convert") ||
        lowerNlp.includes("change");

      let sqlCode = `-- Generated SQL for: ${nlpText}\n`;
      sqlCode += `-- Entity: ${entityName}\n\n`;

      if (hasAggregate) {
        sqlCode += `SELECT `;
        if (lowerNlp.includes("sum")) {
          const numericAttrs = attributes.filter(
            (attr) =>
              attr.type &&
              (attr.type.includes("int") ||
                attr.type.includes("decimal") ||
                attr.type.includes("number"))
          );
          if (numericAttrs.length > 0) {
            sqlCode += `SUM(${numericAttrs[0].name}) as total_${numericAttrs[0].name}`;
          } else {
            sqlCode += `SUM(amount) as total_amount`;
          }
        } else if (lowerNlp.includes("count")) {
          sqlCode += `COUNT(*) as record_count`;
        } else if (lowerNlp.includes("average")) {
          const numericAttrs = attributes.filter(
            (attr) =>
              attr.type &&
              (attr.type.includes("int") ||
                attr.type.includes("decimal") ||
                attr.type.includes("number"))
          );
          if (numericAttrs.length > 0) {
            sqlCode += `AVG(${numericAttrs[0].name}) as avg_${numericAttrs[0].name}`;
          } else {
            sqlCode += `AVG(amount) as avg_amount`;
          }
        }

        if (hasFilter) {
          sqlCode += `\nFROM ${entityNameLower}\nWHERE `;
          const stringAttrs = attributes.filter(
            (attr) => attr.type && attr.type.includes("string")
          );
          if (stringAttrs.length > 0) {
            sqlCode += `${stringAttrs[0].name} IS NOT NULL`;
          } else {
            sqlCode += `status = 'active'`;
          }
        } else {
          sqlCode += `\nFROM ${entityNameLower}`;
        }

        if (lowerNlp.includes("group")) {
          const groupAttrs = attributes.filter(
            (attr) => attr.type && attr.type.includes("string")
          );
          if (groupAttrs.length > 0) {
            sqlCode += `\nGROUP BY ${groupAttrs[0].name}`;
          } else {
            sqlCode += `\nGROUP BY category`;
          }
        }
      } else if (hasFilter) {
        sqlCode += `SELECT *\nFROM ${entityNameLower}\nWHERE `;
        const stringAttrs = attributes.filter(
          (attr) => attr.type && attr.type.includes("string")
        );
        if (stringAttrs.length > 0) {
          sqlCode += `${stringAttrs[0].name} LIKE '%${entityNameLower}%'`;
        } else {
          sqlCode += `status = 'active'`;
        }
      } else if (hasTransform) {
        sqlCode += `SELECT `;
        attributes.slice(0, 3).forEach((attr, idx) => {
          if (idx > 0) sqlCode += `, `;
          if (
            lowerNlp.includes("uppercase") &&
            attr.type &&
            attr.type.includes("string")
          ) {
            sqlCode += `UPPER(${attr.name}) as ${attr.name}_upper`;
          } else if (
            lowerNlp.includes("lowercase") &&
            attr.type &&
            attr.type.includes("string")
          ) {
            sqlCode += `LOWER(${attr.name}) as ${attr.name}_lower`;
          } else {
            sqlCode += attr.name;
          }
        });
        sqlCode += `\nFROM ${entityNameLower}`;
      } else {
        // Default select all
        sqlCode += `SELECT *\nFROM ${entityNameLower}`;
        if (hasFilter) {
          sqlCode += `\nWHERE status = 'active'`;
        }
      }

      sqlCode += `\nLIMIT 1000;`;
      return sqlCode;
    },
    []
  );

  // Mock PySpark code generation
  const generateMockPySparkCode = useCallback(
    (nlpText: string, entityName: string, attributes: any[]) => {
      const lowerNlp = nlpText.toLowerCase();
      const entityNameLower = entityName.toLowerCase();

      let pysparkCode = `# Generated PySpark for: ${nlpText}\n`;
      pysparkCode += `# Entity: ${entityName}\n\n`;
      pysparkCode += `from pyspark.sql import SparkSession\n`;
      pysparkCode += `from pyspark.sql.functions import *\n\n`;
      pysparkCode += `# Initialize Spark session\n`;
      pysparkCode += `spark = SparkSession.builder.appName("${entityName}Transformation").getOrCreate()\n\n`;
      pysparkCode += `# Read the data\n`;
      pysparkCode += `df = spark.read.table("${entityNameLower}")\n\n`;

      if (lowerNlp.includes("filter") || lowerNlp.includes("where")) {
        pysparkCode += `# Apply filters\n`;
        const stringAttrs = attributes.filter(
          (attr) => attr.type && attr.type.includes("string")
        );
        if (stringAttrs.length > 0) {
          pysparkCode += `df_filtered = df.filter(col("${stringAttrs[0].name}").isNotNull())\n`;
        } else {
          pysparkCode += `df_filtered = df.filter(col("status") == "active")\n`;
        }
        pysparkCode += `\n`;
      } else {
        pysparkCode += `df_filtered = df\n`;
      }

      if (lowerNlp.includes("transform") || lowerNlp.includes("convert")) {
        pysparkCode += `# Apply transformations\n`;
        attributes.slice(0, 3).forEach((attr, idx) => {
          if (attr.type && attr.type.includes("string")) {
            if (lowerNlp.includes("uppercase")) {
              pysparkCode += `df_transformed = df_filtered.withColumn("${attr.name}_upper", upper(col("${attr.name}")))\n`;
            } else if (lowerNlp.includes("lowercase")) {
              pysparkCode += `df_transformed = df_filtered.withColumn("${attr.name}_lower", lower(col("${attr.name}")))\n`;
            } else {
              pysparkCode += `df_transformed = df_filtered.withColumn("${attr.name}_cleaned", regexp_replace(col("${attr.name}"), '[^a-zA-Z0-9\\\\s]', ''))\n`;
            }
          }
        });
        pysparkCode += `\n`;
      } else {
        pysparkCode += `df_transformed = df_filtered\n`;
      }

      if (lowerNlp.includes("aggregate") || lowerNlp.includes("group")) {
        pysparkCode += `# Apply aggregations\n`;
        const numericAttrs = attributes.filter(
          (attr) =>
            attr.type &&
            (attr.type.includes("int") ||
              attr.type.includes("decimal") ||
              attr.type.includes("number"))
        );
        if (numericAttrs.length > 0) {
          pysparkCode += `df_result = df_transformed.groupBy("${numericAttrs[0].name}").agg(\n`;
          pysparkCode += `    count("*").alias("record_count"),\n`;
          pysparkCode += `    sum("${numericAttrs[0].name}").alias("total_${numericAttrs[0].name}")\n`;
          pysparkCode += `)\n`;
        } else {
          pysparkCode += `df_result = df_transformed.groupBy("category").agg(\n`;
          pysparkCode += `    count("*").alias("record_count")\n`;
          pysparkCode += `)\n`;
        }
      } else {
        pysparkCode += `df_result = df_transformed\n`;
      }

      pysparkCode += `\n# Show results\n`;
      pysparkCode += `df_result.show(10)\n\n`;
      pysparkCode += `# Stop Spark session\n`;
      pysparkCode += `spark.stop()`;

      return pysparkCode;
    },
    []
  );

  const handleEditCode = async () => {
    const newEditState = !isEditingCode;
    
    if (newEditState) {
      setEditableSqlCode(generatedCode?.sql || "");
      setEditablePySparkCode(generatedCode?.pyspark || "");
      setIsEditingCode(newEditState);
    } else {
      await saveCodeChanges();
      setIsEditingCode(newEditState);
    }
  };

  const saveCodeChanges = async () => {
    try {
      const previousData = {
        sql: generatedCode?.sql || "",
        pyspark: generatedCode?.pyspark || "",
        nlpDescription: generatedCode?.nlpDescription || ""
      };

      const newData = {
        sql: editableSqlCode,
        pyspark: editablePySparkCode,
        nlpDescription: generatedCode?.nlpDescription || ""
      };

      const payload = {
        type: 'ETL',
        ingestion_type: 'consumption',
        previous_data: previousData,
        new_data: newData,
        created_by: 'admin@gmail.com'
      };

      const response = await axios.post('/api/api/change-log/save', payload);
      
      if (response.data.success) {
        console.log('Code changes saved successfully!', response.data);
        
        setGeneratedCode({
          ...generatedCode,
          sql: editableSqlCode,
          pyspark: editablePySparkCode
        });

        alert('Code changes saved successfully!');
      } else {
        console.error('Failed to save code changes:', response.data.message);
        alert('Failed to save code changes. Please try again.');
      }
    } catch (error) {
      console.error('Error saving code changes:', error);
      alert('Error saving code changes. Please try again.');
    }
  };

  // ETL SQL files state and loaders
  const [etlSqlFiles, setEtlSqlFiles] = useState<string[]>([]);
  const [loadingEtlSqlFiles, setLoadingEtlSqlFiles] = useState(false);

  // Fetch ETL SQL files from backend
  const fetchEtlSqlFiles = useCallback(async () => {
    setLoadingEtlSqlFiles(true);
    try {
      const response = await axios.get(`/api/etl/sql-files`);
      setEtlSqlFiles(response.data?.files || []);
    } catch (error) {
      console.error("Error fetching ETL SQL files:", error);
      setEtlSqlFiles([]);
    } finally {
      setLoadingEtlSqlFiles(false);
    }
  }, []);

  // Load ETL SQL files once
  useEffect(() => {
    fetchEtlSqlFiles();
  }, [fetchEtlSqlFiles]);

  // Load selected ETL SQL file content into the editor display
  const loadEtlSqlFile = async (fileName: string) => {
    try {
      const response = await axios.get(
        `/api/etl/sql-files/${encodeURIComponent(fileName)}`
      );
      const content = response.data?.content || "";
      setGeneratedCode({
        id: undefined,
        sql: content,
        pyspark: "",
        nlpDescription: fileName,
      });
      setEditableSqlCode(content);
      setEditablePySparkCode("");
      setIsEditingCode(false);
    } catch (error) {
      console.error("Error fetching ETL SQL file:", error);
      alert("Failed to fetch SQL file. Please try again.");
    }
  };

  // Fetch saved workspace codes for the current entity
  const fetchWorkspaceCodes = useCallback(async () => {
    if (!expandedCanvasHeader?.entityData?.label) return;

    setLoadingWorkspaceCodes(true);
    try {
      const entityName = expandedCanvasHeader.entityData.label;
      const response = await axios.get(
        `/api/workspace-code/entity/${entityName}`
      );

      if (response.data.success) {
        setSavedWorkspaceCodes(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching workspace codes:", error);
    } finally {
      setLoadingWorkspaceCodes(false);
    }
  }, [expandedCanvasHeader?.entityData?.label]);

  // Save or update workspace code to database
  const saveWorkspaceCode = async () => {
    if (!generatedCode || !expandedCanvasHeader?.entityData?.label) {
      alert("No code generated or entity not found");
      return;
    }

    try {
      const entityName = expandedCanvasHeader.entityData.label;
      const workspaceCodeData = {
        entityName,
        nlpDescription: generatedCode.nlpDescription,
        sqlCode: editableSqlCode || generatedCode.sql,
        pysparkCode: editablePySparkCode || generatedCode.pyspark,
        isEditingSql: isEditingCode,
        isEditingPySpark: isEditingCode,
        editableSqlCode: editableSqlCode || generatedCode.sql,
        editablePySparkCode: editablePySparkCode || generatedCode.pyspark,
      };

      let response;

      // If we have an existing transformation ID, update it; otherwise create new
      if (generatedCode.id) {
        response = await axios.put(
          `/api/workspace-code/update/${generatedCode.id}`,
          workspaceCodeData
        );
      } else {
        response = await axios.post(
          "/api/workspace-code/save",
          workspaceCodeData
        );
      }

      if (response.data.success) {
        const action = generatedCode.id ? "updated" : "saved";
        alert(`Code ${action} successfully to workspace!`);
        // Refresh the saved codes list
        await fetchWorkspaceCodes();
        // Clear the generated code to show the saved list
        setNlpInput("");
        setGeneratedCode(null);
        setIsEditingCode(false);
      }
    } catch (error) {
      console.error("Error saving workspace code:", error);
      alert(
        "Failed to save code: " +
          (error.response?.data?.message || error.message)
      );
    }
  };

  // Load saved workspace code
  const loadWorkspaceCode = (workspaceCode: any) => {
    setGeneratedCode({
      id: workspaceCode.id,
      sql: workspaceCode.sqlCode,
      pyspark: workspaceCode.pysparkCode,
      nlpDescription: workspaceCode.nlpDescription,
    });
    setEditableSqlCode(workspaceCode.editableSqlCode || workspaceCode.sqlCode);
    setEditablePySparkCode(
      workspaceCode.editablePySparkCode || workspaceCode.pysparkCode
    );
    setIsEditingCode(false);

    // Switch to the workspace tab to show the loaded code
    setActiveTab("workspace");
  };

  // Delete workspace code
  const deleteWorkspaceCode = async (workspaceCodeId: number) => {
    if (!confirm("Are you sure you want to delete this transformation?")) {
      return;
    }

    try {
      const response = await axios.delete(
        `/api/workspace-code/delete/${workspaceCodeId}`
      );

      if (response.data.success) {
        alert("Transformation deleted successfully!");
        // Refresh the saved codes list
        await fetchWorkspaceCodes();
        // If we're currently viewing the deleted transformation, clear it
        if (generatedCode?.id === workspaceCodeId) {
          setGeneratedCode(null);
          setIsEditingCode(false);
        }
      }
    } catch (error) {
      console.error("Error deleting workspace code:", error);
      alert(
        "Failed to delete transformation: " +
          (error.response?.data?.message || error.message)
      );
    }
  };

  // Filtered workspace codes based on search term
  const filteredWorkspaceCodes = savedWorkspaceCodes.filter((code) =>
    code.nlpDescription
      .toLowerCase()
      .includes(workspaceSearchTerm.toLowerCase())
  );

  // NLP-to-code generation function
  const generateCodeFromNLP = useCallback(
    async (nlpText: string) => {
      if (!nlpText.trim()) {
        setCodeGenerationError(
          "Please enter a description for code generation"
        );
        return;
      }

      setIsGeneratingCode(true);
      setCodeGenerationError(null);
      setGeneratedCode(null);

      try {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Mock AI code generation based on NLP input
        const entityName = expandedCanvasHeader?.entityData?.label || "entity";
        const attributes = expandedCanvasHeader?.entityData?.attributes || [];

        // Generate SQL code based on NLP description
        const sqlCode = generateMockSQLCode(nlpText, entityName, attributes);
        const pysparkCode = generateMockPySparkCode(
          nlpText,
          entityName,
          attributes
        );

        setGeneratedCode({
          sql: sqlCode,
          pyspark: pysparkCode,
          nlpDescription: nlpText,
        });

        // Keep input visible for further modifications
        // setNlpInput("");
      } catch (error) {
        setCodeGenerationError(
          "Failed to generate code: " +
            (error instanceof Error ? error.message : String(error))
        );
      } finally {
        setIsGeneratingCode(false);
      }
    },
    [
      expandedCanvasHeader?.entityData,
      generateMockSQLCode,
      generateMockPySparkCode,
    ]
  );

  // Helper function to generate sample values based on attribute type and name
  const generateSampleValue = (attr, index) => {
    // Ensure attr and attr.name exist
    if (!attr || !attr.name) {
      return `Sample_${index + 1}`;
    }

    const name = attr.name.toLowerCase();
    const type = (attr.type || "string").toLowerCase();

    // Generate ID fields
    if (name.includes("id") || name.includes("_id")) {
      if (name.includes("customer") || name.includes("user")) {
        return `CUST${String(index + 1).padStart(6, "0")}`;
      } else if (name.includes("order")) {
        return `ORD${String(index + 1).padStart(8, "0")}`;
      } else if (name.includes("product")) {
        return `PROD${String(index + 1).padStart(6, "0")}`;
      } else if (name.includes("account")) {
        return `ACC${String(index + 1).padStart(8, "0")}`;
      } else if (name.includes("contract")) {
        return `CTR${String(index + 1).padStart(8, "0")}`;
      } else if (name.includes("invoice")) {
        return `INV${String(index + 1).padStart(8, "0")}`;
      } else if (name.includes("transaction")) {
        return `TXN${String(index + 1).padStart(8, "0")}`;
      } else {
        return String(index + 1);
      }
    }

    // Generate name fields
    if (name.includes("name") || name.includes("title")) {
      const names = [
        "Acme Corporation",
        "Tech Solutions Inc",
        "Global Industries",
        "Innovation Labs",
        "Digital Dynamics",
        "Future Systems",
        "Smart Solutions",
        "Elite Enterprises",
        "Prime Partners",
        "Advanced Analytics",
        "Creative Concepts",
        "Strategic Solutions",
        "Innovation Hub",
        "Digital Ventures",
        "Global Tech",
        "Smart Systems",
        "Elite Solutions",
        "Prime Analytics",
        "Creative Dynamics",
        "Strategic Partners",
      ];
      return names[index % names.length];
    }

    // Generate email fields
    if (name.includes("email")) {
      const domains = [
        "gmail.com",
        "yahoo.com",
        "outlook.com",
        "company.com",
        "business.org",
        "enterprise.net",
        "corporate.io",
        "startup.co",
        "tech.biz",
        "digital.com",
      ];
      return `user${index + 1}@${domains[index % domains.length]}`;
    }

    // Generate phone fields
    if (
      name.includes("phone") ||
      name.includes("mobile") ||
      name.includes("contact")
    ) {
      return `+1-555-${String(100 + index).padStart(3, "0")}-${String(
        1000 + index
      ).padStart(4, "0")}`;
    }

    // Generate address fields
    if (
      name.includes("address") ||
      name.includes("street") ||
      name.includes("location")
    ) {
      const streets = [
        "123 Main St",
        "456 Oak Ave",
        "789 Pine Rd",
        "321 Elm Blvd",
        "654 Maple Dr",
        "987 Cedar Ln",
        "147 Birch Way",
        "258 Spruce Ct",
        "369 Willow St",
        "741 Aspen Ave",
        "852 Oak St",
        "963 Pine Ave",
        "147 Maple Rd",
        "258 Cedar Blvd",
        "369 Birch Dr",
      ];
      return streets[index % streets.length];
    }

    // Generate city fields
    if (name.includes("city") || name.includes("town")) {
      const cities = [
        "New York",
        "Los Angeles",
        "Chicago",
        "Houston",
        "Phoenix",
        "Philadelphia",
        "San Antonio",
        "San Diego",
        "Dallas",
        "San Jose",
        "Austin",
        "Jacksonville",
        "Fort Worth",
        "Columbus",
        "Charlotte",
      ];
      return cities[index % cities.length];
    }

    // Generate state/province fields
    if (
      name.includes("state") ||
      name.includes("province") ||
      name.includes("region")
    ) {
      const states = [
        "CA",
        "NY",
        "TX",
        "FL",
        "IL",
        "PA",
        "OH",
        "GA",
        "NC",
        "MI",
        "NJ",
        "VA",
        "WA",
        "AZ",
        "CO",
      ];
      return states[index % states.length];
    }

    // Generate zip/postal code fields
    if (
      name.includes("zip") ||
      name.includes("postal") ||
      name.includes("code")
    ) {
      const zips = [
        "10001",
        "20001",
        "30001",
        "40001",
        "50001",
        "60001",
        "70001",
        "80001",
        "90001",
        "10002",
        "20002",
        "30002",
        "40002",
        "50002",
        "60002",
      ];
      return zips[index % zips.length];
    }

    // Generate date fields
    if (
      type.includes("date") ||
      name.includes("date") ||
      name.includes("time") ||
      name.includes("created") ||
      name.includes("updated")
    ) {
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + index);
      return baseDate.toISOString().split("T")[0];
    }

    // Generate numeric fields
    if (
      type.includes("int") ||
      type.includes("number") ||
      type.includes("decimal") ||
      type.includes("float") ||
      type.includes("double")
    ) {
      if (
        name.includes("amount") ||
        name.includes("price") ||
        name.includes("cost") ||
        name.includes("value") ||
        name.includes("total")
      ) {
        return (Math.random() * 1000 + 10).toFixed(2);
      } else if (
        name.includes("quantity") ||
        name.includes("count") ||
        name.includes("number")
      ) {
        return Math.floor(Math.random() * 100) + 1;
      } else if (name.includes("age") || name.includes("years")) {
        return Math.floor(Math.random() * 50) + 18;
      } else if (name.includes("score") || name.includes("rating")) {
        return Math.floor(Math.random() * 10) + 1;
      } else if (name.includes("percentage") || name.includes("rate")) {
        return Math.floor(Math.random() * 100);
      } else {
        return Math.floor(Math.random() * 1000) + 1;
      }
    }

    // Generate boolean fields
    if (
      type.includes("bool") ||
      type.includes("boolean") ||
      name.includes("is") ||
      name.includes("has") ||
      name.includes("active") ||
      name.includes("enabled")
    ) {
      return Math.random() > 0.5;
    }

    // Generate status fields
    if (name.includes("status") || name.includes("state")) {
      const statuses = [
        "Active",
        "Inactive",
        "Pending",
        "Completed",
        "Failed",
        "Processing",
        "Approved",
        "Rejected",
      ];
      return statuses[index % statuses.length];
    }

    // Generate category fields
    if (
      name.includes("category") ||
      name.includes("type") ||
      name.includes("class")
    ) {
      const categories = [
        "Premium",
        "Standard",
        "Basic",
        "Enterprise",
        "Professional",
        "Personal",
        "Business",
        "Consumer",
      ];
      return categories[index % categories.length];
    }

    // Generate description fields
    if (
      name.includes("description") ||
      name.includes("desc") ||
      name.includes("comment") ||
      name.includes("note")
    ) {
      const descriptions = [
        "Sample description for testing purposes",
        "This is a demo record for development",
        "Example data entry for demonstration",
        "Test record with sample information",
        "Demo entry with placeholder content",
        "Sample data for validation testing",
        "Example record for user interface testing",
        "Test entry for functionality verification",
        "Demo data for integration testing",
        "Sample record for performance testing",
      ];
      return descriptions[index % descriptions.length];
    }

    // Generate URL fields
    if (
      name.includes("url") ||
      name.includes("link") ||
      name.includes("website")
    ) {
      const domains = [
        "example.com",
        "demo.org",
        "test.net",
        "sample.io",
        "placeholder.co",
      ];
      return `https://${domains[index % domains.length]}/page${index + 1}`;
    }

    // Generate currency fields
    if (name.includes("currency") || name.includes("ccy")) {
      const currencies = [
        "USD",
        "EUR",
        "GBP",
        "JPY",
        "CAD",
        "AUD",
        "CHF",
        "CNY",
      ];
      return currencies[index % currencies.length];
    }

    // Default string generation - ensure we never return null/undefined
    const words = [
      "Sample",
      "Test",
      "Demo",
      "Example",
      "Data",
      "Record",
      "Entry",
      "Item",
      "Element",
      "Value",
      "Instance",
      "Case",
      "Scenario",
      "Template",
      "Pattern",
    ];
    return `${words[index % words.length]} ${index + 1}`;
  };

  useEffect(() => {
    if (expandedCanvasHeader?.visible) {
      setActiveTab(expandedCanvasHeader?.tab || "workspace");
    }
  }, [expandedCanvasHeader]);

  // Generate sample records when records tab is opened
  useEffect(() => {
    if (
      activeTab === "records" &&
      expandedCanvasHeader?.entityData?.attributes &&
      sampleRecords.length === 0
    ) {
      generateSampleRecords();
    }
  }, [
    activeTab,
    expandedCanvasHeader?.entityData?.attributes,
    generateSampleRecords,
  ]);

  // Fetch workspace codes when entity changes
  useEffect(() => {
    if (expandedCanvasHeader?.entityData?.label) {
      fetchWorkspaceCodes();
    }
  }, [expandedCanvasHeader?.entityData?.label, fetchWorkspaceCodes]);

  // Check GitHub connection on mount
  useEffect(() => {
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

    checkGitHubConnection();
  }, []);

  return (
    <>
      <header className="canvas-header gap-4 d-flex justify-content-between align-items-center">
        <div className="canvas-header-start">
          <Button variant="primary" size="sm">
            + Select Source
          </Button>
        </div>

        <div className="canvas-header-center d-flex gap-2 align-items-center">
          {/* Search component */}
          <div className="filters-search">
            <Button variant="light">
              <BiSearch size={18} />
            </Button>
            <Form.Control
              size="sm"
              type="text"
              placeholder="Search consumption entities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent"
            />
          </div>
          <Button
            variant="outline-secondary"
            className="px-3 filter-btn"
            size="sm"
          >
            <BiFilter fontSize="24" /> Filter
          </Button>

          <div className="view-btns rounded border d-flex align-items-center">
            <Button
              variant="default"
              size="sm"
              className="ps-2"
              onClick={() => toggleCurrentView("table")}
            >
              <BiMenu fontSize="20" />
              Table View
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="px-3"
              onClick={() => toggleCurrentView("canvas")}
            >
              <BiCategory fontSize="20" /> Canvas View
            </Button>
          </div>
        </div>

        <div className="canvas-header-end d-flex gap-3 align-items-center">
          <Chatbot />
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => setShowArtifactsGenerator(true)}
            disabled={!expandedCanvasHeader?.entityData}
            title="Generate all Schemas, Entities, Mappings, Code Pipelines and Deployment Artefacts"
          >
            🚀 Generate Artefacts
          </Button>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setShowAcceptedTransformations(true)}
            title="View and manage accepted transformation artifacts"
          >
            📁 Accepted Transformations
          </Button>
        </div>
      </header>

      {expandedCanvasHeader?.visible && (
        <>
          <section className="canvas-collapse">
            <aside className="canvas-collapse_sidebar">
              <Nav>
                <Nav.Item>
                  <Nav.Link
                    active={activeTab === "workspace"}
                    onClick={() => setActiveTab("workspace")}
                    title="Work Space"
                  >
                    <FaRegFolder />
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link
                    active={activeTab === "records"}
                    onClick={() => setActiveTab("records")}
                    title="Work Records"
                  >
                    <BiShow size={18} />
                  </Nav.Link>
                </Nav.Item>
              </Nav>
            </aside>

            {/* Tab content */}
            {activeTab === "workspace" && (
              <>
                <div className="canvas-collapse_workspace">
                  <div className="workspace">
                    <div className="workspace-header p-3 d-grid gap-2">
                      <header className="d-flex align-items-center justify-content-between">
                        <h4 className="text-medium fw-medium m-0">
                          Workspace {expandedCanvasHeader?.entityData?.label.length > 0 ? '' : ''}
                        </h4>
                        <div className="d-flex gap-2 align-items-center">
                          <CloseButton
                          style={{fontSize: "10px"}}
                            onClick={() => {
                              setExpandedCanvasHeader(null);
                            }}
                          />
                        </div>
                      </header>
                      <div className="position-relative d-inline-block">
                        <Form.Control
                          size="sm"
                          aria-label="Search"
                          placeholder="Search SQL Files..."
                          value={workspaceSearchTerm}
                          onChange={(e) =>
                            setWorkspaceSearchTerm(e.target.value)
                          }
                          className="ps-4 pe-4"
                          style={{ minWidth: "200px" }}
                        />
                        <div
                          className="position-absolute start-0 top-50 translate-middle-y d-flex align-items-center justify-content-center"
                          style={{
                            width: "30px",
                            height: "30px",
                            pointerEvents: "none",
                          }}
                        >
                          <BiSearch size={16} />
                        </div>
                        {workspaceSearchTerm && (
                          <div
                            className="position-absolute end-0 top-50 translate-middle-y d-flex align-items-center justify-content-center cursor-pointer"
                            style={{
                              width: "30px",
                              height: "30px",
                              cursor: "pointer",
                            }}
                            onClick={() => setWorkspaceSearchTerm("")}
                            title="Clear search"
                          >
                            <BiX size={18} />
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-1 border-top" style={{ height: "32px", borderRadius: "6px", border: "1px solid #e0e0e0" }}>
                        <div className="d-flex align-items-center justify-content-between" style={{ marginTop: "-3px" }}>
                          <span style={{ fontSize: "13px", color: "#666", fontWeight: 500, marginTop: "3px" }}>Sort by:</span>
                          <Form.Select
                            size="sm"
                            style={{
                              width: "125px",
                              fontSize: "11px",
                              border: "1px solid #e0e0e0",
                              borderRadius: "6px",
                              padding: "4px 8px",
                              height: "22px",
                              lineHeight: "10px",
                              marginTop: "3px"
                            }}
                          >
                            <option>Date Created</option>
                            <option>Name</option>
                            <option>Type</option>
                          </Form.Select>
                        </div>
                      </div>
                    </div>
                    <div className="workspace-body workspace-list">
                      <Nav className="flex-column">
                        {loadingWorkspaceCodes ? (
                          <div className="text-center p-3">
                            <Spinner animation="border" size="sm" />
                          </div>
                        ) : filteredWorkspaceCodes.length > 0 ? (
                          filteredWorkspaceCodes.map((code, index) => (
                            <Nav.Item key={code.id}>
                              <div className="d-flex align-items-center">
                                <Nav.Link
                                  className="d-flex cursor-pointer flex-fill"
                                  onClick={() => loadWorkspaceCode(code)}
                                >
                                  <span className="icon me-2">
                                    <BiListUl />
                                  </span>
                                  <span className="name text-truncate">
                                    {code.nlpDescription}
                                  </span>
                                  <span className="type text-nowrap">.sql</span>
                                </Nav.Link>
                                <div
                                  className="ms-2 me-2 d-flex align-items-center justify-content-center cursor-pointer text-danger"
                                  style={{
                                    width: "24px",
                                    height: "24px",
                                    cursor: "pointer",
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteWorkspaceCode(code.id);
                                  }}
                                  title="Delete transformation"
                                >
                                  <BiTrash size={16} />
                                </div>
                              </div>
                            </Nav.Item>
                          ))
                        ) : (
                          <>
                            {/* ETL SQL file list */}
                            {loadingEtlSqlFiles ? (
                              <div className="text-center p-2">
                                <Spinner animation="border" size="sm" />
                          </div>
                            ) : etlSqlFiles.length === 0 ? (
                              <div className="text-center p-2 text-muted small">
                                No SQL files found
                              </div>
                            ) : (
                              etlSqlFiles.map((name) => (
                                <Nav.Item key={name}>
                                  <Nav.Link
                                    className="d-flex align-items-center px-3 py-2"
                                    onClick={() => loadEtlSqlFile(name)}
                                    style={{
                                      cursor: "pointer",
                                      fontSize: "14px",
                                      color: "#333",
                                      borderLeft: "3px solid transparent",
                                      transition: "all 0.2s",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = "#f8f9fa";
                                      e.currentTarget.style.borderLeftColor = "#0d6efd";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = "transparent";
                                      e.currentTarget.style.borderLeftColor = "transparent";
                                    }}
                                  >
                                    <span className="me-2" style={{ fontSize: "16px" }}>
                                      ≡
                                    </span>
                                    <span className="text-truncate">
                                      {name.replace(/\.sql$/i, "")}
                                    </span>
                                    <span style={{ fontSize: "13px" }}>.sql</span>
                                  </Nav.Link>
                                </Nav.Item>
                              ))
                            )}
                          </>
                        )}
                      </Nav>
                    </div>
                  </div>
                </div>
                <div className="canvas-collapse_body">
                  <div className="d-flex flex-column h-100">
                    {/* Action buttons for code */}
                    {generatedCode && (
                      <div 
                        className="d-flex justify-content-end gap-2 px-3 py-2 border-bottom bg-light"
                        style={{ position: "sticky", top: 0, zIndex: 5, height: '33px'}}
                      >
                                <Button
                          variant={isEditingCode ? "success" : "outline-secondary"}
                                  size="sm"
                                  onClick={handleEditCode}
                          style={{
                            fontSize: "10px",
                            marginRight: "10px",
                            marginTop: "-3px",
                            width: "100px",
                            height: "22px",
                            padding: "6px 16px",
                            borderRadius: "6px",
                          }}
                        >
                          {isEditingCode ? (
                            <BiSave className="me-1" />
                          ) : (
                            <BiPencil className="me-1" />
                          )}
                          {isEditingCode ? "Save Changes" : "Edit Code"}
                                </Button>
                                <Button
                          variant="outline-secondary"
                                  size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(editableSqlCode || generatedCode.sql);
                            alert("Code copied to clipboard!");
                          }}
                          style={{
                            fontSize: "10px",
                            marginRight: "10px",
                            marginTop: "-3px",
                            width: "107px",
                            height: "22px",
                            padding: "6px 16px",
                            borderRadius: "6px",
                          }}
                        >
                          <BiCopyAlt className="me-1" />
                          Copy Code
                                </Button>
                              </div>
                    )}
                    {/* Code Display Area - now scrollable and always shows input below */}
                    <div 
                      className="flex-fill"
                      style={{ 
                        overflowY: "auto",
                        maxHeight: "calc(100vh - 280px)"
                      }}
                    >
                      {generatedCode ? (
                        <div className="p-0">
                                      {isEditingCode ? (
                            /* Editable textarea mode with syntax highlighting */
                            <div className="p-3" style={{ backgroundColor: "#f8f9fa" }}>
                                        <Form.Control
                                          as="textarea"
                                          value={editableSqlCode}
                                onChange={(e) => setEditableSqlCode(e.target.value)}
                                          style={{
                                  fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
                                  fontSize: "13px",
                                  lineHeight: "1.8",
                                  height: "312px",
                                  backgroundColor: "#ffffff",
                                  color: "#2d3748",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: "6px",
                                  padding: "16px",
                                  resize: "vertical",
                                }}
                              />
                            </div>
                          ) : (
                            /* Colorful code viewer with line numbers */
                                        <div
                                          style={{
                                backgroundColor: "#ffffff",
                                fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
                                fontSize: "10px",
                                lineHeight: "1.8",
                                color: "#2d3748",
                                height: "312px",
                                // overflowY: "auto",
                              }}
                            >
                              {(editableSqlCode || generatedCode.sql)
                                .split("\n")
                                // Show all lines but only 13 visible by container height
                                .map((line, index) => {
                                  // Simple SQL syntax highlighting for light theme
                                  const highlightSQL = (text: string) => {
                                    const keywords = /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|DROP|ALTER|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|AND|OR|NOT|IN|EXISTS|BETWEEN|LIKE|ORDER BY|GROUP BY|HAVING|LIMIT|OFFSET|VALUES|SET|DECLARE|BEGIN|END|IF|ELSE|WHILE|CASE|WHEN|THEN|RETURN|COUNT|SUM|AVG|MAX|MIN|DISTINCT|PRIMARY|KEY|FOREIGN|REFERENCES|INDEX|DEFAULT|NULL|NOT NULL|AUTO_INCREMENT|INT|VARCHAR|TEXT|DATE|TIMESTAMP|DECIMAL|CURRENT_TIMESTAMP)\b/gi;
                                    const strings = /('([^'\\]|\\.)*'|"([^"\\]|\\.)*")/g;
                                    const numbers = /\b(\d+\.?\d*)\b/g;
                                    const comments = /(--.*$|\/\*[\s\S]*?\*\/)/g;
                                    const functions = /\b([A-Z_]+)\s*\(/g;
                                    
                                    let result = text;
                                    
                                    // Highlight comments (green)
                                    result = result.replace(comments, '<span style="color: #22863a;">$1</span>');
                                    
                                    // Highlight strings (red/orange)
                                    result = result.replace(strings, '<span style="color: #d73a49;">$1</span>');
                                    
                                    // Highlight numbers (teal)
                                    result = result.replace(numbers, '<span style="color: #005cc5;">$1</span>');
                                    
                                    // Highlight SQL keywords (purple/blue)
                                    result = result.replace(keywords, '<span style="color: #6f42c1; font-weight: 600;">$1</span>');
                                    
                                    // Highlight functions (orange)
                                    result = result.replace(functions, '<span style="color: #e36209;">$1</span>(');
                                    
                                    return result;
                                  };

                                  return (
                                    <div
                                      key={index}
                                            style={{
                                        display: "flex",
                                        minHeight: "17px",
                                        backgroundColor: index % 2 === 0 ? "#ffffff" : "#ffffff",
                                      }}
                                    >
                                      <div
                                          style={{
                                          backgroundColor: "#f6f8fa",
                                          color: "#6a737d",
                                          padding: "0 16px",
                                          textAlign: "right",
                                          minWidth: "50px",
                                          userSelect: "none",
                                          borderRight: "2px solid #e1e4e8",
                                          fontWeight: 500,
                                        }}
                                      >
                                        {index + 1}
                                      </div>
                                        <div
                                          style={{
                                          padding: "0 16px",
                                          flex: 1,
                                          whiteSpace: "pre",
                                        }}
                                        dangerouslySetInnerHTML={{
                                          __html: highlightSQL(line || " "),
                                        }}
                                      />
                                    </div>
                                  );
                                })}
                                        </div>
                                      )}
                                    </div>
                      ) : codeGenerationError ? (
                        <div className="text-center d-flex align-items-center justify-content-center h-100">
                          <div className="text-danger">
                            <p className="mb-2">{codeGenerationError}</p>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => setCodeGenerationError(null)}
                            >
                              Try Again
                            </Button>
                          </div>
                        </div>
                      ) : (   
                        <div className="text-center d-flex align-items-center justify-content-center h-100 fw-medium text-large text-muted">
                          <div>
                            <div className="mb-3">
                              <Image
                                src={aiIcon}
                                alt="AI"
                                style={{
                                  width: "48px",
                                  height: "48px",
                                  opacity: 0.6,
                                }}
                              />
                            </div>
                            <p>
                              Describe your transformation in plain English...
                            </p>
                            <p className="text-muted small">
                              Example: "Filter active users and count them by
                              city"
                            </p>
                          </div>
                        </div>)}
                    </div>

                    {/* NLP Input Area - Always visible at bottom */}
                    <div
                      className="border-top bg-white"
                      style={{
                        position: "sticky",
                        bottom: 0,
                        zIndex: 10,
                        height: "53px",
                      }}
                    >
                      <Form.Group className="d-flex align-items-center p-3 m-0">
                        <div 
                          className="me-2"
                          style={{
                            width: "24px",
                            height: "24px",
                            marginTop: "-7px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                              <Image
                                src={aiIcon}
                                alt="AI"
                                style={{
                              width: "20px",
                              height: "20px",
                            }}
                          />
                      </div>
                      <Form.Control
                        placeholder="Describe your transformation in plain English..."
                        value={nlpInput}
                        onChange={(e) => setNlpInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            generateCodeFromNLP(nlpInput);
                          }
                        }}
                        disabled={isGeneratingCode}
                          style={{
                            border: "1px solid #e0e0e0",
                            borderRadius: "8px",
                            padding: "10px 16px",
                            fontSize: "12px",
                            marginTop: "-7px",
                            height: "31px",
                          }}
                      />
                      {/* <Button
                        variant="primary"
                        className="ms-2"
                        onClick={() => generateCodeFromNLP(nlpInput)}
                        disabled={isGeneratingCode || !nlpInput.trim()}
                          style={{
                            borderRadius: "8px",
                            // padding: "10px 20px",
                            fontSize: "14px",
                            fontWeight: 500,
                            marginTop: "-9px"
                          }}
                      >
                        {isGeneratingCode ? (
                          <>
                            <Spinner
                              animation="border"
                              size="sm"
                              className="me-2"
                            />
                            Generating...
                          </>
                        ) : (
                          <>
                            <BiSolidData className="me-1" />
                            Generate
                          </>
                        )}
                      </Button> */}
                    </Form.Group>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === "records" && (
              <>
                <div className="canvas-records w-100">
                  <header className="canvas-records_header p-3 d-flex align-items-center justify-content-between w-100">
                    <h4 className="text-medium fw-medium m-0">
                      Sample Records ({expandedCanvasHeader?.entityData?.label})
                    </h4>
                    <CloseButton
                      onClick={() => {
                        setExpandedCanvasHeader(null);
                      }}
                    />
                  </header>

                  <div
                    className="canvas-records_body"
                    style={{ maxHeight: "400px", overflowY: "auto" }}
                  >
                    <Table bordered hover responsive>
                      <thead className="table-light sticky-top">
                        <tr>
                          <th style={{ width: "50px" }}>#</th>
                          {expandedCanvasHeader?.entityData?.attributes?.map(
                            (attr, idx) => (
                              <th key={idx} className="text-nowrap">
                                <div className="d-flex align-items-center gap-2">
                                  <span className="fw-medium">{attr.name}</span>
                                  <small className="text-muted">
                                    ({attr.type || "string"})
                                  </small>
                                </div>
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {sampleRecords.length > 0 ? (
                          sampleRecords.map((record, recordIdx) => (
                            <tr key={recordIdx}>
                              <td className="text-muted fw-medium">
                                {recordIdx + 1}
                              </td>
                              {expandedCanvasHeader?.entityData?.attributes?.map(
                                (attr, attrIdx) => (
                                  <td key={attrIdx} className="text-nowrap">
                                    <span className="text-break">
                                      {record[attr.name] !== null &&
                                      record[attr.name] !== undefined ? (
                                        String(record[attr.name])
                                      ) : (
                                        <span className="text-muted">null</span>
                                      )}
                                    </span>
                                  </td>
                                )
                              )}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={
                                expandedCanvasHeader?.entityData?.attributes
                                  ?.length + 1
                              }
                              className="text-center py-4"
                            >
                              <div className="text-muted">
                                <BiShow size={24} className="mb-2" />
                                <p className="mb-2">
                                  No sample records generated yet
                                </p>
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={generateSampleRecords}
                                  disabled={isGeneratingRecords}
                                >
                                  Generate Sample Records
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      )}

      {/* Artifacts Generator Modal */}
      <CanvasArtifactsGenerator
        show={showArtifactsGenerator}
        onHide={() => setShowArtifactsGenerator(false)}
        entityData={expandedCanvasHeader?.entityData}
        githubConnection={githubConnection}
      />

      {/* Accepted Transformations Modal */}
      <ConsumptionETLTransformationsManager
        show={showAcceptedTransformations}
        onHide={() => setShowAcceptedTransformations(false)}
        entityName={expandedCanvasHeader?.entityData?.label}
      />
    </>
  );
}

export default CanvasHeader;
