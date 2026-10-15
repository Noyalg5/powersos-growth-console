/**
 * Whether a point is on mainland Great Britain, the area PowerSOS serves.
 *
 * The outline follows the coast loosely, a few kilometres offshore, and cuts across
 * estuaries and bays. It is for catching coordinates that are plainly wrong (in
 * Ireland, at sea, on the far islands, latitude and longitude swapped), not for
 * surveying: islands close to the coast, such as Anglesey, Arran and the Isle of
 * Wight, fall inside it.
 */
import type { LatLng } from './geo'

type Vertex = readonly [lat: number, lng: number]

/** Clockwise from Cape Wrath: north coast, east coast, south coast, then up the west. */
export const MAINLAND_OUTLINE: readonly Vertex[] = [
  // North coast
  [58.7, -5.1],
  [58.72, -3.4],
  [58.68, -2.95],
  // East coast of Scotland
  [58.44, -2.95],
  [58.1, -3.5],
  [57.9, -3.65],
  [57.76, -3.25],
  [57.73, -1.95],
  [57.55, -1.7],
  [57.15, -1.95],
  [56.71, -2.35],
  [56.29, -2.45],
  [55.93, -2.05],
  // East coast of England
  [55.77, -1.9],
  [55.65, -1.65],
  [55.02, -1.3],
  [54.69, -1.05],
  [54.5, -0.5],
  [54.12, 0.05],
  [53.58, 0.25],
  [53.15, 0.45],
  [52.98, 0.5],
  [53.0, 1.3],
  [52.48, 1.85],
  [52.08, 1.68],
  [51.93, 1.42],
  [51.8, 1.3],
  [51.58, 1.05],
  [51.39, 1.5],
  [51.13, 1.45],
  // South coast
  [50.9, 1.05],
  [50.7, 0.25],
  [50.76, -0.14],
  [50.68, -0.79],
  [50.53, -1.3],
  [50.55, -2.05],
  [50.48, -2.46],
  [50.18, -3.64],
  [50.28, -4.22],
  [49.93, -5.2],
  [50.05, -5.78],
  // North Devon, Somerset and the Bristol Channel
  [50.57, -5.1],
  [51.04, -4.6],
  [51.26, -3.79],
  // Wales
  [51.4, -3.56],
  [51.54, -4.36],
  [51.6, -4.7],
  [51.58, -4.95],
  [51.67, -5.25],
  [51.9, -5.38],
  [52.04, -5.13],
  [52.24, -4.45],
  [52.42, -4.15],
  [52.72, -4.15],
  [52.76, -4.8],
  [52.97, -4.62],
  [53.29, -4.75],
  [53.42, -4.6],
  [53.44, -4.29],
  [53.36, -3.86],
  [53.37, -3.32],
  // North West England
  [53.42, -3.2],
  [53.56, -3.12],
  [53.82, -3.1],
  [53.94, -3.08],
  [54.05, -3.3],
  [54.51, -3.68],
  [54.72, -3.52],
  [54.85, -3.62],
  // South West Scotland
  [54.76, -4.05],
  [54.66, -4.4],
  [54.62, -4.9],
  [54.84, -5.18],
  [55.02, -5.2],
  [55.24, -4.95],
  [55.46, -4.72],
  [55.29, -5.85],
  // West Highlands, keeping Islay, Jura, Mull and Skye out
  [55.75, -5.65],
  [56.05, -5.75],
  [56.4, -5.58],
  [56.55, -5.75],
  [56.73, -6.25],
  [57.0, -5.9],
  [57.28, -5.76],
  [57.43, -5.85],
  [57.86, -5.85],
  [58.1, -5.48],
  [58.26, -5.42],
]

/**
 * Ray casting on latitude and longitude as if they were flat: plenty accurate at this
 * scale for an outline this loose.
 */
export function isOnMainland({ lat, lng }: LatLng): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  let inside = false
  for (let i = 0, j = MAINLAND_OUTLINE.length - 1; i < MAINLAND_OUTLINE.length; j = i++) {
    const [latI, lngI] = MAINLAND_OUTLINE[i] as Vertex
    const [latJ, lngJ] = MAINLAND_OUTLINE[j] as Vertex
    const crosses =
      latI > lat !== latJ > lat && lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI
    if (crosses) inside = !inside
  }
  return inside
}
