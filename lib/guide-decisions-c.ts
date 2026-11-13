// The steps describe the evidence a reader can collect, its limits, and who can act on it.
export const decisionsC: Record<string, readonly [string, string, string]> = {
  'walmart-family-mobile-iphone-unlock-guide': [
    'Check the line item on your Walmart receipt: was it a Family Mobile iPhone, or just a SIM kit for a phone bought elsewhere?',
    'Buying a Family Mobile plan at Walmart does not identify the carrier that locked a separately purchased phone.',
    'For a Family Mobile handset, ask support for the eligibility decision against its IMEI. For a SIM kit, trace the phone back to its seller first.',
  ],
  'sell-locked-iphone-carrier-lock-checklist': [
    'Read Carrier Lock under Settings → General → About before writing the listing. Use the wording you see and disclose any carrier you can verify.',
    'A buyer seeing “No SIM restrictions” still has no evidence that your Apple Account has been removed.',
    'If the phone remains network-locked, price and describe it that way. Before handover, finish Apple’s sign-out and erase steps and verify the buyer can start setup.',
  ],
  'consumer-cellular-iphone-unlock-eligibility': [
    'Find the device purchase entry, not just a Consumer Cellular monthly bill. Check whether Consumer Cellular supplied the handset.',
    'Successful service with Consumer Cellular does not give it authority to unlock a phone another carrier sold.',
    'If it was their device, have Consumer Cellular check the payoff and unlock record. If you brought the phone, take the request to the carrier responsible for the original lock.',
  ],
  'simple-mobile-iphone-unlock-policy-status': [
    'Find the first Simple Mobile activation date for this handset and compare it with the dates in the carrier’s published unlocking policy.',
    'The age of your phone number does not establish how much qualifying service this particular device has received.',
    'If your handset falls near a policy change or replaced another phone on the line, ask Simple Mobile which rule and activation date it applied before making another request.',
  ],
  'tracfone-iphone-unlock-current-policy-checklist': [
    'Collect the original packaging or sale record and the first activation notice for the iPhone you want TracFone to release.',
    'A TracFone SIM working today does not establish that the phone was sold locked to TracFone or that its release date has arrived.',
    'Ask the unlocking department to check that device record. If it cannot find the IMEI, resolve the original seller or a replacement-device mismatch before counting service days.',
  ],
  'iphone-unlocked-but-no-service-troubleshooting': [
    'Check Carrier Lock in About, then confirm that the intended line is turned on under Cellular. Note whether the status bar reads SOS or No Service.',
    '“No SIM restrictions” clears the network-lock question; it does not activate an eSIM or rule out an outage.',
    'If the line is on and still has no service, ask the destination carrier to check local coverage, account status and provisioning against the IMEI assigned to that line.',
  ],
  'us-cellular-iphone-unlock-support-route': [
    'Find the old UScellular device invoice and note which support account shows the line today.',
    'A change of support brand does not prove which unlock policy applies to the original sale or that a legacy request was completed.',
    'Give the current support team the original sale details and any existing case number. Ask it to locate the legacy IMEI record before submitting a second request.',
  ],
  'blacklisted-iphone-unlock-carrier-lock-difference': [
    'Ask to see the handset’s Carrier Lock field, then check the same IMEI in the official lost-or-stolen device checker available in your market.',
    'An unlocked phone can still be blocked. A clear registry result describes that check, not future reports or the seller’s ownership.',
    'If the lookup shows a block, pause the purchase. A disputed report belongs with the reporting carrier and account holder; a SIM unlock cannot clear it.',
  ],
  'total-wireless-iphone-unlock-policy-checklist': [
    'Write down the Total Wireless purchase date, first activation and any gaps in paid service for this phone.',
    'A paid-in-full receipt establishes a sale, not how much qualifying service the carrier recorded.',
    'If Total Wireless gives an unexpected eligibility date, ask which entry in that timeline differs from its records and follow up on the same case.',
  ],
  'sim-locked-iphone-carrier-lock-or-sim-pin': [
    'Look at where the message appears: a PIN or PUK prompt for a line is different from the Carrier Lock field under General → About.',
    'A request for the SIM PIN does not mean the handset is restricted to that network.',
    'For a PIN or PUK prompt, stop entering guesses and contact the SIM issuer. For a restriction recorded in About, contact the carrier that controls the handset lock.',
  ],
  'visible-iphone-unlock-365-day-policy': [
    'Use your Visible payment history to identify periods of paid service for the phone bought from Visible, including any interruption.',
    'A year since purchase does not establish a year of qualifying paid service.',
    'If the paid-service total meets the rule for your purchase, request release from Visible. If its date differs, ask which period it excluded.',
  ],
  'spectrum-mobile-iphone-unlock-paid-off': [
    'Compare the Spectrum payoff receipt with the device shown on your account and note the current Carrier Lock reading.',
    'Payoff, eligibility, approval and a completed release are separate; the receipt confirms only the payment.',
    'If Settings still shows a lock, ask Spectrum which stage is pending for that handset. Keep the case reference and recheck About after completion.',
  ],
  'metropcs-iphone-unlock-365-day-policy': [
    'Find the original Metro activation date for the handset and compare it with the current Metro unlocking instructions.',
    'The date on a second-hand sale receipt is not the original Metro activation date.',
    'If Metro and the seller give different dates, request the carrier’s eligibility date for this device before promising a switch or buying another SIM.',
  ],
  'iphone-carrier-unlock-free-costs': [
    'Ask the carrier for an itemized explanation: what is the device payoff, the outstanding service bill and the charge, if any, for the unlock itself?',
    'A zero unlock fee does not cancel financing or cover the cost of a new plan.',
    'If the carrier can release the eligible phone free, use that route. If it quotes a balance, verify whose account owes it before paying a seller or intermediary.',
  ],
  'boost-mobile-iphone-unlock-policy-guide': [
    'Use the original Boost purchase agreement to establish whether the handset was prepaid or postpaid and whether it was financed.',
    'A Boost logo or the current plan name cannot establish that the original financing or prepaid service requirement was met.',
    'For a postpaid handset, ask Boost to verify payoff and release status. For prepaid, ask it to check the device’s activation and qualifying service before escalating.',
  ],
  'xfinity-mobile-iphone-unlock-policy-guide': [
    'In the Xfinity Mobile account, check the device payoff and activation date, then check whether the associated account has an overdue balance.',
    'A zero installment balance on the phone is not the same as an account in good standing or a completed automatic release.',
    'If the requirements appear met and the phone is still locked, give Xfinity the payoff confirmation and IMEI and ask it to trace the automatic unlock.',
  ],
  'iphone-locked-to-owner-legitimate-fixes': [
    'Read the setup screen. “iPhone Locked to Owner” identifies Activation Lock; ask the seller to remove the device from their Apple Account.',
    'A clean IMEI report or a different SIM does not establish that the previous Apple Account has been detached.',
    'For a used purchase, restart setup after the seller removes the phone. If it still asks for their credentials, do not complete the purchase.',
  ],
  'imei-unlock-iphone-service-checklist': [
    'Ask the seller of the service to specify in writing whether the quote buys a status report, a request submission or a carrier release.',
    'Handing over an IMEI or receiving an order number proves neither carrier eligibility nor completion.',
    'If the scope, total charge or refusal terms are missing, do not order. Check the responsible carrier’s official route first.',
  ],
  'verizon-iphone-unlock-current-policy': [
    'Identify the original Verizon purchase and whether it was postpaid or prepaid before comparing it with the published policy.',
    'A waiting period remembered from another Verizon phone does not establish the release date for this one.',
    'Have Verizon check the payoff record for a postpaid phone or the qualifying paid-service record for prepaid. After release, check the new provider’s compatibility separately.',
  ],
  'how-to-unlock-esim-on-iphone': [
    'Copy the exact alert before deleting an eSIM: does it ask for a PIN, reject the network, or say the new plan could not activate?',
    'An eSIM download failure alone does not prove that a network lock is present.',
    'Send a PIN problem to the issuing carrier. If About shows no SIM restrictions, ask the new provider to verify the eSIM assignment rather than requesting a handset unlock.',
  ],
  'unlock-iphone-for-international-use-travel-checklist': [
    'Decide whether you will roam on your existing line or install another provider’s SIM. For the second option, read Carrier Lock before buying the plan.',
    'An unlocked handset is not proof that its regional model supports the destination carrier or that the travel plan has started.',
    'For roaming, confirm coverage and fees with your home carrier. For a local or travel plan, check the model, SIM format and activation instructions with that provider.',
  ],
  'iphone-sim-not-supported-after-switching-carriers': [
    'Record the exact alert and compare the handset IMEI with the IMEI in the original carrier’s release confirmation.',
    '“SIM Not Supported”, “No SIM” and “SOS” are not interchangeable evidence of a failed unlock.',
    'If the release refers to a different device, return to the original carrier. If the correct handset shows no SIM restrictions, have the new provider check its physical SIM or eSIM provisioning.',
  ],
  'how-to-check-if-iphone-is-unlocked': [
    'With the phone in hand, open Settings → General → About and look for “No SIM restrictions” under Carrier Lock.',
    'Failure to connect on a second SIM is not the opposite test: an inactive line or unsupported model can also fail.',
    'If About shows no restrictions, check the destination carrier’s compatibility. If you cannot inspect a used phone, ask the seller to show that screen before relying on a dated report.',
  ],
  'straight-talk-iphone-unlock-request-checklist': [
    'Separate the Straight Talk handset receipt from a SIM or airtime purchase and read the device’s current lock status.',
    'An airtime receipt does not show who sold the iPhone or who can authorize its release.',
    'For a Straight Talk handset, ask for a device-specific eligibility review using the purchase and service records. For bring-your-own, trace the handset’s original carrier.',
  ],
  'cricket-iphone-unlock-purchase-date-rules': [
    'Match the handset purchase date to Cricket’s dated instructions and gather the paid-service history of that same device.',
    'An old Cricket receipt establishes a purchase date; it does not prove continuous qualifying service.',
    'If the dated rule and the eligibility response seem inconsistent, ask Cricket to identify the rule it used and any missing service period before resubmitting.',
  ],
  't-mobile-iphone-unlock-status-esim': [
    'Compare the unlock status for the exact device on your T-Mobile line with Carrier Lock on the iPhone.',
    'An “eligible” account entry means the phone can qualify; it does not confirm that Apple’s activation policy has already changed.',
    'If the account says eligible but About still shows a restriction, give T-Mobile both readings and ask it to confirm completion before buying a travel eSIM.',
  ],
  'att-iphone-unlock-request-status': [
    'Find the AT&T request number and the confirmation email, then use the official status checker with the matching device identifier.',
    'A submitted request is not approval. Starting another request will not satisfy a missing confirmation or correct an unpaid installment.',
    'If confirmation is pending, follow AT&T’s email instructions. If refused, resolve the specific reason given; if approved, verify Carrier Lock on the handset.',
  ],
  'iphone-carrier-unlock-eligibility': [
    'Identify the original carrier, plan type and first activation date. Check the carrier’s current rules against those facts for this handset.',
    'A clear lost-or-stolen check cannot confirm the carrier’s financing or service history requirements.',
    'Ask for the exact unmet condition if the carrier declines. If the phone already shows “No SIM restrictions”, skip the unlock and check the new network’s compatibility.',
  ],
  'what-an-imei-check-tells-you': [
    'Read the report’s field names and check time: model identification, network lock and lost-or-stolen status answer different questions.',
    'A valid IMEI cannot tell you where the phone is, who owns it or what is stored on it. An omitted result is not a clean result.',
    'If a model matches but blocklist status is absent, use a lost-or-stolen checker for that specific question rather than inferring a pass.',
  ],
  'network-unlock-explained': [
    'Check whether the handset is restricted to one mobile network before asking for a release from the carrier that controls it.',
    'Releasing a network lock does not clear account debt, erase a theft report or remove an Apple Account from a device.',
    'If a request is refused, use the reason in the carrier’s response to decide what can be corrected. If approved, confirm the restriction is gone before changing plans.',
  ],
  'checks-before-buying-a-used-phone': [
    'Match the IMEI on the phone to the one the seller supplied and check what the device shows during setup before handing over money.',
    'A matching number or a clear report does not prove the seller can remove an existing owner’s account.',
    'Walk away if the identifier differs or the previous owner cannot release the device. If those checks pass, verify lost-or-stolen status and compatibility before paying.',
  ],
}
