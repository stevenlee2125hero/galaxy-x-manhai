import React from "react";
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import "../app/globals.css";
import "../app/iphone15.css";
import "../app/apple-polish.css";

createRoot(document.getElementById("root")!).render(<Home/>);
