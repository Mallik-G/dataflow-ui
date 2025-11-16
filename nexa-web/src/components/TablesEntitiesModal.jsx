import axios from "axios";
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
  BiSolidData,
} from "react-icons/bi";

const TablesEntitiesModal = ({ show, handleClose, sourceTables }) => {
  return (
    <Modal show={show} onHide={handleClose} backdrop="static" size="lg">
      <Modal.Header closeButton className="border-bottom" onClick={handleClose}>
        <Modal.Title>Table &amp; Entities</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <div className="d-grid gap-2">
          {sourceTables.map((table) => (
            <div
              className="d-flex align-items-center gap-2 rounded p-3 bg-light"
              key={table}
            >
              <BiSolidData color="#0066CC" size={20} />
              <h4 className="fw-medium text-large m-0">{table}</h4>
              {/* <span className="text-muted">10000 records</span> */}
            </div>
          ))}
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default TablesEntitiesModal;
