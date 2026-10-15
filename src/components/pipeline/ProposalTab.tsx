import { useMemo } from 'react'
import { PrinterIcon } from '@/components/icons'
import { demoTarget } from '@/demo'
import { formatNumber } from '@/lib/format'
import { PIPELINE_STAGES, type Board } from '@/lib/pipeline'
import { buildProposal, type ProposalInput, type SectorTerms } from '@/lib/proposal'
import type { SectorId } from '@/types'
import { control, Field } from './Field'
import { ProposalSheet } from './ProposalSheet'

interface ProposalTabProps {
  board: Board
  /** The lead shown; one on the board. */
  leadId: string
  onSelectLead: (leadId: string) => void
  /** Everything a proposal needs apart from the lead and its stage. */
  inputs: Omit<ProposalInput, 'lead' | 'stage' | 'recommendation' | 'downtimeScore'>
  /** Each sector's tier and cost of downtime, and where its call-out rate comes from. */
  sectorTerms: Readonly<Record<SectorId, SectorTerms>>
}

/** Pick a lead on the board and get a one-page proposal, ready to print or save as PDF. */
export function ProposalTab({ board, leadId, onSelectLead, inputs, sectorTerms }: ProposalTabProps) {
  const card = board.cards.find((c) => c.lead.id === leadId) ?? board.cards[0]
  const terms = card ? sectorTerms[card.lead.sector] : null
  const proposal = useMemo(
    () =>
      card && terms
        ? buildProposal({ ...inputs, lead: card.lead, stage: card.stage, ...terms })
        : null,
    [card, terms, inputs],
  )

  if (!card || !proposal || !terms) {
    return (
      <p className="rounded-xl border border-line bg-surface p-5 text-sm text-ink-muted">
        There are no open deals to write a proposal for.
      </p>
    )
  }

  return (
    <div className="space-y-6" {...demoTarget('proposal')}>
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-line bg-surface p-4 sm:p-5 print:hidden">
        <div className="w-full max-w-md">
          <Field label="Proposal for" htmlFor="proposal-lead">
            <select
              id="proposal-lead"
              className={control}
              value={card.lead.id}
              onChange={(e) => onSelectLead(e.target.value)}
            >
              {PIPELINE_STAGES.map((stage) => {
                const cards = board.cards.filter((c) => c.stage === stage.id)
                return (
                  cards.length > 0 && (
                    <optgroup key={stage.id} label={stage.label}>
                      {cards.map((c) => (
                        <option key={c.lead.id} value={c.lead.id}>
                          {c.lead.organisation} ({formatNumber(c.lead.estimatedSites)}{' '}
                          {c.lead.estimatedSites === 1 ? 'site' : 'sites'})
                        </option>
                      ))}
                    </optgroup>
                  )
                )
              })}
            </select>
          </Field>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-on-accent hover:brightness-95"
          >
            <PrinterIcon width={16} height={16} />
            Print / Save as PDF
          </button>
          <p className="text-xs text-ink-subtle">Prints on one A4 page, light on white.</p>
        </div>
      </div>
      <ProposalSheet proposal={proposal} rateBasis={terms.rateBasis} />
    </div>
  )
}
