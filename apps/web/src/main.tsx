import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { installGlobalErrorHandlers } from "./lib/errorLog";

installGlobalErrorHandlers();

// Unregister any existing service workers (cleanup stale PWA/SWs)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      console.log("Unregistering stale service worker:", registration);
      registration.unregister();
    }
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
