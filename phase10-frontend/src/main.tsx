import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { initTheme } from "./lib/theme";

const initialTheme = initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App initialTheme={initialTheme} />
  </StrictMode>
);
