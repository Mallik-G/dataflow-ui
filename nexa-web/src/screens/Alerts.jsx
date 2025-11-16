import React, { useState } from "react";
import { Badge, Nav, Dropdown, Form } from "react-bootstrap";
import {
  BiSolidCheckCircle,
  BiSolidInfoCircle,
  BiSolidBell,
  BiSolidError,
  BiDotsVerticalRounded,
} from "react-icons/bi";

function Alerts() {
  const [filter, setFilter] = useState("All Alerts");
  const [data] = useState([
    {
      id: 1,
      title: "Job Failure",
      description: "Database backup job failed - Server XYZ",
      duration: "10 Minutes Ago",
      status: "Failed",
    },
    {
      id: 2,
      title: "Change in Data Flow",
      description: "Added a new attribute column in order_consumption.360",
      duration: "1 Hour Ago",
      status: "New",
    },
    {
      id: 3,
      title: "Job Hold",
      description: "Database backup Job on Hold",
      duration: "2 Hours Ago",
      status: "Acknowledged",
    },
    {
      id: 4,
      title: "System Status",
      description: "All systems operating normally",
      duration: "1 Hours Ago",
      status: "Success",
    },
  ]);

  // Filtered data
  const filteredData =
    filter === "All Alerts"
      ? data
      : data.filter((item) => item.status === filter);

  return (
    <>
      <header className="mb-4">
        <h1 className="h3 fw-medium">Alerts</h1>
      </header>

      {/* Filters */}
      <div className="d-flex align-items-center filters alerts-filter mb-4 justify-content-between">
        <Nav variant="pills" className="justify-content-start alerts-nav">
          {["All Alerts", "Failed", "New", "Acknowledged", "Success"].map(
            (type) => (
              <Nav.Item key={type}>
                <Nav.Link
                  active={filter === type}
                  onClick={() => setFilter(type)}
                >
                  {type}
                </Nav.Link>
              </Nav.Item>
            )
          )}
        </Nav>
        <div className="d-flex gap-4">
          <Form.Group className="d-flex gap-2 align-items-center">
            <Form.Label className="m-0 text-nowrap">Sort by:</Form.Label>
            <Form.Select>
              <option value="">Latest First</option>
              <option value="">Old First</option>
            </Form.Select>
          </Form.Group>
          <Form.Group className="d-flex gap-2 align-items-center">
            <Form.Label className="m-0 text-nowrap">Show:</Form.Label>
            <Form.Select>
              <option value="">All Alerts</option>
              <option value="">New</option>
              <option value="">Success</option>
              <option value="">Aknowledgement</option>
              <option value="">Failed</option>
            </Form.Select>
          </Form.Group>
        </div>
      </div>

      {/* Alerts List */}
      <div className="alerts d-grid gap-3">
        {filteredData.map((item) => (
          <div
            key={item.id}
            className={`alerts-item border p-4 rounded-3 d-flex gap-4 align-items-start 
              ${
                item.status === "New"
                  ? "is-new"
                  : item.status === "Success"
                  ? "is-success"
                  : item.status === "Acknowledged"
                  ? "is-acknowledged"
                  : item.status === "Failed"
                  ? "is-failed"
                  : ""
              }`}
          >
            <div className="alerts-icon">
              {item.status === "New" ? (
                <BiSolidInfoCircle />
              ) : item.status === "Success" ? (
                <BiSolidCheckCircle />
              ) : item.status === "Acknowledged" ? (
                <BiSolidBell />
              ) : item.status === "Failed" ? (
                <BiSolidError />
              ) : null}
            </div>
            <div className="flex-fill">
              <h4 className="alerts-title text-large fw-medium">
                {item.title}
              </h4>
              <p className="alerts-desc text-large">{item.description}</p>
              <p className="alerts-time text-muted text-small m-0">
                {item.duration}
              </p>
            </div>
            <div className="d-flex gap-2 align-items-center">
              <Badge
                pill
                bg={
                  item.status === "New"
                    ? "primary"
                    : item.status === "Success"
                    ? "success"
                    : item.status === "Acknowledged"
                    ? "default"
                    : item.status === "Failed"
                    ? "danger"
                    : "light"
                }
              >
                {item.status}
              </Badge>

              <Dropdown>
                <Dropdown.Toggle variant="default btn-icon" size="sm">
                  <BiDotsVerticalRounded />
                </Dropdown.Toggle>

                <Dropdown.Menu>
                  <Dropdown.Item href="#/action-2">Edit</Dropdown.Item>
                  <Dropdown.Item href="#/action-3">Delete</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default Alerts;
