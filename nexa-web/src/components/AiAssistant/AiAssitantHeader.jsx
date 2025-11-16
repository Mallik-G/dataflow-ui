import { Image, Dropdown, ListGroup, Button } from "react-bootstrap";
import { BiSearch, BiPlus, BiDotsHorizontal } from "react-icons/bi";
import logo from "../../assets/logo.svg";

function AiAssitantHeader() {
  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("authTimestamp");
    setIsAuthenticated(false);
    navigate("/login");
  };

  const userData = {
    name: "Majid Equbal",
    role: "Administrator",
    avatar:
      "https://t4.ftcdn.net/jpg/04/31/64/75/360_F_431647519_usrbQ8Z983hTYe8zgA7t1XVc5fEtqcpa.jpg",
  };
  const getNameTrim = (fullName) => {
    return fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };
  const nameTrim = getNameTrim(userData.name);

  return (
    <>
      <header className="ai-header d-flex justify-content-end">
        <Dropdown className="active-user ms-2">
          <Dropdown.Toggle variant="default" title={userData.name}>
            {userData.avatar ? (
              <Image src={userData.avatar} alt={userData.name} roundedCircle />
            ) : (
              <span role="user" aria-label={userData.role}>
                {nameTrim}
              </span>
            )}
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item href="#/action-1">My Profile</Dropdown.Item>
            <Dropdown.Item href="#/action-2">Notification</Dropdown.Item>
            <Dropdown.Item href="#/action-3" onClick={handleLogout}>
              Logout
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </header>
    </>
  );
}

export default AiAssitantHeader;
