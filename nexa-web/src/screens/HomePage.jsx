import { useNavigate } from "react-router-dom";
import { useState } from "react";

function HomePage() {
  const navigate = useNavigate();
  const [isSignedIn, setIsSignedIn] = useState(false);

  const handleSignIn = () => setIsSignedIn(true);
  const handleSignOut = () => setIsSignedIn(false);

  return (
    <main className="main-content home-hero">
      <div className="hero-center-logo">
        <div className="hero-logo-circle">
          <span className="logo-text">DR</span>
        </div>
      </div>
      <h1 className="hero-title">Reclaim the Value of Your Data</h1>
      <p className="hero-desc">
        Today, there is value destruction in the data industry with data
        activation and consumption needing significant time and investments. The
        opportunity costs are too high, dependency on certain skills is
        limiting, and value from data is coming in too late. <br />
        <br />
        We want to change that.
        <br />
        <br />
        In an overly complex data landscape, everyone from cloud vendors,
        product partners, and System Integrators are benefiting with Customer
        coming last. <b>We want the Customer back on top of the value chain.</b>
      </p>
      <div className="hero-actions">
        <button
          className="hero-btn primary"
          onClick={() => navigate("/welcome_demo")}
        >
          Experience DR.ai
        </button>
        <span className="or">or</span>
        <a href="#demo" className="hero-btn secondary">
          Learn More →
        </a>
      </div>
      <div style={{ marginTop: "2rem" }}>
        {!isSignedIn ? (
          <button
            className="hero-btn secondary"
            style={{
              background: "#fff",
              color: "#7366ff",
              border: "2px solid #7366ff",
            }}
            onClick={handleSignIn}
          >
            Sign In
          </button>
        ) : (
          <button
            className="hero-btn secondary"
            style={{
              background: "#fff",
              color: "#ff6bcb",
              border: "2px solid #ff6bcb",
            }}
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        )}
      </div>
    </main>
  );
}

export default HomePage;
