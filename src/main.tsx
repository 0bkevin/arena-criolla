import React from "react";
import { createRoot } from "react-dom/client";
import { RootApp } from "./components/RootApp";
import { loadInterfaceFonts } from "./fonts";
import "./base.css";

const root = createRoot(document.getElementById("root")!);
const fontLoading = loadInterfaceFonts();
root.render(
  <React.StrictMode>
    <RootApp fontLoading={fontLoading} />
  </React.StrictMode>,
);
