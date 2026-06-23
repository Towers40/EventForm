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

## Pendientes (fases 3 y 4)

- Íconos (1024×1024) y splash: `@capacitor/assets` los genera desde un PNG maestro.
- Deep links / Universal Links para abrir `/e/:slug` en la app.
- Push notifications (opcional).
- Pagos: solo si vas a cobrar entradas (revisar reglas de tienda).
