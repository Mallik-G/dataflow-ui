import { Image, Dropdown, ListGroup, Button } from "react-bootstrap";
import { BiSearch, BiPlus, BiDotsHorizontal } from "react-icons/bi";
import logo from "../../assets/logo.svg";

function AiAssitantSidebar() {
  return (
    <>
      <aside className="ai-sidebar d-flex flex-column flex-shrink-0 flex-grow-0">
        <header className="ai-sidebar-header d-flex flex-column gap-3 p-3">
          <div className="ai-sidebar-logo">
            <Image src={logo} alt="" />
          </div>
          <Button variant="outline-primary justify-content-start px-3">
            <BiPlus /> New Chat
          </Button>
          <div className="px-3 py-2 cursor-pointer fw-medium d-flex align-items-center gap-2">
            <BiSearch size={20} />
            <span>Search Chat</span>
          </div>
        </header>
        <div className="ai-chat-nav d-flex flex-column">
          <h4 className="title fw-medium  m-0 text-small text-muted">
            Search Chat
          </h4>
          <ListGroup as="ul" variant="flush">
            <ListGroup.Item as="li" active>
              <span className="ai-chat-label text-truncate d-block">
                Portfolio performance summary
              </span>
            </ListGroup.Item>
            <ListGroup.Item as="li">
              <span className="ai-chat-label text-truncate d-block">
                <span className="ai-chat-label text-truncate d-block">
                  Insurance coverage recommend
                </span>
              </span>
              <Dropdown>
                <Dropdown.Toggle variant="default btn-icon" size="sm">
                  <BiDotsHorizontal />
                </Dropdown.Toggle>

                <Dropdown.Menu>
                  <Dropdown.Item href="#">Share</Dropdown.Item>
                  <Dropdown.Item href="#">Rename</Dropdown.Item>
                  <Dropdown.Item href="#">Delete</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </ListGroup.Item>
            <ListGroup.Item as="li">
              <span className="ai-chat-label text-truncate d-block">
                Diversification strategy for portable
              </span>
            </ListGroup.Item>
            <ListGroup.Item as="li">
              <span className="ai-chat-label text-truncate d-block">
                Portfolio performance summary
              </span>
            </ListGroup.Item>
            <ListGroup.Item as="li">
              <span className="ai-chat-label text-truncate d-block">
                Insurance coverage recommend
              </span>
            </ListGroup.Item>
            <ListGroup.Item as="li">
              <span className="ai-chat-label text-truncate d-block">
                Diversification strategy for portable
              </span>
            </ListGroup.Item>
            <ListGroup.Item as="li">
              <span className="ai-chat-label text-truncate d-block">
                Portfolio performance summary
              </span>
            </ListGroup.Item>
            <ListGroup.Item as="li">
              <span className="ai-chat-label text-truncate d-block">
                Insurance coverage recommend
              </span>
            </ListGroup.Item>
            <ListGroup.Item as="li">
              <span className="ai-chat-label text-truncate d-block">
                Diversification strategy for portable
              </span>
            </ListGroup.Item>
            <ListGroup.Item as="li">
              <span className="ai-chat-label text-truncate d-block">
                Portfolio performance summary
              </span>
            </ListGroup.Item>
            <ListGroup.Item as="li">
              <span className="ai-chat-label text-truncate d-block">
                Insurance coverage recommend
              </span>
            </ListGroup.Item>
            <ListGroup.Item as="li">
              <span className="ai-chat-label text-truncate d-block">
                Diversification strategy for portable
              </span>
            </ListGroup.Item>
            <ListGroup.Item as="li">
              <span className="ai-chat-label text-truncate d-block">
                Portfolio performance summary
              </span>
            </ListGroup.Item>
            <ListGroup.Item as="li">
              <span className="ai-chat-label text-truncate d-block">
                Insurance coverage recommend
              </span>
            </ListGroup.Item>
            <ListGroup.Item as="li">
              <span className="ai-chat-label text-truncate d-block">
                Diversification strategy for portable
              </span>
            </ListGroup.Item>
          </ListGroup>
        </div>
      </aside>
    </>
  );
}

export default AiAssitantSidebar;
