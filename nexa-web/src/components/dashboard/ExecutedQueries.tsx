import {
  Card,
  Row,
  Col,
  Badge,
  Image,
  OverlayTrigger,
  Tooltip,
  Button,
} from "react-bootstrap";
import { BiBarChart, BiTime, BiUser } from "react-icons/bi";

function ExecutedQueries() {
  const queryData = [
    {
      id: 1,
      title: "Daily Revenue Report",
      time: "3h:14m:25s",
      class: "text-danger",
      info: "Destination in the target system where data will be written.",
    },
    {
      id: 2,
      title: "User Activity Analysis",
      time: "0h:25m:59s",
      class: "text-default",
      info: "Destination in the target system where data will be written",
    },
    {
      id: 3,
      title: "Inventory Status Check",
      time: "1h:40m:01s",
      class: "text-default",
      info: "Destination in the target system where data will be written.",
    },
  ];
  const activeUserData = [
    {
      id: 1,
      title: "Sarah Johnson",
      designation: "Data Analyst",
      image: "/src/assets/user-1.jpg",
    },
    {
      id: 2,
      title: "Michael Chen",
      designation: "Business Intelligence",
      image: "",
    },
    {
      id: 3,
      title: "Emily Rodriguez",
      designation: "Product Manager",
      image: "",
    },
  ];

  return (
    <>
      <Card className="h-100 p-0">
        <Row className="h-100">
          <Col md={12}>
            <Card className="h-100" border="0">
              <Card.Header className="p-4 pb-0 bg-transparent border-0">
                <h5 className="fw-medium text-large m-0 d-flex align-items-center gap-1">
                  <span className="fs-5 opacity-50">
                    <BiBarChart />
                  </span>
                  Executed Queries Time Taken
                </h5>
              </Card.Header>
              <Card.Body className="p-4 query-list d-flex flex-column justify-content-between gap-3 h-100">
                {queryData.slice(0, 3).map((item, index) => (
                  <div
                    className={`query-item justify-content-between d-flex ${item.class}`}
                    key={item.id}
                  >
                    <div className="flex-fill">
                      <h5 className="m-0 fw-medium query-item-title text-medium">
                        {item.title}
                      </h5>
                      <p className="m-0 query-item-time text-small">
                        <BiTime /> {item.time}
                      </p>
                    </div>
                    <OverlayTrigger
                      placement="right"
                      overlay={<Tooltip>{item.info}</Tooltip>}
                    >
                      <Button variant="outline-secondary btn-icon-info">
                        !
                      </Button>
                    </OverlayTrigger>
                  </div>
                ))}
              </Card.Body>
            </Card>
          </Col>
          {/* <Col md={6}>
            <Card className="h-100" border="0">
              <Card.Header className="p-4 pb-0 bg-transparent border-0">
                <h5 className="fw-medium fs-6 m-0 d-flex align-items-center gap-1">
                  <span className="fs-5 opacity-50">
                    <BiUser />
                  </span>
                  Top Active Users
                </h5>
              </Card.Header>
              <Card.Body className="p-4 d-flex flex-column justify-content-between gap-3 h-100">
                {activeUserData.slice(0, 3).map((item) => {
                  const titleParts = item.title.split(" ");
                  const initials =
                    (titleParts[0]?.[0] || "") + (titleParts[1]?.[0] || "");

                  return (
                    <div
                      className="persona d-flex align-items-start gap-3"
                      key={item.id}
                    >
                      <div className="persona-img d-flex align-items-center justify-content-center">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt=""
                            className="w-100 h-100 rounded-circle object-fit-cover"
                          />
                        ) : (
                          <span className="text-small fw-medium">
                            {initials.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="persona-text">
                        <h5 className="text-large fw-medium m-0">
                          {item.title}
                        </h5>
                        <Badge bg="light" text="dark" className="fw-normal">
                          {item.designation}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </Card.Body>
            </Card>
          </Col> */}
        </Row>
      </Card>
    </>
  );
}

export default ExecutedQueries;
