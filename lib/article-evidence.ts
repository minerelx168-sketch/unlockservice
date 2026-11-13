// Page-specific editorial additions. New daily articles still live in articles.ts.
import type { Article, ArticleBlock, ArticleFaq } from './articles'

const link = (label: string, href: string) => ({ label, href })
const p = (text: string, ...links: ReturnType<typeof link>[]): ArticleBlock => ({ kind: 'p', text, links })
const h = (id: string, text: string): ArticleBlock => ({ kind: 'h2', id, text })
const table = (head: string[], rows: string[][]): ArticleBlock => ({ kind: 'table', head, rows })
const steps = (...items: string[]): ArticleBlock => ({ kind: 'list', ordered: true, items })
const cta = (text: string, href: string, label: string): ArticleBlock => ({ kind: 'cta', text, href, label })
const qa = (question: string, answer: string): ArticleFaq => ({ question, answer })
const appleId = link('Apple: find the identifier printed by the device', 'https://support.apple.com/en-us/108037')
const appleLock = link('Apple: read Carrier Lock and verify an approved unlock', 'https://support.apple.com/en-us/109316')
const appleUsed = link('Apple: inspect a pre-owned iPhone', 'https://support.apple.com/en-us/104999')
const gsmaTac = link('GSMA: what the TAC identifies', 'https://www.gsma.com/solutions-and-impact/technologies/security/faq/')
const gsmaCheck = link('GSMA: interpret a device block-list result', 'https://devicecheck.gsma.com/rtlapp/faqs/')
const ctia = link('CTIA: what a Stolen Phone Checker result means', 'https://www.stolenphonechecker.org/spc/faqs.jsp')

type Edit = {
  lead?: string
  /** Preserve original section anchors if replacing a legacy guide. */
  body?: ArticleBlock[]
  faq?: ArticleFaq[]
  /** Insert at the end of the introduction only when a comparison is missing. */
  comparison?: ArticleBlock[]
}

const editions: Record<string, Edit | undefined> = {
  'telus-iphone-unlock-security-lock-guide': {
    lead: "If a TELUS iPhone still shows a carrier restriction, ask TELUS to check the activation record for that handset. If Settings already shows “No SIM restrictions,” do not wait for an unlock timer: ask the provider of the failing SIM or eSIM to check the line instead.",
  },
  'rogers-iphone-unlock-sim-locked-guide': {
    lead: "A Rogers SIM tells you which network the line uses, not which company locked the iPhone. Check Settings → General → About → Carrier Lock. If a restriction remains, find out who supplied the handset before asking Rogers to change anything.",
  },
  'can-you-unlock-financed-iphone-before-payoff': {
    lead: "A financed iPhone can be unlocked before payoff only if the locking carrier’s policy allows it. Ask separately about the remaining installment balance and unlock eligibility. Even a zero balance is not confirmation: minimum service time or another condition may still apply.",
  },
  'us-mobile-unlock-policy-iphone-guide': {
    lead: "If you brought a locked iPhone to US Mobile, start with the carrier that supplied and locked the handset. Buying a US Mobile plan does not transfer that authority. For an iPhone bought through a specific promotion, compare your own order terms before starting an unlock countdown.",
  },
  'safelink-iphone-unlock-policy-guide': {
    lead: "Bringing your own iPhone to SafeLink requires an unlocked, compatible device. Check Carrier Lock on the phone and SafeLink’s service eligibility separately. If a previous carrier still controls the restriction, enrolling in SafeLink does not remove it.",
  },
  'walmart-family-mobile-iphone-unlock-guide': {
    lead: "Check whether Walmart Family Mobile supplied the phone or just the SIM. For a Family Mobile handset, use its official device-unlock route with the matching IMEI. For a phone brought from elsewhere, contact the carrier that actually locked it.",
  },
  'tracfone-iphone-unlock-current-policy-checklist': {
    lead: "To check a TracFone iPhone for unlocking, match the IMEI to the sale and activation record and use TracFone’s official unlock route. A service receipt alone does not identify the applicable policy. After approval, verify “No SIM restrictions” on the iPhone itself.",
  },
  'iphone-carrier-unlock-free-costs': {
    lead: "Ask the locking carrier whether it will unlock your eligible iPhone for free before paying a third party. Distinguish the unlock fee from an installment balance or a service requirement: a carrier may charge nothing for the unlock even when money is still owed on the phone.",
  },
  'how-to-unlock-esim-on-iphone': {
    lead: "Check where the error appears. A restriction beside Carrier Lock affects switching networks; a SIM PIN or PUK prompt concerns one line; a failed eSIM activation may require the new provider to fix provisioning. Buying another eSIM does not change Carrier Lock.",
  },
  'unlock-iphone-for-international-use-travel-checklist': {
    lead: "You usually do not need a carrier unlock to roam with your existing provider. To use a different provider’s local SIM or travel eSIM, check for “No SIM restrictions” and ask the new provider if it supports your exact iPhone before buying the plan.",
  },
  'iphone-sim-not-supported-after-switching-carriers': {
    lead: "For “SIM Not Supported” after switching carriers, read Carrier Lock first. If it still shows a restriction, take the matching IMEI and any unlock confirmation back to the original carrier. If it shows “No SIM restrictions,” ask the new provider to check its SIM or eSIM activation.",
  },
  'how-to-check-if-iphone-is-unlocked': {
    lead: "Open Settings → General → About and read Carrier Lock. “No SIM restrictions” means the iPhone is carrier-unlocked. You do not need to buy a report to read that result; check with the new carrier separately if you also need to know whether it accepts the model.",
  },
  'straight-talk-iphone-unlock-request-checklist': {
    lead: "Before submitting a Straight Talk unlock request, find out whether Straight Talk supplied the iPhone or only provided its line. A plan receipt does not prove it locked the device. Match the handset to its sale and activation records so the responsible carrier can check eligibility.",
  },
  't-mobile-iphone-unlock-status-esim': {
    lead: "“Eligible” in a T-Mobile account and “No SIM restrictions” on an iPhone answer different questions. If the account looks eligible but the handset still shows a lock, give T-Mobile the matching IMEI and request status before buying a second carrier’s eSIM.",
  },
  'iphone-carrier-unlock-eligibility': {
    lead: "Check Carrier Lock on the iPhone first. If it is restricted, ask the original carrier whether that device meets its sale, service and account requirements. If Settings already shows “No SIM restrictions,” skip the unlock purchase and check compatibility with the destination network instead.",
  },
  'match-imei-to-seller-listing': {
    comparison: [
      h('compare-device-and-report', 'Which identifier should match the report?'),
      table(['On the seller’s report', 'Compare with', 'What a match establishes'], [
        ['IMEI', 'The full IMEI on the handset', 'The report refers to that identifier; check the date and fields separately.'],
        ['IMEI2', 'IMEI2 on the same phone, if present', 'The second identifier matches; a different first IMEI is not evidence of fraud.'],
        ['Model or last four digits only', 'Ask to compare the complete, labelled identifier in private', 'A partial match cannot establish that the report belongs to this handset.'],
      ]),
      p('Ask the seller to open the device information screen while you compare the numbers. Keep the full identifier out of public listings.', appleId),
      cta('If the number matches but the carrier is still unknown, compare free checks with an IMEI carrier-policy report.', '/services/imei-check/apple-carrier-lock-status', 'Compare ways to identify the carrier'),
    ],
  },
  'puretalk-unlock-policy-iphone-guide': {
    comparison: [
      h('puretalk-evidence', 'Which PureTalk check answers your question?'),
      table(['What you have', 'What it tells you', 'What to do next'], [
        ['Original PureTalk purchase record', 'PureTalk says the phones it sells are unlocked.', 'Verify the Carrier Lock field on this particular iPhone.'],
        ['PureTalk compatibility result', 'Whether the device is a candidate for PureTalk service', 'Check lock status separately; compatibility does not authorize an unlock.'],
        ['A working PureTalk SIM in a used iPhone', 'This line works on the device.', 'Trace the seller or original network if Settings still shows a restriction.'],
      ]),
      p('Use PureTalk for questions about devices it sells or accepts. For a handset supplied by another carrier, determine who controls the restriction before submitting a request.', link('PureTalk: network and compatibility FAQ', 'https://www.puretalk.com/faq/network-coverage-compatibility')),
    ],
  },
  'red-pocket-iphone-unlock-policy-guide': {
    comparison: [
      h('red-pocket-records', 'Which Red Pocket record should you check first?'),
      table(['Evidence', 'What it answers', 'What it cannot prove'], [
        ['Original unlocked-device listing and invoice', 'Whether this order was sold as unlocked', 'That the handset you are inspecting matches the order'],
        ['Original locked-device listing and service record', 'Which purchase terms and service history support a request', 'That Red Pocket has approved or completed the unlock'],
        ['Carrier Lock in iPhone Settings', 'Whether iOS currently reports a SIM restriction', 'Whether an otherwise eligible plan or eSIM has been activated'],
      ]),
      p('For a listing sold as locked, compare the order with the eligibility and exception rules before contacting support.', link('Red Pocket: unlocking guidelines and exceptions', 'https://help.redpocket.com/unlocking-my-red-pocket-mobile-device')),
    ],
  },
  'iphone-carrier-unlock-software-jailbreak-guide': {
    comparison: [
      h('software-versus-authorization', 'What counts as evidence of a carrier unlock?'),
      table(['Claim or action', 'What you can verify', 'Next step'], [
        ['An app displays “unlocked”', 'Only what the app claims about the device', 'Read Carrier Lock in Settings before paying anyone.'],
        ['A seller recommends a jailbreak', 'Changing iOS is a different operation from carrier authorization.', 'Keep iOS intact and contact the carrier that controls the restriction.'],
        ['The carrier confirms completion', 'There is a decision about this device.', 'Follow Apple’s activation instructions and check for “No SIM restrictions.”'],
      ]),
      p('Apple directs users to the carrier for authorization. A restore appears only in the instructions for completing activation after the carrier confirms the unlock.', appleLock),
    ],
  },
  'what-an-imei-check-tells-you': {
    lead: 'An IMEI identifies cellular equipment. A free checksum catches many typing mistakes; the digits alone do not reveal the locking carrier, prove ownership or show whether a phone was reported stolen. To answer one of those status questions, find out which record a lookup actually checks.',
    body: [
      h('what-the-number-is-made-of', 'What can you learn from the 15 digits alone?'),
      p('The first eight digits are the Type Allocation Code, assigned to a device model. The following six distinguish units within that allocation. The last digit is a checksum. A model match is useful if a listing claims a different handset, but do not infer exact storage capacity, colour or ownership from the prefix.', gsmaTac),
      p('On iPhone, open Settings → General → About. If the phone shows IMEI and IMEI2, keep their labels when comparing a report. A serial number or EID is a different identifier.', appleId),
      h('what-a-lookup-can-return', 'Which check answers which question?'),
      table(['Question', 'Evidence to use', 'Where it stops'], [
        ['Did I mistype a digit?', 'A local Luhn format check', 'A passing number need not belong to the phone in front of you.'],
        ['What model type is this?', 'The TAC matched against a device model directory', 'It is not a storage-capacity or proof-of-purchase record.'],
        ['Is this iPhone carrier locked?', 'Settings → General → About → Carrier Lock', 'This field does not establish which shop or carrier sold the device.'],
        ['Was this identifier reported lost or stolen?', 'A current registry lookup that covers that IMEI', 'A clear result does not prove payoff, ownership or future status.'],
        ['Which carrier policy applies?', 'Original purchase records, carrier confirmation, or a carrier-policy report if available', 'A policy name may not identify the first seller or show unlock eligibility.'],
      ]),
      p('Look for the source, field names and check time on a report. GSMA describes how a flagged device appears in its service; Apple explains how to check Carrier Lock for free on the handset.', gsmaCheck, appleLock),
      h('what-it-cannot-tell-you', 'What stays unknown even when the IMEI matches?'),
      p('A matching report does not identify the person selling the phone, provide their account balance, show their location or give access to messages. For a used iPhone, also ask to see it start setup without requesting the previous owner’s Apple Account.'),
      h('reading-a-result', 'How do you act on “clean” or “SIM locked”?'),
      p('“Clean” is meaningful only in relation to the registry and time checked. “SIM locked” concerns the restriction on using another carrier. A device can have one result without the other. Choose a lookup for the answer you still lack, rather than paying twice for the same field.'),
      cta('If the original network is the remaining question, compare the free checks and the fields included in the carrier reports.', '/services/imei-check/apple-carrier-lock-status', 'Compare carrier identification methods'),
    ],
    faq: [
      qa('Can I check an IMEI without sending anything to the phone?', 'Yes. A format check calculates a checksum locally, and a registry lookup reads a record for the identifier you supply. Neither action changes the handset. Compare the number with the actual phone before relying on the result.'),
      qa('Does a valid IMEI mean the phone is genuine?', 'No. A valid checksum only shows that the digits fit the expected pattern. It does not prove that the number was assigned to this handset or that the seller owns it.'),
      qa('Is a free IMEI check enough before buying?', 'It depends on the check. A checksum only tests the digits. A free lost-or-stolen lookup can answer a different question. Neither substitutes for inspecting the device, matching its identifier and checking Activation Lock and carrier status.'),
    ],
  },
  'network-unlock-explained': {
    lead: 'A network unlock lets a phone accept service from another compatible carrier. On iPhone, the carrier authorizes the change; “No SIM restrictions” in Settings is the result to look for. It does not pay off financing, lift Activation Lock or guarantee that a new provider supports your model.',
    body: [
      h('how-it-is-done', 'Who can unlock an iPhone, and how do you check?'),
      steps('Open Settings → General → About and read Carrier Lock. If it says “No SIM restrictions,” skip the unlock request.', 'If restricted, identify the carrier responsible using the original purchase record or the carrier’s support team. A working SIM on its own does not establish who sold the phone.', 'Follow the carrier’s published request or automatic-unlock process for that device. After it confirms completion, follow Apple’s activation instructions and check Carrier Lock again.'),
      p('Apple explains which steps happen after carrier approval, including what to do when another SIM is unavailable. Do not erase a phone as a first attempt to obtain permission.', appleLock),
      h('what-it-does-not-do', 'What changes when a network lock is removed?'),
      table(['Symptom', 'Will a carrier unlock resolve it?', 'Who or what to check'], [
        ['Carrier Lock shows a SIM restriction', 'It can remove that restriction if the carrier approves.', 'The carrier responsible for this device'],
        ['Setup asks for a previous Apple Account', 'No. This is an ownership protection.', 'Ask the seller to remove Activation Lock before purchase.'],
        ['The IMEI is flagged in a device registry', 'No. The report is separate from SIM restrictions.', 'The reporting organization and its correction process'],
        ['An installment balance remains', 'No. Changing network eligibility does not settle the bill.', 'The account holder and the financing provider'],
        ['An unlocked handset cannot activate on another network', 'Another unlock is unlikely to help.', 'The new provider’s model, IMEI and provisioning checks'],
      ]),
      h('when-it-can-be-refused', 'What if the carrier declines the request?'),
      p('Ask which condition failed for the specific IMEI: for example, an account condition, a service-period requirement or a mismatch in the carrier’s records. An intermediary cannot approve the request on the carrier’s behalf. For an existing paid order, use the refund terms for its payment method.', link('iUnlockMobile: refunds and refused orders', '/refunds')),
      h('how-long-it-takes', 'When should you switch SIMs?'),
      p('Wait for the carrier’s confirmation. Request review and activation are different stages, and there is no single completion time for every carrier. If the phone already shows no restriction, ask the destination carrier whether it accepts the exact device before moving your number.'),
      cta('If you still need an unlock, compare the service for the carrier that actually controls the restriction.', '/services/unlock', 'Check network eligibility and prices'),
    ],
    faq: [
      qa('Is unlocking legal?', 'Check the rules where the device was sold and the carrier’s published eligibility terms. A carrier-authorized unlock for your own phone concerns network access; it does not transfer ownership or alter financing obligations.'),
      qa('Does unlocking void the warranty?', 'A carrier-authorized unlock is not a hardware repair or a jailbreak. If warranty coverage matters to your purchase, read the written warranty for that model and region rather than relying on the phone’s lock status.'),
      qa('Will I need to request another unlock after updating iOS?', 'An iOS update is not a new carrier-unlock request. If a line stops working after an update, read Carrier Lock first. If it shows no restriction, investigate activation and compatibility with the new carrier.'),
      qa('Can I request an unlock without knowing the IMEI?', 'Use the process offered by your carrier. It may identify the phone through your account or ask you to supply its IMEI. Keep the identifier private and match it to the handset before submitting it.'),
    ],
  },
  'checks-before-buying-a-used-phone': {
    lead: 'Before paying for a used phone, match its IMEI to the handset, check for a lost-or-stolen report, and test it on your intended network. For iPhone, also confirm the seller can remove Activation Lock. A clean screenshot cannot answer all four questions.',
    body: [
      h('ask-for-the-imei-first', 'Which checks can you do before meeting the seller?'),
      steps('Ask which model is being sold and whether the seller can show the complete identifier privately, now or at handover. A seller is entitled to avoid posting it publicly.', 'If you have the IMEI, check its format, then run a lost-or-stolen lookup for your market. Save the date and result; a clear record only describes the time of the query.', 'Ask the destination carrier about compatibility. Arrange a return option if you cannot test the device yourself.'),
      p('In the US, CTIA explains how reported devices appear in its Stolen Phone Checker. Its result does not certify that a seller owns a handset or has paid off an installment plan.', ctia),
      h('in-person', 'What should you check on the actual iPhone?'),
      steps('Open Settings → General → About. Match the full IMEI or IMEI2 to the same labelled identifier on the report, and check Carrier Lock.', 'Inspect battery health, physical damage and parts or service history when available. Test calls and data on a compatible SIM or eSIM if possible.', 'Have the seller remove their account and prepare the phone for transfer. If setup still requests the previous owner’s credentials, do not complete the purchase.'),
      p('Apple’s pre-owned checklist covers Activation Lock, device condition and carrier restrictions. Inspecting the actual device answers questions a registry report cannot.', appleUsed, appleId),
      h('red-flags', 'What should you do if a check does not add up?'),
      table(['Situation', 'What is still unknown', 'Before paying'], [
        ['Seller prefers not to share the IMEI online', 'Whether the report matches this device', 'Offer a private, in-person comparison. Walk away if it cannot be checked.'],
        ['A different IMEI appears on the report', 'Whether it is IMEI2 or belongs to a different phone', 'Compare the labelled fields. Do not accept a model name as a substitute.'],
        ['Setup says the iPhone is locked to its owner', 'Whether the seller can release ownership', 'Have the seller resolve it first. Do not buy on a promise.'],
        ['No purchase record is available', 'Original sale and possible account obligations', 'Ask for alternative evidence and reconsider the risk if you cannot verify it.'],
      ]),
      cta('Choose a paid report only if it covers a specific question the free checks did not answer.', '/services/imei-check', 'Compare the fields in device reports'),
    ],
    faq: [
      qa('Does a clean IMEI mean I can use the phone on my carrier?', 'No. A clear lost-or-stolen check does not establish carrier lock or network compatibility. Read the lock status on the handset and confirm the exact model or IMEI with the network you intend to use.'),
      qa('Should I post the full IMEI publicly to get help?', 'No. You can compare all digits privately at handover or enter them directly in the checker you choose. A public listing or forum does not need the complete identifier.'),
      qa('Can a new SIM fix “iPhone Locked to Owner”?', 'No. Changing a SIM does not remove Activation Lock. Ask the seller to remove the phone from their Apple Account and verify setup before you pay.'),
    ],
  },
}

/** Content is returned per request, never mutating the catalogue shared by other pages. */
export function enrichArticle(article: Article): Article {
  if (article.locale && article.locale !== 'en') return article
  const edit = editions[article.slug]
  if (!edit) return article
  // Respect a future editorial table added directly to the original article.
  const comparison = !article.blocks.some(b => b.kind === 'table') ? edit.comparison : undefined
  const firstHeading = article.blocks.findIndex(b => b.kind === 'h2')
  const at = Math.max(0, firstHeading)
  const blocks = edit.body ?? (comparison
    ? [...article.blocks.slice(0, at), ...comparison, ...article.blocks.slice(at)]
    : article.blocks)
  return { ...article, standfirst: edit.lead ?? article.standfirst, blocks, faq: edit.faq ?? article.faq }
}
