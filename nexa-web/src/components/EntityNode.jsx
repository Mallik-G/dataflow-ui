import { useState } from "react";
import { Handle, Position } from "react-flow-renderer";

function EntityNode({ id, data, selected, isConnectable }) {
  const [editing, setEditing] = useState(false);
  const [entityName, setEntityName] = useState(data.label);
  const [attributes, setAttributes] = useState(data.attributes || []);
  const [newAttr, setNewAttr] = useState("");
  const [newType, setNewType] = useState("string");
  const [scdType2, setSCDType2] = useState(data.scdType2 || false);

  // Add attribute
  const addAttr = () => {
    if (!newAttr.trim()) return;
    setAttributes((attrs) => [
      ...attrs,
      { name: newAttr, type: newType, isNew: true },
    ]);
    setNewAttr("");
    setNewType("string");
    data.onUpdate(
      id,
      entityName,
      [...attributes, { name: newAttr, type: newType, isNew: true }],
      true,
      scdType2
    );
  };

  // Remove attribute
  const removeAttr = (idx) => {
    const updated = attributes.filter((_, i) => i !== idx);
    setAttributes(updated);
    data.onUpdate(id, entityName, updated, true, scdType2);
  };

  // Save entity name
  const saveName = () => {
    setEditing(false);
    data.onUpdate(id, entityName, attributes, true, scdType2);
  };

  // Toggle SCD Type 2
  const toggleSCDType2 = () => {
    setSCDType2((val) => {
      data.onUpdate(id, entityName, attributes, true, !val);
      return !val;
    });
  };

  return (
    <div
      style={{
        background: data.isNewOrUpdated ? "#fff0fa" : "#f7f6ff",
        border: `2px solid ${data.isNewOrUpdated ? "#ff6bcb" : "#7366ff"}`,
        borderRadius: 12,
        padding: 15,
        minWidth: 200,
        maxWidth: 250,
        fontSize: 13,
        boxShadow: selected
          ? "0 0 0 2px #ff6bcb"
          : "0 4px 16px rgba(115,102,255,0.12)",
        position: "relative",
        transition: "all 0.2s ease",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: "#7366ff",
          width: 8,
          height: 8,
          border: "2px solid #fff",
          boxShadow: "0 0 0 2px #7366ff",
        }}
        isConnectable={isConnectable}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 8,
          justifyContent: "space-between",
          borderBottom: "2px solid rgba(115,102,255,0.1)",
          paddingBottom: 8,
        }}
      >
        {editing ? (
          <>
            <input
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              style={{
                fontWeight: 700,
                fontSize: 14,
                width: "80%",
                border: "2px solid #7366ff",
                borderRadius: 6,
                padding: "4px 8px",
                outline: "none",
              }}
              autoFocus
            />
            <button
              style={{
                marginLeft: 6,
                background: "#7366ff",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "4px 8px",
                cursor: "pointer",
              }}
              onClick={saveName}
            >
              Save
            </button>
          </>
        ) : (
          <>
            <span
              style={{
                fontWeight: 900,
                color: data.isNewOrUpdated ? "#ff6bcb" : "#7366ff",
                fontSize: 14,
              }}
            >
              {entityName}
            </span>
            <button
              style={{
                fontSize: 11,
                marginLeft: 6,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#7366ff",
              }}
              onClick={() => setEditing(true)}
            >
              ✏️
            </button>
          </>
        )}
        <button
          style={{
            marginLeft: 8,
            background: scdType2 ? "#ff6bcb" : "#eee",
            color: scdType2 ? "#fff" : "#7366ff",
            border: "none",
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          title="Mark as SCD Type 2"
          onClick={toggleSCDType2}
        >
          {scdType2 ? "SCD Type 2" : "Mark SCD2"}
        </button>
      </div>
      {scdType2 && (
        <div
          style={{
            color: "#ff6bcb",
            fontWeight: 900,
            fontSize: 12,
            marginBottom: 8,
            background: "#fff0fa",
            padding: "4px 8px",
            borderRadius: 6,
            display: "inline-block",
          }}
        >
          SCD Type 2
        </div>
      )}
      <div
        style={{
          fontWeight: 700,
          color: "#888",
          fontSize: 12,
          marginBottom: 8,
          marginTop: 8,
        }}
      >
        Attributes:
      </div>
      <ul
        style={{
          padding: 0,
          margin: 0,
          listStyle: "none",
          maxHeight: "200px",
          overflowY: "auto",
        }}
      >
        {attributes.map((attr, idx) => (
          <li
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 4,
              background: "#fff",
              padding: "4px 8px",
              borderRadius: 6,
              boxShadow: "0 1px 4px rgba(115,102,255,0.08)",
            }}
          >
            <span
              style={{
                color: attr.isNew ? "#ff6bcb" : "#7366ff",
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {attr.name}
            </span>
            <span
              style={{
                color: "#aaa",
                fontSize: 11,
                marginLeft: 4,
              }}
            >
              ({attr.type})
            </span>
            <button
              style={{
                marginLeft: "auto",
                fontSize: 11,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#ff6bcb",
              }}
              onClick={() => removeAttr(idx)}
            >
              🗑️
            </button>
            <Handle
              type="source"
              position={Position.Right}
              id={attr.name}
              style={{
                top: 12,
                background: attr.isNew ? "#ff6bcb" : "#7366ff",
                width: 8,
                height: 8,
                border: "2px solid #fff",
                boxShadow: "0 0 0 2px #7366ff",
                right: -8,
              }}
              isConnectable={isConnectable}
            />
          </li>
        ))}
      </ul>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          background: "#fff",
          padding: "8px",
          borderRadius: 6,
          boxShadow: "0 1px 4px rgba(115,102,255,0.08)",
        }}
      >
        <input
          value={newAttr}
          onChange={(e) => setNewAttr(e.target.value)}
          placeholder="Add attribute"
          style={{
            fontSize: 12,
            width: 80,
            border: "2px solid #7366ff",
            borderRadius: 6,
            padding: "4px 8px",
            outline: "none",
          }}
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          style={{
            fontSize: 12,
            marginLeft: 4,
            border: "2px solid #7366ff",
            borderRadius: 6,
            padding: "4px 8px",
            outline: "none",
          }}
        >
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="date">date</option>
          <option value="boolean">boolean</option>
        </select>
        <button
          style={{
            marginLeft: 4,
            fontSize: 12,
            background: "#7366ff",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "4px 8px",
            cursor: "pointer",
          }}
          onClick={addAttr}
        >
          +
        </button>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: "#7366ff",
          width: 8,
          height: 8,
          border: "2px solid #fff",
          boxShadow: "0 0 0 2px #7366ff",
        }}
        isConnectable={isConnectable}
      />
    </div>
  );
}

export default EntityNode;
