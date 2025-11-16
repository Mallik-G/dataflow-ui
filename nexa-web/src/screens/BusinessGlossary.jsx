import React from "react";
import {
  Button,
  Badge,
  OverlayTrigger,
  Tooltip,
  Form,
  Row,
  Col,
  Card,
  ListGroup,
  Table,
} from "react-bootstrap";
import {
  BiTrash,
  BiSearch,
  BiPlus,
  BiFilter,
  BiPencil,
  BiTargetLock,
  BiCheckCircle,
  BiSolidCheckCircle,
  BiBarChartAlt,
  BiUser,
  BiPurchaseTag,
  BiGlobe,
} from "react-icons/bi";
function BusinessGlossary() {
  return (
    <>
      <section className="d-flex flex-column flex-grow-1">
        <header className="d-flex justify-content-between align-items-center mb-2">
          <h1 className="h4 fw-medium m-0">Business Glossary</h1>
          <div className="d-flex justify-content-between gap-2">
            <Form.Group className="filters-search">
              <Button variant="light">
                <BiSearch />
              </Button>
              <Form.Control
                className="bg-transparent"
                aria-label="Search"
                placeholder="Search here..."
              />
            </Form.Group>
            <Button variant="outline-secondary" className="px-3">
              <BiFilter fontSize="24" /> Filter
            </Button>
          </div>
        </header>

        <div className="d-flex flex-grow-1 bs-container">
          {/* Sidebar - Start */}
          <aside className="bs-sidebar d-flex flex-column flex-grow-0 p-3">
            <header className="bs-sidebar-header d-flex flex-column gap-2 pb-3">
              <div className="d-flex align-items-center justify-content-between">
                <h5 className="fw-medium text-large m-0">Entities</h5>
                <BiFilter size={20} />
              </div>

              <div className="bs-sidebar-tabs rounded bg-white p-1 d-flex justify-content-between mb-2">
                <a href="#" className="btn btn-sm btn-default">
                  Raw
                </a>
                <a href="#" className="btn btn-sm btn-default">
                  Curated
                </a>
                <a href="#" className="btn btn-sm btn-primary">
                  Consumption
                </a>
              </div>
              <div className="filters-search w-auto">
                <Button variant="light">
                  <BiSearch size={18} />
                </Button>
                <Form.Control
                  size="sm"
                  className="border-0"
                  type="text"
                  placeholder="Search entities..."
                />
              </div>
            </header>
            <div className="bs-sidebar-body flex-grow-1">
              <div className="h-100 overflow-auto">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="bs-card shadow-sm p-3 rounded mb-3 bg-white border"
                  >
                    <div className="bs-card-header d-flex justify-content-between gap-2 align-items-center">
                      <h4 className="fw-medium text-large m-0 d-inline-flex align-items-center gap-2">
                        Customer Data
                        <BiSolidCheckCircle color="#22C55E" size={18} />
                      </h4>
                      <div className="d-flex">
                        <Button variant="default btn-icon" size="sm">
                          <BiBarChartAlt />
                        </Button>
                        <Button variant="default btn-icon" size="sm">
                          <BiPencil />
                        </Button>
                      </div>
                    </div>
                    <p className="bs-card-text text-muted text-small">
                      Customer information & preferences, Unique identifier for
                      customer
                    </p>
                    <ListGroup as="ul" className="bs-card-list" variant="flush">
                      <ListGroup.Item as="li">
                        <div className="list-label d-inline-flex align-items-center gap-1">
                          <BiUser fontSize={16} /> Owner:
                        </div>
                        <div className="list-badges d-flex gap-1 flex-wrap">
                          <Badge pill>Ankit Sharma</Badge>
                        </div>
                      </ListGroup.Item>
                      <ListGroup.Item as="li">
                        <div className="list-label d-inline-flex align-items-center gap-1">
                          <BiGlobe fontSize={16} /> Domain:
                        </div>
                        <div className="list-badges d-flex gap-1 flex-wrap">
                          <Badge bg="default" pill>
                            Customer
                          </Badge>{" "}
                          <Badge bg="default" pill>
                            Data
                          </Badge>{" "}
                        </div>
                      </ListGroup.Item>
                      <ListGroup.Item as="li">
                        <div className="list-label d-inline-flex align-items-center gap-1">
                          <BiPurchaseTag fontSize={16} /> Tags:
                        </div>
                        <div className="list-badges d-flex gap-1 flex-wrap">
                          <Badge bg="danger" pill>
                            PII
                          </Badge>{" "}
                          <Badge bg="default" pill>
                            System
                          </Badge>{" "}
                        </div>
                      </ListGroup.Item>
                    </ListGroup>
                  </div>
                ))}
              </div>
            </div>
          </aside>
          {/* Sidebar - End */}

          <div className="bs-data p-3 flex-shrink bg-light">
            <header className="bs-data-header d-flex align-items-center justify-content-between">
              <Form.Check
                type="checkbox"
                label="Show only PII attributes"
                id="checkPii"
              ></Form.Check>
              <div className="d-inline-flex gap-2">
                <Button variant="outline-secondary" size="sm">
                  Approve all
                </Button>
                <Button variant="outline-primary" size="sm">
                  Add AI Description
                </Button>
              </div>
            </header>
            <div className="bs-data-body bg-white rounded-3 border p-4 table-view">
              <Table borderless hover>
                <thead className="bg-transparent">
                  <tr>
                    <th>Attribute Name</th>
                    <th>Description</th>
                    <th>Data Type</th>
                    <th>Owner</th>
                    <th>PII Status</th>
                    <th>Tags</th>
                    <th>Status</th>
                    <th>Approved By</th>
                    <th>Approved Date</th>
                    <th>Last Modified</th>
                  </tr>
                </thead>

                <tbody>
                  {Array.from({ length: 16 }).map((_, i) => (
                    <tr key={i}>
                      <td>customer_id</td>
                      <td>Unique identifier for customer</td>
                      <td>VARCHAR(50)</td>
                      <td>Ankit Sharma</td>
                      <td>
                        <Form.Switch
                          type="checkbox"
                          label=""
                          id="switch1"
                        ></Form.Switch>
                      </td>
                      <td>Tags</td>
                      <td>Status</td>
                      <td>Approved By</td>
                      <td>Approved Date</td>
                      <td>Last Modified</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default BusinessGlossary;
