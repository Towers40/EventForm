import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Identificador del build, visible en el pie de la app. Existe porque se
// perdieron varias rondas depurando fallos "que no se arreglaban": se estaba
// probando en una URL de preview de Vercel congelada en un commit viejo, y
// desde fuera es indistinguible de producción. Con esto se ve de un vistazo
// qué versión está corriendo en el dispositivo.
const BUILD_ID = (process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 7);
const BUILD_ENV = process.env.VERCEL_ENV || "local"; // production | preview | development

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __BUILD_ENV__: JSON.stringify(BUILD_ENV),
  },
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
