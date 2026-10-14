# PowerSOS Growth Console: project brief

**Author:** Noyal George
**Status:** Concept prototype for a KTP Associate (Business Development Manager) application
**Last updated:** 14 October 2026

## 1. Purpose

A web app to demo in a 10-minute interview for the Knowledge Transfer Partnership between
Midlands Power Networks (MPN) and the University of Staffordshire. It shows how I would run
business development for PowerSOS: growing a four-sided ecosystem through adoption,
onboarding, retention, market strategy and regulatory compliance.

It is **not** a clone of the PowerSOS customer app. It is the console behind growth: the views
a business development manager would use to decide where to focus next.

## 2. PowerSOS: what is public

Source: powersos.co.uk. These are the **only** facts treated as real. Everything else in the
console is synthetic.

- **What it is:** a UK platform connecting organisations that run private high-voltage (HV)
  networks with vetted, HV-authorised responders for emergency call-outs.
- **Customer flow:** select a pre-loaded site → three-click emergency request (fault type
  optional) → choose a nearby responder by rating, ETA or distance → track repair progress and
  costs live.
- **Service level:** target response 75 minutes (subject to distance and traffic), 24/7,
  mainland UK.
- **Responders:** vetted, hold current HV authorisation, audited for competence and safety.
- **Features:** multi-site, pre-loaded site and equipment information, live ETA, spend
  tracking, cost prediction and approval, in-app messaging.
- **Target sectors:** medical, education, hospitality, manufacturing, aviation, warehousing,
  agriculture, power generation and distribution, telecoms and data centres.
- **Commercials:** pricing not announced; membership model with unlimited call-outs;
  early-adopter wait-list discounts.

## 3. The four-sided ecosystem

| Side          | Who                                                                                 | Basis              |
| ------------- | ----------------------------------------------------------------------------------- | ------------------ |
| End customers | Organisations running private HV networks                                           | Public facts       |
| Responders    | Vetted engineers with current HV authorisation                                      | Public facts       |
| Partners      | Organisations that bring customers or capability (facilities managers, insurers …)  | Working definition |
| Suppliers     | Firms that keep repairs moving (switchgear spares, cable, generator hire …)          | Working definition |

Partner and supplier definitions are my working assumptions and are labelled as such in the UI.

## 4. Sections

The **Overview** introduces the ecosystem and the public facts, then links to five sections:

1. **Ecosystem simulator:** one emergency played out across all four sides. Incident timeline
   against the 75-minute target, four-lane view, responder matching (rating, ETA, distance),
   cost prediction and approval.
2. **Network health:** coverage map (OpenStreetMap) and liquidity KPIs. Fill rate, time to
   match, responders per site, utilisation, gaps and hotspots, trends.
3. **Onboarding & compliance:** funnels per side, responder authorisation tracking (HV
   authorisation, audits, upcoming expiries), data-quality checks on site and equipment data,
   action queue.
4. **Market strategy:** sector prioritisation across the nine target sectors, alternatives
   organisations use today, membership pricing sandbox.
5. **Pipeline:** early-adopter CRM, voice of customer → roadmap, proposal generator.

`src/nav.ts` holds the canonical titles, questions and planned modules for each section.

## 5. Data policy

- All data is synthetic and generated from a seeded RNG (`src/lib/rng.ts`), so every run is
  identical.
- Never use `Math.random()` for data. Create a stream per dataset with
  `createRng(seedFor('<dataset>'))`, so changing one generator never reshuffles another.
- The "Synthetic data" badge is in the header on every page. Any exported or printed view must
  carry the same label.
- No real organisations, people or customer sites. Real UK place names and coordinates are fine
  for geography; organisations and people must be fictional.

## 6. Design

- Own visual identity. No PowerSOS logo, colours or copy.
- Charcoal/slate base with **one** amber "HV warning" accent, used sparingly: active state,
  key highlights, focus rings and warnings.
- Generous whitespace. Light and dark mode: follows the OS until the viewer chooses, then
  remembers the choice.
- Footer on every page, worded exactly:
  > Concept prototype by Noyal George for a KTP application. Not affiliated with or endorsed by
  > PowerSOS Ltd or Midlands Power Networks. All data is illustrative.
- Demo target is a laptop at 1280–1440 px wide. Must remain usable on a phone.

## 7. Stack

| Concern    | Choice                                       |
| ---------- | -------------------------------------------- |
| Build      | Vite 8, TypeScript 6 (strict)                 |
| UI         | React 19, Tailwind CSS 4                      |
| Routing    | React Router 8 (data router, browser history) |
| State      | Zustand 5                                     |
| Charts     | Recharts 3                                    |
| Maps       | react-leaflet 5 + Leaflet, OpenStreetMap tiles |
| Tests      | Vitest 5                                      |
| Lint       | oxlint                                        |
| Hosting    | Cloudflare Pages (static, no backend)         |

## 8. Coding conventions

### Language and formatting

- UK English in all UI text and docs ("organisation", "prioritisation", "colour"). Code
  identifiers follow the platform where it differs (CSS `color`).
- Use the helpers in `src/lib/format.ts` for every displayed value. Never hand-format:
  - money in pounds: `formatGBP(1234.5)` → £1,234.50
  - 24-hour time: `formatTime` → 18:05
  - dates: `formatDate` → 14 Oct 2026
  - durations: `formatDuration(75)` → 1 h 15 min
- Times are shown in Europe/London.

### Project layout

```
src/
  lib/          Pure business logic (ETA, coverage, scoring, pricing, RNG, formatting) + tests
  store/        Zustand stores for state shared across pages
  components/   Shared UI; layout/ holds the app shell
  pages/        One file per route (default export)
  nav.ts        Pages, sections and planned modules: the single source of truth
  router.tsx    Route table built from nav.ts
docs/           Brief and decisions
```

### Business logic

- Lives in `src/lib` as pure TypeScript functions: no React, no DOM, no `Date.now()` and no
  `Math.random()`. Pass in time and an `Rng`.
- Every module has a co-located `*.test.ts` covering normal cases, edge cases and invalid input.
- Components stay thin: they call `lib` functions and render the results.

### Components and styling

- Function components. Pages use a default export; everything else uses named exports.
- Tailwind utilities with the semantic tokens from `src/index.css`: `bg-canvas`, `bg-surface`,
  `bg-surface-muted`, `border-line`, `text-ink`, `text-ink-muted`, `text-ink-subtle`,
  `bg-accent`, `text-accent-ink`, `bg-accent-soft`, `text-on-accent`. No raw hex values in
  components.
- Accessibility: semantic landmarks, a skip link, visible focus, labelled icon buttons, and
  colour never the only signal.
- Local UI state stays in components. Use Zustand only for state shared across pages.

### TypeScript and style

- `strict` and `noUncheckedIndexedAccess`; no `any`.
- No semicolons, single quotes, 2-space indent, trailing commas.
- Import from `src` with the `@/` alias.

### Git

- Small, focused commits. Imperative subject of 72 characters or fewer, and a body that
  explains why when it isn't obvious.
- Author: Noyal George.

### Definition of done

`npm run build`, `npm test` and `npm run lint` all pass, and the change has been checked in
the browser in light and dark mode.

## 9. Authorship

- All code, comments, docs, UI text and commit messages are written as Noyal George's own work.
- Never name any coding tool, assistant or AI vendor anywhere in the repo.
- No attribution, co-author or 'generated with' lines in commits.
- No tool-specific config files or folders in the repo.

## 10. Run and deploy

```sh
npm install
npm run dev        # http://localhost:5173
npm test
npm run build      # type-check + production build into dist/
```

Cloudflare Pages: build command `npm run build`, output directory `dist`. Node version comes
from `.node-version`. With no `404.html` in the output, Pages serves `index.html` for unknown
paths, so deep links work without a `_redirects` file.
