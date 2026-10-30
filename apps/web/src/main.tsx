import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@retarget3mf/ui/tokens.css';
import { App } from './App.tsx';

// The service worker activates a new version straight away (autoUpdate); reload so the page isn't left on the cached build.
// No controller yet means a first visit, where there is nothing old to replace.
if (navigator.serviceWorker?.controller) navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
