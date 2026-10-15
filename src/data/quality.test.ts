import { describe, expect, it } from 'vitest'
import {
  checkAnswerKey,
  PLANTED_ISSUE_RULES,
  runQualityChecks,
  type QualityData,
} from '@/lib/dataQuality'
import { isOnMainland } from '@/lib/mainland'
import type { OnboardingRecord, SeededIssue, SeededOnboardingIssue } from '@/types'
import { generateDatasets, generateOnboardingRecords, type Datasets } from './generate'
import * as data from './index'
import { applyOnboardingIssues, applySeededIssues } from './issues'

const { DATA_AS_OF, SEEDED_ISSUES, SEEDED_ONBOARDING_ISSUES } = data
const PLANTED = [...SEEDED_ISSUES, ...SEEDED_ONBOARDING_ISSUES]

const qualityData = (d: Datasets, onboarding: readonly OnboardingRecord[]): QualityData => ({
  ...d,
  sites: d.customers.flatMap((c) => c.sites),
  onboarding,
})
const check = (d: QualityData) => runQualityChecks(d, DATA_AS_OF)

const clean = generateDatasets(DATA_AS_OF)
const cleanOnboarding = generateOnboardingRecords(clean, DATA_AS_OF)
const report = check(data)

describe('data quality on the synthetic data', () => {
  it('raises nothing on the data before any issues are planted', () => {
    expect(check(qualityData(clean, cleanOnboarding)).issues).toEqual([])
  })

  it('finds every planted issue and nothing else', () => {
    const result = checkAnswerKey(report.issues, PLANTED)
    expect(result.missed).toEqual([])
    expect(result.unexpected).toEqual([])
    expect(result.found).toHaveLength(PLANTED.length)
    expect(report.issues).toHaveLength(9)
  })

  it.each(SEEDED_ISSUES.map((i) => [i.kind, i] as const))(
    'finds the seeded %s with its related record',
    (_kind, issue: SeededIssue) => {
      const found = report.issues.find(
        (i) => i.ruleId === PLANTED_ISSUE_RULES[issue.kind] && i.recordId === issue.recordId,
      )
      expect(found?.dataset).toBe(issue.dataset)
      if (issue.relatedId !== null) expect(found?.relatedId).toBe(issue.relatedId)
    },
  )

  it.each(SEEDED_ONBOARDING_ISSUES.map((i) => [i.kind, i] as const))(
    'finds the planted %s in its dataset',
    (_kind, issue: SeededOnboardingIssue) => {
      const found = report.issues.find(
        (i) => i.ruleId === PLANTED_ISSUE_RULES[issue.kind] && i.recordId === issue.recordId,
      )
      expect(found?.dataset).toBe(issue.dataset)
    },
  )

  it.each([
    ...SEEDED_ISSUES.map(
      (issue) =>
        [
          issue.kind,
          () => qualityData(applySeededIssues(clean, [issue]), cleanOnboarding),
          issue,
        ] as const,
    ),
    ...SEEDED_ONBOARDING_ISSUES.map(
      (issue) =>
        [
          issue.kind,
          () => qualityData(clean, applyOnboardingIssues(cleanOnboarding, [issue])),
          issue,
        ] as const,
    ),
  ])('raises exactly one issue when %s is planted on its own', (_kind, planted, issue) => {
    expect(check(planted()).issues.map((i) => [i.ruleId, i.recordId])).toEqual([
      [PLANTED_ISSUE_RULES[issue.kind], issue.recordId],
    ])
  })

  it('scores every check that ran', () => {
    expect(report.overall).toMatchObject({ rules: 33, checks: 6005, failed: 9, score: 0.998 })
    expect(report.byDimension.timeliness.score).toBe(0.969)
  })

  it('places every anchor town, site and depot on the mainland outline', () => {
    const points = [...data.TOWNS, ...data.sites, ...data.responders, ...data.suppliers]
    expect(points.filter((p) => !isOnMainland(p))).toEqual([])
  })
})
