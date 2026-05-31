import React from "react";
import { createRoot, Root } from "react-dom/client";
import { HomeAssistantView } from "./HomeAssistantView";

let root: Root | null = null;

export function mount(containerEl: HTMLElement) {
  if (root) {
    console.warn("Home Assistant plugin already mounted, unmounting first.");
    unmount();
  }
  root = createRoot(containerEl);
  root.render(
    <React.StrictMode>
      <HomeAssistantView />
    </React.StrictMode>,
  );
}

export function unmount() {
  if (root) {
    root.unmount();
    root = null;
  }
}

export { HomeAssistantView };
