import React from "react";
import { createRoot } from "react-dom/client";
import { RootApp } from "./components/RootApp";
import "./styles.css";
import "./lobby.css";
import "./arcade-theme.css";
import "./creator.css";
import "./mobile-game.css";
import "./ui-accessibility.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>,
);
