import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { initTheme } from "./lib/theme";
import { initCardFaceStyle } from "./lib/cardFace";

const initialTheme = initTheme();
initCardFaceStyle();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App initialTheme={initialTheme} />
  </StrictMode>
);
