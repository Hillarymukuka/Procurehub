import React from "react";

const TestPage: React.FC = () => {
  return (
    <div style={{ padding: "20px", backgroundColor: "lightblue" }}>
      <h1>Test Page - If you see this, React is working!</h1>
      <p>Current time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
};

export default TestPage;
