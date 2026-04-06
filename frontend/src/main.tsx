import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// Register session types and commands at startup
import "./lib/ai/sessions";
import "./lib/commands/index";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
