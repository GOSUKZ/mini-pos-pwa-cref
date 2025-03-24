import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// Get the container
const container = document.getElementById('root');
const root = createRoot(container);

// Render the app
root.render(<App />);
