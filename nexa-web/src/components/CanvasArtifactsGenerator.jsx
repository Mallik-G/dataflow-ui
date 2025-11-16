import React, { useState, useEffect } from "react";
import {
  Button,
  Modal,
  Accordion,
  Badge,
  Spinner,
  Alert,
} from "react-bootstrap";
import { BiGitBranch, BiCopyAlt, BiFolder, BiFile } from "react-icons/bi";
import axios from "axios";

const CanvasArtifactsGenerator = ({
  entityData,
  show,
  onHide,
  githubConnection = null,
}) => {
  const [isGeneratingArtifacts, setIsGeneratingArtifacts] = useState(false);
  const [generatedArtifacts, setGeneratedArtifacts] = useState(null);
  const [isGeneratingDiffs, setIsGeneratingDiffs] = useState(false);
  const [diffProgress, setDiffProgress] = useState({
    current: 0,
    total: 1,
    percentage: 0,
    currentEntity: "Preparing...",
  });
  const [storedArtifacts, setStoredArtifacts] = useState([]);
  const [loadingStoredArtifacts, setLoadingStoredArtifacts] = useState(false);
  const [showDiffsModal, setShowDiffsModal] = useState(false);
  const [generatedDiffs, setGeneratedDiffs] = useState(null);
  const [isPushingToGitHub, setIsPushingToGitHub] = useState(false);
  const [isPushingArtifacts, setIsPushingArtifacts] = useState(false);

  // Generate artifacts for the current entity
  const generateArtifacts = async () => {
    if (!entityData) {
      alert("No entity data available for artifact generation.");
      return;
    }

    setIsGeneratingArtifacts(true);
    setIsPushingArtifacts(!!githubConnection);
    try {
      // Create transformations object for consumption entities with M:1 mapping support
      const transformations = {
        entityName: entityData.label,
        consumptionEntityName: entityData.label,
        attributes: entityData.attributes || [],
        sourceEntities: [entityData.label], // Default to self, can be extended for M:1 mappings
        mappings:
          entityData.attributes?.map((attr) => ({
            source: attr.name,
            target: attr.name,
            sourceEntity: entityData.label,
            transformation: "direct_mapping",
            joinCondition: null,
            isPrimaryKey: attr.name.toLowerCase().includes("id"),
            caseConditions: [],
            aggregationFunction: null,
            sourceFields: [],
            calculationExpression: null,
            defaultValue: null,
          })) || [],
        dataTypes:
          entityData.attributes?.reduce((acc, attr) => {
            acc[attr.name] = attr.type || "VARCHAR(255)";
            return acc;
          }, {}) || {},
        constraints: {},
        businessRules: [],
        dataQualityRules: [],
        transformationLogic: {},
        filterConditions: [],
        // Example of how M:1 mappings would be structured:
        // sourceEntities: ['curated_account', 'curated_contract', 'consumption_billing'],
        // mappings: [
        //   {
        //     source: 'account_id',
        //     target: 'account_id',
        //     sourceEntity: 'curated_account',
        //     transformation: 'direct_mapping',
        //     joinCondition: 'curated_account.id = consumption_billing.account_id'
        //   },
        //   {
        //     source: 'contract_id',
        //     target: 'contract_id',
        //     sourceEntity: 'curated_contract',
        //     transformation: 'direct_mapping',
        //     joinCondition: 'curated_contract.id = consumption_billing.contract_id'
        //   },
        //   {
        //     source: 'full_name',
        //     target: 'customer_full_name',
        //     sourceEntity: 'curated_account',
        //     transformation: 'concatenation',
        //     sourceFields: ['first_name', 'last_name'],
        //     joinCondition: 'curated_account.id = consumption_billing.account_id'
        //   }
        // ]
      };

      // Prepare GitHub config if available
      const githubConfig = githubConnection
        ? {
            repositoryUrl: githubConnection.repositoryUrl,
            branch: githubConnection.branch,
            username: githubConnection.username,
            password: githubConnection.password,
          }
        : null;

      // Call the backend to generate artifacts for consumption entities
      const response = await axios.post("/api/consumption-artifacts/generate", {
        entityName: entityData.label,
        consumptionEntityName: entityData.label,
        transformations: transformations,
        pushToGitHub: !!githubConfig,
        githubConfig: githubConfig,
        folderPath: "consumption",
      });

      if (response.data.success) {
        const backendArtifacts = response.data.data.artifacts;
        setGeneratedArtifacts({
          sql: backendArtifacts?.sql || "",
          pyspark: backendArtifacts?.pyspark || "",
          dmlSql: backendArtifacts?.dmlSql || "",
          dmlPySpark: backendArtifacts?.dmlPySpark || "",
        });

        // Check if artifacts were pushed to GitHub
        if (backendArtifacts?.githubPush?.success) {
          const githubPush = backendArtifacts.githubPush;
          const successMessage = `✅ Artifacts generated and pushed to GitHub successfully!

📝 Commit Details:
• Repository: ${githubConnection?.repositoryUrl}
• Branch: ${githubConnection?.branch}
• Entity: ${entityData.label}
• Commit SHA: ${githubPush.commit_sha || "N/A"}

🔗 Commit URL: ${githubPush.commit_url || "N/A"}

Click "OK" to open the commit in a new tab and view all changes.`;

          if (confirm(successMessage)) {
            if (githubPush.commit_url) {
              window.open(githubPush.commit_url, "_blank");
            }
          }
        } else if (backendArtifacts?.githubPush?.error) {
          alert(
            `⚠️ Artifacts generated but failed to push to GitHub: ${backendArtifacts.githubPush.error}`
          );
        } else {
          alert("✅ Artifacts generated successfully!");
        }

        // Refresh stored artifacts
        fetchStoredArtifacts();
      } else {
        alert("Failed to generate artifacts: " + response.data.message);
      }
    } catch (error) {
      console.error("Error generating artifacts:", error);
      alert("Failed to generate artifacts. Please try again.");
    } finally {
      setIsGeneratingArtifacts(false);
      setIsPushingArtifacts(false);
    }
  };

  // Generate diffs for GitHub integration
  const generateDiffs = async () => {
    if (!githubConnection) {
      alert("Please configure GitHub connection in settings first.");
      return;
    }

    setIsGeneratingDiffs(true);
    setIsPushingToGitHub(true);
    setDiffProgress({
      current: 0,
      total: 1,
      percentage: 0,
      currentEntity: "Preparing...",
    });

    try {
      // Create entity data for diff generation with M:1 mapping support
      const entityDataForDiff = {
        entityName: entityData.label,
        transformations: {
          entityName: entityData.label,
          consumptionEntityName: entityData.label,
          attributes: entityData.attributes || [],
          sourceEntities: [entityData.label], // Default to self, can be extended for M:1 mappings
          mappings:
            entityData.attributes?.map((attr) => ({
              source: attr.name,
              target: attr.name,
              sourceEntity: entityData.label,
              transformation: "direct_mapping",
              joinCondition: null,
              isPrimaryKey: attr.name.toLowerCase().includes("id"),
              caseConditions: [],
              aggregationFunction: null,
              sourceFields: [],
              calculationExpression: null,
              defaultValue: null,
            })) || [],
          dataTypes:
            entityData.attributes?.reduce((acc, attr) => {
              acc[attr.name] = attr.type || "VARCHAR(255)";
              return acc;
            }, {}) || {},
          constraints: {},
          businessRules: [],
          dataQualityRules: [],
          transformationLogic: {},
          filterConditions: [],
        },
      };

      // Call the backend to generate diffs for consumption entities
      const response = await axios.post(
        "/api/consumption-artifacts/generate-diffs",
        {
          entity: entityDataForDiff,
          githubConfig: {
            repositoryUrl: githubConnection.repositoryUrl,
            branch: githubConnection.branch,
            username: githubConnection.username,
            password: githubConnection.password,
          },
          folderPath: "consumption",
          pushToGitHub: true, // Enable GitHub push for diffs
        }
      );

      if (response.data.success) {
        const { diffs } = response.data.data;
        setGeneratedDiffs(diffs);
        setShowDiffsModal(true);

        // Check if diffs were pushed to GitHub
        const firstEntityName = Object.keys(diffs)[0];
        if (firstEntityName && diffs[firstEntityName]?.githubPush?.success) {
          const githubPush = diffs[firstEntityName].githubPush;
          const successMessage = `✅ Diffs generated and pushed to GitHub successfully!

📝 Commit Details:
• Repository: ${githubConnection?.repositoryUrl}
• Branch: ${githubConnection?.branch}
• Entity: ${entityData.label}
• Commit SHA: ${githubPush.commit_sha || "N/A"}

🔗 Commit URL: ${githubPush.commit_url || "N/A"}

Click "OK" to open the commit in a new tab and view all changes.`;

          if (confirm(successMessage)) {
            if (githubPush.commit_url) {
              window.open(githubPush.commit_url, "_blank");
            }
          }
        } else if (
          firstEntityName &&
          diffs[firstEntityName]?.githubPush?.error
        ) {
          alert(
            `⚠️ Diffs generated but failed to push to GitHub: ${diffs[firstEntityName].githubPush.error}`
          );
        } else {
          alert("✅ Diffs generated successfully!");
        }
      } else {
        alert("Failed to generate diffs: " + response.data.message);
      }
    } catch (error) {
      console.error("Error generating diffs:", error);
      alert("Failed to generate diffs. Please try again.");
    } finally {
      setIsGeneratingDiffs(false);
      setIsPushingToGitHub(false);
    }
  };

  // Fetch stored artifacts for consumption entities
  const fetchStoredArtifacts = async () => {
    if (!entityData) return;

    setLoadingStoredArtifacts(true);
    try {
      const response = await axios.get(
        `/api/consumption-artifacts/stored?entityName=${entityData.label}`
      );
      if (response.data.success) {
        setStoredArtifacts(response.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching stored artifacts:", error);
      setStoredArtifacts([]);
    } finally {
      setLoadingStoredArtifacts(false);
    }
  };

  // Load stored artifacts when component mounts or entity changes
  useEffect(() => {
    if (show && entityData) {
      fetchStoredArtifacts();
    }
  }, [show, entityData]);

  // Copy code to clipboard
  const copyToClipboard = (content, type) => {
    navigator.clipboard.writeText(content);
    alert(`${type} code copied to clipboard!`);
  };

  return (
    <>
      <Modal size="xl" show={show} onHide={onHide} centered scrollable>
        <Modal.Header closeButton>
          <div className="d-flex justify-content-between align-items-center w-100">
            <Modal.Title>
              Generate Consumption Artifacts for {entityData?.label}
            </Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body>
          {/* Generate Artifacts Button */}
          <div className="mb-4 p-3 border rounded bg-light">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h6 className="mb-1">🚀 Consumption Artifact Generation</h6>
                <small className="text-muted">
                  Generate SQL, PySpark, DDL, and DML artifacts for consumption
                  entity {entityData?.label}
                </small>
                <small className="text-muted d-block mt-1">
                  Supports M:1 mappings between curated and consumption entities
                  with JOINs, aggregations, and transformations
                </small>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={generateArtifacts}
                disabled={isGeneratingArtifacts}
              >
                {isGeneratingArtifacts ? (
                  <>
                    <div
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                    >
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    {isPushingArtifacts
                      ? "Generating & Pushing..."
                      : "Generating..."}
                  </>
                ) : (
                  "Generate Artifacts"
                )}
              </Button>
            </div>
          </div>

          {/* GitHub Integration Section */}
          {githubConnection && (
            <div className="mb-4 p-3 border rounded bg-light">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="mb-1">
                    <BiGitBranch /> GitHub Integration
                  </h6>
                  <small className="text-muted">
                    Generate and review diffs for consumption entity{" "}
                    {entityData?.label}
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
                    onClick={generateDiffs}
                    disabled={isGeneratingDiffs}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {isGeneratingDiffs ? (
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
                        <BiGitBranch /> Generate Diffs
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Progress Bar */}
              {isGeneratingDiffs && (
                <div className="mt-3">
                  <div className="d-flex justify-content-between mb-1">
                    <small>{diffProgress.currentEntity}</small>
                    <small>{diffProgress.percentage}%</small>
                  </div>
                  <div className="progress" style={{ height: "8px" }}>
                    <div
                      className="progress-bar"
                      role="progressbar"
                      style={{ width: `${diffProgress.percentage}%` }}
                      aria-valuenow={diffProgress.percentage}
                      aria-valuemin="0"
                      aria-valuemax="100"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generated Artifacts Display */}
          {generatedArtifacts && (
            <>
              <p className="text-muted mb-3">
                Generated SQL and PySpark code for consumption entity{" "}
                {entityData?.label}. Artifacts are displayed in collapsible
                sections below.
              </p>

              <Accordion defaultActiveKey="0">
                {/* DDL Folder */}
                <Accordion.Item eventKey="ddl">
                  <Accordion.Header>
                    🏗️ DDL (Data Definition Language)
                    <Badge bg="primary" className="ms-2">
                      1 Entity
                    </Badge>
                  </Accordion.Header>
                  <Accordion.Body>
                    <small className="text-muted mb-3 d-block">
                      Schema definitions, table structures, and transformation
                      logic
                    </small>

                    <div className="mb-4 p-3 border rounded">
                      <h6 className="text-primary mb-3">
                        📁 {entityData?.label}
                      </h6>

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
                          {generatedArtifacts.sql}
                        </pre>
                        <div className="d-flex justify-content-end">
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() =>
                              copyToClipboard(generatedArtifacts.sql, "SQL")
                            }
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
                          {generatedArtifacts.pyspark}
                        </pre>
                        <div className="d-flex justify-content-end">
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() =>
                              copyToClipboard(
                                generatedArtifacts.pyspark,
                                "PySpark"
                              )
                            }
                          >
                            <BiCopyAlt />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Accordion.Body>
                </Accordion.Item>

                {/* DML Folder */}
                <Accordion.Item eventKey="dml">
                  <Accordion.Header>
                    📝 DML (Data Manipulation Language)
                    <Badge bg="warning" className="ms-2">
                      1 Entity
                    </Badge>
                  </Accordion.Header>
                  <Accordion.Body>
                    <small className="text-muted mb-3 d-block">
                      Data insertion, updates, and deletion operations. DML
                      artifacts are generated when pushing to GitHub.
                    </small>

                    <div className="mb-4 p-3 border rounded">
                      <h6 className="text-warning mb-3">
                        📁 {entityData?.label}
                      </h6>

                      {/* DML SQL Code */}
                      <div className="mb-3">
                        <h6>🔗 DML SQL Code</h6>
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
                          {generatedArtifacts.dmlSql}
                        </pre>
                        <div className="d-flex justify-content-end">
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() =>
                              copyToClipboard(
                                generatedArtifacts.dmlSql,
                                "DML SQL"
                              )
                            }
                          >
                            <BiCopyAlt />
                          </Button>
                        </div>
                      </div>

                      {/* DML PySpark Code */}
                      <div className="mb-3">
                        <h6>🐍 DML PySpark Code</h6>
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
                          {generatedArtifacts.dmlPySpark}
                        </pre>
                        <div className="d-flex justify-content-end">
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() =>
                              copyToClipboard(
                                generatedArtifacts.dmlPySpark,
                                "DML PySpark"
                              )
                            }
                          >
                            <BiCopyAlt />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Accordion.Body>
                </Accordion.Item>
              </Accordion>
            </>
          )}

          {/* Stored Artifacts Section */}
          <div className="mt-4">
            <h6 className="mb-3">
              <BiFolder /> Stored Consumption Artifacts
              {loadingStoredArtifacts && (
                <Spinner animation="border" size="sm" className="ms-2" />
              )}
            </h6>

            {storedArtifacts.length > 0 ? (
              <div className="stored-artifacts-list">
                {storedArtifacts.map((artifact, index) => (
                  <div key={index} className="mb-3 p-3 border rounded bg-light">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <h6 className="mb-1 text-success">
                          <BiFile /> {artifact.name || `Artifact ${index + 1}`}
                        </h6>
                        <small className="text-muted">
                          Created:{" "}
                          {new Date(artifact.createdAt).toLocaleDateString()}
                        </small>
                      </div>
                      <div className="d-flex gap-2">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => setGeneratedArtifacts(artifact)}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => copyToClipboard(artifact.sql, "SQL")}
                        >
                          Copy SQL
                        </Button>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(artifact.pyspark, "PySpark")
                          }
                        >
                          Copy PySpark
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Alert variant="info">
                No stored consumption artifacts found. Generate artifacts to see
                them here.
              </Alert>
            )}
          </div>
        </Modal.Body>
      </Modal>

      {/* Diffs Modal */}
      <Modal
        size="xl"
        show={showDiffsModal}
        onHide={() => setShowDiffsModal(false)}
        centered
        scrollable
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Generated Diffs for Consumption Entity {entityData?.label}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {generatedDiffs && Object.keys(generatedDiffs).length > 0 ? (
            <div>
              <p className="text-muted mb-3">
                Review the generated diffs for consumption entity before pushing
                to GitHub.
              </p>

              {Object.entries(generatedDiffs).map(([entityName, diffData]) => (
                <div key={entityName} className="mb-4 p-3 border rounded">
                  <h6 className="text-primary mb-3">📁 {entityName}</h6>

                  {diffData.diff && diffData.diff.summary && (
                    <div className="mb-3">
                      <h6>Diff Summary</h6>
                      <div className="d-flex gap-3">
                        <Badge bg="success">
                          New: {diffData.diff.summary.new}
                        </Badge>
                        <Badge bg="warning">
                          Modified: {diffData.diff.summary.modified}
                        </Badge>
                        <Badge bg="info">
                          Unchanged: {diffData.diff.summary.unchanged}
                        </Badge>
                        <Badge bg="danger">
                          Deleted: {diffData.diff.summary.deleted}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {diffData.diff && diffData.diff.diff && (
                    <div className="mb-3">
                      <h6>Git Diff</h6>
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
                        {diffData.diff.diff}
                      </pre>
                    </div>
                  )}

                  {diffData.artifacts && (
                    <div className="mb-3">
                      <h6>Generated Artifacts</h6>
                      <div className="d-flex gap-2">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(diffData.artifacts.sql, "SQL")
                          }
                        >
                          Copy SQL
                        </Button>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(
                              diffData.artifacts.pyspark,
                              "PySpark"
                            )
                          }
                        >
                          Copy PySpark
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Alert variant="info">
              No diffs generated. Please try generating diffs again.
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDiffsModal(false)}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              // Check if diffs were already pushed to GitHub
              const firstEntityName = Object.keys(generatedDiffs || {})[0];
              if (
                firstEntityName &&
                generatedDiffs[firstEntityName]?.githubPush?.success
              ) {
                const githubPush = generatedDiffs[firstEntityName].githubPush;
                if (githubPush.commit_url) {
                  window.open(githubPush.commit_url, "_blank");
                } else {
                  alert("✅ Diffs already pushed to GitHub successfully!");
                }
              } else {
                alert(
                  "Diffs are automatically pushed to GitHub when generated. If you need to re-push, please regenerate the diffs."
                );
              }
            }}
            disabled={isPushingToGitHub}
          >
            {(() => {
              const firstEntityName = Object.keys(generatedDiffs || {})[0];
              if (
                firstEntityName &&
                generatedDiffs[firstEntityName]?.githubPush?.success
              ) {
                return "✅ View on GitHub";
              }
              if (isPushingToGitHub) {
                return "🔄 Pushing...";
              }
              return "Push to GitHub";
            })()}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default CanvasArtifactsGenerator;
