import React, { useEffect, useState } from "react";
import {
  Button,
  Table,
  Badge,
  Form,
  OverlayTrigger,
  Tooltip,
  Pagination,
  Dropdown,
} from "react-bootstrap";
import {
  BiSearch,
  BiFilter,
  BiTime,
  BiSolidXCircle,
  BiSolidCheckCircle,
  BiPlay,
  BiPause,
} from "react-icons/bi";
import axios from "axios";
import PipelineOffcanvas from "../components/PipelineOffcanvas";

function Pipelines() {
  const [data, setData] = useState([]);
  const [showPipelineDetails, setShowPipelineDetails] = useState(false);
  const [stateFilter, setStateFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedPipelineId, setSelectedPipelineId] = useState(null);

  const handleShowSidebar = (id) => {
    setSelectedPipelineId(id);
    setShowPipelineDetails(true);
  };

  const handleCloseSidebar = () => {
    setSelectedPipelineId(null);
    setShowPipelineDetails(false);
  };

  const getPipelinesData = async (page = currentPage) => {
    setIsLoading(true);

    try {
      const response = await axios.get(
        `${import.meta.env.VITE_LLM_URL}/api/v1/pipelines?max_results=1000`
      );

      if (response.status === 200) {
        let pipelines = response.data.statuses || [];

        // Apply filters
        if (stateFilter !== "all") {
          pipelines = pipelines.filter((p) => p.state === stateFilter);
        }
        if (healthFilter !== "all") {
          pipelines = pipelines.filter((p) => p.health === healthFilter);
        }
        if (modeFilter !== "all") {
          const isContinuous = modeFilter === "continuous";
          pipelines = pipelines.filter((p) => p.spec?.continuous === isContinuous);
        }
        if (search.trim()) {
          pipelines = pipelines.filter(
            (p) =>
              p.name?.toLowerCase().includes(search.toLowerCase()) ||
              p.pipeline_id?.toLowerCase().includes(search.toLowerCase())
          );
        }

        setTotalItems(pipelines.length);
        const offset = (page - 1) * itemsPerPage;
        setData(pipelines.slice(offset, offset + itemsPerPage));
        setCurrentPage(page);
      }
    } catch (error) {
      console.error("Error fetching pipelines data:", error);
      setData([]);
      setTotalItems(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    getPipelinesData(1);
  }, [stateFilter, healthFilter, modeFilter, search]);

  const getActiveFilterCount = () => {
    let count = 0;
    if (stateFilter !== "all") count++;
    if (healthFilter !== "all") count++;
    if (modeFilter !== "all") count++;
    if (search.trim()) count++;
    return count;
  };

  const clearAllFilters = () => {
    setStateFilter("all");
    setHealthFilter("all");
    setModeFilter("all");
    setSearch("");
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= Math.ceil(totalItems / itemsPerPage)) {
      getPipelinesData(page);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  };

  const getStateBadge = (state) => {
    const stateMap = {
      RUNNING: { variant: "success", icon: <BiPlay />, label: "Running" },
      IDLE: { variant: "secondary", icon: <BiPause />, label: "Idle" },
      FAILED: { variant: "danger", icon: <BiSolidXCircle />, label: "Failed" },
      RESETTING: { variant: "warning", icon: <BiTime />, label: "Resetting" },
      STOPPING: { variant: "warning", icon: <BiPause />, label: "Stopping" },
      DELETED: { variant: "dark", icon: <BiSolidXCircle />, label: "Deleted" },
    };

    const config = stateMap[state] || { variant: "secondary", icon: null, label: state || "Unknown" };

    return (
      <Badge pill bg={config.variant} className="d-inline-flex align-items-center gap-1">
        {config.icon} {config.label}
      </Badge>
    );
  };

  const getHealthBadge = (health) => {
    if (health === "HEALTHY") {
      return (
        <Badge pill bg="success">
          <BiSolidCheckCircle /> Healthy
        </Badge>
      );
    } else if (health === "UNHEALTHY") {
      return (
        <Badge pill bg="danger">
          <BiSolidXCircle /> Unhealthy
        </Badge>
      );
    }
    return (
      <Badge pill bg="secondary">
        Unknown
      </Badge>
    );
  };

  const timeAgo = (timestamp) => {
    if (!timestamp) return "N/A";
    const now = new Date();
    const past = new Date(timestamp);
    const diffInSeconds = Math.floor((now - past) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 365) return `${diffInDays}d`;
    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears}y`;
  };

  const getTableCount = (pipeline) => {
    // Try to extract table count from spec or latest updates
    // This is a simplified version - actual implementation may vary
    return pipeline.spec?.libraries?.length || 0;
  };

  return (
    <>
      <header className="d-flex justify-content-between align-items-center mb-2">
        <h1 className="h4 fw-medium m-0">Pipelines</h1>
        <div className="d-flex justify-content-between gap-2">
          <Form.Group className="filters-search">
            <Button variant="light">
              <BiSearch />
            </Button>
            <Form.Control
              className="bg-transparent"
              aria-label="Search"
              placeholder="Search by Pipeline ID or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Form.Group>
          <Dropdown show={showFilters} onToggle={setShowFilters}>
            <Dropdown.Toggle
              variant="outline-secondary"
              className="px-3 d-flex align-items-center gap-2"
            >
              <BiFilter fontSize="20" />
              Filter
              {getActiveFilterCount() > 0 && (
                <Badge bg="primary" className="ms-1">
                  {getActiveFilterCount()}
                </Badge>
              )}
            </Dropdown.Toggle>

            <Dropdown.Menu className="p-3" style={{ minWidth: "300px" }}>
              <div className="mb-3">
                <h6 className="mb-2">State Filter</h6>
                <Form.Select
                  size="sm"
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                >
                  <option value="all">All States</option>
                  <option value="RUNNING">Running</option>
                  <option value="IDLE">Idle</option>
                  <option value="FAILED">Failed</option>
                  <option value="RESETTING">Resetting</option>
                  <option value="STOPPING">Stopping</option>
                </Form.Select>
              </div>

              <div className="mb-3">
                <h6 className="mb-2">Health Filter</h6>
                <Form.Select
                  size="sm"
                  value={healthFilter}
                  onChange={(e) => setHealthFilter(e.target.value)}
                >
                  <option value="all">All Health States</option>
                  <option value="HEALTHY">Healthy</option>
                  <option value="UNHEALTHY">Unhealthy</option>
                </Form.Select>
              </div>

              <div className="mb-3">
                <h6 className="mb-2">Mode Filter</h6>
                <Form.Select
                  size="sm"
                  value={modeFilter}
                  onChange={(e) => setModeFilter(e.target.value)}
                >
                  <option value="all">All Modes</option>
                  <option value="continuous">Continuous</option>
                  <option value="triggered">Triggered</option>
                </Form.Select>
              </div>

              <div className="d-flex justify-content-between">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={clearAllFilters}
                  disabled={getActiveFilterCount() === 0}
                >
                  Clear All
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowFilters(false)}
                >
                  Apply Filters
                </Button>
              </div>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </header>
      <p>Monitor Delta Live Tables pipelines, track execution, and manage configurations.</p>

      {/* Table */}
      <div className="table-view border px-4 py-2 rounded rounded-4 bg-white">
        <Table responsive className="m-0 last align-middle">
          <thead className="bg-transparent">
            <tr>
              <th className="ps-0">Pipeline ID</th>
              <th>Pipeline Name</th>
              <th>Mode</th>
              <th>Environment</th>
              <th>Tables</th>
              <th>State</th>
              <th>Health</th>
              <th>Photon</th>
              <th>Serverless</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="9" className="text-center py-4">
                  <div className="d-flex justify-content-center align-items-center">
                    <div
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                    >
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    Loading pipelines...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center py-4 text-muted">
                  No pipelines found
                </td>
              </tr>
            ) : (
              data.map((item) => {
                const isContinuous = item.spec?.continuous === true;
                const isDevelopment = item.spec?.development === true;
                const photonEnabled = item.spec?.photon === true;
                const serverlessEnabled = item.spec?.serverless === true;
                const tableCount = getTableCount(item);

                return (
                  <tr key={item.pipeline_id}>
                    <td className="text-muted fw-medium ps-0">
                      {item.pipeline_id?.substring(0, 8)}...
                    </td>
                    <td
                      onClick={() => handleShowSidebar(item.pipeline_id)}
                      className="text-nowrap text-primary"
                      style={{ cursor: "pointer" }}
                    >
                      {item.name}
                    </td>
                    <td>
                      <Badge bg={isContinuous ? "info" : "secondary"} pill>
                        {isContinuous ? "Continuous" : "Triggered"}
                      </Badge>
                    </td>
                    <td>
                      <Badge bg={isDevelopment ? "warning" : "success"} pill>
                        {isDevelopment ? "Development" : "Production"}
                      </Badge>
                    </td>
                    <td className="text-center">
                      <Badge bg="secondary" pill>
                        {tableCount}
                      </Badge>
                    </td>
                    <td>{getStateBadge(item.state)}</td>
                    <td>{getHealthBadge(item.health)}</td>
                    <td className="text-center">
                      {photonEnabled ? (
                        <Badge bg="success" pill>✓</Badge>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="text-center">
                      {serverlessEnabled ? (
                        <Badge bg="primary" pill>✓</Badge>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalItems > itemsPerPage && (
        <div className="d-flex justify-content-between align-items-center mt-3 px-2">
          <div className="text-muted">
            Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}{" "}
            to {Math.min(currentPage * itemsPerPage, totalItems)} of{" "}
            {totalItems} pipelines
          </div>
          <Pagination className="mb-0">
            <Pagination.Prev
              onClick={handlePreviousPage}
              disabled={currentPage === 1 || isLoading}
            />

            {(() => {
              const totalPages = Math.ceil(totalItems / itemsPerPage);
              const pages = [];
              const maxVisiblePages = 5;

              let startPage = Math.max(
                1,
                currentPage - Math.floor(maxVisiblePages / 2)
              );
              let endPage = Math.min(
                totalPages,
                startPage + maxVisiblePages - 1
              );

              if (endPage - startPage + 1 < maxVisiblePages) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
              }

              if (startPage > 1) {
                pages.push(
                  <Pagination.Item key={1} onClick={() => handlePageChange(1)}>
                    1
                  </Pagination.Item>
                );
                if (startPage > 2) {
                  pages.push(<Pagination.Ellipsis key="start-ellipsis" />);
                }
              }

              for (let i = startPage; i <= endPage; i++) {
                pages.push(
                  <Pagination.Item
                    key={i}
                    active={i === currentPage}
                    onClick={() => handlePageChange(i)}
                    disabled={isLoading}
                  >
                    {i}
                  </Pagination.Item>
                );
              }

              if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                  pages.push(<Pagination.Ellipsis key="end-ellipsis" />);
                }
                pages.push(
                  <Pagination.Item
                    key={totalPages}
                    onClick={() => handlePageChange(totalPages)}
                  >
                    {totalPages}
                  </Pagination.Item>
                );
              }

              return pages;
            })()}

            <Pagination.Next
              onClick={handleNextPage}
              disabled={
                currentPage === Math.ceil(totalItems / itemsPerPage) ||
                isLoading
              }
            />
          </Pagination>
        </div>
      )}

      {selectedPipelineId && (
        <PipelineOffcanvas
          show={showPipelineDetails}
          handleClose={handleCloseSidebar}
          pipelineId={selectedPipelineId}
        />
      )}
    </>
  );
}

export default Pipelines;
