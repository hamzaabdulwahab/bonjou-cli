import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { apply, resolve, storedChoice } from "./theme";
import "./tokens.css";
import "./app.css";
import "./site.css";

// Before the first paint, or a dark-mode visitor gets a white flash while
// React boots. The hook keeps it in sync from here on.
apply(resolve(storedChoice()));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
