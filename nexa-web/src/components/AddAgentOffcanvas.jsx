import React, { useState } from "react";
import {
  Offcanvas,
  Form,
  FloatingLabel,
  Row,
  Col,
  Button,
  Collapse,
} from "react-bootstrap";
import { BiChevronDown, BiLockAlt, BiTrash, BiChevronUp } from "react-icons/bi";

const PromptManager = () => {
  const [prompts, setPrompts] = useState([
    "Show customers with high lifetime value",
  ]);

  // Handle prompt removal
  const removePrompt = (index) => {
    setPrompts(prompts.filter((_, i) => i !== index));
  };

  // Handle adding a new prompt
  const addPrompt = () => {
    const newPrompt = prompt("Enter new prompt:");
    if (newPrompt && newPrompt.trim() !== "") {
      setPrompts([...prompts, newPrompt]);
    }
  };

  return (
    <>
      <div className="border radius px-3 py-2 rounded d-flex mt-3">
        <label className="pt-2 pe-3 m-0">Prompts:</label>
        <div className="d-flex gap-2 flex-wrap">
          {prompts.map((pdata, index) => (
            <div
              key={index}
              className="d-flex rounded px-3 py-2 align-items-center gap-3"
              style={{ background: "#EFF6FF" }}
            >
              {pdata}
              <span
                className="btn h-auto p-0"
                onClick={() => removePrompt(index)}
              >
                <BiTrash size={18} color="#4B5563" />
              </span>
            </div>
          ))}
          <span className="btn btn-link" onClick={addPrompt}>
            + Add Prompt
          </span>
        </div>
      </div>
      <Form.Text className="opacity-50">
        Provide sample queries or commands the agent should be trained to
        respond to.
      </Form.Text>
    </>
  );
};

const AddAgentOffcanvas = ({ show, handleClose }) => {
  const [collapseOpen, setCollapseOpen] = useState(false);

  return (
    <Offcanvas
      show={show}
      onHide={handleClose}
      placement="end"
      backdrop="static"
      className="size-lg"
    >
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Create New Agent</Offcanvas.Title>
      </Offcanvas.Header>

      <Offcanvas.Body>
        <Form.Group className="mb-3">
          <FloatingLabel
            className="mb-1"
            label="Add Agent Goal/Intent (E.g; Generate marketing summaries, optimize cost, analyze sales trends...)"
          >
            <Form.Control
              type="text"
              placeholder="Add Agent Goal/Intent (E.g; Generate marketing summaries, optimize cost, analyze sales trends...)"
            />
          </FloatingLabel>
          <Form.Text className="opacity-50">
            Based on Agent Goal outlined, Agent Tools would be auto-recommended
            and auto-selected but can be changed
          </Form.Text>
        </Form.Group>

        <Form.Group className="mb-3">
          <FloatingLabel label="Enter Agent Name">
            <Form.Control type="text" placeholder="Enter Agent Name" />
          </FloatingLabel>
        </Form.Group>

        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <FloatingLabel label="Enter Description">
                <Form.Control
                  as="textarea"
                  placeholder="Enter Description"
                  style={{ minHeight: "80px" }}
                />
              </FloatingLabel>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <FloatingLabel label="Enter Context">
                <Form.Control
                  as="textarea"
                  placeholder="Enter Context"
                  style={{ minHeight: "80px" }}
                />
              </FloatingLabel>
            </Form.Group>
          </Col>
        </Row>

        <div className="mt-3 mb-2">
          <Button
            variant="default"
            className="p-0"
            onClick={() => setCollapseOpen(!collapseOpen)}
          >
            <BiLockAlt size={18} />
            Configuration
            {collapseOpen ? (
              <BiChevronDown size={22} />
            ) : (
              <BiChevronUp size={22} />
            )}
          </Button>
        </div>

        <Collapse in={!collapseOpen}>
          <div id="collapseConfiguration">
            <Row className="mb-1">
              <Col md={6}>
                <Form.Group>
                  <FloatingLabel label="Tools Assigned">
                    <Form.Control type="text" placeholder="Tools Assigned" />
                  </FloatingLabel>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <FloatingLabel label="Select Model Endpoint">
                    <Form.Select>
                      <option value="">Select Model Endpoint</option>
                      <option>Model 1</option>
                      <option>Model 2</option>
                      <option>Model 3</option>
                      <option>Model 4</option>
                    </Form.Select>
                  </FloatingLabel>
                </Form.Group>
              </Col>
            </Row>
            <Form.Text className="opacity-50">
              You can assign multiple tools - up to 20 for Databricks including
              both SQL and Vector Index (Unstructured) types
            </Form.Text>
            <PromptManager />
          </div>
        </Collapse>

        <div className="mt-5 d-flex gap-2 justify-content-end">
          <Button variant="default" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary">Create Agent</Button>
        </div>
      </Offcanvas.Body>
    </Offcanvas>
  );
};

export default AddAgentOffcanvas;
