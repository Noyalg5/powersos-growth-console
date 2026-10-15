/**
 * The emergencies the Ecosystem simulator plays out. Each one picks real records
 * from the synthetic data (a site, the failed equipment, the site's facilities
 * manager and insurer) and leaves everything else to the simulation: who is
 * matched, what is sourced from whom, and what it costs.
 *
 * Which partner manages or insures a site is not in the data, so each scenario
 * names one: a working definition, like partners themselves.
 */
import { faultHistory, hireDayRate } from '@/lib/costs'
import type { ScenarioInput } from '@/lib/scenario'
import type { ItemRequest } from '@/lib/sourcing'
import type {
  CallOut,
  Customer,
  EquipmentKind,
  FaultType,
  Partner,
  PartnerKind,
  Responder,
  Supplier,
  Timestamp,
} from '@/types'
import { FAULT_LABELS } from './labels'

export type ScenarioId = 'hospital' | 'data-centre' | 'warehouse'

export interface ScenarioSpec {
  id: ScenarioId
  title: string
  /** One line for the scenario picker. */
  summary: string
  siteId: string
  equipmentId: string
  equipmentKind: EquipmentKind
  faultType: FaultType
  requestedAt: Timestamp
  basis: ScenarioInput['basis']
  orders: readonly ItemRequest[]
  facilitiesId: string
  insurerId: string
  story: ScenarioInput['story']
}

export const SCENARIOS: readonly ScenarioSpec[] = [
  {
    id: 'hospital',
    title: 'Hospital loses supply',
    summary: 'Transformer fault at Oxford Hospital. A hire generator restores the wards it feeds.',
    siteId: 'SITE-027',
    // The older of the hospital's two 800 kVA transformers
    equipmentId: 'SITE-027-E4',
    equipmentKind: 'transformer',
    faultType: 'transformer',
    // Wednesday 14 Oct 2026, 10:40 London time
    requestedAt: Date.UTC(2026, 9, 14, 9, 40),
    basis: 'typical',
    orders: [
      // 60% of the failed 800 kVA transformer: the essential load, the same rule
      // the sites' own standby generators are sized by
      { category: 'generator-hire', purpose: 'hire', minKva: 480 },
    ],
    facilitiesId: 'PTN-003',
    insurerId: 'PTN-007',
    story: {
      request:
        'One of the two transformers has failed, cutting supply to the wards it feeds. The standby generator is holding essential circuits only.',
      onSite:
        'Isolated the failed transformer. The hire generator will connect to its LV board to restore the wards.',
      resolved: 'Transformer repaired, tested and back on load. The hire generator is off hire.',
    },
  },
  {
    id: 'data-centre',
    title: 'Data centre trip at 02:00',
    summary:
      'Switchgear trip overnight at Preston Data Centre. Tests who has overnight cover nearby.',
    siteId: 'SITE-130',
    equipmentId: 'SITE-130-E2',
    equipmentKind: 'switchgear',
    faultType: 'switchgear-trip',
    // Wednesday 14 Oct 2026, 02:00 London time
    requestedAt: Date.UTC(2026, 9, 14, 1, 0),
    basis: 'typical',
    orders: [
      { category: 'switchgear', purpose: 'part', description: 'Trip battery and charger' },
    ],
    facilitiesId: 'PTN-002',
    insurerId: 'PTN-008',
    story: {
      request:
        'The HV switchboard has tripped. The data centre is running on UPS and its standby generator.',
      onSite:
        "Traced the trip to a failed trip battery: the incomer's undervoltage release dropped out. Made safe while a replacement is brought in.",
      resolved:
        'Trip battery and charger replaced, protection tested and the board re-closed. The data centre is back on mains.',
    },
  },
  {
    id: 'warehouse',
    title: 'Warehouse transformer replaced',
    summary:
      'A lorry strike leaves the transformer at Brighton Distribution Centre leaning. A new 1,250 kVA unit replaces it.',
    siteId: 'SITE-127',
    equipmentId: 'SITE-127-E3',
    equipmentKind: 'transformer',
    faultType: 'transformer',
    // Wednesday 14 Oct 2026, 09:05 London time
    requestedAt: Date.UTC(2026, 9, 14, 8, 5),
    // A whole new transformer: the largest transformer job on record
    basis: 'largest',
    orders: [
      {
        category: 'transformers',
        purpose: 'part',
        description: '1,250 kVA 11/0.433 kV ground-mounted transformer',
      },
    ],
    facilitiesId: 'PTN-001',
    insurerId: 'PTN-007',
    story: {
      request:
        'A reversing lorry has struck the substation compound. The 1,250 kVA transformer is leaning on its plinth and weeping oil.',
      onSite:
        'Isolated the damaged transformer, moved the site onto its standby generator and contained the oil.',
      resolved: 'New 1,250 kVA transformer installed, tested and energised. The site is back on mains.',
    },
  },
]

export function getScenario(id: ScenarioId): ScenarioSpec {
  const spec = SCENARIOS.find((s) => s.id === id)
  if (!spec) throw new Error(`Unknown scenario: ${id}`)
  return spec
}

export interface ScenarioData {
  customers: readonly Customer[]
  responders: readonly Responder[]
  suppliers: readonly Supplier[]
  partners: readonly Partner[]
  callOuts: readonly CallOut[]
}

function findPartner(partners: readonly Partner[], id: string, kind: PartnerKind): Partner {
  const partner = partners.find((p) => p.id === id)
  if (!partner) throw new Error(`Scenario refers to unknown partner ${id}`)
  if (partner.kind !== kind) throw new Error(`${id} is ${partner.kind}, expected ${kind}`)
  return partner
}

/**
 * Look up the records a scenario names. Throws if the data has drifted so a
 * scenario no longer fits, so the simulator never quietly plays out the wrong story.
 */
export function resolveScenario(spec: ScenarioSpec, data: ScenarioData): ScenarioInput {
  const customer = data.customers.find((c) => c.sites.some((s) => s.id === spec.siteId))
  const site = customer?.sites.find((s) => s.id === spec.siteId)
  if (!customer || !site) throw new Error(`Scenario refers to unknown site ${spec.siteId}`)
  const equipment = site.equipment.find((e) => e.id === spec.equipmentId)
  if (equipment?.kind !== spec.equipmentKind) {
    throw new Error(`${site.id} has no ${spec.equipmentKind} ${spec.equipmentId}`)
  }

  return {
    id: spec.id,
    title: spec.title,
    customer,
    site,
    equipment,
    faultType: spec.faultType,
    faultLabel: FAULT_LABELS[spec.faultType],
    requestedAt: spec.requestedAt,
    story: spec.story,
    responders: data.responders,
    suppliers: data.suppliers,
    orders: spec.orders,
    facilities: findPartner(data.partners, spec.facilitiesId, 'facilities-management'),
    insurer: findPartner(data.partners, spec.insurerId, 'insurer'),
    history: faultHistory(data.callOuts, spec.faultType),
    basis: spec.basis,
    hireDayRate: hireDayRate(data.callOuts),
  }
}
