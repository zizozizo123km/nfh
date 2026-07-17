import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';
import App from './App';
import './index.css';

// When VITE_API_URL is set (e.g. pointing to a dedicated backend server),
// all API calls will be routed there instead of the same origin.
if (import.meta.env.VITE_API_URL) {
  setBaseUrl(import.meta.env.VITE_API_URL as string);
}

createRoot(document.getElementById('root')!).render(<App />);
