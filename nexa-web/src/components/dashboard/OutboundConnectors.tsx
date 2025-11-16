import { Card, Image } from "react-bootstrap";
import { Link } from "react-router-dom";
import { BiCheckCircle, BiTime, BiXCircle } from "react-icons/bi";

function OutboundConnectors() {
  const obData = [
    {
      id: 1,
      title: "Kafka Connect",
      icon: "/src/assets/kafka.svg",
      status: true,
      log: "0h:25m 12/07/25",
    },
    {
      id: 2,
      title: "Online Store",
      icon: "/src/assets/online-store.svg",
      status: true,
      log: "2h:25m 12/07/25",
    },
    {
      id: 3,
      title: "Object Store",
      icon: "/src/assets/legacy-systems.svg",
      status: true,
      log: "1h:25m 12/07/25",
    },
    {
      id: 4,
      title: "Projections",
      icon: "/src/assets/projections.svg",
      status: false,
      log: "0h:25m 12/07/25",
    },
    {
      id: 3,
      title: "Data Bricks",
      icon: "/src/assets/databricks-icon.svg",
      status: true,
      log: "0h:25m 12/07/25",
    },
  ];
  return (
    <>
      <Card className="h-100 p-0">
        <Card.Header className="p-4 pb-0 bg-transparent border-0">
          <h3 className="fw-medium text-large">Outbound Connectors</h3>
        </Card.Header>
        <Card.Body className="p-4 ob">
          {obData.slice(0, 3).map((item) => (
            <div
              className="ob-item d-flex gap-3 align-items-center bg-light rounded p-3"
              key={item.id}
            >
              <div className="ob-item-icon">
                <Image src={item.icon} alt=""></Image>
              </div>
              <div className="w-100">
                <h5 className="ob-item-title fw-medium text-medium text-truncate m-0 w-100">
                  {item.title}
                </h5>
                <small className="text-muted align-items-center d-inline-flex gap-1">
                  <BiTime />
                  {item.log}
                </small>
              </div>

              <div className="ob-item-status fs-5">
                {item.status && item.status ? (
                  <BiCheckCircle color="green" />
                ) : (
                  <BiXCircle color="red" />
                )}
              </div>
            </div>
          ))}
        </Card.Body>
      </Card>
    </>
  );
}

export default OutboundConnectors;
