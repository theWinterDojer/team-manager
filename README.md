# Team Manager

Mobile-first PWA for building kickball lineups, assigning positions, and exporting a stylized field graphic. Runs fully client-side with offline-capable storage.

## Features
- Team name + roster management (add/edit/remove, bulk paste)
- Tap-to-assign field view with dropdown fallback
- Wildcard + rover toggles
- PNG export via SVG -> canvas pipeline
- IndexedDB storage with localStorage fallback

## Tech
- Vite + React + TypeScript
- IndexedDB storage layer
- PWA manifest + service worker

## Project Layout
- App UI: `src/App.tsx`, `src/App.css`, `src/index.css`
- State + models: `src/state.ts`, `src/types.ts`, `src/positions.ts`
- Export pipeline: `src/export.ts`
- Storage: `src/storage.ts`
- PWA: `public/manifest.webmanifest`, `public/service-worker.js`

## Commands
- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`
- Lint: `npm run lint`
- Generate icons: `npm run icons`

## Export Details
- Base render size: 1080x1440
- PNG output generated from SVG with 24px padding

## Icons
- Source: `public/kickball.png`
- Generated sizes: `public/icon-192.png`, `public/icon-512.png`, `public/icon-1024.png`
