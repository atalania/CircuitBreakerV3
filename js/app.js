import { App } from "./app/App.js";
import { initPortalAssistantBridge } from "./modules/portalAssistant.js";
import { wireEmbedViewportLayout } from "./modules/embedViewport.js";

document.addEventListener("DOMContentLoaded", () => {
  wireEmbedViewportLayout();
  initPortalAssistantBridge();
  const app = new App();
  app.init();
});
