import React, { useEffect, useState } from "react";
import axios from "axios";
import { Card, Table, Badge } from "react-bootstrap";
import { BiShow } from "react-icons/bi";
import { Link } from "react-router-dom";

function RecentJobs() {
  const [jobData, setJobData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const getJobsData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(
        `${
          import.meta.env.VITE_LLM_URL
        }/api/v1/jobs/?status_filter=all&job_type=all&search=null&sort_by=modified_time&sort_order=$desc&limit=3&offset=0`
      );

      if (response.status === 200) {
        setJobData(response.data.jobs || []);
      }
    } catch (error) {
      console.error("Error fetching jobs data:", error);
      setJobData([]);
    } finally {
      setIsLoading(false);
    }
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

  useEffect(() => {
    getJobsData();
  }, []);

  return (
    <>
      <Card className="h-100 p-0">
        <Card.Header className="d-flex justify-content-between p-4 pb-0 bg-transparent border-0">
          <h5 className="fw-semi-bold">Recent Jobs</h5>
          <Link className="fw-semi-bold" to="/jobs">
            View All
          </Link>
        </Card.Header>
        <Card.Body className="p-4">
          <Table className="dash-table">
            <thead>
              <tr>
                <th>Job Name</th>
                <th>Job Type</th>
                <th>Status</th>
                <th>Last Run</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-4">
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
              ) : jobData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    No jobs found
                  </td>
                </tr>
              ) : (
                jobData.map((item, index) => {
                  // let badgeClass = "";
                  let badgeBg = "running";
                  if (item.status === "running") {
                    badgeBg = "running";
                  } else if (item.status === "Completed") {
                    badgeBg = "complete";
                  } else if (item.status === "Pending") {
                    badgeBg = "pending";
                  }
                  return (
                    <tr key={item.job_id}>
                      <td className="text-black">{item.job_name}</td>
                      <td>{item.job_type}</td>
                      <td>
                        <Badge pill bg={badgeBg}>
                          {item.status}
                        </Badge>
                      </td>
                      <td>
                        {timeAgo(
                          item?.health?.last_successful_run ||
                            item?.health?.last_failed_run
                        )}{" "}
                        ago
                      </td>
                      <td>
                        <Link
                          to="/jobs"
                          className="btn btn-default fw-medium text-muted"
                        >
                          <BiShow /> View/Update
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  );
}

export default RecentJobs;
