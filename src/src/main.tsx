import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";
import "./styles-legacy.css";
import { Chart as ChartJS, registerables } from "chart.js";
ChartJS.register(...registerables);
// Legacy panel code accesses Chart.js via window.Chart
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).Chart = ChartJS;

const router = getRouter();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
