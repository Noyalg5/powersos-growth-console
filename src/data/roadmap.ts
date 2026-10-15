/**
 * The feature requests the feedback themes roll up into, each with one user story and
 * its acceptance criteria, and the backlog's starting RICE inputs and UAT results.
 * Written for the demo: the RICE inputs are assumptions to challenge.
 */
import type { FeatureProgress, FeatureRequest } from '@/types'

export const FEATURE_REQUESTS: readonly FeatureRequest[] = [
  {
    id: 'eta-texts',
    title: 'ETA updates by text for site contacts',
    themes: ['eta-updates'],
    story: {
      id: 'PS-101',
      asA: 'duty manager at a member site',
      iWant: "the responder's ETA by text, updated when it changes",
      soThat: 'I can arrange safe access for the crew without chasing anyone',
      criteria: [
        {
          given: 'a responder has accepted a job',
          when: 'the ETA is first set',
          then: "every emergency contact for the site gets a text with the responder's name and ETA",
        },
        {
          given: 'the first text has been sent',
          when: 'the ETA moves by 10 minutes or more',
          then: 'the contacts get an updated text and the job timeline shows the change',
        },
        {
          given: 'a contact has opted out of texts',
          when: 'the ETA changes',
          then: 'they get no text but still see the update in the app',
        },
      ],
    },
  },
  {
    id: 'asset-import',
    title: 'Bulk import of sites and equipment',
    themes: ['site-data'],
    story: {
      id: 'PS-102',
      asA: 'estates manager with many sites',
      iWant: 'to upload our site and equipment register from a spreadsheet',
      soThat: 'nobody has to key in every RMU and transformer by hand',
      criteria: [
        {
          given: "a file in the template's columns",
          when: 'I upload it',
          then: 'each valid row creates a site with its equipment and I see how many were added',
        },
        {
          given: 'a row with no postcode',
          when: 'I upload the file',
          then: 'the site is added and flagged for a postcode, not rejected',
        },
        {
          given: 'a site already on record with the same name and postcode',
          when: 'it appears in the file',
          then: 'the record is updated, not duplicated',
        },
      ],
    },
  },
  {
    id: 'spending-limits',
    title: 'Spending limits per site, with PO numbers',
    themes: ['cost-control'],
    story: {
      id: 'PS-103',
      asA: 'finance approver',
      iWant: "each job's predicted cost checked against a spending limit for the site",
      soThat: 'work over the limit waits for my sign-off and every invoice carries our PO number',
      criteria: [
        {
          given: 'a site with a spending limit',
          when: "a job's predicted cost is under the limit",
          then: 'the job goes ahead without waiting for approval',
        },
        {
          given: "a job's predicted cost is over the limit",
          when: 'the responder submits the prediction',
          then: 'the named approver is asked to approve and no parts are ordered until they do',
        },
        {
          given: 'a PO number entered at approval',
          when: 'the invoice is issued',
          then: 'it shows the PO number and lists labour and parts separately',
        },
      ],
    },
  },
  {
    id: 'evidence-pack',
    title: 'Compliance evidence pack for every job',
    themes: ['compliance-evidence'],
    story: {
      id: 'PS-104',
      asA: 'duty holder for a private HV network',
      iWant:
        "a pack for each job with the responder's authorisation, insurance, permit reference and switching log",
      soThat: 'I can show an auditor or insurer that an authorised person did the work',
      criteria: [
        {
          given: 'a closed job',
          when: 'I open its record',
          then: "I can download a PDF with the responder's HV authorisation and insurance as valid on the day",
        },
        {
          given: 'the job was done under a permit to work',
          when: 'the pack is generated',
          then: 'it shows the permit reference and each switching operation with its time',
        },
        {
          given: 'a quarter has ended',
          when: 'I ask for a summary',
          then: "I get every job's response time against the 75-minute target",
        },
      ],
    },
  },
  {
    id: 'remote-cover',
    title: 'Cover plan for sites beyond 75-minute reach',
    themes: ['remote-cover'],
    story: {
      id: 'PS-105',
      asA: 'customer with remote sites',
      iWant: 'to see which of my sites are beyond 75-minute reach and how each will be covered',
      soThat: 'I know the realistic response before I commit those sites',
      criteria: [
        {
          given: 'my sites are loaded',
          when: 'I open the coverage view',
          then: 'each site shows the eligible responders within reach and the best ETA',
        },
        {
          given: 'a site with no eligible responder within reach',
          when: 'I view it',
          then: "it is marked as outside the target with the nearest responder's estimated drive",
        },
        {
          given: 'a standby arrangement has been agreed for a site',
          when: 'it is recorded',
          then: 'the site shows the standby responder and the agreed response time',
        },
      ],
    },
  },
  {
    id: 'payout-status',
    title: 'Payment status for responders',
    themes: ['responder-payments'],
    story: {
      id: 'PS-106',
      asA: "responder's office manager",
      iWant: 'to see when each job will be paid and how much',
      soThat: 'I can plan cash flow without chasing invoices',
      criteria: [
        {
          given: 'a job is closed and the customer has approved the cost',
          when: 'I open payments',
          then: 'the job shows its payout and the expected payment date',
        },
        {
          given: 'a payout has been sent',
          when: 'I open the job',
          then: 'it shows as paid, with the date and a remittance reference',
        },
      ],
    },
  },
  {
    id: 'switching-documents',
    title: 'Switching programme and permit on the job',
    themes: ['safety-documents'],
    story: {
      id: 'PS-107',
      asA: 'authorised person on site',
      iWant: 'to attach the switching programme, permit to work and an updated network diagram to the job',
      soThat: 'the next crew at that site starts from an accurate record',
      criteria: [
        {
          given: 'I am on a job',
          when: 'I upload a switching programme or permit',
          then: 'it is stored against both the job and the site',
        },
        {
          given: 'a site has documents from earlier jobs',
          when: 'a new job there is accepted',
          then: 'the responder sees the latest network diagram before arriving',
        },
        {
          given: 'a document has been uploaded',
          when: 'the customer views the job',
          then: 'they can read it but not change it',
        },
      ],
    },
  },
  {
    id: 'stock-check',
    title: 'Spares and hire check from the job',
    themes: ['parts-sourcing'],
    story: {
      id: 'PS-108',
      asA: 'responder on site',
      iWant: 'to see which nearby suppliers have the part or generator I need, from the job',
      soThat: 'I can order before I leave site and cut the repair time',
      criteria: [
        {
          given: 'a job at a site with its equipment logged',
          when: 'I search for a part',
          then: 'I see suppliers that stock it, nearest first, with the date stock was confirmed',
        },
        {
          given: 'I have chosen a supplier',
          when: 'I request the part',
          then: 'the supplier gets the job reference, site address and delivery contact',
        },
        {
          given: 'a cable fault is confirmed',
          when: 'I ask for a jointing team',
          then: 'cable-jointing suppliers that cover the site are offered',
        },
      ],
    },
  },
  {
    id: 'cafm-link',
    title: 'Raise call-outs from the helpdesk system',
    themes: ['integrations'],
    story: {
      id: 'PS-109',
      asA: 'facilities helpdesk operator',
      iWant: 'HV call-outs logged in our CAFM system to reach PowerSOS automatically',
      soThat: 'no job is keyed twice or missed overnight',
      criteria: [
        {
          given: 'a CAFM job in the HV emergency category',
          when: 'it is logged',
          then: 'a request is raised for the matching site within a minute',
        },
        {
          given: 'the request changes status',
          when: 'the responder accepts or arrives',
          then: 'the CAFM job is updated with the status and ETA',
        },
        {
          given: 'the CAFM site has no match',
          when: 'the job is sent',
          then: 'the helpdesk is alerted to raise it by hand',
        },
      ],
    },
  },
  {
    id: 'referral-tracker',
    title: 'Referral tracking for partners',
    themes: ['partner-referrals'],
    story: {
      id: 'PS-110',
      asA: 'partner who refers organisations',
      iWant: 'to see where each organisation I referred has got to',
      soThat: 'I can follow up and report what the partnership is worth',
      criteria: [
        {
          given: 'I have a referral code',
          when: 'an organisation signs up with it',
          then: 'it appears in my referrals with its stage',
        },
        {
          given: 'a referred organisation goes live',
          when: 'I view my referrals',
          then: 'it shows as converted, with the date',
        },
      ],
    },
  },
]

/** Starting RICE inputs and UAT results, by feature ID. */
export const DEFAULT_PROGRESS: Readonly<Record<string, FeatureProgress>> = {
  'eta-texts': {
    rice: { reach: 45, impact: 2, confidence: 0.8, effort: 1.5 },
    uat: 'passed',
    testNote:
      'Passed on the test site: all three contacts had the first text within a minute, and a 12-minute slip sent an update.',
  },
  'asset-import': {
    rice: { reach: 30, impact: 2, confidence: 1, effort: 2 },
    uat: 'failed',
    testNote: 'AC2 failed: rows with no postcode were rejected outright. Defect raised; retest once fixed.',
  },
  'spending-limits': {
    rice: { reach: 50, impact: 1, confidence: 0.8, effort: 1 },
    uat: 'in-test',
    testNote: 'AC1 and AC2 passed. AC3 waiting on finance to sign off the invoice layout.',
  },
  'evidence-pack': {
    rice: { reach: 40, impact: 2, confidence: 0.8, effort: 2 },
    uat: 'in-test',
    testNote: 'Packs generated for 5 of 5 test jobs. Quarterly summary still to test.',
  },
  'remote-cover': {
    rice: { reach: 15, impact: 3, confidence: 0.5, effort: 3 },
    uat: 'not-started',
    testNote: '',
  },
  'payout-status': {
    rice: { reach: 35, impact: 1, confidence: 0.8, effort: 1 },
    uat: 'passed',
    testNote: 'Passed with two pilot responders; payment dates matched their remittances.',
  },
  'switching-documents': {
    rice: { reach: 25, impact: 2, confidence: 0.8, effort: 1.5 },
    uat: 'not-started',
    testNote: '',
  },
  'stock-check': {
    rice: { reach: 20, impact: 2, confidence: 0.5, effort: 3 },
    uat: 'not-started',
    testNote: '',
  },
  'cafm-link': {
    rice: { reach: 12, impact: 3, confidence: 0.5, effort: 4 },
    uat: 'not-started',
    testNote: '',
  },
  'referral-tracker': {
    rice: { reach: 10, impact: 1, confidence: 1, effort: 0.5 },
    uat: 'in-test',
    testNote: 'AC1 passed. AC2 in test with one partner.',
  },
}
