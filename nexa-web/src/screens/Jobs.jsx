import React, { useEffect, useState } from "react";
import {
  Button,
  Table,
  Badge,
  Form,
  OverlayTrigger,
  Tooltip,
  Image,
  Pagination,
  Dropdown,
} from "react-bootstrap";
import {
  BiSearch,
  BiFilter,
  BiTime,
  BiSolidXCircle,
  BiSolidCheckCircle,
} from "react-icons/bi";
import axios from "axios";
import Chatbot from "../components/Chatbot";
import aiLogo from "../assets/ai-icon.svg";
import JobOffcanvas from "../components/JobOffcanvas";

function Jobs() {
  const [data, setData] = useState([]);
  const [showAddJob, setShowAddJob] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("modified_time");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showFilters, setShowFilters] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25); // Fixed at 25 to match API limit
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedJobStatus, setSelectedJobStatus] = useState("");

  const handleShowSidebar = (id, failedJob) => {
    console.log(failedJob);
    if (failedJob) {
      setSelectedJobStatus("failed");
    } else {
      setSelectedJobStatus("success");
    }
    setSelectedJobId(id);
    setShowAddJob(true);
  };
  const handleCloseSidebar = () => {
    setSelectedJobId(null);
    setSelectedJobStatus("");
    setShowAddJob(false);
  };

  const getJobsData = async (page = currentPage) => {
    setIsLoading(true);
    const offset = (page - 1) * itemsPerPage;

    try {
      const response = await axios.get(
        `${
          import.meta.env.VITE_LLM_URL
        }/api/v1/jobs/?status_filter=${statusFilter}&job_type=${jobTypeFilter}&search=${search}&sort_by=${sortBy}&sort_order=${sortOrder}&limit=${itemsPerPage}&offset=${offset}`
      );

      if (response.status === 200) {
        setData(response.data.jobs || []);
        // setData(response1.jobs);
        setTotalItems(response.data.total_count || 0);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error("Error fetching jobs data:", error);
      // Fallback to mock data if API fails (backwards compatibility)
      setData([]);
      setTotalItems(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Reset to first page when filters change
    setCurrentPage(1);
    getJobsData(1);
  }, [statusFilter, jobTypeFilter, search, sortBy, sortOrder]);

  // Helper functions for filters
  const getActiveFilterCount = () => {
    let count = 0;
    if (statusFilter !== "all") count++;
    if (jobTypeFilter !== "all") count++;
    if (search.trim()) count++;
    if (sortBy !== "modified_time") count++;
    if (sortOrder !== "desc") count++;
    return count;
  };

  const clearAllFilters = () => {
    setStatusFilter("all");
    setJobTypeFilter("all");
    setSearch("");
    setSortBy("modified_time");
    setSortOrder("desc");
    setCurrentPage(1);
  };

  // Pagination handlers
  const handlePageChange = (page) => {
    if (page >= 1 && page <= Math.ceil(totalItems / itemsPerPage)) {
      getJobsData(page);
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

  const getBadgeVariant = (status) => {
    switch (status) {
      case "success":
        return "success";
      case "failed":
        return "danger";
      case "in progress":
        return "warning";
      default:
        return "secondary";
    }
  };

  const getBadgeContent = (status) => {
    switch (status) {
      case "success":
        return (
          <>
            <BiSolidCheckCircle size={16} /> Success
          </>
        );
      case "failed":
        return (
          <>
            <BiSolidXCircle size={16} /> Failed
          </>
        );
      case "in progress":
        return (
          <>
            <BiTime size={16} /> In progress
          </>
        );
      default:
        return null;
    }
  };

  const StatusBadge = ({ status, reason }) => {
    const badge = (
      <Badge
        pill
        className="gap-1 d-inline-flex align-items-center"
        bg={getBadgeVariant(status)}
      >
        {getBadgeContent(status)}
      </Badge>
    );

    return reason ? (
      <OverlayTrigger placement="bottom" overlay={<Tooltip>{reason}</Tooltip>}>
        {badge}
      </OverlayTrigger>
    ) : (
      badge
    );
  };

  const timeAgo = (timestamp) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffInSeconds = Math.floor((now - past) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds}s`;
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 365) {
      return `${diffInDays}d`;
    }

    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears}y`;
  };

  return (
    <>
      <header className="d-flex justify-content-between align-items-center mb-2">
        <h1 className="h4 fw-medium m-0">Jobs</h1>
        <div className="d-flex justify-content-between gap-2">
          <Form.Group className="filters-search">
            <Button variant="light">
              <BiSearch />
            </Button>
            <Form.Control
              className="bg-transparent"
              aria-label="Search"
              placeholder="Search by Job Id or name..."
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
                <h6 className="mb-2">Status Filter</h6>
                <Form.Select
                  size="sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="in progress">In Progress</option>
                </Form.Select>
              </div>

              <div className="mb-3">
                <h6 className="mb-2">Job Type Filter</h6>
                <Form.Select
                  size="sm"
                  value={jobTypeFilter}
                  onChange={(e) => setJobTypeFilter(e.target.value)}
                >
                  <option value="all">All Job Types</option>
                  <option value="notebook">Notebook</option>
                  <option value="python wheel">Python Wheel</option>
                </Form.Select>
              </div>

              <div className="mb-3">
                <h6 className="mb-2">Sort By</h6>
                <div className="d-flex gap-2">
                  <Form.Select
                    size="sm"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="modified_time">Last Modified</option>
                    <option value="created_time">Created Date</option>
                    <option value="job_name">Job Name</option>
                    <option value="status">Status</option>
                    <option value="last_fetched">Last Run</option>
                  </Form.Select>
                  <Form.Select
                    size="sm"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    style={{ width: "100px" }}
                  >
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                  </Form.Select>
                </div>
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
      <p>Track data jobs, monitor status, and resolve failures instantly.</p>

      {/* Table */}
      <div className="table-view border px-4 py-2 rounded rounded-4 bg-white">
        <Table responsive className="m-0 last align-middle">
          <thead className="bg-transparent">
            <tr>
              <th className="ps-0">Job ID</th>
              <th>Job Name</th>
              <th>Job Type</th>
              <th>Status</th>
              <th>Actions</th>
              <th>Last Run</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="6" className="text-center py-4">
                  <div className="d-flex justify-content-center align-items-center">
                    <div
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                    >
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    Loading jobs...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-4 text-muted">
                  No jobs found
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item.job_id}>
                  <td className="text-muted fw-medium ps-0">{item.job_id}</td>
                  <td
                    onClick={() =>
                      handleShowSidebar(
                        item.job_id,
                        item?.last_failed_run > item?.last_successful_run
                      )
                    }
                    className={`text-nowrap ${
                      item?.last_failed_run > item?.last_successful_run
                        ? "text-danger"
                        : "text-primary"
                    }`}
                  >
                    {item.job_name}
                  </td>
                  <td
                    className={`text-nowrap ${
                      item?.last_failed_run > item?.last_successful_run
                        ? "text-danger"
                        : "text-muted"
                    }`}
                  >
                    <div className="text-desc">{item.job_type}</div>
                  </td>
                  <td>
                    <StatusBadge
                      status={
                        item?.last_failed_run > item?.last_successful_run
                          ? "failed"
                          : "success"
                      }
                      // reason={item.statusReason}
                    />
                  </td>
                  <td>
                    {item?.last_failed_run > item?.last_successful_run && (
                      <>
                        <Button variant="default">
                          <span className="circle" role="img" aria-label="chat">
                            <Image src={aiLogo} alt="" />
                          </span>
                          <span className="btn-chat fw-normal">
                            Fix with Nexa
                          </span>
                        </Button>
                      </>
                    )}
                  </td>

                  <td
                    className={`text-nowrap ${
                      item?.last_failed_run > item?.last_successful_run
                        ? "text-danger"
                        : "text-muted"
                    }`}
                  >
                    {timeAgo(
                      item?.health?.last_successful_run ||
                        item?.health?.last_failed_run
                    )}{" "}
                    ago
                  </td>
                </tr>
              ))
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
            {totalItems} jobs
          </div>
          <Pagination className="mb-0">
            <Pagination.Prev
              onClick={handlePreviousPage}
              disabled={currentPage === 1 || isLoading}
            />

            {/* Generate page numbers */}
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

              // Adjust start page if we're near the end
              if (endPage - startPage + 1 < maxVisiblePages) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
              }

              // Add first page and ellipsis if needed
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

              // Add visible pages
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

              // Add last page and ellipsis if needed
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

      {selectedJobId != null || selectedJobId != undefined ? (
        <JobOffcanvas
          show={showAddJob}
          handleClose={handleCloseSidebar}
          jobId={selectedJobId}
          jobStatus={selectedJobStatus}
        />
      ) : null}
    </>
  );
}

export default Jobs;
