import React, { useState } from "react";
import {
  Button,
  Badge,
  OverlayTrigger,
  Tooltip,
  Form,
  Row,
  Col,
  Card,
} from "react-bootstrap";
import {
  BiTrash,
  BiSearch,
  BiPlus,
  BiFilter,
  BiPencil,
  BiTargetLock,
} from "react-icons/bi";
import AddAgentOffcanvas from "../components/AddAgentOffcanvas";
import axios from "axios";

const ToolsAssigned = ({ sources }) => {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? sources : sources.slice(0, 2);
  const hiddenCount = sources.length - 2;

  return (
    <>
      <div className="d-flex flex-wrap justify-content-center gap-1">
        {visibleItems.map((item, index) => (
          <Badge key={index} bg="primary" pill>
            {item}
          </Badge>
        ))}
      </div>

      {!expanded && hiddenCount > 0 && (
        <Badge
          bg="primary"
          className="mt-2"
          style={{ cursor: "pointer" }}
          pill
          onClick={() => setExpanded(true)}
        >
          +{hiddenCount} more
        </Badge>
      )}
    </>
  );
};

function Agents() {
  const [data] = useState([
    {
      id: 1,
      ref: 77641,
      name: "Finance Assistant",
      description:
        "Handles data processing and analysis tasks across structured financial datasets and unstructured financial documents.",
      toolsAssigned: ["DQ", "SQL Assist", "NLP", "Chat"],
      status: true,
    },
    {
      id: 2,
      ref: 77642,
      name: "Market Assistant",
      description:
        "Generates content and performs text analysis using structured campaign data and unstructured customer feedback and social media insights.",
      toolsAssigned: ["NLP", "Chat"],
      status: false,
    },
    {
      id: 3,
      ref: 77643,
      name: "Sales Assistant",
      description:
        "Performs data analytics and reporting using CRM records, transactional data, and sales call transcripts.",
      toolsAssigned: ["DQ", "SQL Assist", "NLP", "Chat"],
      status: true,
    },
    {
      id: 4,
      ref: 77644,
      name: "Nexa One",
      description:
        "Full access to all modules, enabling end-to-end analysis across structured data warehouses and unstructured sources.",
      toolsAssigned: ["NLP", "Chat"],
      status: true,
    },
    {
      id: 5,
      ref: 77645,
      name: "Research Agent",
      description:
        "Creates automated reports and summaries from structured research datasets and unstructured documents and notes.",
      toolsAssigned: ["SQL Assist", "Chart"],
      status: false,
    },
  ]);
  const [showAddAgent, setShowAddAgent] = useState(false);

  const handleShowSidebar = () => setShowAddAgent(true);
  const handleCloseSidebar = () => setShowAddAgent(false);

  return (
    <>
      <header className="d-flex justify-content-between align-items-center mb-2">
        <h1 className="h4 fw-medium m-0">Agents</h1>
        <div className="d-flex justify-content-between gap-2">
          <Form.Group className="filters-search">
            <Button variant="light">
              <BiSearch />
            </Button>
            <Form.Control
              className="bg-transparent"
              aria-label="Search"
              placeholder="Search Agents"
            />
          </Form.Group>
          <Button variant="outline-secondary" className="px-3">
            <BiFilter fontSize="24" /> Filter
          </Button>
          <Button
            variant="outline-secondary"
            onClick={handleShowSidebar}
            className="px-3"
          >
            <BiPlus size={20} /> Add
          </Button>
        </div>
      </header>
      <p>
        Agents automate analysis and data workflows across structured and
        unstructured sources
      </p>

      <Row>
        {data.map((item) => (
          <Col md={4} key={item.id} className="mb-4">
            <Card
              className="p-4 h-100 shadow-sm d-flex flex-column justify-content-between gap-5"
              border="0"
            >
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted">{`#${item.ref}`}</span>
                  <h4 className="text-primary text-large fw-medium m-0">
                    {item.name}
                  </h4>
                </div>
                <Badge pill bg={item.status ? "success" : "light"}>
                  {item.status ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="text-center">
                <ToolsAssigned sources={item.toolsAssigned} />

                <p className="text-muted mt-3">{item.description}</p>
              </div>

              <div className="d-flex gap-2 justify-content-between align-items-center">
                <Form.Check
                  type="switch"
                  checked={item.status ? "checked" : ""}
                  id={`app-switch${item.id}`}
                  label=""
                />

                <div className="d-flex">
                  <OverlayTrigger
                    placement="bottom"
                    overlay={<Tooltip>Edit</Tooltip>}
                  >
                    <Button variant="default btn-icon" size="sm">
                      <BiPencil />
                    </Button>
                  </OverlayTrigger>
                  <OverlayTrigger
                    placement="bottom"
                    overlay={<Tooltip>Trace Agent</Tooltip>}
                  >
                    <Button variant="default btn-icon" size="sm">
                      <BiTargetLock />
                    </Button>
                  </OverlayTrigger>
                  <OverlayTrigger
                    placement="bottom"
                    overlay={<Tooltip>Delete</Tooltip>}
                  >
                    <Button variant="default btn-icon" size="sm">
                      <BiTrash />
                    </Button>
                  </OverlayTrigger>
                </div>
              </div>
            </Card>
          </Col>
        ))}
        <Col md={4} className="mb-4">
          <Card
            onClick={handleShowSidebar}
            className="p-4 h-100 shadow-sm d-flex flex-column justify-content-center gap-2 align-items-center add-app cursor-pointer"
          >
            <span className="plus-icon">
              <BiPlus />
            </span>
            <span className="text-large fw-medium text-primary">
              Add New Agent
            </span>
          </Card>
        </Col>
      </Row>

      <AddAgentOffcanvas show={showAddAgent} handleClose={handleCloseSidebar} />
    </>
  );
}

export default Agents;
