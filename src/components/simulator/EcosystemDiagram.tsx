import { useId } from 'react'

type NodeId = 'customer' | 'responder' | 'supplier' | 'partner'

const NODES: Record<NodeId, { title: string; gives: string; gets: string; working: boolean }> = {
  customer: {
    title: 'End customers',
    gives: 'Jobs, fees and site data',
    gets: 'Authorised help in 75 min',
    working: false,
  },
  responder: {
    title: 'Responders',
    gives: 'HV-authorised crews, 24/7',
    gets: 'Steady work near the depot',
    working: false,
  },
  supplier: {
    title: 'Suppliers',
    gives: 'Parts and plant, delivered',
    gets: 'Approved emergency orders',
    working: true,
  },
  partner: {
    title: 'Partners',
    gives: 'Referrals and site access',
    gets: 'Reports and incident records',
    working: true,
  },
}

interface Flow {
  label: string
  /** Line from (x1, y1) to (x2, y2), arrowhead at the end. */
  line: [x1: number, y1: number, x2: number, y2: number]
  text: [x: number, y: number, anchor: 'start' | 'middle' | 'end']
}

interface Layout {
  width: number
  height: number
  nodeWidth: number
  nodes: Record<NodeId, [x: number, y: number]>
  flows: Flow[]
  hub?: { cx: number; cy: number; r: number; spokes: [x: number, y: number][] }
}

const NODE_HEIGHT = 108

/** A square: customers and responders on top, partners and suppliers below. */
const WIDE: Layout = {
  width: 780,
  height: 430,
  nodeWidth: 260,
  nodes: { customer: [10, 10], responder: [510, 10], partner: [10, 312], supplier: [510, 312] },
  flows: [
    { label: 'jobs', line: [278, 46, 502, 46], text: [390, 36, 'middle'] },
    { label: 'fast response', line: [502, 78, 278, 78], text: [390, 98, 'middle'] },
    { label: 'referrals', line: [100, 304, 100, 126], text: [90, 219, 'end'] },
    { label: 'closing reports', line: [170, 126, 170, 304], text: [180, 219, 'start'] },
    { label: 'orders', line: [600, 126, 600, 304], text: [590, 219, 'end'] },
    { label: 'parts and plant', line: [670, 304, 670, 126], text: [680, 219, 'start'] },
  ],
  hub: {
    cx: 390,
    cy: 215,
    r: 70,
    spokes: [
      [270, 118],
      [510, 118],
      [270, 312],
      [510, 312],
    ],
  },
}

/** A chain for phones: partners, customers, responders, suppliers. */
const NARROW: Layout = {
  width: 360,
  height: 740,
  nodeWidth: 320,
  nodes: { partner: [20, 10], customer: [20, 214], responder: [20, 418], supplier: [20, 622] },
  flows: [
    { label: 'referrals', line: [130, 126, 130, 206], text: [120, 170, 'end'] },
    { label: 'closing reports', line: [230, 206, 230, 126], text: [240, 170, 'start'] },
    { label: 'jobs', line: [130, 330, 130, 410], text: [120, 374, 'end'] },
    { label: 'fast response', line: [230, 410, 230, 330], text: [240, 374, 'start'] },
    { label: 'orders', line: [130, 534, 130, 614], text: [120, 578, 'end'] },
    { label: 'parts and plant', line: [230, 614, 230, 534], text: [240, 578, 'start'] },
  ],
}

const DESCRIPTION =
  'Partners refer customers and receive closing reports. Customers send jobs to responders and get a fast, authorised response. Responders place orders with suppliers and get parts and plant on site. The platform in the middle matches, tracks and approves.'

function Diagram({ layout, className }: { layout: Layout; className: string }) {
  const id = useId()
  const arrow = `${id}-arrow`
  const { nodeWidth: w } = layout

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
      className={className}
    >
      <title id={`${id}-title`}>What each of the four sides gives and gets</title>
      <desc id={`${id}-desc`}>{DESCRIPTION}</desc>
      <defs>
        <marker
          id={arrow}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0 10 5 0 10z" className="fill-ink-subtle" />
        </marker>
      </defs>

      {layout.hub && (
        <g>
          {layout.hub.spokes.map(([x, y]) => (
            <line
              key={`${x}-${y}`}
              x1={layout.hub?.cx}
              y1={layout.hub?.cy}
              x2={x}
              y2={y}
              strokeDasharray="4 5"
              className="stroke-line"
              strokeWidth={1.5}
            />
          ))}
          <circle
            cx={layout.hub.cx}
            cy={layout.hub.cy}
            r={layout.hub.r}
            className="fill-accent-soft stroke-accent"
            strokeWidth={1.5}
          />
          <text
            x={layout.hub.cx}
            y={layout.hub.cy - 8}
            textAnchor="middle"
            className="fill-ink text-[14px] font-semibold"
          >
            Platform
          </text>
          <text
            x={layout.hub.cx}
            y={layout.hub.cy + 12}
            textAnchor="middle"
            className="fill-ink-muted text-[11px]"
          >
            match · track · approve
          </text>
        </g>
      )}

      {layout.flows.map(({ label, line: [x1, y1, x2, y2], text: [tx, ty, anchor] }) => (
        <g key={label}>
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className="stroke-ink-subtle"
            strokeWidth={1.5}
            markerEnd={`url(#${arrow})`}
          />
          <text
            x={tx}
            y={ty}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-ink-muted text-[12px]"
          >
            {label}
          </text>
        </g>
      ))}

      {(Object.keys(NODES) as NodeId[]).map((node) => {
        const [x, y] = layout.nodes[node]
        const { title, gives, gets, working } = NODES[node]
        return (
          <g key={node}>
            <rect
              x={x}
              y={y}
              width={w}
              height={NODE_HEIGHT}
              rx={14}
              className="fill-surface stroke-line"
              strokeWidth={1.5}
            />
            <text x={x + 16} y={y + 30} className="fill-ink text-[14px] font-semibold">
              {title}
            </text>
            {working && (
              <text
                x={x + w - 16}
                y={y + 30}
                textAnchor="end"
                className="fill-ink-subtle text-[10px]"
              >
                Working definition
              </text>
            )}
            <text x={x + 16} y={y + 62} className="text-[12px]">
              <tspan className="fill-ink-subtle">Gives </tspan>
              <tspan className="fill-ink-muted">{gives}</tspan>
            </text>
            <text x={x + 16} y={y + 86} className="text-[12px]">
              <tspan className="fill-ink-subtle">Gets </tspan>
              <tspan className="fill-ink-muted">{gets}</tspan>
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const NETWORK_EFFECT = [
  'More responders put an authorised crew closer to every site, so ETAs fall.',
  'Faster, dependable ETAs win more customers, and each one pre-loads more sites.',
  'More customers mean more jobs, which keeps responders busy and draws new ones in.',
  'Suppliers and partners compound it: steady jobs justify stock near demand, and every closing report gives a partner a reason to refer.',
]

export function EcosystemDiagram() {
  return (
    <section aria-labelledby="four-sides-heading" className="mt-14">
      <h2 id="four-sides-heading" className="text-sm font-semibold text-ink">
        Why the four sides need each other
      </h2>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-muted">
        Each side gives something another needs. The platform keeps the exchange fast and
        trustworthy, which is what makes the network worth joining.
      </p>

      <figure className="mt-4 rounded-xl border border-line bg-surface p-4 sm:p-6">
        <Diagram layout={WIDE} className="mx-auto hidden h-auto w-full max-w-4xl md:block" />
        <Diagram layout={NARROW} className="mx-auto h-auto w-full max-w-sm md:hidden" />
      </figure>

      <div className="mt-4 rounded-xl border border-line bg-surface p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-ink">The network effect</h3>
        <ol className="mt-3 grid gap-3 sm:grid-cols-2">
          {NETWORK_EFFECT.map((line, i) => (
            <li key={line} className="flex gap-3 text-sm leading-relaxed text-ink-muted">
              <span className="font-mono text-xs text-accent-ink tabular-nums">
                {i + 1}
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
