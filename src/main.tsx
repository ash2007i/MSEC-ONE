import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './dark.css'
import './ui/headers.css'
import './ui/motion.css'
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./backend/AuthContext";
import "./index.css";
import "./dark.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
