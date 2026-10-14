# PowerSOS Growth Console

A concept prototype by Noyal George, showing how I would run business development for
PowerSOS: growing a four-sided ecosystem of end customers, responders, partners and suppliers.

> Concept prototype by Noyal George for a KTP application. Not affiliated with or endorsed by
> PowerSOS Ltd or Midlands Power Networks. All data is illustrative.

The project brief and coding conventions are in [docs/brief.md](docs/brief.md).

## Sections

- **Overview:** the ecosystem and the public facts the console builds on
- **Ecosystem simulator:** one emergency played out across all four sides
- **Network health:** coverage map and liquidity KPIs
- **Onboarding & compliance:** funnels, responder authorisation, data-quality checks
- **Market strategy:** sector prioritisation, alternatives, pricing sandbox
- **Pipeline:** early-adopter CRM, voice of customer → roadmap, proposal generator

All data is synthetic, generated from a fixed seed so the console looks identical on every load.

## Getting started

Requires Node 22.22 or later (see `.node-version`).

```sh
npm install
npm run dev          # http://localhost:5173
```

| Script               | What it does                            |
| -------------------- | --------------------------------------- |
| `npm run dev`        | Development server with hot reload      |
| `npm run build`      | Type-check, then production build to `dist/` |
| `npm run preview`    | Serve the production build locally      |
| `npm test`           | Run the unit tests once                 |
| `npm run test:watch` | Run the unit tests in watch mode        |
| `npm run lint`       | Lint with oxlint                        |

## Deploying to Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`

No `_redirects` file is needed: without a `404.html`, Pages serves the app for every path.
