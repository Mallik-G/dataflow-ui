import React, { useState, useEffect } from "react";
import {
  Button,
  Table,
  Badge,
  Form,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import { BiTrash, BiSearch, BiPlus, BiFilter, BiLink } from "react-icons/bi";
import axios from "axios";
import { PiPlayBold, PiPauseBold } from "react-icons/pi";
import AddConnectorOffcanvas from "../components/AddConnectorOffcanvas";
import ConfigureTablesModal from "../components/ConfigureTablesModal";
import ReactPaginate from 'react-paginate';

const DisplaySources = ({ sources }) => {
  const [expanded, setExpanded] = useState(false);

  const visibleItems = expanded ? sources : sources.slice(0, 2);
  const hiddenCount = sources.length - 2;

  return (
    <>
      <div className="d-flex flex-wrap gap-1">
        {visibleItems.map((item, index) => (
          <Badge key={index} bg="primary" pill>
            {item}
          </Badge>
        ))}
      </div>

      {!expanded && hiddenCount > 0 && (
        <Badge
          bg="primary"
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

function Connectors() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState({keyword: ""});
  const [offset, setOffset] = useState(0)
  const [pageCount, setPageCount] = useState(0)
  const [filteredData, setFilteredData] = useState({});
  const [perPage, setPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalRecords, setTotalRecords] = useState(null)

  const fetchConnectors = async () => {
    try {
      const body = { params: { offset: offset, perPage: perPage, ...search } };
      const res = await axios.get("/api/connectors", body);
      console.log('connectorsData', res)
      if (res.data.success === true) {
        setData(res.data.data);
        setPageCount(Math.ceil(res.data.totalRecords / perPage))
				setTotalRecords(res.data.totalRecords)
      }
    } catch (error) {
      setMessage("Error fetching connectors");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this connector?")) return;
    try {
      await axios.delete(`/api/connectors/${id}`);
      setMessage("Connector deleted successfully");
      fetchConnectors();
    } catch (error) {
      setMessage("Error deleting connector");
    }
  };

  const onFilterChange = (e) => {
    console.log('search', e.target.value)
		setSearch({ ...search, [e.target.name]: e.target.value })
	}

  const searchData = () => {
    console.log('searched', search)
		setFilteredData(search);
		setOffset(0);
		setCurrentPage(0);
	}

  const handlePageClick = (e) => {
		const selectedPage = e.selected;
		let offset = selectedPage * perPage;
		setCurrentPage(selectedPage)
		setOffset(offset)
	}

  useEffect(() => {
    fetchConnectors();
  }, [offset, filteredData, perPage]);

  const togglePlayPause = (id) => {
    setData((prevData) =>
      prevData.map((item) =>
        item.id === id ? { ...item, playing: !item.playing } : item
      )
    );
  };

  const [showAddConnector, setShowAddConnector] = useState(false);
  const [showConfigureModal, setShowConfigureModal] = useState(false);
  const [selectedConnectorId, setSelectedConnectorId] = useState(null);
  const handleShowSidebar = () => setShowAddConnector(true);
  const handleCloseSidebar = () => setShowAddConnector(false);
  //const handleShowModal = () => setShowConfigureModal(true);
  const handleShowModal = (id) => {
    setSelectedConnectorId(id);
    setShowConfigureModal(true);
  };
  const handleCloseModal = () => setShowConfigureModal(false);
  return (
    <>
      <header className="d-flex justify-content-between align-items-center mb-2">
        <h1 className="h4 fw-medium m-0">Connectors</h1>
        <div className="d-flex justify-content-between gap-2">
          <Form.Group className="filters-search">
            <Button variant="light" onClick={searchData}>
              <BiSearch />
            </Button>
            <Form.Control
              className="bg-transparent"
              aria-label="Search"
              placeholder="Search Connectors"
              name="keyword"
              value={search.keyword}
              onChange={onFilterChange}
            />
          </Form.Group>
          <Button variant="outline-secondary" className="px-3">
            <BiFilter fontSize="24" /> Filter
          </Button>
          <Button
            variant="outline-secondary"
            className="px-3"
            onClick={handleShowSidebar}
          >
            <BiPlus size={20} /> Add
          </Button>
        </div>
      </header>
      <p>
        Connectors are live data pipelines that publish data immediately after
        any update to source entity
      </p>

      <div className="table-view border px-4 py-2 rounded rounded-4 bg-white">
        <Table responsive className="m-0 last">
          <thead className="bg-transparent">
            <tr>
              <th style={{ width: "150px" }} className="ps-0">
                Connector Name
              </th>
              <th style={{ width: "400px" }}>Target</th>
              <th style={{ width: "100px" }}>Published Tables</th>
              <th style={{ width: "100px" }}>Status</th>
              <th style={{ width: "100px" }}>Last Run</th>
              <th style={{ width: "100px" }}>Actions</th> 
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id}>
                <td className="text-default fw-medium ps-0">{item.name}</td>
                <td className="text-muted">{item.targetSystem}</td>
                <td>
                  <DisplaySources sources={item.source_dataset} />
                </td>

                <td>
                  <Badge
                    pill
                    bg={
                      item.status === "Running" ? (
                        "success"
                      ) : item.status === "Suspended" ? (
                        "warning"
                      ) : item.status === "Failed" ? (
                        "danger"
                      ) : (
                        <></>
                      )
                    }
                  >
                    {item.status}
                  </Badge>
                </td>
                <td className="text-muted text-nowrap">{item.lastRunAt}</td>
                  
                <td>
                  <div className="d-flex">
                    <Button
                      onClick={() => togglePlayPause(item.id)}
                      variant="default btn-icon"
                      size="sm"
                    >
                      {item.playing ? <PiPauseBold /> : <PiPlayBold />}
                    </Button>
                    <Button
                      variant="default btn-icon"
                      size="sm"
                      onClick={() => handleShowModal(item.id)}
                      title="Configure Published Table"
                    >
                      <BiLink />
                    </Button> 
                    <Button variant="default btn-icon" size="sm" title="Delete" onClick={() => handleDelete(item.id)}>
                      <BiTrash />
                    </Button>
                  </div>
                </td> 
              
              </tr>
            ))}
          </tbody>
        </Table>
        {
						data ?
							data.length !== 0 ?
								<ReactPaginate
									forcePage={currentPage}
									initialPage={currentPage}
									previousLabel={"prev"}
									nextLabel={"next"}
									breakLabel={"..."}
									breakClassName={"break-me"}
									pageCount={pageCount}
									marginPagesDisplayed={2}
									pageRangeDisplayed={5}
									onPageChange={handlePageClick}
									containerClassName={"pagination justify-content-center flex-wrap mt-3"}
									previousClassName={"page-item"}
									previousLinkClassName={"page-link"}
									pageClassName={"page-item"}
									pageLinkClassName={"page-link"}
									nextClassName={"page-item"}
									nextLinkClassName={"page-link"}
									subContainerClassName={"pages pagination"}
									activeClassName={"active"} />
								: null : null

					}
      </div>
      <AddConnectorOffcanvas
        show={showAddConnector}
        handleClose={handleCloseSidebar}
      />
      <ConfigureTablesModal
        show={showConfigureModal}
        handleClose={handleCloseModal}
        connectorId={selectedConnectorId}
      />
    </>
  );
}

export default Connectors;
