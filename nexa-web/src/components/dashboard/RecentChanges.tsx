import { Card } from "react-bootstrap";
import { BiTime } from "react-icons/bi";
import { Link } from "react-router-dom";

function RecentChanges() {
  const recentData = [
    {
      id: 1,
      title: "New Column added to",
      type: "Customer Entity",
      time: "2h",
      url: "https://www.google.com",
    },
    {
      id: 2,
      title: "Entity Mappings changed in",
      type: "Customer Entity",
      time: "1h",
      url: "https://www.google.com",
    },
    {
      id: 3,
      title: "Entity Mappings changed in",
      type: "Customer Entity",
      time: "1h",
      url: "https://www.google.com",
    },
  ];

  return (
    <>
      <Card className="h-100 p-0">
        <Card.Header className="d-flex justify-content-between p-3 pb-0 bg-transparent border-0">
          <h5 className="fw-medium text-large">Recent Changes</h5>
          <Link className="fw-medium text-decoration-none" to="/">
            View All
          </Link>
        </Card.Header>
        <Card.Body className="p-3 fw-medium">
          {recentData.slice(0, 2).map((item, index) => (
            <div
              className={`item rounded p-3 ${
                index % 2 === 0 ? "bg-light" : ""
              }`}
              key={item.id}
            >
              <p className="mb-2">
                {item.title} <br />
                <u>{item.type}</u>
              </p>
              <div className="text-muted d-flex align-items-center gap-2">
                <span className="icon d-inline-flex align-items-center">
                  <BiTime />
                </span>
                <small className="text">{item.time} ago</small>
              </div>
            </div>
          ))}
        </Card.Body>
      </Card>
    </>
  );
}

export default RecentChanges;
