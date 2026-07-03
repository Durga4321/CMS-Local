PWA + Capacitor Setup

1) Build web app

```bash
npm run build
```

2) Install Capacitor CLI and core (once)

```bash
npm install --save @capacitor/core @capacitor/cli
npx cap init
```

3) Add native platforms

```bash
npx cap add android
npx cap add ios
```

4) Copy web build to native projects

```bash
npx cap copy
npx cap open android   # or ios
```

Notes:
- The app already includes `public/manifest.json` and a basic `public/sw.js` service worker for offline caching.
- Service worker registration is added in `src/index.js` for production builds.
- For richer offline support, consider using Workbox or adjusting `public/sw.js` caching strategy.
 
Workbox (recommended)

This repo includes `workbox-config.js` and a `build:pwa` script that generates a Workbox-powered `sw.js` into the `build/` folder after `react-scripts build`.

Run:

```bash
npm run build:pwa
```

Then continue with Capacitor steps:

```bash
npx cap copy
npx cap open android
```
