import { Card, Row, Col } from "react-bootstrap";
import { BiSolidCheckShield } from "react-icons/bi";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const data = {
  labels: ["PII", "Non-PII", "Unclassified"],
  datasets: [
    {
      label: "Votes",
      data: [35, 10, 55],
      backgroundColor: ["#2563eb", "#E8E8E8", "#F5F5F5"],
      borderColor: ["#2563eb", "#E8E8E8", "#F5F5F5"],
      borderWidth: 1,
      offset: 10,
      hoverOffset: 12,
    },
  ],
};
const options = {
  cutout: "70%",
  plugins: {
    tooltip: {
      callbacks: {
        label: function (tooltipItem) {
          const dataset = tooltipItem.dataset;
          const total = dataset.data.reduce((sum, val) => sum + val, 0);
          const value = dataset.data[tooltipItem.dataIndex];
          const percentage = ((value / total) * 100).toFixed(1);
          return `${tooltipItem.label}: ${percentage}%`;
        },
      },
    },
    legend: {
      display: false,
    },
  },
};

function DataAssets() {
  return (
    <>
      <Card className="h-100">
        <Card.Header className="d-flex align-items-center justify-content-between p-4 pb-0 bg-transparent border-0">
          <h5 className="fw-medium text-large m-0">Total Data Assets</h5>
          <div className="font-secondary d-flex gap-3 align-items-center">
            <span className="text-muted">PII Coverage</span>
            <div className="bg-light rounded px-2 py-1 d-inline-flex align-items-center gap-1">
              <i className="text-blue d-inline-flex">
                <BiSolidCheckShield />
              </i>
              PII
            </div>
          </div>
        </Card.Header>
        <Card.Body className="p-4 pb-3">
          <Row className="align-items-center">
            <Col md={6}>
              <Row className="gy-2">
                <Col className="d-grid font-secondary">
                  <span className="text-muted text-small">DB</span>
                  <div>
                    <span className="fs-5 me-2">12</span>
                    <span className="text-muted text-small">Databases</span>
                  </div>
                </Col>
                <Col className="d-grid font-secondary">
                  <span className="text-muted text-small">Schema</span>
                  <div>
                    <span className="fs-5 me-2">48</span>
                    <span className="text-muted text-small">Schemas</span>
                  </div>
                </Col>
                <Col className="d-grid font-secondary">
                  <span className="text-muted text-small">Tables</span>
                  <div>
                    <span className="fs-5 me-2">256</span>
                    <span className="text-muted text-small">Tables</span>
                  </div>
                </Col>
                <Col className="d-grid font-secondary">
                  <span className="text-muted text-small">Columns</span>
                  <div>
                    <span className="fs-5 me-2">1,842</span>
                    <span className="text-muted text-small">Columns</span>
                  </div>
                </Col>
              </Row>
            </Col>
            <Col md={6}>
              <div className="dash-doughnut">
                <Doughnut data={data} options={options} />
              </div>

              <div className="d-flex gap-4 justify-content-end dash-legend">
                <ul className="d-flex flex-wrap gap-2 text-small list-unstyled mt-4 mb-0">
                  <li>
                    <span
                      className="status"
                      style={{ background: "#2563eb" }}
                    ></span>
                    <span className="text-muted title">PII</span>
                    <span className="value">35%</span>
                  </li>
                  <li>
                    <span
                      className="status"
                      style={{ background: "#E8E8E8" }}
                    ></span>
                    <span className="text-muted title">Non-PII</span>
                    <span className="value">55%</span>
                  </li>
                  <li>
                    <span
                      className="status"
                      style={{ background: "#f5f5f5" }}
                    ></span>
                    <span className="text-muted title">Unclassified</span>
                    <span className="value">10%</span>
                  </li>
                </ul>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </>
  );
}

export default DataAssets;
