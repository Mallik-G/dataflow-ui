import { useState } from "react";
import { Dropdown, Button, Form } from "react-bootstrap";
import AiAssitantSidebar from "../components/AiAssistant/AiAssitantSidebar";
import AiAssitantHeader from "../components/AiAssistant/AiAssitantHeader";
import { BiPlus, BiSolidSend } from "react-icons/bi";

const AiAssistant = () => {
  const [currentView, setCurrentView] = useState();
  document.body.classList.add(currentView === "canvas" ? "" : "ai");

  return (
    <>
      <section className="ai-app d-flex flex-grow-1">
        <AiAssitantSidebar />
        <section className="ai-wrapper d-flex flex-column flex-grow-1">
          <AiAssitantHeader />
          <section className="ai-container d-flex flex-column flex-grow-1">
            <div className="ai-chats flex-grow-1 d-flex flex-column justify-content-center align-items-center">
              <h2 className="fw-medium">Welcome</h2>
              <p className="text-large text-muted">
                This is your Fin Advisor assistant
              </p>
            </div>
            <div className="ai-composer d-flex justify-content-center p-3">
              <div className="ai-composer-group d-flex align-items-center">
                <div className="ai-composer-more">
                  <Button variant="default">
                    <BiPlus size={20} />
                  </Button>
                </div>
                <div className="ai-composer-input flex-fill">
                  <Form.Control
                    size="lg"
                    placeholder="How can i Help you today?"
                  />
                </div>
                <div className="ai-composer-send px-3">
                  <Button variant="primary">
                    <BiSolidSend />
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </section>
      </section>
    </>
  );
};

export default AiAssistant;
