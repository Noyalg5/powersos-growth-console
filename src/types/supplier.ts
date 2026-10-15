import type { Contact, LatLng, Region, Timestamp } from './common'

export type SupplierCategory =
  'transformers' | 'switchgear' | 'generator-hire' | 'cable-jointing' | 'fuel'

export interface StockItem {
  description: string
  quantity: number
  unit: string
  /** Days from order to delivery on site. */
  leadTimeDays: number
}

export interface Supplier extends LatLng {
  id: string
  name: string
  category: SupplierCategory
  town: string
  region: Region
  regionsServed: Region[]
  /** Answers emergency orders around the clock. */
  emergencyLine: boolean
  stock: StockItem[]
  joinedAt: Timestamp
  contact: Contact
}
