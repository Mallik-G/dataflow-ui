import axios from "axios";
import React, { useState, useEffect } from "react";
import { Form, Row, Col, Button, Modal } from "react-bootstrap";
import Select from "react-select";
import { toast } from "react-toastify";
import CreatableSelect from "react-select/creatable";

const AddSourceModal = ({ show, handleClose, sourceDetails }) => {
  const [schemas, setSchemas] = useState([]);
  const [catalogs, setCatalogs] = useState([]);
  const [selectedCatalog, setSelectedCatalog] = useState("");
  const [selectedSchema, setSelectedSchema] = useState([]);
  const [sourceName, setSourceName] = useState(null);
  const [description, setDescription] = useState("");
  const [tables, setTables] = useState([]);
  const [selectedTables, setSelectedTables] = useState([]);
  const [sources, setSources] = useState([]);
  const [sourceMasterId, setSourceMasterId] = useState("");
  const [selectedTablesMapping, setSelectedTablesMapping] = useState({});
  // Convert your existing sources array to react-select options
  const sourceOptions = sources.map((s) => ({
    value: s.source_name,
    label: s.source_name,
  }));

  useEffect(() => {
    getCatalogs();
    getSources();
    if (sourceDetails) {
      setSourceMasterId(sourceDetails.source_master_id);
      setSourceName(sourceDetails.source_name);
      setSelectedCatalog(sourceDetails.catalog);
      setSelectedSchema(sourceDetails.schema);
      setSelectedTables(sourceDetails.tables);
      setDescription(sourceDetails.description);
      setSelectedTablesMapping(sourceDetails?.table_schema_mapping);
      getSchemas(sourceDetails?.catalog);
      getTables(sourceDetails?.schema, sourceDetails?.catalog, false);
    }
  }, [show, sourceDetails]);

  const getSources = async () => {
    const response = await axios.get(`/api/source-master/sources`);
    setSources(response?.data?.data);
  };

  const getCatalogs = async () => {
    const response = await axios.get(
      `${import.meta.env.VITE_LLM_URL}/api/v1/catalogs`
    );
    setCatalogs(response.data.catalogs);
  };

  const getSchemas = async (catalog) => {
    const response = await axios.get(
      `${import.meta.env.VITE_LLM_URL}/api/v1/catalogs/${catalog}/schemas`
    );
    setSchemas(response?.data?.schemas);
  };

  const getTables = async (
    selectedSchemas,
    catalog = selectedCatalog,
    filterTables = true
  ) => {
    setTables([]);
    selectedSchemas.map(async (schema) => {
      const response = await axios.get(
        `${
          import.meta.env.VITE_LLM_URL
        }/api/v1/catalogs/${catalog}/schemas/${schema}/tables`,
        {}
      );

      // filter tables based on source table_schema_mapping to exclude tables that are already in any source
      let tables = response?.data?.tables;
      if (filterTables) {
        sources.forEach((source) => {
          if (source.catalog === catalog) {
            source?.table_schema_mapping[schema].forEach((table) => {
              tables = tables.filter((t) => t.name !== table);
            });
          }
        });
      }

      setTables((prev) => [...prev, ...tables]);
    });
  };

  const handleChange = (newValue) => {
    setSourceName("");
    setSelectedCatalog("");
    setSelectedSchema([]);
    setSelectedTables([]);
    setDescription("");
    setSourceName(newValue ? newValue.value : "");
    const data = sources.find((s) => s.source_name === newValue.value);
    setSourceMasterId(data.source_master_id);
    setSelectedCatalog(data.catalog);
    setSelectedSchema(data.schema);
    setSelectedTables(data.tables);
    setDescription(data.description);
    setSelectedTablesMapping(data.table_schema_mapping);
    getSchemas(data.catalog);
    getTables(data.schema, data.catalog, false);
  };

  const handleSubmit = async () => {
    let payload = {
      sourceMasterId,
      sourceName,
      selectedCatalog,
      selectedSchema,
      description,
      selectedTables,
      selectedTablesMapping,
    };

    if (selectedSchema?.length === 0) {
      toast.error("Please select at least one schema");
      return;
    }
    if (!sourceName) {
      toast.error("Please enter source name");
      return;
    }
    if (!selectedCatalog) {
      toast.error("Please select catalog");
      return;
    }
    if (selectedTables.length === 0) {
      toast.error("Please select at least one table");
      return;
    }

    const response = await axios.post(`/api/source-master/source`, payload);
    if (response?.data?.status === 200) {
      toast.success(response?.data?.message);
      handleReset();
    } else if (response?.data?.status == 400) {
      toast.error(response?.data?.message);
      return;
    } else {
      toast.error("Failed to add source");
      handleReset();
    }
  };

  // Prepare react-select options
  const schemaOptions = schemas.map((schema) => ({
    value: schema.name,
    label: schema.name,
  }));

  const tableOptions = tables.map((table) => ({
    key: table.schema_name,
    value: table.name,
    label: table.name,
  }));

  const handleReset = () => {
    setSourceName("");
    setSelectedCatalog("");
    setSelectedSchema([]);
    setSelectedTables([]);
    setDescription("");
    setSchemas([]);
    setCatalogs([]);
    setTables([]);
    handleClose();
  };

  return (
    <Modal show={show} onHide={handleReset} backdrop="static" size="md">
      <Modal.Header closeButton className="border-bottom" onClick={handleReset}>
        <Modal.Title>
          {sourceDetails ? "Edit Source" : "Add/Update Source"}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {/* <Form.Group className="mb-3">
          <Form.Label>Source Name</Form.Label>
          <Form.Control
            placeholder="Enter Source Name"
            onChange={(e) => setSourceName(e.target.value)}
          />
        </Form.Group> */}

        <Form.Group className="mb-3">
          <Form.Label>Source Name</Form.Label>
          <CreatableSelect
            isClearable
            placeholder="Search or create source..."
            options={sourceOptions}
            value={sourceName ? { label: sourceName, value: sourceName } : null}
            onChange={handleChange}
            isDisabled={sourceDetails ? true : false}
            onCreateOption={(inputValue) => {
              // You can call an API or update local state here
              setSourceName("");
              setSelectedCatalog("");
              setSelectedSchema([]);
              setSelectedTables([]);
              const newOption = { label: inputValue, value: inputValue };
              sourceOptions.push(newOption);
              setSourceName(inputValue);
            }}
            styles={{
              control: (base) => ({
                ...base,
                minHeight: "38px",
                borderColor: "#ced4da",
                boxShadow: "none",
              }),
            }}
          />
        </Form.Group>

        <Row>
          <Col md={12}>
            <Form.Group className="mb-3">
              <Form.Label>Select Catalog</Form.Label>
              <Form.Select
                value={selectedCatalog}
                onChange={(e) => {
                  setSelectedCatalog(e.target.value);
                  getSchemas(e.target.value);
                }}
              >
                <option value="" disabled>
                  Select Catalog
                </option>
                {catalogs.map((catalog) => (
                  <option key={catalog?.name} value={catalog?.name}>
                    {catalog?.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Select Schema</Form.Label>
              <Select
                isMulti
                isDisabled={!selectedCatalog}
                options={schemaOptions}
                value={schemaOptions.filter((opt) =>
                  selectedSchema.includes(opt.value)
                )}
                placeholder="Search or select schemas..."
                onChange={(selectedOptions) => {
                  const selectedValues = selectedOptions.map(
                    (opt) => opt.value
                  );
                  setSelectedSchema(selectedValues);
                  getTables(selectedValues);
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
            </Form.Group>
          </Col>

          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Select Tables</Form.Label>
              <Select
                isMulti
                isDisabled={selectedSchema.length === 0}
                options={tableOptions}
                value={tableOptions.filter((opt) =>
                  selectedTables.includes(opt.value)
                )}
                placeholder="Search or select tables..."
                onChange={(selectedOptions) => {
                  const selectedValues = selectedOptions.map(
                    (opt) => opt.value
                  );
                  const selectedValuesMapping = selectedTablesMapping;
                  selectedOptions.forEach((opt) => {
                    const key = opt.key;
                    const value = opt.value;

                    if (!selectedValuesMapping[key]) {
                      // Initialize as an array if key doesn't exist yet
                      selectedValuesMapping[key] = [];
                    }

                    // Push value into the array
                    selectedValuesMapping[key].push(value);
                  });
                  setSelectedTables(selectedValues);
                  setSelectedTablesMapping(selectedValuesMapping);
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
            </Form.Group>
          </Col>
        </Row>

        <Form.Group className="mb-5">
          <Form.Label>Description</Form.Label>
          <Form.Control
            as="textarea"
            placeholder="Enter Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Form.Group>

        <Form.Group>
          <Button variant="primary w-100" onClick={handleSubmit}>
            Submit
          </Button>
        </Form.Group>
      </Modal.Body>
    </Modal>
  );
};

export default AddSourceModal;
