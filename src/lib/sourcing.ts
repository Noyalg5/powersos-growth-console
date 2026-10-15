/**
 * Supplier sourcing: find the part or hire unit a job needs, check stock and
 * estimate delivery to site. Suppliers are a working definition (docs/brief.md).
 */
import type { LatLng, Region, StockItem, Supplier, SupplierCategory, Timestamp } from '@/types'
import { formatNumber } from './format'
import { estimateDriveMinutes, haversineMiles } from './geo'
import { DAY_MS, isWeekend, londonClock, MINUTE_MS } from './time'

/** Picking and loading a same-day order before the vehicle leaves. */
export const LOAD_OUT_MINUTES = 60

export interface ItemRequest {
  category: SupplierCategory
  /** Hire plant comes back at the end of the job; parts are fitted. */
  purpose: 'part' | 'hire'
  /** An exact catalogue line, e.g. "Trip battery and charger". */
  description?: string
  /** Or the smallest unit rated at least this many kVA. */
  minKva?: number
}

/** "1,000 kVA containerised generator" → 1000. Null when no kVA rating is given. */
export function parseKva(description: string): number | null {
  const match = /(\d[\d,]*)\s*kVA/.exec(description)
  return match?.[1] ? Number(match[1].replaceAll(',', '')) : null
}

function matches(item: StockItem, request: ItemRequest): boolean {
  if (request.description !== undefined) return item.description === request.description
  if (request.minKva !== undefined) {
    const kva = parseKva(item.description)
    return kva !== null && kva >= request.minKva
  }
  throw new RangeError('An item request needs a description or a minimum kVA')
}

/** Weekdays 08:00–17:59 London time, when every supplier takes orders. */
export function isTradingHours(at: Timestamp): boolean {
  const { hour } = londonClock(at)
  return !isWeekend(at) && hour >= 8 && hour < 18
}

/**
 * When an order placed at `orderedAt` reaches site: same-day orders are loaded and
 * driven straight there; anything else arrives the stated number of days later.
 */
export function deliveryTime(orderedAt: Timestamp, leadTimeDays: number, driveMinutes: number) {
  if (!Number.isInteger(leadTimeDays) || leadTimeDays < 0) {
    throw new RangeError(`leadTimeDays must be a non-negative integer, got ${leadTimeDays}`)
  }
  if (leadTimeDays > 0) return orderedAt + leadTimeDays * DAY_MS
  const minutes = Math.round(LOAD_OUT_MINUTES + driveMinutes)
  return orderedAt + minutes * MINUTE_MS
}

export type SupplierExclusionCode = 'region' | 'no-emergency-line' | 'not-stocked'

export interface SupplierCheck {
  supplier: Supplier
  /** The best matching line, or null when nothing in stock or on order matches. */
  item: StockItem | null
  miles: number
  /** Days to delivery for this order: 0 for same day. */
  leadTimeDays: number | null
  /** Null when the supplier is excluded. */
  deliveryAt: Timestamp | null
  exclusions: { code: SupplierExclusionCode; label: string }[]
}

export interface SourcingResult {
  request: ItemRequest
  /** Every supplier in the category: usable ones first, best first. */
  checks: SupplierCheck[]
  chosen: SupplierCheck | null
}

/** The smallest matching line, preferring one that is in stock. */
function bestItem(stock: readonly StockItem[], request: ItemRequest): StockItem | null {
  const candidates = stock
    .filter((item) => matches(item, request))
    .sort(
      (a, b) =>
        Number(b.quantity > 0) - Number(a.quantity > 0) ||
        (parseKva(a.description) ?? 0) - (parseKva(b.description) ?? 0) ||
        a.leadTimeDays - b.leadTimeDays,
    )
  return candidates[0] ?? null
}

/**
 * Check every supplier in the category for an emergency order placed at
 * `orderedAt`. A supplier is excluded when it does not deliver to the site's
 * region, cannot take the order at that hour, or has no matching line. Suppliers
 * with an emergency line send in-stock items the same day; otherwise the line's
 * lead time applies. Of the rest, in-stock beats back-order, then the earliest
 * delivery wins, then the nearest.
 */
export function sourceItem(
  suppliers: readonly Supplier[],
  request: ItemRequest,
  site: LatLng & { region: Region },
  orderedAt: Timestamp,
): SourcingResult {
  const outOfHours = !isTradingHours(orderedAt)

  const checks = suppliers
    .filter((supplier) => supplier.category === request.category)
    .map((supplier): SupplierCheck => {
      const miles = Math.round(haversineMiles(supplier, site) * 10) / 10
      const item = bestItem(supplier.stock, request)
      const exclusions: SupplierCheck['exclusions'] = []
      if (!supplier.regionsServed.includes(site.region)) {
        exclusions.push({ code: 'region', label: `Doesn't deliver to ${site.region}` })
      }
      if (outOfHours && !supplier.emergencyLine) {
        exclusions.push({ code: 'no-emergency-line', label: 'No out-of-hours order line' })
      }
      if (!item) exclusions.push({ code: 'not-stocked', label: 'Not in its catalogue' })
      if (exclusions.length > 0 || !item) {
        return { supplier, item, miles, leadTimeDays: null, deliveryAt: null, exclusions }
      }
      const leadTimeDays = item.quantity > 0 && supplier.emergencyLine ? 0 : item.leadTimeDays
      const deliveryAt = deliveryTime(orderedAt, leadTimeDays, estimateDriveMinutes(miles))
      return { supplier, item, miles, leadTimeDays, deliveryAt, exclusions }
    })
    .sort((a, b) => {
      if (a.deliveryAt === null || b.deliveryAt === null) {
        return Number(a.deliveryAt === null) - Number(b.deliveryAt === null) || a.miles - b.miles
      }
      return (
        Number((b.item?.quantity ?? 0) > 0) - Number((a.item?.quantity ?? 0) > 0) ||
        a.deliveryAt - b.deliveryAt ||
        a.miles - b.miles
      )
    })

  const first = checks[0]
  return { request, checks, chosen: first && first.deliveryAt !== null ? first : null }
}

/** "2 in stock", "31 drums in stock" or "Out of stock: 36-day lead time". */
export function describeStock(item: StockItem): string {
  if (item.quantity === 0) return `Out of stock: ${item.leadTimeDays}-day lead time`
  const unit = item.unit === 'each' || item.unit === 'units' ? '' : ` ${item.unit}`
  return `${formatNumber(item.quantity)}${unit} in stock`
}
