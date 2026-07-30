import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import { ThemeProvider } from './ThemeContext.jsx'
import './index.css'

// The marketing/waitlist site (gabspace.io) is a separate static deployment
// (see the gabspace-marketing repo) — this app only ever serves the product,
// regardless of hostname.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
)