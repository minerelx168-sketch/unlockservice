/**
 * The guides at /articles.
 *
 * Content is structured data, not markdown: no parser to add, nothing to
 * sanitise, and a broken heading or a link to a route that does not exist
 * fails `tsc` and the tests rather than shipping. Every claim here has to
 * match what the service actually does — a guide that oversells is the one
 * search engines and customers both punish.
 */

export type ArticleBlock =
  | { kind: 'p'; text: string; links?: { label: string; href: string }[] }
  | { kind: 'h2'; text: string; id: string }
  | { kind: 'h3'; text: string; id: string }
  | { kind: 'list'; ordered?: boolean; items: string[] }
  | { kind: 'note'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'cta'; text: string; href: string; label: string }

export type ArticleFaq = { question: string; answer: string }

export type Article = {
  slug: string
  /**
   * The meta title. Kept short because app/layout.tsx appends
   * " — iUnlockMobile" to it, and the pair has to survive a SERP.
   */
  title: string
  /** The <h1>, which has a whole page to sit in rather than a result row. */
  heading: string
  /** 120–160 characters: what a search result shows under the link. */
  description: string
  /** One line under the heading, in the page. */
  standfirst: string
  published: string
  updated: string
  minutes: number
  topic: string
  blocks: ArticleBlock[]
  faq?: ArticleFaq[]
}

const ARTICLES: Article[] = [
  {
    slug: 'visible-iphone-unlock-365-day-policy',
    title: 'Visible iPhone Unlock: Current Policy',
    heading: 'Visible iPhone Unlock: How the 365-Day Policy Works',
    description: 'Need a Visible iPhone unlock? Learn how the 365-day service requirement, payment pauses, request process and status checks work.',
    standfirst: 'Visible now uses a service-based waiting period for phones bought from Visible. Confirm when your clock started and whether any service gap paused it.',
    published: '2026-09-21',
    updated: '2026-09-21',
    minutes: 8,
    topic: 'Visible iPhone unlock',
    blocks: [
      { kind: 'p', text: 'A Visible iPhone unlock is not based only on the date you bought the phone. Visible’s current policy says a smartphone purchased through Visible is locked for 365 days and becomes eligible for an unlock request after the service requirement is met. If service stops, progress pauses and resumes after reactivation, so a calendar estimate can be wrong even when the receipt is more than a year old.', links: [{ label: 'Read Visible’s current device unlocking policy', href: 'https://www.visible.com/help/device-unlocking-policy' }] },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'The current Visible policy uses 365 days of paid service for smartphones purchased through Visible.',
        'A period without paid service pauses progress instead of counting toward the requirement.',
        'Reaching the waiting period does not replace the request: the current policy says the phone unlocks upon request after eligibility.',
        'A phone brought to Visible from another seller should be handled by the carrier or retailer that controls its lock.',
        'After approval, verify No SIM restrictions in iPhone Settings before buying a new plan or travel eSIM.',
      ] },
      { kind: 'h2', id: 'current-policy', text: 'What the current Visible unlock policy says' },
      { kind: 'p', text: 'Visible’s official policy, checked on September 21, 2026, states that a smartphone bought through Visible is locked for 365 days. The phone can be unlocked upon request after the requirement is satisfied. Visible also says that stopping payment pauses progress and that the count resumes when the account is reactivated and paid service continues.', links: [{ label: 'Verify the live Visible policy before relying on a date', href: 'https://www.visible.com/help/device-unlocking-policy' }] },
      { kind: 'note', text: 'Do not apply the 365-day wording blindly to a phone activated under an earlier policy. Ask Visible which rule applies to the specific IMEI and activation date, and keep the written answer with your case reference.' },
      { kind: 'h3', id: 'purchase-versus-service', text: 'Purchase age and paid-service progress are different' },
      { kind: 'p', text: 'The receipt proves when the transaction occurred; it does not by itself prove how much qualifying service Visible has recorded. Keep the order number, activation confirmation and billing history separate. If your calculation differs from Visible’s, ask for the activation date, the paid-service days counted and any period that paused progress.' },
      { kind: 'h3', id: 'request-not-automatic', text: 'Eligibility does not mean the request is already complete' },
      { kind: 'p', text: 'The current wording says the smartphone will unlock upon request after 365 days if the requirements are met. When the date arrives, contact Visible through its official support route and ask whether the IMEI is eligible, whether the request was submitted and whether the carrier-side change is complete. Those are three different statuses.' },
      { kind: 'h2', id: 'timeline-checklist', text: 'Build an accurate Visible unlock timeline' },
      { kind: 'table', head: ['Record', 'What it establishes', 'Question to ask if disputed'], rows: [
        ['Visible order confirmation', 'The phone was purchased through Visible and identifies the order.', 'Is this IMEI linked to the same order?'],
        ['Activation record', 'When Visible service began on the device or line.', 'Which activation date starts the applicable requirement?'],
        ['Payment and service history', 'Whether paid service continued without a pause.', 'Which dates did not count, and why?'],
        ['Support case and decision', 'Whether the phone is waiting, eligible, requested or completed.', 'What exact condition or action remains?'],
      ] },
      { kind: 'p', text: 'Redact the full IMEI, phone number, payment information and account credentials before sharing screenshots outside official support. A useful record shows dates and status without exposing information someone could use to take over the account.' },
      { kind: 'h2', id: 'request-steps', text: 'How to request a Visible iPhone unlock' },
      { kind: 'list', ordered: true, items: [
        'Open Settings, General, About and record the Carrier Lock result and IMEI privately.',
        'Confirm that the phone was sold by Visible; a bring-your-own phone may belong to another carrier’s policy.',
        'Use the Visible account history to calculate paid-service progress and identify any interruption.',
        'Contact Visible support and ask for the device-specific eligibility date before the expected date if the history is unclear.',
        'Once eligible, request the unlock and retain the case reference and written status.',
        'After confirmation, keep the iPhone online, restart it and check Carrier Lock again.',
      ] },
      { kind: 'p', text: 'Apple says only the carrier can unlock an iPhone for use with another network. When the authorization is complete, Settings, General, About should show No SIM restrictions next to Carrier Lock. Apple does not provide an unlock code or override the carrier’s eligibility decision.', links: [{ label: 'Follow Apple’s current carrier-unlock instructions', href: 'https://support.apple.com/en-us/109316' }, { label: 'Compare reliable iPhone unlock-status checks', href: '/articles/how-to-check-if-iphone-is-unlocked' }] },
      { kind: 'h2', id: 'delay-troubleshooting', text: 'If the Visible iPhone is still locked' },
      { kind: 'table', head: ['What happened', 'Most useful check', 'Next action'], rows: [
        ['The purchase is over a year old', 'Does Visible show 365 days of paid service rather than only calendar age?', 'Request the recorded start date and any paused periods.'],
        ['The account was canceled and later restored', 'How many service days counted before and after the interruption?', 'Ask Visible for the current remaining requirement.'],
        ['Support says eligible', 'Was an unlock request actually submitted?', 'Get the request status and case reference.'],
        ['Support says completed, but Settings shows SIM locked', 'Has the iPhone received the carrier authorization?', 'Keep it online, restart and return to the same case if the status remains.'],
        ['Settings shows No SIM restrictions, but activation fails', 'Is the destination carrier provisioning a compatible IMEI or IMEI2?', 'Troubleshoot the new SIM or eSIM with that carrier.'],
      ] },
      { kind: 'h3', id: 'used-visible-iphone', text: 'You bought the Visible iPhone second-hand' },
      { kind: 'p', text: 'Do not assume the resale date resets or completes the carrier’s record. Ask the seller for a redacted original order, activation evidence and current Carrier Lock screen while return protection remains open. If account verification is required, the seller may need to contact Visible. Never impersonate the account holder or send money to clear an unexplained balance.', links: [{ label: 'Use the used-phone buying checklist', href: '/articles/checks-before-buying-a-used-phone' }] },
      { kind: 'h3', id: 'travel-deadline', text: 'You need the iPhone unlocked for travel' },
      { kind: 'p', text: 'Check eligibility well before departure. A travel eSIM cannot bypass Carrier Lock, and an expected eligibility date is not the same as a completed request. If the phone will not qualify in time, compare Visible’s supported roaming options with using a separate unlocked device rather than trusting an early-unlock guarantee.', links: [{ label: 'Prepare an iPhone for international use', href: '/articles/unlock-iphone-for-international-use-travel-checklist' }] },
      { kind: 'h2', id: 'different-restrictions', text: 'A Visible carrier unlock does not remove every restriction' },
      { kind: 'list', items: [
        'A SIM PIN or PUK challenge protects one SIM or eSIM and must be handled by the issuer of that line.',
        'A forgotten iPhone passcode is a device-access issue, not a carrier lock.',
        'iPhone Locked to Owner is Activation Lock linked to an Apple Account.',
        'A lost, stolen or fraud record must be resolved through the responsible account or carrier process.',
        'An unlocked phone can still fail another carrier’s compatibility or activation check.',
      ] },
      { kind: 'p', text: 'Identify the exact screen and status before paying for help. A third party can explain records or assist with a supported request, but it cannot manufacture paid-service history, force Visible approval or bypass Apple ownership protection. Require a written description of the deliverable and refund conditions.', links: [{ label: 'Review an IMEI unlock service before paying', href: '/articles/imei-unlock-iphone-service-checklist' }, { label: 'Identify Activation Lock correctly', href: '/articles/iphone-locked-to-owner-legitimate-fixes' }] },
      { kind: 'cta', text: 'Have your Visible purchase source, activation date, service history and Carrier Lock result? Send a redacted summary and ask whether a relevant iUnlockMobile service is currently available before ordering.', href: '/contact', label: 'Check service availability' },
    ],
    faq: [
      { question: 'How long does Visible keep an iPhone locked?', answer: 'Visible’s current policy states 365 days for smartphones purchased through Visible, subject to its requirements. Verify the live policy and the device-specific start date before relying on a calendar estimate.' },
      { question: 'Does a month without Visible service count toward 365 days?', answer: 'Visible says progress pauses when service payments stop and resumes after reactivation and continued paid service.' },
      { question: 'Does Visible unlock the iPhone automatically after 365 days?', answer: 'The current policy says the phone will unlock upon request after 365 days if the requirements are met. Confirm that the request was submitted and completed.' },
      { question: 'Can Visible unlock a phone that was bought from another carrier?', answer: 'The carrier or retailer that controls the lock normally handles that request. Confirm the original seller and Carrier Lock record before applying Visible’s policy.' },
      { question: 'Can a paid service shorten Visible’s waiting period?', answer: 'Do not rely on that promise. A third party cannot create qualifying service history or guarantee a carrier decision; verify eligibility with Visible first.' },
    ],
  },
  {
    slug: 'spectrum-mobile-iphone-unlock-paid-off',
    title: 'Spectrum Mobile iPhone Unlock Guide',
    heading: 'Spectrum Mobile iPhone Unlock: Paid Off but Still Locked?',
    description: 'Need a Spectrum Mobile iPhone unlock? Separate payoff, account eligibility, request status and new-carrier activation before paying for help.',
    standfirst: 'A payoff receipt is important evidence, but it does not tell you whether Spectrum has approved and completed the carrier-side unlock for that IMEI.',
    published: '2026-09-21',
    updated: '2026-09-21',
    minutes: 8,
    topic: 'Spectrum Mobile iPhone unlock',
    blocks: [
      { kind: 'p', text: 'A Spectrum Mobile iPhone unlock can remain unresolved after the device balance reaches zero because payoff, eligibility, request processing and new-carrier activation are separate stages. The fastest diagnosis is to identify which stage failed and ask Spectrum for the exact device-specific status instead of buying another unlock immediately.' },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'Keep proof of payoff, but also ask Spectrum whether every current account and device condition is satisfied.',
        'Confirm whether an unlock request is required and whether it is waiting, approved or completed.',
        'Use Carrier Lock in iPhone Settings as the clearest on-device status check.',
        'If No SIM restrictions appears, move troubleshooting to the destination carrier instead of purchasing another unlock.',
        'Use Spectrum’s live support policy for timing and exceptions because carrier rules can change.',
      ] },
      { kind: 'h2', id: 'four-stages', text: 'Separate the four stages of a Spectrum iPhone unlock' },
      { kind: 'table', head: ['Stage', 'Evidence to collect', 'Question for support'], rows: [
        ['Payoff recorded', 'Final payment receipt and device installment status.', 'Does Spectrum show a zero device balance for this IMEI?'],
        ['Policy eligibility', 'Account status, activation history and device status.', 'Which current eligibility condition remains unmet?'],
        ['Unlock processing', 'Request date, case number and written decision.', 'Is the request pending, approved, refused or completed?'],
        ['New-carrier activation', 'Carrier Lock result and exact SIM or eSIM error.', 'Is the phone unlocked but incompatible or incorrectly provisioned?'],
      ] },
      { kind: 'p', text: 'Spectrum maintains an official support page for unlocking devices. Check that live page or contact Spectrum before relying on a waiting period quoted by a forum, reseller or older article. If the page and a support response differ, ask which policy version and device record were used for the decision.', links: [{ label: 'Open Spectrum’s official device-unlock support article', href: 'https://www.spectrum.net/support/mobile/how-to-unlock-your-spectrum-mobile-device' }] },
      { kind: 'h3', id: 'payoff-is-not-completion', text: 'Paid off is not the same as unlocked' },
      { kind: 'p', text: 'A final payment resolves the device finance balance recorded by the provider. It does not prove that every other eligibility condition has been checked or that an unlock authorization has reached Apple’s activation system. Keep the payoff receipt, then request the current eligibility result and completion status for the same IMEI.' },
      { kind: 'h3', id: 'account-versus-device', text: 'Account status and device status answer different questions' },
      { kind: 'p', text: 'Ask Spectrum to separate any account-level issue from a device-level issue. An account balance, requester authorization, activation history, lost or stolen record and fraud review are not interchangeable. A useful response names the specific condition, who can resolve it and what evidence is accepted.' },
      { kind: 'h2', id: 'request-checklist', text: 'Spectrum Mobile unlock request checklist' },
      { kind: 'list', ordered: true, items: [
        'Open Settings, General, About and privately record the IMEI and Carrier Lock result.',
        'Match the IMEI to the payoff receipt and Spectrum device record, especially after a warranty or insurance replacement.',
        'Confirm that the authorized account user is making the request and that Spectrum shows no unresolved account condition.',
        'Ask Spectrum to state the live eligibility rule applied to the device rather than estimating from an old policy summary.',
        'Record the request date, case number, decision and any action still required.',
        'After Spectrum confirms completion, keep the iPhone online, restart it and check Carrier Lock again.',
      ] },
      { kind: 'p', text: 'Apple says only the current carrier can unlock an iPhone for another network. An iPhone does not use the network-unlock code often associated with some Android phones. Completion should appear as No SIM restrictions next to Carrier Lock in Settings, General, About.', links: [{ label: 'Follow Apple’s current iPhone unlock instructions', href: 'https://support.apple.com/en-us/109316' }, { label: 'Learn how to check whether an iPhone is unlocked', href: '/articles/how-to-check-if-iphone-is-unlocked' }] },
      { kind: 'h2', id: 'still-locked', text: 'Why the iPhone may still show SIM locked' },
      { kind: 'table', head: ['Situation', 'What to verify first', 'Best next step'], rows: [
        ['The final payment was recent', 'Has Spectrum posted it to the correct device record?', 'Keep the receipt and ask when eligibility will be recalculated.'],
        ['A replacement iPhone is in use', 'Does the case reference the IMEI you actually hold?', 'Ask Spectrum to link the replacement and original records.'],
        ['A seller says the phone was paid off', 'Can the authorized account user obtain written confirmation?', 'Use seller cooperation or return protection while available.'],
        ['Spectrum says the request is complete', 'Does Carrier Lock still say SIM locked?', 'Keep the phone online, restart and return to the same case.'],
        ['Carrier Lock says No SIM restrictions', 'What exact message does the new carrier show?', 'Troubleshoot compatibility, SIM or eSIM activation with that carrier.'],
      ] },
      { kind: 'h3', id: 'used-spectrum-iphone', text: 'The paid-off claim came from a used-phone seller' },
      { kind: 'p', text: 'A screenshot of a zero balance is not enough unless it identifies the same device and is current. Ask for redacted original-purchase and payoff evidence, verify Carrier Lock yourself and keep the marketplace return deadline open. Do not pay a stranger to settle an account you cannot verify, and do not impersonate the original customer.', links: [{ label: 'Run the used-iPhone checks before the return window closes', href: '/articles/checks-before-buying-a-used-phone' }] },
      { kind: 'h3', id: 'completed-but-not-working', text: 'Spectrum says complete, but the new SIM or eSIM fails' },
      { kind: 'p', text: 'If Settings shows No SIM restrictions, the remaining failure may be model compatibility, the wrong IMEI or IMEI2, an eSIM provisioning error or a line-activation issue. Give the destination carrier the exact model and error message. Do not order another carrier unlock for a phone that already reports the unlocked state.', links: [{ label: 'Troubleshoot iPhone SIM Not Supported', href: '/articles/iphone-sim-not-supported-after-switching-carriers' }, { label: 'Separate eSIM lock, PIN and setup errors', href: '/articles/how-to-unlock-esim-on-iphone' }] },
      { kind: 'h2', id: 'not-a-carrier-lock', text: 'Restrictions a Spectrum carrier unlock does not remove' },
      { kind: 'list', items: [
        'A SIM PIN or PUK challenge from the company that issued a physical SIM or eSIM.',
        'A forgotten iPhone passcode or Security Lockout screen.',
        'Activation Lock or iPhone Locked to Owner linked to an Apple Account.',
        'A lost, stolen, fraud or blacklist record that requires an authorized dispute.',
        'Compatibility and activation requirements imposed by the destination carrier.',
      ] },
      { kind: 'p', text: 'A third-party service can explain an IMEI report, review public policy or assist with an available request route. It cannot erase a finance obligation, change Spectrum’s account record, guarantee an exception or bypass Apple ownership protection. Before paying, require the provider to name the exact deliverable and refusal or refund terms.', links: [{ label: 'Compare IMEI checks, requests and completed unlocks', href: '/articles/imei-unlock-iphone-service-checklist' }, { label: 'Understand what a network unlock changes', href: '/articles/network-unlock-explained' }] },
      { kind: 'h2', id: 'evidence-for-escalation', text: 'Prepare one clear escalation package' },
      { kind: 'list', items: [
        'The IMEI with most digits redacted outside Spectrum’s official channel.',
        'The device model, purchase source and any replacement history.',
        'The payoff confirmation and date it posted.',
        'The Carrier Lock result and exact error shown by the new SIM or eSIM.',
        'The existing case number and written explanation of the unmet condition.',
      ] },
      { kind: 'p', text: 'Keep one coherent case instead of opening repeated requests with different facts. Ask for a concrete answer: which condition is unmet, what document resolves it, or whether Spectrum has completed the carrier authorization. That record is also what a legitimate support or unlock service needs to assess the next step.' },
      { kind: 'cta', text: 'Have the Spectrum payoff evidence, current Carrier Lock result and support decision? Send a redacted summary to confirm whether a relevant iUnlockMobile service is presently available before placing an order.', href: '/contact', label: 'Check Spectrum service availability' },
    ],
    faq: [
      { question: 'Why is my Spectrum iPhone still locked after payoff?', answer: 'The payment may not yet be attached to the correct IMEI, another live eligibility condition may remain, or the carrier authorization may still be pending. Ask Spectrum to identify the exact stage and condition.' },
      { question: 'Does a Spectrum iPhone need an unlock code?', answer: 'No. Apple says only the carrier can authorize the unlock, and completion appears as No SIM restrictions under Carrier Lock.' },
      { question: 'Can a used Spectrum iPhone be unlocked without the seller?', answer: 'That depends on Spectrum’s current verification and eligibility requirements. Ask Spectrum what it accepts, and use seller cooperation or return protection if an authorized account action is required.' },
      { question: 'What if Spectrum says the unlock is complete?', answer: 'Check Settings, General, About, Carrier Lock. If it shows SIM locked, return to the same Spectrum case. If it shows No SIM restrictions, troubleshoot activation with the destination carrier.' },
      { question: 'Can a third party guarantee a Spectrum unlock?', answer: 'No provider should promise to override Spectrum’s eligibility decision or account record. Require a precise deliverable and written refusal or refund terms before paying.' },
    ],
  },
  {
    slug: 'metropcs-iphone-unlock-365-day-policy',
    title: 'MetroPCS iPhone Unlock: Current Rules',
    heading: 'MetroPCS iPhone Unlock: Which Waiting Period Applies?',
    description: 'Need a MetroPCS iPhone unlock? Check the current Metro waiting period, prepare your activation evidence and resolve an eligibility dispute.',
    standfirst: 'Old waiting-period advice is not enough to establish eligibility. Use the current Metro policy and the activation record for your specific iPhone.',
    published: '2026-09-20',
    updated: '2026-09-20',
    minutes: 7,
    topic: 'MetroPCS iPhone unlock',
    blocks: [
      { kind: 'p', text: 'A MetroPCS iPhone unlock starts with identifying the carrier that controls the lock. If your phone belongs under Metro by T-Mobile’s unlocking policy, the published standard waiting period is 365 days from activation. Do not assume a forum answer mentioning 180 days, or a rule for a T-Mobile account, applies to your device.', links: [{ label: 'Check Metro’s official phone unlock policy', href: 'https://www.metrobyt-mobile.com/terms-and-conditions/phone-unlock-policy' }] },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'Match the policy to the original device record, not just the SIM currently installed.',
        'Keep purchase and activation evidence separate: they can describe different events.',
        'Ask for a written eligibility explanation when an older promise conflicts with the answer you receive.',
        'Do not buy another unlock service until you know whether the problem is timing, a disputed record or a different type of lock.',
      ] },
      { kind: 'h2', id: 'published-policy', text: 'What Metro’s published policy actually requires' },
      { kind: 'p', text: 'Checked on September 20, 2026, Metro’s policy page is dated August 11, 2025. It offers free unlocking for devices purchased from Metro that are not reported lost, stolen or blocked and have passed the activation-based waiting period. Eligible devices are remotely unlocked within two business days where supported; otherwise Metro sends a notification with next steps. Deployed military customers in good standing can provide deployment papers for an exception.', links: [{ label: 'Read the eligibility, timing and military provisions', href: 'https://www.metrobyt-mobile.com/terms-and-conditions/phone-unlock-policy' }] },
      { kind: 'note', text: 'The published page does not establish a general older-device exception to the current waiting period. If you were promised different terms, ask Metro to review your dated evidence rather than treating this guide as a decision on your individual case.' },
      { kind: 'h3', id: 'old-advice', text: 'What if your receipt or an old guide says 180 days?' },
      { kind: 'p', text: 'Keep a copy of the exact statement, its date and the device or promotion it described. Then ask support which policy applies to your IMEI and why. A screenshot of an unrelated customer’s successful unlock does not establish that your phone has the same purchase history. Useful evidence connects the promise to your own transaction; an undated search snippet does not.' },
      { kind: 'h3', id: 'metro-versus-t-mobile', text: 'Metro service and a T-Mobile device record are different questions' },
      { kind: 'p', text: 'A carrier name in a listing or on a SIM package is not sufficient evidence of the original lock. Ask the seller which company sold the iPhone and which company will handle its unlock. T-Mobile publishes a separate policy with its own postpaid and prepaid conditions; do not substitute those conditions for Metro’s.', links: [{ label: 'Compare the separate T-Mobile policy', href: 'https://www.t-mobile.com/responsibility/consumer-info/policies/sim-unlock-policy' }] },
      { kind: 'h2', id: 'evidence-checklist', text: 'Prepare a device-specific evidence checklist' },
      { kind: 'table', head: ['Information to gather', 'Question it helps answer', 'What to avoid'], rows: [
        ['Original seller and purchase receipt', 'Was this a Metro-sold device or a phone brought from elsewhere?', 'Assuming the installed SIM proves the original seller.'],
        ['Activation confirmation or carrier record', 'Which activation date is attached to this device?', 'Using the date you bought it second-hand as a substitute.'],
        ['IMEI and any replacement paperwork', 'Is support reviewing the device you actually hold?', 'Posting the complete identifier publicly.'],
        ['Dated policy promise and support case reference', 'What was promised, and what remains disputed?', 'Opening repeated cases without the earlier response.'],
      ] },
      { kind: 'p', text: 'Use this as a preparation checklist, not a claim that every document is mandatory. Ask Metro what evidence it will accept through its official support channel. If the phone was replaced under warranty or insurance, explicitly ask how the replacement is linked to the original record; do not assume an unlock decision for the previous IMEI covers it.' },
      { kind: 'h2', id: 'request-review', text: 'How to ask for an eligibility review' },
      { kind: 'list', ordered: true, items: [
        'Describe the exact problem: you want carrier unlocking, not a SIM PIN reset or help signing in to an Apple Account.',
        'Ask support to identify the activation date and policy used for your device.',
        'If the answer conflicts with your records, provide the relevant receipt or dated promise and request a review.',
        'Ask whether the case is ineligible, approved but pending, or already completed. Record the reason and reference number.',
        'If a future action is needed, ask for the specific date or document instead of accepting an unexplained instruction to try again later.',
      ] },
      { kind: 'p', text: 'For a used phone, ask the seller to cooperate with any account verification that support requires. If you are outside the United States, confirm that you can reach the official support route before spending money on a local SIM. Keep your marketplace return deadline in view while the issue is unresolved.', links: [{ label: 'Review the used-phone buying checklist', href: '/articles/checks-before-buying-a-used-phone' }] },
      { kind: 'h2', id: 'confirm-result', text: 'Confirm completion without confusing different locks' },
      { kind: 'p', text: 'After carrier confirmation, open Settings, General, About and check Carrier Lock. Apple identifies No SIM restrictions as the unlocked state. Follow the receiving carrier’s SIM or eSIM activation instructions separately.', links: [{ label: 'Apple’s carrier-unlock instructions', href: 'https://support.apple.com/en-us/109316' }, { label: 'Compare ways to check an iPhone’s unlock status', href: '/articles/how-to-check-if-iphone-is-unlocked' }] },
      { kind: 'p', text: 'A SIM PIN or PUK prompt concerns the SIM or eSIM, while an iPhone passcode protects access to the device. An iPhone Locked to Owner screen concerns Activation Lock. None is proof of a carrier-unlock refusal. A lost-device block or disputed finance balance is also a separate issue to resolve with the responsible company, not something to assume an unlock purchase will erase.', links: [{ label: 'Apple’s SIM PIN guidance', href: 'https://support.apple.com/en-us/118228' }, { label: 'Read the Activation Lock guide', href: '/articles/iphone-locked-to-owner-legitimate-fixes' }] },
      { kind: 'h2', id: 'before-paying', text: 'Before paying a third party' },
      { kind: 'p', text: 'Ask exactly what is being sold: a status report, help reviewing eligibility, submission assistance or a completed unlock. Require written delivery and refund terms. Reject any promise that a payment automatically overrides a disputed carrier record. iUnlockMobile availability for a particular Metro device must be confirmed before an order; this informational guide does not establish that the service is offered.', links: [{ label: 'Understand IMEI unlock service deliverables', href: '/articles/imei-unlock-iphone-service-checklist' }] },
      { kind: 'cta', text: 'Not sure which restriction you are facing? Send the carrier name and a redacted description of the message so we can clarify the next step and current service availability. Do not send passwords or verification codes.', href: '/contact', label: 'Ask about your device' },
    ],
    faq: [
      { question: 'Is the MetroPCS iPhone unlock waiting period still 180 days?', answer: 'The current Metro policy states 365 days from activation. If you have evidence of different terms for your transaction, ask Metro for a device-specific review rather than relying on an old general guide.' },
      { question: 'Does buying a used Metro iPhone prove that it is eligible?', answer: 'No. Ask for evidence about the original device and activation record, and verify the present lock status. The resale date alone does not establish eligibility.' },
      { question: 'Should I use the T-Mobile policy for a Metro phone?', answer: 'Do not choose a policy from branding alone. Confirm which carrier controls the device lock and use that carrier’s applicable rules.' },
      { question: 'What should I do when support says the iPhone is already unlocked?', answer: 'Record the case reference, check the current Carrier Lock result and describe the exact remaining error. Separate the unlock decision from activation with the new provider.' },
      { question: 'Can a paid service guarantee an early Metro unlock?', answer: 'Do not rely on an unconditional promise. First identify the unmet requirement and ask what the paid service actually delivers, including its written refusal and refund terms.' },
    ],
  },
  {
    slug: 'iphone-carrier-unlock-free-costs',
    title: 'iPhone Carrier Unlock Free: Real Costs',
    heading: 'iPhone Carrier Unlock Free: What Costs Can Still Apply?',
    description: 'Want an iPhone carrier unlock free of service fees? Separate official unlocking from device payoff, plan costs and paid third-party assistance.',
    standfirst: 'A free unlock can still have eligibility conditions. Compare the cost of the carrier’s action with money already owed and the price of your next mobile plan.',
    published: '2026-09-20',
    updated: '2026-09-20',
    minutes: 7,
    topic: 'Free iPhone carrier unlock',
    blocks: [
      { kind: 'p', text: 'An iPhone carrier unlock free of an unlocking fee is possible through carriers that provide it for eligible devices. It does not mean the remaining phone balance disappears, that every phone qualifies immediately, or that service on your next network is included. Before paying anyone, separate the unlock itself from the costs and conditions around it.' },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'Check the official carrier route before buying a paid unlock service.',
        'Ask whether a quoted payment is an unlock fee, a device balance, a service bill or optional assistance.',
        'Compare the complete cost of switching, not just the advertised unlock price.',
        'Free status checking and completed carrier unlocking are different deliverables.',
        'Never treat a request for account passwords or verification codes as an ordinary unlock requirement from an unknown seller.',
      ] },
      { kind: 'h2', id: 'official-free-route', text: 'Where does the free official route begin?' },
      { kind: 'p', text: 'Apple says the carrier, not Apple, handles carrier unlocking. For example, T-Mobile explicitly offers unlocking free of charge for eligible devices, but its postpaid rules still require financed or leased phones to be paid off and any canceled-account balance to be zero. Free describes the unlocking action; it is not a waiver of those obligations.', links: [{ label: 'Apple explains who can unlock an iPhone', href: 'https://support.apple.com/en-us/109316' }, { label: 'Verify T-Mobile’s free-unlock and payment conditions', href: 'https://www.t-mobile.com/responsibility/consumer-info/policies/sim-unlock-policy' }] },
      { kind: 'p', text: 'AT&T’s official portal accepts requests from people without an AT&T account as well as customers, subject to its device requirements. This matters when a second-hand buyer assumes a paid intermediary is the only option. Use the correct carrier’s current portal and policy; do not transplant one network’s timing rules to another.', links: [{ label: 'Check AT&T’s device-unlock request portal', href: 'https://www.att.com/deviceunlock/' }, { label: 'Use the AT&T request and status guide', href: '/articles/att-iphone-unlock-request-status' }] },
      { kind: 'h2', id: 'cost-categories', text: 'Five costs that should not be combined into one unlock price' },
      { kind: 'table', head: ['Cost category', 'What to clarify', 'How to compare it'], rows: [
        ['Carrier unlocking fee', 'Does the official policy charge for the actual unlock?', 'Check the carrier’s published terms before paying an intermediary.'],
        ['Device finance balance', 'Is this an existing debt on the phone?', 'Request an itemized payoff figure from the responsible provider.'],
        ['Existing mobile service', 'Is a bill or service condition still outstanding?', 'Separate already-owed amounts from optional future service.'],
        ['New carrier SIM, eSIM or plan', 'What will it cost to use the destination network?', 'Check activation, plan and roaming terms separately.'],
        ['Third-party assistance', 'Is the purchase a report, review, submission or completed unlock?', 'Compare the exact deliverable and refusal/refund conditions.'],
      ] },
      { kind: 'p', text: 'The table is a budgeting checklist, not a statement that every category applies. Build two totals: what you already owe regardless of switching, and the additional amount you would spend to move networks now. That distinction makes a free official unlock easier to compare with an advertised paid package without inventing a universal price.' },
      { kind: 'h3', id: 'payoff-quote', text: 'When the answer is “pay off the phone first”' },
      { kind: 'p', text: 'Ask who owns the balance, which device it belongs to and whether the quoted figure settles the relevant requirement. If a second-hand seller owes it, do not send money to a stranger on the assumption that a payment will reach the account. Ask the seller to resolve the issue with the provider and produce confirmation; consider the marketplace’s dispute route while protection is still available.' },
      { kind: 'h3', id: 'waiting-versus-paying', text: 'When waiting is the missing condition' },
      { kind: 'p', text: 'Get a device-specific explanation of what changes on the eligibility date. Before buying extra service, ask whether that purchase is actually required by the applicable policy. Compare waiting with returning the phone or choosing another device. A lower advertised unlock price is not useful if the seller cannot explain why the device would qualify.' },
      { kind: 'h2', id: 'free-offer-checklist', text: 'Evaluate a free iPhone SIM unlock offer before sharing data' },
      { kind: 'list', ordered: true, items: [
        'Find the official carrier page independently; do not assume a search ad is the carrier.',
        'Read what the free step delivers. An initial IMEI lookup may be a report rather than an unlock request.',
        'Look for any later charge, subscription, credit requirement or paid final step before submitting details.',
        'Ask how an ineligible result is handled and whether any payment is refundable.',
        'Stop if an unknown provider requests your Apple Account password, device passcode or a one-time login code.',
      ] },
      { kind: 'p', text: 'A legitimate assistance service should explain its role and the limits of its work. It might organize information or help submit a request, but its fee does not itself establish carrier approval. Keep receipts and the written description of the service. Do not install an unfamiliar configuration profile or give remote access merely because a page labels the process free.', links: [{ label: 'Compare IMEI checks with unlock-service deliverables', href: '/articles/imei-unlock-iphone-service-checklist' }] },
      { kind: 'h2', id: 'identify-the-lock', text: 'Make sure the purchase would address the right restriction' },
      { kind: 'p', text: 'Carrier Lock concerns using another mobile network. A SIM PIN or PUK concerns the SIM or eSIM; a passcode concerns access to the iPhone. Activation Lock ties a device to its owner’s Apple Account. Blacklist reports and finance disputes need their own resolution. A carrier-unlock offer is not a substitute for any of those processes.', links: [{ label: 'Apple’s SIM PIN and PUK advice', href: 'https://support.apple.com/en-us/118228' }, { label: 'Apple explains Activation Lock', href: 'https://support.apple.com/en-us/108794' }, { label: 'Identify eligibility issues before paying', href: '/articles/iphone-carrier-unlock-eligibility' }] },
      { kind: 'h2', id: 'verify-before-switching', text: 'Verify the result before buying your next plan' },
      { kind: 'p', text: 'After the carrier confirms completion, look for No SIM restrictions under Settings, General, About, Carrier Lock. Then confirm device compatibility and activation requirements with the receiving provider. Keep a working connection available until the new line functions; an unlock confirmation is not a promise that every plan will activate successfully.', links: [{ label: 'Follow Apple’s unlock-verification steps', href: 'https://support.apple.com/en-us/109316' }, { label: 'Read the international-use planning guide', href: '/articles/unlock-iphone-for-international-use-travel-checklist' }] },
      { kind: 'cta', text: 'Have a quote you do not understand? Contact iUnlockMobile with the carrier name and a redacted description of the proposed service. Ask about the exact deliverable and current availability before placing an order.', href: '/contact', label: 'Clarify an unlock service' },
    ],
    faq: [
      { question: 'Can I get an iPhone carrier unlock free?', answer: 'Some carriers expressly provide free unlocking for eligible devices. Check your carrier’s policy and official request route first. Free unlocking does not mean outstanding device or service obligations are canceled.' },
      { question: 'Is a free IMEI check the same as a free unlock?', answer: 'No. A check provides information; an unlock requires a completed carrier-authorized change. Read the stated deliverable before treating a report or eligibility result as completion.' },
      { question: 'Does a paid service eliminate my phone finance balance?', answer: 'Do not assume so. Ask the finance provider about the balance and ask the service seller exactly what its fee covers. Treat debt settlement and unlocking as separate questions.' },
      { question: 'Can I request an unlock without being the original customer?', answer: 'There may be an official route: AT&T, for example, accepts noncustomer requests. Eligibility and verification still apply, so confirm the process with the carrier responsible for the phone.' },
      { question: 'Should I pay someone to remove a SIM PIN instead?', answer: 'Use the carrier’s official SIM PIN or PUK support process. Do not guess codes or purchase a carrier unlock to solve a different restriction.' },
    ],
  },
  {
    slug: 'boost-mobile-iphone-unlock-policy-guide',
    title: 'Boost Mobile iPhone Unlock Guide',
    heading: 'Boost Mobile iPhone Unlock: Postpaid, Prepaid and Delay Guide',
    description: 'Need a Boost Mobile iPhone unlock? Compare postpaid, prepaid and military eligibility, automatic timing and steps if it stays locked.',
    standfirst: 'Boost uses different eligibility rules for postpaid and prepaid devices. Confirm the plan type, payoff and activation record before escalating a delay.',
    published: '2026-09-19',
    updated: '2026-09-21',
    minutes: 8,
    topic: 'Boost Mobile iPhone unlock',
    blocks: [
      {
        kind: 'p',
        text: 'A Boost Mobile iPhone unlock is controlled by Boost’s current device record, not by an unlock code found online. Postpaid iPhones become eligible after the financing plan is completed, while prepaid devices follow a separate activation-based policy. Boost says eligible devices are normally unlocked remotely, so the useful first step is to identify the plan type and the requirement that is still open.',
      },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'A Boost postpaid iPhone bought outright is eligible immediately; a financed device becomes eligible after the financing plan is completed.',
        'A Boost prepaid device generally reaches eligibility one year after initial activation and must also satisfy the stated balance, usage and account-status conditions.',
        'Boost says eligible postpaid devices are automatically unlocked remotely within two business days without an additional fee. For eligible prepaid devices, Boost says it will automatically unlock them remotely within two business days after eligibility, subject to the stated payment, usage and account-status conditions.',
        'Deployed U.S. military customers have a documented international SIM-unlock route with separate evidence requirements.',
        'After Boost confirms completion, verify Carrier Lock in iPhone Settings instead of looking for an iPhone unlock code.',
      ] },
      { kind: 'h2', id: 'current-policy', text: 'Boost Mobile iPhone unlock eligibility by account type' },
      {
        kind: 'p',
        text: 'Boost’s published policy distinguishes devices purchased on postpaid plans from devices activated on prepaid plans. It also says Boost cannot unlock a phone locked by another carrier. Use the table as a starting point, then ask Boost to confirm the record for the specific IMEI because account history and technical capability can affect the result.',
        links: [{ label: 'Read Boost Mobile’s current unlocking policy', href: 'https://help.boostmobile.com/docs/unlocking-policy' }],
      },
      { kind: 'table', head: ['Device category', 'Published eligibility point', 'Expected Boost action'], rows: [
        ['Postpaid, financed', 'After the financing plan is completed.', 'Remote automatic unlock within two business days after eligibility.'],
        ['Postpaid, paid in full at purchase', 'Eligible right away under the published postpaid rule.', 'Remote automatic unlock within two business days after eligibility.'],
        ['Prepaid', 'One year after initial activation, after the stated balance, usage and account-status requirements are met.', 'Remote automatic unlock within two business days after eligibility.'],
        ['Overseas military deployment', 'Customer, account and deployment requirements must be documented and the device must support an international SIM unlock.', 'Customer or eligible family member contacts Boost to request the documented exception.'],
        ['Locked by another carrier', 'Not a Boost-controlled lock.', 'The carrier that owns the lock must handle the request.'],
      ] },
      { kind: 'h3', id: 'postpaid', text: 'Postpaid Boost iPhone' },
      {
        kind: 'p',
        text: 'For a postpaid device purchased from Boost, the financing balance is the central timing condition. Boost says a device paid in full at purchase is eligible right away, while a financed device becomes eligible after its financing plan is complete. The policy describes a remote automatic unlock within two business days after eligibility and no additional unlock fee.',
        links: [{ label: 'Verify the postpaid wording on Boost’s policy page', href: 'https://help.boostmobile.com/docs/unlocking-policy' }],
      },
      { kind: 'h3', id: 'prepaid', text: 'Prepaid Boost iPhone' },
      {
        kind: 'p',
        text: 'Boost’s prepaid rule uses one year from initial activation, not simply one year from the purchase receipt. Any financed prepaid-device balance must be paid in full, and an account that is suspended at the one-year point is not eligible until the suspension is cleared. Boost also says payment or usage requirements must be met, so request the device-specific eligibility date instead of estimating it from memory.',
        links: [{ label: 'Check Boost’s prepaid eligibility conditions', href: 'https://help.boostmobile.com/docs/unlocking-policy' }],
      },
      {
        kind: 'note',
        text: 'Boost states that a prepaid device already unlocked through a customer request for international travel will not be automatically unlocked again at the one-year mark. If your history includes a travel request, ask Boost what unlock status is recorded for the IMEI.',
      },
      { kind: 'h3', id: 'military', text: 'Overseas military deployment' },
      {
        kind: 'p',
        text: 'Boost publishes an international SIM-unlock exception for an authenticated current customer, or a family member on the account, who is an active U.S. military member with overseas deployment papers. The account must be in good standing and the device must be technically capable of the international SIM unlock. This exception is requested through Boost rather than a third-party service.',
        links: [{ label: 'Review Boost’s military unlock requirements', href: 'https://help.boostmobile.com/docs/unlocking-policy' }],
      },
      { kind: 'h2', id: 'request-steps', text: 'How to handle a Boost Mobile iPhone unlock' },
      { kind: 'list', ordered: true, items: [
        'Open Settings > General > About and record the IMEI and the current Carrier Lock result without posting the full IMEI publicly.',
        'Confirm whether Boost classifies the device as postpaid or prepaid and identify the purchase or initial-activation record that applies.',
        'For postpaid, confirm that the financing plan is complete. For prepaid, confirm the one-year activation point, device balance and account status.',
        'Allow the published automatic-unlock window after the device becomes eligible while keeping the iPhone connected to WiFi or cellular data.',
        'If the window passes, contact Boost through its official support route and request the exact unmet condition or recorded completion date.',
        'After confirmation, restart the iPhone and check Settings > General > About > Carrier Lock for No SIM restrictions.',
      ] },
      {
        kind: 'p',
        text: 'Apple says only the carrier can unlock an iPhone for another network. An iPhone does not use the network unlock code commonly associated with some Android devices; the carrier authorization is reflected in Apple’s activation system and the Carrier Lock field.',
        links: [
          { label: 'Follow Apple’s current carrier-unlock instructions', href: 'https://support.apple.com/en-us/109316' },
          { label: 'Compare reliable iPhone unlock-status checks', href: '/articles/how-to-check-if-iphone-is-unlocked' },
        ],
      },
      { kind: 'h2', id: 'still-locked', text: 'Why an eligible Boost iPhone may still show SIM locked' },
      { kind: 'table', head: ['What you see', 'Likely question to verify', 'Next action'], rows: [
        ['Financing was just completed', 'Has Boost marked the plan complete and started the two-business-day window?', 'Keep the payoff confirmation and ask Boost for the recorded eligibility time.'],
        ['Prepaid service is one year old', 'Was the date counted from initial activation, and is the account suspended or a balance still open?', 'Ask Boost to name the unmet prepaid condition.'],
        ['Boost says complete, but Carrier Lock remains', 'Has the iPhone received the remote authorization?', 'Connect to WiFi or cellular data, restart and return to the same Boost case if the status does not update.'],
        ['A new SIM or eSIM will not activate', 'Is the phone unlocked but incompatible or incorrectly provisioned?', 'Check No SIM restrictions, then troubleshoot with the destination carrier.'],
        ['The phone came from another carrier', 'Which carrier still owns the lock record?', 'Submit the request to that original carrier, not Boost.'],
      ] },
      { kind: 'h3', id: 'automatic-delay', text: 'Automatic unlock did not arrive' },
      {
        kind: 'p',
        text: 'Do not place a duplicate paid order just because an automated change is late. Capture the Carrier Lock screen, payoff or activation evidence and Boost case reference. Ask support whether the IMEI is eligible, pending, technically unable to receive a remote unlock or associated with a different carrier record. Each answer requires a different next step.',
      },
      { kind: 'h3', id: 'new-carrier-fails', text: 'No SIM restrictions appears, but the new carrier fails' },
      {
        kind: 'p',
        text: 'That is no longer a Boost carrier-lock problem. The destination provider must support the exact iPhone model and activate its SIM or eSIM correctly. A phone can be unlocked yet still fail a compatibility check, lack a required network feature or show a line-provisioning error.',
        links: [
          { label: 'Use the SIM Not Supported troubleshooting guide', href: '/articles/iphone-sim-not-supported-after-switching-carriers' },
          { label: 'Prepare an unlocked iPhone for international use', href: '/articles/unlock-iphone-for-international-use-travel-checklist' },
        ],
      },
      { kind: 'h2', id: 'different-locks', text: 'Problems a Boost carrier unlock does not remove' },
      { kind: 'list', items: [
        'iPhone Locked to Owner or Activation Lock, which is linked to the owner’s Apple Account.',
        'A forgotten screen passcode or Security Lockout message.',
        'A SIM PIN or PUK challenge tied to one physical SIM or eSIM line.',
        'A lost, stolen, fraud or blacklist record that requires the reporting party or carrier to resolve it.',
        'Hardware compatibility and destination-carrier activation requirements.',
      ] },
      {
        kind: 'p',
        text: 'Describe the exact screen before buying help. “SIM locked” in the Carrier Lock field points to a carrier restriction; “iPhone Locked to Owner” points to Activation Lock and cannot be resolved by a carrier-unlock order.',
        links: [{ label: 'Identify iPhone Locked to Owner correctly', href: '/articles/iphone-locked-to-owner-legitimate-fixes' }],
      },
      { kind: 'h2', id: 'third-party-service', text: 'What a third-party unlock service can and cannot do' },
      {
        kind: 'p',
        text: 'A legitimate provider can check supported device details, explain Boost’s published conditions or submit a request through an available authorized route. It cannot make an unpaid or ineligible device eligible, guarantee Boost’s decision, alter an IMEI or bypass Apple ownership protection. Before paying, ask whether the deliverable is a report, eligibility review, submitted request or completed carrier unlock.',
        links: [{ label: 'Review the IMEI unlock service checklist', href: '/articles/imei-unlock-iphone-service-checklist' }],
      },
      { kind: 'cta', text: 'Have the Boost plan type, Carrier Lock result and eligibility response? Send those details with the full IMEI and account data removed. We will confirm whether a relevant service is currently available before you order.', href: '/contact', label: 'Check Boost service availability' },
    ],
    faq: [
      { question: 'How long does a Boost Mobile iPhone unlock take after eligibility?', answer: 'Boost says eligible postpaid and prepaid devices are automatically unlocked remotely within two business days. If the status does not update, contact Boost with the IMEI, eligibility details and Carrier Lock result.' },
      { question: 'Does Boost unlock a postpaid iPhone after it is paid off?', answer: 'Boost’s policy says a financed postpaid device becomes eligible after the financing plan is complete. A postpaid device paid in full at purchase is eligible right away.' },
      { question: 'When is a prepaid Boost iPhone eligible?', answer: 'Boost publishes a one-year period from initial activation plus balance, usage and account-status conditions. Ask Boost to confirm the device-specific eligibility date and any unmet requirement.' },
      { question: 'Do I need an unlock code for a Boost iPhone?', answer: 'No. iPhone carrier authorization is applied remotely. After Boost confirms completion, check Settings > General > About > Carrier Lock for No SIM restrictions.' },
      { question: 'Can a service unlock a Boost iPhone with money still owed?', answer: 'A third party cannot erase a financing obligation or force carrier eligibility. The account holder must resolve the balance and other policy conditions with Boost.' },
    ],
  },
  {
    slug: 'xfinity-mobile-iphone-unlock-policy-guide',
    title: 'Xfinity Mobile iPhone Unlock Guide',
    heading: 'Xfinity Mobile iPhone Unlock: Eligibility and Delay Guide',
    description: 'Need an Xfinity Mobile iPhone unlock? Check the 60-day, payoff and account rules, automatic timing, verification and delay fixes.',
    standfirst: 'Xfinity usually unlocks an eligible iPhone automatically after payoff, but activation age, account balance and device status still determine eligibility.',
    published: '2026-09-19',
    updated: '2026-09-19',
    minutes: 7,
    topic: 'Xfinity Mobile iPhone unlock',
    blocks: [
      {
        kind: 'p',
        text: 'An Xfinity Mobile iPhone unlock normally happens remotely after every eligibility rule is satisfied. Xfinity says most phones unlock automatically within 48 hours of being paid off, but payoff alone is not the full checklist: the device must also meet the activation-age, account-balance and device-status rules. An iPhone does not need an Xfinity network unlock code.',
      },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'The Xfinity Mobile phone must have been activated for at least 60 days and must be paid in full.',
        'The associated Xfinity Mobile account cannot have a past-due balance.',
        'The device cannot be reported lost, stolen or involved in fraudulent activity.',
        'Xfinity says most eligible phones unlock automatically within 48 hours of payoff.',
        'Only an account holder, Primary user or Manager can request help with an unlock.',
      ] },
      { kind: 'h2', id: 'eligibility', text: 'Xfinity Mobile iPhone unlock eligibility checklist' },
      {
        kind: 'p',
        text: 'Xfinity publishes four core device and account rules and separately limits who can request the unlock. Meet all of them before treating a delay as a technical failure. If a used-phone seller controls the account, the buyer may not be authorized to resolve an account balance or request support.',
        links: [{ label: 'Read Xfinity Mobile’s current unlock requirements', href: 'https://www.xfinity.com/support/articles/eligible-to-unlock-phone' }],
      },
      { kind: 'table', head: ['Requirement', 'What to verify', 'Why it matters'], rows: [
        ['Activation age', 'The phone has been activated for at least 60 days.', 'Payoff does not replace the minimum activation period.'],
        ['Device payoff', 'The phone is paid in full.', 'Xfinity ties the normal automatic unlock to completed payoff.'],
        ['Account balance', 'The Xfinity Mobile account has no past-due balance.', 'A separate account debt can keep the device ineligible.'],
        ['Device status', 'The phone is not reported lost, stolen or involved in fraud.', 'Those records must be resolved with Xfinity or the reporting party.'],
        ['Authorized requester', 'The requester is the account holder, Primary user or Manager.', 'Other users may not be permitted to request the unlock.'],
      ] },
      { kind: 'h3', id: 'automatic-timing', text: 'When the automatic unlock should happen' },
      {
        kind: 'p',
        text: 'Xfinity says most phones unlock automatically within 48 hours of being paid off. Read that together with the other rules: an iPhone paid off before 60 days of activation is still waiting on the activation requirement, and a past-due account can remain ineligible. Record when the final requirement was satisfied before counting the delay.',
        links: [{ label: 'Confirm Xfinity’s automatic-unlock timing', href: 'https://www.xfinity.com/support/articles/eligible-to-unlock-phone' }],
      },
      { kind: 'h3', id: 'authorized-requester', text: 'Who can ask Xfinity to fix the delay' },
      {
        kind: 'p',
        text: 'The carrier limits unlock requests to account holders, Primary users and Managers. If you bought the iPhone secondhand, ask the seller to cooperate while the return or buyer-protection window is open. An IMEI report can describe some device records, but it does not give a buyer authority over someone else’s Xfinity account.',
        links: [{ label: 'Review the used-phone buying checklist', href: '/articles/checks-before-buying-a-used-phone' }],
      },
      { kind: 'h2', id: 'unlock-steps', text: 'How to unlock an eligible Xfinity Mobile iPhone' },
      { kind: 'list', ordered: true, items: [
        'Open Settings > General > About and record the IMEI and current Carrier Lock result privately.',
        'Confirm the activation date, full payoff and the absence of a past-due Xfinity Mobile balance.',
        'Confirm that the device has no unresolved lost, stolen or fraud record.',
        'Wait up to the published 48-hour automatic window after the final eligibility condition is met.',
        'Keep the iPhone connected to WiFi or cellular data, then restart it and check Carrier Lock again.',
        'If SIM locked remains, have an authorized account user contact Xfinity Assistant with the IMEI and evidence for each rule.',
      ] },
      {
        kind: 'p',
        text: 'Xfinity states that Apple phones do not need an unlock code. Apple likewise says only the carrier can authorize an iPhone unlock. When it is complete, Settings > General > About should show No SIM restrictions under Carrier Lock.',
        links: [
          { label: 'See Xfinity’s iPhone-specific completion guidance', href: 'https://www.xfinity.com/support/articles/eligible-to-unlock-phone' },
          { label: 'Follow Apple’s carrier-unlock instructions', href: 'https://support.apple.com/en-us/109316' },
        ],
      },
      { kind: 'h2', id: 'delay-troubleshooting', text: 'Why an Xfinity iPhone may still be locked' },
      { kind: 'table', head: ['Situation', 'Check first', 'Best next step'], rows: [
        ['Paid off less than 48 hours ago', 'When did Xfinity record the final payment?', 'Allow the published automatic window, then verify Carrier Lock.'],
        ['Paid off but activated less than 60 days ago', 'What is the recorded activation date?', 'Wait for the 60-day requirement or ask Xfinity whether an exception applies.'],
        ['Account shows a balance', 'Is any amount past due even though the phone itself is paid off?', 'The authorized account user resolves it with Xfinity.'],
        ['Used iPhone, no account access', 'Will the seller or authorized user contact Xfinity?', 'Use seller cooperation or return protection; do not impersonate the account holder.'],
        ['No SIM restrictions, but new line fails', 'Is the model compatible and the new SIM or eSIM correctly provisioned?', 'Troubleshoot activation with the destination carrier.'],
      ] },
      { kind: 'h3', id: 'paid-off-still-locked', text: 'The iPhone is paid off but still locked' },
      {
        kind: 'p',
        text: 'Ask Xfinity to state which rule is not satisfied instead of only asking whether the phone is “eligible.” Useful answers include the recorded activation date, payoff date, past-due status, device-status flag and requester role. If all are clear and the automatic window has passed, keep one support case open so the remote authorization can be traced.',
      },
      { kind: 'h3', id: 'unlocked-activation-fails', text: 'Carrier Lock is clear, but activation still fails' },
      {
        kind: 'p',
        text: 'No SIM restrictions confirms the carrier lock is removed; it does not guarantee another provider supports the model or has provisioned the line. Give the new carrier the exact iPhone model, IMEI or IMEI2 used for the line, EID for eSIM and the complete error message. Do not buy another unlock for a phone that already reports the unlocked status.',
        links: [
          { label: 'Troubleshoot iPhone SIM Not Supported', href: '/articles/iphone-sim-not-supported-after-switching-carriers' },
          { label: 'Review iPhone eSIM lock and setup errors', href: '/articles/how-to-unlock-esim-on-iphone' },
        ],
      },
      { kind: 'h2', id: 'international-travel', text: 'Using the Xfinity iPhone for international travel' },
      {
        kind: 'p',
        text: 'Xfinity says the device is not eligible to use another provider’s SIM, including a local travel data plan, until all unlock requirements are met. Check early rather than at the airport. If the iPhone is not yet eligible, compare Xfinity roaming with a separate unlocked device; a travel eSIM cannot bypass Carrier Lock.',
        links: [
          { label: 'Verify Xfinity’s travel-SIM restriction', href: 'https://www.xfinity.com/support/articles/eligible-to-unlock-phone' },
          { label: 'Use the international iPhone planning checklist', href: '/articles/unlock-iphone-for-international-use-travel-checklist' },
        ],
      },
      { kind: 'h2', id: 'military-exception', text: 'Military early-unlock exception' },
      {
        kind: 'p',
        text: 'Xfinity says an active armed-forces member may qualify to unlock before the phone is fully paid off with orders for deployment outside the United States for more than 90 days or a permanent change of duty station within the United States. The other unlock rules still apply. Xfinity directs customers to provide the paperwork through a store or its documented phone-support route.',
        links: [{ label: 'Review Xfinity’s current military exception', href: 'https://www.xfinity.com/support/articles/eligible-to-unlock-phone' }],
      },
      { kind: 'h2', id: 'wrong-service', text: 'Do not confuse carrier unlocking with other iPhone locks' },
      { kind: 'list', items: [
        'Activation Lock or iPhone Locked to Owner requires the linked owner or Apple’s documented ownership process.',
        'A forgotten passcode or Security Lockout is a device-access issue, not an Xfinity network restriction.',
        'A SIM PIN or PUK protects one line and comes from the carrier that issued that SIM or eSIM.',
        'A blacklist or fraud flag must be resolved with the reporting carrier or account holder.',
        'A compatibility failure belongs to the destination carrier even when the iPhone is unlocked.',
      ] },
      {
        kind: 'p',
        text: 'A third-party service cannot shorten Xfinity’s 60-day rule, clear a balance, change an authorized requester or remove a lost or stolen report. A legitimate provider should identify the exact deliverable and refuse to advertise an unlock-code solution for an iPhone.',
        links: [
          { label: 'Understand what a network unlock changes', href: '/articles/network-unlock-explained' },
          { label: 'Check an IMEI unlock offer before paying', href: '/articles/imei-unlock-iphone-service-checklist' },
        ],
      },
      { kind: 'cta', text: 'Have the Xfinity activation date, payoff status and Carrier Lock result? Send those facts with the full IMEI and account details removed. We will confirm whether a relevant service is currently available before you order.', href: '/contact', label: 'Check Xfinity service availability' },
    ],
    faq: [
      { question: 'How long does Xfinity Mobile take to unlock an iPhone?', answer: 'Xfinity says most phones unlock automatically within 48 hours of being paid off, provided every other rule is met, including 60 days of activation and an account without a past-due balance.' },
      { question: 'Does an Xfinity iPhone need an unlock code?', answer: 'No. Xfinity says Apple phones unlock through remote updates while connected to WiFi or cellular data. Verify No SIM restrictions under Carrier Lock afterward.' },
      { question: 'Can Xfinity unlock an iPhone before 60 days?', answer: 'The published standard rule requires at least 60 days of activation. Xfinity documents a separate military exception, but says the other requirements still apply.' },
      { question: 'Who can request an Xfinity Mobile iPhone unlock?', answer: 'Xfinity limits requests to the account holder, a Primary user or a Manager on the Xfinity Mobile account.' },
      { question: 'Why is a paid-off Xfinity iPhone still locked?', answer: 'Possible reasons include the 60-day activation rule, a past-due account balance, a device-status flag, the automatic processing window or an unauthorized requester. Ask Xfinity to name the exact unmet rule.' },
    ],
  },
  {
    slug: 'iphone-locked-to-owner-legitimate-fixes',
    title: 'iPhone Locked to Owner: What to Do',
    heading: 'iPhone Locked to Owner: Legitimate Ways to Regain Access',
    description: 'Seeing iPhone Locked to Owner? Learn what Activation Lock means, how the owner or seller can remove it, and which services cannot help.',
    standfirst: 'This screen is Apple Activation Lock, not a carrier or SIM restriction. The correct route depends on whether you are the owner, buyer or organization.',
    published: '2026-09-18',
    updated: '2026-09-18',
    minutes: 7,
    topic: 'iPhone Activation Lock',
    blocks: [
      {
        kind: 'p',
        text: 'An iPhone Locked to Owner screen means Apple Activation Lock is protecting the device. It does not mean the iPhone needs a carrier unlock, SIM unlock or network code. The legitimate next step is to use the Apple Account linked to the phone, ask the previous owner to remove it, contact an organization that manages it, or submit eligible proof of purchase to Apple.',
      },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'Activation Lock turns on with Find My and remains linked to the owner’s Apple Account.',
        'A carrier unlock, IMEI carrier service, SIM PIN or factory reset does not remove iPhone Locked to Owner.',
        'The current owner can sign in on the device; a previous owner can remove the iPhone through Find My on the web.',
        'Apple offers a support-request route when the applicant has qualifying proof of purchase.',
        'Do not buy a used iPhone that still shows this screen or asks for the previous owner’s account during setup.',
      ] },
      { kind: 'h2', id: 'what-it-means', text: 'What iPhone Locked to Owner actually means' },
      {
        kind: 'p',
        text: 'Apple says Find My automatically enables Activation Lock. The iPhone checks Apple’s activation servers when it is activated or recovered, and the linked Apple Account credentials are required before someone can turn off Find My, erase the device for reuse or reactivate it. Erasing the phone alone does not sever that ownership link.',
        links: [{ label: 'Read Apple’s current Activation Lock explanation', href: 'https://support.apple.com/en-us/108794' }],
      },
      { kind: 'table', head: ['Restriction', 'What it protects or controls', 'Who owns the resolution'], rows: [
        ['iPhone Locked to Owner / Activation Lock', 'Ownership and reactivation through Find My.', 'The linked owner, managing organization or Apple’s documented support process.'],
        ['Carrier Lock', 'Use of a different mobile network.', 'The carrier responsible for the device restriction.'],
        ['SIM PIN or PUK', 'Access to one physical SIM or eSIM line.', 'The carrier that issued that line.'],
        ['Screen passcode', 'Access to data and controls on the device.', 'The owner using Apple’s passcode recovery route.'],
        ['Blacklist or finance record', 'Network access or an account obligation.', 'The reporting carrier, account holder or seller.'],
      ] },
      { kind: 'h2', id: 'choose-your-situation', text: 'Choose the situation that matches the iPhone' },
      { kind: 'h3', id: 'your-own-iphone', text: 'If this is your own iPhone' },
      {
        kind: 'p',
        text: 'Follow the onscreen prompt with the Apple Account and password used to set up the device, or the device passcode when Apple offers that option. If the account name is unclear, try the email addresses or phone numbers you normally use with Apple services, then use Apple’s account or password recovery links rather than guessing repeatedly.',
        links: [{ label: 'Use Apple’s Activation Lock removal instructions', href: 'https://support.apple.com/en-us/108934' }],
      },
      { kind: 'list', ordered: true, items: [
        'Read the masked Apple Account clue on the screen and compare it with your normal Apple sign-in details.',
        'Use Apple’s official account lookup or password-reset process if you cannot sign in.',
        'Keep the original purchase document available in case Apple support needs to review ownership.',
        'Avoid tools that ask you to disable security software, share a verification code or install an unknown profile.',
      ] },
      { kind: 'h3', id: 'previous-owner', text: 'If the iPhone belongs to a previous owner’s account' },
      {
        kind: 'p',
        text: 'Ask the previous owner to remove the iPhone from their account. Apple instructs an owner who does not have the phone to sign in to Find My on the web, select the device and choose Remove This Device. The seller should do this themselves; they should not send you their Apple Account password.',
        links: [{ label: 'Give the seller Apple’s web-removal steps', href: 'https://support.apple.com/en-us/108934' }],
      },
      {
        kind: 'note',
        text: 'After the seller says the device was removed, restart setup and verify that you can reach the Hello screen without being asked for the previous owner’s account. A chat screenshot or verbal promise is not the final check.',
      },
      { kind: 'h3', id: 'business-school', text: 'If a business or school owns the iPhone' },
      {
        kind: 'p',
        text: 'Contact the organization’s IT administrator or device-management team. Apple directs managed-device owners to their organization because the device can be tied to institutional enrollment and ownership records. Do not try to remove management or ownership controls without authorization.',
        links: [{ label: 'Review Apple’s managed-device direction', href: 'https://support.apple.com/en-us/108934' }],
      },
      { kind: 'h3', id: 'proof-of-purchase', text: 'If the owner cannot recover the account but has proof of purchase' },
      {
        kind: 'p',
        text: 'Apple provides an Activation Lock support-request route for people who have proof-of-purchase documentation. Apple decides whether the documentation is sufficient. Prepare the unaltered receipt and the device identifiers that match it; a marketplace message, payment screenshot or IMEI report is not automatically equivalent to Apple’s required evidence.',
        links: [
          { label: 'Start from Apple’s official Activation Lock support page', href: 'https://support.apple.com/en-us/108934' },
          { label: 'Find the iPhone IMEI or serial number safely', href: 'https://support.apple.com/en-us/108037' },
        ],
      },
      { kind: 'h2', id: 'used-iphone', text: 'If you bought the iPhone used' },
      {
        kind: 'p',
        text: 'Apple advises buyers not to take ownership of a used iPhone protected by Activation Lock. Contact the seller immediately and request account removal or a return under the marketplace’s buyer-protection process. Preserve the listing, receipt, serial or IMEI, messages and payment record. Do not pay a second party to “bypass” the screen while the return window closes.',
        links: [
          { label: 'Check Apple’s used-device warning', href: 'https://support.apple.com/en-us/108794' },
          { label: 'Use our complete used-phone buying checklist', href: '/articles/checks-before-buying-a-used-phone' },
        ],
      },
      { kind: 'table', head: ['Seller response', 'Recommended action'], rows: [
        ['Seller removes the device remotely', 'Restart setup and verify the previous account prompt is gone before accepting the sale.'],
        ['Seller says a carrier unlock will fix it', 'Decline: carrier unlocking does not remove Activation Lock.'],
        ['Seller cannot prove ownership or stops responding', 'Use the marketplace dispute or payment-provider process promptly.'],
        ['Seller asks for your account credentials', 'Do not share them; report the request through the platform.'],
      ] },
      { kind: 'h3', id: 'found-device', text: 'If you found the iPhone or it may be lost or stolen' },
      {
        kind: 'p',
        text: 'Do not try to activate, resell or dismantle it. Look for a Lost Mode message that provides a safe contact route, hand it to the venue or transport operator where it was found, or follow local lost-property procedures. Activation Lock is designed to deter unauthorized reuse.',
        links: [{ label: 'See how Apple describes Lost Mode and Activation Lock', href: 'https://support.apple.com/en-us/108794' }],
      },
      { kind: 'h2', id: 'what-will-not-work', text: 'What will not remove iPhone Locked to Owner' },
      { kind: 'list', items: [
        'A carrier or SIM unlock: it changes cellular-network eligibility, not Apple Account ownership.',
        'An IMEI status report: it can return information from its source but does not remove Activation Lock.',
        'A factory reset or software update: Activation Lock is checked again during activation.',
        'A new physical SIM or eSIM: a cellular plan does not replace the linked Apple Account.',
        'Changing or “cleaning” an IMEI: legitimate services do not alter the device identity to defeat ownership protection.',
      ] },
      {
        kind: 'p',
        text: 'Keep the distinction clear when comparing services. A provider may sell a carrier report or submit a supported network-unlock request, but neither deliverable grants ownership access. iUnlockMobile does not offer an Activation Lock bypass.',
        links: [
          { label: 'Learn what a network unlock actually changes', href: '/articles/network-unlock-explained' },
          { label: 'Learn what an IMEI check can and cannot tell you', href: '/articles/what-an-imei-check-tells-you' },
        ],
      },
      { kind: 'h2', id: 'avoid-scams', text: 'Red flags in “Locked to Owner” removal offers' },
      { kind: 'list', items: [
        'A guaranteed bypass for every model, ownership situation or iOS version.',
        'A request for your Apple Account password, two-factor code, device passcode or recovery key.',
        'Instructions to keep the seller out of the process when the seller’s account is still linked.',
        'A claim that a blacklist check, carrier unlock or SIM replacement removes Activation Lock.',
        'No written deliverable, eligibility criteria, refund terms or support identity before payment.',
      ] },
      { kind: 'h2', id: 'buying-check', text: 'The safest check before buying another used iPhone' },
      {
        kind: 'p',
        text: 'Have the seller erase the iPhone and begin setup while you watch. If the previous owner’s Apple Account is requested, stop. Apple says the device is ready for a new owner when setup reaches the Hello screen without that ownership prompt. Separately verify the IMEI, blacklist, carrier lock and receipt because those records answer different questions.',
        links: [{ label: 'Follow Apple’s pre-purchase Activation Lock check', href: 'https://support.apple.com/en-us/108794' }],
      },
      { kind: 'cta', text: 'Need help identifying which lock is on an iPhone? Send the exact message and model with personal details removed. We can explain whether an IMEI check or carrier service is relevant, but we do not bypass Activation Lock.', href: '/contact', label: 'Identify the lock type' },
    ],
    faq: [
      { question: 'Can an IMEI unlock remove iPhone Locked to Owner?', answer: 'No. An IMEI carrier unlock concerns cellular-network restrictions. iPhone Locked to Owner is Apple Activation Lock and requires the linked owner, managing organization or Apple’s documented support process.' },
      { question: 'Can the previous owner remove Activation Lock remotely?', answer: 'Yes. Apple instructs the owner to sign in to Find My on the web, select the device and remove it. Restart setup afterward to verify the account prompt is gone.' },
      { question: 'Will factory resetting the iPhone remove the owner lock?', answer: 'No. Activation Lock can remain after erasing and is checked again when the device activates.' },
      { question: 'What if I am the owner but forgot my Apple Account?', answer: 'Use Apple’s official account lookup and password-reset routes. If account recovery is not possible and you have qualifying proof of purchase, review Apple’s Activation Lock support-request option.' },
      { question: 'Should I buy an iPhone that says Locked to Owner?', answer: 'No. Apple advises buyers not to take ownership until the previous owner removes the device and setup no longer requests that account.' },
    ],
  },
  {
    slug: 'imei-unlock-iphone-service-checklist',
    title: 'IMEI Unlock iPhone: What You Pay For',
    heading: 'IMEI Unlock iPhone: What the Service Does Before You Pay',
    description: 'Understand an IMEI unlock for iPhone: carrier eligibility, required checks, realistic outcomes and red flags to review before you pay.',
    standfirst: 'The IMEI identifies the device used in a carrier-unlock request. It is not a master code and it does not override ownership or account records.',
    published: '2026-09-18',
    updated: '2026-09-18',
    minutes: 7,
    topic: 'IMEI iPhone unlock',
    blocks: [
      {
        kind: 'p',
        text: 'An IMEI unlock for iPhone is a carrier-unlock process tied to the device’s unique identifier. A legitimate service uses that identifier to check or submit a request through a supported route; it does not change the IMEI, install bypass software or remove Apple Activation Lock. Before paying, identify the original carrier, confirm the lock type and understand the exact deliverable.',
      },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'The IMEI identifies the iPhone; it does not prove eligibility or ownership by itself.',
        'Apple says only the responsible carrier can authorize an iPhone carrier unlock.',
        'An IMEI check, an unlock request and a completed unlock are three different deliverables.',
        'Financing, service history, account standing and lost/stolen records can affect the carrier’s decision.',
        'Verify Carrier Lock in Settings after completion and check compatibility with the new provider.',
      ] },
      { kind: 'h2', id: 'what-imei-means', text: 'What “IMEI unlock iPhone” means' },
      {
        kind: 'p',
        text: 'Apple lists the IMEI among the identifiers used to identify an iPhone for support. You can usually find it in Settings > General > About; Apple also documents alternatives for a device that cannot reach Settings. Share the number only through the carrier or a provider you have independently verified.',
        links: [{ label: 'Use Apple’s official IMEI lookup locations', href: 'https://support.apple.com/en-us/108037' }],
      },
      {
        kind: 'p',
        text: 'For carrier unlocking, the IMEI connects the request to one physical device. It is not a password and should never be advertised as a universal unlock key. The carrier still evaluates the device under its current policy. An intermediary can transmit information or arrange a supported request, but it cannot honestly guarantee every carrier decision.',
      },
      { kind: 'table', head: ['Deliverable', 'What you receive', 'What it does not prove'], rows: [
        ['IMEI status check', 'Information available from the selected data source.', 'That a carrier has approved or completed an unlock.'],
        ['Eligibility review', 'A comparison of known device details with current requirements.', 'That the carrier will accept every undocumented circumstance.'],
        ['Submitted unlock request', 'Evidence that a request was filed through the stated route.', 'That the request is already approved or complete.'],
        ['Completed carrier unlock', 'The carrier restriction should show as removed for that IMEI.', 'Compatibility with every network or removal of other lock types.'],
      ] },
      { kind: 'h2', id: 'before-paying', text: 'Seven checks before paying for an IMEI unlock' },
      { kind: 'list', ordered: true, items: [
        'Check Settings > General > About. If Carrier Lock says No SIM restrictions, do not buy another carrier unlock.',
        'Identify the original carrier from reliable purchase records or a device-specific carrier check.',
        'Read that carrier’s current eligibility policy for the plan type and purchase date.',
        'Confirm whether financing, service time, account standing or a lost/stolen record remains unresolved.',
        'Ask the seller or account holder for any action that only they can lawfully complete.',
        'Get the provider’s exact deliverable, estimated process, refusal handling and refund or credit terms in writing.',
        'Check the destination carrier’s support for the exact iPhone model, SIM or eSIM method and required features.',
      ] },
      {
        kind: 'p',
        text: 'Apple says “No SIM restrictions” under Carrier Lock means the iPhone is unlocked and that only the carrier can unlock it for another network. Use that device status and a carrier response as the main evidence, not a generic promise attached to an order number.',
        links: [
          { label: 'Follow Apple’s carrier-unlock guidance', href: 'https://support.apple.com/en-us/109316' },
          { label: 'Compare four ways to check iPhone unlock status', href: '/articles/how-to-check-if-iphone-is-unlocked' },
        ],
      },
      { kind: 'h2', id: 'correct-carrier', text: 'Why the original carrier matters' },
      {
        kind: 'p',
        text: 'Carrier locks are governed by the carrier responsible for the device record. Selecting the wrong network can produce a failed or irrelevant request even when the IMEI was typed correctly. For a used or imported iPhone, confirm the sales channel and country as well as the brand name; carriers with similar names or related corporate groups can operate separate policies and systems.',
      },
      { kind: 'h3', id: 'used-device', text: 'Used iPhone with incomplete history' },
      {
        kind: 'p',
        text: 'A buyer may not have access to the original account, payoff record or purchase receipt. An IMEI report can help identify some device facts, but it cannot create missing account history. Ask the seller to resolve obligations tied to their account. If they cannot or will not cooperate, compare the cost and uncertainty of further requests with returning the phone.',
        links: [
          { label: 'See what an IMEI check actually tells you', href: '/articles/what-an-imei-check-tells-you' },
          { label: 'Review the used-phone purchase checklist', href: '/articles/checks-before-buying-a-used-phone' },
        ],
      },
      { kind: 'h2', id: 'eligibility', text: 'Eligibility problems an IMEI alone cannot solve' },
      { kind: 'table', head: ['Issue', 'Why the IMEI is not enough', 'Correct next step'], rows: [
        ['Unpaid device financing', 'The obligation belongs to an account agreement.', 'Account holder resolves it with the carrier.'],
        ['Required service period not complete', 'The carrier uses its recorded activity, not a buyer’s estimate.', 'Ask the carrier for the device-specific eligibility date.'],
        ['Lost or stolen report', 'The reporting party controls the underlying record.', 'Resolve it with the seller, reporting party or carrier.'],
        ['Wrong original carrier', 'The request is sent to a system that does not own the lock.', 'Verify the responsible carrier before ordering.'],
        ['Unsupported model on new network', 'Unlocking does not add bands or carrier features.', 'Check the exact model with the destination provider.'],
      ] },
      { kind: 'h2', id: 'not-removed', text: 'What an IMEI carrier unlock does not remove' },
      {
        kind: 'p',
        text: 'Keep the other restrictions separate. Activation Lock protects ownership through the linked Apple Account. A screen passcode controls access to the device. A SIM PIN or PUK protects one cellular line. A blacklist record affects network service. A completed carrier unlock does not remove any of them.',
        links: [
          { label: 'Understand iPhone Locked to Owner', href: '/articles/iphone-locked-to-owner-legitimate-fixes' },
          { label: 'Review Apple’s Activation Lock explanation', href: 'https://support.apple.com/en-us/108794' },
        ],
      },
      { kind: 'h2', id: 'red-flags', text: 'Red flags before ordering an IMEI unlock service' },
      { kind: 'list', items: [
        '“Guaranteed for every carrier and every IMEI” without an eligibility check.',
        'A promise to change, repair or clean the IMEI rather than request a supported carrier unlock.',
        'Claims that carrier unlocking also removes Activation Lock, a passcode, PUK, blacklist or finance agreement.',
        'A request for your Apple Account password, two-factor code, carrier password or screen passcode.',
        'No explanation of whether you are buying a report, a submitted request or a completed result.',
        'No written policy for carrier refusal, incorrect carrier selection, duplicate orders or unavailable service.',
      ] },
      {
        kind: 'note',
        text: 'Protect the device identifier too. Do not publish a full IMEI in marketplace comments, social posts or public support forums. Send it only through the verified private form used for the specific check or request.',
      },
      { kind: 'h2', id: 'after-completion', text: 'How to verify the result after completion' },
      { kind: 'list', ordered: true, items: [
        'Keep the carrier or provider completion message and request reference.',
        'Open Settings > General > About and check Carrier Lock for No SIM restrictions.',
        'If the restriction remains, return to the same case with the IMEI and exact status rather than ordering again.',
        'Follow the new carrier’s physical-SIM or eSIM activation instructions.',
        'Test calls, messages and data, and ask the new carrier about any feature that still fails.',
      ] },
      {
        kind: 'p',
        text: 'An unlocked status does not guarantee coverage or full compatibility. The new provider must support the exact regional model and provision the line correctly. If No SIM restrictions is already shown but activation fails, troubleshoot the new SIM or eSIM rather than paying for another unlock.',
        links: [{ label: 'Use the SIM Not Supported troubleshooting guide', href: '/articles/iphone-sim-not-supported-after-switching-carriers' }],
      },
      { kind: 'h2', id: 'service-comparison', text: 'Questions that make two unlock offers comparable' },
      { kind: 'list', items: [
        'Which carrier, country, plan category and iPhone models does this exact service accept?',
        'Is the price for a check, eligibility review, request submission or completed unlock?',
        'Which conditions cause rejection, refund, account credit or additional review?',
        'What evidence confirms submission and what evidence confirms completion?',
        'How is the IMEI stored, used and deleted after the order?',
        'Which support route handles a completed notice when Carrier Lock still shows a restriction?',
      ] },
      { kind: 'cta', text: 'Already know the original carrier and current Carrier Lock status? Send the model, carrier and eligibility response with account details removed. We will confirm whether a relevant service is currently available before you order.', href: '/contact', label: 'Check service availability' },
    ],
    faq: [
      { question: 'Can an iPhone really be unlocked using the IMEI?', answer: 'The IMEI identifies the device in a carrier-unlock workflow. The responsible carrier still controls authorization under its policy; the number itself is not a master unlock code.' },
      { question: 'Is an IMEI check the same as an IMEI unlock?', answer: 'No. A check returns information from its selected source. An unlock request seeks a change to the carrier restriction. Confirm which deliverable you are buying.' },
      { question: 'Does an IMEI unlock remove iCloud Activation Lock?', answer: 'No. Activation Lock is Apple Account ownership protection. It requires the linked owner, managing organization or Apple’s documented proof-of-purchase support route.' },
      { question: 'Is an IMEI unlock permanent?', answer: 'A completed official carrier authorization changes the carrier restriction for that device. Verify No SIM restrictions afterward. It does not erase separate blacklist, finance or ownership issues.' },
      { question: 'Do I need to erase my iPhone after an IMEI unlock?', answer: 'Not normally when activating another carrier’s SIM or eSIM. Apple documents erase-and-restore for a specific situation where no other SIM is available after carrier confirmation; back up first and follow Apple’s current guidance.' },
    ],
  },
  {
    slug: 'verizon-iphone-unlock-current-policy',
    title: 'Verizon iPhone Unlock: Current Rules',
    heading: 'Verizon iPhone Unlock: Postpaid, Prepaid and Delay Checklist',
    description: 'Check Verizon iPhone unlock eligibility for postpaid, prepaid and business devices, plus the right steps when automatic unlock is delayed.',
    standfirst: 'Verizon now applies different unlock rules to postpaid and prepaid devices. Identify the plan type before relying on an old timeline.',
    published: '2026-09-17',
    updated: '2026-09-17',
    minutes: 7,
    topic: 'Verizon iPhone unlock',
    blocks: [
      {
        kind: 'p',
        text: 'A Verizon iPhone unlock is usually an automatic result of meeting the rule for the device, not a code you type into the phone. The important first step is to identify whether the iPhone was sold on postpaid, prepaid or business service. Verizon’s current published policy gives those categories different requirements, so advice based on a single waiting period can send you in the wrong direction.',
      },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'Check the current policy for the device’s original plan type instead of relying on an older Verizon timeline.',
        'Postpaid devices bought from Verizon are set to unlock automatically after full retail purchase or payoff of the financing balance, subject to policy exceptions.',
        'Verizon’s published prepaid rule requires 365 days of paid and active service before automatic unlocking.',
        'A lost, stolen or fraud record must be resolved with Verizon; another unlock order does not remove it.',
        'After Verizon confirms completion, verify Carrier Lock in iPhone Settings and then test the intended carrier.',
      ] },
      { kind: 'h2', id: 'current-policy', text: 'The current Verizon unlock policy at a glance' },
      {
        kind: 'p',
        text: 'Verizon’s policy page was updated on February 18, 2026. It says devices bought directly from Verizon are initially locked and separates postpaid, prepaid, business and deployed-military situations. Read the live policy again when you act because carrier terms can change after this guide is published.',
        links: [{ label: 'Read Verizon’s current device unlocking policy', href: 'https://www.verizon.com/support/device-unlocking-policy/' }],
      },
      { kind: 'table', head: ['Device category', 'Published unlock trigger', 'What to verify'], rows: [
        ['Postpaid', 'Full retail purchase or the device financing balance paid in full.', 'Payment method, payoff posting and any lost/stolen record.'],
        ['Prepaid', 'Completion of 365 days of paid and active service.', 'The device’s service history and whether Verizon flags theft or fraud.'],
        ['Business', 'Full retail purchase, payoff, or the applicable line term or termination-fee condition.', 'The organization’s agreement and the device’s account status.'],
        ['Deployed military', 'A separate verified deployment process applies.', 'Orders, account standing and Verizon’s stated active-service condition.'],
      ] },
      { kind: 'h3', id: 'postpaid', text: 'Postpaid iPhone: payoff is the central check' },
      {
        kind: 'p',
        text: 'For a postpaid iPhone purchased directly from Verizon, the published trigger is buying at full retail price or paying the device financing agreement in full. Verizon also says a secure payment method is required for immediate unlocking when paying the balance. If a Verizon Gift Card is used to buy the smartphone or pay the remaining balance, the policy states that unlocking is delayed by 35 days while the funds are verified.',
        links: [{ label: 'Confirm the postpaid and payment-method terms with Verizon', href: 'https://www.verizon.com/support/device-unlocking-policy/' }],
      },
      {
        kind: 'note',
        text: 'Paying the final balance and seeing the unlock on the iPhone are two different checkpoints. Keep the payment confirmation, then verify the device record and Carrier Lock status before selling the phone or activating another carrier.',
      },
      { kind: 'h3', id: 'prepaid', text: 'Prepaid iPhone: service history matters' },
      {
        kind: 'p',
        text: 'For a device purchased from Verizon for prepaid service, the current policy states 365 days of paid and active service before Verizon automatically removes the lock, unless the device is considered stolen or fraudulently purchased. Ask Verizon to confirm the date and activity it has recorded for the actual device. A receipt date, first activation and uninterrupted paid service are different facts; do not calculate eligibility from one of them without carrier confirmation.',
        links: [{ label: 'Check Verizon’s prepaid unlock wording', href: 'https://www.verizon.com/support/device-unlocking-policy/' }],
      },
      { kind: 'h3', id: 'business-military', text: 'Business and deployed-military cases need their own route' },
      {
        kind: 'p',
        text: 'Verizon publishes additional business triggers tied to the organization’s agreement, including the end of a line term or payment of an applicable termination fee. Its deployed-military section describes a verified relocation process and an account-in-good-standing condition. Use the relevant account team rather than treating either situation as a standard consumer request.',
        links: [{ label: 'Review Verizon’s business and military sections', href: 'https://www.verizon.com/support/device-unlocking-policy/' }],
      },
      { kind: 'h2', id: 'verify-status', text: 'How to check whether the Verizon iPhone is already unlocked' },
      {
        kind: 'p',
        text: 'On the iPhone, open Settings > General > About and find Carrier Lock. Apple says “No SIM restrictions” means the iPhone is unlocked. A successful payoff, support conversation or email is useful evidence, but the device status is the checkpoint you need before switching providers.',
        links: [
          { label: 'Follow Apple’s official carrier-lock check', href: 'https://support.apple.com/en-us/109316' },
          { label: 'Compare four reliable iPhone unlock checks', href: '/articles/how-to-check-if-iphone-is-unlocked' },
        ],
      },
      { kind: 'list', ordered: true, items: [
        'Record the IMEI in Settings and compare it with the Verizon device record, payoff receipt and any case reference.',
        'Confirm whether the original service was postpaid, prepaid or business.',
        'Ask Verizon whether the device has met the applicable trigger and whether an exception remains.',
        'After Verizon confirms completion, recheck Carrier Lock and follow the new carrier’s activation instructions.',
        'Test the functions you need on the new network instead of stopping at a successful SIM or eSIM installation.',
      ] },
      { kind: 'h2', id: 'automatic-delay', text: 'What to do when the automatic unlock appears delayed' },
      { kind: 'table', head: ['What you know', 'Evidence to collect', 'Best next contact'], rows: [
        ['Financing was paid off', 'Payment date, method, device IMEI and final-balance receipt.', 'Verizon account or device support.'],
        ['Prepaid service requirement appears complete', 'Activation and paid-service history tied to the device.', 'Verizon Prepaid support.'],
        ['Used iPhone has unclear history', 'Seller receipt, original account details the seller can lawfully provide, and IMEI.', 'Seller first, then Verizon through a verified channel.'],
        ['No SIM restrictions is shown but the new line fails', 'Exact error, eSIM or SIM details, coverage and compatibility result.', 'The new carrier, because the carrier lock is no longer the leading issue.'],
      ] },
      {
        kind: 'p',
        text: 'Ask for a device-specific answer: “Does this IMEI meet the current unlock policy, and if not, which requirement or exception remains?” Keep the case reference and the representative’s next step. Repeated generic requests make it harder to show where the process stopped.',
      },
      { kind: 'h3', id: 'used-verizon-iphone', text: 'If you bought the Verizon iPhone used' },
      {
        kind: 'p',
        text: 'The seller may need to resolve financing, account or ownership evidence that a buyer cannot access. Do not send a seller your Apple Account password, screen passcode or carrier account credentials. If the seller cannot supply a matching receipt or cooperate with Verizon, an iPhone unlock service cannot manufacture the missing account history.',
        links: [{ label: 'Use the used-phone purchase checklist', href: '/articles/checks-before-buying-a-used-phone' }],
      },
      { kind: 'h2', id: 'not-an-unlock', text: 'Do not confuse a Verizon carrier lock with these other restrictions' },
      { kind: 'table', head: ['Prompt or problem', 'What it controls', 'Correct route'], rows: [
        ['Carrier Lock', 'Use of cellular service from another carrier.', 'Verizon eligibility and unlock process.'],
        ['SIM PIN or PUK', 'Access to a physical SIM or eSIM line.', 'The carrier that issued that SIM or eSIM.'],
        ['iPhone passcode', 'Access to the device.', 'Apple’s device recovery guidance.'],
        ['Activation Lock', 'Apple Account ownership protection.', 'The legitimate owner and Apple’s official process.'],
        ['Lost/stolen or finance issue', 'Carrier or account records.', 'The reporting party, seller or Verizon.'],
      ] },
      {
        kind: 'p',
        text: 'Apple states that only the carrier can authorize a carrier unlock. A third party may help interpret a device report or arrange a supported request, but it cannot promise to bypass Verizon policy, erase a theft report or replace the original account holder. Ask exactly what the paid deliverable is before ordering.',
        links: [
          { label: 'Read how network-unlock services work', href: '/articles/network-unlock-explained' },
          { label: 'Review Apple’s official unlock limits', href: 'https://support.apple.com/en-us/109316' },
        ],
      },
      { kind: 'h2', id: 'after-unlock', text: 'After the unlock: confirm compatibility, not just approval' },
      {
        kind: 'p',
        text: 'Verizon warns that an unlocked device can still have limited functionality or fail on another carrier because network technologies differ. Give the new provider the exact iPhone model and IMEI, confirm physical-SIM or eSIM support, then test calls, messages and data. “Unlocked” removes one restriction; it does not guarantee every network feature.',
        links: [{ label: 'See Verizon’s definition and compatibility warning', href: 'https://www.verizon.com/support/device-unlocking-policy/' }],
      },
      { kind: 'cta', text: 'Have Verizon’s response but still do not know which service fits? Send the model, IMEI status and case wording with sensitive account details removed. We will confirm current service availability before you order.', href: '/contact', label: 'Ask about a Verizon iPhone' },
    ],
    faq: [
      { question: 'Does Verizon still unlock iPhones automatically?', answer: 'Verizon’s current policy describes automatic unlocking after the applicable trigger. The trigger differs for postpaid, prepaid and business devices, so confirm the category and the device-specific record.' },
      { question: 'How long does a Verizon prepaid iPhone stay locked?', answer: 'Verizon’s policy updated February 18, 2026 states that devices purchased from it for prepaid service remain locked until 365 days of paid and active service are completed, subject to theft and fraud exceptions.' },
      { question: 'Can Apple unlock a Verizon iPhone?', answer: 'No. Apple says only the carrier can authorize a carrier unlock. Apple’s guidance helps you check status and complete activation after the carrier confirms it.' },
      { question: 'Why does a paid-off Verizon iPhone still show a carrier lock?', answer: 'Check that the payoff posted to the correct IMEI, whether the payment method creates a verification delay, and whether a lost/stolen exception exists. Contact Verizon with the receipt and device details.' },
      { question: 'Will unlocking guarantee the iPhone works on another carrier?', answer: 'No. The new carrier must also support the exact model, cellular bands, SIM or eSIM method and plan features.' },
    ],
  },
  {
    slug: 'how-to-unlock-esim-on-iphone',
    title: 'How to Unlock eSIM on iPhone',
    heading: 'How to Unlock eSIM on iPhone: Carrier Lock, SIM PIN or Setup?',
    description: 'Learn how to unlock eSIM on iPhone by separating carrier lock, SIM PIN and activation errors, then follow the correct carrier-supported fix.',
    standfirst: '“Locked eSIM” can mean three different problems. Match the message to the lock before changing settings, resetting the phone or paying for help.',
    published: '2026-09-17',
    updated: '2026-09-17',
    minutes: 7,
    topic: 'iPhone eSIM troubleshooting',
    blocks: [
      {
        kind: 'p',
        text: 'To understand how to unlock eSIM on iPhone, first identify what is actually locked. A carrier lock restricts the iPhone from using another provider. A SIM PIN locks a particular physical SIM or eSIM line. An activation error means the provider’s plan has not been installed or provisioned correctly. Those problems can look similar, but they have different owners and fixes.',
      },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'Check Carrier Lock in Settings before buying or installing another eSIM.',
        'Only the carrier responsible for the device restriction can authorize an iPhone carrier unlock.',
        'If the status bar says Locked SIM or the phone asks for a SIM PIN or PUK, contact the carrier that issued that eSIM and do not guess codes.',
        'If the eSIM will not install or activate, collect the exact error, IMEI, EID and carrier account details for the eSIM provider.',
        'A QR code, travel eSIM or factory reset does not by itself remove a carrier lock.',
      ] },
      { kind: 'h2', id: 'identify-lock', text: 'Which “eSIM lock” do you have?' },
      { kind: 'table', head: ['What you see', 'Likely issue', 'Who can resolve it'], rows: [
        ['Carrier Lock does not say No SIM restrictions', 'The iPhone is restricted to a carrier.', 'The carrier responsible for the device lock.'],
        ['Locked SIM, SIM PIN or PUK prompt', 'The eSIM line is protected by its PIN.', 'The carrier that issued that eSIM.'],
        ['Add eSIM is available, but setup fails', 'Activation, provisioning, plan or compatibility issue.', 'The eSIM provider, with Apple troubleshooting where relevant.'],
        ['Activation Lock asks for an Apple Account', 'Ownership protection, not cellular locking.', 'The legitimate owner through Apple’s process.'],
        ['The iPhone asks for its screen passcode', 'Device access, not eSIM access.', 'The owner using Apple’s passcode recovery process.'],
      ] },
      { kind: 'h3', id: 'carrier-lock', text: '1. Carrier Lock: the iPhone cannot use another provider' },
      {
        kind: 'p',
        text: 'Open Settings > General > About and locate Carrier Lock. Apple says “No SIM restrictions” means the iPhone is unlocked. If another restriction appears, contact the carrier that controls it. Apple cannot issue the unlock, and purchasing a different eSIM does not change the device record.',
        links: [
          { label: 'Use Apple’s official carrier-unlock steps', href: 'https://support.apple.com/en-us/109316' },
          { label: 'Check whether your iPhone is unlocked', href: '/articles/how-to-check-if-iphone-is-unlocked' },
        ],
      },
      { kind: 'list', ordered: true, items: [
        'Identify the original carrier and the IMEI associated with its device record.',
        'Check that carrier’s current eligibility requirements for this device and account type.',
        'Resolve any financing, service-history, account or lost/stolen issue with the responsible party.',
        'Wait for the carrier’s device-specific confirmation, then recheck Carrier Lock.',
        'Install the new eSIM using the new provider’s supported method and test the service you purchased.',
      ] },
      {
        kind: 'p',
        text: 'Do not assume an eSIM-only iPhone needs a different kind of carrier unlock from an iPhone with a physical SIM tray. The authorization is about the device’s carrier restriction. The eSIM provider still has a separate job: assigning and activating its cellular plan.',
      },
      { kind: 'h3', id: 'sim-pin', text: '2. SIM PIN or PUK: the eSIM line itself is protected' },
      {
        kind: 'p',
        text: 'Apple explains that a SIM PIN can protect a physical SIM or eSIM. After a restart, the status bar can show “Locked SIM” until the correct PIN is entered. Do not guess a default PIN or PUK: repeated wrong attempts can permanently lock the eSIM, requiring the carrier to issue a replacement.',
        links: [{ label: 'Follow Apple’s SIM PIN and PUK guidance', href: 'https://support.apple.com/en-us/118228' }],
      },
      { kind: 'list', ordered: true, items: [
        'In Settings > Cellular, identify the carrier shown for the affected line.',
        'Contact that carrier through a verified support channel.',
        'Ask for help with the default SIM PIN or the PUK tied to that line.',
        'If the carrier says the PUK is exhausted, ask for a replacement eSIM rather than trying more codes.',
      ] },
      {
        kind: 'note',
        text: 'A SIM PIN is not the iPhone passcode, the carrier-account PIN or the Apple Account password. Never enter one of those private credentials just because a page calls every code an “unlock PIN.”',
      },
      { kind: 'h3', id: 'activation', text: '3. eSIM setup or activation: the plan is not ready' },
      {
        kind: 'p',
        text: 'Apple says eSIM generally requires a supported iPhone, a provider that supports eSIM and a connection needed for setup. Supported methods can include carrier activation, transfer from another device, a QR code, a carrier link or app, and manual details. The provider chooses which methods it supports; a code from an unrelated seller will not provision the line.',
        links: [{ label: 'Review Apple’s eSIM setup methods and requirements', href: 'https://support.apple.com/en-us/118669' }],
      },
      {
        kind: 'p',
        text: 'Model and region matter. Ask the intended provider to check the exact iPhone model and purchase region, especially for imported phones or markets with different physical-SIM and eSIM configurations. “This iPhone generation supports eSIM” is not a complete compatibility answer.',
      },
      { kind: 'h2', id: 'activation-checklist', text: 'eSIM activation checklist before another unlock request' },
      { kind: 'list', ordered: true, items: [
        'Confirm the cellular plan is active and assigned to this iPhone by the eSIM provider.',
        'Connect using the setup method and network connection the provider specifies.',
        'Update the iPhone to the latest iOS version it supports.',
        'Toggle Airplane Mode, check whether the line appears under Cellular, and restart the iPhone.',
        'Open Settings > General > About and accept any carrier-settings update that appears.',
        'If setup still fails, save the exact message and contact the eSIM provider with the phone number, account details, IMEI and EID.',
      ] },
      {
        kind: 'p',
        text: 'Apple’s current troubleshooting guide lists those checks and recommends gathering the exact alert plus the IMEI and EID before contacting the carrier. That evidence lets the provider investigate assignment and provisioning instead of repeating generic reset instructions.',
        links: [{ label: 'Use Apple’s eSIM setup troubleshooting', href: 'https://support.apple.com/en-us/102478' }],
      },
      { kind: 'h2', id: 'common-scenarios', text: 'Choose the next step for the common eSIM scenarios' },
      { kind: 'table', head: ['Scenario', 'Do this first', 'Avoid'], rows: [
        ['Travel eSIM will not install', 'Check Carrier Lock, model compatibility and the travel provider’s activation conditions.', 'Buying the same plan again before support checks the first assignment.'],
        ['Transferred number is missing', 'Ask the carrier whether the old line was deactivated and the new eSIM was assigned.', 'Deleting every cellular plan without carrier instructions.'],
        ['QR code says it is invalid or used', 'Return to the provider that issued the code and ask about reissue.', 'Sharing the QR code publicly or scanning codes from unrelated sites.'],
        ['No SIM restrictions, but no service', 'Check activation, account status, coverage and carrier settings with the new provider.', 'Paying for another carrier unlock.'],
        ['SIM Not Supported during setup', 'Confirm Carrier Lock and the original carrier’s authorization.', 'Assuming an eSIM profile can bypass the device restriction.'],
      ] },
      {
        kind: 'p',
        text: 'If the exact alert is SIM Not Supported, use the carrier-authorization workflow. If the line installs but cannot connect, use the new provider’s network and account checks. Keeping these paths separate prevents an activation problem from becoming a duplicate unlock purchase.',
        links: [{ label: 'Troubleshoot iPhone SIM Not Supported', href: '/articles/iphone-sim-not-supported-after-switching-carriers' }],
      },
      { kind: 'h2', id: 'free-esim-unlock', text: 'Can you unlock an eSIM on iPhone for free?' },
      {
        kind: 'p',
        text: 'There is no universal eSIM unlock button or free code that overrides a carrier decision. If the iPhone meets the original carrier’s policy, use that carrier’s official process first. If the issue is a forgotten SIM PIN, only the line’s carrier can provide the correct recovery route. If the issue is activation, the eSIM provider must fix or replace the plan assignment.',
      },
      {
        kind: 'p',
        text: 'A legitimate third-party iPhone unlock service should define whether it is selling a status report, submitting a supported request or providing another specific deliverable. It should not promise to bypass Activation Lock, a screen passcode, a PUK, financing or a lost/stolen record. Confirm availability and refund terms before providing an IMEI or paying.',
        links: [
          { label: 'Understand network-unlock services before paying', href: '/articles/network-unlock-explained' },
          { label: 'Review carrier-unlock eligibility questions', href: '/articles/iphone-carrier-unlock-eligibility' },
        ],
      },
      { kind: 'h2', id: 'before-travel', text: 'If the eSIM is for travel, finish the test before departure' },
      {
        kind: 'p',
        text: 'Confirm when the plan starts, where it can activate, which countries it covers and whether it includes only data or also calls and messages. Save setup instructions and support contacts offline. Keep an arrival-day fallback because a carrier unlock, device compatibility and plan activation are separate checkpoints.',
        links: [{ label: 'Use the international iPhone pre-travel checklist', href: '/articles/unlock-iphone-for-international-use-travel-checklist' }],
      },
      { kind: 'cta', text: 'Not sure whether your message is a carrier lock, SIM PIN or eSIM activation problem? Send the exact wording, iPhone model, original carrier and eSIM provider with private account details removed. We will confirm which service or support route fits.', href: '/contact', label: 'Ask about your eSIM issue' },
    ],
    faq: [
      { question: 'Does adding an eSIM unlock an iPhone?', answer: 'No. Adding a plan and removing a device carrier restriction are separate actions. Check Carrier Lock first; only the responsible carrier can authorize the device unlock.' },
      { question: 'What does Locked SIM mean on an iPhone with eSIM?', answer: 'It normally refers to SIM PIN protection on that cellular line. Contact the eSIM carrier for the correct PIN or PUK and do not guess codes.' },
      { question: 'Why can I not add an eSIM after my iPhone was unlocked?', answer: 'The provider may not have assigned the plan, the model or region may be unsupported, or setup may need a carrier update or network connection. Collect the error, IMEI and EID for the eSIM provider.' },
      { question: 'Will a factory reset unlock the eSIM?', answer: 'No. A reset does not override carrier eligibility or recover a SIM PIN. Apple only recommends erase-and-restore in specific post-approval carrier-unlock situations, after a backup.' },
      { question: 'Can iUnlockMobile remove Activation Lock or a PUK?', answer: 'No. Activation Lock belongs with the legitimate owner’s Apple Account process. A PUK belongs with the carrier that issued the SIM or eSIM.' },
    ],
  },
  {
    slug: 'unlock-iphone-for-international-use-travel-checklist',
    title: 'Unlock iPhone for International Use',
    heading: 'Unlock iPhone for International Use: A Pre-Travel Checklist',
    description: 'Unlock iPhone for international use with a practical checklist for carrier approval, travel SIM or eSIM compatibility, and a backup plan.',
    standfirst: 'Decide how you will connect abroad before buying a plan. Roaming, a local SIM and a travel eSIM have different requirements.',
    published: '2026-09-16',
    updated: '2026-09-16',
    minutes: 6,
    topic: 'International iPhone use',
    blocks: [
      {
        kind: 'p',
        text: 'To unlock iPhone for international use, first decide whether you will use your existing carrier abroad or buy service from another provider. That choice determines whether a carrier unlock is needed. Then confirm eligibility, device compatibility and activation instructions before committing to a travel plan. Treat these as separate decisions: a flight booking does not establish that the phone is ready.',
      },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'Identify your connection plan first: home-carrier roaming or service from a different provider.',
        'Get a device-specific unlock decision before relying on a local SIM or travel eSIM.',
        'Check your exact model and purchase region, not just the iPhone generation.',
        'Read when a travel plan starts, which countries it covers and whether calls or SMS are included.',
        'Keep a usable arrival-day alternative if approval or activation is still unresolved.',
      ] },
      { kind: 'h2', id: 'roaming-or-new-provider', text: 'Do you need an unlock for roaming or only for another provider?' },
      {
        kind: 'p',
        text: 'T-Mobile distinguishes device unlocking from international roaming: roaming uses its own SIM or eSIM to access a partner network. Apple says an iPhone must be unlocked to use another carrier while abroad. Ask your home carrier whether roaming is available on your actual plan and destination; do not assume a locked phone is unusable overseas.',
        links: [
          { label: 'T-Mobile’s explanation of unlocking versus roaming', href: 'https://www.t-mobile.com/support/devices/unlock-your-mobile-wireless-device' },
          { label: 'Apple’s international eSIM options', href: 'https://support.apple.com/en-us/118227' },
        ],
      },
      { kind: 'table', head: ['Connection choice', 'First question to resolve', 'What to compare'], rows: [
        ['Roam with your existing carrier', 'Does my plan support this destination?', 'Included allowances, travel passes and charges for my planned usage.'],
        ['Buy a local physical SIM', 'Is this iPhone unlocked and does it have a compatible SIM tray?', 'Local coverage, identity requirements and available voice/data plans.'],
        ['Buy a travel or local eSIM', 'Does the exact device and intended plan support eSIM?', 'Country coverage, activation timing, data allowance and calling features.'],
      ] },
      { kind: 'h2', id: 'approval-before-purchase', text: 'Step 1: Settle the carrier-unlock question before buying a plan' },
      {
        kind: 'p',
        text: 'In Settings > General > About, Apple identifies “No SIM restrictions” as unlocked status. If a restriction remains, only the carrier can authorize its removal. Begin with that carrier’s current eligibility process.',
        links: [{ label: 'Apple’s official iPhone unlock instructions', href: 'https://support.apple.com/en-us/109316' }],
      },
      { kind: 'list', ordered: true, items: [
        'Identify the carrier responsible for the device restriction using purchase records and its support team.',
        'Ask which requirement applies to this device and whether anything remains unmet.',
        'Keep the case reference and the carrier’s completion instructions together.',
        'Compare the expected resolution with your departure date and prepare an alternative if they do not align.',
      ] },
      {
        kind: 'p',
        text: 'Use the specific eligibility guide when the obstacle is purchase history, service history or account status. This travel checklist starts where that decision becomes a practical trip-planning constraint. Do not assume an advertised turnaround is a commitment for your own case.',
        links: [{ label: 'Check iPhone carrier-unlock eligibility', href: '/articles/iphone-carrier-unlock-eligibility' }],
      },
      { kind: 'h3', id: 'requesting-from-abroad', text: 'Already outside the original carrier’s country?' },
      {
        kind: 'p',
        text: 'Use its verified online support route if a domestic telephone number is unavailable. Prepare the purchase record, model and case reference before starting the conversation. For a used phone, ask the seller for the missing history; do not send a stranger an account password to speed up a request. Ask what documents are required rather than guessing what the carrier can access.',
      },
      { kind: 'h2', id: 'exact-model', text: 'Step 2: Check the exact iPhone model against the destination plan' },
      {
        kind: 'p',
        text: 'Apple’s travel guidance highlights regional differences in eSIM support and recommends checking cellular-band compatibility. An unlocked eSIM-only model still needs an eSIM-capable provider. Give the destination provider the exact model and purchase region before paying.',
        links: [{ label: 'Review Apple’s regional compatibility guidance', href: 'https://support.apple.com/en-us/118227' }],
      },
      { kind: 'list', items: [
        'Ask whether the provider accepts your exact iPhone model for the chosen plan.',
        'Confirm whether you will use a physical SIM, an eSIM or both.',
        'Check every destination on a multi-country itinerary, including an overnight stop.',
        'Ask which identification and device-registration steps must be completed locally.',
      ] },
      {
        kind: 'note',
        text: 'Write your requirements before comparing prices: countries, arrival date, length of stay, expected data, hotspot needs and whether you need a local phone number. This makes it easier to reject an unsuitable plan even when its headline price looks attractive.',
      },
      { kind: 'h2', id: 'plan-activation', text: 'Step 3: Separate buying a plan from activating it' },
      {
        kind: 'p',
        text: 'Before purchasing, find the provider’s answers to three questions: when does validity begin, where can activation be completed, and what happens if installation fails? Save those instructions offline. Do not treat an emailed QR code or a payment receipt as evidence that the line is working.',
      },
      { kind: 'table', head: ['Check', 'Question for the provider'], rows: [
        ['Plan start', 'Does validity start at purchase, installation, first connection or a specified date?'],
        ['Connection setup', 'Do I need Wi-Fi and must I be at the destination to finish activation?'],
        ['Calling and messages', 'Is this data-only, or does it include a usable number, calls and SMS?'],
        ['Troubleshooting', 'Which support route works if mobile data is unavailable?'],
        ['Purchase terms', 'What are the cancellation or refund terms if this device cannot activate the plan?'],
      ] },
      { kind: 'h3', id: 'home-number', text: 'Decide what happens to your home number' },
      {
        kind: 'p',
        text: 'Apple allows supported configurations to use a travel line alongside the home line, but warns that the home line can still incur roaming charges. Review the selected cellular-data line and ask your home carrier about charges for the features you intend to keep.',
        links: [{ label: 'Apple’s guidance on using travel and home lines', href: 'https://support.apple.com/en-us/118227' }],
      },
      {
        kind: 'p',
        text: 'Make an access plan for banking, bookings and account recovery before departure. If you depend on text-message codes, confirm with the relevant services and carrier how you will receive them. Keep approved recovery alternatives available. Choosing a data plan alone does not answer that question.',
      },
      { kind: 'h2', id: 'arrival-and-backup', text: 'Step 4: Prepare an arrival-day check and a fallback' },
      { kind: 'list', ordered: true, items: [
        'Save the carrier case number, plan instructions and support contact where you can read them offline.',
        'Follow the provider’s specified installation and activation timing.',
        'After arrival, test the functions you purchased: data, and calls or SMS if included.',
        'If activation fails, record the exact message and contact the responsible provider with that evidence.',
        'Use your prepared alternative while the case is investigated instead of placing repeated unlock orders.',
      ] },
      {
        kind: 'p',
        text: 'A practical alternative might be an approved roaming option on the existing line, a compatible spare unlocked phone or access to a trusted Wi-Fi connection. Confirm availability before relying on it. Budget for the alternative as part of the trip, especially when your phone is needed for transport or accommodation access.',
      },
      { kind: 'h2', id: 'avoid-wrong-service', text: 'Choose an unlock service only when it solves the remaining problem' },
      {
        kind: 'p',
        text: 'A third party may review a device or arrange a supported request; ask for its exact deliverable and current availability. A report, a submitted request and a completed unlock are different purchases. An intermediary cannot guarantee that an unresolved carrier decision will be reversed by your departure date.',
        links: [{ label: 'Understand network-unlock services', href: '/articles/network-unlock-explained' }],
      },
      {
        kind: 'p',
        text: 'Keep other restrictions separate. A SIM PIN or PUK belongs with the SIM provider; a forgotten screen passcode needs device recovery; Activation Lock concerns the legitimate owner’s Apple Account. Lost/stolen records and finance obligations require resolution with the responsible party. Travel does not turn any of these into a carrier-unlock job.',
        links: [
          { label: 'Apple’s SIM PIN help', href: 'https://support.apple.com/en-us/118228' },
          { label: 'Apple’s explanation of Activation Lock', href: 'https://support.apple.com/en-us/108794' },
        ],
      },
      { kind: 'cta', text: 'Have a carrier response and an upcoming trip? Tell us the model, original carrier and the response with sensitive details removed. Ask which service, if any, is currently appropriate before ordering.', href: '/contact', label: 'Ask about your travel unlock options' },
    ],
    faq: [
      { question: 'Do I need to unlock my iPhone just to travel abroad?', answer: 'Your connection choice matters. Ask the home carrier about roaming on its existing line. Using a different provider requires a separate compatibility and carrier-lock check.' },
      { question: 'Will buying a travel eSIM remove a carrier lock?', answer: 'No. Buying a plan does not establish unlock eligibility. Resolve the device restriction before relying on the new plan.' },
      { question: 'How early should I request an international iPhone unlock?', answer: 'Start while there is still time to obtain a device-specific decision and arrange an alternative. Use the carrier’s timeframe for your case; there is no single deadline that guarantees every request will complete before a flight.' },
      { question: 'Can iUnlockMobile guarantee my iPhone will work in every country?', answer: 'No. Device compatibility, provider coverage, plan terms and activation must all be checked. Contact us to establish whether a relevant service is available for the device.' },
    ],
  },
  {
    slug: 'iphone-sim-not-supported-after-switching-carriers',
    title: 'iPhone SIM Not Supported: Next Steps',
    heading: 'iPhone SIM Not Supported: What to Do After Switching Carriers',
    description: 'Resolve an iPhone SIM Not Supported message: check carrier authorization, SIM detection and activation before buying another unlock.',
    standfirst: 'Use the exact alert and the result of your last unlock request to decide whether the original carrier, new provider or Apple should investigate.',
    published: '2026-09-16',
    updated: '2026-09-16',
    minutes: 6,
    topic: 'iPhone activation troubleshooting',
    blocks: [
      { kind: 'p', text: 'An iPhone SIM Not Supported message after switching carriers calls for a targeted check before another payment or reset. Record the exact alert, whether setup can finish, and whether the old line still works. Those details help separate a carrier restriction from a SIM-detection or activation problem and make the next support conversation useful.' },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'Copy the exact alert: SIM Not Supported, No SIM and SOS describe different situations.',
        'Match the phone’s identifier to the device in the unlock confirmation.',
        'Return unresolved carrier authorization to the original carrier; ask the new provider about its line and SIM.',
        'Keep a short record of each test and result so the case does not restart with every representative.',
        'Stop repeated unlock purchases when the remaining problem needs activation support or hardware diagnosis.',
      ] },
      { kind: 'h2', id: 'identify-alert', text: 'Start with the message, not a generic list of fixes' },
      { kind: 'table', head: ['Message or symptom', 'Investigation to start'], rows: [
        ['SIM Not Supported during setup', 'Check the device restriction and original carrier’s authorization.'],
        ['Invalid SIM or No SIM', 'Check the active plan, SIM detection and carrier settings.'],
        ['Cannot set up an eSIM', 'Ask the new provider about the eSIM assignment and activation.'],
        ['SOS, Searching or No Service', 'Check network access, account status, coverage and any device bar.'],
        ['PIN or PUK prompt', 'Use the issuing SIM provider’s recovery process.'],
      ] },
      {
        kind: 'p',
        text: 'Apple provides separate instructions for unsupported-carrier activation, missing or invalid SIM alerts, and loss of network service. Choose the matching route. For example, a phone that completes setup but cannot register on a network needs different evidence from one stopped at the activation screen.',
        links: [
          { label: 'Apple’s carrier-unlock help', href: 'https://support.apple.com/en-us/109316' },
          { label: 'Apple’s Invalid SIM and No SIM checks', href: 'https://support.apple.com/en-us/108914' },
          { label: 'Apple’s SOS and No Service checks', href: 'https://support.apple.com/en-us/120000' },
        ],
      },
      { kind: 'h2', id: 'check-authorization', text: 'If the alert points to a carrier restriction, check authorization' },
      {
        kind: 'p',
        text: 'If Settings is accessible, inspect Carrier Lock under General > About. Apple says “No SIM restrictions” indicates unlocked status. A remaining restriction should be raised with the carrier; Apple cannot issue the unlock.',
        links: [{ label: 'Follow Apple’s unsupported-SIM guidance', href: 'https://support.apple.com/en-us/109316' }],
      },
      {
        kind: 'p',
        text: 'If setup prevents access to Settings, do not mark the status as unlocked simply because a seller said so. Explain to support that the field cannot be inspected, provide the activation message, and ask the original carrier to check the device record. Use a verified private channel for identifiers.',
      },
      { kind: 'h3', id: 'after-approval', text: 'Already received an unlock confirmation?' },
      { kind: 'list', ordered: true, items: [
        'Compare the IMEI on the confirmation with the actual phone, especially after a replacement or exchange.',
        'Identify whether the notice says submitted, accepted, eligible or completed.',
        'Return to the existing case with the exact error and time of your activation attempt.',
        'Ask the carrier to confirm its authorization for that device and provide the remaining completion steps.',
      ] },
      {
        kind: 'note',
        text: 'Useful support wording: “My request reference is [reference]. The device now shows [exact message] when I try [action]. Please confirm whether this device’s unlock is complete and what you need from me to investigate the mismatch.”',
      },
      {
        kind: 'p',
        text: 'Do not erase the device as your first diagnostic experiment. Apple’s backup-and-restore instructions apply to particular post-approval situations. If support recommends a restore, clarify which situation applies and protect the data before proceeding.',
        links: [{ label: 'Read Apple’s completion scenarios', href: 'https://support.apple.com/en-us/109316' }],
      },
      { kind: 'h2', id: 'physical-sim', text: 'For Invalid SIM or No SIM, test the physical SIM route' },
      {
        kind: 'p',
        text: 'Apple recommends confirming an active plan, restarting the phone and checking for carrier-settings updates. For a physical SIM, reseat it and ensure the correct tray closes properly. If needed, have the carrier test another SIM. A persistent detection alert can require device service.',
        links: [{ label: 'Use Apple’s physical-SIM troubleshooting sequence', href: 'https://support.apple.com/en-us/108914' }],
      },
      {
        kind: 'p',
        text: 'Ask the representative to note which SIM and device were tested and what happened. “Another SIM worked” is much more useful than “we tried everything.” Do not force a tray that does not fit or assume that a replacement SIM also resolves a separate carrier restriction.',
      },
      { kind: 'h2', id: 'esim-activation', text: 'For an eSIM, ask the new provider to verify the assignment' },
      {
        kind: 'p',
        text: 'Apple’s eSIM troubleshooting starts with a supported active plan, suitable connectivity and current compatible iOS. It then checks Airplane Mode, whether the intended line appears in Cellular settings, a line toggle, restart and carrier settings. Contact the provider if activation remains unresolved.',
        links: [{ label: 'Apple’s eSIM activation troubleshooting', href: 'https://support.apple.com/en-us/102478' }],
      },
      { kind: 'list', items: [
        'State whether the line is absent, present but disabled, or present with an activation error.',
        'Give the provider the requested IMEI or EID privately, rather than assuming which identifier it needs.',
        'Ask whether the plan and device assignment are correct and whether a replacement activation method is required.',
        'Before deleting a profile, ask how it will be restored or reissued so you retain a clear recovery path.',
      ] },
      { kind: 'h2', id: 'unlocked-no-service', text: 'Unlocked but still no service? Change the investigation' },
      {
        kind: 'p',
        text: 'For SOS or No Service, Apple directs users to check active account status, local coverage or outages, correct plan setup and whether the device is barred. It also notes that imported devices may need local IMEI registration. The carrier can investigate those network and account records.',
        links: [{ label: 'Check Apple’s network-access guidance', href: 'https://support.apple.com/en-us/120000' }],
      },
      {
        kind: 'p',
        text: 'Keep the original unlock confirmation with the new-provider case. Ask each party to state which part it has verified. If the carrier confirms the account and network are working but suspects hardware, follow its referral to device service instead of repeating the same remote-unlock purchase.',
      },
      { kind: 'h2', id: 'support-evidence', text: 'Prepare an evidence packet that moves the case forward' },
      { kind: 'table', head: ['Detail', 'Why it helps'], rows: [
        ['Exact message and where it appears', 'Separates activation, SIM detection and network registration.'],
        ['Model, iOS version and physical SIM or eSIM', 'Identifies the relevant device and setup route.'],
        ['Old-line and new-line test results', 'Shows which change triggered the problem.'],
        ['Unlock reference and wording of the response', 'Distinguishes a submitted request from reported completion.'],
        ['Tests already performed', 'Reduces repeated steps and preserves their results.'],
      ] },
      {
        kind: 'p',
        text: 'Share screenshots with personal information removed in public discussions. Keep full device identifiers for the verified provider that requests them. A dated IMEI report may add context, but it does not prove that a new plan activated or repair a malfunctioning SIM reader.',
        links: [{ label: 'Understand the limits of an IMEI report', href: '/articles/what-an-imei-check-tells-you' }],
      },
      { kind: 'h2', id: 'wrong-lock', text: 'Do not confuse this alert with another lock or account issue' },
      {
        kind: 'p',
        text: 'A SIM PIN or PUK protects the SIM or eSIM: do not guess it. A screen passcode controls device access, while Activation Lock ties setup to an Apple Account. Lost/stolen records and finance obligations are separate again. Resolve each through its responsible provider or legitimate owner; carrier unlocking does not clear them.',
        links: [
          { label: 'Apple’s SIM PIN and PUK instructions', href: 'https://support.apple.com/en-us/118228' },
          { label: 'Apple’s Activation Lock guidance', href: 'https://support.apple.com/en-us/108794' },
        ],
      },
      {
        kind: 'p',
        text: 'A third-party service may supply a status report or arrange an available carrier request. Ask which deliverable applies to the evidence you have and confirm current terms before paying. If the device needs provisioning or hardware support, buying an unlock does not complete that work.',
        links: [{ label: 'Compare the evidence used to check iPhone unlock status', href: '/articles/how-to-check-if-iphone-is-unlocked' }],
      },
      { kind: 'cta', text: 'Unsure which result you are looking at? Send the exact alert, model and a redacted carrier response. We can clarify whether a relevant service is currently available before you place an order.', href: '/contact', label: 'Ask about your SIM error' },
    ],
    faq: [
      { question: 'Should I buy another unlock if the first provider says completed?', answer: 'First compare the device identifier and ask the existing provider to investigate the reported completion. Preserve the case reference and error instead of starting another paid order without a diagnosis.' },
      { question: 'Is SIM Not Supported the same as No SIM?', answer: 'Use the exact wording when requesting help. The first calls for checking carrier authorization during activation; No SIM also requires a SIM-detection investigation.' },
      { question: 'Can switching to eSIM fix an unresolved carrier restriction?', answer: 'Changing the SIM format does not settle the carrier’s restriction. Ask the responsible carrier about authorization and the new provider about plan activation.' },
      { question: 'What should I do if I cannot reach Settings during setup?', answer: 'Tell support that the status cannot be inspected on the phone. Provide the exact setup alert and the available device and request details through its verified private channel.' },
    ],
  },
  {
    slug: 'how-to-check-if-iphone-is-unlocked',
    title: 'How to Check If Your iPhone Is Unlocked',
    heading: 'How to Check If Your iPhone Is Unlocked: Four Reliable Methods',
    description: 'Learn how to check if your iPhone is unlocked in Settings, what an IMEI report can confirm, and why a new SIM may still fail.',
    standfirst: 'Start with the status stored on the iPhone, then use carrier records, another network or a sourced IMEI report only when you need more evidence.',
    published: '2026-09-15',
    updated: '2026-09-15',
    minutes: 7,
    topic: 'iPhone unlock status',
    blocks: [
      {
        kind: 'p',
        text: 'The quickest way to check if your iPhone is unlocked is Settings > General > About. Find Carrier Lock: Apple says “No SIM restrictions” means the iPhone is unlocked. That is the best first check when the phone is in your hand, but a carrier confirmation, a different network test or an IMEI report can answer questions that the Settings line alone cannot.',
        links: [{ label: 'Apple’s current carrier-unlock instructions', href: 'https://support.apple.com/en-us/109316' }],
      },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      {
        kind: 'list',
        items: [
          'On iOS 14 or later, “No SIM restrictions” beside Carrier Lock is Apple’s direct unlocked-status indicator.',
          'A failed SIM or eSIM activation is not conclusive: compatibility, provisioning, coverage or a barred IMEI can also stop service.',
          'An IMEI report is useful when you cannot inspect the iPhone, but its scope, source and report time matter.',
          'Only the carrier can authorize an iPhone carrier unlock; Apple and a status-check provider cannot override that decision.',
          'Carrier Lock is separate from a SIM PIN, device passcode, Activation Lock, blacklist record and finance agreement.',
        ],
      },
      { kind: 'h2', id: 'four-methods', text: 'Four ways to check whether an iPhone is unlocked' },
      {
        kind: 'table',
        head: ['Method', 'Best use', 'What the result proves'],
        rows: [
          ['Carrier Lock in Settings', 'The iPhone is available and set up', 'Shows the carrier-lock status reported on the device.'],
          ['Original carrier confirmation', 'The status is unclear or an unlock is pending', 'Confirms the carrier’s record and whether it authorized the unlock.'],
          ['Another carrier’s SIM or eSIM', 'You can safely test a compatible active plan', 'A successful activation confirms practical use on that network; a failure needs diagnosis.'],
          ['IMEI unlock-status report', 'Remote, boxed or used-phone checks', 'Reports the fields supplied by the named data source at the report time.'],
        ],
      },
      { kind: 'h2', id: 'check-settings', text: 'Method 1: Check Carrier Lock in iPhone Settings' },
      {
        kind: 'list',
        ordered: true,
        items: [
          'Open Settings.',
          'Tap General, then About.',
          'Scroll to Carrier Lock. In some regions, the label may be translated or shown as Network Provider Lock.',
          'Read the status beside it. “No SIM restrictions” means the iPhone is carrier unlocked.',
        ],
      },
      {
        kind: 'p',
        text: 'Take a screenshot if you are documenting a purchase or following up on an unlock, but crop out the phone number, serial number, IMEI and other identifiers before sharing it publicly. If Carrier Lock is missing, the wording is unclear or the result conflicts with a recent carrier message, use the carrier-confirmation method next.',
      },
      {
        kind: 'note',
        text: 'Do not erase the iPhone just to perform the first check. Apple lists backup, erase and restore as a completion route after carrier confirmation when no other SIM is available, not as the opening eligibility test.',
      },
      { kind: 'h3', id: 'no-sim-restrictions', text: 'What “No SIM restrictions” does and does not mean' },
      {
        kind: 'p',
        text: 'It means the iPhone is not restricted to one carrier. It does not guarantee that every network or plan will accept the model, that the IMEI is clear, or that a new line has been activated correctly. An unlocked phone can still show SOS, No Service or an eSIM activation error for reasons unrelated to a carrier lock.',
      },
      { kind: 'h2', id: 'ask-carrier', text: 'Method 2: Ask the original carrier to confirm its record' },
      {
        kind: 'p',
        text: 'Apple states that only the current carrier can unlock an iPhone. Contact the carrier that sold or currently restricts the device, give it the identifier requested through an authenticated channel, and ask whether the unlock has been authorized and completed. Keep the case reference and the exact response.',
        links: [{ label: 'See Apple’s explanation of carrier responsibility', href: 'https://support.apple.com/en-us/109316' }],
      },
      {
        kind: 'list',
        items: [
          'Ask whether the representative is checking the same IMEI shown on the iPhone.',
          'If the request is pending, ask for its status and the next review point supplied for that case.',
          'If it was denied, ask which eligibility condition was not met and what record can resolve it.',
          'If the carrier says the unlock is complete but Settings still shows a restriction, return to that case before paying another provider.',
        ],
      },
      {
        kind: 'p',
        text: 'Carrier confirmation is especially important after a recent unlock request, a device replacement or a used-phone sale. The status on a receipt, marketplace listing or seller message is not a substitute for the handset status and carrier record.',
        links: [{ label: 'Review iPhone carrier-unlock eligibility before paying', href: '/articles/iphone-carrier-unlock-eligibility' }],
      },
      { kind: 'h2', id: 'test-another-network', text: 'Method 3: Test a compatible SIM or eSIM from another carrier' },
      {
        kind: 'p',
        text: 'After the original carrier confirms the unlock, Apple says you can insert a SIM from another carrier so the device activates, or follow the new carrier’s eSIM setup process. Use a plan that is active and known to support your exact iPhone model. A successful activation and connection provide useful real-world confirmation.',
        links: [
          { label: 'Follow Apple’s post-unlock activation steps', href: 'https://support.apple.com/en-us/109316' },
          { label: 'Check Apple’s eSIM setup requirements', href: 'https://support.apple.com/en-us/118669' },
        ],
      },
      { kind: 'h3', id: 'failed-test', text: 'Why a failed SIM or eSIM test is not proof of a lock' },
      {
        kind: 'table',
        head: ['What you see', 'Check before ordering an unlock'],
        rows: [
          ['SIM not supported during activation', 'Recheck Carrier Lock and ask the original carrier whether its authorization completed.'],
          ['Unable to add or activate eSIM', 'Confirm model, region and provider eSIM support, then ask the new carrier to verify provisioning.'],
          ['SOS or No Service', 'Check line activation, coverage, outages, carrier settings, compatibility and any device bar.'],
          ['SIM PIN, Locked SIM or PUK prompt', 'Contact the provider that issued that SIM or eSIM; do not guess the code.'],
        ],
      },
      {
        kind: 'p',
        text: 'A new carrier can confirm whether its plan supports the model and whether the line is provisioned. The original carrier remains responsible for its lock decision. Keeping those roles separate prevents a failed activation from turning into an unnecessary unlock purchase.',
      },
      { kind: 'h2', id: 'imei-report', text: 'Method 4: Check iPhone unlock status by IMEI' },
      {
        kind: 'p',
        text: 'An IMEI report is most useful when the iPhone is not available to inspect, such as a remote used-phone purchase, or when you need a dated record from a specific source. It can also help identify the device and original carrier. The report should state which fields are included, where its data comes from and when the lookup was performed.',
        links: [{ label: 'Learn what an IMEI check can and cannot tell you', href: '/articles/what-an-imei-check-tells-you' }],
      },
      {
        kind: 'list',
        items: [
          'Match the returned model to the phone or listing before relying on any status field.',
          'Read carrier lock, blacklist and Activation Lock fields separately; one clean result does not answer the others.',
          'Treat the result as a time-stamped lookup, not a guarantee that no later account or lost/stolen report can affect service.',
          'Do not post a full IMEI in public listings, forums or screenshots.',
        ],
      },
      {
        kind: 'p',
        text: 'An IMEI check does not unlock the iPhone. It reports information available from its data source. If the report and Settings disagree, confirm that both refer to the same IMEI, note the report time, and ask the responsible carrier to resolve the discrepancy.',
      },
      { kind: 'h2', id: 'different-locks', text: 'Make sure you are checking the right kind of lock' },
      {
        kind: 'table',
        head: ['Restriction or record', 'What it affects', 'Correct route'],
        rows: [
          ['Carrier Lock', 'Use with another cellular carrier', 'The carrier that controls the restriction.'],
          ['SIM PIN or PUK', 'Access to one physical SIM or eSIM', 'The provider that issued that line.'],
          ['Device passcode', 'Access to iOS on the phone', 'Apple’s supported passcode-recovery process.'],
          ['Activation Lock', 'Ownership-linked setup and reactivation', 'The legitimate owner’s Apple Account or Apple’s supported process.'],
          ['Blacklist or finance issue', 'Network access or an account obligation', 'The reporting carrier, seller or responsible account holder.'],
        ],
      },
      {
        kind: 'p',
        text: 'Apple warns not to guess a SIM PIN or PUK because repeated wrong entries can permanently block the SIM or eSIM. Activation Lock instead protects ownership through an Apple Account. Neither issue is removed by changing Carrier Lock.',
        links: [
          { label: 'Apple’s SIM PIN and PUK guidance', href: 'https://support.apple.com/en-us/118228' },
          { label: 'Apple’s Activation Lock explanation', href: 'https://support.apple.com/en-us/108794' },
        ],
      },
      { kind: 'h2', id: 'choose-next-step', text: 'Choose the next step from the evidence you have' },
      {
        kind: 'table',
        head: ['Your result', 'Sensible next action'],
        rows: [
          ['Settings says No SIM restrictions and another network works', 'No carrier unlock is needed. Keep the evidence if you are selling the phone.'],
          ['Settings says No SIM restrictions but service fails', 'Troubleshoot compatibility, activation, provisioning, coverage and device status with the new carrier.'],
          ['Settings shows a restriction', 'Identify the responsible carrier and check its current eligibility process.'],
          ['Carrier says unlocked but the iPhone still shows restricted', 'Reopen the carrier case with the on-device result.'],
          ['You cannot inspect the phone', 'Request a current, sourced IMEI report and verify the same IMEI in person before paying the seller.'],
        ],
      },
      {
        kind: 'cta',
        text: 'Need a documented status check for an iPhone you cannot inspect? Review the available report fields first, then choose only the check that answers your question.',
        href: '/services/imei-check',
        label: 'Compare iPhone IMEI checks',
      },
    ],
    faq: [
      {
        question: 'How can I check if my iPhone is unlocked without another SIM?',
        answer: 'Open Settings > General > About and read Carrier Lock. Apple says “No SIM restrictions” means the iPhone is unlocked. You can also ask the responsible carrier to confirm its record.',
      },
      {
        question: 'Can I check whether an iPhone is unlocked by IMEI?',
        answer: 'A sourced IMEI report can return an unlock-status field without the phone in hand. Check the report scope and date, match the device, and remember that the report supplies information rather than changing the lock.',
      },
      {
        question: 'Does “No SIM restrictions” mean any eSIM will work?',
        answer: 'No. It confirms carrier-unlocked status, but the iPhone model, region, new provider and plan must also support eSIM, and the line still needs successful provisioning and activation.',
      },
      {
        question: 'Why does my unlocked iPhone say SIM not supported?',
        answer: 'First recheck Carrier Lock and confirm the original carrier completed its authorization. If the iPhone still shows No SIM restrictions, ask the new carrier to check compatibility, activation and provisioning.',
      },
      {
        question: 'Is a SIM PIN the same as an iPhone carrier lock?',
        answer: 'No. A SIM PIN protects one SIM or eSIM and is handled by the provider that issued it. Carrier Lock restricts which cellular carriers the iPhone can use.',
      },
    ],
  },
  {
    slug: 'straight-talk-iphone-unlock-request-checklist',
    title: 'Straight Talk iPhone Unlock: Request Guide',
    heading: 'Straight Talk iPhone Unlock: What to Check Before You Request It',
    description: 'Prepare a Straight Talk iPhone unlock request with the right device details, check eligibility with the carrier, and verify completion.',
    standfirst: 'A useful unlock request identifies the phone, the restriction and the account history. Here is what to collect before contacting Straight Talk or paying an intermediary.',
    published: '2026-09-14',
    updated: '2026-09-14',
    minutes: 6,
    topic: 'Straight Talk iPhone unlock',
    blocks: [
      {
        kind: 'p',
        text: 'Before requesting a Straight Talk iPhone unlock, check whether the iPhone is actually carrier-locked and establish where the device came from. Then ask the carrier to assess that specific phone. A service-plan receipt, a seller’s promise and an unlock confirmation answer different questions; confusing them can send you to the wrong provider or lead to an unnecessary purchase.',
      },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      {
        kind: 'list',
        items: [
          'Check the handset’s Carrier Lock status before requesting a paid service.',
          'Separate a Straight Talk device purchase from a SIM or plan bought for a phone you already owned.',
          'Have the device identifier, purchase record and relevant service history ready for the carrier’s assessment.',
          'Ask which policy applies and what remains unmet; do not treat a general waiting-period claim as your eligibility result.',
          'Keep a case reference, then verify completion on the iPhone before buying a replacement plan.',
        ],
      },
      { kind: 'h2', id: 'check-carrier-lock', text: 'First, check whether the iPhone needs a carrier unlock' },
      {
        kind: 'p',
        text: 'Open Settings > General > About and find Carrier Lock. Apple says “No SIM restrictions” means the iPhone is unlocked. If that is already displayed, an inability to get service needs a different investigation. If a restriction remains, Apple cannot release it: the carrier must authorize the unlock.',
        links: [{ label: 'Apple’s official carrier-unlock instructions', href: 'https://support.apple.com/en-us/109316' }],
      },
      {
        kind: 'p',
        text: 'Write down the exact message rather than describing every problem as “SIM locked.” A screenshot can help, but crop out the phone number, serial number and IMEI before posting it publicly. Keep the unredacted details for a private conversation with the verified provider when required.',
      },
      { kind: 'h3', id: 'other-locks', text: 'A PIN prompt or ownership lock needs a different route' },
      {
        kind: 'table',
        head: ['Problem', 'Appropriate next step'],
        rows: [
          ['Carrier restriction in About', 'Ask the carrier responsible for the device restriction about unlocking.'],
          ['SIM PIN or PUK request', 'Contact the provider that issued the SIM or eSIM; do not guess codes.'],
          ['Forgotten device passcode', 'Use Apple’s passcode-recovery guidance, not a carrier-unlock order.'],
          ['iPhone Locked to Owner', 'Resolve Activation Lock with the legitimate owner through Apple’s supported process.'],
          ['Lost/stolen report or finance issue', 'Resolve the underlying record or agreement with the responsible party.'],
        ],
      },
      {
        kind: 'p',
        text: 'SIM PIN protection can apply to a physical SIM or an eSIM, and guessing can permanently block it. Activation Lock instead ties the device to an Apple Account. Neither is removed by changing the iPhone’s carrier-unlock status.',
        links: [
          { label: 'Apple’s SIM PIN and PUK guidance', href: 'https://support.apple.com/en-us/118228' },
          { label: 'Apple’s Activation Lock explanation', href: 'https://support.apple.com/en-us/108794' },
        ],
      },
      { kind: 'h2', id: 'device-or-plan', text: 'Was the iPhone bought for Straight Talk, or did you bring it yourself?' },
      {
        kind: 'p',
        text: 'This is the first question to resolve with support. Buying a Straight Talk plan is not the same transaction as buying a Straight Talk handset. Straight Talk’s support site separately lists phone purchases and Bring Your Own Phone options. For a phone you previously bought elsewhere, gather the original purchase details before assuming your latest service provider controls its restriction.',
        links: [{ label: 'Straight Talk’s support and device options', href: 'https://www.straighttalk.com/support' }],
      },
      {
        kind: 'table',
        head: ['Your situation', 'Record to find', 'Question to ask'],
        rows: [
          ['Bought a Straight Talk-branded iPhone', 'The handset receipt and activation record', 'Is this device covered by your unlock policy?'],
          ['Bought only a SIM or service plan', 'The phone’s original seller and carrier details', 'Does your system manage this device’s carrier restriction?'],
          ['Bought a used or replacement iPhone', 'Original receipt or replacement paperwork, if available', 'Which device and service history are associated with this identifier?'],
        ],
      },
      {
        kind: 'p',
        text: 'For example, if your paperwork records only a plan purchase, it does not establish where the iPhone was originally sold. Ask support to identify the correct route. If a different carrier must handle the request, keep the explanation and use that carrier’s official process rather than submitting several paid orders.',
      },
      { kind: 'h2', id: 'eligibility-records', text: 'Prepare a Straight Talk unlock eligibility checklist' },
      {
        kind: 'p',
        text: 'Straight Talk asks existing customers to have their device identifier and/or Straight Talk phone number available when contacting support. Use a separate device for a technical-support call so you can inspect the iPhone while speaking to the representative.',
        links: [{ label: 'Straight Talk’s official contact instructions', href: 'https://www.straighttalk.com/support/contact' }],
      },
      {
        kind: 'list',
        items: [
          'Device: exact iPhone model and the identifier the carrier asks you to confirm.',
          'Purchase: seller, handset purchase date and any replacement or exchange record.',
          'Service: activation information and payment records available for that phone, not just your current line.',
          'Status: exact Carrier Lock wording, any refusal message and previous case references.',
          'Goal: another domestic network, resale or a compatible plan abroad; state what you need without assuming it changes eligibility.',
        ],
      },
      { kind: 'h3', id: 'current-policy', text: 'Use the current Straight Talk unlock policy, not a universal countdown' },
      {
        kind: 'p',
        text: 'Straight Talk links its Unlocking Policy from the support hub to tfwunlockpolicy.com. Open it from that official route and ask which conditions apply to your device. We could not verify the full policy text during the September 14, 2026 review, so this guide does not quote an eligibility waiting period, exception threshold or early-unlock fee. Get those details from the carrier before making a payment or travel commitment.',
        links: [{ label: 'Find Unlocking Policy on Straight Talk’s support hub', href: 'https://www.straighttalk.com/support' }],
      },
      {
        kind: 'p',
        text: 'Ask the representative to distinguish the date of purchase, activation history and qualifying service in your record. A calendar calculation from a receipt alone is not a device-specific decision. If records are incomplete, ask what evidence would resolve the gap rather than guessing an eligibility date.',
      },
      { kind: 'h2', id: 'make-request', text: 'How to make a useful unlock request' },
      {
        kind: 'p',
        text: 'Use Straight Talk’s official contact page for chat or call 1-877-430-2355. If you are outside the United States and cannot reach the number, use the online contact route. This is a support request, not a reason to give account passwords to a seller or an unsolicited caller.',
        links: [{ label: 'Contact Straight Talk directly', href: 'https://www.straighttalk.com/support/contact' }],
      },
      {
        kind: 'list',
        ordered: true,
        items: [
          'Confirm that the representative is assessing the iPhone you have, not a previous device on the line.',
          'Ask whether Straight Talk handles its restriction and whether it currently qualifies.',
          'If eligible, ask whether any action remains for you and how completion will be confirmed.',
          'If refused, ask for the specific unmet condition and the evidence or change needed for review.',
          'Record the case reference and the follow-up timeframe supplied for that case.',
        ],
      },
      {
        kind: 'note',
        text: 'Suggested wording: “I want to use my iPhone with another carrier. Please confirm whether you manage its carrier lock, which eligibility rule applies to this device, and what action remains. If it is not eligible, please identify the unmet requirement and give me a case reference.”',
      },
      { kind: 'h3', id: 'after-response', text: 'Turn the response into a next action' },
      {
        kind: 'table',
        head: ['Carrier response', 'What to do next'],
        rows: [
          ['Device not found or wrong provider', 'Recheck the identifier and original purchase record before contacting the named provider.'],
          ['Service requirement not met', 'Ask which recorded period is missing and when the case can be reviewed.'],
          ['Ownership, fraud or lost/stolen concern', 'Have the legitimate owner resolve the underlying issue; do not buy a bypass promise.'],
          ['Request accepted or pending', 'Keep the case reference and follow the supplied status-check instructions.'],
          ['Unlock confirmed', 'Check the phone itself before purchasing another plan.'],
        ],
      },
      { kind: 'h2', id: 'confirm-and-switch', text: 'Confirm the unlock before switching SIM or eSIM' },
      {
        kind: 'p',
        text: 'After carrier confirmation, revisit Carrier Lock in About. If the restriction remains, return to the existing case with that result and ask the carrier to check its authorization. Apple’s guidance then distinguishes activation with another carrier’s physical SIM from setting up an eSIM. Do not erase the phone as an initial eligibility test.',
        links: [{ label: 'Apple’s steps after carrier approval', href: 'https://support.apple.com/en-us/109316' }],
      },
      {
        kind: 'p',
        text: 'For eSIM, confirm that your exact model and destination provider support it, then follow that provider’s activation instructions. Unlocking and plan activation are separate checks. If an unlocked device still cannot connect, ask the new provider about compatibility and provisioning instead of immediately paying for another unlock.',
        links: [{ label: 'Apple’s eSIM setup requirements', href: 'https://support.apple.com/en-us/118669' }],
      },
      { kind: 'h2', id: 'before-paying', text: 'Before paying a third-party iPhone unlock service' },
      {
        kind: 'p',
        text: 'An intermediary may help review requirements and arrange a request where an applicable service is available. That is different from guaranteeing an override of the carrier’s decision. Ask what is being sold: a status report, request submission or a completed unlock, and what happens if it is refused. An IMEI report is information, not proof that the network restriction has been removed.',
        links: [{ label: 'Understand what an IMEI check tells you', href: '/articles/what-an-imei-check-tells-you' }],
      },
      {
        kind: 'p',
        text: 'iUnlockMobile does not clear finance agreements or unlock devices reported lost or stolen. This article is informational and does not establish that Straight Talk ordering is available. Contact us to confirm a suitable service and its current terms before paying; do not send passwords, a device passcode or payment-card details.',
        links: [{ label: 'Read iUnlockMobile’s support limitations', href: '/contact' }],
      },
      {
        kind: 'cta',
        text: 'Have a Straight Talk eligibility response but are unsure what it means? Share the model and the message with sensitive identifiers removed, and ask us to confirm whether an appropriate service is currently available.',
        href: '/contact',
        label: 'Ask before placing an unlock order',
      },
    ],
    faq: [
      {
        question: 'Does using a Straight Talk SIM prove Straight Talk can unlock my iPhone?',
        answer: 'No. Identify where the handset came from and ask whether Straight Talk manages its carrier restriction. A plan purchase alone does not establish the phone’s original sales or lock history.',
      },
      {
        question: 'What if I do not have the original activation date?',
        answer: 'Tell support which records you do have and ask them to check the device history. Do not substitute the used-phone purchase date or estimate a qualifying date from the model’s age.',
      },
      {
        question: 'Can I use an eSIM instead of requesting an unlock?',
        answer: 'An eSIM is a way to activate a plan, not a carrier-lock bypass. Establish unlocked status and confirm device and provider compatibility before buying the plan.',
      },
      {
        question: 'Does a carrier unlock remove debt or Activation Lock?',
        answer: 'No. Finance obligations and Apple’s ownership protection are separate issues that must be resolved through the responsible provider or legitimate owner.',
      },
    ],
  },
  {
    slug: 'cricket-iphone-unlock-purchase-date-rules',
    title: 'Cricket iPhone Unlock: Which Rule Applies?',
    heading: 'Cricket iPhone Unlock: Six Months or 365 Days of Service?',
    description: 'Check Cricket iPhone unlock rules by purchase date, follow the official request steps, and know what to ask if your device is refused.',
    standfirst: 'Your purchase date matters. Compare Cricket’s current support instructions with its general policy before assuming your iPhone qualifies.',
    published: '2026-09-13',
    updated: '2026-09-13',
    minutes: 6,
    topic: 'Cricket iPhone unlock',
    blocks: [
      {
        kind: 'p',
        text: 'A Cricket iPhone unlock starts with the right eligibility rule, not an unlock-code purchase. Cricket’s support page currently distinguishes devices by purchase date, while its general policy states a longer service requirement without that distinction. If those pages seem to give different answers for your phone, ask Cricket to confirm the applicable rule for your device before paying anyone.',
        links: [
          { label: 'Cricket’s device-specific support instructions', href: 'https://www.cricketwireless.com/support/account-management/device-unlock' },
          { label: 'Cricket’s general unlock policy', href: 'https://www.cricketwireless.com/legal-info/device-unlock-policy.html' },
        ],
      },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      {
        kind: 'list',
        items: [
          'Use the purchase-date comparison below, then have Cricket verify the paid-service history of the actual device.',
          'An old receipt proves a purchase date, not every month of qualifying service.',
          'Keep the eligibility decision, request confirmation and handset status as separate checkpoints.',
          'A missing device in the account portal is a reason to investigate the device record, not evidence that a paid bypass is needed.',
          'Ask about current service availability before ordering from a third party; no provider can guarantee every device qualifies.',
        ],
      },
      { kind: 'h2', id: 'purchase-date-rules', text: 'Cricket unlock policy: which purchase-date rule applies?' },
      {
        kind: 'p',
        text: 'Checked September 13, 2026: Cricket’s Device Unlock support page lists the following split. These are paid-service requirements, not simply the age of the iPhone.',
        links: [{ label: 'Read the current Cricket support requirements', href: 'https://www.cricketwireless.com/support/account-management/device-unlock' }],
      },
      {
        kind: 'table',
        head: ['Device purchase date', 'Paid service stated on the support page'],
        rows: [
          ['Before July 1, 2026', 'At least six months'],
          ['On or after July 1, 2026', 'At least 365 days'],
        ],
      },
      {
        kind: 'p',
        text: 'The separate policy page, revised July 1, 2026, says 365 days on the device and does not spell out the earlier-purchase exception. It also requires a Cricket-designed, Cricket-locked device with no lost/stolen report or fraudulent-account association. Do not resolve a disagreement by choosing whichever page promises the shorter wait: request a device-specific explanation from Cricket.',
        links: [{ label: 'Compare Cricket’s published policy wording', href: 'https://www.cricketwireless.com/legal-info/device-unlock-policy.html' }],
      },
      { kind: 'h3', id: 'used-or-replacement-phone', text: 'Used or replacement iPhone? Confirm the date Cricket recognizes' },
      {
        kind: 'p',
        text: 'For a secondhand purchase, separate your receipt from the device’s original purchase record. For a replacement, keep the exchange paperwork too. The public pages do not explain every resale, replacement or interrupted-service scenario. Rather than assuming service transfers or the clock restarts, ask which date and service periods Cricket has associated with this IMEI.',
      },
      {
        kind: 'list',
        items: [
          'Have the model, purchase or replacement receipt, and relevant Cricket line available.',
          'Ask: “Which purchase-date category applies to this device, and how much qualifying service is recorded?”',
          'If refused, request the specific unmet requirement and the next action or review date.',
          'Keep the case reference and a dated copy of the reply so the next conversation starts with evidence.',
        ],
      },
      { kind: 'h3', id: 'military-exception', text: 'Overseas military deployment is a separate request' },
      {
        kind: 'p',
        text: 'Cricket’s policy permits one device for eligible active, deployed military personnel who cannot meet the service-duration rule, with acceptable deployment verification and the other requirements satisfied. Ask Cricket to assess that exception; a holiday or ordinary business trip is not the same category.',
        links: [{ label: 'Cricket’s deployed military exception', href: 'https://www.cricketwireless.com/legal-info/device-unlock-policy.html' }],
      },
      { kind: 'h2', id: 'request-iphone-unlock', text: 'How to unlock a Cricket iPhone through the official process' },
      {
        kind: 'p',
        text: 'Current customers can sign in to Cricket’s online device-unlock process, choose the relevant phone number and select Request Unlock. Eligible iPhones receive an on-screen confirmation and a text; a restart may be needed. Former customers should contact 1-800-CRICKET (274-2538). Cricket’s Android app and code instructions are a separate workflow.',
        links: [
          { label: 'Open Cricket’s official device-unlock portal', href: 'https://www.cricketwireless.com/deviceunlock' },
          { label: 'Follow Cricket’s iPhone instructions', href: 'https://www.cricketwireless.com/support/account-management/device-unlock' },
        ],
      },
      {
        kind: 'p',
        text: 'Enter account credentials only on the carrier’s own site. If the phone is missing from the portal, Cricket says it may already be unlocked or have missing IMEI information. Ask support to check the record instead of selecting a different line just to continue.',
        links: [{ label: 'Cricket’s missing-device guidance', href: 'https://www.cricketwireless.com/deviceunlock' }],
      },
      { kind: 'h3', id: 'verify-completion', text: 'Verify completion on the iPhone' },
      {
        kind: 'p',
        text: 'Open Settings > General > About and look at Carrier Lock. Apple identifies “No SIM restrictions” as the unlocked state. If a restriction remains after confirmation, ask Cricket to verify that the authorization was applied to the correct phone. Apple says only the carrier can unlock it; an eligibility result alone is not that authorization.',
        links: [{ label: 'Apple’s carrier-unlock verification steps', href: 'https://support.apple.com/en-us/109316' }],
      },
      { kind: 'h2', id: 'different-locks', text: 'Make sure the problem is actually a carrier lock' },
      {
        kind: 'table',
        head: ['What you see or learn', 'What to investigate'],
        rows: [
          ['Carrier restriction in About', 'The carrier-unlock request and the device it covers'],
          ['SIM PIN or PUK prompt', 'Security on the SIM or eSIM; ask its provider for help'],
          ['Passcode screen', 'Access to the iPhone itself, not permission to change networks'],
          ['iPhone Locked to Owner', 'Activation Lock linked to an Apple Account'],
          ['Lost/stolen flag or outstanding finance', 'The underlying report or agreement, not a settings change'],
        ],
      },
      {
        kind: 'p',
        text: 'Do not guess SIM PINs or PUK codes: failed attempts can leave the SIM or eSIM unusable. Contact the provider that issued it. Activation Lock is different again and protects a device linked to its owner’s Apple Account; a carrier unlock does not remove that ownership check.',
        links: [
          { label: 'Apple’s SIM PIN and PUK guidance', href: 'https://support.apple.com/en-us/118228' },
          { label: 'Apple’s explanation of Activation Lock', href: 'https://support.apple.com/en-us/108794' },
        ],
      },
      { kind: 'h2', id: 'refused-request', text: 'What to do when a Cricket iPhone unlock is refused' },
      {
        kind: 'p',
        text: 'Treat a refusal as a question to narrow down. “Not eligible” is less useful than knowing whether the obstacle is the purchase record, service history, account access or a device flag. Repeating the same submission without correcting the underlying issue gives you little new information.',
      },
      {
        kind: 'table',
        head: ['Situation', 'Useful next question or action'],
        rows: [
          ['Your receipt appears to put you in the earlier category', 'Ask Cricket to compare the receipt with its recorded purchase date.'],
          ['You believe enough service has elapsed', 'Request the qualifying periods recorded for this device and an explanation of any gap.'],
          ['You bought the phone from someone else', 'Ask the seller for the original record and any unlock confirmation; preserve the return deadline.'],
          ['A lost/stolen or fraud issue appears', 'Have the legitimate owner resolve the report with the responsible party; do not buy a removal promise.'],
          ['Approval appears, but Carrier Lock remains', 'Provide the case reference and privately confirm that the request and phone identifiers match.'],
        ],
      },
      {
        kind: 'p',
        text: 'An IMEI report can help you frame the next question, but it does not replace Cricket’s eligibility decision or settle a finance agreement. If a seller advertised an unlocked phone and cannot substantiate that claim, consider the seller’s return process before spending more on it.',
        links: [{ label: 'What an IMEI check can and cannot tell you', href: '/articles/what-an-imei-check-tells-you' }],
      },
      { kind: 'h2', id: 'international-use', text: 'Before using another network or a travel eSIM' },
      {
        kind: 'p',
        text: 'Once unlocked, check the destination provider’s compatibility requirements for your exact iPhone model and chosen plan. eSIM availability depends on the device and provider; installing an eSIM is a plan-activation step, not a substitute for carrier authorization. Follow the new provider’s setup instructions and test the services included in your plan before relying on it abroad.',
        links: [{ label: 'Apple’s eSIM setup requirements', href: 'https://support.apple.com/en-us/118669' }],
      },
      { kind: 'h2', id: 'third-party-service', text: 'What can a third-party unlock service actually do?' },
      {
        kind: 'p',
        text: 'An intermediary can help review service requirements and, where an applicable service is available, arrange submission of an unlock request. It cannot turn a refused device into a guaranteed approval. iUnlockMobile does not clear finance agreements or unlock devices reported lost or stolen. This guide does not confirm that Cricket ordering is currently available.',
        links: [{ label: 'Review iUnlockMobile’s service limitations', href: '/contact' }],
      },
      {
        kind: 'list',
        items: [
          'Before paying, ask whether the service explicitly supports your device and its current status.',
          'Get the actual deliverable, total price and estimated processing time in writing.',
          'Check what happens to the payment or account credit if the request is refused.',
          'Never provide an Apple Account password, Cricket password or device passcode to an unlock seller.',
        ],
      },
      {
        kind: 'cta',
        text: 'Unsure which service fits your Cricket iPhone? Tell us the model and the exact eligibility message, without passwords or full device identifiers in the initial message. Ask us to confirm current availability before placing an order.',
        label: 'Ask about your device before paying',
        href: '/contact',
      },
    ],
    faq: [
      {
        question: 'Does buying an older used iPhone make it eligible immediately?',
        answer: 'No. A resale receipt does not establish the device’s qualifying service record. Ask Cricket to identify the purchase-date category and service history it recognizes for that phone.',
      },
      {
        question: 'Should I follow a six-month guide or the 365-day policy?',
        answer: 'Check the dated comparison above and ask Cricket which rule applies to your device. Its support page includes a purchase-date distinction that is not spelled out in the general policy; neither a generic guide nor a screenshot can decide your case.',
      },
      {
        question: 'Do I need an Android unlock app for my Cricket iPhone?',
        answer: 'No. Follow Cricket’s iPhone-specific online or support route described above, rather than its Android app instructions.',
      },
      {
        question: 'Can a paid service guarantee an unlock before I qualify?',
        answer: 'Do not rely on that promise. Ask what eligible service is being supplied and what happens if it is refused. Paying an intermediary does not itself change the carrier’s requirements.',
      },
    ],
  },
  {
    "slug": "t-mobile-iphone-unlock-status-esim",
    "title": "T-Mobile iPhone Unlock: Status & eSIM",
    "heading": "T-Mobile iPhone Unlock: What to Do If It Still Shows SIM Locked",
    "description": "Check T-Mobile iPhone unlock status, understand prepaid and postpaid rules, and resolve a locked device before buying a travel eSIM.",
    "standfirst": "An eligibility result and an unlocked iPhone are two different checkpoints. Find out which one needs attention before changing carriers or buying a travel plan.",
    "published": "2026-09-12",
    "updated": "2026-09-12",
    "minutes": 7,
    "topic": "T-Mobile iPhone unlock",
    "blocks": [
      {
        "kind": "p",
        "text": "If your T-Mobile iPhone unlock appears eligible but the phone still shows a carrier restriction, compare the account’s eligibility result with the status on the handset. Then ask T-Mobile to resolve the mismatch. A message about eligibility is not a reason to assume another carrier’s SIM or eSIM will activate."
      },
      {
        "kind": "h2",
        "id": "key-takeaways",
        "text": "Key Takeaways"
      },
      {
        "kind": "list",
        "items": [
          "Check both the iPhone’s Carrier Lock setting and the device information for the correct T-Mobile line.",
          "Use the rule for your actual account type; prepaid and postpaid do not follow the same eligibility test.",
          "If the account and handset disagree, collect both results and ask the carrier which step remains incomplete.",
          "Before purchasing a travel eSIM, confirm carrier-unlocked status and the destination provider’s device compatibility.",
          "Do not buy a second unlock solely because an already-unlocked phone cannot get service."
        ]
      },
      {
        "kind": "h2",
        "id": "two-status-checks",
        "text": "Check T-Mobile unlock status in two places"
      },
      {
        "kind": "h3",
        "id": "iphone-setting",
        "text": "On the iPhone: check the actual carrier restriction"
      },
      {
        "kind": "p",
        "text": "Open Settings > General > About and find Carrier Lock. Apple says “No SIM restrictions” means the iPhone is unlocked. If a restriction remains, Apple cannot remove it for you; the carrier must authorize the change.",
        "links": [
          {
            "label": "Apple’s Carrier Lock instructions",
            "href": "https://support.apple.com/en-us/109316"
          }
        ]
      },
      {
        "kind": "h3",
        "id": "account-check",
        "text": "In your account: check the correct device and line"
      },
      {
        "kind": "p",
        "text": "On T-Mobile.com, open your account’s Accounts page, choose the line, then Check device unlock status. In T-Life or the T-Mobile app, go to Manage, select the line and open Device lock status; Manage all may appear first. These are account checks, not an unlock-code screen on the iPhone.",
        "links": [
          {
            "label": "T-Mobile’s account and app status instructions",
            "href": "https://www.t-mobile.com/support/devices/unlock-your-mobile-wireless-device"
          }
        ]
      },
      {
        "kind": "p",
        "text": "Compare the model and device identifier with the phone in your hand. This matters after an upgrade, replacement or used-phone purchase: a screenshot for a different device cannot establish the status of yours. Record the date of the check and the exact message, keeping identifiers and account information private."
      },
      {
        "kind": "h2",
        "id": "current-eligibility",
        "text": "T-Mobile iPhone unlock requirements by account type"
      },
      {
        "kind": "p",
        "text": "The following US T-Mobile policy summary was checked on September 12, 2026. It applies to phones from that carrier even when their owners are abroad. T-Mobile unlocks qualifying devices without a fee. The device must have been sold by T-Mobile, have no lost, stolen or blocked status, and have an account in good standing.",
        "links": [
          {
            "label": "T-Mobile’s current SIM unlock policy",
            "href": "https://www.t-mobile.com/responsibility/consumer-info/policies/sim-unlock-policy"
          }
        ]
      },
      {
        "kind": "table",
        "head": [
          "Account type",
          "Additional published conditions"
        ],
        "rows": [
          [
            "Postpaid",
            "At least 40 days active on the requesting line; financed or leased device fully paid; canceled account balance zero."
          ],
          [
            "Prepaid",
            "365 days since activation; or, if earlier, more than $100 in refills for each active line during that period and more than 14 days since purchase. No more than two unlocks per line in the preceding 12 months."
          ]
        ]
      },
      {
        "kind": "p",
        "text": "T-Mobile may require purchase evidence or other information. Deployed military customers in good standing can request an exception with overseas orders. Eligible remote-capable devices are automatically unlocked within two business days; for others, the carrier provides next steps. Check the policy for complete conditions.",
        "links": [
          {
            "label": "Review eligibility and exceptions with T-Mobile",
            "href": "https://www.t-mobile.com/responsibility/consumer-info/policies/sim-unlock-policy"
          }
        ]
      },
      {
        "kind": "h2",
        "id": "eligible-still-locked",
        "text": "Eligible, but still SIM locked: a practical support checklist"
      },
      {
        "kind": "p",
        "text": "T-Mobile’s iPhone-specific instructions say to contact support when an eligible iPhone remains locked so the carrier can submit the unlock. Connect the phone to Wi-Fi or the T-Mobile network first. Do not follow a Samsung menu or install an Android Device Unlock app on the assumption that it is an iPhone requirement.",
        "links": [
          {
            "label": "Follow T-Mobile’s Apple iPhone unlock steps",
            "href": "https://www.t-mobile.com/support/devices/unlock-your-mobile-wireless-device"
          }
        ]
      },
      {
        "kind": "list",
        "ordered": true,
        "items": [
          "Save the account eligibility result and the Carrier Lock wording, with the date and time of each check.",
          "Confirm the device in the account matches the iPhone, especially after a replacement or line change.",
          "Ask support whether the case is waiting for an eligibility review, a submitted unlock, or confirmation that the change reached the phone.",
          "Request a case reference and a specific next action. Keep the answer with your purchase records.",
          "After the carrier confirms completion, recheck the handset and follow the new provider’s activation instructions."
        ]
      },
      {
        "kind": "p",
        "text": "A useful support message is: “My account shows this device as eligible, but the iPhone still shows a Carrier Lock restriction. Can you confirm that the IMEI matches, whether an unlock has been submitted, and what I should do next?” Share identifiers only through the carrier’s official support channel.",
        "links": [
          {
            "label": "Contact T-Mobile for device assistance",
            "href": "https://www.t-mobile.com/contact-us"
          }
        ]
      },
      {
        "kind": "h3",
        "id": "not-eligible",
        "text": "If the device is not eligible"
      },
      {
        "kind": "p",
        "text": "Ask for the specific unmet condition instead of repeatedly opening the same request. Separate a service-history question from a billing dispute or an incorrect device record. A seller’s statement that a phone is “paid off” is not evidence that every carrier requirement has passed."
      },
      {
        "kind": "p",
        "text": "For a used iPhone, ask the seller to help resolve issues tied to the original account. Keep the listing, receipt and messages. If the seller cannot deliver the unlocked device advertised, consider the marketplace’s dispute process before spending more on an uncertain service.",
        "links": [
          {
            "label": "Checks before buying a used phone",
            "href": "/articles/checks-before-buying-a-used-phone"
          }
        ]
      },
      {
        "kind": "h2",
        "id": "temporary-unlock-travel",
        "text": "Does a temporary T-Mobile iPhone unlock solve a travel problem?"
      },
      {
        "kind": "p",
        "text": "The current T-Mobile help page gives iPhone-specific status and support steps; it does not document a temporary iPhone unlock procedure. Do not treat a temporary-unlock instruction for another manufacturer, or an old discussion, as confirmation that your iPhone qualifies. Ask T-Mobile what it can authorize for your device before committing to a travel plan.",
        "links": [
          {
            "label": "Check the current instructions for Apple iPhone",
            "href": "https://www.t-mobile.com/support/devices/unlock-your-mobile-wireless-device"
          }
        ]
      },
      {
        "kind": "p",
        "text": "Apple distinguishes roaming with your existing carrier from using another provider’s travel eSIM. The latter requires an unlocked iPhone. If you are not ready to switch providers, check your existing plan’s destination coverage, roaming charges and available travel options instead.",
        "links": [
          {
            "label": "Apple’s international eSIM guidance",
            "href": "https://support.apple.com/en-us/118227"
          }
        ]
      },
      {
        "kind": "h3",
        "id": "esim-purchase-checklist",
        "text": "Before buying a travel eSIM"
      },
      {
        "kind": "list",
        "items": [
          "Confirm the destination provider supports the exact iPhone model and its SIM or eSIM configuration.",
          "Check the countries included, plan duration and whether the package provides data only or also a local phone number.",
          "Read when the plan’s validity starts and how activation works so a test does not start the package earlier than intended.",
          "Decide whether to keep your home line enabled and check any charges that may apply to it."
        ]
      },
      {
        "kind": "p",
        "text": "An unlocked iPhone still needs compatible cellular hardware and a supported plan. Apple advises checking eSIM support with the provider and cellular bands for the destination. Unlocking changes the carrier restriction; it does not add hardware capabilities.",
        "links": [
          {
            "label": "Check Apple’s requirements for using eSIM abroad",
            "href": "https://support.apple.com/en-us/118227"
          }
        ]
      },
      {
        "kind": "h2",
        "id": "different-locks",
        "text": "Make sure you are solving the right lock"
      },
      {
        "kind": "table",
        "head": [
          "Restriction",
          "Appropriate next step"
        ],
        "rows": [
          [
            "Carrier Lock",
            "Resolve carrier authorization and verify the phone’s network-lock status."
          ],
          [
            "SIM PIN or PUK",
            "Ask the SIM or eSIM provider for recovery help; do not guess codes."
          ],
          [
            "Screen passcode",
            "Use Apple’s passcode recovery route rather than ordering a carrier unlock."
          ],
          [
            "Activation Lock / Locked to Owner",
            "Resolve the Apple Account ownership check with the legitimate owner or Apple’s documented support process."
          ],
          [
            "Blacklist or finance issue",
            "Resolve the underlying carrier record or account obligation; an unlock is not a debt settlement or report-removal service."
          ]
        ]
      },
      {
        "kind": "p",
        "text": "Apple warns that incorrect PIN or PUK guesses can permanently lock a SIM or eSIM. Activation Lock is separate protection associated with Find My. Neither problem is fixed by getting permission to use another mobile network.",
        "links": [
          {
            "label": "Apple: SIM PIN and PUK help",
            "href": "https://support.apple.com/en-us/118228"
          },
          {
            "label": "Apple: Activation Lock",
            "href": "https://support.apple.com/en-us/108794"
          }
        ]
      },
      {
        "kind": "h2",
        "id": "third-party-help",
        "text": "When considering an iPhone unlock service"
      },
      {
        "kind": "p",
        "text": "Keep the carrier’s answer as your starting point. A third party may offer a device report or assistance with a supported carrier request; those are different deliverables. Ask which one is being sold, what device statuses are accepted, and what happens if the request cannot be completed. Payment does not create carrier authorization."
      },
      {
        "kind": "p",
        "text": "There is no reason to hand an intermediary your Apple Account password or an account verification code for an IMEI information check. Read the scope, processing estimate and refund terms before deciding. Avoid a promise that one purchase will simultaneously remove network restrictions, ownership protection and outstanding finance.",
        "links": [
          {
            "label": "Understand what an IMEI report actually tells you",
            "href": "/articles/what-an-imei-check-tells-you"
          },
          {
            "label": "Compare carrier eligibility in the iPhone unlock guide",
            "href": "/articles/iphone-carrier-unlock-eligibility"
          }
        ]
      },
      {
        "kind": "cta",
        "text": "Need help identifying the next step for your device? Contact iUnlockMobile with the carrier and the error wording, without passwords or verification codes. Ask about current availability before placing an order; this guide does not confirm that T-Mobile unlocking is currently offered.",
        "href": "/contact",
        "label": "Ask about your iPhone unlock options"
      },
      {
        "kind": "h2",
        "id": "after-confirmation",
        "text": "After confirmation: verify before switching"
      },
      {
        "kind": "p",
        "text": "Once the carrier confirms completion, Apple directs users to set up the new carrier’s eSIM or insert its physical SIM. Its separate instructions for users without another SIM include a backup before erasing and restoring. Do not erase a phone as a speculative first step while eligibility is unresolved.",
        "links": [
          {
            "label": "Apple’s steps after carrier confirmation",
            "href": "https://support.apple.com/en-us/109316"
          }
        ]
      },
      {
        "kind": "p",
        "text": "If the phone is unlocked but the new line still cannot connect, ask the destination carrier to check activation and compatibility. Keep the unlock confirmation and the new provider’s error message together: they describe different parts of the handover. This helps support investigate the actual failure instead of starting another unlock order."
      }
    ],
    "faq": [
      {
        "question": "Why does my account say eligible while my iPhone is still locked?",
        "answer": "Eligibility describes whether a request can proceed; the phone’s setting reflects the restriction you need resolved. Compare the device details and ask support which stage remains incomplete, using the checklist above."
      },
      {
        "question": "Can I use an Android Device Unlock app for my iPhone?",
        "answer": "Use the Apple iPhone section of the carrier’s help page. Do not expect another manufacturer’s app or menu to be present on iOS."
      },
      {
        "question": "Does paying off my iPhone prove it is ready to unlock?",
        "answer": "No. Establish the full device and account history and compare it with the applicable requirements. Ask for the exact unmet condition if the result is still ineligible."
      },
      {
        "question": "Should I buy another unlock if a travel eSIM has no signal?",
        "answer": "First establish whether the carrier restriction has already been removed. If it has, ask the travel provider to investigate its plan and activation rather than assuming another unlock purchase is needed."
      }
    ]
  },
  {
    "slug": "att-iphone-unlock-request-status",
    "title": "AT&T iPhone Unlock: Request & Status Guide",
    "heading": "AT&T iPhone Unlock: How to Request, Track and Fix a Denial",
    "description": "Complete an AT&T iPhone unlock request correctly, track its status and fix common eligibility problems before switching SIM or eSIM.",
    "standfirst": "You do not need to be an AT&T customer to submit an eligible request. The difficult part is matching the right rules and completing every step.",
    "published": "2026-09-11",
    "updated": "2026-09-11",
    "minutes": 9,
    "topic": "AT&T iPhone unlock",
    "blocks": [
      {
        "kind": "p",
        "text": "An AT&T iPhone unlock removes the carrier restriction after AT&T confirms that the device qualifies. Start with AT&T’s official process: it accepts requests from eligible noncustomers and provides a request number you can use to track the decision. A paid service cannot erase an installment balance, change account history or override a lost-device record."
      },
      {
        "kind": "h2",
        "id": "key-takeaways",
        "text": "Key Takeaways"
      },
      {
        "kind": "list",
        "items": [
          "Check Settings > General > About > Carrier Lock before submitting anything; an eligible AT&T Wireless iPhone may already have unlocked automatically.",
          "For AT&T Wireless, purchase age, installment balance, device status and account standing are separate requirements. Passing one does not mean the device passes all of them.",
          "AT&T Prepaid uses a different service-history rule: 12 months of paid AT&T service, plus device-status requirements.",
          "A noncustomer can submit an AT&T device unlock request, but must confirm the email link within 24 hours.",
          "Keep the request number and IMEI. AT&T says a submitted request can take up to 48 hours, even when many decisions arrive sooner.",
          "If AT&T declines the request, fix the named eligibility problem before paying anyone or submitting duplicates."
        ]
      },
      {
        "kind": "h2",
        "id": "check-before-request",
        "text": "First check whether the AT&T iPhone is already unlocked"
      },
      {
        "kind": "p",
        "text": "On the iPhone, open Settings, select General, then About, and scroll to Carrier Lock. Apple describes “No SIM restrictions” as unlocked. AT&T says an eligible iPhone active on an AT&T Wireless plan should unlock automatically after it meets the requirements, so checking first can prevent an unnecessary request or payment.",
        "links": [
          {
            "label": "Apple’s instructions for checking Carrier Lock",
            "href": "https://support.apple.com/en-us/109316"
          },
          {
            "label": "AT&T’s current device-unlock guidance",
            "href": "https://www.att.com/support/article/wireless/KM1008728/"
          }
        ]
      },
      {
        "kind": "p",
        "text": "If Carrier Lock still shows a restriction, confirm that AT&T is the original carrier. A phone currently using an AT&T SIM is not automatically an AT&T-locked phone; an already-unlocked device can also use AT&T. If the original carrier is uncertain, identify it before opening an AT&T request.",
        "links": [
          {
            "label": "Read how an IMEI check can identify a phone and carrier",
            "href": "/articles/what-an-imei-check-tells-you"
          }
        ]
      },
      {
        "kind": "note",
        "text": "Carrier Lock is not the same as a SIM PIN or PUK, screen passcode, Activation Lock, or blacklist status. An AT&T carrier-unlock request does not remove those separate restrictions."
      },
      {
        "kind": "h2",
        "id": "att-eligibility",
        "text": "AT&T iPhone unlock requirements checked in September 2026"
      },
      {
        "kind": "p",
        "text": "AT&T maintains separate rules for Wireless, Prepaid and Business devices. The table below summarizes the carrier’s published requirements as checked on September 11, 2026. Use AT&T’s live response for the final device-specific decision because policies and account records can change.",
        "links": [
          {
            "label": "Review AT&T’s live unlock requirements",
            "href": "https://www.att.com/deviceunlock/"
          }
        ]
      },
      {
        "kind": "table",
        "head": [
          "Device or account type",
          "Published requirements to check",
          "Important distinction"
        ],
        "rows": [
          [
            "AT&T Wireless",
            "Purchased more than 60 days ago; not active on another AT&T account; installment balance is zero; no lost, stolen or fraud status; current customer bill is not past due",
            "Purchase age alone is not eligibility. Each listed condition must be satisfied."
          ],
          [
            "AT&T Prepaid iPhone",
            "12 months of paid AT&T service; not active on another AT&T account; no lost, stolen or fraud status",
            "The 60-day Wireless rule is not the Prepaid service-history rule."
          ],
          [
            "AT&T Business iPhone",
            "Purchase-age, payment and device-status checks; controlling company permission; completed contract or term where applicable; current account",
            "The organization controlling the account may need to authorize the unlock."
          ],
          [
            "Deployed active-duty exception",
            "Submit an unlock request, identify the deployment situation and provide the requested deployment documents",
            "AT&T publishes an exception to the payoff requirement for qualifying deployed personnel."
          ]
        ]
      },
      {
        "kind": "h3",
        "id": "paid-off-not-same-as-eligible",
        "text": "Paid off does not always mean immediately eligible"
      },
      {
        "kind": "p",
        "text": "A zero installment balance is one requirement, not the whole decision. AT&T also checks purchase timing, whether the device is active on another AT&T account, device reporting status and—when the requester is a current customer—whether the bill is past due. For a second-hand iPhone, the seller may need to resolve an account-side problem that the buyer cannot see."
      },
      {
        "kind": "h3",
        "id": "prepaid-different-clock",
        "text": "AT&T Prepaid uses a different clock"
      },
      {
        "kind": "p",
        "text": "AT&T currently states that a Prepaid device needs 12 months of paid AT&T service. Do not substitute the Wireless purchase-age rule or count only the time since a second-hand purchase. The carrier’s service record, rather than the buyer’s ownership date, determines this requirement."
      },
      {
        "kind": "h2",
        "id": "submit-request",
        "text": "How to submit an AT&T iPhone unlock request"
      },
      {
        "kind": "list",
        "ordered": true,
        "items": [
          "Copy the correct IMEI from Settings > General > About. If the iPhone shows more than one IMEI, use the identifier AT&T requests for the device or line being unlocked.",
          "Open AT&T’s official device-unlock portal and select Apple as the device brand. Sign in if the flow directs you to your AT&T account, or continue through the noncustomer request path when applicable.",
          "Enter the device and contact information exactly as requested. Do not give a third party your AT&T password, PIN or verification codes.",
          "Submit the request and save the request number. Take a private screenshot or store it with your purchase and account records.",
          "If you are not an AT&T customer, open the confirmation email and select “Confirm your request” within 24 hours. AT&T says an unconfirmed request must be submitted again.",
          "Watch email, text messages and spam or junk folders for AT&T’s decision and any required next step."
        ]
      },
      {
        "kind": "p",
        "text": "The IMEI is a device identifier, so verify every digit before submission and do not post it publicly. Apple documents where to find IMEI and related identifiers in Settings, on supported device surfaces and in an Apple Account.",
        "links": [
          {
            "label": "Find the correct iPhone IMEI with Apple",
            "href": "https://support.apple.com/en-us/108037"
          },
          {
            "label": "Start the official AT&T unlock request",
            "href": "https://www.att.com/deviceunlock/unlockstep1"
          }
        ]
      },
      {
        "kind": "h3",
        "id": "without-att-account",
        "text": "Can you unlock an AT&T iPhone without an AT&T account?"
      },
      {
        "kind": "p",
        "text": "Yes, if the device meets AT&T’s requirements. AT&T explicitly allows a person without an AT&T account to submit an unlock request. This is useful for a used iPhone or a device taken abroad, but noncustomer status does not waive a balance, service-history, device-status or original-account problem."
      },
      {
        "kind": "h2",
        "id": "track-status",
        "text": "How to check AT&T unlock status"
      },
      {
        "kind": "p",
        "text": "Use the link in AT&T’s email or text. If you have the request number and the device IMEI, enter both in AT&T’s unlock-status portal. AT&T says approval often takes only a few minutes but may take up to 48 hours. Treat that as the carrier’s current processing window, not a guaranteed completion time.",
        "links": [
          {
            "label": "Check an AT&T device unlock request status",
            "href": "https://www.att.com/deviceunlock/status"
          }
        ]
      },
      {
        "kind": "table",
        "head": [
          "Status or situation",
          "What it means",
          "What to do next"
        ],
        "rows": [
          [
            "Pending",
            "AT&T has not issued a final decision",
            "Wait through the published processing window and check email, text and spam folders."
          ],
          [
            "Waiting for confirmation",
            "The noncustomer email step is incomplete",
            "Use the confirmation link within 24 hours; if it expired, submit a new request."
          ],
          [
            "Approved",
            "AT&T has authorized the carrier unlock",
            "Follow the message, connect the iPhone to the internet and verify Carrier Lock."
          ],
          [
            "Denied or not eligible",
            "At least one carrier requirement or record did not pass",
            "Read the stated reason, resolve that exact issue, then submit again when eligible."
          ],
          [
            "No request found",
            "The number, IMEI or confirmation state may not match",
            "Check the saved request details and avoid guessing or opening multiple duplicate cases."
          ]
        ]
      },
      {
        "kind": "h2",
        "id": "fix-denied-request",
        "text": "AT&T iPhone unlock denied: match the response to the fix"
      },
      {
        "kind": "p",
        "text": "A denial is not one generic problem. AT&T’s public page says a request that is not approved is probably ineligible, but the useful next step depends on the carrier’s stated reason. Preserve the decision message and work through the corresponding record."
      },
      {
        "kind": "h3",
        "id": "installment-balance",
        "text": "The installment balance is not zero"
      },
      {
        "kind": "p",
        "text": "The account holder must settle the installment obligation and allow AT&T’s systems to reflect the payment. Unlocking does not cancel money owed under a device agreement. If you bought the iPhone used, ask the seller for a resolution or refund instead of paying an unlock vendor to promise that the debt no longer matters."
      },
      {
        "kind": "h3",
        "id": "active-another-account",
        "text": "The iPhone is active on another AT&T account"
      },
      {
        "kind": "p",
        "text": "The current account holder may need to remove, replace or otherwise resolve the device on that account. A buyer cannot safely infer that an inactive SIM means the IMEI is no longer attached to an account. Ask AT&T what account-side change is required without requesting or sharing another person’s credentials."
      },
      {
        "kind": "h3",
        "id": "too-new-or-service-history",
        "text": "The purchase or paid-service history is too short"
      },
      {
        "kind": "p",
        "text": "Wait until the applicable rule is met: the Wireless and Prepaid requirements use different histories. Do not repeatedly resubmit while the underlying date remains unchanged, and do not rely on an old forum post when AT&T can change its published policy."
      },
      {
        "kind": "h3",
        "id": "lost-stolen-fraud",
        "text": "The IMEI is reported lost, stolen or associated with fraud"
      },
      {
        "kind": "p",
        "text": "An iPhone carrier unlock does not remove a device report. Only the party with legitimate authority and evidence should dispute an incorrect record with the reporting carrier. If you purchased the phone from someone else, use the marketplace’s buyer-protection process and preserve the listing, payment record and messages.",
        "links": [
          {
            "label": "Review checks to run before buying a used phone",
            "href": "/articles/checks-before-buying-a-used-phone"
          }
        ]
      },
      {
        "kind": "h3",
        "id": "past-due-or-business-control",
        "text": "The account is past due or controlled by a business"
      },
      {
        "kind": "p",
        "text": "A current customer needs to bring the bill current. For a business-owned iPhone, AT&T’s published requirements include permission from the controlling company and completion of applicable contract terms. The individual holding the device may not have authority to approve that change."
      },
      {
        "kind": "cta",
        "text": "If AT&T has identified the original carrier and device status but you still need help understanding an unlock option, check iUnlockMobile’s current service listing. Availability depends on the live catalog; contact us if no exact match is shown.",
        "href": "/services/unlock",
        "label": "Check current unlock-service availability"
      },
      {
        "kind": "h2",
        "id": "after-approval",
        "text": "What to do after AT&T approves the iPhone unlock"
      },
      {
        "kind": "p",
        "text": "Connect the iPhone to Wi-Fi or cellular data, then return to Settings > General > About and check Carrier Lock. Apple says only the carrier can unlock an iPhone; after carrier confirmation, you can insert the new physical SIM or follow the new carrier’s eSIM setup instructions. If you do not have another SIM and the restriction remains, Apple documents a backup, erase and restore sequence. Back up first and use that sequence only after the carrier says the unlock is complete.",
        "links": [
          {
            "label": "Follow Apple’s post-approval unlock steps",
            "href": "https://support.apple.com/en-us/109316"
          }
        ]
      },
      {
        "kind": "p",
        "text": "If Carrier Lock says “No SIM restrictions” but the new line still shows SOS or No Service, stop treating the problem as an unlock request. Ask the new carrier to confirm account activation, device compatibility, provisioning, coverage and any required IMEI registration. An unlocked status does not guarantee that every network or plan supports the iPhone.",
        "links": [
          {
            "label": "Use Apple’s SOS and No Service troubleshooting",
            "href": "https://support.apple.com/en-us/120000"
          }
        ]
      },
      {
        "kind": "h2",
        "id": "before-paying-third-party",
        "text": "Before paying a third-party AT&T unlock service"
      },
      {
        "kind": "p",
        "text": "Try the official AT&T path first and keep its response. A legitimate intermediary should describe the exact deliverable and limitations. It should not claim that Apple itself accepts consumer unlock requests, ask for your account password, or promise to erase Activation Lock, a screen passcode, finance liability or a lost-device report."
      },
      {
        "kind": "list",
        "items": [
          "Verify that the service is for AT&T and the exact device status, not merely an IMEI information report.",
          "Check whether payment covers eligibility research, request assistance or a completed carrier unlock.",
          "Read processing estimates, cancellation terms and refund conditions before submitting the IMEI.",
          "Keep the official AT&T denial reason; it is more useful than a vague promise that every phone can be unlocked.",
          "Never share account passwords, one-time security codes or full payment credentials in chat."
        ]
      },
      {
        "kind": "p",
        "text": "For a broader comparison of carrier rules and lock types, use the iPhone eligibility guide. It explains why SIM PIN, passcode, Activation Lock and blacklist issues need different solutions.",
        "links": [
          {
            "label": "Compare iPhone carrier unlock eligibility by network",
            "href": "/articles/iphone-carrier-unlock-eligibility"
          },
          {
            "label": "Contact iUnlockMobile with a device-specific question",
            "href": "/contact"
          }
        ]
      }
    ],
    "faq": [
      {
        "question": "How long does an AT&T iPhone unlock request take?",
        "answer": "AT&T says a submitted request is often approved within minutes but can take up to 48 hours. Check the status portal and the email or text sent for the request; this is a processing window, not a guarantee."
      },
      {
        "question": "Can I submit an AT&T device unlock request if I am not a customer?",
        "answer": "Yes. AT&T allows an eligible noncustomer to submit a request. The confirmation link in the email must be selected within 24 hours, and the device still has to meet all applicable requirements."
      },
      {
        "question": "Can an AT&T iPhone be unlocked while it still has an installment balance?",
        "answer": "AT&T’s standard Wireless requirement says the installment balance must be zero. Its published deployed active-duty exception is different and requires the deployment path and supporting documents."
      },
      {
        "question": "Why does Carrier Lock still show SIM locked after approval?",
        "answer": "First connect the iPhone to the internet and recheck the setting. Follow AT&T’s message and Apple’s post-approval steps. If the carrier has confirmed completion but the restriction remains, contact AT&T with the request number before paying for another unlock."
      },
      {
        "question": "Will an AT&T carrier unlock remove Activation Lock or a blacklist report?",
        "answer": "No. Carrier Lock, Activation Lock and device-status reports are separate controls. Resolve an Apple Account ownership lock with the legitimate owner or Apple’s documented process, and dispute an incorrect device report with the reporting carrier."
      }
    ]
  },
  {
    "slug": "iphone-carrier-unlock-eligibility",
    "title": "iPhone Carrier Unlock: Eligibility Guide",
    "heading": "iPhone Carrier Unlock: Check Eligibility Before You Pay",
    "description": "Check iPhone carrier unlock eligibility before you pay. Compare carrier requirements, identify your lock and prepare for a new SIM or eSIM.",
    "standfirst": "An unlock starts with the original carrier’s rules, not a payment button. Use this guide to identify the restriction, check eligibility and choose your next step.",
    "published": "2026-09-10",
    "updated": "2026-09-10",
    "minutes": 8,
    "topic": "iPhone unlocking",
    "blocks": [
      {
        "kind": "p",
        "text": "An iPhone carrier unlock lets an eligible phone use another carrier’s SIM or eSIM. Before ordering anything, establish whether the phone is actually carrier-locked and whether its original network will approve the request. Paying an intermediary does not replace that approval. Apple says it cannot unlock an iPhone for another carrier; only the current carrier can do so.",
        "links": [
          {
            "label": "Apple’s iPhone unlocking guidance",
            "href": "https://support.apple.com/en-us/109316"
          }
        ]
      },
      {
        "kind": "h2",
        "id": "key-takeaways",
        "text": "Key Takeaways"
      },
      {
        "kind": "list",
        "items": [
          "Check the phone’s Carrier Lock setting before buying an unlock service.",
          "Match the original carrier, account type and activation history to its current eligibility rules.",
          "A SIM PIN, screen passcode, Activation Lock and a network blacklist are different problems.",
          "Try the original carrier’s official route first. If you use a third party, establish the exact service scope and refund conditions.",
          "An unlocked phone still needs compatible hardware, a supported plan and working activation for international use."
        ]
      },
      {
        "kind": "h2",
        "id": "check-carrier-lock",
        "text": "How to check if your iPhone is unlocked"
      },
      {
        "kind": "p",
        "text": "Open Settings, choose General, then About, and look for Carrier Lock. If it says “No SIM restrictions,” the phone is already carrier-unlocked. Do not purchase another unlock simply because a new line fails to connect. If a restriction is shown, identify the original carrier before requesting an unlock.",
        "links": [
          {
            "label": "Check Carrier Lock with Apple’s instructions",
            "href": "https://support.apple.com/en-us/109316"
          }
        ]
      },
      {
        "kind": "p",
        "text": "Have the IMEI ready when you contact the carrier. You can copy it from Settings > General > About. Use the identifier requested for the device or line; do not publish an IMEI or account credentials in a public comment.",
        "links": [
          {
            "label": "Find an iPhone’s IMEI",
            "href": "https://support.apple.com/en-us/108037"
          }
        ]
      },
      {
        "kind": "h2",
        "id": "identify-the-restriction",
        "text": "Identify the restriction: not every lock needs a carrier unlock"
      },
      {
        "kind": "table",
        "head": [
          "What you see",
          "What it concerns",
          "Useful next step"
        ],
        "rows": [
          [
            "Carrier Lock restriction",
            "Permission to use another carrier",
            "Check the original carrier’s unlock eligibility"
          ],
          [
            "SIM PIN or PUK request",
            "Security on the SIM or eSIM",
            "Ask the SIM provider for the correct recovery code"
          ],
          [
            "Screen passcode request",
            "Access to the phone itself",
            "Use Apple’s passcode recovery instructions"
          ],
          [
            "iPhone Locked to Owner",
            "Activation Lock tied to an Apple Account",
            "Resolve ownership with the account owner or Apple’s documented support route"
          ],
          [
            "SOS, No Service or a blocked IMEI",
            "Network access, provisioning or device status",
            "Ask the carrier to investigate before paying for an unlock"
          ]
        ]
      },
      {
        "kind": "p",
        "text": "Do not guess a SIM PIN or PUK: repeated incorrect attempts can permanently lock the SIM or eSIM. Activation Lock is separate protection associated with Find My and an Apple Account. A carrier unlock is not a way around that ownership check.",
        "links": [
          {
            "label": "Apple: SIM PIN and PUK recovery",
            "href": "https://support.apple.com/en-us/118228"
          },
          {
            "label": "Apple: Activation Lock",
            "href": "https://support.apple.com/en-us/108794"
          }
        ]
      },
      {
        "kind": "p",
        "text": "Likewise, an unlock request does not settle a finance balance or resolve a disputed lost-device report. Those issues need their own resolution with the relevant carrier, seller or account holder. Before buying a second-hand phone, verify ownership and the seller’s ability to resolve account problems.",
        "links": [
          {
            "label": "Checks before buying a used phone",
            "href": "/articles/checks-before-buying-a-used-phone"
          }
        ]
      },
      {
        "kind": "h2",
        "id": "carrier-unlock-eligibility",
        "text": "iPhone carrier unlock eligibility: what to check by network"
      },
      {
        "kind": "p",
        "text": "The policies below were checked on September 10, 2026. These are US carrier examples for readers anywhere in the world who own a phone from those networks, not worldwide eligibility rules. Use the original carrier’s current policy and device-specific response before placing an order."
      },
      {
        "kind": "h3",
        "id": "att-eligibility",
        "text": "AT&T iPhone unlock: purchase history and account status"
      },
      {
        "kind": "p",
        "text": "AT&T’s published requirements include purchase more than 60 days ago, no remaining installment balance, and no lost, stolen or fraud flag. The device cannot be active on another AT&T account; a current customer’s bill must not be overdue. AT&T Prepaid has a separate requirement of 12 months of service. Noncustomers can also submit a device-unlock request. Start by confirming whether the device follows prepaid or other eligibility requirements, rather than treating the purchase-age threshold as sufficient.",
        "links": [
          {
            "label": "Check AT&T device-unlock requirements and submit a request",
            "href": "https://www.att.com/deviceunlock/"
          }
        ]
      },
      {
        "kind": "h3",
        "id": "tmobile-eligibility",
        "text": "T-Mobile iPhone unlock: postpaid and prepaid follow different rules"
      },
      {
        "kind": "p",
        "text": "T-Mobile requires a device sold by T-Mobile, an account in good standing and no lost, stolen or blocked status. For postpaid, it lists at least 40 days active on the requesting line, full payment of financing or lease obligations, and a zero balance on canceled accounts. Prepaid generally requires 365 days since activation. Its earlier-unlock alternative requires more than $100 in refills per active line and more than 14 days since purchase; the policy also limits prepaid unlocks to two per line in 12 months. Check all conditions and exceptions directly. Eligible devices supporting remote unlocking are automatically unlocked within two business days.",
        "links": [
          {
            "label": "Read T-Mobile’s full SIM unlock policy",
            "href": "https://www.t-mobile.com/responsibility/consumer-info/policies/sim-unlock-policy"
          }
        ]
      },
      {
        "kind": "h3",
        "id": "cricket-eligibility",
        "text": "Cricket iPhone unlock: check paid service, not just device age"
      },
      {
        "kind": "p",
        "text": "Cricket’s policy, revised July 1, 2026, requires at least 365 days of paid service on the device. It must be designed for and locked to Cricket, with no lost, stolen or fraudulent-account association. Unlocking is upon request, and the policy includes a military exception. The date you bought a used iPhone does not establish its qualifying paid-service history. Ask Cricket to confirm that history instead of relying on an older six-month policy quote.",
        "links": [
          {
            "label": "Review Cricket’s current device unlock policy",
            "href": "https://www.cricketwireless.com/legal-info/device-unlock-policy.html"
          }
        ]
      },
      {
        "kind": "h3",
        "id": "straight-talk-eligibility",
        "text": "Straight Talk iPhone unlock: get a device-specific eligibility answer"
      },
      {
        "kind": "p",
        "text": "Use Straight Talk’s official device-unlock route and the linked TracFone policy to check your particular iPhone. Prepare the IMEI, first activation date and available service records. Ask whether the device qualifies, whether any action is required and when to recheck if it does not. Do not assume another carrier’s waiting period applies to your phone.",
        "links": [
          {
            "label": "Straight Talk device-unlock help",
            "href": "https://www.straighttalk.com/device/device-unlock"
          },
          {
            "label": "TracFone unlocking policy",
            "href": "https://www.tfwunlockpolicy.com/"
          }
        ]
      },
      {
        "kind": "note",
        "text": "A carrier’s inclusion in this eligibility guide does not mean iUnlockMobile currently accepts orders for that carrier. Check the live service listing or contact us for availability before paying."
      },
      {
        "kind": "h2",
        "id": "before-you-pay",
        "text": "Before you pay for an iPhone unlock service"
      },
      {
        "kind": "p",
        "text": "An IMEI report, eligibility review and completed carrier unlock are different deliverables. An intermediary may help identify the network or handle a supported request, but its service cannot substitute for carrier authorization. Ask what you are actually buying. Our guide to IMEI checks explains why a database report is useful evidence, not a guarantee that an unlock will be approved.",
        "links": [
          {
            "label": "What an IMEI check tells you",
            "href": "/articles/what-an-imei-check-tells-you"
          }
        ]
      },
      {
        "kind": "list",
        "ordered": true,
        "items": [
          "Try the official carrier request or eligibility check first and keep the response.",
          "Confirm that the listed service covers your exact original carrier, iPhone and device status.",
          "Ask whether payment is for a report, application assistance or a completed unlock.",
          "Read the stated processing estimate, rejection conditions and refund terms. Do not assume instant completion.",
          "Stop if you are offered a guaranteed bypass of ownership checks, blacklist restrictions or unpaid finance. Resolve the underlying issue instead."
        ]
      },
      {
        "kind": "p",
        "text": "If the request is declined, obtain the specific reason before submitting another paid order. A missing service-history requirement calls for a different next step from an incorrect IMEI or a disputed balance. Keep purchase records and carrier case references so the relevant party can review the problem."
      },
      {
        "kind": "cta",
        "text": "Know the original carrier and device status? Review current iUnlockMobile service availability before ordering. If you cannot find a matching service, contact us rather than choosing another carrier’s listing.",
        "href": "/services/unlock",
        "label": "Check current unlock-service availability"
      },
      {
        "kind": "h2",
        "id": "international-sim-esim",
        "text": "Using your unlocked iPhone internationally with SIM or eSIM"
      },
      {
        "kind": "p",
        "text": "Carrier unlocking is only one part of travel readiness. Using a different carrier’s travel eSIM requires an unlocked iPhone, and eSIM availability depends on the model, country and provider. Check the destination provider’s compatibility and plan requirements before purchase. Roaming with your existing carrier is a different option from switching to another provider.",
        "links": [
          {
            "label": "Apple’s guide to using eSIM while traveling internationally",
            "href": "https://support.apple.com/en-us/118227"
          }
        ]
      },
      {
        "kind": "p",
        "text": "After the carrier confirms completion, recheck Carrier Lock and follow the new provider’s activation instructions for its physical SIM or eSIM. If the old restriction still appears, contact the original carrier with the unlock confirmation rather than buying the same service again.",
        "links": [
          {
            "label": "Apple’s steps after carrier unlock confirmation",
            "href": "https://support.apple.com/en-us/109316"
          }
        ]
      },
      {
        "kind": "h3",
        "id": "unlocked-no-service",
        "text": "Already unlocked, but still seeing SOS or No Service?"
      },
      {
        "kind": "p",
        "text": "Ask the new carrier to verify that the account is active, the line is provisioned and the device is not barred from service. Check coverage or outages, make sure the intended cellular line is enabled and check for a carrier-settings update. Some countries also require registration of an imported device’s IMEI. These are network-access checks, not evidence by themselves that you need another unlock.",
        "links": [
          {
            "label": "Apple’s SOS and No Service troubleshooting",
            "href": "https://support.apple.com/en-us/120000"
          }
        ]
      },
      {
        "kind": "h2",
        "id": "next-step",
        "text": "Your next step: get the eligibility answer before the quote"
      },
      {
        "kind": "p",
        "text": "The useful question is not simply “Can this iPhone be unlocked?” It is “Does this exact device meet its original carrier’s requirements today?” Check the lock type, collect the device and account history, and get the carrier’s answer. Then choose a supported next step with clear terms.",
        "links": [
          {
            "label": "Contact iUnlockMobile about your device",
            "href": "/contact"
          }
        ]
      }
    ],
    "faq": [
      {
        "question": "Can I unlock an iPhone from another country?",
        "answer": "Start with the original carrier, even if you now live elsewhere. Moving countries does not establish eligibility. You may need the original account holder or seller to resolve account or purchase-history issues."
      },
      {
        "question": "Is an IMEI check the same as an iPhone SIM unlock?",
        "answer": "No. A check supplies information available from its data source. An unlock changes carrier restrictions after the responsible carrier authorizes it. Read the service description to understand which deliverable you are ordering."
      },
      {
        "question": "Does unlocking remove Activation Lock or the screen passcode?",
        "answer": "No. Carrier unlocking concerns cellular-network restrictions, not access to the phone or Apple Account ownership protection. Use the appropriate recovery or ownership-resolution route for those restrictions."
      },
      {
        "question": "Does No SIM restrictions guarantee any travel eSIM will work?",
        "answer": "No. It confirms carrier-unlocked status, but you still need a compatible iPhone, a supported provider and plan, and successful activation. Check the destination provider’s requirements before buying."
      }
    ]
  },
  {
    slug: 'what-an-imei-check-tells-you',
    title: 'What an IMEI check actually tells you',
    heading: 'What an IMEI check actually tells you.',
    description:
      'Learn what an IMEI check can reveal about a handset, including model, blacklist status, SIM lock, warranty information and original carrier.',
    standfirst:
      'The number is fifteen digits long and it is the only name your phone has that a network recognises. Here is what can be read from it, and what cannot.',
    published: '2026-09-07',
    updated: '2026-09-07',
    minutes: 6,
    topic: 'Basics',
    blocks: [
      {
        kind: 'p',
        text: 'Every phone that has ever connected to a mobile network carries an IMEI — an International Mobile Equipment Identity. It identifies the handset itself, not the SIM card and not the person holding it. Dial *#06# on any phone and it appears; on iPhone it is also in Settings › General › About, and on most Android handsets in Settings › About phone.',
      },
      {
        kind: 'h2',
        id: 'what-the-number-is-made-of',
        text: 'What the number is made of',
      },
      {
        kind: 'p',
        text: 'The fifteen digits are not random. The first eight are the Type Allocation Code, which identifies the model — that is how a check can tell you a number belongs to an iPhone 15 Pro 256GB rather than something else, before anyone has taken the phone out of the box. The next six are the serial number of that particular handset within the model. The last digit is a checksum.',
      },
      {
        kind: 'p',
        text: 'The checksum is a Luhn digit, the same arithmetic that validates card numbers. It exists to catch a mistyped or misread number, and it is the first thing any honest check does. A number that fails the checksum is not a phone that does not exist — it is almost always a digit typed wrong.',
      },
      {
        kind: 'note',
        text: 'A free format check confirms the number is well formed. It cannot tell you anything about the phone itself: that needs a lookup against the databases networks and manufacturers keep.',
      },
      {
        kind: 'h2',
        id: 'what-a-lookup-can-return',
        text: 'What a lookup can return',
      },
      {
        kind: 'table',
        head: ['Check', 'What it answers', 'Why it matters'],
        rows: [
          ['Model and specification', 'Which handset the number belongs to', 'The listing says one model; the IMEI says another'],
          ['Blacklist status', 'Whether it is reported lost, stolen or unpaid', 'A blacklisted handset loses network service, often after the sale'],
          ['Carrier and country', 'Which network sold it, and where', 'A lock is filed with that network and no other'],
          ['SIM lock status', 'Whether it is tied to one network', 'Decides whether an unlock is needed at all'],
          ['Warranty and age', 'Purchase date and remaining cover', 'A "sealed, new" phone with two years of warranty gone is not new'],
          ['Activation lock', 'Whether an Apple account still holds it', 'A locked device cannot be set up by anyone else'],
        ],
      },
      {
        kind: 'p',
        text: 'Not every check answers every question. Reports are sold per source, because the sources are separate: a blacklist database is not the same system as a manufacturer warranty record. That is why prices differ between reports on the same phone.',
      },
      {
        kind: 'h2',
        id: 'what-it-cannot-tell-you',
        text: 'What an IMEI check cannot tell you',
      },
      {
        kind: 'list',
        items: [
          'Who owns the phone. No lookup returns a name, an address or a phone number — that data is not in these databases, and a service offering it is selling something it does not have.',
          'Where the phone is. Location is a network and account function, not an IMEI lookup.',
          'What is on the phone. Photos, messages and accounts are not reachable from the number.',
          'Whether the seller is honest. It tells you about the handset, which is often enough to catch the problem.',
        ],
      },
      {
        kind: 'note',
        text: 'A blacklist result reflects what has been reported so far. A phone reported stolen the day after you buy it will have been clean when you checked, which is why the receipt and the seller matter as much as the report.',
      },
      {
        kind: 'h2',
        id: 'reading-a-result',
        text: 'Reading a result without over-reading it',
      },
      {
        kind: 'p',
        text: 'Two results are commonly misread. "Clean" means not currently reported — it is a statement about a database on the day you asked, not a guarantee about the future. And "SIM locked" is not a fault: most phones sold on contract are locked by design, and the lock is removed by the network that applied it.',
      },
      {
        kind: 'cta',
        text: 'Run the format check for nothing, or see what the paid reports cover.',
        href: '/services/imei-check',
        label: 'See phone check services',
      },
    ],
    faq: [
      {
        question: 'Does checking an IMEI change anything on the phone?',
        answer:
          'No. A check is a read against databases held by networks and manufacturers. Nothing is sent to the handset and nothing on it is altered.',
      },
      {
        question: 'Do I need the phone in my hand to check it?',
        answer:
          'No, only the number. A seller can send it to you before you travel to see the phone, which is the point of checking at all.',
      },
      {
        question: 'Is a free IMEI check enough before buying?',
        answer:
          'A free check validates the format of the number. It does not read the blacklist, the carrier or the warranty, so on its own it is not enough to judge a used phone.',
      },
    ],
  },
  {
    slug: 'network-unlock-explained',
    title: 'Network unlocking explained, honestly',
    heading: 'Network unlocking, explained honestly.',
    description:
      'What a network unlock does, what it will never do, and how to tell the difference between an unlock service and something being sold as one.',
    standfirst:
      'An unlock releases a handset from the network that sold it. That is the whole of it — and most of the disappointment in this market comes from expecting more.',
    published: '2026-09-07',
    updated: '2026-09-07',
    minutes: 7,
    topic: 'Unlocking',
    blocks: [
      {
        kind: 'p',
        text: 'A network lock — a SIM lock — is a restriction the selling network applies so a subsidised handset only works on its own SIM cards. Unlocking removes that restriction. The phone is unchanged in every other way: same software, same warranty, same account, same everything.',
      },
      {
        kind: 'h2',
        id: 'how-it-is-done',
        text: 'How an unlock is actually done',
      },
      {
        kind: 'p',
        text: 'The request is filed against the IMEI with the network or the manufacturer that holds the lock. Apple devices are released remotely — the phone is unlocked the next time it activates, and there is no code to type. Most other handsets come back as a code you enter once with a different SIM inserted.',
      },
      {
        kind: 'p',
        text: 'Because the record is changed at the source, an official unlock is permanent. It survives a factory reset and a software update, and it does not need to be repeated when you change SIM again.',
      },
      {
        kind: 'note',
        text: 'The lock belongs to one network. An unlock is filed with that network and no other, which is why a check that names the carrier is the sensible first step.',
      },
      {
        kind: 'h2',
        id: 'what-it-does-not-do',
        text: 'What an unlock will never do',
      },
      {
        kind: 'table',
        head: ['Situation', 'Does an unlock fix it?', 'What it actually is'],
        rows: [
          ['Phone works only on one network', 'Yes', 'A SIM lock, which is what unlocking removes'],
          ['Reported lost or stolen', 'No', 'A blacklist entry, held separately and reversible only by the reporter'],
          ['Unpaid contract or instalments', 'No', 'A finance agreement between the seller and the account holder'],
          ['Asks for a previous Apple Account', 'No', 'Activation Lock, which needs the original account'],
          ['Google account after a reset', 'No', 'Factory Reset Protection, which needs that account'],
          ['Carrier refuses the request', 'No', 'A policy decision by the network, not a technical limit'],
        ],
      },
      {
        kind: 'p',
        text: 'Anyone offering to remove a blacklist entry, clear a finance agreement or bypass an activation lock is offering to interfere with a record that belongs to somebody else. It is worth being blunt: those services either fail, or they help move a phone that someone else is still looking for.',
      },
      {
        kind: 'h2',
        id: 'when-it-can-be-refused',
        text: 'When a request comes back refused',
      },
      {
        kind: 'list',
        items: [
          'The handset is still inside its contract or instalment plan.',
          'The account it belongs to has an unpaid balance.',
          'It has been reported lost or stolen.',
          'The network does not offer unlocking for that model or that market.',
          'The IMEI does not match a device that network ever sold.',
        ],
      },
      {
        kind: 'p',
        text: 'A refusal is a network decision, and no supplier can argue it away. What a service can do is not charge you for it — which is why credit for a refused unlock should return to your balance rather than being kept as a fee.',
      },
      {
        kind: 'h2',
        id: 'how-long-it-takes',
        text: 'How long it takes, and what to expect',
      },
      {
        kind: 'p',
        text: 'Turnaround is set by the network, not by whoever files the request. Some return within hours, some take days, and the same network can be quick one week and slow the next. Any service quoting a single number for every carrier is quoting a hope. Expect an estimate per network, and expect it to be an estimate.',
      },
      {
        kind: 'cta',
        text: 'Prices and typical turnaround are published per network and per device service.',
        href: '/services/unlock',
        label: 'See unlock prices',
      },
    ],
    faq: [
      {
        question: 'Is unlocking legal?',
        answer:
          'Releasing a handset you own from its network lock is legal in most countries, and many networks will do it themselves once the contract is settled. What is not legal anywhere is interfering with a device reported lost or stolen.',
      },
      {
        question: 'Does unlocking void the warranty?',
        answer:
          'An official unlock is a record change at the network or manufacturer. It does not modify the phone, so the warranty is unaffected.',
      },
      {
        question: 'Will the unlock survive a software update?',
        answer:
          'Yes. Because the change is held at the source rather than on the handset, it survives updates and factory resets.',
      },
      {
        question: 'Can a phone be unlocked without the IMEI?',
        answer:
          'No. The IMEI is what the request is filed against — there is nothing else that identifies the handset to the network.',
      },
    ],
  },
  {
    slug: 'checks-before-buying-a-used-phone',
    title: 'Checks to run before buying a used phone',
    heading: 'Before you buy a used phone.',
    description:
      'Use this practical checklist before buying a used phone: verify its IMEI, model, blacklist, carrier lock, account status and seller receipt.',
    standfirst:
      'Most bad used-phone purchases were avoidable with two minutes and the fifteen digits the seller already has.',
    published: '2026-09-07',
    updated: '2026-09-07',
    minutes: 5,
    topic: 'Buying',
    blocks: [
      {
        kind: 'p',
        text: 'The order matters. Each step below is cheap and rules out a specific way of losing money, and doing them in this order means you rarely pay for the later ones.',
      },
      {
        kind: 'h2',
        id: 'ask-for-the-imei-first',
        text: 'Ask for the IMEI first',
      },
      {
        kind: 'p',
        text: 'Before travelling anywhere, ask the seller to dial *#06# and send you the number, ideally photographed on the screen next to the phone. A seller who will not send it has told you something useful for free.',
      },
      {
        kind: 'list',
        ordered: true,
        items: [
          'Check the number is well formed. A format check is free and catches a transposed digit before you pay for anything else.',
          'Check the model behind the number matches the listing. The first eight digits identify the model, so "iPhone 15 Pro" in the advert and something else in the result ends the conversation there.',
          'Check the blacklist. This is the one that turns a working phone into a paperweight weeks after the sale, and it is the report worth paying for.',
          'Check the carrier and lock status. It tells you whether the phone works on your network as-is, and if not, what an unlock would cost.',
          'Check the activation lock before money changes hands, not after.',
        ],
      },
      {
        kind: 'note',
        text: 'Run the checks against the number the seller sends, then check the phone in your hand shows the same number before you pay. Substituting a clean IMEI for a dirty handset is the oldest trick in this market.',
      },
      {
        kind: 'h2',
        id: 'in-person',
        text: 'What to do with the phone in your hand',
      },
      {
        kind: 'list',
        items: [
          'Dial *#06# yourself and compare it with the number you checked, and with the number printed in Settings and on the SIM tray where the model has one.',
          'Ask the seller to sign out of their account and factory reset the phone in front of you, then set it up from the welcome screen. If it asks for someone else\'s account, the sale is over.',
          'Put your own SIM in and make a call before you hand over money.',
          'Ask for the receipt. It is what a network asks for if the handset later turns out to be under a finance agreement.',
        ],
      },
      {
        kind: 'h2',
        id: 'red-flags',
        text: 'The four answers that should end it',
      },
      {
        kind: 'table',
        head: ['What the seller says', 'What it usually means'],
        rows: [
          ['"I cannot send the IMEI"', 'The number would not survive a check'],
          ['"It is iCloud locked but that is easy to remove"', 'It is not removable, and the phone is not usable'],
          ['"Reset it after you buy it"', 'It will ask for an account you do not have'],
          ['"No receipt, it was a gift"', 'Nothing to show a network if a finance claim appears later'],
        ],
      },
      {
        kind: 'cta',
        text: 'The blacklist and carrier reports are the two worth running before you travel to see a phone.',
        href: '/services/imei-check',
        label: 'Browse phone checks',
      },
    ],
  },
]

export function listArticles(): Article[] {
  return [...ARTICLES].sort((left, right) => right.published.localeCompare(left.published))
}

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((article) => article.slug === slug)
}

/** Everything except the one being read, oldest last. */
export function relatedArticles(slug: string, limit = 2): Article[] {
  return listArticles()
    .filter((article) => article.slug !== slug)
    .slice(0, limit)
}
