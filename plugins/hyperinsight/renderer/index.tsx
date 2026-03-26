import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { HyperInsightView } from './HyperInsightView';

let root: Root | null = null;

export function mount(containerEl: HTMLElement) {
  if (root) {
    console.warn('HyperInsight plugin already mounted, unmounting first.');
    unmount();
  }
  
  root = createRoot(containerEl);
  root.render(
    <React.StrictMode>
      <HyperInsightView />
    </React.StrictMode>
  );
}

export function unmount() {
  if (root) {
    root.unmount();
    root = null;
  }
}

// Also export the component for direct usage if the host prefers
export { HyperInsightView };
