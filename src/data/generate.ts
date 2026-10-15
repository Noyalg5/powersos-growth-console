import { createRng, seedFor } from '@/lib/rng'
import type {
  CallOut,
  Customer,
  Lead,
  OnboardingRecord,
  Partner,
  Responder,
  Supplier,
  Timestamp,
} from '@/types'
import { generateCallOuts } from './callOuts'
import { generateCustomers } from './customers'
import { generateLeads } from './leads'
import { generateOnboarding } from './onboarding'
import { generatePartners } from './partners'
import { generateResponders } from './responders'
import { SCENARIOS } from './scenarios'
import { generateSuppliers } from './suppliers'

export interface Datasets {
  customers: Customer[]
  responders: Responder[]
  suppliers: Supplier[]
  partners: Partner[]
  callOuts: CallOut[]
  leads: Lead[]
}

/**
 * Every dataset, before any seeded issues are applied. Each dataset draws from
 * its own seeded stream, so changing one generator never reshuffles another.
 */
export function generateDatasets(asOf: Timestamp): Datasets {
  const customers = generateCustomers({ rng: createRng(seedFor('customers')), asOf })
  const responders = generateResponders({ rng: createRng(seedFor('responders')), asOf })
  const suppliers = generateSuppliers({ rng: createRng(seedFor('suppliers')), asOf })
  const partners = generatePartners({ rng: createRng(seedFor('partners')), asOf })
  const callOuts = generateCallOuts({
    rng: createRng(seedFor('call-outs')),
    customers,
    responders,
    asOf,
  })
  const leads = generateLeads({ rng: createRng(seedFor('leads')), partners, asOf })
  return { customers, responders, suppliers, partners, callOuts, leads }
}

/**
 * Onboarding records for the datasets, before their own planted issues. They draw
 * from a stream of their own, so adding them changed none of the datasets.
 */
export function generateOnboardingRecords(data: Datasets, asOf: Timestamp): OnboardingRecord[] {
  // The simulator's scenarios happen today, so their customers stay active members
  const keepActive = new Set(
    SCENARIOS.flatMap((s) =>
      data.customers.filter((c) => c.sites.some((site) => site.id === s.siteId)).map((c) => c.id),
    ),
  )
  return generateOnboarding({ rng: createRng(seedFor('onboarding')), asOf, ...data, keepActive })
}
