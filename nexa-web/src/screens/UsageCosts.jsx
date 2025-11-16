import React, { useState } from "react";
import { Button, Row, Col, Form, Card } from "react-bootstrap";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function UsageCosts() {
  const [view, setView] = useState("units");

  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const unitsValues = {
    Jobs: [2500, 1200, 7000, 4600, 4800, 7500, 2100],
    Apps: [1000, 2400, 3500, 5500, 3800, 5300, 3500],
    Agents: [9900, 2400, 3000, 3500, 3600, 3800, 3500],
    LLMs: [4500, 5500, 4300, 1200, 6800, 3500, 2500],
  };

  const costsValues = {
    Jobs: [9500, 5200, 2000, 2600, 2800, 3500, 1100],
    Apps: [3400, 2200, 3100, 7500, 6800, 2300, 1500],
    Agents: [1000, 1400, 1000, 2500, 3600, 2800, 1500],
    LLMs: [4500, 1500, 1300, 4200, 2200, 2500, 1500],
  };

  const datasetConfig = [
    { label: "Jobs", borderColor: "#6B7280", backgroundColor: "#fff" },
    { label: "Apps", borderColor: "#3B82F6", backgroundColor: "#3B82F6" },
    { label: "Agents", borderColor: "#10B981", backgroundColor: "#10B981" },
    { label: "LLMs", borderColor: "#8B5CF6", backgroundColor: "#8B5CF6" },
  ];

  const activeValues = view === "units" ? unitsValues : costsValues;

  // Chart Data

  const data = {
    labels,
    datasets: datasetConfig.map((cfg) => ({
      ...cfg,
      data: activeValues[cfg.label],
      borderWidth: 2,
      tension: 0.4,
      fill: true,
      pointRadius: 0,
      pointHoverRadius: 6,
    })),
  };

  const legendMargin = {
    id: "legendMargin",
    beforeInit(chart) {
      const fitValue = chart.legend.fit;
      chart.legend.fit = function fit() {
        fitValue.bind(chart.legend)();
        this.height += 20; // 👈 add extra gap in px
      };
    },
  };

  const options = {
    responsive: true,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        position: "top",
        align: "start",
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          boxHeight: 8,
          padding: 20,
        },
      },
      tooltip: {
        enabled: true,
      },
      title: {
        display: false,
      },
    },
  };
  return (
    <>
      <header className="mb-4">
        <h1 className="h4 fw-medium mb-2">Usage &amp; Costs</h1>
        <p>
          Track daily usage patterns and cost distribution across your data
          assets.
        </p>
      </header>

      <Row>
        <Col md={8}>
          <Card className="rounded-4 p-4">
            <Card.Header className="bg-transparent border-0 d-flex align-items-center justify-content-between p-0">
              <div className="d-flex gap-2">
                <Form.Group>
                  <Form.Select>
                    <option value="">Weekly</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group>
                  <Form.Select>
                    <option value="">Filter by Workspace</option>
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="bg-light rounded p-2">
                <Button
                  variant={view === "units" ? "primary" : "default"}
                  onClick={() => setView("units")}
                >
                  Daily Units
                </Button>
                <Button
                  onClick={() => setView("costs")}
                  variant={view === "costs" ? "primary" : "default"}
                >
                  Daily Cost
                </Button>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              <Line data={data} options={options} plugins={[legendMargin]} />
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <div className="rounded-4 bg-white p-4 border mb-3">
            <h4 className="text-large text-muted fw-medium">Avg Daily Units</h4>
            <p className="fs-1 fw-bold text-black">2,847</p>
            <p className="text-success m-0">+12.5% from last week</p>
          </div>
          <div className="rounded-4 bg-white p-4 border">
            <h4 className="text-large text-muted fw-medium">Avg Daily Costs</h4>
            <p className="fs-1 fw-bold text-black">$1,247.50</p>
            <p className="text-danger m-0">+8.3% from last week</p>
          </div>
        </Col>
      </Row>
    </>
  );
}

export default UsageCosts;
