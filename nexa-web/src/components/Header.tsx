import React, { useState, useEffect } from "react";
import { Button, Dropdown, Image } from "react-bootstrap";
import { BiCog, BiChevronLeft, BiBell } from "react-icons/bi";
import { useNavigate } from "react-router-dom";
import Chatbot from "./Chatbot";

function Header({ setIsAuthenticated }) {
  const [isOpen, setIsOpen] = useState(false);

  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("authTimestamp");
    setIsAuthenticated(false);
    navigate("/login");
  };
  const handleSettings = () => {
    navigate("/settings");
  };

  const handleCollapseBtn = () => {
    setIsOpen(!isOpen);
    document.body.classList.toggle("sidebar-collapse");
  };

  const userData = {
    name: "Majid Equbal",
    role: "Administrator",
    avatar:
      "https://t4.ftcdn.net/jpg/04/31/64/75/360_F_431647519_usrbQ8Z983hTYe8zgA7t1XVc5fEtqcpa.jpg",
  };

  const getNameTrim = (fullName) => {
    return fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };
  const nameTrim = getNameTrim(userData.name);

  return (
    <>
      <header className="app-header gap-4 d-flex justify-content-between align-items-center">
        <Button
          variant="outline-secondary"
          className="app-collapse-btn"
          onClick={handleCollapseBtn}
        >
          <BiChevronLeft />
        </Button>

        {location.pathname === "/dashboard" && (
          <h3 className="app-header-title">Welcome Back {userData.name},</h3>
        )}

        <div className="app-header-auth d-flex align-items-center gap-3 ms-auto">
          {location.pathname !== "/dashboard" && <Chatbot />}

          <Button
            variant="default btn-icon"
            aria-label="Notification"
            role="button"
            type="button"
            title="Notification"
          >
            <BiBell />
            <i className="status-badge" role="img" aria-label="available"></i>
          </Button>
          <Button
            variant="default btn-icon"
            aria-label="Settings"
            role="button"
            type="button"
            title="Settings"
            onClick={handleSettings}
          >
            <BiCog />
          </Button>

          <Dropdown className="active-user ms-2">
            <Dropdown.Toggle variant="default" title={userData.name}>
              {userData.avatar ? (
                <Image
                  src={userData.avatar}
                  alt={userData.name}
                  roundedCircle
                />
              ) : (
                <span role="user" aria-label={userData.role}>
                  {nameTrim}
                </span>
              )}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item href="#/action-1">My Profile</Dropdown.Item>
              <Dropdown.Item href="#/action-2">Notification</Dropdown.Item>
              <Dropdown.Item href="#/action-3" onClick={handleLogout}>
                Logout
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </header>
    </>
  );
}

export default Header;
