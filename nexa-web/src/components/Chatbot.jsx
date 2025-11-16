import { useState } from "react";
import "../App.scss";
import { Image, Form, Button } from "react-bootstrap";
import { BiSolidMicrophone, BiSolidSend } from "react-icons/bi";
import aiIcon from "../assets/ai-icon.svg";

function Chatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      sender: "nexa",
      text: "Hello I am Nexa, your AI Agent and copilot for DR",
    },
  ]);

  function handleSend(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = { sender: "user", text: input };
    setMessages((msgs) => [...msgs, userMsg]);
    setInput("");
    // Simulate AI response
    setTimeout(() => {
      setMessages((msgs) => [
        ...msgs,
        {
          sender: "nexa",
          text: "This is a placeholder AI response from Nexa.",
        },
      ]);
    }, 800);
  }

  const handleCreateJiraTicket = () => {
    alert("Creating JIRA ticket...");
  };

  const handleCreateServiceNowTicket = () => {
    alert("Creating ServiceNow ticket...");
  };

  return (
    <div>
      <div className="chatbot-fab" onClick={() => setOpen((o) => !o)}>
        <div className="chatbot-fab-bg">
          <Image src={aiIcon} alt="" />
          <span className="fab-text">Nexa</span>
        </div>
      </div>
      {open && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div className="chatbot-fab d-inline-block">
              <div className="chatbot-fab-bg">
                <Image src={aiIcon} alt="" />
                <span className="fab-text">Ask Agent Nexa</span>
              </div>
            </div>
            <p className="text-small text-muted mt-2 mb-0">
              Your smart assistant for data pipelines
            </p>
            {/* <div className="chatbot-actions">
              <button
                className="chatbot-action-btn"
                onClick={handleCreateJiraTicket}
                title="Create JIRA Ticket"
              >
                <span role="img" aria-label="jira">
                  📋
                </span>
              </button>
              <button
                className="chatbot-action-btn"
                onClick={handleCreateServiceNowTicket}
                title="Create ServiceNow ticket"
              >
                <span role="img" aria-label="servicenow">
                  🎫
                </span>
              </button>
              
            </div> */}
            <button className="chatbot-close" onClick={() => setOpen(false)}>
              &times;
            </button>
          </div>
          <div className="chatbot-messages">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={
                  msg.sender === "nexa"
                    ? "chatbot-msg nexa"
                    : "chatbot-msg user"
                }
              >
                {msg.text}
              </div>
            ))}
          </div>
          <Form className="chatbot-input-row" onSubmit={handleSend}>
            <Form.Control
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              autoFocus
            />
            <Button variant="default px-2">
              <BiSolidMicrophone size={20} />
            </Button>
            <Button variant="primary" type="submit">
              <BiSolidSend size={20} />
            </Button>
          </Form>
        </div>
      )}
    </div>
  );
}

export default Chatbot;
