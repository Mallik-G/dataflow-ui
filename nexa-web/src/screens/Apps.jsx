import React, { useState } from "react";
import { Button, Badge, Form, Row, Col, Card, Image } from "react-bootstrap";
import { BiTrash, BiSearch, BiPlus } from "react-icons/bi";
import axios from "axios";

function Apps() {
  const [data, setData] = useState([
    {
      id: 1,
      name: "Nexa",
      description: "AI-powered project management and task automation solution",
      status: true,
      updates: "Dec 15, 2023",
      playing: false,
      logo: "src/assets/nexa.png",
    },
    {
      id: 2,
      name: "CRM",
      description: "Interactive bot for accessing knowledge base",
      status: false,
      updates: "Oct 12, 2023",
      playing: true,
      logo: "src/assets/nexa.png",
    },
    {
      id: 3,
      name: "Fin Advisor",
      description: "Financial insights and guidance bot",
      status: true,
      updates: "Oct 5, 2023",
      playing: false,
      logo: "src/assets/nexa.png",
    },
    {
      id: 4,
      name: "Marketing Advisor",
      description: "Campaign optimization assistant",
      status: true,
      updates: "Oct 1, 2023",
      playing: false,
      logo: "src/assets/nexa.png",
    },
    {
      id: 5,
      name: "Sales Advisor",
      description: "Advanced sales advisor assistant",
      status: false,
      updates: "Oct 10, 2023",
      playing: true,
      logo: "src/assets/nexa.png",
    },
  ]);

  // const togglePlayPause = (id) => {
  //   setData((prevData) =>
  //     prevData.map((item) =>
  //       item.id === id ? { ...item, playing: !item.playing } : item
  //     )
  //   );
  // };

  return (
    <>
      <header className="d-flex justify-content-between align-items-center mb-2">
        <h1 className="h4 fw-medium m-0">Apps</h1>
        <div className="d-flex justify-content-between gap-2">
          <Form.Group className="filters-search">
            <Button variant="light">
              <BiSearch />
            </Button>
            <Form.Control
              className="bg-transparent"
              aria-label="Search"
              placeholder="Search by app name..."
            />
          </Form.Group>
        </div>
      </header>
      <p>Explore the apps integrated with your workspace</p>

      <Row>
        {data.map((item) => (
          <Col md={4} key={item.id} className="mb-4">
            <Card
              className="p-4 h-100 shadow-sm d-flex flex-column justify-content-between gap-5"
              border="0"
            >
              <div className="d-flex justify-content-between align-items-center">
                <h4 className="text-default text-large fw-medium m-0">
                  {item.name}
                </h4>
                <Badge pill bg={item.status ? "success" : "light"}>
                  {item.status ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="text-center">
                <Image src={item.logo} alt="" className="mb-4" />
                <p className="text-muted mb-2">{item.description}</p>
                <p className="text-muted small m-0">{`Last Updated: ${item.updates}`}</p>
              </div>

              <div className="d-flex gap-2 justify-content-between align-items-center">
                <Form.Check
                  type="switch"
                  checked={item.status ? "checked" : ""}
                  id={`app-switch${item.id}`}
                  label=""
                />

                {/* <Button
                  onClick={() => togglePlayPause(item.id)}
                  variant="default btn-icon"
                  size="sm"
                >
                  {item.playing ? <PiPauseBold /> : <PiPlayBold />}
                </Button> */}
                <Button variant="default btn-icon" size="sm" title="Delete">
                  <BiTrash />
                </Button>
              </div>
            </Card>
          </Col>
        ))}

        <Col md={4} className="mb-4">
          <Card className="p-4 h-100 shadow-sm d-flex flex-column justify-content-center gap-2 align-items-center add-app cursor-pointer">
            <span className="plus-icon">
              <BiPlus />
            </span>
            <span className="text-large fw-medium text-primary">
              Add New App
            </span>
          </Card>
        </Col>
      </Row>
    </>
  );
}

export default Apps;
