/**
 * Keys for the edits kept in this browser, one per tool, so resetting one leaves the
 * others alone. Pages that read another page's edits (the Overview reads the sector
 * weights and card moves) use the same key. The theme key is in src/lib/theme.ts.
 */
export const STORAGE_KEYS = {
  firstNinetyDays: 'pgc-overview-90-days-v1',
  marketSectors: 'pgc-market-sectors-v1',
  marketAlternatives: 'pgc-market-alternatives-v1',
  marketPricing: 'pgc-market-pricing-v1',
  pipelineCrm: 'pgc-pipeline-crm-v1',
  pipelineVoice: 'pgc-pipeline-voice-v1',
  pipelineEvents: 'pgc-pipeline-events-v1',
} as const
