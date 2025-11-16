import { useState, useEffect } from "react";
import axios from "axios";
import {
  Offcanvas,
  Tabs,
  Tab,
  Form,
  Button,
  TabContainer,
  Nav,
  TabContent,
  TabPane,
  Card,
  Image,
  Spinner,
  Badge,
  Alert,
  Accordion,
} from "react-bootstrap";

import curatedAi from "../assets/curatedAi-icon.svg";
import curatedFile from "../assets/curatedFile-icon.svg";

function ColumnETLModal({
  open,
  column,
  entityColumns,
  handleClose,
  onAcceptCode,
}) {
  const [nlpText, setNlpText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSqlCode, setGeneratedSqlCode] = useState("");
  const [generatedPySparkCode, setGeneratedPySparkCode] = useState("");
  const [activeCodeTab, setActiveCodeTab] = useState("sqlCode");
  const [isEditingSql, setIsEditingSql] = useState(false);
  const [isEditingPySpark, setIsEditingPySpark] = useState(false);
  const [editableSqlCode, setEditableSqlCode] = useState("");
  const [editablePySparkCode, setEditablePySparkCode] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptedArtifacts, setAcceptedArtifacts] = useState([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);

  // Add debugging and fallbacks
  const entityName = column || "Unknown Entity";
  const columns = entityColumns || [];

  console.log("ColumnETLModal props:", {
    column,
    entityColumns,
    entityName,
    columns,
  });

  // Fetch accepted NLP artifacts for this entity
  const fetchAcceptedArtifacts = async () => {
    if (!entityName || entityName === "Unknown Entity") return;

    setLoadingArtifacts(true);
    try {
      // Handle different entity name formats
      let rawEntityName = entityName;
      if (entityName.includes("curated.")) {
        rawEntityName = entityName.replace("curated.", "");
      } else if (entityName.includes("raw.")) {
        rawEntityName = entityName.replace("raw.", "");
      }

      console.log("Fetching artifacts for entity:", rawEntityName);
      const response = await axios.get(
        `/api/nlp-artifacts/entity/${rawEntityName}`
      );

      if (response.data.success) {
        console.log("Found artifacts:", response.data.data);
        setAcceptedArtifacts(response.data.data);
      } else {
        console.log("No artifacts found for entity:", rawEntityName);
        setAcceptedArtifacts([]);
      }
    } catch (error) {
      console.error("Error fetching accepted artifacts:", error);
      setAcceptedArtifacts([]);
    } finally {
      setLoadingArtifacts(false);
    }
  };

  // Fetch artifacts when modal opens
  useEffect(() => {
    if (open) {
      fetchAcceptedArtifacts();
    }
  }, [open, entityName]);

  const [operatorCol, setOperatorCol] = useState(columns[0] || "");
  const [operator, setOperator] = useState(">");
  const [opValue, setOpValue] = useState("");
  // Mock code generation for Operator tab
  const operatorSqlCode = `-- SQL for: ${operatorCol} ${operator} ${opValue}\nSELECT * FROM table WHERE ${operatorCol} ${operator} ${opValue}`;
  const operatorPySparkCode = `# PySpark for: ${operatorCol} ${operator} ${opValue}\ndef transform(df):\n    return df.filter(df.${operatorCol} ${operator} ${opValue})`;
  // DQ Rules state and code generation
  const [dqRulesText, setDqRulesText] = useState("");
  const dqSqlCode = dqRulesText
    ? `-- SQL DQ Rules for: ${dqRulesText}\nSELECT\n    CASE\n        WHEN ${dqRulesText} THEN 'PASS'\n        ELSE 'FAIL'\n    END as dq_check\nFROM table`
    : "";
  const dqPySparkCode = dqRulesText
    ? `# PySpark DQ Rules for: ${dqRulesText}\ndef check_dq_rules(df):\n    return df.withColumn('dq_check',\n        when(${dqRulesText}, 'PASS')\n        .otherwise('FAIL')\n    )`
    : "";

  // Mock LLM API call function
  const generateCodeFromNLP = async () => {
    if (!nlpText.trim()) {
      alert("Please enter some text to generate code from.");
      return;
    }

    setIsGenerating(true);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate random SQL code based on NLP input
    const sqlTemplates = [
      `-- Generated SQL for Entity: ${entityName}
-- NLP Description: ${nlpText}

SELECT 
    *,
    CASE 
        WHEN ${columns[0] || "id"} IS NOT NULL THEN 'VALID'
        ELSE 'INVALID'
    END as validation_status,
    LENGTH(${columns[0] || "id"}) as column_length
FROM ${entityName}
WHERE ${columns[0] || "id"} IS NOT NULL
ORDER BY ${columns[0] || "id"} DESC;`,

      `-- Generated SQL for Entity: ${entityName}
-- NLP Description: ${nlpText}

SELECT 
    *,
    UPPER(${columns[0] || "name"}) as upper_${columns[0] || "name"},
    LOWER(${columns[0] || "name"}) as lower_${columns[0] || "name"},
    TRIM(${columns[0] || "name"}) as trimmed_${columns[0] || "name"}
FROM ${entityName}
WHERE ${columns[0] || "name"} != ''
GROUP BY ${columns[0] || "name"};`,

      `-- Generated SQL for Entity: ${entityName}
-- NLP Description: ${nlpText}

SELECT 
    *,
    DATE_FORMAT(${
      columns.find((col) => col.toLowerCase().includes("date")) ||
      columns[0] ||
      "created_date"
    }, '%Y-%m-%d') as formatted_date,
    YEAR(${
      columns.find((col) => col.toLowerCase().includes("date")) ||
      columns[0] ||
      "created_date"
    }) as year_extracted,
    MONTH(${
      columns.find((col) => col.toLowerCase().includes("date")) ||
      columns[0] ||
      "created_date"
    }) as month_extracted
FROM ${entityName}
WHERE ${
        columns.find((col) => col.toLowerCase().includes("date")) ||
        columns[0] ||
        "created_date"
      } IS NOT NULL
AND ${
        columns.find((col) => col.toLowerCase().includes("date")) ||
        columns[0] ||
        "created_date"
      } != '0000-00-00';`,
    ];

    // Generate random PySpark code based on NLP input
    const pysparkTemplates = [
      `# Generated PySpark code for Entity: ${entityName}
# NLP Description: ${nlpText}

from pyspark.sql.functions import col, when, length, upper, lower, trim
from pyspark.sql.types import StringType

def transform_entity_dataframe(df):
    """
    Transform entity ${entityName} based on NLP requirements: ${nlpText}
    """
    return df.withColumn(
        'validation_status',
        when(col('${columns[0] || "id"}').isNotNull(), 'VALID')
        .otherwise('INVALID')
    ).withColumn(
        'column_length',
        length(col('${columns[0] || "id"}'))
    ).filter(
        col('${columns[0] || "id"}').isNotNull()
    ).orderBy(
        col('${columns[0] || "id"}').desc()
    )`,

      `# Generated PySpark code for Entity: ${entityName}
# NLP Description: ${nlpText}

from pyspark.sql.functions import col, upper, lower, trim, regexp_replace
from pyspark.sql.types import StringType

def transform_entity_dataframe(df):
    """
    Transform entity ${entityName} based on NLP requirements: ${nlpText}
    """
    return df.withColumn(
        'upper_${columns[0] || "name"}',
        upper(col('${columns[0] || "name"}'))
    ).withColumn(
        'lower_${columns[0] || "name"}',
        lower(col('${columns[0] || "name"}'))
    ).withColumn(
        'trimmed_${columns[0] || "name"}',
        trim(col('${columns[0] || "name"}'))
    ).withColumn(
        'cleaned_${columns[0] || "name"}',
        regexp_replace(col('${columns[0] || "name"}'), '[^a-zA-Z0-9\\\\s]', '')
    ).filter(
        col('${columns[0] || "name"}') != ''
    ).groupBy('${columns[0] || "name"}')`,

      `# Generated PySpark code for Entity: ${entityName}
# NLP Description: ${nlpText}

from pyspark.sql.functions import col, year, month, dayofmonth, date_format
from pyspark.sql.types import DateType

def transform_entity_dataframe(df):
    """
    Transform entity ${entityName} based on NLP requirements: ${nlpText}
    """
    date_column = '${
      columns.find((col) => col.toLowerCase().includes("date")) ||
      columns[0] ||
      "created_date"
    }'
    
    return df.withColumn(
        'formatted_date',
        date_format(col(date_column), 'yyyy-MM-dd')
    ).withColumn(
        'year_extracted',
        year(col(date_column))
    ).withColumn(
        'month_extracted',
        month(col(date_column))
    ).withColumn(
        'day_extracted',
        dayofmonth(col(date_column))
    ).filter(
        col(date_column).isNotNull()
    ).filter(
        col(date_column) != '0000-00-00'
    )`,
    ];

    // Randomly select templates
    const randomSqlIndex = Math.floor(Math.random() * sqlTemplates.length);
    const randomPySparkIndex = Math.floor(
      Math.random() * pysparkTemplates.length
    );

    const newSqlCode = sqlTemplates[randomSqlIndex];
    const newPySparkCode = pysparkTemplates[randomPySparkIndex];

    setGeneratedSqlCode(newSqlCode);
    setGeneratedPySparkCode(newPySparkCode);
    setEditableSqlCode(newSqlCode);
    setEditablePySparkCode(newPySparkCode);
    setIsGenerating(false);
  };

  const handleSave = () => {
    alert(`Saved changes for ${entityName} in ${tab} tab`);
  };

  const handleShowProfile = () => {
    alert(`Showing Table & Column Profile for ${entityName}`);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert("Code copied to clipboard!");
      })
      .catch(() => {
        alert("Failed to copy code to clipboard");
      });
  };

  const handleEditCode = (type) => {
    if (type === "sql") {
      setIsEditingSql(!isEditingSql);
    } else {
      setIsEditingPySpark(!isEditingPySpark);
    }
  };

  const handleAcceptCode = async () => {
    if (!generatedSqlCode && !generatedPySparkCode) {
      alert("No code generated yet. Please generate code first.");
      return;
    }

    setIsAccepting(true);

    try {
      // Call the parent component's callback with the entity NLP data
      if (onAcceptCode) {
        await onAcceptCode({
          entityName: entityName,
          nlpDescription: nlpText,
          sqlCode: isEditingSql ? editableSqlCode : generatedSqlCode,
          pysparkCode: isEditingPySpark
            ? editablePySparkCode
            : generatedPySparkCode,
          entityColumns: columns,
        });
      }

      // Close the modal after successful acceptance
      handleModalClose();
    } catch (error) {
      alert("Failed to accept code. Please try again.");
    } finally {
      setIsAccepting(false);
    }
  };

  // Load artifact data into the form for editing
  const handleLoadArtifact = (artifact) => {
    setNlpText(artifact.nlpDescription);
    setGeneratedSqlCode(artifact.sqlCode);
    setGeneratedPySparkCode(artifact.pysparkCode);
    setEditableSqlCode(artifact.sqlCode);
    setEditablePySparkCode(artifact.pysparkCode);
    setIsEditingSql(false);
    setIsEditingPySpark(false);
    setActiveCodeTab("sqlCode");

    // Scroll to top of the form
    const modalBody = document.querySelector(".offcanvas-body");
    if (modalBody) {
      modalBody.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Clear all state when modal is closed
  const handleModalClose = () => {
    setNlpText("");
    setGeneratedSqlCode("");
    setGeneratedPySparkCode("");
    setEditableSqlCode("");
    setEditablePySparkCode("");
    setIsGenerating(false);
    setIsEditingSql(false);
    setIsEditingPySpark(false);
    setIsAccepting(false);
    setActiveCodeTab("sqlCode");
    handleClose();
  };

  if (!open) return null;
  return (
    <Offcanvas
      className="size-lg"
      show={open}
      onHide={handleModalClose}
      placement="end"
    >
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Entity NLP Transformation</Offcanvas.Title>
        <div className="d-flex align-items-center gap-2">
          <Image src={curatedFile} alt="" />
          <span>{entityName}</span>
          <Image src={curatedAi} alt="" />
          <Image src={curatedFile} alt="" />
          <span>{entityName}</span>
        </div>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {/* <button className="hero-btn primary" onClick={handleShowProfile}>
              Show Table & Column Profile
            </button> */}

        <Tabs defaultActiveKey="tab-nlp" className="justify-content-start mb-4">
          {/* NLP - Start */}
          <Tab eventKey="tab-nlp" title="NLP">
            <Form.Group className="mb-4">
              <div className="d-flex gap-3">
                <Form.Control
                  size="lg"
                  value={nlpText}
                  onChange={(e) => setNlpText(e.target.value)}
                  placeholder="Describe your entity transformation in natural language..."
                  disabled={isGenerating}
                />
                <Button
                  variant="primary pill"
                  size="lg"
                  onClick={generateCodeFromNLP}
                  disabled={isGenerating || !nlpText.trim()}
                >
                  {isGenerating ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                        className="me-2"
                      />
                      Generating...
                    </>
                  ) : (
                    "Generate Code"
                  )}
                </Button>
              </div>

              <Form.Text className="text-muted">
                Describe how you want to transform the entire entity in plain
                English, and we'll generate the SQL and PySpark code for you
              </Form.Text>
            </Form.Group>

            <p>
              <b>Examples:</b> Sort all data by transaction date descending,
              Create new columns for age calculation from birth_date, Filter out
              invalid records
            </p>

            {(generatedSqlCode || generatedPySparkCode) && (
              <TabContainer
                activeKey={activeCodeTab}
                onSelect={(k) => setActiveCodeTab(k)}
              >
                <Card>
                  <Card.Header className="py-0 px-4 d-flex">
                    <Nav variant="tabs" className="justify-content-start m-0">
                      <Nav.Item>
                        <Nav.Link eventKey="sqlCode">SQL Code</Nav.Link>
                      </Nav.Item>
                      <Nav.Item>
                        <Nav.Link eventKey="pySparkCode">PySpark Code</Nav.Link>
                      </Nav.Item>
                    </Nav>
                    <div className="d-flex gap-2 ms-auto">
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() =>
                          handleEditCode(
                            activeCodeTab === "sqlCode" ? "sql" : "pyspark"
                          )
                        }
                      >
                        {activeCodeTab === "sqlCode"
                          ? isEditingSql
                            ? "Save"
                            : "Edit"
                          : isEditingPySpark
                          ? "Save"
                          : "Edit"}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            activeCodeTab === "sqlCode"
                              ? isEditingSql
                                ? editableSqlCode
                                : generatedSqlCode
                              : isEditingPySpark
                              ? editablePySparkCode
                              : generatedPySparkCode
                          )
                        }
                      >
                        Copy Code
                      </Button>
                    </div>
                  </Card.Header>
                  <Card.Body>
                    <TabContent>
                      <TabPane eventKey="sqlCode">
                        {generatedSqlCode ? (
                          isEditingSql ? (
                            <Form.Control
                              as="textarea"
                              rows={15}
                              value={editableSqlCode}
                              onChange={(e) =>
                                setEditableSqlCode(e.target.value)
                              }
                              style={{
                                fontFamily: "monospace",
                                fontSize: "0.875rem",
                                lineHeight: "1.5",
                              }}
                            />
                          ) : (
                            <pre
                              style={{
                                backgroundColor: "#f8f9fa",
                                padding: "1rem",
                                borderRadius: "0.375rem",
                                fontSize: "0.875rem",
                                lineHeight: "1.5",
                                overflow: "auto",
                                maxHeight: "400px",
                              }}
                            >
                              <code>{generatedSqlCode}</code>
                            </pre>
                          )
                        ) : (
                          <h5 className="text-large text-muted text-center p-5">
                            SQL Code will be shown here...
                          </h5>
                        )}
                      </TabPane>
                      <TabPane eventKey="pySparkCode">
                        {generatedPySparkCode ? (
                          isEditingPySpark ? (
                            <Form.Control
                              as="textarea"
                              rows={15}
                              value={editablePySparkCode}
                              onChange={(e) =>
                                setEditablePySparkCode(e.target.value)
                              }
                              style={{
                                fontFamily: "monospace",
                                fontSize: "0.875rem",
                                lineHeight: "1.5",
                              }}
                            />
                          ) : (
                            <pre
                              style={{
                                backgroundColor: "#f8f9fa",
                                padding: "1rem",
                                borderRadius: "0.375rem",
                                fontSize: "0.875rem",
                                lineHeight: "1.5",
                                overflow: "auto",
                                maxHeight: "400px",
                              }}
                            >
                              <code>{generatedPySparkCode}</code>
                            </pre>
                          )
                        ) : (
                          <h5 className="text-large text-muted text-center p-5">
                            PySpark Code will be shown here...
                          </h5>
                        )}
                      </TabPane>
                    </TabContent>
                  </Card.Body>
                </Card>

                {/* Accept Button */}
                <div className="d-flex justify-content-center mt-4">
                  <Button
                    variant="success"
                    size="lg"
                    onClick={handleAcceptCode}
                    disabled={isAccepting}
                  >
                    {isAccepting ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                          className="me-2"
                        />
                        Accepting...
                      </>
                    ) : (
                      "✅ Accept & Add to Entity Artefacts"
                    )}
                  </Button>
                </div>
              </TabContainer>
            )}

            {!generatedSqlCode && !generatedPySparkCode && (
              <TabContainer defaultActiveKey="sqlCode">
                <Card>
                  <Card.Header className="py-0 px-4 d-flex">
                    <Nav variant="tabs" className="justify-content-start m-0">
                      <Nav.Item>
                        <Nav.Link eventKey="sqlCode">SQL Code</Nav.Link>
                      </Nav.Item>
                      <Nav.Item>
                        <Nav.Link eventKey="pySparkCode">PySpark Code</Nav.Link>
                      </Nav.Item>
                    </Nav>
                    <Button
                      variant="default"
                      size="sm"
                      className="ms-auto pe-0"
                    >
                      Copy Code
                    </Button>
                  </Card.Header>
                  <Card.Body>
                    <TabContent>
                      <TabPane eventKey="sqlCode">
                        <h5 className="text-large text-muted text-center p-5">
                          SQL Code will be shown here...
                        </h5>
                      </TabPane>
                      <TabPane eventKey="pySparkCode">
                        <h5 className="text-large text-muted text-center p-5">
                          PySpark Code will be shown here...
                        </h5>
                      </TabPane>
                    </TabContent>
                  </Card.Body>
                </Card>
              </TabContainer>
            )}

            {/* Accepted NLP Artifacts Listing */}
            <div className="mt-4">
              <h6>Previously Accepted NLP Artifacts</h6>
              <p className="text-muted mb-3">
                Click on any artifact below to load it for editing and
                regeneration.
              </p>

              {loadingArtifacts ? (
                <div className="text-center py-3">
                  <Spinner animation="border" size="sm" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </Spinner>
                </div>
              ) : acceptedArtifacts.length === 0 ? (
                <Alert variant="info" className="mb-0">
                  No accepted NLP artifacts found for this entity.
                </Alert>
              ) : (
                <div className="row g-3">
                  {acceptedArtifacts.map((artifact, index) => (
                    <div key={artifact.id} className="col-12">
                      <Card
                        className="cursor-pointer artifact-card"
                        onClick={() => handleLoadArtifact(artifact)}
                        style={{
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          border: "1px solid #dee2e6",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "#0d6efd";
                          e.currentTarget.style.boxShadow =
                            "0 0 0 0.2rem rgba(13, 110, 253, 0.25)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "#dee2e6";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        <Card.Body className="py-3">
                          <div className="d-flex justify-content-between align-items-start">
                            <div className="flex-grow-1">
                              <h6 className="mb-2 text-primary">
                                📝 {artifact.nlpDescription.substring(0, 60)}
                                {artifact.nlpDescription.length > 60
                                  ? "..."
                                  : ""}
                              </h6>
                              <div className="mb-2">
                                <small className="text-muted">
                                  <strong>Entity Columns:</strong>{" "}
                                  {artifact.entityColumns
                                    ?.slice(0, 3)
                                    .map((col, idx) => (
                                      <Badge
                                        key={idx}
                                        bg="secondary"
                                        className="me-1"
                                      >
                                        {col}
                                      </Badge>
                                    ))}
                                  {artifact.entityColumns?.length > 3 && (
                                    <Badge bg="secondary">
                                      +{artifact.entityColumns.length - 3} more
                                    </Badge>
                                  )}
                                </small>
                              </div>
                              <div className="d-flex gap-2">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(artifact.sqlCode);
                                  }}
                                >
                                  Copy SQL
                                </Button>
                                <Button
                                  variant="outline-secondary"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(artifact.pysparkCode);
                                  }}
                                >
                                  Copy PySpark
                                </Button>
                              </div>
                            </div>
                            <div className="text-end">
                              <Badge bg="success" className="mb-2">
                                Accepted
                              </Badge>
                              <br />
                              <small className="text-muted">
                                {new Date(
                                  artifact.acceptedAt
                                ).toLocaleDateString()}
                              </small>
                            </div>
                          </div>
                        </Card.Body>
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Tab>
          {/* NLP - End */}

          {/* Operator - Start */}
          {/* <Tab eventKey="tab-operator" title="Operator">
            <div className="etl-operator-tab">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label>Column:</label>
                <select
                  value={operatorCol}
                  onChange={(e) => setOperatorCol(e.target.value)}
                >
                  {entityColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <label>Operator:</label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                >
                  <option value=">">Greater than</option>
                  <option value="<">Less than</option>
                </select>
                <label>Value:</label>
                <input
                  value={opValue}
                  onChange={(e) => setOpValue(e.target.value)}
                  style={{ width: 80 }}
                />
              </div>
            </div>
          </Tab> */}
          {/* Operator - End */}
          {/* DQ Rules - Start */}
          {/* <Tab eventKey="tab-dq" title="DQ Rules">
            <div className="etl-nlp-row">
              <div className="etl-nlp-input">
                <label>Describe your DQ rules in English:</label>
                <textarea
                  value={dqRulesText}
                  onChange={(e) => setDqRulesText(e.target.value)}
                  placeholder="e.g. column_name IS NOT NULL AND column_name > 0"
                />
              </div>
            </div>
          </Tab> */}
          {/* DQ Rules - End */}
        </Tabs>
      </Offcanvas.Body>
    </Offcanvas>
  );
}

export default ColumnETLModal;
