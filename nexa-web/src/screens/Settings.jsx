import {
  Tab,
  Nav,
  Form,
  Row,
  Col,
  Button,
  Card,
  Badge,
  Alert,
} from "react-bootstrap";
import {
  BiLogoGithub,
  BiShapePolygon,
  BiInfinite,
  BiError,
  BiInfoCircle,
} from "react-icons/bi";
import { useState, useEffect } from "react";
import axios from "axios";

function Settings() {
  const [githubConfig, setGithubConfig] = useState({
    repositoryUrl: "",
    branch: "main",
    username: "",
    password: "",
  });

  const [savedConnection, setSavedConnection] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [loading, setLoading] = useState({
    test: false,
    save: false,
    fetch: false,
    reset: false,
  });

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  // Fetch saved connection on component mount
  useEffect(() => {
    fetchSavedConnection();
  }, []);

  const fetchSavedConnection = async () => {
    setLoading((prev) => ({ ...prev, fetch: true }));
    try {
      const response = await axios.get("/api/github/active");
      if (response.data.success && response.data.data) {
        setSavedConnection(response.data.data);
        setShowForm(false);
      } else {
        setShowForm(true);
      }
    } catch (error) {
      console.error("Failed to fetch saved connection:", error);
      setShowForm(true);
    } finally {
      setLoading((prev) => ({ ...prev, fetch: false }));
    }
  };

  const handleInputChange = (field, value) => {
    setGithubConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear any previous messages when user starts typing
    if (message.text) {
      setMessage({ type: "", text: "" });
    }
  };

  const testConnection = async () => {
    if (
      !githubConfig.repositoryUrl ||
      !githubConfig.branch ||
      !githubConfig.username
    ) {
      setMessage({
        type: "error",
        text: "Please fill in all required fields (Repository URL, Branch, and Username/Token)",
      });
      return;
    }

    setLoading((prev) => ({ ...prev, test: true }));
    setMessage({ type: "", text: "" });

    try {
      const response = await axios.post("/api/github/test", githubConfig);

      if (response.data.success) {
        setMessage({
          type: "success",
          text: `Connection successful! Repository: ${response.data.data.repository}, Branch: ${response.data.data.branch}`,
        });
      } else {
        setMessage({
          type: "error",
          text: response.data.message || "Connection test failed",
        });
      }
    } catch (error) {
      console.error("GitHub connection test error:", error);
      setMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Failed to test connection. Please try again.",
      });
    } finally {
      setLoading((prev) => ({ ...prev, test: false }));
    }
  };

  const testWritePermissions = async () => {
    if (
      !githubConfig.repositoryUrl ||
      !githubConfig.branch ||
      !githubConfig.username
    ) {
      setMessage({
        type: "error",
        text: "Please fill in all required fields (Repository URL, Branch, and Username/Token)",
      });
      return;
    }

    setLoading((prev) => ({ ...prev, test: true }));
    setMessage({ type: "", text: "" });

    try {
      const response = await axios.post("/api/github/test-write", githubConfig);

      if (response.data.success) {
        setMessage({
          type: "success",
          text: `Write permissions verified! You can push artifacts to ${response.data.data.repository} on branch ${response.data.data.branch}`,
        });
      } else {
        setMessage({
          type: "error",
          text: response.data.message || "Write permission test failed",
        });
      }
    } catch (error) {
      console.error("GitHub write permission test error:", error);
      setMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Failed to test write permissions. Please try again.",
      });
    } finally {
      setLoading((prev) => ({ ...prev, test: false }));
    }
  };

  const saveConnection = async () => {
    if (
      !githubConfig.repositoryUrl ||
      !githubConfig.branch ||
      !githubConfig.username
    ) {
      setMessage({
        type: "error",
        text: "Please fill in all required fields (Repository URL, Branch, and Username/Token)",
      });
      return;
    }

    setLoading((prev) => ({ ...prev, save: true }));
    setMessage({ type: "", text: "" });

    try {
      let response;

      if (savedConnection) {
        // Update existing connection
        response = await axios.put("/api/github/update", {
          ...githubConfig,
          connectionId: savedConnection.id,
        });
      } else {
        // Create new connection
        response = await axios.post("/api/github/save", githubConfig);
      }

      if (response.data.success) {
        setMessage({
          type: "success",
          text: savedConnection
            ? "GitHub connection updated successfully!"
            : "GitHub connection saved successfully!",
        });
        // Fetch the updated connection
        await fetchSavedConnection();
        // Clear form if it was a new connection
        if (!savedConnection) {
          setGithubConfig({
            repositoryUrl: "",
            branch: "main",
            username: "",
            password: "",
          });
        }
      } else {
        setMessage({
          type: "error",
          text: response.data.message || "Failed to save connection",
        });
      }
    } catch (error) {
      console.error("GitHub connection save error:", error);
      setMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Failed to save connection. Please try again.",
      });
    } finally {
      setLoading((prev) => ({ ...prev, save: false }));
    }
  };

  const resetConnection = async () => {
    if (
      !window.confirm(
        "Are you sure you want to reset the GitHub connection? This action cannot be undone."
      )
    ) {
      return;
    }

    setLoading((prev) => ({ ...prev, reset: true }));
    setMessage({ type: "", text: "" });

    try {
      const response = await axios.delete("/api/github/reset");

      if (response.data.success) {
        setMessage({
          type: "success",
          text: "GitHub connection reset successfully!",
        });
        setSavedConnection(null);
        setShowForm(true);
        // Clear form
        setGithubConfig({
          repositoryUrl: "",
          branch: "main",
          username: "",
          password: "",
        });
      } else {
        setMessage({
          type: "error",
          text: response.data.message || "Failed to reset connection",
        });
      }
    } catch (error) {
      console.error("GitHub connection reset error:", error);
      setMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Failed to reset connection. Please try again.",
      });
    } finally {
      setLoading((prev) => ({ ...prev, reset: false }));
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const renderSavedConnection = () => {
    if (!savedConnection) return null;

    return (
      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <BiLogoGithub className="me-2" />
            Active GitHub Connection
          </h5>
          <Badge bg="success">Connected</Badge>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <p>
                <strong>Repository:</strong> {savedConnection.repositoryOwner}/
                {savedConnection.repositoryName}
              </p>
              <p>
                <strong>Branch:</strong> {savedConnection.branch}
              </p>
              <p>
                <strong>Authentication:</strong>{" "}
                {savedConnection.authMethod === "token"
                  ? "Personal Access Token"
                  : "Username/Password"}
              </p>
            </Col>
            <Col md={6}>
              <p>
                <strong>Last Tested:</strong>{" "}
                {savedConnection.lastTestedAt
                  ? formatDate(savedConnection.lastTestedAt)
                  : "Never"}
              </p>
              <p>
                <strong>Test Count:</strong> {savedConnection.testCount}
              </p>
              <p>
                <strong>Success Rate:</strong>{" "}
                {savedConnection.testCount > 0
                  ? Math.round(
                      (savedConnection.successCount /
                        savedConnection.testCount) *
                        100
                    )
                  : 0}
                %
              </p>
            </Col>
          </Row>
          {savedConnection.lastTestResult && (
            <div className="mt-3">
              <p>
                <strong>Last Test Result:</strong>
              </p>
              <ul className="list-unstyled">
                <li>
                  • Repository: {savedConnection.lastTestResult.repository}
                </li>
                <li>
                  • Default Branch:{" "}
                  {savedConnection.lastTestResult.defaultBranch}
                </li>
                <li>
                  • Private:{" "}
                  {savedConnection.lastTestResult.private ? "Yes" : "No"}
                </li>
                <li>
                  • Last Commit: {savedConnection.lastTestResult.lastCommit}
                </li>
              </ul>
            </div>
          )}
          <div className="mt-3">
            <Button
              variant="outline-danger"
              size="sm"
              onClick={resetConnection}
              disabled={loading.reset}
            >
              {loading.reset ? "Resetting..." : "Reset Connection"}
            </Button>
            <Button
              variant="outline-primary"
              size="sm"
              className="ms-2"
              onClick={() => {
                // Populate form with existing connection details
                setGithubConfig({
                  repositoryUrl: savedConnection.repositoryUrl,
                  branch: savedConnection.branch,
                  username: savedConnection.username,
                  password: savedConnection.password || "", // Password is already decrypted by the service
                });
                setShowForm(true);
              }}
            >
              Edit Connection
            </Button>
          </div>

          <div className="mt-3">
            <Alert variant="info">
              <div className="alert-icon">
                <BiInfoCircle size={24} />
              </div>
              <div className="alert-text">
                <strong>Artifact Generation:</strong> With a GitHub connection
                configured, you can automatically push generated data
                engineering artifacts (SQL, PySpark, Dockerfiles, CI/CD
                pipelines, etc.) directly to your repository when using the
                "Generate Artefacts" button in the entity mapping pages.
                <br />
                <br />
                <strong>Diff Preview:</strong> Before pushing, you can preview
                what changes will be made to your repository, including new
                files, modifications, and deletions.
              </div>
            </Alert>
          </div>

          <div className="mt-3">
            <Alert variant="warning">
              <div className="alert-icon">
                <BiError size={24} />
              </div>
              <div className="alert-text">
                <strong>Troubleshooting GitHub Issues:</strong>
                <br />• <strong>403 Error:</strong> Use "Test Write Permissions"
                to verify your token has push access
                <br />• <strong>Private Repositories:</strong> Ensure your token
                has access to private repos
                <br />• <strong>Branch Protection:</strong> Check if the branch
                has protection rules
                <br />• <strong>Token Scopes:</strong> Your token needs{" "}
                <code>repo</code> scope for private repos or{" "}
                <code>public_repo</code> for public repos
                <br />• <strong>Git Operations:</strong> The test now verifies
                actual Git tree creation permissions
              </div>
            </Alert>
          </div>
        </Card.Body>
      </Card>
    );
  };

  const renderConnectionForm = () => {
    if (!showForm && savedConnection) return null;

    return (
      <Card>
        <Card.Header className="py-3 px-4">
          <h3 className="mb-0 fs-6">
            {savedConnection
              ? "Edit GitHub Connection"
              : "New GitHub Connection"}
          </h3>
          {savedConnection && (
            <small className="text-muted">
              Editing existing connection for {savedConnection.repositoryOwner}/
              {savedConnection.repositoryName}
            </small>
          )}
        </Card.Header>
        <Card.Body className="p-4">
          {message.text && (
            <Alert variant={message.type === "success" ? "success" : "danger"}>
              {message.text}
            </Alert>
          )}

          <Form.Group className="mb-3">
            <Form.Label>Repository URL *</Form.Label>
            <Form.Control
              type="text"
              placeholder="https://github.com/owner/repository.git"
              value={githubConfig.repositoryUrl}
              onChange={(e) =>
                handleInputChange("repositoryUrl", e.target.value)
              }
            />
            <Form.Text className="text-muted">
              Enter the full GitHub repository URL (HTTPS or SSH format)
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Repository Branch *</Form.Label>
            <Form.Control
              type="text"
              placeholder="main"
              value={githubConfig.branch}
              onChange={(e) => handleInputChange("branch", e.target.value)}
            />
            <Form.Text className="text-muted">
              Enter the branch name (e.g., main, develop, feature-branch)
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>
              Security Credentials *{" "}
              <small>(Username/GitHub Personal Token)</small>
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="username or personal access token"
              value={githubConfig.username}
              onChange={(e) => handleInputChange("username", e.target.value)}
            />
            <Form.Text className="text-muted">
              Use your GitHub username or personal access token for
              authentication
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-5">
            <Form.Label>Security Credentials Password</Form.Label>
            <Form.Control
              type="password"
              placeholder={
                savedConnection
                  ? "Enter new password/token or leave unchanged"
                  : "password (leave empty if using token)"
              }
              value={githubConfig.password}
              onChange={(e) => handleInputChange("password", e.target.value)}
            />
            <Form.Text className="text-muted">
              {savedConnection
                ? "Leave empty to keep the existing password/token unchanged. Enter a new value only if you want to update it."
                : "Only required if using username/password authentication. Leave empty if using personal access token."}
            </Form.Text>
          </Form.Group>

          <div className="d-flex gap-2">
            <Button
              variant="outline-secondary"
              onClick={testConnection}
              disabled={loading.test || loading.save}
            >
              {loading.test ? "Testing..." : "Test Connection"}
            </Button>
            <Button
              variant="outline-info"
              onClick={testWritePermissions}
              disabled={loading.test || loading.save}
              title="Test if you have write permissions to push artifacts"
            >
              Test Write Permissions
            </Button>
            <Button
              variant="primary"
              onClick={saveConnection}
              disabled={loading.test || loading.save}
            >
              {loading.save
                ? savedConnection
                  ? "Updating..."
                  : "Saving..."
                : savedConnection
                ? "Update Connection"
                : "Save Connection"}
            </Button>
            {savedConnection && (
              <Button
                variant="outline-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            )}
          </div>
        </Card.Body>
      </Card>
    );
  };

  return (
    <>
      <h1 className="h3 fw-medium">Settings</h1>

      <Tab.Container id="left-tabs-example" defaultActiveKey="github">
        <div className="d-flex setting-tabs">
          <Nav variant="pills" className="flex-column">
            <Nav.Item>
              <Nav.Link eventKey="github">
                <span className="icon">
                  <BiLogoGithub size={24} />
                </span>
                <span className="text">GitHub</span>
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="kafka">
                <span className="icon">
                  <BiShapePolygon size={24} />
                </span>
                <span className="text">kafka</span>
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="rds">
                <span className="icon">
                  {" "}
                  <BiInfinite size={24} />
                </span>
                <span className="text">RDS</span>
              </Nav.Link>
            </Nav.Item>
          </Nav>

          <Tab.Content>
            <Tab.Pane eventKey="github">
              <Row>
                <Col md={8}>
                  {loading.fetch ? (
                    <div className="text-center py-4">
                      <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      <p className="mt-2">Loading connection status...</p>
                    </div>
                  ) : (
                    <>
                      {renderSavedConnection()}
                      {renderConnectionForm()}
                    </>
                  )}
                </Col>
              </Row>
            </Tab.Pane>
            <Tab.Pane eventKey="kafka">
              <h4>Kafka</h4>
            </Tab.Pane>
            <Tab.Pane eventKey="rds">
              <h4>RDS</h4>
            </Tab.Pane>
          </Tab.Content>
        </div>
      </Tab.Container>
    </>
  );
}

export default Settings;
