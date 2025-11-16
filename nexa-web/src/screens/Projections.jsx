import React, { useEffect, useState } from "react";
import {
  Button,
  Table,
  Badge,
  Form,
  OverlayTrigger,
  Tooltip,
  Modal,
} from "react-bootstrap";
import { BiTrash, BiSearch, BiPlus, BiFilter, BiPencil } from "react-icons/bi";
import axios from "axios";
import { PiPlayBold, PiPauseBold } from "react-icons/pi";
import AddProjectionOffcanvas from "../components/AddProjectionOffcanvas";
import { toast } from "react-toastify";

const DisplaySources = ({ sources }) => {
  const [expanded, setExpanded] = useState(false);

  const visibleItems = expanded ? sources : sources.slice(0, 2);
  const hiddenCount = sources.length - 2;

  return (
    <>
      <div className="d-flex flex-wrap gap-1">
        {visibleItems.map((item, index) => (
          <Badge key={index} bg="light" pill>
            {item}
          </Badge>
        ))}
      </div>

      {!expanded && hiddenCount > 0 && (
        <Badge
          bg="light"
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

function Projections() {
  // const [data, setData] = useState([
  //   {
  //     id: 1,
  //     name: "Customer Profile Projection",
  //     description: "Creates enriched customer profiles from multiple sources",
  //     source: ["Customers", "Orders", "ThemeConsumer"],
  //     target: "Curated",
  //     mode: "Live",
  //     status: "Running",
  //     lastRun: "2024-01-20 14:30:00",
  //     playing: true,
  //   },
  //   {
  //     id: 2,
  //     name: "Product Analytics",
  //     description: "Aggregates product performance metrics",
  //     source: ["ThemeConsumer", "Entity"],
  //     target: "Cunsumption",
  //     mode: "Batch",
  //     status: "Suspended",
  //     lastRun: "2024-01-20 14:30:00",
  //     playing: false,
  //   },
  //   {
  //     id: 3,
  //     name: "Revenue Forecast",
  //     description: "Monthly revenue prediction models",
  //     source: ["Customers", "ThemeConsumer", "Entity"],
  //     target: "Cunsumption",
  //     mode: "Live",
  //     status: "Failed",
  //     lastRun: "2024-01-20 14:30:00",
  //     playing: false,
  //   },
  // ]);

  const [data, setData] = useState([]);
  const [showAddProjection, setShowAddProjection] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [projectionIdToDelete, setProjectionIdToDelete] = useState(null);
  const [selectedProjectionId, setSelectedProjectionId] = useState(null);

  const getProjections = async () => {
    try {
      const response = await axios.get("/api/projections/");
      if (response?.status === 200 && response?.data?.success) {
        setData(response?.data?.projections);
      } else {
        toast.error(response?.data?.message || "Failed to get projections");
        return;
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to get projections"
      );
      return;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const togglePlayPause = (id) => {
    setData((prevData) => {
      return prevData.map((item) => {
        if (item.projection_id == id) {
          item["playing"] = true;
        }
        return item;
      });
    });
    setTimeout(() => {
      setData((prevData) => {
        return prevData.map((item) => {
          if (item.projection_id == id) {
            item["playing"] = false;
          }
          return item;
        });
      });
    }, 1500);
  };

  useEffect(() => {
    getProjections();
  }, [showAddProjection]);

  const deleteProjection = async (id) => {
    try {
      const response = await axios.delete(`/api/projections/${id}`);
      console.log("response:", response);
      if (response?.status === 200 && response?.data?.success) {
        toast.success("Projection deleted successfully");
      } else {
        toast.error(response?.data?.message || "Failed to delete projection");
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to delete projection"
      );
    } finally {
      handleCloseConfirmDelete();
      getProjections();
    }
  };

  const handleCloseConfirmDelete = () => {
    setShowConfirmDelete(false);
    setProjectionIdToDelete(null);
  };

  const handleConfirmDelete = (id) => {
    setProjectionIdToDelete(id);
    setShowConfirmDelete(true);
  };

  const handleShowSidebar = (id) => {
    setShowAddProjection(true);
    setSelectedProjectionId(id);
  };
  const handleCloseSidebar = () => {
    setShowAddProjection(false);
    setSelectedProjectionId(null);
  };

  return (
    <>
      <header className="d-flex justify-content-between align-items-center mb-2">
        <h1 className="h4 fw-medium m-0">Projections</h1>
        <div className="d-flex justify-content-between gap-2">
          <Form.Group className="filters-search">
            <Button variant="light">
              <BiSearch />
            </Button>
            <Form.Control
              className="bg-transparent"
              aria-label="Search"
              placeholder="Search by projection name..."
            />
          </Form.Group>
          <Button variant="outline-secondary" className="px-3">
            <BiFilter fontSize="24" /> Filter
          </Button>
          <Button
            variant="outline-secondary"
            className="px-3"
            onClick={() => handleShowSidebar(null)}
          >
            <BiPlus size={20} /> Add
          </Button>
        </div>
      </header>
      <p>
        Projections automate data workflows to publish curated or
        consumption-ready datasets
      </p>

      <div className="table-view border px-4 py-2 rounded rounded-4 bg-white">
        <Table responsive className="m-0 last">
          <thead className="bg-transparent">
            <tr>
              <th style={{ width: "150px" }} className="ps-0">
                Projection Name
              </th>
              <th style={{ width: "400px" }}>Description</th>
              <th style={{ width: "100px" }}>Source Entities</th>
              <th style={{ width: "100px" }}>Target Layer</th>
              <th style={{ width: "100px" }}>Mode</th>
              <th style={{ width: "100px" }}>Status</th>
              <th style={{ width: "100px" }}>Last Run</th>
              <th style={{ width: "100px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.projection_id}>
                <td className="text-default fw-medium ps-0">
                  {item.projection_name}
                </td>
                <td className="text-muted">{item.description}</td>
                <td>
                  <DisplaySources sources={item.source_entities} />
                </td>
                <td>
                  <Badge
                    pill
                    bg={
                      item.target_layer === "curated" ? (
                        "danger"
                      ) : item.target_layer === "consumption" ? (
                        "primary"
                      ) : (
                        <></>
                      )
                    }
                  >
                    {item.target_layer}
                  </Badge>
                </td>
                <td>
                  <Badge
                    pill
                    bg={
                      item.projection_type === "live" ? (
                        "success"
                      ) : item.projection_type === "batch" ? (
                        "primary"
                      ) : (
                        <></>
                      )
                    }
                  >
                    <i className="dots" role="mode"></i>
                    {item.projection_type}
                  </Badge>
                </td>

                <td>
                  <Badge
                    pill
                    bg={
                      item.status === "running" ? (
                        "success"
                      ) : item.status === "suspended" ? (
                        "warning"
                      ) : item.status === "failed" ? (
                        "danger"
                      ) : item.status === "paused" ? (
                        "warning"
                      ) : item.status === "completed" ? (
                        "success"
                      ) : item.status === "pending" ? (
                        "warning"
                      ) : (
                        <></>
                      )
                    }
                  >
                    {item.status}
                  </Badge>
                </td>
                <td className="text-muted">
                  {item?.last_run_date ? formatDate(item?.last_run_date) : "-"}
                </td>

                <td>
                  <div className="d-flex gap-2">
                    <Button
                      onClick={() => togglePlayPause(item.projection_id)}
                      variant="default btn-icon"
                      size="sm"
                    >
                      {item.playing ? <PiPauseBold /> : <PiPlayBold />}
                    </Button>
                    <Button
                      variant="default btn-icon"
                      size="sm"
                      title="Edit"
                      onClick={() => handleShowSidebar(item.projection_id)}
                    >
                      <BiPencil />
                    </Button>
                    <Button
                      variant="default btn-icon"
                      size="sm"
                      title="Delete"
                      onClick={() => handleConfirmDelete(item.projection_id)}
                    >
                      <BiTrash />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <Modal show={showConfirmDelete} onHide={handleCloseConfirmDelete}>
        <Modal.Header closeButton>
          <Modal.Title>Delete Projection</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete this projection?</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseConfirmDelete}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteProjection(projectionIdToDelete)}
          >
            Delete
          </Button>
        </Modal.Footer>
      </Modal>

      <AddProjectionOffcanvas
        show={showAddProjection}
        handleClose={handleCloseSidebar}
        projectionId={selectedProjectionId}
      />
    </>
  );
}

export default Projections;
