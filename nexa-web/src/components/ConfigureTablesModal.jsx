import React, { useState, useEffect } from "react";
import {
  Form,
  FloatingLabel,
  Row,
  Col,
  Button,
  Modal,
  InputGroup,
  Dropdown,
} from "react-bootstrap";
import {
  BiChevronDown,
  BiLockAlt,
  BiTrash,
  BiChevronUp,
  BiSearch,
} from "react-icons/bi";

const ConfigureTablesModal = ({ show, handleClose, connectorId }) => {
  
  const allTables = [
    "Consumption.customer_360",
    "Consumption.order_360",
    "Consumption.store_360",
    "Consumption.bulkremove_360",
    "Consumption.subscription_360",
  ];

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTables, setSelectedTables] = useState([]);

  const handleCheck = (table) => {
    setSelectedTables((prev) =>
      prev.includes(table) ? prev.filter((t) => t !== table) : [...prev, table]
    );
  };

  const filteredTables = allTables.filter((table) =>
    table.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = () => {
    console.log("Selected Tables:", selectedTables);
    handleClose();
  };

  useEffect(() => {
    if (connectorId) {
      console.log("Selected Connector ID:", connectorId);
    }
  }, [connectorId])
  
  return (
    <Modal show={show} onHide={handleClose} backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Configure Published Tables</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Dropdown
          className={`w-100 multi-select ${
            selectedTables.length > 0 ? "is-filled" : ""
          }`}
        >
          <Dropdown.Toggle
            className="w-100 justify-content-between"
            variant="default"
          >
            <div className="text-truncate">
              {selectedTables.length > 0
                ? selectedTables.join(", ")
                : "Select Consumption Tables"}
            </div>
            <BiChevronDown />
          </Dropdown.Toggle>

          <Dropdown.Menu className="p-3 w-100">
            <Form.Group className="filters-search mb-2 w-100">
              <Button variant="light">
                <BiSearch />
              </Button>
              <Form.Control
                type="text"
                placeholder="Search Consumption Tables"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Form.Group>
            <div
              style={{ maxHeight: "150px", overflowY: "auto" }}
              className="px-2"
            >
              {filteredTables.map((table, index) => (
                <Form.Check
                  key={index}
                  type="checkbox"
                  id={`table-${index}`}
                  label={table}
                  checked={selectedTables.includes(table)}
                  onChange={() => handleCheck(table)}
                  className="mb-1"
                />
              ))}
            </div>
          </Dropdown.Menu>
        </Dropdown>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
        <Button variant="primary" onClick={handleClose}>
          Save Changes
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfigureTablesModal;
