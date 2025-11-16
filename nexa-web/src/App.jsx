import React, { useEffect, useState } from "react";
import "./App.scss";
import "./scss/main.scss";
import "react-toastify/dist/ReactToastify.css";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ToastContainer } from "react-toastify";

import Dashboard from "./screens/DashboardPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./screens/LoginPage";
import Agents from "./screens/Agents";
import AiAssistant from "./screens/AiAssistant";
import Alerts from "./screens/Alerts";
import Apps from "./screens/Apps";
import BatchProjectionsPage from "./screens/BatchProjectionsPage";
import BatchProjectionsSettingsPage from "./screens/BatchProjectionsSettingsPage";
import BusinessGlossary from "./screens/BusinessGlossary";
import CanvasPage from "./screens/CanvasPage";
import CanvasPageGold from "./screens/CanvasPageGold";
import Connectors from "./screens/Connectors";
import Connections from "./screens/Connections";
import CuratedLandingZonePage from "./screens/CuratedLandingZonePage";
import DataFlow from "./screens/DataFlow";
import Deploy from "./screens/Deploy";
import EditEntityMappingsPage from "./screens/EditEntityMappingsPage";
import EditGoldEntityMappingsPage from "./screens/EditGoldEntityMappingsPage";
import GoldLandingPage from "./screens/GoldLandingPage";
import HomePage from "./screens/HomePage";
import Jobs from "./screens/Jobs";
import Observe from "./screens/Observe";
import Pipelines from "./screens/Pipelines";
import Projections from "./screens/Projections";
import Promotions from "./screens/Promotions";
import RegisterPage from "./screens/RegisterPage";
import Settings from "./screens/Settings";
import UsageCosts from "./screens/UsageCosts";
import WelcomeDemoPage from "./screens/WelcomeDemoPage";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
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
        return false;
      }

      return true;
    }

    return false;
  });

  const [azureUser, setAzureUser] = useState(() => {
    const savedUser = localStorage.getItem("azureUser");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleAuthStateChange = (isAuth, user) => {
    setIsAuthenticated(isAuth);
    if (isAuth && user) {
      setAzureUser(user);
    } else {
      setAzureUser(null);
    }
  };

  return (
    <Router>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <Routes>
        <Route 
          path="/login" 
          element={
            <Login 
              setIsAuthenticated={setIsAuthenticated} 
              azureUser={azureUser}
              onAuthStateChange={handleAuthStateChange}
            />
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/agents" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <Agents />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/ai-assistant" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <AiAssistant />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/alerts" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <Alerts />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/apps" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <Apps />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/batch-projections" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <BatchProjectionsPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/batch-projections-settings" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <BatchProjectionsSettingsPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/business-glossary" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <BusinessGlossary />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/canvas" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <CanvasPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/canvas-gold" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <CanvasPageGold />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/connectors" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <Connectors />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/curated-landing-zone" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <CuratedLandingZonePage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/data-flow" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <DataFlow />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/edit-entity-mappings" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <EditEntityMappingsPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/edit-gold-entity-mappings" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <EditGoldEntityMappingsPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/gold-landing" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <GoldLandingPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/home" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <HomePage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/jobs" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <Jobs />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route
          path="/projections"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <Projections />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/deploy"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <Deploy />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/promotions"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <Promotions />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/observe"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <Observe />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pipelines"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <Pipelines />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/connections"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <Connections />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/register"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <RegisterPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <Settings />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/usage-costs" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <UsageCosts />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/consumption_landing_page" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <GoldLandingPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/welcome-demo" 
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout setIsAuthenticated={setIsAuthenticated}>
                <WelcomeDemoPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;