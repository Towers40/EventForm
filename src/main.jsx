import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/typeform.css'
import './styles/mobile.css'
import AppRouter from './AppRouter.jsx'
import { initScrollTint } from './lib/scrollTint.js'

initScrollTint()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
)
