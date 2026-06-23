import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { CONFIG } from "./configLocal";
import "./styles.css";
import "./styles-legacy.css";

async function bootstrap() {
  if (CONFIG.USE_MOCK) {
    await Promise.all([
      import("./mocks/mockPosicao.js"),
      import("./mocks/mockAbsenteismo.js"),
    ]);
  }

  const router = getRouter();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
}

bootstrap().catch((err) => console.error("[boot] bootstrap failed:", err));
