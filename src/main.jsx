import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Landing from './pages/Landing.jsx'
import { ThemeProvider } from './ThemeContext.jsx'
import './index.css'

// The apex domain (gabspace.io) serves the public marketing/waitlist page;
// the app subdomain (app.gabspace.io) serves the product. Both are the same
// deployment — this just decides which one renders. Add ?landing=1 on any
// hostname (including app.gabspace.io) to preview the marketing page before
// gabspace.io's DNS is pointed at this deployment.
const MARKETING_HOSTNAMES = ['gabspace.io', 'www.gabspace.io']
const isMarketingSite =
  MARKETING_HOSTNAMES.includes(window.location.hostname) ||
  new URLSearchParams(window.location.search).has('landing')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/*" element={isMarketingSite ? <Landing /> : <App />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
)