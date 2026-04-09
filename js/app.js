import { App } from "./app/App.js";
import { initPortalAssistantBridge } from "./modules/portalAssistant.js";

document.addEventListener("DOMContentLoaded", () => {
  initPortalAssistantBridge();
  const app = new App();
  app.init();
});
