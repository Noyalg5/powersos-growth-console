# PowerSOS Growth Console

A concept prototype by Noyal George, showing how I would run business development for
PowerSOS: growing a four-sided ecosystem of end customers, responders, partners and suppliers.

> Concept prototype by Noyal George for a KTP application. Not affiliated with or endorsed by
> PowerSOS Ltd or Midlands Power Networks. All data is illustrative.

It was built for a 10-minute interview for the Knowledge Transfer Partnership between Midlands
Power Networks and the University of Staffordshire. It is not a copy of the PowerSOS customer
app. It is the console behind growth: the views a business development manager would use to
decide where to focus next.

The project brief and coding conventions are in [docs/brief.md](docs/brief.md).

## What is in it

- **Overview:** a one-screen summary, computed live. The four sides, five network KPIs, the top
  coverage gaps and first recruit, the top three sectors, the weighted pipeline, my first 90
  days (editable) and every modelled assumption. **Start demo** runs the guided demo.
- **Ecosystem simulator:** one emergency played out across all four sides, against the
  75-minute target, with responder matching and cost approval.
- **Network health:** coverage map, liquidity KPIs, coverage gaps, a recruitment plan and
  supply against demand by hour.
- **Onboarding & compliance:** funnels and checklists for each side, responder compliance,
  data-quality checks and customer retention.
- **Market strategy:** sector prioritisation, alternatives and positioning, and a pricing
  sandbox.
- **Pipeline:** early-adopter CRM, voice of customer → roadmap, proposal generator (prints on
  one A4 page) and events planner.

All data is synthetic, generated from a fixed seed so the console looks identical on every load.
Edits (sector weights, prices, card moves, the 90-day plan) are kept in the browser, and each
tool has a reset. In development, [localhost:5173/data](http://localhost:5173/data) shows every
dataset in sortable tables; that page is left out of production builds.

## Running it

Requires Node 22.22 or later (see `.node-version`).

```sh
npm install
npm run dev          # http://localhost:5173
```

| Script               | What it does                                      |
| -------------------- | ------------------------------------------------- |
| `npm run dev`        | Development server with hot reload                |
| `npm run build`      | Type-check, then production build to `dist/`      |
| `npm run preview`    | Serve the production build locally                |
| `npm test`           | Run the unit tests once                           |
| `npm run test:watch` | Run the unit tests in watch mode                  |
| `npm run typecheck`  | Type-check only                                   |
| `npm run lint`       | Lint with oxlint                                  |
| `npm run deploy`     | Build and deploy to Cloudflare Pages              |

## Stack

| Concern       | Choice                                                    |
| ------------- | --------------------------------------------------------- |
| Build         | Vite 8, TypeScript 6 (strict)                             |
| UI            | React 19, Tailwind CSS 4                                  |
| Routing       | React Router 8, one lazily loaded file per page           |
| State         | Zustand 5 for state shared across pages (theme, demo)     |
| Charts        | Hand-drawn SVG, so they theme, print and read accessibly  |
| Maps          | react-leaflet 5 + Leaflet, OpenStreetMap tiles            |
| Drag and drop | @dnd-kit/core 6                                           |
| Tests         | Vitest 5                                                  |
| Lint          | oxlint                                                    |
| Hosting       | Cloudflare Pages (static, no backend)                     |

Business logic lives in `src/lib` as pure functions, each with its own tests. Pages only call it
and show the results.

## Assumptions

Only the facts on powersos.co.uk are real: a 75-minute target response (subject to distance
and traffic), 24/7 across mainland UK, a three-click emergency request, vetted HV-authorised
responders and membership with unlimited call-outs. Everything else is synthetic or assumed.
The Overview's **Assumptions & method** panel lists each one, read from the code itself. In
summary:

- **Drive time:** straight-line distance × 1.3 road factor, at an average 40 mph. The simulator
  adds 10 minutes to get going (20 overnight) and traffic: × 0.85 overnight, × 1.25 in weekday
  rush hours.
- **Coverage rule:** a site is covered with 2 or more eligible responders within 75 minutes,
  thin with 1 and uncovered with none. Eligible means in-date HV authorisation and insurance,
  and cover for that hour.
- **Recruitment plan:** five greedy picks; each adds one responder in the anchor town that covers
  the most criticality-weighted thin or uncovered sites.
- **Matching weights:** ETA 50, rating 25, availability 15, compliance 10.
- **Sector scoring weights:** cost of downtime 5, HV network prevalence 4, regulatory pressure 3,
  decision speed 3, partner access 3, competition from in-house teams 2. Scores are judgements to
  validate with MPN.
- **Pricing defaults:** Essentials £95, Standard £265 and Unlimited £325 a site a month (1, 3 and
  unlimited call-outs a year), £1,350 a call-out beyond the allowance with 85% to the responder,
  and a 10% supplier margin. Demand, costs and churn come from the synthetic data.
- **Pipeline:** stage probabilities from 5% (lead) to 100% (live); a deal is worth a year of
  its sector's recommended tier for every site. The cost of downtime runs from £500 to £40,000
  an hour by sector score.
- **Partners and suppliers** are working definitions, as the public site does not define them.

## 10-minute interview demo

Press **Start demo** on the Overview. Each step opens the page, highlights one element and
shows a callout to read aloud. **Next** and **Back** move between steps, and **Esc** exits.

| Time      | Step                              | What to show and say                                                                                                                                         |
| --------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0:00–1:00 | 1. Overview                       | Who I am and why this console. The four sides, the five KPIs and that every figure is computed live from synthetic data. Then press **Start demo**.           |
| 1:00–2:30 | 2. Simulator, scenario 2          | The data centre trip at 02:00 plays itself. Point at the four lanes: who acts when, the match and why that responder won, and the cost approval.              |
| 2:30–3:45 | 3. Network health                 | The recruitment plan: where one new responder closes the most critical gap. Mention the quicker win of renewing lapsed paperwork. Scroll up to the map if asked. |
| 3:45–4:45 | 4. Compliance                     | The highlighted responder is excluded from every job by the same rule as the simulator. Expiries are flagged 90 days ahead.                                     |
| 4:45–5:30 | 5. Data quality                   | Scores by dimension. A three-click request is only as good as the site and equipment data behind it, and every issue comes with a fix.                        |
| 5:30–6:45 | 6. Sector prioritisation          | The sector to win first and why. Move one weight to show the ranking and the check respond, then reset.                                                     |
| 6:45–7:45 | 7. Pricing break-even             | When membership pays for itself against ad hoc call-outs. Change one price to show the case and projection update, then reset.                               |
| 7:45–9:00 | 8. Proposal                       | Pick a lead and walk the one-page proposal: its sites, today's cover, downtime against membership, the tier and onboarding. Show the print preview.         |
| 9:00–10:00 | Finish, back to the Overview     | My first 90 days. Close on what I would validate first with MPN and the university, then take questions.                                                    |

Before the interview: open the live site once to warm the cache, reset any edits, and use a
1280–1440 px wide window in light mode.

## Deploying to Cloudflare Pages

```sh
npm run deploy      # builds, then deploys dist/ to the powersos-concept-noyal project
```

The first deploy asks you to log in to Cloudflare. The project name is deliberately unofficial,
so the URL can't be mistaken for a PowerSOS site.

- Build command: `npm run build`; output directory: `dist`.
- No `_redirects` file is needed: without a `404.html`, Pages serves the app for every path, so
  deep links and refreshes work on every route.
- `public/_headers` adds `X-Robots-Tag: noindex, nofollow`, matching the robots meta tag, so the
  prototype stays out of search engines.
