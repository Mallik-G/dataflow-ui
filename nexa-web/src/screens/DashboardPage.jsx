import React from "react";
import { Row, Col, Card, Button, Image } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import dataFlow from "../assets/data-talk.svg";
import RecentChanges from "../components/dashboard/RecentChanges";
import DataAssets from "../components/dashboard/TotalDataAssets";
import ExecutedQueries from "../components/dashboard/ExecutedQueries";
import RecentJobs from "../components/dashboard/RecentJobs";
import OutboundConnectors from "../components/dashboard/OutboundConnectors";
import aiIcon from "../assets/ai-icon.svg";
import { BiPencil } from "react-icons/bi";
import TopActiveAgents from "../components/dashboard/TopActiveAgents";
const Dashboard = () => {
  const navigate = useNavigate();
  const getStarted = () => {
    navigate("/curated_landing_zone");
  };
  return (
    <>
      <div class="d-grid gap-4">
        <Row>
          {/* Data Flow - Start */}
          <Col md={6}>
            <div className="dash-nexa h-100 rounded-4">
              <div className="dash-nexa-body d-flex h-100 align-items-center gap-4">
                <div className="dash-nexa-img text-center">
                  <Image src={dataFlow} alt="" />
                </div>
                <div className="dash-nexa-text">
                  <h3 className="fw-semi-bold text-xlarge mb-3">
                    Talk to your <br />
                    Data
                  </h3>
                  <p>
                    Enterprise Insights from your structured and unstructured
                    data using natural language.
                  </p>
                  <div className="d-flex gap-4 align-items-center">
                    <Button onClick={getStarted} variant="default p-0 chat-btn">
                      <Image src={aiIcon} alt="" />
                      Nexa
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Col>
          {/* Data Flow - End */}

          {/* New/Change Data Flows - Start */}
          <Col md={3}>
            <Card className="h-100 p-3">
              <Card.Body>
                <h3 className="fw-semi-bold text-xlarge mb-3">
                  New/Change <br />
                  Data Flows
                </h3>
                <p className="text-muted">
                  Build or modify your data pipelines for ingestion,
                  transformation, and delivery across curated zones.
                </p>
                <Button variant="primary">
                  <BiPencil />
                  Create/Edit Flow
                </Button>
              </Card.Body>
            </Card>
          </Col>
          {/* New/Change Data Flows - Start */}

          {/* Recent Changes - Start */}
          <Col md={3}>
            <RecentChanges />
          </Col>
          {/* Recent Changes - End */}
        </Row>
        <Row>
          {/* Data Assets - Start */}
          <Col md={4}>
            <DataAssets />
          </Col>
          {/* Data Assets - End */}

          {/* Executed Queries - Start */}
          <Col md={5}>
            <ExecutedQueries />
          </Col>
          {/* Executed Queries - End */}
          {/* Outbound Connectors - Start */}
          <Col md={3}>
            <OutboundConnectors />
          </Col>
          {/* Outbound Connectors - End */}
        </Row>
        <Row>
          {/* Recent Jobs - Start */}
          <Col md={9}>
            <RecentJobs />
          </Col>
          {/* Recent Jobs - Start */}
          {/* Top Active Agents - Start */}
          <Col md={3}>
            <TopActiveAgents />
          </Col>
          {/* Top Active Agents - End */}
        </Row>
      </div>
    </>
  );
};

export default Dashboard;
