import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/global.css";
import { App } from "./App";
import { ThemeProvider } from "./hooks/useTheme";
import { ToastProvider } from "./components/feedback/ToastProvider";
import { JobsProvider } from "./jobs/JobsProvider";
import { BrewDataProvider } from "./data/BrewDataProvider";
import { DetailProvider } from "./components/package/DetailProvider";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <JobsProvider>
          <BrewDataProvider>
            <DetailProvider>
              <App />
            </DetailProvider>
          </BrewDataProvider>
        </JobsProvider>
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
