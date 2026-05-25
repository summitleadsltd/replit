import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import summitLogoUrl from "@/assets/summit-logo.webp?url";

// Preload the LCP image (logo on Auth screen) using Vite's hashed URL.
// Injected here so the browser discovers it before React renders.
const preloadLogo = document.createElement("link");
preloadLogo.rel = "preload";
preloadLogo.as = "image";
preloadLogo.type = "image/webp";
preloadLogo.href = summitLogoUrl;
(preloadLogo as HTMLLinkElement & { fetchPriority?: string }).fetchPriority = "high";
document.head.appendChild(preloadLogo);

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    }).then((registration) => {
      if (import.meta.env.DEV) console.log('Service Worker registered with scope:', registration.scope);
    }).catch((error) => {
      if (import.meta.env.DEV) console.error('Service Worker registration failed:', error);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
