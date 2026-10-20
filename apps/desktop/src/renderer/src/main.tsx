import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import '@retarget3mf/ui/tokens.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
