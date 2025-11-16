import React from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

const Layout = ({ children, setIsAuthenticated }) => {
  return (
    <main className="app">
      <Sidebar />
      <section className="app-wrapper">
        <Header setIsAuthenticated={setIsAuthenticated} />
        <div className="app-container">{children}</div>
      </section>
    </main>
  );
};

export default Layout;
