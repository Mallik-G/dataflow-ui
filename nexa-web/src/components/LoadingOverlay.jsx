import React from "react";

const LoadingOverlay = ({ text = "Loading..." }) => {
  return (
    <div className="font-secondary fw-medium fs-6 position-absolute w-100 h-100 d-flex flex-column justify-content-center align-items-center text-center p-4">
      <div className="spinner"></div>
      {text}
    </div>
  );
};

export default LoadingOverlay;
