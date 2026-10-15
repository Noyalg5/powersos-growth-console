import { useCallback, useState } from 'react'

/**
 * The rendered width of an element, kept up to date as it resizes, so a chart can
 * draw at its real pixel size and its text stays legible at any width. Null until
 * the element is measured.
 */
export function useElementWidth<T extends HTMLElement>(): [
  (node: T | null) => void,
  number | null,
] {
  const [width, setWidth] = useState<number | null>(null)
  const ref = useCallback((node: T | null) => {
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}
