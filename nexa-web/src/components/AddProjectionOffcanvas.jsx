import React, { useEffect, useState } from "react";
import {
  Offcanvas,
  Form,
  Row,
  Col,
  Button,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import { BiRefresh, BiTimeFive } from "react-icons/bi";
import { toast } from "react-toastify";
import Select from "react-select";
import axios from "axios";

const AddProjectionOffcanvas = ({ show, handleClose, projectionId }) => {
  const [projectionName, setProjectionName] = useState("");
  const [projectionDescription, setProjectionDescription] = useState("");
  const [projectionType, setProjectionType] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [frequency, setFrequency] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("");
  const [legacyProjection, setLegacyProjection] = useState(false);
  const [projectionSources, setProjectionSources] = useState([]);
  const [piiSuppressed, setPiiSuppressed] = useState(false);
  const [projectionTarget, setProjectionTarget] = useState("");

  useEffect(() => {
    if (projectionId) {
      getProjectionById(projectionId);
    }
  }, [projectionId]);

  const getProjectionById = async (projectionId) => {
    const response = await axios.get(`/api/projections/${projectionId}`);
    if (response?.status === 200 && response?.data?.success) {
      setProjectionName(response?.data?.projection?.projection_name);
      setProjectionDescription(response?.data?.projection?.description);
      setProjectionType(response?.data?.projection?.projection_type);
      setScheduleTime(response?.data?.projection?.schedule_time);
      setFrequency(response?.data?.projection?.frequency);
      setTimeOfDay(response?.data?.projection?.time_of_day);
      setLegacyProjection(response?.data?.projection?.legacy_projection);
      setProjectionSources(response?.data?.projection?.projection_sources);
      setProjectionTarget(response?.data?.projection?.projection_target);
      setPiiSuppressed(response?.data?.projection?.pii_suppressed);
      setProjectionSources(response?.data?.projection?.projection_sources);
      setPiiSuppressed(response?.data?.projection?.pii_suppressed);
    } else {
      toast.error(response?.data?.message || "Failed to get projection");
    }
  };

  const handleCreateProjection = async () => {
    try {
      if (!projectionName) return toast.error("Projection Name is required");
      if (!projectionDescription)
        return toast.error("Projection Description is required");
      if (!projectionType) return toast.error("Projection Type is required");
      if (!scheduleTime && projectionType === "batch")
        return toast.error("Schedule Time is required");
      if (!frequency && projectionType === "batch")
        return toast.error("Frequency is required");
      if (!timeOfDay && projectionType === "batch")
        return toast.error("Time of Day is required");
      if (projectionSources.length === 0)
        return toast.error("Projection Sources are required");
      if (!projectionTarget)
        return toast.error("Projection Target is required");

      const payload = {
        projection_name: projectionName,
        description: projectionDescription,
        source_entities: projectionSources,
        target_layer: "consumption",
        projection_type: projectionType,
        schedule_time: scheduleTime,
        frequency: frequency,
        time_of_day: timeOfDay,
        legacy_projection: legacyProjection,
        projection_sources: projectionSources,
        status: "pending",
        pii_suppressed: piiSuppressed,
        created_by: "admin",
        projection_target: projectionTarget,
      };

      const response = await axios.post("/api/projections/", payload);

      if (response?.status === 200 && response?.data?.success) {
        toast.success("Projection created successfully");
        handleResetAndClose();
        return;
      } else {
        return toast.error(
          response?.data?.message || "Failed to create projection"
        );
      }
    } catch (error) {
      console.log(error);
      return toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to create projection"
      );
    }
  };

  const handleUpdateProjection = async () => {
    try {
      if (!projectionName) return toast.error("Projection Name is required");
      if (!projectionDescription)
        return toast.error("Projection Description is required");
      if (!projectionType) return toast.error("Projection Type is required");
      if (!scheduleTime && projectionType === "batch")
        return toast.error("Schedule Time is required");
      if (!frequency && projectionType === "batch")
        return toast.error("Frequency is required");
      if (!timeOfDay && projectionType === "batch")
        return toast.error("Time of Day is required");
      if (projectionSources.length === 0)
        return toast.error("Projection Sources are required");
      if (!projectionTarget)
        return toast.error("Projection Target is required");

      const payload = {
        projection_name: projectionName,
        description: projectionDescription,
        source_entities: projectionSources,
        target_layer: "consumption",
        projection_type: projectionType,
        schedule_time: scheduleTime,
        frequency: frequency,
        time_of_day: timeOfDay,
        legacy_projection: legacyProjection,
        projection_sources: projectionSources,
        status: "pending",
        pii_suppressed: piiSuppressed,
        created_by: "admin",
        projection_target: projectionTarget,
      };

      const response = await axios.put(
        `/api/projections/${projectionId}`,
        payload
      );

      if (response?.status === 200 && response?.data?.success) {
        toast.success("Projection updated successfully");
        handleResetAndClose();
        return;
      } else {
        return toast.error(
          response?.data?.message || "Failed to update projection"
        );
      }
    } catch (error) {
      console.log(error);
      return toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to update projection"
      );
    }
  };

  const handleResetAndClose = () => {
    setProjectionName("");
    setProjectionDescription("");
    setScheduleTime("");
    setFrequency("");
    setProjectionType("");
    setTimeOfDay("");
    setLegacyProjection(false);
    setProjectionSources([]);
    setProjectionTarget("");
    setPiiSuppressed(false);
    handleClose();
  };

  return (
    <Offcanvas
      show={show}
      onHide={handleResetAndClose}
      placement="end"
      backdrop="static"
      className="size-lg"
    >
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>
          {projectionId ? "Edit Projection" : "Create New Projection"}
        </Offcanvas.Title>
      </Offcanvas.Header>

      <Offcanvas.Body>
        <h4 className="fw-semi-bold mb-4 text-large">Basic Information</h4>
        <Form.Group className="mb-3">
          <Form.Label>Projection Name</Form.Label>
          <Form.Control
            type="text"
            placeholder="Enter Projection Name"
            value={projectionName}
            onChange={(e) => setProjectionName(e.target.value)}
          />
        </Form.Group>
        <Form.Group className="mb-4">
          <Form.Label>Projection Description</Form.Label>
          <Form.Control
            as="textarea"
            placeholder="Describe the Purpose of this Projection"
            value={projectionDescription}
            onChange={(e) => setProjectionDescription(e.target.value)}
          />
        </Form.Group>
        <h4 className="fw-semi-bold mb-4 text-large">Select Projection Type</h4>
        <Row className="mb-4">
          <Col md={6}>
            <Form.Check className="project-type">
              <input
                type="radio"
                id="live"
                name="targetProjection"
                className="form-check-input"
                checked={projectionType === "live"}
                onClick={() => setProjectionType("live")}
              />
              <Form.Label
                for="live"
                className="d-flex flex-column border rounded p-3 ps-5"
              >
                <span className="fw-medium">
                  <BiRefresh color="#2563EB" size={20} /> Live
                </span>
                <span className="text-muted">Real-time data processing</span>
              </Form.Label>
            </Form.Check>
          </Col>
          <Col md={6}>
            <Form.Check className="project-type">
              <input
                type="radio"
                id="batch"
                name="targetProjection"
                className="form-check-input"
                checked={projectionType === "batch"}
                onClick={() => setProjectionType("batch")}
              />
              <Form.Label
                for="batch"
                className="d-flex flex-column border rounded p-3 ps-5"
              >
                <span className="fw-medium">
                  <BiTimeFive color="#2563EB" size={20} /> Batch
                </span>
                <span className="text-muted">Scheduled data processing</span>
              </Form.Label>
            </Form.Check>
          </Col>
        </Row>
        {projectionType === "batch" && (
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Schedule Time</Form.Label>
                <Form.Control
                  type="time"
                  placeholder="Enter Projection Name"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Frequency</Form.Label>
                <Form.Select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                >
                  <option value="" disabled>
                    Select Frequency
                  </option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  {/* <option value="custom">Custom</option> */}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Time of Day</Form.Label>
                <Form.Control
                  type="time"
                  placeholder="Enter Projection Name"
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>
        )}
        <Row>
          <Col md={4}>
            <Form.Group className="mb-3">
              <div className="d-flex gap-2 align-items-center mb-2">
                <Form.Label className="m-0">Legacy Projection</Form.Label>
                <OverlayTrigger
                  placement="right"
                  overlay={
                    <Tooltip>
                      Destination in the target system where data will be
                      written.
                    </Tooltip>
                  }
                >
                  <Button variant="outline-secondary btn-icon-info">!</Button>
                </OverlayTrigger>
              </div>
              <Row>
                <Col md={6}>
                  <Form.Check className="project-type">
                    <input
                      type="radio"
                      id="legacyTypeTrue"
                      name="LegacyType"
                      className="form-check-input"
                      checked={legacyProjection}
                      onClick={() => setLegacyProjection(true)}
                    />
                    <Form.Label
                      for="legacyTypeTrue"
                      className="fw-medium border rounded py-2 px-4 d-block ps-5"
                    >
                      True
                    </Form.Label>
                  </Form.Check>
                </Col>
                <Col md={6}>
                  <Form.Check className="project-type">
                    <input
                      type="radio"
                      id="legacyTypeFalse"
                      name="LegacyType"
                      className="form-check-input"
                      checked={!legacyProjection}
                      onClick={() => setLegacyProjection(false)}
                    />
                    <Form.Label
                      for="legacyTypeFalse"
                      className="fw-medium border rounded py-2 px-4 d-block ps-5"
                    >
                      False
                    </Form.Label>
                  </Form.Check>
                </Col>
              </Row>
            </Form.Group>
          </Col>
        </Row>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Select Source</Form.Label>
              <Select
                isMulti
                options={[
                  { label: "C360", value: "c360" },
                  { label: "C360 AI", value: "c360_ai" },
                  { label: "C360 Gold", value: "c360_gold" },
                  { label: "C360 Consumption", value: "c360_consumption" },
                  { label: "C360 Curated", value: "c360_curated" },
                  { label: "C360 Raw", value: "c360_raw" },
                  { label: "C360 Transformed", value: "c360_transformed" },
                  { label: "C360 Normalized", value: "c360_normalized" },
                ]}
                value={
                  projectionSources.length > 0
                    ? projectionSources.map((opt) => ({
                        label: opt,
                        value: opt,
                      }))
                    : []
                }
                placeholder="Search or select sources..."
                onChange={(selectedOptions) => {
                  const selectedValues = selectedOptions.map(
                    (opt) => opt.value
                  );
                  setProjectionSources(selectedValues);
                }}
                styles={{
                  control: (base) => ({
                    ...base,
                    borderColor: "#ced4da",
                    boxShadow: "none",
                    "&:hover": { borderColor: "#adb5bd" },
                  }),
                }}
              />

              <Form.Text className="text-muted mt-2">
                Projections require ETL logic. Use the Canvas tool to define
                transformations.
              </Form.Text>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Select Target</Form.Label>
              <Form.Control
                type="text"
                placeholder="Select target entity"
                value={projectionTarget}
                onChange={(e) => setProjectionTarget(e.target.value)}
              />
            </Form.Group>
          </Col>
        </Row>

        <Form.Check
          type="checkbox"
          label="PII Suppressed"
          id="piiSuppressed"
          checked={piiSuppressed}
          onClick={() => setPiiSuppressed(!piiSuppressed)}
        ></Form.Check>

        <Form.Text className="text-muted mt-2 ms-4">
          Enable this if PII should be excluded from projection
        </Form.Text>

        <Form.Group className="mt-5 d-flex gap-2 justify-content-end">
          <Button size="lg" variant="default" onClick={handleResetAndClose}>
            Cancel
          </Button>
          <Button
            size="lg"
            variant="primary"
            onClick={
              projectionId ? handleUpdateProjection : handleCreateProjection
            }
          >
            {projectionId ? "Update Projection" : "Create Projection"}
          </Button>
        </Form.Group>
      </Offcanvas.Body>
    </Offcanvas>
  );
};

export default AddProjectionOffcanvas;
