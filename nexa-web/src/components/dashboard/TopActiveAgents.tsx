import { Card, Badge } from "react-bootstrap";
import { Link } from "react-router-dom";

function TopActiveAgents() {
  const obData = [
    {
      id: 1,
      title: "Nexa Agent",
      user: "Sarah Johnson",
    },
    {
      id: 2,
      title: "Finance Assistant",
      user: "Michael Chens",
    },
    {
      id: 3,
      title: "Sales Assistant",
      user: "Emily Rodriguez",
    },
    {
      id: 4,
      title: "Sales Assistant",
      user: "David Warner",
    },
  ];
  return (
    <>
      <Card className="h-100 p-0">
        <Card.Header className="p-4 pb-0 bg-transparent border-0">
          <h3 className="fw-medium text-large">Top Active Agents</h3>
        </Card.Header>
        <Card.Body className="p-4 d-flex flex-column gap-3">
          {obData.slice(0, 4).map((item) => (
            <div className="ob-item" key={item.id}>
              <h5 className="text-primary fw-medium text-large text-truncate mb-1">
                {item.title}
              </h5>
              <Badge pill bg="light">
                Active User: {item.user}
              </Badge>
            </div>
          ))}
        </Card.Body>
      </Card>
    </>
  );
}

export default TopActiveAgents;
