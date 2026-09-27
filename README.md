# Personal Website

My personal portfolio and CV site, live at **[benedikt.prisett.de](https://benedikt.prisett.de/)** — built with [Astro](https://astro.build), TypeScript, and Tailwind CSS v4, deployed on Cloudflare Pages.

The site is primarily static content: a landing page, CV, project portfolio, and personal sections (running, reading, travel). A running section visualizes activity data pulled from Strava at build time.

## Tech stack

- **[Astro 6](https://astro.build)** — framework, routing, static site generation
- **TypeScript** — type-safe components and build scripts
- **[Tailwind CSS v4](https://tailwindcss.com)** — styling via the `@tailwindcss/vite` plugin; customization lives in `src/styles/global.css`
- **[Inter](https://rsms.me/inter/)** — self-hosted in `public/fonts/` (no third-party font CDNs, per GDPR)
- **[lucide-astro](https://lucide.dev)** — icons
- **Cloudflare Pages** — hosting and deployment
- **Node.js** `>=22.12.0`

## Getting started

```sh
npm install
npm run dev
```

The dev server runs at [localhost:4321](http://localhost:4321).

## Commands

| Command                | Action                                   |
| :--------------------- | :--------------------------------------- |
| `npm run dev`          | Start the dev server at `localhost:4321` |
| `npm run build`        | Build the production site to `dist/`     |
| `npm run preview`      | Preview the production build locally     |
| `npm run lint`         | Run ESLint                               |
| `npm run format`       | Format all files with Prettier           |
| `npm run format:check` | Check formatting without writing         |

The `build` step runs a `prebuild` script (`scripts/fetch-strava-data.ts`) that fetches activity data before building. See [Strava data](#strava-data) below.

## Project structure

```text
src/
  assets/       — images processed by Astro
  components/   — reusable UI components (Nav, Footer, ActivityHeatmap, StatCards, …)
  layouts/      — base HTML layouts (BaseLayout.astro)
  pages/        — file-based routing, one file per page
  styles/       — global.css (Tailwind entry point, @font-face, @theme)
  types/        — shared TypeScript types
scripts/        — build-time data fetching (Strava)
worker/         — Cloudflare Worker that syncs Strava activities into KV
public/         — static assets served as-is (fonts, favicon)
```

## Strava data

The running section shows activity data synced from Strava, kept fresh without manual deploys:

1. A **Cloudflare Worker** (`worker/`) runs daily on a cron, fetches new activities from Strava, and stores them in Cloudflare KV. When there's something new, it triggers a Pages rebuild via a deploy hook.
2. The **`prebuild` script** (`scripts/fetch-strava-data.ts`) runs during each build, reads the activities from KV, aggregates them into per-year and per-category stats, and writes `src/data/strava.json` for Astro to render.

The build script never calls Strava directly. If the KV env vars are missing (e.g. local dev), it keeps the existing `strava.json`, so no credentials are needed to work on the site.

`scripts/strava-oauth.ts` is a one-off helper for the initial Strava OAuth token exchange.

## License

© 2026 Benedikt Prisett. All rights reserved.
