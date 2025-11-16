import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

function BatchProjectionsSettingsPage() {
  const navigate = useNavigate();
  const [savedSettings, setSavedSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState("");

  useEffect(() => {
    loadAllSavedSettings();
  }, []);

  const loadAllSavedSettings = () => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("batchProjectionSettings") || "[]"
      );
      setSavedSettings(saved);
      console.log("Loaded all saved settings:", saved);
    } catch (err) {
      console.error("Error loading saved settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const deleteSetting = (settingId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this saved configuration?"
      )
    ) {
      const updatedSettings = savedSettings.filter((s) => s.id !== settingId);
      setSavedSettings(updatedSettings);
      localStorage.setItem(
        "batchProjectionSettings",
        JSON.stringify(updatedSettings)
      );
      alert("Configuration deleted successfully!");
    }
  };

  const loadSetting = (setting) => {
    // Navigate to the batch projections page with the setting loaded
    navigate(`/batch-projections/${encodeURIComponent(setting.entityName)}`, {
      state: { loadSetting: setting },
    });
  };

  const getFilteredSettings = () => {
    if (!filterEntity) return savedSettings;
    return savedSettings.filter((setting) =>
      setting.entityName.toLowerCase().includes(filterEntity.toLowerCase())
    );
  };

  const getUniqueEntities = () => {
    const entities = [...new Set(savedSettings.map((s) => s.entityName))];
    return entities.sort();
  };

  if (loading) {
    return (
      <div className="batch-projections-settings-page">
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ color: "#7366ff", fontWeight: 500, fontSize: 18 }}>
            Loading saved settings...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="batch-projections-settings-page">
      <div className="bps-header">
        <h2 className="bps-title">Batch Projection Settings</h2>
        <p className="bps-subtitle">
          Manage all your saved batch projection configurations
        </p>
      </div>

      {/* Statistics */}
      <div className="bps-stats">
        <div className="bps-stat-card">
          <div className="bps-stat-number">{savedSettings.length}</div>
          <div className="bps-stat-label">Total Configurations</div>
        </div>
        <div className="bps-stat-card">
          <div className="bps-stat-number">{getUniqueEntities().length}</div>
          <div className="bps-stat-label">Unique Entities</div>
        </div>
        <div className="bps-stat-card">
          <div className="bps-stat-number">
            {savedSettings.filter((s) => s.status === "active").length}
          </div>
          <div className="bps-stat-label">Active Configurations</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bps-filters">
        <div className="bps-filter-group">
          <label>Filter by Entity:</label>
          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
          >
            <option value="">All Entities</option>
            {getUniqueEntities().map((entity) => (
              <option key={entity} value={entity}>
                {entity}
              </option>
            ))}
          </select>
        </div>
        <div className="bps-filter-group">
          <label>Sort by:</label>
          <select
            onChange={(e) => {
              const sorted = [...savedSettings].sort((a, b) => {
                if (e.target.value === "date") {
                  return new Date(b.createdAt) - new Date(a.createdAt);
                } else if (e.target.value === "entity") {
                  return a.entityName.localeCompare(b.entityName);
                }
                return 0;
              });
              setSavedSettings(sorted);
            }}
          >
            <option value="date">Date Created</option>
            <option value="entity">Entity Name</option>
          </select>
        </div>
      </div>

      {/* Settings List */}
      <div className="bps-content">
        {getFilteredSettings().length === 0 ? (
          <div className="bps-empty-state">
            <div className="bps-empty-icon">📊</div>
            <h3>No Saved Configurations</h3>
            <p>
              {filterEntity
                ? `No configurations found for "${filterEntity}"`
                : "You haven't saved any batch projection configurations yet."}
            </p>
            <button
              className="hero-btn primary"
              onClick={() => navigate("/consumption_landing_page")}
            >
              Go to Consumption Files
            </button>
          </div>
        ) : (
          <div className="bps-settings-grid">
            {getFilteredSettings().map((setting, index) => (
              <div key={setting.id} className="bps-setting-card">
                <div className="bps-setting-header">
                  <div className="bps-setting-title">
                    <h4>{setting.entityName}</h4>
                    <span className={`bps-setting-status ${setting.status}`}>
                      {setting.status}
                    </span>
                  </div>
                  <div className="bps-setting-date">
                    {new Date(setting.createdAt).toLocaleDateString()} at{" "}
                    {new Date(setting.createdAt).toLocaleTimeString()}
                  </div>
                </div>

                <div className="bps-setting-details">
                  <div className="bps-setting-section">
                    <h5>📅 Schedule</h5>
                    <p>
                      {setting.schedule.frequency} at{" "}
                      {setting.schedule.startTime} ({setting.schedule.timeZone})
                    </p>
                  </div>

                  <div className="bps-setting-section">
                    <h5>📤 Output</h5>
                    <p>
                      {setting.output.format} with {setting.output.compression}{" "}
                      compression
                    </p>
                  </div>

                  <div className="bps-setting-section">
                    <h5>
                      🏷️ Entities (
                      {Object.keys(setting.selectedEntities).length})
                    </h5>
                    <div className="bps-entities-list">
                      {Object.keys(setting.selectedEntities).map((entity) => (
                        <span key={entity} className="bps-entity-tag">
                          {entity}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bps-setting-section">
                    <h5>📊 Attributes</h5>
                    <div className="bps-attributes-summary">
                      {Object.entries(setting.selectedEntities).map(
                        ([entity, data]) => (
                          <div key={entity} className="bps-attribute-item">
                            <strong>{entity}:</strong> {data.attributes.length}{" "}
                            attributes
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div className="bps-setting-actions">
                  <button
                    className="hero-btn primary"
                    onClick={() => loadSetting(setting)}
                  >
                    📝 Edit Configuration
                  </button>
                  <button
                    className="hero-btn secondary"
                    onClick={() => {
                      // Copy configuration to clipboard
                      navigator.clipboard.writeText(
                        JSON.stringify(setting, null, 2)
                      );
                      alert("Configuration copied to clipboard!");
                    }}
                  >
                    📋 Copy JSON
                  </button>
                  <button
                    className="hero-btn danger"
                    onClick={() => deleteSetting(setting.id)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bps-actions">
        <button className="hero-btn primary" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <button
          className="hero-btn secondary"
          onClick={() => {
            if (
              window.confirm(
                "Are you sure you want to delete ALL saved configurations? This cannot be undone."
              )
            ) {
              localStorage.removeItem("batchProjectionSettings");
              setSavedSettings([]);
              alert("All configurations deleted successfully!");
            }
          }}
        >
          🗑️ Clear All Settings
        </button>
      </div>
    </div>
  );
}

export default BatchProjectionsSettingsPage;
