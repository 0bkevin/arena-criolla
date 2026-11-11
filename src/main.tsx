import React from "react";
import { createRoot } from "react-dom/client";
import { RootApp } from "./app/RootApp";
import { Acknowledgements } from "./components/acknowledgements/Acknowledgements";
import { loadInterfaceFonts } from "./app/fonts";
import "./styles/base.css";

const root = createRoot(document.getElementById("root")!);
const fontLoading = loadInterfaceFonts();
const acknowledgements = /^\/agradecimientos\/?$/.test(location.pathname);
if (acknowledgements) fontLoading.activateInterface();
root.render(
  <React.StrictMode>
    {acknowledgements ? (
      <Acknowledgements />
    ) : (
      <RootApp fontLoading={fontLoading} />
    )}
  </React.StrictMode>,
);
