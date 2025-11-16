import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Nav, Image } from "react-bootstrap";
import logo from "../assets/logo.svg";
import logo_white from "../assets/logo-white.svg";
import logoIcon from "../assets/logo-icon.svg";
import logoIcon_white from "../assets/logo-icon-white.svg";
import {
  BiGridAlt,
  BiLayer,
  BiBarChart,
  BiBell,
  BiGroup,
  BiGitRepoForked,
  BiListUl,
  BiData,
  BiBookOpen,
  BiDialpadAlt,
  BiSun,
  BiBarChartSquare,
  BiMoon,
} from "react-icons/bi";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const handleCollapseBtn = () => {
    setIsOpen(!isOpen);
    document.body.classList.toggle("sidebar-collapse");
  };
  const isActive = (path) => location.pathname === path;

  // Theme change
  let clickedClass = "clicked";
  const root = document.documentElement; // instead of body
  const lightTheme = "light";
  const darkTheme = "dark";
  let theme;

  // Read saved theme
  if (localStorage) {
    theme = localStorage.getItem("theme");
  }

  // Apply theme to <html data-theme="">
  if (theme === lightTheme || theme === darkTheme) {
    root.setAttribute("data-theme", theme);
  } else {
    root.setAttribute("data-theme", lightTheme);
  }

  // Toggle theme
  const switchTheme = (e) => {
    if (theme === darkTheme) {
      root.setAttribute("data-theme", lightTheme);
      e.target.classList.remove(clickedClass);
      localStorage.setItem("theme", "light");
      theme = lightTheme;
    } else {
      root.setAttribute("data-theme", darkTheme);
      e.target.classList.add(clickedClass);
      localStorage.setItem("theme", "dark");
      theme = darkTheme;
    }
  };

  return (
    <>
      <aside className="app-sidebar">
        <Link className="app-sidebar-logo" to="/dashboard">
          {theme === "light" ? (
            <>
              <Image src={logo} className="is-logo" alt="" />
              <Image src={logoIcon} className="is-icon" alt="" />
            </>
          ) : (
            <>
              <Image src={logo_white} className="is-logo" alt="" />
              <Image src={logoIcon_white} className="is-icon" alt="" />
            </>
          )}
        </Link>
        <div className="app-sidebar-nav">
          <Nav className="flex-column">
            <Link
              to="/dashboard"
              className={`nav-link ${isActive("/dashboard") ? "active" : ""}`}
            >
              <span className="nav-link-icon">
                <BiGridAlt />
              </span>
              <span className="nav-link-text">Dashboard</span>
            </Link>
            <Link
              to="/data-flow"
              className={`nav-link ${
                isActive("/curated_landing_zone") ? "active" : ""
              }`}
            >
              <span className="nav-link-icon">
                <BiLayer />
              </span>
              <span className="nav-link-text">Data Flow</span>
            </Link>
            <Link
              to="/consumption_landing_page"
              className={`nav-link ${
                isActive("/consumption_landing_page") ? "active" : ""
              }`}
            >
              <span className="nav-link-icon">
                <BiGitRepoForked />
              </span>
              <span className="nav-link-text">Canvas</span>
            </Link>
            <Link
              to="/jobs"
              className={`nav-link ${isActive("/jobs") ? "active" : ""}`}
            >
              <span className="nav-link-icon">
                <BiListUl />
              </span>
              <span className="nav-link-text">Jobs</span>
            </Link>
            <Link
              to="/connectors"
              className={`nav-link ${isActive("/connectors") ? "active" : ""}`}
            >
              <span className="nav-link-icon">
                <BiData />
              </span>
              <span className="nav-link-text">Connectors</span>
            </Link>
            <Link
              to="/projections"
              className={`nav-link ${isActive("/projections") ? "active" : ""}`}
            >
              <span className="nav-link-icon">
                <BiBarChartSquare />
              </span>
              <span className="nav-link-text">Projections</span>
            </Link>

            <Link
              to="/business-glossary"
              className={`nav-link ${
                isActive("/business-glossary") ? "active" : ""
              }`}
            >
              <span className="nav-link-icon">
                <BiBookOpen />
              </span>
              <span className="nav-link-text">Business Glossary</span>
            </Link>
            <Link
              to="/agents"
              className={`nav-link ${isActive("/agents") ? "active" : ""}`}
            >
              <span className="nav-link-icon">
                <BiGroup />
              </span>
              <span className="nav-link-text">Agents</span>
            </Link>

            <Link
              to="/apps"
              className={`nav-link ${isActive("/apps") ? "active" : ""}`}
            >
              <span className="nav-link-icon">
                <BiDialpadAlt />
              </span>
              <span className="nav-link-text">Apps</span>
            </Link>
            <Link
              to="/usage-costs"
              className={`nav-link ${isActive("/usage-costs") ? "active" : ""}`}
            >
              <span className="nav-link-icon">
                <BiBarChart />
              </span>
              <span className="nav-link-text">Usage &amp; Costs</span>
            </Link>
            {/* <Link
              to="/alerts"
              className={`nav-link ${isActive("/alerts") ? "active" : ""}`}
            >
              <span className="nav-link-icon">
                <BiBell />
              </span>
              <span className="nav-link-text">Alerts</span>
            </Link> */}
          </Nav>
          <div className="toggle-overlay" onClick={handleCollapseBtn}>
            &nbsp;
          </div>
        </div>
        <div className="w-100">
          <Link className="app-sidebar-theme" onClick={(e) => switchTheme(e)}>
            <span className="icon">
              {theme === "light" ? <BiSun /> : <BiMoon />}
            </span>
            <span className="text">
              {theme === "light" ? "Light" : "Dark"} Theme
            </span>
          </Link>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
