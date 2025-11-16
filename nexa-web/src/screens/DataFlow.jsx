import React, { useState, useEffect } from "react";
import { Button, Form, Row, Col, Card, Nav, Badge } from "react-bootstrap";
import {
  BiTrash,
  BiSearch,
  BiPlus,
  BiFilter,
  BiPencil,
  BiTargetLock,
  BiData,
  BiSolidData,
  BiChevronRight,
  BiSolidInfoCircle,
  BiSolidError,
  BiSolidPencil,
} from "react-icons/bi";
import TablesEntitiesModal from "../components/TablesEntitiesModal";
import AddSourceModal from "../components/AddSourceModal";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function DataFlow() {
  const navigate = useNavigate();
  const [sources, setSources] = useState([]);
  const [showTableEntityModal, setShowTableEntityModal] = useState(false);
  const [sourceTables, setSourceTables] = useState([]);
  const [source, setSource] = useState(null);

  const handleShowModal = (tables) => {
    setSourceTables(tables);
    setShowTableEntityModal(true);
  };
  const handleCloseModal = () => {
    setShowTableEntityModal(false);
    setSourceTables([]);
  };

  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const handleShowAddSourceModal = (source = null) => {
    setShowAddSourceModal(true);
    setSource(source);
  };
  const handleCloseAddSourceModal = () => {
    setShowAddSourceModal(false);
    setSource(null);
  };
  const [selectedSources, setSelectedSources] = useState([]);

  const getSources = async () => {
    const response = await axios.get(`/api/source-master/sources`);
    setSources(response?.data?.data);
  };

  useEffect(() => {
    getSources();
  }, [showAddSourceModal]);

  return (
    <>
      <header className="d-flex justify-content-between align-items-center mb-2">
        <h1 className="h4 fw-medium m-0">Data Flow</h1>
        <div className="d-flex justify-content-between gap-2">
          <Form.Group className="filters-search">
            <Button variant="light">
              <BiSearch />
            </Button>
            <Form.Control
              className="bg-transparent"
              aria-label="Search"
              placeholder="Search across all Dataflows..."
            />
          </Form.Group>
        </div>
      </header>

      <section className="position-relative">
        <Nav className="dataflow-nav nav-tabs justify-content-start border-0">
          <Nav.Item>
            <Nav.Link href="#newFlow" active>
              New Dataflows
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link href="#changedFlow">Changed Dataflows</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link href="#existingFlow">Existing Dataflows</Nav.Link>
          </Nav.Item>
        </Nav>
        {/* New Dataflows - Start */}
        <Card className="dataflow" id="newFlow">
          <Card.Header className="border-0 bg-transparent d-flex justify-content-between gap-4 px-4 pt-4">
            <div className="">
              <h3 className="fw-medium text-large mb-2 d-flex gap-3 align-items-center">
                <BiSolidData color="#2563EB" size={20} />
                New Dataflows
              </h3>
              <p className="text-muted m-0">
                Begin fresh mappings from new data sources to curated business
                entities
              </p>
            </div>
            {selectedSources.length == sources.length && sources.length > 0 ? (
              <Button
                size="sm"
                variant="primary px-3"
                onClick={() =>
                  navigate("/curated_landing_zone", {
                    state: { ingestion_type: "raw", selectedSources },
                  })
                }
              >
                Next <BiChevronRight size={20} />
              </Button>
            ) : null}
          </Card.Header>
          <Card.Body className="p-4 pb-0">
            <div className="dataflow-list d-grid">
              <div className="dataflow-list-head">
                <Row className="fw-semi-bold">
                  <Col style={{ width: "50px", flex: "0 0 auto" }}>
                    <Form.Check
                      type="checkbox"
                      label=""
                      id="checkSourceAll"
                      checked={
                        selectedSources.length == sources.length &&
                        sources.length > 0
                      }
                      onClick={() =>
                        setSelectedSources((prev) =>
                          prev.length == sources.length
                            ? []
                            : sources.map((source) => source?.source_master_id)
                        )
                      }
                    />
                  </Col>
                  <Col md={3}>Source Name</Col>
                  <Col md={6}>Description</Col>
                  <Col className="text-end pe-5">Actions</Col>
                </Row>
              </div>
              {sources.map((source) => (
                <div
                  key={source?.source_master_id}
                  className="dataflow-list-item"
                >
                  <Row className="align-items-center">
                    <Col style={{ width: "50px", flex: "0 0 auto" }}>
                      <Form.Check
                        checked={selectedSources.includes(
                          source?.source_master_id
                        )}
                        type="checkbox"
                        label=""
                        id="customerData"
                        onClick={() =>
                          setSelectedSources((prev) =>
                            prev.includes(source?.source_master_id)
                              ? prev.filter(
                                  (id) => id !== source?.source_master_id
                                )
                              : [...prev, source?.source_master_id]
                          )
                        }
                      />
                    </Col>
                    <Col md={3}>
                      <div className="d-flex gap-2 justify-content-between">
                        <span>
                          <BiSolidData
                            className="my-auto"
                            color="#2563EB"
                            fontSize={20}
                          />
                        </span>
                        <div
                          className="flex-fill cursor-pointer overflow-hidden"
                          onClick={() => handleShowModal(source?.tables)}
                        >
                          <h5 className="text-medium fw-medium m-0 text-truncate">
                            {source?.source_name}
                          </h5>
                          {/* <p className="text-muted text-small m-0">
                            1,200 records
                          </p> */}
                        </div>
                        <Button
                          variant="default btn-icon p-0"
                          size="sm"
                          onClick={() => {
                            handleShowAddSourceModal(source);
                          }}
                        >
                          <BiPencil size={18} />
                        </Button>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div
                        className="bg-light p-3 rounded"
                        style={{ minHeight: "70px" }}
                      >
                        {source?.description}
                      </div>
                    </Col>

                    <Col className="text-end">
                      <Button
                        size="sm"
                        variant="primary px-3"
                        onClick={() =>
                          navigate("/curated_landing_zone", {
                            state: {
                              ingestion_type: "raw",
                              selectedSources: [source?.source_master_id],
                            },
                          })
                        }
                      >
                        Next <BiChevronRight size={20} />
                      </Button>
                    </Col>
                  </Row>
                </div>
              ))}
            </div>
            <div className="pb-4 text-end">
              <Button
                variant="outline-primary"
                onClick={() => handleShowAddSourceModal(null)}
              >
                <BiPlus size={18} />
                Add Source
              </Button>
            </div>
          </Card.Body>
          <Card.Footer className="px-4 py-3 bg-transparent d-flex gap-1 text-muted text-small">
            <BiSolidInfoCircle color="#666666" size={16} />
            Clicking 'Next' will take you to the curated mapping flow builder.
            Any new schema changes will need review before publishing.
          </Card.Footer>
        </Card>
        {/* New Dataflows - End */}

        {/* Changed Dataflows - Start */}
        <Card className="dataflow mt-4" id="changedFlow">
          <Card.Header className="border-0 bg-transparent px-4 pt-4">
            <h3 className="fw-medium text-large mb-2 d-flex gap-3 align-items-center">
              <BiSolidData color="#ED6C02" size={20} />
              Changed Dataflows
            </h3>
            <p className="text-muted m-0">
              Recently modified dataflows. Review and re-validate mapping.
            </p>
          </Card.Header>
          <Card.Body className="p-4 pb-0">
            <div className="dataflow-list d-grid">
              <div className="dataflow-list-head">
                <Row className="fw-semi-bold">
                  <Col md={3}>Source Name</Col>
                  <Col md={3}>Entity Name</Col>
                  <Col md={2}>Last Updated</Col>
                  <Col md={2}>Status</Col>
                  <Col className="text-end pe-4">Actions</Col>
                </Row>
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="dataflow-list-item">
                  <Row className="align-items-center">
                    <Col md={3}>
                      <div className="d-flex gap-2 justify-content-between">
                        <span>
                          <BiSolidData
                            className="my-auto"
                            color="#ED6C02"
                            fontSize={20}
                          />
                        </span>
                        <div className="flex-fill cursor-pointer overflow-hidden">
                          <h5 className="text-medium fw-medium m-0 text-truncate">
                            Sales Data Pipeline
                          </h5>
                          <p className="text-muted text-small m-0">
                            1,200 records
                          </p>
                        </div>
                      </div>
                    </Col>
                    <Col md={3} className="fw-medium">
                      Sales Data Pipeline
                    </Col>
                    <Col md={2} className="text-muted">
                      Jan 15, 2024 10:30
                    </Col>
                    <Col
                      md={2}
                      className="d-flex align-items-center justify-content-between"
                    >
                      <Badge bg="primary">Schema Change</Badge>
                      <Badge bg="danger" className="p-2">
                        <BiSolidError size={14} />
                      </Badge>
                    </Col>
                    <Col className="text-end">
                      <Button size="sm" variant="light px-3">
                        <BiSolidPencil size={14} /> Edit
                      </Button>
                    </Col>
                  </Row>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
        {/* Changed Dataflows - End */}

        {/* Existing Dataflows - Start */}
        <Card className="dataflow mt-4" id="existingFlow">
          <Card.Header className="border-0 bg-transparent px-4 pt-4">
            <h3 className="fw-medium text-large mb-2 d-flex gap-3 align-items-center">
              <BiSolidData color="#2E7D32" size={20} />
              Existing Dataflows
            </h3>
            <p className="text-muted m-0">Live and unchanged curated flows.</p>
          </Card.Header>
          <Card.Body className="p-4 pb-0">
            <div className="dataflow-list d-grid">
              <div className="dataflow-list-head">
                <Row className="fw-semi-bold">
                  <Col md={3}>Source Name</Col>
                  <Col md={5}>Last Updated</Col>
                  <Col md={2}>Status</Col>
                  <Col md={2} className="text-end pe-4">
                    Actions
                  </Col>
                </Row>
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="dataflow-list-item">
                  <Row className="align-items-center">
                    <Col md={3}>
                      <div className="d-flex gap-2 justify-content-between">
                        <span>
                          <BiSolidData
                            className="my-auto"
                            color="#2E7D32"
                            fontSize={20}
                          />
                        </span>
                        <div className="flex-fill cursor-pointer overflow-hidden">
                          <h5 className="text-medium fw-medium m-0 text-truncate">
                            Marketing Analytics
                          </h5>
                          <p className="text-muted text-small m-0">
                            1,200 records
                          </p>
                        </div>
                      </div>
                    </Col>
                    <Col md={5} className="text-muted">
                      Jan 15, 2024 10:30
                    </Col>
                    <Col md={2}>
                      <Badge bg="success">No Change</Badge>
                    </Col>
                    <Col md={2} className="text-end">
                      <Button size="sm" variant="light px-3">
                        <BiSolidPencil size={14} /> Edit
                      </Button>
                    </Col>
                  </Row>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
        {/* Existing Dataflows - End */}
      </section>
      <TablesEntitiesModal
        show={showTableEntityModal}
        handleClose={handleCloseModal}
        sourceTables={sourceTables}
      />
      <AddSourceModal
        show={showAddSourceModal}
        handleClose={handleCloseAddSourceModal}
        sourceDetails={source}
      />
    </>
  );
}

export default DataFlow;
