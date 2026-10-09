Warning: truncated output (original token count: 152880)
Total output lines: 5905

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
    slug: 'does-unlocking-iphone-void-warranty',
    title: 'iPhone Unlock and Warranty: What Changes?',
    heading: 'Does Unlocking an iPhone Void Its Warranty?',
    description: 'Does unlocking an iPhone void its warranty? Compare an official carrier unlock with jailbreaking, repairs and regional warranty terms.',
    standfirst: 'A carrier-authorized unlock changes network permission, not the iPhone hardware. Warranty coverage still depends on the claim, local terms and how the phone was modified.',
    published: '2026-10-09',
    updated: '2026-10-09',
    minutes: 9,
    topic: 'iPhone carrier unlock and warranty',
    blocks: [
      { kind: 'p', text: 'Does unlocking an iPhone void its warranty? A carrier-authorized unlock is a network-permission change controlled by the carrier, not a physical repair or a jailbreak. That distinction matters. It does not create a blanket promise that every future claim is covered, because Apple’s warranty terms, consumer-law rights and the cause of the fault still apply in the country where the iPhone was purchased.', links: [{ label: 'Read Apple’s current carrier-unlock process', href: 'https://support.apple.com/en-us/109316' }] },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'An official carrier unlock is authorized by the carrier and does not require opening the iPhone, changing its IMEI or installing modified software.',
        'Jailbreaking, unauthorized software changes, hardware tampering and third-party repair damage are separate from carrier unlocking.',
        'Apple’s written limited warranty and local consumer law determine coverage; a seller or unlock provider cannot rewrite those terms.',
        'A warranty claim is assessed for the reported fault. Coverage is not the same question as whether the iPhone can use another carrier.',
        'Keep the carrier’s unlock confirmation, proof of purchase and any service records in case the device or unlock status needs to be traced later.',
      ] },
      { kind: 'h2', id: 'short-answer', text: 'The short answer: method and claim both matter' },
      { kind: 'p', text: 'When the carrier that controls the lock approves the request, the unlock changes the device’s carrier authorization. Apple says only that carrier can unlock an iPhone for use with another carrier. The normal process does not ask you to open the phone, alter the serial number or bypass iOS security.' },
      { kind: 'p', text: 'Warranty coverage is a separate decision. Apple’s US limited-warranty terms, for example, exclude damage caused by unauthorized service and products modified to alter functionality without Apple’s written permission. They also say legal rights can vary by state, country or province. Readers outside the United States should use the warranty and consumer-law terms for the original country of purchase rather than treating a US summary as worldwide law.', links: [{ label: 'Review Apple’s US limited-warranty terms', href: 'https://www.apple.com/legal/warranty/products/ios-warranty-document-us.html' }] },
      { kind: 'note', text: 'The safe statement is not “every unlock preserves every warranty claim.” It is: a carrier-authorized unlock is different from an unauthorized modification, and the actual warranty decision follows the applicable written terms and the cause of the fault.' },
      { kind: 'h2', id: 'compare-methods', text: 'Carrier unlock, jailbreak and repair are not the same action' },
      { kind: 'table', head: ['Action', 'What it changes', 'Warranty relevance'], rows: [
        ['Carrier-authorized unlock', 'Carrier permission for another compatible SIM or eSIM', 'Does not itself open or physically modify the iPhone; the claim still follows local terms'],
        ['Jailbreak or unauthorized iOS modification', 'Software restrictions and system behavior', 'May fall within exclusions for unauthorized modification or create an unsupported software state'],
        ['Hardware unlock or tampering', 'Physical parts or board-level behavior', 'Damage or unauthorized service can affect coverage for the resulting problem'],
        ['Independent repair', 'A replaced or serviced component', 'Coverage depends on the repair, any resulting damage and applicable law'],
        ['Activation Lock removal claim', 'Apple Account ownership protection', 'Not a carrier unlock; use the legitimate owner or Apple’s documented route'],
      ] },
      { kind: 'h3', id: 'official-carrier-route', text: 'What counts as a carrier-authorized route?' },
      { kind: 'p', text: 'The responsible carrier checks the device under its current eligibility rules and applies the authorization to the device record. An intermediary may help identify the carrier, review the IMEI record or arrange a supported request, but it cannot turn a jailbreak, IMEI change or ownership bypass into an official carrier unlock. Verify completion when Carrier Lock shows No SIM restrictions.' },
      { kind: 'h3', id: 'unsupported-methods', text: 'What should raise a warranty or security concern?' },
      { kind: 'list', items: [
        'Instructions to jailbreak, sideload an unknown profile or disable iOS security to obtain the unlock.',
        'A request to open the iPhone, solder components or replace a board for a routine carrier restriction.',
        'A promise to change, repair or clean the IMEI rather than request carrier authorization.',
        'Claims that one procedure also removes Activation Lock, a passcode, SIM PIN, blacklist or finance record.',
        'A provider asking for your Apple Account password, two-factor code or device passcode.',
      ] },
      { kind: 'h2', id: 'check-before-unlock', text: 'Checks to make before you unlock an iPhone under coverage' },
      { kind: 'list', ordered: true, items: [
        'Open Settings, General, About and read Carrier Lock. If it says No SIM restrictions, the iPhone is already carrier-unlocked.',
        'Identify the carrier that controls the restriction and use its official eligibility route first.',
        'Read the Apple warranty, AppleCare plan, carrier protection plan and consumer-law terms that apply to the purchase country.',
        'Ask the provider to describe the method and deliverable in writing. A legitimate iPhone carrier unlock should not require hardware work or an Apple Account credential.',
        'Save proof of purchase, the carrier case number and the completion message without posting the full IMEI publicly.',
        'After approval, verify No SIM restrictions and test a compatible active SIM or eSIM from the destination carrier.',
      ] },
      { kind: 'p', text: 'If the iPhone already has a hardware or software fault, document it before the unlock request. An unlock should not be sold as a repair, and a repair diagnosis should not be replaced by repeated unlock orders.', links: [{ label: 'Check iPhone carrier-unlock eligibility first', href: '/articles/iphone-carrier-unlock-eligibility' }, { label: 'Compare software, jailbreak and carrier-unlock claims', href: '/articles/iphone-carrier-unlock-software-jailbreak-guide' }] },
      { kind: 'h2', id: 'warranty-claim', text: 'If you need warranty service after an unlock' },
      { kind: 'list', ordered: true, items: [
        'Describe the fault accurately and keep the carrier unlock separate from the repair symptoms.',
        'Provide proof of purchase and the coverage information requested by Apple or the authorized service provider.',
        'If service is questioned, ask which written warranty term applies to the specific fault and decision.',
        'Keep the diagnostic or refusal in writing and review any consumer-law or appeal route available in the purchase country.',
        'If a replacement iPhone is issued, compare its new IMEI and Carrier Lock status with the original unlock record before switching networks.',
      ] },
      { kind: 'h2', id: 'other-locks', text: 'Do not confuse warranty with other iPhone locks' },
      { kind: 'table', head: ['Message or issue', 'What it controls', 'Correct route'], rows: [
        ['Carrier Lock or SIM Locked', 'Use of another carrier', 'The carrier that controls the device restriction'],
        ['SIM PIN or PUK', 'Security on one SIM or eSIM line', 'The carrier that issued that line'],
        ['Forgotten passcode', 'Access to the iPhone and its data', 'Apple’s passcode recovery process'],
        ['iPhone Locked to Owner', 'Activation Lock and Apple Account ownership', 'The legitimate owner or Apple’s documented ownership route'],
        ['Blacklisted IMEI', 'Network acceptance after a loss, theft or fraud report', 'The reporting party and relevant carrier'],
        ['Hardware fault', 'A component or physical function', 'Apple or an appropriate authorized repair route'],
      ] },
      { kind: 'h2', id: 'service-role', text: 'What an iPhone unlock service can promise responsibly' },
      { kind: 'p', text: 'A responsible service can state the carrier route it supports, the information it needs, the expected deliverable and what happens if the carrier refuses. It should not promise that Apple will approve an unrelated repair, give legal advice for every country, or guarantee that an unauthorized modification will be ignored. The useful result is carrier authorization for the correct device, confirmed in Settings.' },
      { kind: 'cta', text: 'Want to confirm that an available route is a carrier-authorized unlock rather than a software or hardware workaround? Send the carrier, model and current Carrier Lock result without posting the full IMEI.', href: '/contact', label: 'Review the unlock route' },
    ],
    faq: [
      { question: 'Does an official carrier unlock void an iPhone warranty?', answer: 'A carrier-authorized unlock changes network permission and does not require opening or modifying the iPhone. Warranty coverage still follows the applicable written terms, local consumer law and the cause of the claim, so keep the carrier confirmation and check the terms for the purchase country.' },
      { question: 'Is jailbreaking the same as carrier unlocking?', answer: 'No. Jailbreaking modifies iOS restrictions. A carrier unlock is an authorization controlled by the carrier and should not require a jailbreak.' },
      { question: 'Can an unlock provider guarantee Apple warranty service?', answer: 'No. The provider can describe its unlock method and result, but Apple or the applicable service organization decides a warranty claim under the relevant terms and law.' },
      { question: 'Does an IMEI unlock change the IMEI?', answer: 'No. The IMEI identifies the device used in the carrier request. A legitimate carrier unlock does not change or repair that identifier.' },
      { question: 'What records should I keep after unlocking?', answer: 'Keep proof of purchase, the carrier request or case number, the completion notice and a private record of the device identifiers. After any replacement, compare the new IMEI and Carrier Lock status.' },
    ],
  },
  {
    slug: 'carrier-lock-not-showing-on-iphone',
    title: 'Carrier Lock Missing on iPhone: Next Steps',
    heading: 'Carrier Lock Not Showing on iPhone: What to Check',
    description: 'Carrier Lock not showing on iPhone? Follow a safe diagnostic path, verify the device record and avoid assuming a missing field means unlocked.',
    standfirst: 'A missing Carrier Lock field is not proof that the iPhone is unlocked. Check the exact screen, software and carrier record before switching SIM or eSIM.',
    published: '2026-10-09',
    updated: '2026-10-09',
    minutes: 8,
    topic: 'Missing iPhone Carrier Lock status',
    blocks: [
      { kind: 'p', text: 'If Carrier Lock is not showing on an iPhone, do not label the phone unlocked from the missing field alone. Apple’s current test is specific: Settings, General, About should show No SIM restrictions beside Carrier Lock when the iPhone is unlocked. Apple says to contact the carrier if that message is not present on an iPhone using iOS 14 or later.', links: [{ label: 'Follow Apple’s current Carrier Lock guidance', href: 'https://support.apple.com/en-us/109316' }] },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'Use Settings, General, About—not the Cellular plan name or status bar—to look for Carrier Lock.',
        'A missing field or missing No SIM restrictions message is an unknown result, not proof of an unlock.',
        'Record the iOS version, model, IMEI or IMEI2 and exact activation error before contacting the responsible carrier.',
        'A carrier-settings update can refresh carrier information, but it does not create unlock approval.',
        'SIM PIN, passcode, Activation Lock, blacklist and line provisioning are separate problems with different owners.',
      ] },
      { kind: 'h2', id: 'read-result', text: 'First, read the exact result you have' },
      { kind: 'table', head: ['What you see', 'What it means', 'Next step'], rows: [
        ['No SIM restrictions', 'Apple’s on-device indication that the iPhone is carrier-unlocked', 'Check destination-carrier compatibility and activation'],
        ['SIM Locked or a carrier restriction', 'Another carrier cannot be used until the responsible carrier approves an unlock', 'Check that carrier’s eligibility and request route'],
        ['Carrier Lock row is missing', 'The on-device result is not available from that screen', 'Verify the steps and contact the responsible carrier'],
        ['Carrier Lock is present but no unlock message appears', 'Do not assume approval is complete', 'Ask the carrier to confirm the exact IMEI and request status'],
        ['Settings is unavailable during setup', 'The field cannot be inspected yet', 'Use the activation alert, device identifiers and carrier records'],
      ] },
      { kind: 'note', text: '“Carrier” and “Network” entries describe carrier settings or the active line. They do not replace the Carrier Lock result and may not identify the company that originally locked a used iPhone.' },
      { kind: 'h2', id: 'check-screen', text: 'Check the About screen carefully' },
      { kind: 'list', ordered: true, items: [
        'Connect the iPhone to Wi-Fi or working cellular data where possible.',
        'Open Settings, choose General, then About.',
        'Wait on the About screen briefly in case a carrier-settings update prompt appears, then follow the on-screen update instruction if offered.',
        'Scroll through the full page and look specifically for Carrier Lock. Regional wording can use Network Provider Lock.',
        'Record the exact wording, iOS version, model number and the IMEI or IMEI2 associated with the affected line.',
        'Restart once and recheck after any carrier-settings update. Do not erase the iPhone merely to make the row appear.',
      ] },
      { kind: 'p', text: 'Apple says inserting a new SIM or setting up a new eSIM may require carrier settings for that provider. Its carrier-settings guide explains how to check for an update in Settings, General, About. The update can refresh network configuration and carrier information; it is not the carrier’s unlock authorization.', links: [{ label: 'Use Apple’s carrier-settings update steps', href: 'https://support.apple.com/en-us/109324' }] },
      { kind: 'h2', id: 'identify-carrier', text: 'Identify the carrier that can answer the lock question' },
      { kind: 'p', text: 'Apple says only the carrier can unlock the iPhone. For a used, imported or replacement device, the current SIM provider may not be the carrier that controls the lock. Match the IMEI to the original receipt, finance record, unlock confirmation or replacement paperwork before asking a carrier to investigate.', links: [{ label: 'Find the locking carrier before requesting an unlock', href: '/articles/how-to-find-carrier-on-iphone-before-unlock' }] },
      { kind: 'list', items: [
        'Original purchase receipt or carrier order tied to the device identifier',
        'Carrier account, payoff statement or previous unlock case',
        'Warranty, repair or insurance replacement record showing old and new identifiers',
        'The exact SIM or eSIM activation message from the destination carrier',
        'IMEI, IMEI2 and EID copied privately from Settings when available',
      ] },
      { kind: 'h3', id: 'ask-carrier', text: 'Ask the carrier a device-specific question' },
      { kind: 'p', text: 'Instead of asking only whether “this model” is unlocked, ask whether the carrier recognizes the exact IMEI, whether an unlock was approved for that identifier, and whether any completion step remains. If a support agent searches the wrong IMEI on a Dual SIM or replacement iPhone, the answer may not match the device in your hand.' },
      { kind: 'h2', id: 'setup-blocked', text: 'If setup blocks access to Settings' },
      { kind: 'p', text: 'When the iPhone cannot reach the About screen, preserve the exact activation alert. Give the original carrier the device identifier and any prior unlock case; give the destination carrier the line or eSIM activation details. A seller’s statement, a clean blacklist result or a compatible-model result is not a substitute for carrier confirmation.' },
      { kind: 'table', head: ['Evidence available', 'Who should check it', 'Question to ask'], rows: [
        ['SIM Not Supported message', 'Original carrier', 'Was the unlock applied to this exact IMEI?'],
        ['eSIM will not download', 'Destination carrier first', 'Is the plan active and provisioned to the correct IMEI or EID?'],
        ['Replacement-device paperwork', 'Carrier that handled the original unlock', 'Was authorization mapped to the replacement IMEI?'],
        ['No SIM or Invalid SIM', 'Line carrier and Apple troubleshooting', 'Is the SIM detected, active and correctly provisioned?'],
        ['iPhone Locked to Owner', 'Legitimate Apple Account owner', 'Can the owner remove Activation Lock through Apple’s documented route?'],
      ] },
      { kind: 'h2', id: 'not-proof', text: 'What does not prove the iPhone is unlocked' },
      { kind: 'list', items: [
        'The Carrier Lock row is absent or blank.',
        'A carrier’s compatibility checker accepts the model or IMEI.',
        'The current carrier name appears under a SIM or eSIM line.',
        'The iPhone connects to Wi-Fi or reaches the Home Screen.',
        'An IMEI report says clean or not blacklisted.',
        'A seller says factory unlocked without showing the live Settings result or carrier record.',
      ] },
      { kind: 'p', text: 'A clean blacklist result concerns reported device status. Activation Lock concerns Apple Account ownership. SIM PIN or PUK protects one line. None of those establishes the Carrier Lock result.', links: [{ label: 'Compare reliable ways to check iPhone unlock status', href: '/articles/how-to-check-if-iphone-is-unlocked' }, { label: 'Separate Invalid SIM from a carrier restriction', href: '/articles/invalid-sim-iphone-carrier-lock-or-sim-failure' }] },
      { kind: 'h2', id: 'service-role', text: 'What an unlock service can do with a missing status' },
      { kind: 'p', text: 'A responsible service can help organize the device identifiers, identify the likely locking carrier and explain a supported request route. It cannot turn a missing Settings row into proof of eligibility, force an unsupported carrier to provision a line, remove Activation Lock or guarantee that a carrier will correct incomplete records. Do not pay for a duplicate unlock until the responsible carrier has checked the exact device.' },
      { kind: 'cta', text: 'Carrier Lock still missing after the documented checks? Send the model, iOS version, original carrier evidence and exact activation message with the IMEI redacted.', href: '/contact', label: 'Review the missing status' },
    ],
    faq: [
      { question: 'Why is Carrier Lock not showing on my iPhone?', answer: 'The missing row does not reveal the lock state. Verify Settings, General, About, install any offered carrier-settings update, record the device details and contact the carrier responsible for the device record.' },
      { question: 'Does no Carrier Lock field mean the iPhone is unlocked?', answer: 'No. Apple’s documented unlocked result is No SIM restrictions. Treat an absent field or message as unknown and ask the responsible carrier to check the exact IMEI.' },
      { question: 'Can a carrier-settings update unlock an iPhone?', answer: 'No. It can update network configuration and carrier information, but only the carrier that controls the restriction can authorize an unlock.' },
      { question: 'What if I cannot open Settings during activation?', answer: 'Keep the exact activation alert and contact the original carrier with the device identifier and any unlock case. Ask the destination carrier to verify its line, SIM or eSIM provisioning separately.' },
      { question: 'Should I factory reset to make Carrier Lock appear?', answer: 'Do not erase the iPhone solely to make the field appear. Apple documents erase and restore only in a specific completion path after carrier confirmation when another SIM is unavailable.' },
    ],
  },
  {
    slug: 'iphone-dual-sim-two-carriers-unlock-guide',
    title: 'iPhone Dual SIM: Carrier Lock Guide',
    heading: 'iPhone Dual SIM: Can You Use Two Carriers?',
    description: 'iPhone Dual SIM can use two carriers only when the phone is unlocked. Check Carrier Lock, eSIM support and setup before adding a line.',
    standfirst: 'Dual SIM adds a second line, but it does not bypass Carrier Lock. Check the phone, both carriers and the exact SIM combination before you activate.',
    published: '2026-10-08',
    updated: '2026-10-08',
    minutes: 10,
    topic: 'iPhone Dual SIM and carrier unlock',
    blocks: [
      { kind: 'p', text: 'iPhone Dual SIM can keep two mobile plans active, but using plans from two different carriers has an extra requirement: the iPhone must be carrier unlocked. Apple says a locked iPhone can use two plans only when both come from the same carrier. The second eSIM is not a shortcut around that restriction.', links: [{ label: 'Read Apple’s current Dual SIM requirements', href: 'https://support.apple.com/en-us/109317' }] },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'Two plans from different carriers require an unlocked iPhone; two plans from the same carrier can work while the phone remains locked to that carrier.',
        'Verify No SIM restrictions under Settings, General, About, Carrier Lock before buying or transferring the second plan.',
        'Dual SIM can mean a physical SIM plus eSIM or, on supported models, two eSIMs; the available combination varies by iPhone model and region.',
        'Both lines can handle calls and messages, but the iPhone uses one cellular data network at a time.',
        'An eSIM setup error, billing block or unsupported carrier is not proof of Carrier Lock.',
      ] },
      { kind: 'h2', id: 'two-carriers-answer', text: 'Can an iPhone use two different carriers?' },
      { kind: 'p', text: 'Yes, when the exact iPhone supports Dual SIM, both carriers support the intended SIM or eSIM setup, and Carrier Lock says No SIM restrictions. If the iPhone is locked, both plans must be from the carrier that controls the lock. A plan from a second carrier may fail during eSIM download or activation even though the phone can store more than one plan.' },
      { kind: 'table', head: ['Phone state', 'Plan combination', 'Expected result'], rows: [
        ['No SIM restrictions', 'Carrier A plus Carrier B', 'Possible when both carriers support the model and SIM or eSIM route'],
        ['Locked to Carrier A', 'Two plans from Carrier A', 'Possible if Carrier A supports Dual SIM and both plans are eligible'],
        ['Locked to Carrier A', 'Carrier A plus Carrier B', 'Carrier B cannot activate until Carrier A authorizes an unlock'],
        ['Unknown lock state', 'Any mixed-carrier setup', 'Check Carrier Lock before transferring or buying the second plan'],
      ] },
      { kind: 'note', text: '“Supports two eSIMs” describes the iPhone hardware and software. “Unlocked” describes whether another carrier may activate service. You need both capabilities for a two-carrier eSIM setup.' },
      { kind: 'h2', id: 'check-before-setup', text: 'Check these four things before setup' },
      { kind: 'list', ordered: true, items: [
        'Open Settings, General, About and confirm that Carrier Lock says No SIM restrictions if the plans will come from different carriers.',
        'Identify the exact iPhone model and region. SIM trays and supported physical SIM or eSIM combinations differ between regional versions.',
        'Confirm that each carrier supports eSIM or the physical SIM route you intend to use, and that it accepts the phone’s IMEI or IMEI2.',
        'Ask each carrier whether the plan is eligible for Dual SIM, especially for enterprise, corporate, prepaid or travel service.',
      ] },
      { kind: 'p', text: 'Apple’s current guide lists iPhone XS, iPhone XS Max, iPhone XR or later as the general Dual SIM requirement. It also says iPhone 13 models and later support Dual SIM with two eSIMs, in addition to the physical-SIM-plus-eSIM arrangement, but regional hardware and carrier support still matter. Check the current specification for the exact model rather than assuming every version has the same SIM tray.' },
      { kind: 'h2', id: 'choose-sim-combination', text: 'Choose the right SIM combination' },
      { kind: 'table', head: ['Combination', 'Best use', 'Check first'], rows: [
        ['Physical SIM plus eSIM', 'Keep an existing physical line and add a digital second line', 'SIM tray availability, eSIM support and Carrier Lock'],
        ['Two eSIMs', 'Run two digital lines on a supported iPhone', 'Model support, available eSIM capacity and both carrier activation routes'],
        ['Two physical SIMs', 'Regional iPhone models designed for two nano-SIMs', 'Exact regional model and carrier compatibility'],
        ['Home line plus travel eSIM', 'Keep the home number while using local or travel data', 'Unlocked state, roaming settings and the travel provider’s support'],
      ] },
      { kind: 'h3', id: 'imei-and-imei2', text: 'IMEI and IMEI2 can matter' },
      { kind: 'p', text: 'A Dual SIM iPhone can expose more than one device identifier. A carrier may ask for the IMEI or IMEI2 associated with the line it is activating. Copy the requested value directly from Settings, General, About and keep it private. Using the wrong identifier can produce an eligibility or provisioning failure that looks like a lock problem.' },
      { kind: 'h2', id: 'setup-two-lines', text: 'Set up and label the two lines' },
      { kind: 'list', ordered: true, items: [
        'Keep the existing line active and connected while the second carrier prepares its SIM or eSIM.',
        'For an eSIM, open Settings, Cellular or Mobile Data, then choose Add eSIM and follow the carrier’s supported transfer, QR code or app route.',
        'Label the plans clearly, such as Personal and Travel or Work and Home.',
        'Choose the default voice line and the line used for cellular data.',
        'Turn on Allow Cellular Data Switching only if you understand when the iPhone may move data during a call.',
        'Test outgoing and incoming calls, messages and data on each line before relying on the setup.',
      ] },
      { kind: 'p', text: 'Apple explains that both numbers can make and receive calls and messages, while only one cellular data network is used at a time. The other line may show No Service during a call when Wi-Fi Calling or cellular data switching is unavailable. That behavior is different from a carrier lock.', links: [{ label: 'See Apple’s Dual SIM calling and data behavior', href: 'https://support.apple.com/en-us/109317' }] },
      { kind: 'h2', id: 'second-line-fails', text: 'If the second carrier will not activate' },
      { kind: 'table', head: ['What you see', 'Likely category', 'Next check'], rows: [
        ['Carrier Lock does not say No SIM restrictions', 'Carrier restriction', 'Ask the locking carrier for its current eligibility and unlock route'],
        ['Add eSIM is missing or activation will not start', 'Model, region, carrier or provisioning issue', 'Confirm model support and ask the second carrier to verify IMEI or EID'],
        ['Plan appears but has no service', 'Coverage, outage, billing or provisioning issue', 'Toggle the line, restart once and contact that carrier'],
        ['One line shows No Service during a call', 'Dual SIM call and data behavior', 'Check Wi-Fi Calling and Allow Cellular Data Switching'],
        ['SIM PIN or PUK prompt', 'Security on that SIM or eSIM', 'Contact the line’s carrier; do not guess the code repeatedly'],
        ['iPhone Locked to Owner', 'Activation Lock', 'Have the legitimate owner remove the device from the Apple Account'],
      ] },
      { kind: 'p', text: 'Apple’s current troubleshooting guide says both plans must be ready, both carriers must support Dual SIM with eSIM, and there must be no billing-related block. If the plans meet those checks but setup still fails, contact the carrier responsible for the line that will not activate.', links: [{ label: 'Follow Apple’s Dual SIM troubleshooting checks', href: 'https://support.apple.com/en-us/109322' }] },
      { kind: 'h2', id: 'unlock-service-role', text: 'What an iPhone unlock service can and cannot do' },
      { kind: 'p', text: 'A responsible service can help identify the locking carrier, review the relevant IMEI record and organize an official unlock request. It cannot make an unsupported model accept eSIM, force a carrier to provision an ineligible line, clear valid finance or blacklist records, reveal a SIM PIN, or bypass Activation Lock. The useful outcome is a carrier authorization that ends with No SIM restrictions.', links: [{ label: 'Review the iPhone carrier-unlock eligibility guide', href: '/articles/iphone-carrier-unlock-eligibility' }, { label: 'Learn how to unlock an eSIM on iPhone', href: '/articles/how-to-unlock-esim-on-iphone' }] },
      { kind: 'cta', text: 'Planning a two-carrier iPhone setup? Send the model, current Carrier Lock result and the two carriers—without posting the full IMEI—and we can help identify the right next check.', href: '/contact', label: 'Review my Dual SIM plan' },
    ],
    faq: [
      { question: 'Can I use two different carriers on one iPhone?', answer: 'Yes, if the iPhone supports the intended Dual SIM combination, both carriers support it and Carrier Lock says No SIM restrictions. A locked iPhone can use two plans only from the carrier that controls the lock.' },
      { question: 'Does adding an eSIM unlock an iPhone?', answer: 'No. An eSIM is a digital cellular plan, not an unlock method. Only the carrier that controls the lock can authorize the iPhone for another carrier.' },
      { question: 'Can a carrier-locked iPhone use Dual SIM?', answer: 'It can use two eligible plans from the same locking carrier when that carrier and the model support Dual SIM. Mixed-carrier service requires an unlocked iPhone.' },
      { question: 'Can both iPhone lines use cellular data at the same time?', answer: 'The iPhone uses one cellular data network at a time. You can choose the data line and, where supported, enable cellular data switching.' },
      { question: 'Why does my second line show No Service?', answer: 'Possible causes include carrier lock, unsupported eSIM provisioning, an inactive or blocked plan, coverage, or normal Dual SIM behavior during a call. Check Carrier Lock and the status of that specific line before requesting an unlock.' },
    ],
  },
  {
    slug: 'can-unlocked-iphone-be-locked-again',
    title: 'Can an Unlocked iPhone Be Locked Again?',
    heading: 'Can an Unlocked iPhone Be Locked Again?',
    description: 'Can an unlocked iPhone be locked again? Learn what Carrier Lock proves, why a replacement may differ and how to diagnose an apparent relock.',
    standfirst: 'A changed SIM result does not automatically mean a carrier re-locked the iPhone. Verify the exact device, Carrier Lock field and failed activation first.',
    published: '2026-10-08',
    updated: '2026-10-08',
    minutes: 9,
    topic: 'iPhone appears carrier locked again',
    blocks: [
      { kind: 'p', text: 'An iPhone that was properly unlocked by its carrier should not need a new unlock after every SIM change, iOS update or reset. If it now appears locked, start with the current on-device evidence: Apple says No SIM restrictions beside Carrier Lock means the iPhone is unlocked. A different message, a replacement phone or a failed carrier activation needs a more precise diagnosis.', links: [{ label: 'Use Apple’s current Carrier Lock check', href: 'https://support.apple.com/en-us/109316' }] },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'Check Settings, General, About on the exact iPhone in your hand; No SIM restrictions is the current unlock result.',
        'A SIM swap, eSIM transfer, iOS update or factory reset should not be treated as proof that a carrier deliberately re-locked the same device.',
        'A warranty or insurance replacement is a different device with a different IMEI and may have a different carrier record.',
        'SIM PIN, Activation Lock, blacklist, finance, compatibility and provisioning failures are separate from Carrier Lock.',
        'Only the carrier that controls the lock can correct or apply the carrier-side authorization.',
      ] },
      { kind: 'h2', id: 'verify-current-state', text: 'First, verify whether the iPhone is actually locked' },
      { kind: 'list', ordered: true, items: [
        'Open Settings, General, About on the current phone.',
        'Find Carrier Lock and record the exact wording. No SIM restrictions means there is no current carrier restriction.',
        'Record the model, IMEI and IMEI2 privately so the carrier checks the device you are actually using.',
        'Compare that IMEI with the approval email, receipt, repair paperwork or original unlock request.',
        'Test only with a compatible, active SIM or eSIM that the destination carrier has provisioned for this model.',
      ] },
      { kind: 'note', text: 'Do not diagnose a “relock” from SIM Not Supported, Invalid SIM or No Service alone. Those messages can come from different stages of activation and provisioning.' },
      { kind: 'h2', id: 'what-changed', text: 'What changed before it appeared locked?' },
      { kind: 'table', head: ['Recent event', 'What may have changed', 'Best evidence'], rows: [
        ['SIM or eSIM switch', 'The new line may be inactive, unsupported or provisioned to the wrong identifier', 'Carrier Lock result plus destination-carrier activation status'],
        ['iOS update', 'Carrier settings or activation may need to refresh', 'Carrier Lock before and after a restart and carrier-settings check'],
        ['Erase or factory reset', 'The iPhone must reactivate, exposing an unlock that was never fully applied', 'Carrier confirmation for the exact IMEI and current Carrier Lock result'],
        ['Warranty, repair or insurance replacement', 'The physical device and IMEI changed', 'Replacement paperwork and the new phone’s Carrier Lock field'],
        ['Account balance, loss report or finance dispute', 'The carrier may block service without changing Carrier Lock', 'Blacklist, finance and account records'],
        ['Used-phone purchase', 'The seller’s “unlocked” claim may have been wrong or referred to another device', 'Live Carrier Lock screen, IMEI match and written seller evidence'],
      ] },
      { kind: 'h3', id: 'reset-does-not-authorize', text: 'A reset does not create or cancel carrier authorization' },
      { kind: 'p', text: 'Apple says only the carrier can unlock an iPhone. Apple also documents backing up, erasing and restoring as a way to finish a carrier-confirmed unlock when another SIM is unavailable. That makes the reset an activation step, not the source of the carrier decision. If a reset reveals SIM Locked, ask whether the authorization was applied to the correct IMEI instead of paying for another reset.', links: [{ label: 'See Apple’s unlock completion steps', href: 'https://support.apple.com/en-us/109316' }, { label: 'Learn why a factory reset does not unlock Carrier Lock', href: '/articles/will-factory-reset-unlock-iphone-carrier' }] },
      { kind: 'h2', id: 'replacement-iphone', text: 'Replacement iPhone: the most important exception' },
      { kind: 'p', text: 'A replacement iPhone is not the same carrier record as the original phone. Even when it replaces an unlocked device, it has its own IMEI or IMEI2. If Carrier Lock on the replacement does not say No SIM restrictions, contact the carrier and provide the replacement documentation, original unlock confirmation and both device identifiers. Ask the carrier to map or reapply the authorized status to the current device rather than opening an unrelated generic request.' },
      { kind: 'list', items: [
        'Original iPhone IMEI and unlock confirmation',
        'Replacement iPhone IMEI or IMEI2',
        'Repair, warranty or insurance case number',
        'Date the replacement was activated',
        'Screenshot or exact text from the replacement’s Carrier Lock field',
        'The destination carrier and the exact activation error',
      ] },
      { kind: 'h2', id: 'not-carrier-lock', text: 'Problems commonly mistaken for a relock' },
      { kind: 'table', head: ['Problem', 'What it controls', 'Correct owner of the fix'], rows: [
        ['SIM PIN or PUK', 'Security on one SIM or eSIM line', 'The carrier that issued that line'],
        ['Device passcode', 'Access to the iPhone and its data', 'Apple’s passcode recovery process'],
        ['Activation Lock', 'Apple Account ownership during setup', 'The legitimate owner or Apple’s documented ownership route'],
        ['Blacklist or lost-device block', 'Whether carriers accept the device on their networks', 'The reporting carrier, seller or legitimate owner'],
        ['Finance or account restriction', 'Carrier eligibility or continued service', 'The carrier or finance holder'],
        ['Network compatibility', 'Bands, model approval, plan and provisioning support', 'The destination carrier'],
      ] },
      { kind: 'p', text: 'An iPhone can still say No SIM restrictions while a destination carrier refuses its IMEI, a line remains unpaid, or a travel eSIM lacks coverage. In that case, another carrier unlock request will not solve the actual problem.', links: [{ label: 'Troubleshoot an unlocked iPhone with no service', href: '/articles/iphone-unlocked-but-no-service-troubleshooting' }, { label: 'Compare blacklist and carrier-lock problems', href: '/articles/blacklisted-iphone-unlock-carrier-lock-difference' }] },
      { kind: 'h2', id: 'carrier-escalation', text: 'Build a useful carrier escalation' },
      { kind: 'list', ordered: true, items: [
        'State whether the current Carrier Lock field says No SIM restrictions or something else.',
        'Confirm that the carrier is checking the current IMEI, not an old phone, box or account record.',
        'Provide the original approval or request number and ask whether the unlock was applied, not merely approved.',
        'If the device was replaced, provide the replacement case and ask for the unlock state to be corrected on that IMEI.',
        'If Carrier Lock already says No SIM restrictions, stop requesting unlocks and move the case to activation, compatibility or account support.',
        'Keep the case number and the carrier’s written response before trying another SIM or erasing the phone.',
      ] },
      { kind: 'h2', id: 'third-party-role', text: 'What a third-party service can actually do' },
      { kind: 'p', text: 'A responsible service can help identify the locking carrier, compare IMEI records and prepare a clear escalation. It cannot guarantee that a carrier will change a replacement record, clear valid debt or blacklist entries, bypass Activation Lock or make an incompatible SIM work. Any real carrier unlock still ends with an authorization from the carrier and No SIM restrictions on the iPhone.', links: [{ label: 'Review what an IMEI unlock service does', href: '/articles/imei-unlock-iphone-service-checklist' }] },
      { kind: 'cta', text: 'Does an iPhone appear locked again? Send the current Carrier Lock wording, carrier response and whether the device was replaced—without posting the full IMEI—and we can help separate a record mismatch from an activation problem.', href: '/contact', label: 'Review the apparent relock' },
    ],
    faq: [
      { question: 'Can a carrier lock an unlocked iPhone again?', answer: 'Apple does not provide a user-facing relock process. If the exact phone no longer shows No SIM restrictions, ask the carrier to inspect the authorization and current IMEI, especially after a device replacement.' },
      { question: 'Can an iOS update carrier-lock an iPhone?', answer: 'An update can refresh carrier settings or expose an activation problem, but do not assume it intentionally re-locked the phone. Check Carrier Lock and have the carrier verify the exact IMEI.' },
      { question: 'Can a factory reset make an unlocked iPhone locked?', answer: 'A reset does not grant or revoke the carrier’s authorization. Apple uses erase and restore as a completion step after a carrier confirms an unlock. If the result changes, verify the carrier record and IMEI.' },
      { question: 'Why is my replacement iPhone SIM locked?', answer: 'The replacement has a different device identifier and may not carry the original phone’s carrier record correctly. Give the carrier the replacement case, old approval and new IMEI so it can investigate.' },
      { question: 'Does a blacklisted iPhone mean it was carrier-locked again?', answer: 'No. Blacklist and carrier-lock status are different. A phone can be unlocked but still refused by a network because of a loss, fraud or account record.' },
    ],
  },
  {
    slug: 'factory-unlocked-iphone-meaning-buyer-checklist',
    title: 'Factory Unlocked iPhone: Buyer Guide',
    heading: 'Factory Unlocked iPhone: What It Means Before You Buy',
    description: 'Factory unlocked iPhone listings can hide carrier, finance or blacklist risks. Learn what the label means and how to verify the device.',
    standfirst: '“Factory unlocked” sounds definitive, but it is usually a seller’s label. Treat the iPhone’s Carrier Lock result and its records as the evidence.',
    published: '2026-10-07',
    updated: '2026-10-07',
    minutes: 9,
    topic: 'Factory unlocked iPhone',
    blocks: [
      { kind: 'p', text: 'A factory unlocked iPhone should be able to activate with a compatible carrier without an existing carrier restriction. The phrase does not prove where the phone was bought, whether it is new, whether every network supports it, or whether its ownership and finance records are clean. Apple gives buyers a more useful check: open Settings, General, About and look for No SIM restrictions beside Carrier Lock.', links: [{ label: 'Use Apple’s current carrier-unlock check', href: 'https://support.apple.com/en-us/109316' }] },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'Factory unlocked is a marketplace description, not a complete inspection report for an iPhone.',
        'No SIM restrictions under Carrier Lock is the on-device result that confirms the current carrier-unlocked state.',
        'Factory unlocked and carrier unlocked can lead to the same usable carrier state, but they describe different histories.',
        'An unlocked iPhone can still be incompatible, financed, blacklisted, Activation Locked, damaged or tied to a seller dispute.',
        'Test the exact IMEI, model, SIM or eSIM route and seller evidence before the return window closes.',
      ] },
      { kind: 'h2', id: 'what-factory-unlocked-means', text: 'What “factory unlocked” should mean' },
      { kind: 'p', text: 'In a listing, factory unlocked usually means the seller believes the iPhone was supplied without a carrier restriction rather than unlocked later by a carrier. That history can be difficult for a buyer to prove from the phrase alone. The practical question is simpler: what does this exact iPhone report now, and can the intended carrier activate it?' },
      { kind: 'table', head: ['Listing phrase', 'Useful interpretation', 'What it does not prove'], rows: [
        ['Factory unlocked', 'Seller claims the iPhone was not tied to one carrier when supplied', 'Purchase channel, condition, clean finance or compatibility'],
        ['Carrier unlocked', 'A carrier restriction was removed after sale or activation', 'Why it was locked, whether every account record is clear or whether all networks support it'],
        ['Worldwide or global unlocked', 'Marketing claim that more than one carrier can be used', 'Every band, regional feature, regulatory approval or carrier acceptance'],
        ['SIM-free or carrier-free', 'The sale may not include service from a carrier', 'The current Carrier Lock state of a used or returned unit'],
        ['No SIM restrictions', 'The iPhone currently reports no carrier restriction', 'Blacklist, financing, Activation Lock, warranty or physical condition'],
      ] },
      { kind: 'note', text: 'Do not treat “factory unlocked,” “GSM unlocked,” “worldwide unlocked” or “fully unlocked” as stronger evidence than the Carrier Lock screen. Ask for the exact result from the exact phone.' },
      { kind: 'h2', id: 'factory-vs-carrier-unlocked', text: 'Factory unlocked vs. carrier unlocked iPhone' },
      { kind: 'p', text: 'For everyday use, both can accept another compatible carrier once Carrier Lock says No SIM restrictions. The difference is the claimed path to that state. A factory-unlocked phone is described as never having had the carrier restriction; a carrier-unlocked phone previously had one and the carrier later removed it. That carrier status does not eliminate separate account, provisioning or replacement-device errors, which can still require investigation.' },
      { kind: 'h3', id: 'which-is-better', text: 'Is one type better?' },
      { kind: 'p', text: 'The better purchase is the device with verifiable records, the correct model and a usable return path. A documented carrier-unlocked iPhone can be safer than a vaguely advertised factory-unlocked phone. Likewise, an authentic factory-unlocked phone can still be a poor purchase if it is blacklisted, Activation Locked or incompatible with the destination carrier.' },
      { kind: 'h2', id: 'buyer-verification', text: 'Verify the phone before paying' },
      { kind: 'list', ordered: true, items: [
        'Ask the seller to open Settings, General, About and show Carrier Lock on the same screen as identifying model information, with private identifiers redacted from public photos.',
        'Require the current result to say No SIM restrictions; do not accept a receipt, reset screen or another phone’s screenshot as a substitute.',
        'Match the model number and region to the intended carrier’s supported device list, bands and physical SIM or eSIM requirements.',
        'Check the IMEI through the intended carrier and a reputable record source for lost, stolen or blocked status.',
        'Confirm that Find My is removed and that setup does not stop at iPhone Locked to Owner.',
        'Ask for proof of purchase and written confirmation of any remaining finance obligation, account dispute or return restriction.',
        'Activate a compatible SIM or eSIM and test calls, mobile data and messaging before the return period ends.',
      ] },
      { kind: 'p', text: 'An IMEI check can expose useful device and carrier records, but it cannot replace the live Carrier Lock screen or guarantee future carrier acceptance. Use both checks and keep the seller’s written description.', links: [{ label: 'See what an IMEI check can and cannot prove', href: '/articles/what-an-imei-check-tells-you' }, { label: 'Use the complete used-phone buying checklist', href: '/articles/checks-before-buying-a-used-phone' }] },
      { kind: 'h2', id: 'different-problems', text: 'Unlocked does not mean problem-free' },
      { kind: 'table', head: ['Issue', 'What it controls', 'Correct next step'], rows: [
        ['Carrier Lock', 'Whether another mobile carrier can activate the iPhone', 'Use the locking carrier’s eligibility and unlock route'],
        ['SIM PIN or PUK', 'Security for one physical SIM or eSIM line', 'Contact the carrier that issued that line; do not guess repeatedly'],
        ['Device passcode', 'Access to the iPhone and its local data', 'Use Apple’s passcode recovery process'],
        ['Activation Lock', 'Whether the iPhone can be activated under a different Apple Account', 'Have the legitimate owner remove it or use Apple’s documented ownership route'],
        ['Blacklist or finance record', 'Carrier eligibility, loss or payment status', 'Resolve it with the seller, carrier or finance holder'],
        ['Network compatibility', 'Bands, model support and carrier provisioning', 'Check the exact model and IMEI with the destination carrier'],
      ] },
      { kind: 'h2', id: 'seller-red-flags', text: 'Red flags in a factory-unlocked listing' },
      { kind: 'list', items: [
        'The seller will not show Carrier Lock or says a reset is required to reveal the result.',
        'The listing promises every carrier worldwide without naming the model or supported bands.',
        'The phone is described as unlocked but still shows SIM Locked, SIM Not Supported or an Activation Lock screen.',
        'The IMEI, model or storage details differ between the listing, receipt, box and device.',
        'The seller demands payment before allowing a carrier compatibility check or provides no usable return process.',
        'A paid “factory unlock” is offered without naming the carrier decision, eligibility issue or expected on-device result.',
      ] },
      { kind: 'h2', id: 'third-party-role', text: 'What an unlock service can actually help with' },
      { kind: 'p', text: 'A responsible service can help identify the locking carrier, interpret IMEI records and organize an official carrier request. It cannot make a seller’s label true, clear valid debt or blacklist records, bypass Activation Lock or guarantee compatibility with every network. The deliverable should be a carrier-side authorization that ends with No SIM restrictions, not a new marketing phrase.', links: [{ label: 'Review the iPhone unlock service checklist', href: '/articles/imei-unlock-iphone-service-checklist' }] },
      { kind: 'cta', text: 'Have the Carrier Lock result, IMEI record and seller’s description? Send a redacted summary so we can help separate an unlock question from a purchase or compatibility risk.', href: '/contact', label: 'Review the factory-unlocked claim' },
    ],
    faq: [
      { question: 'What is a factory unlocked iPhone?', answer: 'It is a seller term for an iPhone described as supplied without a carrier restriction. Verify the actual device under Settings, General, About; No SIM restrictions is the useful on-device result.' },
      { question: 'Is factory unlocked better than carrier unlocked?', answer: 'Not automatically. Both can have the same current carrier-unlocked state. Device records, compatibility, condition, ownership evidence and the return path matter more than the label.' },
      { question: 'Can a factory unlocked iPhone still be blacklisted?', answer: 'Yes. Carrier Lock and lost, stolen, fraud or finance records are different systems. An iPhone can show No SIM restrictions and still have an account or blacklist problem.' },
      { question: 'Does factory unlocked mean the iPhone works with every carrier?', answer: 'No. The destination carrier must still support the exact model, bands, SIM or eSIM configuration and IMEI.' },
      { question: 'Can an unlocked iPhone still have Activation Lock?', answer: 'Yes. Activation Lock protects Apple Account ownership and is separate from Carrier Lock. Confirm that the legitimate owner removed Find My before buying.' },
    ],
  },
  {
    slug: 'how-long-does-iphone-carrier-unlock-take',
    title: 'How Long Does iPhone Unlock Take?',
    heading: 'How Long Does It Take to Unlock an iPhone?',
    description: 'How long does it take to unlock an iPhone? Compare carrier review, approval and activation stages, then diagnose a stalled request.',
    standfirst: 'There is no universal unlock timer. Separate eligibility waiting, carrier review and the final iPhone refresh before deciding that a request is late.',
    published: '2026-10-07',
    updated: '2026-10-07',
    minutes: 9,
    topic: 'iPhone carrier unlock timing',
    blocks: [
      { kind: 'p', text: 'How long it takes to unlock an iPhone depends on the locking carrier, account status and the stage you are measuring. Apple says a carrier may need a few days to complete a request, but that is guidance rather than a worldwide deadline. A phone that is not eligible yet, a request still under review and an approved iPhone waiting to refresh are three different situations.', links: [{ label: 'Read Apple’s current iPhone unlock process', href: 'https://support.apple.com/en-us/109316' }] },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'Start the clock only after a complete request is submitted to the carrier that controls the lock.',
        'An eligibility waiting period is not the same as processing time for an approved request.',
        'Current published examples differ: AT&T says approval is usually within minutes but can take up to 48 hours, while T-Mobile describes an automatic remote unlock within two business days after eligibility for supported devices.',
        'The reliable finish line is No SIM restrictions under Carrier Lock, not an email that merely says received or approved.',
        'A third party may help organize the case but cannot guarantee a carrier review deadline or bypass eligibility.',
      ] },
      { kind: 'h2', id: 'three-clocks', text: 'The three clocks people often combine' },
      { kind: 'table', head: ['Clock', 'When it starts', 'What ends it'], rows: [
        ['Eligibility wait', 'Purchase, activation, service or payoff event defined by the carrier', 'The exact policy requirements are met'],
        ['Carrier review', 'A complete request reaches the correct carrier', 'Approval, denial or a request for more evidence'],
        ['Device completion', 'The carrier applies an approved unlock', 'Carrier Lock shows No SIM restrictions'],
        ['New-carrier activation', 'The destination carrier provisions a SIM or eSIM', 'Calls, data and messaging work on that network'],
      ] },
      { kind: 'note', text: 'Do not quote one carrier’s published turnaround as a universal promise. Business days, account type, device support, document review and exceptions can change the actual timeline.' },
      { kind: 'h2', id: 'published-examples', text: 'Current carrier examples show why timing varies' },
      { kind: 'table', head: ['Source', 'Published timing', 'Important scope'], rows: [
        ['Apple', 'A carrier may take a few days', 'General iPhone guidance; Apple cannot unlock for the carrier'],
        ['AT&T', 'Usually a few minutes to approve; up to 48 hours', 'Applies after an unlock request is submitted and may end in approval or denial'],
        ['T-Mobile', 'Within two business days after eligibility for remote-capable devices', 'Eligibility must already be met; unsupported remote unlocks receive next steps instead'],
      ] },
      { kind: 'p', text: 'AT&T’s current support page also directs users to track a request with the IMEI and request number. T-Mobile’s current policy ties its two-business-day statement to a device becoming eligible and supporting remote unlock. Those details matter: neither source promises that an ineligible iPhone will be unlocked on that schedule.', links: [{ label: 'Check AT&T’s current unlock timing and status route', href: 'https://www.att.com/support/article/wireless/KM1008728/' }, { label: 'Review T-Mobile’s current Device Unlock Policy', href: 'https://www.t-mobile.com/responsibility/consumer-info/policies/sim-unlock-policy' }] },
      { kind: 'h2', id: 'status-timeline', text: 'Read the status before chasing the timer' },
      { kind: 'table', head: ['Status or evidence', 'What it usually means', 'Best next action'], rows: [
        ['Submitted or received', 'The carrier has the case but has not decided it', 'Keep the request number and wait through the published review window'],
        ['More information needed', 'A record or ownership detail is missing', 'Provide only the requested evidence through the official route'],
        ['Denied or not eligible', 'A policy requirement or record failed', 'Ask for the exact reason and resolve that reason before resubmitting'],
        ['Approved', 'The carrier accepted the request', 'Allow the carrier-side change to apply, then check Carrier Lock'],
        ['Completed', 'The carrier says the unlock was applied', 'Look for No SIM restrictions and test a compatible SIM or eSIM'],
        ['No SIM restrictions', 'The iPhone reports no carrier restriction', 'Move to destination-carrier compatibility and activation'],
      ] },
      { kind: 'h2', id: 'before-contacting-carrier', text: 'Before contacting the carrier about a delay' },
      { kind: 'list', ordered: true, items: [
        'Open Settings, General, About and record the exact Carrier Lock result and IMEI or IMEI2 used for the request.',
        'Confirm that the request went to the carrier that controls the lock, not merely the carrier currently shown in the status bar.',
        'Find the submission time, request number and every email or text message, including spam and junk folders.',
        'Compare the elapsed business time with that carrier’s current page for the correct plan and device type.',
        'Check for a payoff, account balance, active-line, fraud, loss, purchase-date or ownership record that has not updated yet.',
        'If the carrier says completed, connect to the internet, restart once and recheck Carrier Lock before opening a duplicate request.',
        'Test a supported destination SIM or eSIM only after No SIM restrictions appears.',
      ] },
      { kind: 'p', text: 'If the carrier controlling the lock is unclear, identify it before resubmitting. Multiple requests sent to the wrong network do not shorten the timeline and can make the case history harder to follow.', links: [{ label: 'Find the carrier on an iPhone before requesting an unlock', href: '/articles/how-to-find-carrier-on-iphone-before-unlock' }] },
      { kind: 'h2', id: 'approved-but-still-locked', text: 'Approved but still SIM locked' },
      { kind: 'p', text: 'Approval is not the final verification. Ask the carrier whether the unlock is merely approved or actually applied to the correct IMEI. Apple says that a different carrier’s SIM can complete activation after confirmation. If no other SIM is available, Apple documents a backup, erase and restore route—but back up first and do not erase merely to force an undecided request.', links: [{ label: 'Finish an approved unlock without another SIM card', href: '/articles/unlock-iphone-without-sim-card-after-approval' }] },
      { kind: 'h3', id: 'escalation-record', text: 'Build a clean escalation record' },
      { kind: 'list', items: [
        'Carrier name and the exact policy page reviewed',
        'Request number, submission time and stated service window',
        'IMEI used for the request, kept private outside official channels',
        'Exact approval, denial or completion wording',
        'Current Carrier Lock result and when it was last checked',
        'Any replacement-device, payoff or account change that could have created a record mismatch',
      ] },
      { kind: 'h2', id: 'different-locks', text: 'Make sure you are timing the right process' },
      { kind: 'table', head: ['Problem', 'Why the carrier-unlock timer does not apply', 'Correct owner'], rows: [
        ['SIM PIN or PUK prompt', 'It protects one SIM or eSIM line', 'Carrier that issued the line'],
        ['Forgotten iPhone passcode', 'It controls access to the device and data', 'Apple’s passcode recovery process'],
        ['iPhone Locked to Owner', 'It is Activation Lock, not Carrier Lock', 'Legitimate Apple Account ownership route'],
        ['Blacklisted or finance-blocked IMEI', 'It is an account, loss or payment record', 'Carrier, seller or finance holder'],
        ['No service after No SIM restrictions', 'The unlock is already complete; activation or compatibility is failing', 'Destination carrier and device compatibility checks'],
      ] },
      { kind: 'h2', id: 'third-party-role', text: 'Can a third party make it faster?' },
      { kind: 'p', text: 'A responsible service can help identify the locking carrier, assemble the IMEI and case evidence, or explain why the timer has not started. It cannot force a carrier to ignore its policy, promise a universal delivery time, erase valid debt or blacklist records, or remove Activation Lock. Ask whether the quoted time covers eligibility, review or device completion before paying.', links: [{ label: 'Check what an iPhone unlock service should deliver', href: '/articles/imei-unlock-iphone-service-checklist' }] },
      { kind: 'cta', text: 'Have the request number, carrier, submission time and current Carrier Lock result? Send a redacted timeline so we can help identify the stalled stage.', href: '/contact', label: 'Review the unlock timeline' },
    ],
    faq: [
      { question: 'How long does it take to unlock an iPhone?', answer: 'There is no universal deadline. Apple says a carrier may need a few days, while individual carriers publish their own review and completion windows. Measure from a complete request and verify the result under Carrier Lock.' },
      { question: 'Does paying off an iPhone start the unlock immediately?', answer: 'Not always. The carrier’s payment and account records may need to update, and other eligibility rules may still apply. Check the current policy before starting the review clock.' },
      { question: 'Is an approval email proof that the iPhone is unlocked?', answer: 'Not by itself. Approval can precede the carrier-side change. No SIM restrictions under Settings, General, About is the useful on-device verification.' },
      { question: 'Why is my iPhone still SIM locked after the carrier says completed?', answer: 'Confirm that the carrier applied the change to the correct IMEI, connect the iPhone to the internet and recheck Carrier Lock. Use Apple’s completion steps only after carrier confirmation.' },
      { question: 'Can an unlock service guarantee a faster result?', answer: 'No responsible service can guarantee a carrier decision or override eligibility. It may help organize evidence and identify the correct route, but the locking carrier controls authorization.' },
    ],
  },
  {
    slug: 't-mobile-temporary-unlock-iphone-travel-guide',
    title: 'T-Mobile Temporary iPhone Unlock',
    heading: 'T-Mobile Temporary Unlock for iPhone: Is It Available?',
    description: 'T-Mobile temporary unlock iPhone searches mix Android and iPhone options. Learn what T-Mobile documents and which travel routes remain.',
    standfirst: 'A temporary-unlock button shown in an Android tutorial does not prove that the same option exists for iPhone. Check the device-specific route before planning travel.',
    published: '2026-10-06',
    updated: '2026-10-06',
    minutes: 8,
    topic: 'T-Mobile temporary iPhone unlock',
    blocks: [
      { kind: 'p', text: 'A T-Mobile temporary unlock for iPhone is not documented in the same way as the temporary option shown for some Android phones. T-Mobile’s current iPhone instructions say to check Carrier Lock and contact T-Mobile when an eligible locked iPhone needs an unlock. Some Android device tutorials separately describe a time-limited travel unlock, so copying those steps to an iPhone can create a travel-day surprise.', links: [{ label: 'Read T-Mobile’s device-specific unlock instructions', href: 'https://www.t-mobile.com/support/devices/unlock-your-mobile-wireless-device' }] },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'T-Mobile’s current iPhone instructions do not show the temporary-unlock menu used by certain Android models.',
        'For an eligible locked iPhone, T-Mobile directs the customer to contact support so it can submit the unlock.',
        'No SIM restrictions in Settings, General, About is the result that confirms an iPhone carrier unlock.',
        'Roaming, an international pass and a temporary carrier unlock are different products with different costs and limits.',
        'A third party cannot create an iPhone temporary-unlock exception that the locking carrier has not authorized.',
      ] },
      { kind: 'h2', id: 'why-results-conflict', text: 'Why temporary-unlock search results conflict' },
      { kind: 'table', head: ['What you found', 'What it usually describes', 'What to verify for iPhone'], rows: [
        ['Temporary Unlock button', 'A device-specific Android menu or app', 'Whether T-Mobile publishes that option for the exact iPhone route'],
        ['Permanent Unlock button', 'An Android device completing an approved unlock', 'iPhone instead verifies the result under Carrier Lock'],
        ['International roaming or pass', 'Using the existing T-Mobile line abroad', 'Countries, networks, data limits and charges on the current plan'],
        ['Travel eSIM', 'A second carrier profile for the destination', 'Carrier Lock must permit another carrier’s eSIM'],
        ['Carrier unlock approval', 'Authorization to use another carrier', 'No SIM restrictions after T-Mobile completes the request'],
      ] },
      { kind: 'note', text: 'Do not rely on a screenshot from a different phone model. Unlock controls are device-specific, and an Android temporary-unlock menu is not an iPhone feature.' },
      { kind: 'h2', id: 'official-iphone-route', text: 'Use the published iPhone route first' },
      { kind: 'list', ordered: true, items: [
        'Open Settings, General, About and read the exact Carrier Lock result.',
        'If it says No SIM restrictions, the iPhone is already carrier-unlocked; move on to eSIM compatibility and travel-plan checks.',
        'If it shows a restriction, sign in to the T-Mobile account and review the device unlock status and current eligibility policy.',
        'Contact T-Mobile through the iPhone support route and ask whether a documented travel exception exists for this line, device and account.',
        'Ask the representative to state whether the result would be permanent, temporary or simply a roaming feature; keep the case number.',
        'Recheck Carrier Lock before buying a third-party travel eSIM or leaving the country.',
      ] },
      { kind: 'p', text: 'Apple says only the carrier can unlock an iPhone and that the carrier may need a few days to complete a request. Apple also identifies No SIM restrictions as the verification result. A support promise, Android menu or successful Wi-Fi connection does not replace that on-device check.', links: [{ label: 'Follow Apple’s current carrier-unlock guidance', href: 'https://support.apple.com/en-us/109316' }, { label: 'Use the full unlocked-iPhone verification guide', href: '/articles/how-to-check-if-iphone-is-unlocked' }] },
      { kind: 'h2', id: 't-mobile-policy', text: 'What T-Mobile currently documents' },
      { kind: 'p', text: 'T-Mobile’s current policy says eligible devices that support remote unlock are automatically and remotely unlocked within two business days. Its device page gives iPhone a contact-based route, while the temporary-unlock instructions visible in some T-Mobile tutorials belong to named Android models. That is why the safest iPhone answer is to request the device-specific decision instead of assuming a 30-day Android feature applies.', links: [{ label: 'Review T-Mobile’s current Device Unlock Policy', href: 'https://www.t-mobile.com/responsibility/consumer-info/policies/sim-unlock-policy' }] },
      { kind: 'h3', id: 'ask-support', text: 'Questions to ask T-Mobile before travel' },
      { kind: 'list', items: [
        'Does this exact iPhone IMEI qualify for a carrier unlock today?',
        'Is there a documented exception for the account’s travel or military circumstances?',
        'Will the carrier-side result be permanent, or is the suggestion actually an international roaming feature?',
        'Does the destination eSIM require an unlocked phone, and does the iPhone model support its bands?',
        'When should Carrier Lock change, and which case number should be used if it does not?',
      ] },
      { kind: 'h2', id: 'travel-alternatives', text: 'If T-Mobile does not authorize an iPhone unlock' },
      { kind: 'table', head: ['Option', 'What it solves', 'What it does not solve'], rows: [
        ['T-Mobile roaming or travel pass', 'Keeps the current line working on supported partner networks', 'Does not remove Carrier Lock'],
        ['Wi-Fi and Wi-Fi Calling', 'Can provide calling or data where supported and configured', 'Does not make another carrier’s SIM activate'],
        ['Unlocked secondary device', 'Accepts a local or travel SIM independently', 'Does not change the locked iPhone'],
        ['Portable hotspot or companion device', 'Shares a separate data connection', 'May not provide native voice or SMS on the iPhone line'],
        ['Wait for normal eligibility', 'Preserves the official permanent-unlock route', 'May not meet an immediate departure date'],
      ] },
      { kind: 'p', text: 'Check plan terms, destination coverage and charges directly with T-Mobile before choosing a roaming alternative. If another carrier’s eSIM is the goal, verify both Carrier Lock and model compatibility; an eSIM-capable iPhone can still be carrier-locked.', links: [{ label: 'Plan an international iPhone unlock before departure', href: '/articles/unlock-iphone-for-international-use-travel-checklist' }, { label: 'Separate eSIM setup from carrier unlocking', href: '/articles/how-to-unlock-esim-on-iphone' }] },
      { kind: 'h2', id: 'different-locks', text: 'Make sure the problem is really Carrier Lock' },
      { kind: 'table', head: ['Message or issue', 'What it controls', 'Correct owner'], rows: [
        ['Carrier Lock restriction', 'Use with another mobile carrier', 'Carrier that placed or controls the lock'],
        ['SIM PIN or PUK prompt', 'Security of one SIM or eSIM line', 'Carrier that issued that line'],
        ['Forgotten iPhone passcode', 'Access to the device and local data', 'Apple’s passcode recovery process'],
        ['iPhone Locked to Owner', 'Activation Lock and ownership', 'Legitimate Apple Account ownership route'],
        ['Lost, stolen or finance issue', 'Carrier account or device eligibility', 'Carrier, seller or finance provider holding that record'],
      ] },
      { kind: 'h2', id: 'third-party-role', text: 'What a third-party unlock service can do' },
      { kind: 'p', text: 'A responsible service may help identify the locking carrier, organize the IMEI and case record, or explain the published route. It cannot add a hidden temporary-unlock control to iOS, override a T-Mobile denial, erase valid financing or remove Activation Lock. Ask for the exact carrier-side outcome before paying for assistance.', links: [{ label: 'Check what an IMEI unlock service should provide', href: '/articles/imei-unlock-iphone-service-checklist' }] },
      { kind: 'cta', text: 'Know the Carrier Lock result, departure date and T-Mobile case status? Send a redacted summary so we can help separate unlock eligibility from roaming and eSIM setup.', href: '/contact', label: 'Check the travel unlock route' },
    ],
    faq: [
      { question: 'Can T-Mobile temporarily unlock an iPhone for travel?', answer: 'T-Mobile’s current public iPhone instructions do not show the temporary-unlock menu used by certain Android models. Ask T-Mobile for the device-specific decision and verify any completed unlock under Carrier Lock.' },
      { question: 'Why do T-Mobile tutorials mention a 30-day temporary unlock?', answer: 'Some T-Mobile tutorials for named Android models describe a temporary unlock. Those device-specific instructions should not be treated as iPhone instructions.' },
      { question: 'Does an international pass unlock an iPhone?', answer: 'No. A pass or roaming feature uses the existing carrier service abroad. It does not remove Carrier Lock or guarantee that another carrier’s eSIM can activate.' },
      { question: 'Can Apple provide a temporary carrier unlock?', answer: 'No. Apple states that only the carrier can unlock an iPhone for use with another carrier.' },
      { question: 'Can a third party guarantee a temporary iPhone unlock?', answer: 'No legitimate service can guarantee an exception the locking carrier has not authorized. It may help identify the carrier, evidence and official route.' },
    ],
  },
  {
    slug: 'unlock-iphone-without-sim-card-after-approval',
    title: 'Unlock iPhone Without a SIM Card',
    heading: 'Unlock iPhone Without a SIM Card: The Safe Route',
    description: 'Unlock iPhone without a SIM card by separating carrier approval from activation, then use Apple’s backup, erase and restore route safely.',
    standfirst: 'You can request a carrier unlock without having another SIM in hand. The important sequence is carrier approval first, then safe completion and verification.',
    published: '2026-10-06',
    updated: '2026-10-06',
    minutes: 8,
    topic: 'Unlock iPhone without SIM card',
    blocks: [
      { kind: 'p', text: 'To unlock an iPhone without a SIM card from another carrier, start with the carrier that controls the lock. Apple’s current instructions say that after the carrier confirms the unlock, a person with no other SIM can back up the iPhone, erase it and restore from that backup to finish the process. Erasing first does not persuade the carrier to approve an ineligible device.', links: [{ label: 'Read Apple’s current no-SIM unlock steps', href: 'https://support.apple.com/en-us/109316' }] },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'A different SIM card is not required to ask the locking carrier for approval.',
        'Only the carrier can authorize an iPhone carrier unlock; Apple cannot approve it for the carrier.',
        'If another carrier’s SIM is unavailable after approval, Apple documents a backup, erase and restore route.',
        'Check Carrier Lock before erasing because No SIM restrictions already confirms the unlocked result.',
        'This process does not remove a SIM PIN, forgotten passcode, Activation Lock, blacklist or financing balance.',
      ] },
      { kind: 'h2', id: 'three-separate-stages', text: 'Separate approval, completion and testing' },
      { kind: 'table', head: ['Stage', 'What happens', 'What you need'], rows: [
        ['Carrier approval', 'The locking carrier decides whether the IMEI meets its policy', 'IMEI, account or purchase evidence and the correct carrier route'],
        ['Completion on iPhone', 'The approved status is applied or refreshed on the device', 'Internet access; if no other SIM is available, a verified backup before erase and restore'],
        ['Verification', 'Carrier Lock shows No SIM restrictions', 'Settings, General, About'],
        ['New-carrier activation', 'A physical SIM or eSIM is provisioned on the destination network', 'Compatible plan, supported model and clean provisioning record'],
      ] },
      { kind: 'note', text: 'Do not erase the iPhone merely because a website promises that a reset will unlock it. Back up and erase only after the carrier has confirmed approval and you understand how to restore access to your data and Apple Account.' },
      { kind: 'h2', id: 'before-request', text: 'Before requesting the unlock' },
      { kind: 'list', ordered: true, items: [
        'Open Settings, General, About and record the Carrier Lock message.',
        'Record the IMEI and IMEI2 privately and identify which one belongs to the active line.',
        'Identify the carrier that sold or originally locked the iPhone; the last carrier used may be different.',
        'Review that carrier’s current eligibility requirements for the plan, country and purchase date.',
        'Resolve any policy issue the carrier identifies, then submit the request through its official route.',
        'Keep the request number and wait for the carrier’s confirmation before using the no-SIM completion steps.',
      ] },
      { kind: 'p', text: 'If the original account is unavailable, the carrier may still ask for purchase or ownership evidence and may limit what it can disclose. A third party cannot replace the carrier’s eligibility decision. Start by finding the carrier that controls the lock rather than guessing from the current line.', links: [{ label: 'Find the carrier before requesting an unlock', href: '/articles/how-to-find-carrier-on-iphone-before-unlock' }, { label: 'Check carrier-unlock eligibility first', href: '/articles/iphone-carrier-unlock-eligibility' }] },
      { kind: 'h2', id: 'after-approval', text: 'After approval: finish without another SIM card' },
      { kind: 'list', ordered: true, items: [
        'Confirm that the carrier says the unlock is completed, not merely submitted or under review.',
        'Connect the iPhone to reliable Wi-Fi and recheck Settings, General, About, Carrier Lock.',
        'If No SIM restrictions appears, save the confirmation; there is no reason to erase only to prove the same status again.',
        'If the carrier confirms completion but the status has not refreshed and no other SIM is available, create and verify a current backup.',
        'Follow Apple’s Erase All Content and Settings process only when you are ready to restore the device.',
        'Restore from the backup, connect to the internet and check Carrier Lock again.',
      ] },
      { kind: 'h3', id: 'backup-checklist', text: 'Backup checklist before you erase' },
      { kind: 'list', items: [
        'Know the Apple Account credentials and device passcode needed during setup.',
        'Confirm that the backup completed and contains the data you expect to restore.',
        'Record how the current cellular line or eSIM will be reactivated if it is removed.',
        'Keep access to trusted phone numbers, recovery contacts and two-factor authentication.',
        'Save the carrier unlock case number outside the iPhone.',
      ] },
      { kind: 'p', text: 'Apple’s no-SIM route is a completion step after carrier confirmation, not a workaround for eligibility. AT&T’s current iPhone instructions describe the same sequence: back up, erase and restore when a new SIM card is unavailable.', links: [{ label: 'Review AT&T’s official device unlock instructions', href: 'https://www.att.com/idpassets/support/pdf/ATTDeviceUnlockCodeInstructions.pdf' }] },
      { kind: 'h2', id: 'esim-route', text: 'If the next carrier uses eSIM' },
      { kind: 'p', text: 'You do not need a physical card just because the destination carrier uses eSIM. After Carrier Lock says No SIM restrictions, follow the new carrier’s eSIM activation process. Keep unlock and activation separate: an approved unlock permits another carrier, while that carrier still has to provision the plan, IMEI or IMEI2 correctly.', links: [{ label: 'Use the iPhone eSIM unlock and setup guide', href: '/articles/how-to-unlock-esim-on-iphone' }] },
      { kind: 'h2', id: 'if-still-locked', text: 'If the iPhone still shows a restriction' },
      { kind: 'table', head: ['What you see', 'Likely next check', 'Who can fix it'], rows: [
        ['Carrier says request is pending', 'Wait for the stated completion and keep the request number', 'Locking carrier'],
        ['Carrier says complete, but Carrier Lock is restricted', 'Ask the carrier to verify the exact IMEI and server-side status', 'Locking carrier'],
        ['No SIM restrictions, but eSIM fails', 'Check compatibility, account activation and IMEI assignment', 'New carrier'],
        ['SIM PIN or PUK prompt', 'Do not guess the code; request it from the line issuer', 'Carrier that issued the SIM or eSIM'],
        ['iPhone Locked to Owner', 'Use the legitimate Apple Account ownership route', 'Owner or Apple’s documented process'],
      ] },
      { kind: 'p', text: 'Apple advises contacting the carrier if No SIM restrictions does not appear after the carrier claims completion. Repeated factory resets, jailbreak tools and generic unlock codes do not replace a missing carrier-side authorization.', links: [{ label: 'See why a factory reset alone does not unlock an iPhone', href: '/articles/will-factory-reset-unlock-iphone-carrier' }, { label: 'Troubleshoot SIM Not Supported after switching', href: '/articles/iphone-sim-not-supported-after-switching-carriers' }] },
      { kind: 'h2', id: 'third-party-role', text: 'What a third-party service can and cannot do' },
      { kind: 'p', text: 'A legitimate service may help identify the locking carrier, organize the IMEI and request evidence, or explain the official no-SIM completion sequence. It cannot erase debt, force carrier approval, recover an unknown passcode, remove Activation Lock or guarantee that a blacklisted device will receive service. The meaningful result is No SIM restrictions plus successful provisioning by the new carrier.' },
      { kind: 'cta', text: 'Have the Carrier Lock message and the carrier’s completion notice but no spare SIM? Send a redacted summary so we can help identify the safest next step.', href: '/contact', label: 'Check the no-SIM unlock route' },
    ],
    faq: [
      { question: 'Can you unlock an iPhone without a SIM card?', answer: 'Yes, a different SIM is not required to request carrier approval. After approval, Apple documents a backup, erase and restore route when another SIM is unavailable.' },
      { question: 'Will erasing an iPhone remove Carrier Lock?', answer: 'No. Erasing can help complete or refresh an unlock that the carrier already approved, but it cannot create carrier authorization.' },
      { question: 'Do I need the original carrier SIM to request an unlock?', answer: 'Not necessarily. The carrier may instead require the IMEI, account information, purchase evidence or other eligibility records. Follow the locking carrier’s current policy.' },
      { question: 'Can I use eSIM instead of a physical SIM after unlocking?', answer: 'Yes, when the iPhone model and new carrier support eSIM. Carrier Lock must permit another carrier, and the new carrier must still provision the plan correctly.' },
      { question: 'Does the no-SIM process remove Activation Lock or a passcode?', answer: 'No. Carrier Lock, Activation Lock, the iPhone passcode and SIM PIN or PUK are separate security systems with different recovery routes.' },
    ],
  },
  {
    slug: 'can-you-unlock-financed-iphone-before-payoff',
    title: 'Financed iPhone Unlock: Payoff Rules',
    heading: 'Can You Unlock a Financed iPhone Before Payoff?',
    description: 'Can you unlock a financed iPhone? Learn how payoff, account standing, service time and payment method affect carrier approval.',
    standfirst: 'Financing and Carrier Lock are related, but they are not the same record. The seller, lender and locking carrier can each control a different part of the answer.',
    published: '2026-10-05',
    updated: '2026-10-05',
    minutes: 9,
    topic: 'Financed iPhone unlock',
    blocks: [
      { kind: 'p', text: 'Can you unlock a financed iPhone? Sometimes an exception applies, but a normal carrier unlock usually depends on the policy of the carrier that controls the lock. Paying the balance can satisfy one requirement without automatically satisfying service time, account standing, fraud review or purchase-record requirements.', links: [{ label: 'Start with Apple’s carrier-unlock process', href: 'https://support.apple.com/en-us/109316' }] },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'Check Carrier Lock in Settings, General, About before assuming that financing is blocking the iPhone.',
        'A device balance, promotional bill credits and a carrier lock are separate records; changing one does not prove that the others changed.',
        'Many carrier-financed iPhones must be paid in full before a normal unlock, but current rules vary by carrier, plan, country and purchase date.',
        'Paying off the iPhone may not remove the lock instantly or replace other eligibility requirements.',
        'Only the carrier controlling Carrier Lock can approve the unlock; a lender, Apple or a third-party service cannot override that decision.',
      ] },
      { kind: 'h2', id: 'separate-records', text: 'Separate the four records before taking action' },
      { kind: 'table', head: ['Record', 'What it answers', 'Who normally controls it'], rows: [
        ['Carrier Lock', 'Whether the iPhone can activate with another carrier', 'Carrier that placed or controls the lock'],
        ['Device financing', 'Whether money is still owed on the hardware', 'Carrier, retailer, lender or financing provider'],
        ['Wireless account', 'Whether service, bills and account status meet policy', 'Carrier providing the account'],
        ['Promotion or bill credits', 'Whether future discounts continue after payoff or cancellation', 'Seller or carrier running the promotion'],
      ] },
      { kind: 'note', text: 'Do not pay a third party merely because an installment balance exists. First confirm that Carrier Lock shows a restriction and identify the carrier that controls it.' },
      { kind: 'h2', id: 'check-status', text: 'Check the iPhone and account in the right order' },
      { kind: 'list', ordered: true, items: [
        'Open Settings, General, About and record the exact Carrier Lock result.',
        'Find the original purchase receipt, financing agreement and current payoff balance.',
        'Identify the carrier that sold or activated the iPhone; the current SIM or eSIM carrier may be different.',
        'Read that carrier’s current unlock policy for the correct plan type and purchase date.',
        'Ask whether paying early changes promotional credits, cancellation charges or return rights before making the payment.',
        'After payoff posts, ask the carrier to confirm every remaining eligibility item and whether unlock is automatic or request-based.',
        'Verify completion in Settings rather than relying only on a payoff receipt or confirmation email.',
      ] },
      { kind: 'p', text: 'Apple says No SIM restrictions next to Carrier Lock means the iPhone is unlocked. Apple also states that only the carrier can unlock the iPhone and that a carrier request can take a few days. A zero balance is useful evidence, but the on-device status is the result to verify.', links: [{ label: 'Follow Apple’s current verification steps', href: 'https://support.apple.com/en-us/109316' }, { label: 'Use the four-method unlocked iPhone check', href: '/articles/how-to-check-if-iphone-is-unlocked' }] },
      { kind: 'h2', id: 'policy-examples', text: 'Current US carrier examples show why payoff is not a universal rule' },
      { kind: 'table', head: ['Carrier example', 'Financing requirement', 'Other policy items to check'], rows: [
        ['AT&T postpaid', 'Installment balance must be zero', 'Purchase age, account status, fraud or loss record and whether the device is active elsewhere'],
        ['T-Mobile postpaid', 'T-Mobile financing or lease payments must be satisfied', 'Network activity, account standing, source of the device and canceled-account balance'],
        ['Verizon postpaid', 'Automatic unlock at full retail purchase or after the financing balance is paid', 'Payment verification and lost or stolen status; some payment methods can delay processing'],
      ] },
      { kind: 'p', text: 'These are US examples, not a worldwide timetable. AT&T currently requires a zero installment balance for its normal route. T-Mobile requires financed or leased devices to be paid in full and also applies other eligibility criteria. Verizon’s policy says postpaid devices unlock automatically after full retail purchase or payoff, while certain payment methods can add a verification delay. Always use the policy for the carrier, country and purchase record attached to your IMEI.', links: [{ label: 'Review AT&T’s current unlock requirements', href: 'https://www.att.com/deviceunlock/' }, { label: 'Review T-Mobile’s current unlock policy', href: 'https://www.t-mobile.com/responsibility/consumer-info/policies/sim-unlock-policy' }, { label: 'Review Verizon’s current device policy', href: 'https://www.verizon.com/support/device-unlocking-policy/' }] },
      { kind: 'h3', id: 'after-payoff', text: 'If the iPhone is paid off but still locked' },
      { kind: 'list', items: [
        'Confirm that the payoff is posted, not merely scheduled or pending.',
        'Check whether the carrier requires active service time, an account in good standing or a separate request.',
        'Verify that the IMEI on the payoff record matches the iPhone, especially after a warranty or insurance replacement.',
        'Ask whether the payment method created a review window before repeated requests.',
        'Keep the payoff receipt and support case number, then recheck Carrier Lock after the carrier confirms completion.',
      ] },
      { kind: 'h3', id: 'still-financed', text: 'If the iPhone is still financed' },
      { kind: 'p', text: 'Ask the locking carrier whether a documented exception exists before paying anyone else. Some official policies provide limited routes for qualifying deployed military personnel, while ordinary travel or a desire to add another eSIM may not override the financing requirement. If the carrier refuses the request, a third party cannot make that refusal disappear.', links: [{ label: 'Check eligibility before paying for assistance', href: '/articles/iphone-carrier-unlock-eligibility' }] },
      { kind: 'h2', id: 'used-financed-iphone', text: 'If you bought the financed iPhone from another person' },
      { kind: 'p', text: 'Do not assume that paying the seller also paid the carrier or lender. Ask the seller to resolve the balance through the original account and provide a redacted payoff receipt. Avoid taking over an informal payment arrangement or sending money to a supposed unlocker who cannot name the locking carrier and policy. A carrier may decline to disclose account details to a buyer even when it can confirm that the IMEI is not yet eligible.', links: [{ label: 'Use the locked-iPhone sale checklist', href: '/articles/sell-locked-iphone-carrier-lock-checklist' }, { label: 'Review used-phone checks before purchase', href: '/articles/checks-before-buying-a-used-phone' }] },
      { kind: 'h2', id: 'third-party-role', text: 'What an iPhone unlock service can and cannot do' },
      { kind: 'p', text: 'A legitimate service may help identify the likely carrier, organize IMEI evidence, interpret a public policy or submit an authorized request when a matching route is available. It cannot erase a valid debt, protect promotional credits, guarantee an exception, remove Activation Lock or force a carrier to approve an ineligible IMEI. The useful deliverable is a verifiable carrier-side result, not a promise to bypass financing.', links: [{ label: 'See what an IMEI unlock service should provide', href: '/articles/imei-unlock-iphone-service-checklist' }] },
      { kind: 'cta', text: 'Know the Carrier Lock result, locking carrier and payoff status? Send a redacted summary so we can help identify the correct policy route without collecting account passwords or one-time codes.', href: '/contact', label: 'Check the financed iPhone route' },
    ],
    faq: [
      { question: 'Can you unlock a financed iPhone before it is paid off?', answer: 'Only when the locking carrier’s current policy allows it or a documented exception applies. Many normal postpaid routes require the carrier financing balance to be paid in full.' },
      { question: 'Does paying off an iPhone automatically unlock it?', answer: 'Not in every case. Payoff can satisfy one requirement, but the carrier may also apply service-time, account-standing, fraud-review or request-processing rules. Verify No SIM restrictions in Settings.' },
      { question: 'Will I lose promotional bill credits if I pay off the iPhone early?', answer: 'That depends on the promotion and carrier. Ask for the current written promotion terms before paying because the financing balance and future credits are separate records.' },
      { question: 'Can Apple unlock a financed iPhone?', answer: 'No. Apple states that only the carrier can unlock an iPhone for use with another carrier. Apple can show how to verify the result after carrier approval.' },
      { question: 'Can a third-party service remove the financing balance?', answer: 'No legitimate carrier-unlock service can erase a valid debt or force an exception. It may help with carrier identification, evidence or an authorized request when a matching route exists.' },
    ],
  },
  {
    slug: 'net10-iphone-unlock-policy-records-guide',
    title: 'Net10 iPhone Unlock: Policy Guide',
    heading: 'Net10 iPhone Unlock: Which Policy and Record Apply?',
    description: 'Plan a Net10 iPhone unlock by separating Net10-sold, bring-your-own, replacement and legacy devices before checking current policy.',
    standfirst: 'A Net10 label does not prove that Net10 placed the carrier lock. The purchase, activation and replacement records determine which support route owns the request.',
    published: '2026-10-05',
    updated: '2026-10-05',
    minutes: 8,
    topic: 'Net10 iPhone unlock',
    blocks: [
      { kind: 'p', text: 'For a Net10 iPhone unlock, first determine whether Net10 sold the device, the phone was brought from another carrier, or the IMEI changed during a replacement. Net10’s current site directs customers to a centralized TracFone Wireless unlocking policy, so old forum timelines or unlock-code instructions may not match the record attached to your iPhone today.', links: [{ label: 'Check the current TracFone Wireless unlocking policy', href: 'https://www.tfwunlockpolicy.com/wps/portal/home' }, { label: 'Open Net10 support', href: 'https://www.net10wireless.com/techsupport' }] },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'Check Carrier Lock before opening a request; No SIM restrictions means the iPhone is already carrier-unlocked.',
        'Use the current centralized policy linked by Net10 rather than copying an old waiting period from a forum or video.',
        'A bring-your-own iPhone that arrived locked normally has to be handled by the carrier that placed the lock.',
        'A replacement iPhone can have a different IMEI, so the support team may need both the old and replacement records.',
        'An iPhone carrier unlock is normally carrier authorization, not a reusable SMS code, SIM PIN or PUK.',
      ] },
      { kind: 'h2', id: 'identify-device-path', text: 'Identify which Net10 device path applies' },
      { kind: 'table', head: ['Device path', 'Best first evidence', 'Likely unlock owner'], rows: [
        ['Net10-sold iPhone', 'Net10 purchase and activation history for the current IMEI', 'Net10 or the centralized policy support route'],
        ['Bring-your-own iPhone', 'Original carrier receipt, account or financing record', 'Carrier that originally locked the device'],
        ['Second-hand iPhone used on Net10', 'Seller documentation and original carrier identification', 'Original locking carrier, not automatically Net10'],
        ['Warranty or insurance replacement', 'Old IMEI, replacement IMEI and replacement case number', 'Carrier or replacement program that must reconcile the records'],
        ['Already unlocked iPhone', 'No SIM restrictions in Settings', 'No unlock owner; troubleshoot activation or compatibility instead'],
      ] },
      { kind: 'note', text: 'Do not post the full IMEI, account PIN or one-time code in a public forum. Share device identifiers only through the official support or authorized service route that needs them.' },
      { kind: 'h2', id: 'check-before-request', text: 'Run these checks before requesting a Net10 unlock' },
      { kind: 'list', ordered: true, items: [
        'Open Settings, General, About and record the Carrier Lock result.',
        'Record the current IMEI and IMEI2 privately; note which identifier the active line uses.',
        'Find the purchase source, activation date, service history and any replacement documents.',
        'Decide whether the iPhone was Net10-sold, bring-your-own, second-hand or replaced.',
        'Read the current policy linked from Net10 and use its eligibility or contact route.',
        'If support cannot find the device, ask which IMEI and brand record it searched and provide the replacement link if one exists.',
        'After confirmation, reconnect the new SIM or eSIM and verify No SIM restrictions in Settings.',
      ] },
      { kind: 'p', text: 'Apple states that only the carrier can unlock an iPhone. It also says the carrier may take a few days to finish a request and that No SIM restrictions is the verification result in Settings, General, About. An email, SMS or support promise is not stronger evidence than the completed status on the device.', links: [{ label: 'Follow Apple’s current iPhone unlock steps', href: 'https://support.apple.com/en-us/109316' }, { label: 'Check whether the iPhone is already unlocked', href: '/articles/how-to-check-if-iphone-is-unlocked' }] },
      { kind: 'h2', id: 'current-policy', text: 'Use the policy version attached to the device record' },
      { kind: 'p', text: 'Net10’s current terms point to Verizon Value’s centralized unlocking policy, and the Net10 support site links customers to unlocking details. The policy page is dynamically rendered, so this guide does not reproduce a waiting-period number that may depend on purchase date, activation history or a later policy revision. Capture the policy result and support case on the day you check.', links: [{ label: 'Read Net10’s current terms and conditions', href: 'https://www.net10wireless.com/termsandconditions' }, { label: 'Use the current centralized unlocking policy', href: 'https://www.tfwunlockpolicy.com/wps/portal/home' }] },
      { kind: 'h3', id: 'byop-device', text: 'If the iPhone was brought to Net10' },
      { kind: 'p', text: 'Using a locked iPhone with a compatible Net10 line does not necessarily transfer ownership of the carrier lock to Net10. Identify where the iPhone was sold and financed, then contact that locking carrier. If Carrier Lock already says No SIM restrictions, the next problem is more likely activation, provisioning, network compatibility or account setup than an unlock.', links: [{ label: 'Find the carrier that controls the iPhone lock', href: '/articles/how-to-find-carrier-on-iphone-before-unlock' }] },
      { kind: 'h3', id: 'replacement-device', text: 'If the iPhone was replaced or repaired' },
      { kind: 'p', text: 'A warranty or insurance replacement normally receives a new IMEI. If the old device had the qualifying service history, support may need the replacement receipt or case number to connect that history to the new identifier. Do not submit repeated requests against both IMEIs without explaining the replacement; it can create two incomplete cases rather than one complete record.' },
      { kind: 'h2', id: 'code-confusion', text: 'Do not confuse an unlock code with the iPhone result' },
      { kind: 'table', head: ['Message or credential', 'What it controls', 'Correct route'], rows: [
        ['Carrier Lock restriction', 'Activation with another carrier', 'Carrier-side unlock policy and IMEI record'],
        ['SIM PIN or PUK', 'Security of one SIM or eSIM line', 'Carrier that issued that line'],
        ['iPhone passcode', 'Access to the device and its data', 'Apple’s passcode recovery process'],
        ['iPhone Locked to Owner', 'Activation Lock and ownership', 'Legitimate Apple Account ownership route'],
        ['No Service or SOS', 'Account, provisioning, coverage or device connection', 'Line carrier troubleshooting after checking Carrier Lock'],
      ] },
      { kind: 'p', text: 'Search results for Net10 unlock phone include code-related FAQs and third-party code offers, but an iPhone carrier unlock should be verified through Carrier Lock. A SIM PIN or PUK from the line issuer does not remove the iPhone’s carrier restriction, and a third party cannot bypass Activation Lock.', links: [{ label: 'See why an iPhone carrier unlock is not a generic code', href: '/articles/iphone-carrier-unlock-code-authorization-guide' }, { label: 'Separate Carrier Lock from SIM PIN', href: '/articles/sim-locked-iphone-carrier-lock-or-sim-pin' }] },
      { kind: 'h2', id: 'support-package', text: 'Prepare one complete support package' },
      { kind: 'list', items: [
        'Current Carrier Lock result and exact activation error, if any.',
        'Current IMEI or IMEI2, shared privately.',
        'Net10 purchase or activation record when Net10 supplied the iPhone.',
        'Original carrier and seller record for a bring-your-own or second-hand device.',
        'Old and new IMEIs plus the case number for a replacement device.',
        'Date, channel and reference number for each prior request.',
      ] },
      { kind: 'cta', text: 'Have the Carrier Lock result and know whether the iPhone was Net10-sold, brought in or replaced? Send a redacted summary so we can help route the record correctly.', href: '/contact', label: 'Check the Net10 unlock route' },
    ],
    faq: [
      { question: 'How do I request a Net10 iPhone unlock?', answer: 'Check Carrier Lock, identify how the iPhone entered Net10 service, gather the purchase and activation records, then use the current centralized unlocking policy linked by Net10.' },
      { question: 'How long does a Net10 iPhone unlock take?', answer: 'The applicable waiting period and processing time depend on the current policy and the device record. Use the live policy and ask support for a case reference rather than relying on an old forum number.' },
      { question: 'Can Net10 unlock an iPhone I brought from another carrier?', answer: 'Usually the carrier that placed the lock must handle it. Identify the original carrier through purchase, account or IMEI evidence and submit the request there.' },
      { question: 'What if Net10 cannot find the replacement iPhone?', answer: 'Provide the original and replacement IMEIs plus the warranty or insurance case number so support can determine whether qualifying history must be linked to the new device record.' },
      { question: 'Does Net10 send an iPhone unlock code?', answer: 'An iPhone carrier unlock is normally carrier-side authorization verified by No SIM restrictions. Do not confuse it with a SIM PIN, PUK, passcode or Activation Lock credential.' },
    ],
  },
  {
    slug: 'invalid-sim-iphone-carrier-lock-or-sim-failure',
    title: 'Invalid SIM on iPhone: Unlock or SIM Fix?',
    heading: 'Invalid SIM on iPhone: Carrier Lock or SIM Failure?',
    description: 'Fix an invalid SIM on iPhone by separating carrier lock, plan, eSIM, physical SIM and hardware issues before requesting an unlock.',
    standfirst: 'An Invalid SIM or SIM Failure alert does not automatically mean the iPhone needs a carrier unlock. One Settings check separates that path from line, SIM and device troubleshooting.',
    published: '2026-10-04',
    updated: '2026-10-04',
    minutes: 9,
    topic: 'Invalid SIM on iPhone',
    blocks: [
      { kind: 'p', text: 'An invalid SIM on iPhone can come from a carrier restriction, an inactive line, an eSIM provisioning problem, a physical SIM or tray issue, or a device fault. Do not buy an unlock based on the alert alone. Apple’s current troubleshooting starts with the active plan and Carrier Lock status, then separates eSIM from physical-SIM checks.', links: [{ label: 'Follow Apple’s Invalid SIM and No SIM checklist', href: 'https://support.apple.com/en-us/108914' }] },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'Open Settings, General, About first: No SIM restrictions means Carrier Lock is not causing the alert.',
        'Confirm that the affected line has an active plan before changing device settings or paying for an unlock.',
        'For eSIM, ask the line carrier to verify the plan, installed profile and IMEI or IMEI2 used for activation.',
        'For a physical SIM, reseat the correct tray and test another known-working SIM through the carrier when possible.',
        'Invalid SIM, SIM Failure, SIM Not Supported, Locked SIM and iPhone Locked to Owner are different messages with different owners.',
      ] },
      { kind: 'h2', id: 'identify-message', text: 'Identify the exact message before choosing a fix' },
      { kind: 'table', head: ['Message or status', 'Likely route to check first', 'Does a carrier unlock fix it?'], rows: [
        ['Invalid SIM or No SIM', 'Plan, Carrier Lock, carrier settings, eSIM provisioning or physical SIM', 'Only if Carrier Lock still shows a restriction'],
        ['SIM Failure', 'Line provisioning, SIM or eSIM profile, and device diagnostics', 'Not unless Carrier Lock confirms a restriction'],
        ['SIM Not Supported during activation', 'Carrier Lock and the locking carrier’s authorization', 'Possibly, when the device is still carrier-locked'],
        ['Locked SIM, SIM PIN or PUK prompt', 'Issuer of that physical SIM or eSIM', 'No; this is line security, not Carrier Lock'],
        ['SOS or No Service', 'Coverage, account, outage, provisioning and compatibility', 'Not when Carrier Lock says No SIM restrictions'],
        ['iPhone Locked to Owner', 'Legitimate Apple Account ownership process', 'No; this is Activation Lock'],
      ] },
      { kind: 'note', text: 'Take a screenshot of the exact alert and the Carrier Lock field before resetting anything. Redact the phone number, full IMEI, EID and account information before sharing it.' },
      { kind: 'h2', id: 'carrier-lock-fork', text: 'Use Carrier Lock as the first decision point' },
      { kind: 'list', ordered: true, items: [
        'Open Settings.',
        'Tap General, then About.',
        'Find Carrier Lock.',
        'If it says No SIM restrictions, skip unlock services and troubleshoot the line, SIM or eSIM.',
        'If it shows a restriction, identify the carrier that controls the device record and ask whether the IMEI is eligible.',
      ] },
      { kind: 'p', text: 'Apple states that No SIM restrictions means the iPhone is unlocked and that only the carrier can approve a carrier unlock. Apple cannot submit the request for the carrier. A third-party service can help organize the device record or route an authorized request when a matching service exists, but it cannot turn every Invalid SIM alert into an unlock approval.', links: [{ label: 'Read Apple’s carrier-unlock instructions', href: 'https://support.apple.com/en-us/109316' }, { label: 'Learn how to check whether an iPhone is unlocked', href: '/articles/how-to-check-if-iphone-is-unlocked' }] },
      { kind: 'h2', id: 'official-triage', text: 'Run the official triage in a safe order' },
      { kind: 'list', ordered: true, items: [
        'Confirm that the wireless plan for the affected line is active.',
        'Check Carrier Lock in Settings, General, About.',
        'Restart the iPhone.',
        'Return to Settings, General, About and install a carrier-settings update if prompted.',
        'For eSIM, contact the carrier that issued the line and ask it to verify provisioning.',
        'For a physical SIM, power down if directed, reseat the SIM in the correct tray and make sure the tray closes fully.',
        'Ask the carrier to test another SIM or replace the SIM if the alert continues.',
        'If the alert remains after the carrier and SIM checks, use Apple’s service route for device diagnosis.',
      ] },
      { kind: 'h3', id: 'esim-branch', text: 'If the affected line uses eSIM' },
      { kind: 'p', text: 'Do not delete the eSIM profile as a first experiment. Record the line label, carrier name, IMEI or IMEI2 and EID, then ask the carrier whether the plan is active and which IMEI it provisioned. A carrier-locked iPhone may reject another carrier’s eSIM, but an unlocked iPhone can still show a failure when the new line was attached to the wrong identifier or the profile is incomplete.', links: [{ label: 'Use the eSIM unlock and setup decision guide', href: '/articles/how-to-unlock-esim-on-iphone' }] },
      { kind: 'h3', id: 'physical-sim-branch', text: 'If the affected line uses a physical SIM' },
      { kind: 'p', text: 'Inspect the physical SIM and tray without forcing either part. Apple warns that a tray from another iPhone model or manufacturer might not fit correctly. A known-working SIM test can separate a damaged or inactive SIM from a device-side issue, but use the carrier’s support or retail route so the test line and replacement are properly provisioned.', links: [{ label: 'Review Apple’s physical-SIM checks', href: 'https://support.apple.com/en-us/108914' }] },
      { kind: 'h2', id: 'avoid-wrong-fixes', text: 'Avoid fixes that target the wrong lock' },
      { kind: 'table', head: ['Action', 'Why it can be the wrong move'], rows: [
        ['Buying an IMEI unlock immediately', 'The alert may come from the line, SIM, eSIM or device rather than Carrier Lock'],
        ['Guessing a SIM PIN or PUK', 'Wrong attempts can permanently block the SIM or eSIM and require replacement'],
        ['Factory-resetting before diagnosis', 'It does not create carrier eligibility and can erase useful evidence or eSIM setup'],
        ['Deleting the eSIM without a replacement plan', 'The carrier may need to reissue the profile before service can return'],
        ['Assuming No SIM restrictions means the line must work', 'Unlock status does not guarantee account activation, provisioning, coverage or compatibility'],
      ] },
      { kind: 'p', text: 'Apple says a SIM PIN protects cellular use on one SIM or eSIM and warns not to guess a PIN or PUK. That security is separate from Carrier Lock. If the status bar says Locked SIM or a PUK prompt appears, contact the issuer of that line instead of the device-lock carrier.', links: [{ label: 'See Apple’s SIM PIN and PUK guidance', href: 'https://support.apple.com/en-us/118228' }, { label: 'Compare Carrier Lock with SIM PIN', href: '/articles/sim-locked-iphone-carrier-lock-or-sim-pin' }] },
      { kind: 'h2', id: 'prepare-escalation', text: 'Prepare a useful carrier or service case' },
      { kind: 'list', items: [
        'Exact alert text and when it appears: startup, activation, after an update or after changing carriers.',
        'Carrier Lock result from Settings, General, About.',
        'Physical SIM or eSIM, plus the carrier that issued the affected line.',
        'Whether the plan is active and whether another SIM or line works in the iPhone.',
        'IMEI or IMEI2 used by the carrier, shared privately rather than posted publicly.',
        'Recent carrier-settings update, eSIM transfer, SIM replacement, repair or device replacement history.',
      ] },
      { kind: 'cta', text: 'Have an Invalid SIM alert and the Carrier Lock result? Send a redacted summary so we can help separate an unlock request from SIM, eSIM or device troubleshooting.', href: '/contact', label: 'Check the correct support route' },
    ],
    faq: [
      { question: 'Does Invalid SIM mean my iPhone is carrier-locked?', answer: 'Not by itself. Check Settings, General, About. If Carrier Lock says No SIM restrictions, troubleshoot the plan, carrier settings, SIM or eSIM and device instead of buying an unlock.' },
      { question: 'What is the difference between Invalid SIM and SIM Not Supported?', answer: 'Invalid SIM can involve the line, SIM, eSIM profile, settings or device. SIM Not Supported during activation more directly points to a carrier restriction or activation mismatch, so check Carrier Lock and the original carrier.' },
      { question: 'Can an eSIM cause an Invalid SIM or SIM Failure alert?', answer: 'An eSIM line can fail when the plan or profile is not active or is provisioned to the wrong device identifier. Ask the issuing carrier to verify the line, profile and IMEI or IMEI2.' },
      { question: 'Will a factory reset fix Invalid SIM on iPhone?', answer: 'Do not reset first. Confirm the plan, Carrier Lock, carrier-settings update and SIM or eSIM provisioning. A reset cannot create carrier-unlock approval and may remove useful setup evidence.' },
      { question: 'Who should I contact if the alert remains?', answer: 'Contact the line carrier for plan, SIM and eSIM checks; contact the locking carrier only if Carrier Lock shows a restriction. If the alert remains after those checks, follow Apple’s device-service route.' },
    ],
  },
  {
    slug: 'iphone-carrier-unlock-code-authorization-guide',
    title: 'iPhone Carrier Unlock Code: Is There One?',
    heading: 'iPhone Carrier Unlock Code: Does an iPhone Use One?',
    description: 'Learn why an iPhone carrier unlock code is usually the wrong route, how carrier authorization works and which PIN or passcode prompt you see.',
    standfirst: 'iPhones do not normally expose a field for a generic network-unlock code. The correct route depends on whether the prompt is Carrier Lock, a passcode, SIM PIN, PUK or Activation Lock.',
    published: '2026-10-04',
    updated: '2026-10-04',
    minutes: 8,
    topic: 'iPhone carrier unlock code',
    blocks: [
      { kind: 'p', text: 'If you are searching for an iPhone carrier unlock code, first check the exact restriction. For a carrier-locked iPhone, Apple directs you to the carrier rather than to a code-entry screen. The carrier approves the device record, and Settings confirms the result with No SIM restrictions.', links: [{ label: 'Read Apple’s current carrier-unlock process', href: 'https://support.apple.com/en-us/109316' }] },
      { kind: 'h2', id: 'key-takeaways', text: 'Key Takeaways' },
      { kind: 'list', items: [
        'A carrier unlock for iPhone is normally an authorization tied to the device record, not a universal numeric code.',
        'Only the carrier controlling the lock can approve the change; Apple cannot approve it for the carrier.',
        'No SIM restrictions in Settings, General, About is the on-device confirmation that Carrier Lock is removed.',
        'A screen passcode, SIM PIN, PUK and Apple Account credential are not carrier-unlock codes.',
        'Do not pay a provider that promises a secret code without naming the restriction, carrier and verifiable result.',
      ] },
      { kind: 'h2', id: 'identify-code', text: 'Identify which code or lock the iPhone is asking about' },
      { kind: 'table', head: ['What you see', 'What it controls', 'Correct owner or route'], rows: [
        ['Carrier Lock shows a restriction', 'Use with another mobile carrier', 'Carrier that controls the device record'],
        ['Enter iPhone Passcode or iPhone Unavailable', 'Access to data and the device', 'Apple’s documented passcode-reset process'],
        ['Locked SIM or Enter SIM PIN', 'Use of one physical SIM or eSIM line', 'Carrier that issued that line'],
        ['Enter PUK or PUK exhausted', 'Recovery after failed SIM PIN attempts', 'SIM or eSIM issuer; replacement may be required'],
        ['iPhone Locked to Owner', 'Activation Lock and ownership', 'Legitimate Apple Account owner or Apple’s documented process'],
        ['SIM Not Supported', 'Carrier restriction or activation mismatch', 'Check Carrier Lock, then the locking carrier'],
      ] },
      { kind: 'note', text: 'Never enter a code supplied by a stranger into an unfamiliar prompt. Save the exact wording and verify the official recovery owner before sharing account or device information.' },
      { kind: 'h2', id: 'carrier-authorization', text: 'How iPhone carrier-unlock authorization works' },
      { kind: 'list', ordered: true, items: [
        'Open Settings, General, About and record the Carrier Lock status.',
        'Identify the carrier that controls the lock using the purchase, account, financing or replacement record.',
        'Review that carrier’s current eligibility rules for the specific IMEI and account type.',
        'Submit the request through the carrier or an authorized route and keep the case reference.',
        'Wait for the carrier to confirm that its request is complete.',
        'Reconnect or activate the new SIM or eSIM, then verify that Carrier Lock says No SIM restrictions.',
      ] },
      { kind: 'p', text: 'Apple says only the carrier can unlock the iPhone and notes that a request may take the carrier time to complete. If another carrier’s physical SIM is available after approval, inserting it can finish activation. If no o…92880 tokens truncated…
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
