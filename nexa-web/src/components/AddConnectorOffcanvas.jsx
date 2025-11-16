import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Offcanvas,
  Form,
  Row,
  Col,
  Button,
  Collapse,
  OverlayTrigger,
  Tooltip,
  Card,
  Dropdown,
} from "react-bootstrap";
import {
  BiChevronDown,
  BiChevronUp,
  BiSolidData,
  BiGridAlt,
  BiSolidLockAlt,
  BiSearch,
} from "react-icons/bi";

const AddConnectorOffcanvas = ({ show, handleClose }) => {

  //const sourceOptions = ["Schema 1", "Schema 2", "Schema 3", "Schema 4", "Schema 5"];
  const cdcModeOptions = ["full", "incremental"];
  const syncTypeOptions = ["append", "full_refresh", "merge"];

  const syncModeOptions = ["continuous", "scheduled"];
  const computeTypeOptions = ["serverless", "cluster"];
  const statusOptions = ["Active", "Not Deployed", "Paused"];

  const [collapseOpen, setCollapseOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    source_dataset: [],
    targetSystem: "kafka",
    authConfig: {},
    cdc_mode: "",
    sync_type: "",
    watermark_column: "",
    primary_keys: [],
    primary_keys_text: "",
    sync_mode: "",
    schedule_cron: "",
    compute_type: "",
    cluster_config: "",
    status: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();
  const location = useLocation();
  const [isTesting, setIsTesting] = useState(false);

  const [sourceOptions, setSourceOptions] = useState([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    const fetchSources = async () => {
      setLoadingSources(true);
      setFetchError("");
      try {
        const res = await axios.post("/api/connectors/sources");
        if (res.data.success) {
          setSourceOptions(res.data.data || []);
        } else {
          setFetchError("Failed to load source tables");
        }
      } catch (err) {
        setFetchError("Error fetching source tables");
      } finally {
        setLoadingSources(false);
      }
    };

    fetchSources();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAuthConfigChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      authConfig: {
        ...formData.authConfig,
        [name]: value,
      },
    });
  };


  // Validate inputs
  const validate = () => {
    let newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Connector Name is required";
    }
    if (formData.source_dataset.length === 0) {
      newErrors.source_dataset = "Select at least one source table";
    }

    if (!formData.targetSystem) {
      newErrors.targetSystem = "Target System is required";
    }

    // Authentication Config validation based on target system
    console.log('targetSystem', formData.targetSystem)
    if (formData.targetSystem === "kafka") {
      const { bootstrapServers, securityProtocol, saslMechanism, topic, username, password, consumerGroupId, clientId } = formData.authConfig;

      if (!bootstrapServers || !bootstrapServers.trim()) {
        newErrors.bootstrapServers = "Bootstrap Servers is required";
      }
      if (!securityProtocol || !securityProtocol.trim()) {
        newErrors.securityProtocol = "Security Protocol is required";
      }
      if (!saslMechanism || !saslMechanism.trim()) {
        newErrors.saslMechanism = "Sasl Mechanism is required";
      }
      if (!topic || !topic.trim()) {
        newErrors.topic = "Topic is required";
      }
      if (!username || !username.trim()) {
        newErrors.username = "Username is required";
      }
      if (!password || !password.trim()) {
        newErrors.password = "Password is required";
      }
      if (!consumerGroupId || !consumerGroupId.trim()) {
        newErrors.consumerGroupId = "Consumer GroupId is required";
      }
      if (!clientId || !clientId.trim()) {
        newErrors.clientId = "Client Id is required";
      }

    } else if (formData.targetSystem === "aws_rds") {
      const { host, username, password } = formData.authConfig;

      if (!host || !host.trim()) {
        newErrors.host = "Host is required";
      }
      if (!username || !username.trim()) {
        newErrors.username = "Username is required";
      }
      if (!password || !password.trim()) {
        newErrors.password = "Password is required";
      }

    } else if (formData.targetSystem === "aws_s3") {
      const { awsAccessKeyId, awsSecretAccessKey, region, resource } = formData.authConfig;

      if (!awsAccessKeyId || !awsAccessKeyId.trim()) {
        newErrors.awsAccessKeyId = "AWS AccessKeyId is required";
      }
      if (!awsSecretAccessKey || !awsSecretAccessKey.trim()) {
        newErrors.awsSecretAccessKey = "AWS Secret AccessKey is required";
      }
      if (!region || !region.trim()) {
        newErrors.region = "Region is required";
      }
      if (!resource || !resource.trim()) {
        newErrors.resource = "Resource/Bucket Name is required";
      }
    }

    if (!formData.cdc_mode.trim()) {
      newErrors.cdc_mode = "CDC Mode is required";
    }

    if (!formData.sync_type.trim()) {
      newErrors.sync_type = "Sync Type is required";
    }


    if (formData.cdc_mode === "incremental" && !formData.watermark_column.trim()) {
      newErrors.watermark_column = "Watermark Column is required for incremental CDC mode";
    }

    if (formData.sync_type === "merge" && formData.primary_keys.length === 0) {
      newErrors.primary_keys = "Primary Keys are required for merge sync type";
    }

    if (!formData.sync_mode.trim()) {
      newErrors.sync_mode = "Sync Mode is required";
    }

    if (!formData.schedule_cron.trim()) {
      newErrors.schedule_cron = "Schedule Cron is required";
    }

    if (!formData.compute_type.trim()) {
      newErrors.compute_type = "Compute Type is required";
    }

    if (formData.compute_type === "cluster" && !formData.cluster_config.trim()) {
      newErrors.cluster_config = "Cluster Config is required for cluster compute type";
    }

    if (!formData.status.trim()) {
      newErrors.status = "Status is required";
    }



    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    setMessage("");


    try {
      console.log('connector formData', formData)
      const response = await axios.post("/api/connectors/add", formData);
      if (response.data.success === true) {
        setMessage("Connector added successfully!");
        setFormData({
          name: "",
          source_dataset: [],
          targetSystem: "kafka",
          authConfig: {},
          cdc_mode: "",
          sync_type: "",
          watermark_column: "",
          primary_keys: [],
          primary_keys_text: "",
          sync_mode: "",
          schedule_cron: "",
          compute_type: "",
          cluster_config: "",
          status: "",
        });
        //handleClose()
        //navigate(location.pathname, { replace: true });
        setTimeout(() => {
          window.location.reload();
        }, 2000)
        //navigate('/connectors')

      } else {
        setMessage(response.data.message);
      }
    } catch (error) {
      setMessage(error.response?.data?.error || "Error adding connector");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestRdsConnection = async () => {
    const { host, username, password } = formData.authConfig;

    if (!host || !username || !password) {
      alert("Please fill Host, Username, and Password first");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const res = await axios.post("/api/connectors/test-rds", {
        host,
        username,
        password,
      });

      if (res.data.success) {
        setMessage(res.data.message);
      } else {
        setMessage(res.data.message || "Connection failed");
      }
    } catch (error) {
      setMessage(error.response?.data?.message || "Error testing connection");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestS3Connection = async () => {
    const { awsAccessKeyId, awsSecretAccessKey, region, resource } = formData.authConfig;

    if (!awsAccessKeyId || !awsSecretAccessKey || !resource) {
      alert("Please fill Access Key, Secret Key, and Region first");
      return;
    }

    setIsTesting(true);
    setMessage("");

    try {
      const res = await axios.post("/api/connectors/test-s3", {
        awsAccessKeyId,
        awsSecretAccessKey,
        region,
        resource,
      });
      if (res.data.success) {
        setMessage(res.data.message);
      } else {
        setMessage(res.data.message || "Connection failed");
      }
    } catch (error) {
      setMessage(error.response?.data?.message || "Error testing connection");
    } finally {
      setIsTesting(false);
    }
  };


  const [searchTerm, setSearchTerm] = useState("");
  const filteredTables = sourceOptions.filter((table) =>
    table.toLowerCase().includes(searchTerm.toLowerCase())
  );


  return (
    <Offcanvas
      show={show}
      onHide={handleClose}
      placement="end"
      backdrop="static"
      className="size-lg"
    >
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Create New Connector</Offcanvas.Title>
      </Offcanvas.Header>

      <Offcanvas.Body>
        <h4 className="fw-semi-bold mb-4 text-large">Basic Information</h4>
        {message && <p>{message}</p>}
        <form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Connector Name</Form.Label>
            <Form.Control type="text" placeholder="Enter Connector Name" name="name" value={formData.name} onChange={handleChange} />
            {errors.name && <p className="error">{errors.name}</p>}
          </Form.Group>

          <Row>
            <Col md={12}>
              <Form.Group className="mb-3">
                <Form.Label>Select C360 Source Table(s)</Form.Label>
                <Dropdown
                  className={`w-100 multi-select ${formData.source_dataset.length > 0 ? "is-filled" : ""}`}
                >
                  <Dropdown.Toggle
                    className="w-100 justify-content-between"
                    variant="default"
                  >
                    <div className="text-truncate">
                      {formData.source_dataset.length > 0
                        ? formData.source_dataset.join(", ")
                        : "Select Source Tables"}
                    </div>
                    <BiChevronDown />
                  </Dropdown.Toggle>

                  <Dropdown.Menu className="p-3 w-100">
                    <Form.Group className="filters-search mb-2 w-100">
                      <Button variant="light"><BiSearch /></Button>
                      <Form.Control
                        type="text"
                        placeholder="Search Source Tables"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </Form.Group>

                    <div style={{ maxHeight: "150px", overflowY: "auto" }} className="px-2">
                      {filteredTables.map((table, index) => (
                        <Form.Check
                          key={index}
                          type="checkbox"
                          id={`table-${index}`}
                          label={table}
                          checked={formData.source_dataset.includes(table)}
                          onChange={() => {
                            const updatedSources = formData.source_dataset.includes(table)
                              ? formData.source_dataset.filter((t) => t !== table)
                              : [...formData.source_dataset, table];

                            setFormData({
                              ...formData,
                              source_dataset: updatedSources
                            });
                          }}
                          className="mb-1"
                        />
                      ))}
                    </div>
                  </Dropdown.Menu>
                </Dropdown>
                {errors.source_dataset && <p className="error">{errors.source_dataset}</p>}
              </Form.Group>
            </Col>
          </Row>

          <h4 className="fw-semi-bold mb-4 text-large">Select Target System</h4>
          <Row className="mb-4">
            <Col md={4}>
              <Form.Check className="form-check select-connector">
                <input
                  type="radio"
                  id="kafKa"
                  name="targetSystem"
                  className="form-check-input"
                  value="kafka"
                  checked={formData.targetSystem === "kafka"}
                  onChange={handleChange}
                />
                <Form.Label
                  for="kafKa"
                  className="rounded-3 d-flex flex-column gap-2 align-items-center p-3"
                >
                  <BiGridAlt size={40} />
                  <span>Kafka</span>
                </Form.Label>
              </Form.Check>
            </Col>
            <Col md={4}>
              <Form.Check className="form-check select-connector">
                <input
                  type="radio"
                  id="aws_rds"
                  name="targetSystem"
                  className="form-check-input"
                  value="aws_rds"
                  checked={formData.targetSystem === "aws_rds"}
                  onChange={handleChange}
                />
                <Form.Label
                  for="aws_rds"
                  className="rounded-3 d-flex flex-column gap-2 align-items-center p-3"
                >
                  <BiSolidData size={40} />
                  <span>AWS RDS</span>
                </Form.Label>
              </Form.Check>
            </Col>
            <Col md={4}>
              <Form.Check className="form-check select-connector">
                <input
                  type="radio"
                  id="aws_s3"
                  name="targetSystem"
                  className="form-check-input"
                  value="aws_s3"
                  checked={formData.targetSystem === "aws_s3"}
                  onChange={handleChange}
                />
                <Form.Label
                  for="aws_s3"
                  className="rounded-3 d-flex flex-column gap-2 align-items-center p-3"
                >
                  <BiGridAlt size={40} />
                  <span>AWS S3</span>
                </Form.Label>
              </Form.Check>
            </Col>
            {errors.targetSystem && <p className="error">{errors.targetSystem}</p>}
          </Row>

          <Card className="mb-4">
            <Card.Header className="bg-transparent border-0 p-3 d-flex align-items-center justify-content-between">
              <h5 className="text-large fw-medium mb-0 align-items-center gap-2 d-flex">
                <BiSolidLockAlt size={18} />
                Authentication Configuration
              </h5>

              <Button
                variant="default"
                className="p-0 h-auto"
                onClick={() => setCollapseOpen(!collapseOpen)}
              >
                {collapseOpen ? (
                  <BiChevronDown size={22} />
                ) : (
                  <BiChevronUp size={22} />
                )}
              </Button>
            </Card.Header>
            <Collapse in={!collapseOpen}>
              <div id="collapseConfiguration">
                <Card.Body className="px-5 py-4">
                  {/* Conditional Auth Fields */}
                  {formData.targetSystem === "kafka" && (
                    <>
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Bootstrap Servers</Form.Label>
                            <Form.Control type="text" name="bootstrapServers" placeholder="Enter Bootstrap Servers" onChange={handleAuthConfigChange} />
                            {errors.bootstrapServers && <p className="error">{errors.bootstrapServers}</p>}
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Security Protocol</Form.Label>
                            <Form.Control
                              type="text"
                              name="securityProtocol"
                              placeholder="Enter Security Protocol"
                              onChange={handleAuthConfigChange}
                            />
                            {errors.securityProtocol && <p className="error">{errors.securityProtocol}</p>}
                          </Form.Group>
                        </Col>
                      </Row>
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Sasl Mechanism</Form.Label>
                            <Form.Control type="text" name="saslMechanism" placeholder="Enter Sasl Mechanism" onChange={handleAuthConfigChange} />
                            {errors.saslMechanism && <p className="error">{errors.saslMechanism}</p>}
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Topic</Form.Label>
                            <Form.Control
                              type="text"
                              name="topic"
                              placeholder="Enter Topic"
                              onChange={handleAuthConfigChange}
                            />
                            {errors.topic && <p className="error">{errors.topic}</p>}
                          </Form.Group>
                        </Col>
                      </Row>
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Username</Form.Label>
                            <Form.Control type="text" name="username" placeholder="Enter Username" onChange={handleAuthConfigChange} />
                            {errors.username && <p className="error">{errors.username}</p>}
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Password</Form.Label>
                            <Form.Control
                              type="password"
                              name="password"
                              placeholder="Enter Password"
                              onChange={handleAuthConfigChange}
                            />
                            {errors.password && <p className="error">{errors.password}</p>}
                          </Form.Group>
                        </Col>
                      </Row>

                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Consumer GroupId</Form.Label>
                            <Form.Control type="text" name="consumerGroupId" placeholder="Enter Consumer GroupId" onChange={handleAuthConfigChange} />
                            {errors.consumerGroupId && <p className="error">{errors.consumerGroupId}</p>}
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Client Id</Form.Label>
                            <Form.Control
                              type="text"
                              name="clientId"
                              placeholder="Enter ClientId"
                              onChange={handleAuthConfigChange}
                            />
                            {errors.clientId && <p className="error">{errors.clientId}</p>}
                          </Form.Group>
                        </Col>
                      </Row>

                      <Form.Group className="text-end">
                        <Button variant="primary">Test Connection</Button>
                      </Form.Group>
                    </>
                  )}

                  {formData.targetSystem === "aws_rds" && (
                    <>
                      <Form.Group className="mb-3">
                        <Form.Label>AWS RDS End Point</Form.Label>
                        <Form.Control
                          type="text"
                          name="host"
                          placeholder="Enter AWS RDS End Point"
                          onChange={handleAuthConfigChange}
                        />
                        {errors.host && <p className="error">{errors.host}</p>}
                      </Form.Group>
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Username</Form.Label>
                            <Form.Control type="text" name="username" placeholder="Enter Username" onChange={handleAuthConfigChange} />
                            {errors.username && <p className="error">{errors.username}</p>}
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Password</Form.Label>
                            <Form.Control
                              type="password"
                              name="password"
                              placeholder="Enter Password"
                              onChange={handleAuthConfigChange}
                            />
                            {errors.password && <p className="error">{errors.password}</p>}
                          </Form.Group>
                        </Col>
                      </Row>
                      <Form.Group className="text-end">
                        <Button variant="primary" onClick={handleTestRdsConnection} disabled={isLoading}>Test Connection</Button>
                      </Form.Group>
                    </>
                  )}

                  {formData.targetSystem === "aws_s3" && (
                    <>
                      <Form.Group className="mb-3">
                        <Form.Label>AWS AccessKeyId</Form.Label>
                        <Form.Control
                          type="text"
                          name="awsAccessKeyId"
                          placeholder="Enter AWS AccessKeyId"
                          onChange={handleAuthConfigChange}
                        />
                        {errors.awsAccessKeyId && <p className="error">{errors.awsAccessKeyId}</p>}
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>AWS SecretAccessKey</Form.Label>
                        <Form.Control
                          type="text"
                          name="awsSecretAccessKey"
                          placeholder="Enter AWS SecretAccessKey"
                          onChange={handleAuthConfigChange}
                        />
                        {errors.awsSecretAccessKey && <p className="error">{errors.awsSecretAccessKey}</p>}
                      </Form.Group>
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Region</Form.Label>
                            <Form.Control type="text" name="region" placeholder="Enter Region" onChange={handleAuthConfigChange} />
                            {errors.region && <p className="error">{errors.region}</p>}
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Resource/Bucket Name</Form.Label>
                            <Form.Control
                              type="text"
                              name="resource"
                              placeholder="Enter Resource/Bucket Name"
                              onChange={handleAuthConfigChange}
                            />
                            {errors.resource && <p className="error">{errors.resource}</p>}
                          </Form.Group>
                        </Col>
                      </Row>
                      <Form.Group className="text-end">
                        <Button variant="primary" onClick={handleTestS3Connection} disabled={isTesting}>{isTesting ? "Testing..." : "Test Connection"}</Button>
                      </Form.Group>
                    </>
                  )}
                  {errors.authConfig && <p className="error">{errors.authConfig}</p>}
                </Card.Body>

              </div>
            </Collapse>
          </Card>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>CDC Mode</Form.Label>
                <Form.Select
                  name="cdc_mode"
                  value={formData.cdc_mode}
                  onChange={handleChange}
                >
                  <option value="">Select CDC Mode</option>
                  {cdcModeOptions.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </Form.Select>
                {errors.cdc_mode && <p className="error">{errors.cdc_mode}</p>}
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Sync Type</Form.Label>
                <Form.Select
                  name="sync_type"
                  value={formData.sync_type}
                  onChange={handleChange}
                >
                  <option value="">Select Sync Type</option>
                  {syncTypeOptions.map((sync, i) => (
                    <option key={i} value={sync}>{sync}</option>
                  ))}
                </Form.Select>
                {errors.sync_type && <p className="error">{errors.sync_type}</p>}
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-4">
            <Form.Label>Watermark Column</Form.Label>
            <Form.Control type="text" placeholder="Enter Watermark Column" name="watermark_column" value={formData.watermark_column} onChange={handleChange} />
            {errors.watermark_column && <p className="error">{errors.watermark_column}</p>}
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label>Primary Keys</Form.Label>
            <Form.Control
              as="textarea"
              placeholder="Enter Primary Keys (comma separated)"
              name="primary_keys"
              value={formData.primary_keys_text || ""} // use string for typing
              onChange={(e) => {
                const value = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  primary_keys_text: value, // keep what user is typing
                  primary_keys: value
                    .split(",") // split by comma
                    .map((k) => k.trim())
                    .filter(Boolean), // clean array
                }));
              }}
              onBlur={(e) => {
                // on blur, ensure final sync between text and array
                const keys = e.target.value
                  .split(",")
                  .map((k) => k.trim())
                  .filter(Boolean);
                setFormData((prev) => ({
                  ...prev,
                  primary_keys: keys,
                  primary_keys_text: keys.join(", "),
                }));
              }}
            />
            {errors.primary_keys && <p className="error">{errors.primary_keys}</p>}
          </Form.Group>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Sync Mode</Form.Label>
                <Form.Select
                  name="sync_mode"
                  value={formData.sync_mode}
                  onChange={handleChange}
                >
                  <option value="">Select Sync Mode</option>
                  {syncModeOptions.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </Form.Select>
                {errors.sync_mode && <p className="error">{errors.sync_mode}</p>}
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Compute Type</Form.Label>
                <Form.Select
                  name="compute_type"
                  value={formData.compute_type}
                  onChange={handleChange}
                >
                  <option value="">Select Compute Type</option>
                  {computeTypeOptions.map((compute, i) => (
                    <option key={i} value={compute}>{compute}</option>
                  ))}
                </Form.Select>
                {errors.compute_type && <p className="error">{errors.compute_type}</p>}
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-4">
            <Form.Label>Schedule Cron</Form.Label>
            <Form.Control type="text" placeholder="Enter Schedule Cron" name="schedule_cron" value={formData.schedule_cron} onChange={handleChange} />
            {errors.schedule_cron && <p className="error">{errors.schedule_cron}</p>}
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label>Cluster Config</Form.Label>
            <Form.Control
              as="textarea"
              placeholder="Enter Cluster Config"
              name="cluster_config"
              value={formData.cluster_config}
              onChange={handleChange}
            />
            {errors.cluster_config && <p className="error">{errors.cluster_config}</p>}
          </Form.Group>

          <Row>
            <Col md={12}>
              <Form.Group className="mb-4">
                <Form.Label>Status</Form.Label>
                <Form.Select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="">Select Status</option>
                  {statusOptions.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </Form.Select>
                {errors.status && <p className="error">{errors.status}</p>}
              </Form.Group>
            </Col>

          </Row>

          <Form.Group className="mt-5 d-flex gap-2 justify-content-end">
            <Button size="lg" variant="default" onClick={handleClose}>
              Cancel
            </Button>
            <Button size="lg" variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Create Connector"}

            </Button>
          </Form.Group>

        </form>
        {message && <p>{message}</p>}
      </Offcanvas.Body>
    </Offcanvas>
  );
};

export default AddConnectorOffcanvas;
