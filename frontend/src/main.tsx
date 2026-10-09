import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// The fonts are served with the app (scripts/fonts.py), never fetched from a third party.
import "./fonts/fonts.css";
import "./index.css";
// Register session types and commands at startup
import "./lib/ai/sessions";
import "./lib/commands/index";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
