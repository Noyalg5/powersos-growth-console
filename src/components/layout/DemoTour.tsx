import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'
import { CloseIcon } from '@/components/icons'
import { DEMO_STEPS, type DemoStep } from '@/demo'
import {
  placeCallout,
  scrollTopFor,
  spotlight,
  TOUR_GAP,
  type Rect,
  type Size,
} from '@/lib/tour'
import { useDemoStore } from '@/store/demo'

/** How long to wait for a step's element while its page loads. */
const FIND_FOR_MS = 6000
/** Look again this long after scrolling, in case the page was still settling. */
const SETTLE_MS = 700

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Where the sticky header ends, so nothing is scrolled or placed underneath it. */
function headerBottom(): number {
  const header = document.querySelector('header')
  return header ? Math.max(0, header.getBoundingClientRect().bottom) : 0
}

function toRect(r: DOMRect): Rect {
  return {
    top: Math.round(r.top),
    left: Math.round(r.left),
    width: Math.round(r.width),
    height: Math.round(r.height),
  }
}

const sameRect = (a: Rect | null, b: Rect) =>
  a !== null && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height

interface Layout {
  viewport: Size
  callout: Size
  header: number
}

/**
 * The guided demo: opens each step's page, scrolls its element into view, dims the
 * rest of the screen and shows a callout beside it. Esc exits from anywhere.
 */
export function DemoTour() {
  const step = useDemoStore((s) => s.step)
  const go = useDemoStore((s) => s.go)

  useEffect(() => {
    if (step === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      go('exit')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step, go])

  // When the demo ends, put focus back on the button that started it, or the page
  const wasOpen = useRef(false)
  useEffect(() => {
    if (step !== null) {
      wasOpen.current = true
      return
    }
    if (!wasOpen.current) return
    wasOpen.current = false
    const start = document.querySelector<HTMLElement>('[data-demo-start]')
    if (start) start.focus()
    else document.getElementById('main')?.focus({ preventScroll: true })
  }, [step])

  const current = step === null ? undefined : DEMO_STEPS[step]
  if (step === null || !current) return null
  return createPortal(<TourStep key={step} step={current} index={step} />, document.body)
}

function TourStep({ step, index }: { step: DemoStep; index: number }) {
  const go = useDemoStore((s) => s.go)
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const callout = useRef<HTMLDivElement>(null)
  const next = useRef<HTMLButtonElement>(null)
  const [target, setTarget] = useState<Rect | null>(null)
  const [missing, setMissing] = useState(false)
  const [layout, setLayout] = useState<Layout | null>(null)
  const last = index === DEMO_STEPS.length - 1

  // Open the step's page. A step with a cue opens it even when it is already showing,
  // so the cue runs again on the way back
  const opened = useRef(false)
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    if (pathname + search !== step.to || step.cue) {
      navigate(step.to, { state: step.cue ? { demo: step.cue } : null })
    }
  }, [navigate, pathname, search, step])

  // Follow the element every frame: the page may still be loading, scrolling or animating
  useEffect(() => {
    const started = performance.now()
    let frame = 0
    let element: Element | null = null
    let scrolledAt: number | null = null
    let settled = false
    let pageTop = 0

    const scrollTo = (rect: DOMRect, header: number, reserve: number) => {
      const top = scrollTopFor(toRect(rect), window.scrollY, window.innerHeight, header, reserve)
      window.scrollTo({ top, behavior: reducedMotion() ? 'auto' : 'smooth' })
    }

    const tick = () => {
      if (!element?.isConnected) element = document.querySelector(`[data-demo="${step.target}"]`)
      const viewport = { width: window.innerWidth, height: window.innerHeight }
      const box = callout.current
      const size = box ? { width: box.offsetWidth, height: box.offsetHeight } : { width: 0, height: 0 }
      const header = headerBottom()
      setLayout((prev) =>
        prev &&
        prev.header === header &&
        prev.viewport.width === viewport.width &&
        prev.viewport.height === viewport.height &&
        prev.callout.width === size.width &&
        prev.callout.height === size.height
          ? prev
          : { viewport, callout: size, header },
      )

      const rect = element?.getBoundingClientRect()
      if (rect && rect.height > 0) {
        setMissing(false)
        // On a phone the callout covers the bottom of the screen, so keep the element above it
        const reserve = size.height + TOUR_GAP
        if (scrolledAt === null) {
          scrolledAt = performance.now()
          pageTop = rect.top + window.scrollY
          scrollTo(rect, header, reserve)
        } else if (!settled && performance.now() - scrolledAt > SETTLE_MS) {
          settled = true
          if (Math.abs(rect.top + window.scrollY - pageTop) > 24) scrollTo(rect, header, reserve)
        }
        const measured = toRect(rect)
        setTarget((prev) => (sameRect(prev, measured) ? prev : measured))
      } else {
        setTarget(null)
        if (performance.now() - started > FIND_FOR_MS) setMissing(true)
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [step.target])

  const ready = layout !== null && layout.callout.height > 0

  // Focus moves to Next once the callout is showing: a hidden button can't take focus
  useEffect(() => {
    if (ready) next.current?.focus({ preventScroll: true })
  }, [ready])
  const placement = layout
    ? placeCallout(target, layout.callout, layout.viewport, layout.header)
    : null
  const light = target && layout ? spotlight(target, layout.viewport) : null
  const sheet = placement?.kind === 'sheet'

  return (
    <div className="print:hidden">
      {light && light.height > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-40 rounded-xl shadow-[0_0_0_9999px_var(--scrim)] ring-2 ring-accent transition-[top,left,width,height] duration-200 motion-reduce:transition-none"
          style={{ top: light.top, left: light.left, width: light.width, height: light.height }}
        />
      )}
      <div
        ref={callout}
        role="dialog"
        aria-labelledby="demo-title"
        aria-describedby="demo-body"
        className={
          sheet
            ? 'fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl'
            : 'fixed z-50 w-96 max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-surface p-5 shadow-2xl transition-[top,left] duration-200 motion-reduce:transition-none'
        }
        style={{
          visibility: ready ? 'visible' : 'hidden',
          ...(placement && placement.kind !== 'sheet' && { top: placement.top, left: placement.left }),
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] tracking-wider text-accent-ink uppercase">
            Guided demo · {index + 1} of {DEMO_STEPS.length}
          </p>
          <button
            type="button"
            onClick={() => go('exit')}
            aria-label="Exit the demo"
            className="-m-1.5 rounded-md p-1.5 text-ink-subtle hover:bg-surface-muted hover:text-ink"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        <h2 id="demo-title" className="mt-2 text-base font-semibold tracking-tight text-ink">
          {step.title}
        </h2>
        <p id="demo-body" className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          {step.body}
        </p>
        {missing && (
          <p className="mt-2 text-xs text-ink-subtle">
            This part of the page isn&apos;t showing at the moment. Next carries on.
          </p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <ol className="flex gap-1" aria-hidden="true">
            {DEMO_STEPS.map((s, i) => (
              <li
                key={s.target}
                className={`h-1.5 rounded-full ${i === index ? 'w-4 bg-accent' : 'w-1.5 bg-line'}`}
              />
            ))}
          </ol>
          <span className="hidden text-xs text-ink-subtle sm:inline">Esc to exit</span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={index === 0 ? undefined : () => go('back')}
              aria-disabled={index === 0 || undefined}
              className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-muted aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-surface"
            >
              Back
            </button>
            <button
              ref={next}
              type="button"
              onClick={() => go('next')}
              className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-sm font-medium text-on-accent hover:brightness-95"
            >
              {last ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
