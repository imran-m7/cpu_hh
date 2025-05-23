import React from "react";
import ReactDOM from "react-dom/client";
import PipelinedCPUSimulator from "./cpu_hh";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PipelinedCPUSimulator />
  </React.StrictMode>
);
