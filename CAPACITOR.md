# Empaquetado nativo (iOS / Android) con Capacitor

La web ya quedó lista para correr dentro de Capacitor. Estos pasos se ejecutan
**en tu Mac** (iOS necesita Xcode; Android necesita Android Studio).

## 1. Instalar Capacitor

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
```

`capacitor.config.json` ya está creado (appId `co.eventform.app`, webDir `dist`).

## 2. Generar el bundle web y los proyectos nativos

```bash
npm run build          # genera dist/
npx cap add ios
npx cap add android
npx cap sync           # copia dist/ + plugins a los proyectos nativos
```

> Cada vez que cambie la web: `npm run build && npx cap sync`.

## 3. Configurar el API en producción

En los builds nativos, si `VITE_API_URL` está vacío se usa `VITE_PUBLIC_URL`
(ver `.env.example`). Confirma que apunte a tu dominio real de Vercel antes de
compilar:

```
VITE_PUBLIC_URL=https://TU-DOMINIO.vercel.app
```

El backend (CORS) ya permite los orígenes `capacitor://localhost` (iOS) y
`https://localhost` (Android).

## 4. Permisos nativos (escáner QR)

- iOS: en `ios/App/App/Info.plist` añadir
  `NSCameraUsageDescription` = "Usamos la cámara para escanear códigos QR de entrada".
- Android: `android/app/src/main/AndroidManifest.xml` → `<uses-permission android:name="android.permission.CAMERA"/>`.

## 5. Abrir y compilar

```bash
npx cap open ios       # Xcode → firmar y correr / subir a App Store Connect
npx cap open android   # Android Studio → generar AAB / subir a Play Console
```

---

# Fase 3 — Funciones nativas

El código ya está preparado (carga perezosa de plugins: la web no se afecta si
no están instalados). Faltan instalar plugins y configurar lo nativo.

## A. Cámara / escáner QR

El escáner sigue usando `html5-qrcode`, pero en nativo pide permiso primero con
`@capacitor/camera` (`src/lib/nativeCamera.js`).

```bash
npm install @capacitor/camera
npx cap sync
```

Permisos nativos:
- iOS — `ios/App/App/Info.plist`:
  `NSCameraUsageDescription` = "Usamos la cámara para escanear códigos QR de entrada".
- Android — `android/app/src/main/AndroidManifest.xml`:
  `<uses-permission android:name="android.permission.CAMERA"/>`

> Si en iOS el WebView no inicia la cámara, alternativa nativa:
> `@capacitor-community/barcode-scanner` (reemplaza el escáner solo en nativo).

## B. Deep links / Universal Links (`/e/:slug`)

El listener ya está integrado (`src/lib/useDeepLinks.js` → `<DeepLinks/>` en
`AppRouter`). Instala el plugin y configura el dominio:

```bash
npm install @capacitor/app
npx cap sync
```

1. **Sube los archivos de asociación a tu dominio web** (carpeta `native/`):
   - `native/apple-app-site-association` → servir en
     `https://TU-DOMINIO/.well-known/apple-app-site-association`
     (reemplaza `TEAMID` por tu Apple Team ID; sin extensión; content-type JSON).
   - `native/assetlinks.json` → servir en
     `https://TU-DOMINIO/.well-known/assetlinks.json`
     (reemplaza el SHA-256 de tu firma de Android).
   > En Vercel: colócalos en `public/.well-known/` (se sirven como estáticos,
   > tienen prioridad sobre el rewrite a index.html).
2. iOS: en Xcode → Signing & Capabilities → **Associated Domains** →
   `applinks:TU-DOMINIO`.
3. Android: el `intent-filter` con `autoVerify` se añade en `AndroidManifest.xml`.

## C. Push notifications (opcional)

```bash
npm install @capacitor/push-notifications
```
Requiere Firebase (Android) y APNs (iOS). No implementado aún.

## D. Pagos (solo si cobras entradas)

No hay pasarela aún. Las entradas de eventos del mundo real suelen poder usar
Stripe/Apple Pay/Google Pay (exentas de IAP), pero hay que encuadrarlo bien.

---

# Fase 4 — Assets y ficha (pendiente)

- Íconos (1024×1024) y splash: `npm i -D @capacitor/assets` y generar desde un
  PNG maestro (`npx capacitor-assets generate`).
- Capturas de pantalla por dispositivo + textos de ficha.
- Formularios de privacidad / Data Safety.
