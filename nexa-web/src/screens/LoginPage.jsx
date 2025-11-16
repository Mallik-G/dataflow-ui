import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Image, Form, Button, Spinner, Alert } from "react-bootstrap";
import { FaMicrosoft } from 'react-icons/fa';
import icon from "../assets/databricks-icon.svg";
import imageIcon from "../assets/image-icon.svg";
import logo from "../assets/logo.svg";

const Login = ({ setIsAuthenticated, azureUser, onAuthStateChange }) => {
  if (!setIsAuthenticated) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Error: Authentication function not provided</h1>
        <p>Please refresh the page or contact support.</p>
      </div>
    );
  }
  
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [msalInstance, setMsalInstance] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const initializeMSAL = async () => {
      try {
        const { PublicClientApplication } = await import('@azure/msal-browser');
        const { msalConfig } = await import('../config/azureConfig');
        
        const instance = new PublicClientApplication(msalConfig);
        await instance.initialize();
        
        setMsalInstance(instance);
        
        const allAccounts = instance.getAllAccounts();
        setAccounts(allAccounts);
        
      } catch (error) {
      }
    };

    initializeMSAL();
  }, []);

  useEffect(() => {
    const savedAuth = localStorage.getItem("isAuthenticated");
    const authTimestamp = localStorage.getItem("authTimestamp");

    if (savedAuth === "true" && authTimestamp) {
      const now = new Date().getTime();
      const authTime = parseInt(authTimestamp);
      const hoursSinceAuth = (now - authTime) / (1000 * 60 * 60);

      if (hoursSinceAuth >= 24) {
        localStorage.removeItem("isAuthenticated");
        localStorage.removeItem("authTimestamp");
        localStorage.removeItem("azureUser");
        return;
      }

      navigate("/dashboard");
    }
  }, [navigate]);

  useEffect(() => {
    if (accounts.length > 0) {
      handleAzureLoginSuccess(accounts[0]);
    }
  }, [accounts]);

  const handleAzureLoginSuccess = (user) => {
    setIsAuthenticated(true);
    
    localStorage.setItem("isAuthenticated", "true");
    localStorage.setItem("authTimestamp", new Date().getTime().toString());
    localStorage.setItem("azureUser", JSON.stringify({
      name: user.name,
      username: user.username,
      localAccountId: user.localAccountId
    }));
    
    if (onAuthStateChange) {
      onAuthStateChange(true, {
        name: user.name,
        username: user.username,
        localAccountId: user.localAccountId
      });
    }
    
    navigate("/dashboard");
  };

  const handleAzureLoginError = (error) => {
    let errorMessage = 'An unknown error occurred during authentication';
    
    if (error.errorCode === 'user_cancelled') {
      errorMessage = 'User cancelled the login process';
    } else if (error.errorCode === 'network_error') {
      errorMessage = 'Network error occurred during authentication';
    } else if (error.errorMessage) {
      errorMessage = error.errorMessage;
    }
    
    setError(errorMessage);
  };

  const handleAzureLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (accounts.length > 0) {
        handleAzureLoginSuccess(accounts[0]);
        return;
      }

      let instance = msalInstance;
      
      if (!instance) {
        const { PublicClientApplication } = await import('@azure/msal-browser');
        const { msalConfig } = await import('../config/azureConfig');
        
        instance = new PublicClientApplication(msalConfig);
        await instance.initialize();
        setMsalInstance(instance);
      }

      const { loginRequest } = await import('../config/azureConfig');
      
      const loginResponse = await instance.loginPopup(loginRequest);
      
      const allAccounts = instance.getAllAccounts();
      setAccounts(allAccounts);
      
      handleAzureLoginSuccess(loginResponse.account);

    } catch (error) {
      handleAzureLoginError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAzureLogout = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      let instance = msalInstance;
      
      if (!instance) {
        setIsAuthenticated(false);
        localStorage.removeItem("isAuthenticated");
        localStorage.removeItem("authTimestamp");
        localStorage.removeItem("azureUser");
        setAccounts([]);
        
        if (onAuthStateChange) {
          onAuthStateChange(false, null);
        }
        return;
      }
      
      await instance.logoutPopup({
        postLogoutRedirectUri: window.location.origin,
        mainWindowRedirectUri: window.location.origin
      });
      
      setIsAuthenticated(false);
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("authTimestamp");
      localStorage.removeItem("azureUser");
      setAccounts([]);
      
      if (onAuthStateChange) {
        onAuthStateChange(false, null);
      }
      
    } catch (error) {
      setError('Logout failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = (e) => {
    e.preventDefault();
    if (email === "admin@gmail.com") {
      setIsAuthenticated(true);
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("authTimestamp", new Date().getTime().toString());
      localStorage.setItem("azureUser", JSON.stringify({
        name: "Admin User",
        username: "admin@gmail.com",
        localAccountId: "email-admin"
      }));
      
      if (onAuthStateChange) {
        onAuthStateChange(true, {
          name: "Admin User",
          username: "admin@gmail.com",
          localAccountId: "email-admin"
        });
      }
      
      navigate("/dashboard");
    } else {
      setError("Invalid credentials");
    }
  };

  return (
    <section className="h-100 app-login" style={{ minHeight: '100vh' }}>
      <div className="d-flex w-100 h-100">
        <div className="app-login-left">
          <Image className="app-login-logo" src={logo} alt="DR.ai Logo" />
          <div className="app-login-intro">
            <div className="text-center mb-5">
              <Image
                style={{ width: "100px" }}
                src={imageIcon}
                alt="Data Analytics Icon"
              />
            </div>
            <h3 className="fw-medium mb-4">
              Transform your data into actionable insights with AI-powered
              analytics
            </h3>
            <ul>
              <li>Transform raw data into actionable insights</li>
              <li>Automate data processing with AI-powered tools</li>
              <li>Secure and compliant data management</li>
              <li>Real-time analytics and reporting</li>
            </ul>
          </div>
        </div>
        <div className="app-login-right d-flex flex-column align-items-center justify-content-center">
          <Form
            onSubmit={handleEmailLogin}
            className="app-login-form d-grid gap-4"
          >
            <div className="app-login-title">
              <h2>Sign in to DR.ai</h2>
              <p>
                Transform your data into actionable insights with AI-powered
                analytics
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <Alert variant="danger">
                {error}
              </Alert>
            )}

            {/* Azure Login Section */}
            {accounts.length > 0 ? (
              <div>
                <div className="azure-user-info mb-3">
                  <div className="d-flex align-items-center">
                    <div className="azure-avatar me-2" style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: '#0078d4',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold'
                    }}>
                      {accounts[0].name ? accounts[0].name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <div className="fw-bold">{accounts[0].name || 'Azure User'}</div>
                      <div className="text-muted small">{accounts[0].username}</div>
                    </div>
                  </div>
                </div>
                
                <Button
                  variant="outline-danger"
                  size="lg"
                  className="w-100"
                  onClick={handleAzureLogout}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Spinner size="sm" className="me-2" />
                      Signing out...
                    </>
                  ) : (
                    <>
                      <FaMicrosoft className="me-2" />
                      Sign out from Azure
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div>
                <Button
                  variant="outline-primary"
                  size="lg"
                  className="w-100"
                  onClick={handleAzureLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Spinner size="sm" className="me-2" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <FaMicrosoft className="me-2" />
                      Continue with Microsoft Azure
                    </>
                  )}
                </Button>
              </div>
            )}

            <div className="or-seprator text-center">or</div>

            <Button variant="outline-secondary" size="lg" className="w-100">
              <Image src={icon} alt="" className="me-3"></Image>Continue with
              Databricks
            </Button>

            <div className="or-seprator text-center">or</div>

            <Form.Group>
              <Form.Control
                placeholder="Enter your Email ID"
                value={email}
                size="lg"
                onChange={(e) => setEmail(e.target.value)}
              ></Form.Control>
              <Form.Text className="d-block mt-3">
                By Continuing you agree to the{" "}
                <a href="#">Terms of Services</a> and DR.ai{" "}
                <a href="#">Privacy Notice</a>
              </Form.Text>
            </Form.Group>

            <Button
              type="submit"
              variant="primary"
              className="w-100 pill"
              size="lg"
            >
              Continue
            </Button>
          </Form>
        </div>
      </div>
    </section>
  );
};

export default Login;