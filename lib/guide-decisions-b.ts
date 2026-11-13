// Each entry follows the decision the reader came to make: first check, limit of that evidence, next action.
export const decisionsB: Record<string, readonly [string, string, string]> = {
  'vodafone-uk-iphone-unlock-guide': [
    'Open Settings → General → About and read Network Provider Lock before filling in a Vodafone form.',
    'A Vodafone SIM in the tray identifies the line. It does not show that Vodafone UK supplied or locked the handset.',
    'If you see No SIM restrictions, go straight to checking your next plan. If it is restricted, check the sales record before asking Vodafone to release it.',
  ],
  'are-replacement-iphones-unlocked': [
    'Read Carrier Lock on the replacement handset and compare its IMEI with the number on the exchange paperwork.',
    'An unlock email for the phone you handed back is evidence about that phone. The replacement has a different device record.',
    'If the new handset shows a restriction, give the carrier the exchange reference and both device identifiers privately so it can reconcile the records.',
  ],
  'can-apple-unlock-my-iphone-carrier-lock': [
    'Read the label on the screen: Carrier Lock in About and iPhone Locked to Owner at setup need different kinds of help.',
    'An Apple appointment or proof of purchase does not give Apple authority to approve a network unlock.',
    'For Carrier Lock, contact the carrier controlling the restriction. For a previous owner’s Apple Account at setup, ask the seller to remove the device from that account.',
  ],
  'does-changing-sim-card-unlock-iphone': [
    'Check the Carrier Lock row before inserting a working SIM from a different compatible carrier.',
    'Changing the SIM changes the line you are testing. It does not write a new unlock decision to the phone’s carrier record.',
    'If About says No SIM restrictions but the new SIM fails, test the SIM and plan with its issuer before requesting an unlock.',
  ],
  'does-unlocking-iphone-erase-data': [
    'Check whether the carrier has actually approved the unlock and whether you have another compatible SIM to activate with.',
    'A carrier approval concerns network access. It is neither an erase command nor a backup of your photos and messages.',
    'With approval and another SIM, try activation first. If following Apple’s erase-and-restore route without another SIM, make and verify a backup before erasing.',
  ],
  'does-unlocking-iphone-cancel-service': [
    'Decide whether you want a second line or want to move your existing number. Check the old line’s status in your account.',
    'An unlocked phone can still have an active, billable line. Unlock approval is not a cancellation or number-transfer receipt.',
    'To keep your number, start the port with the receiving carrier while the old line is active; check the final bill separately once the transfer completes.',
  ],
  'does-unlocking-iphone-void-warranty': [
    'Keep the carrier’s written unlock confirmation and identify the actual fault for which you need warranty service.',
    'No SIM restrictions describes network permission. It does not tell you whether a particular repair is covered.',
    'For a hardware claim, take the fault description and purchase or repair record to the warranty provider; for a rejected SIM, investigate the carrier record first.',
  ],
  'carrier-lock-not-showing-on-iphone': [
    'Look in Settings → General → About, not under your cellular plan. Note the exact wording you see and the iOS version.',
    'A missing row is not the same result as No SIM restrictions. The network name in the status bar cannot fill that gap.',
    'If the field remains absent, ask the carrier to confirm the record for this handset before you buy a replacement plan.',
  ],
  'iphone-dual-sim-two-carriers-unlock-guide': [
    'Check Carrier Lock and the SIM combination supported by your exact iPhone model before activating a second plan.',
    'Support for two lines does not mean those lines can come from two different carriers while the handset is locked.',
    'If there is no SIM restriction, check eSIM or physical SIM support with the second carrier. If you keep both lines with one carrier, check that carrier’s Dual SIM options.',
  ],
  'can-unlocked-iphone-be-locked-again': [
    'Compare today’s Carrier Lock result and IMEI with the original approval; check whether the handset was replaced between tests.',
    'A No Service or Invalid SIM alert alone does not demonstrate that a carrier reversed an unlock.',
    'If the same IMEI now shows a restriction, send the earlier approval to the carrier. If it still says No SIM restrictions, check the new line and activation instead.',
  ],
  'factory-unlocked-iphone-meaning-buyer-checklist': [
    'Ask the seller to show Carrier Lock on the actual handset in Settings, rather than a screenshot of the listing.',
    'No SIM restrictions shows the present state. It cannot distinguish an iPhone sold unlocked from one unlocked later, or prove the seller owns it.',
    'If the handset is already unlocked, skip buying another unlock and verify that it activates without the previous owner and that your intended carrier accepts it.',
  ],
  'how-long-does-iphone-carrier-unlock-take': [
    'Find the last dated carrier message. Does it say the device is eligible, a request was received, or the unlock was approved?',
    'Days since purchase or payoff are not necessarily days spent processing a complete request. An approval can also precede device activation.',
    'Follow a pending case using its reference number. If it already says approved, check the phone’s Carrier Lock row before opening a second request.',
  ],
  't-mobile-temporary-unlock-iphone-travel-guide': [
    'Before buying a travel eSIM, check Carrier Lock on your iPhone and distinguish a new local plan from roaming on your T-Mobile line.',
    'A temporary-unlock menu described for a different handset is not evidence that your iPhone has that option.',
    'If the iPhone is restricted, ask T-Mobile about eligibility before buying a foreign plan; if you intend to roam instead, check your existing plan’s destination coverage and rates.',
  ],
  'unlock-iphone-without-sim-card-after-approval': [
    'Locate the carrier’s confirmation for this IMEI. You can ask for that confirmation without having a spare SIM.',
    'Not having another SIM changes the activation steps available to you, not whether the carrier authorized the unlock.',
    'After confirmed approval, check Carrier Lock. If completion is still needed and no other SIM is available, verify a backup before following Apple’s erase-and-restore instructions.',
  ],
  'can-you-unlock-financed-iphone-before-payoff': [
    'Read Carrier Lock on the phone, then check the remaining device balance on the original purchase account if you have access.',
    'A paid wireless bill is not a device payoff receipt. Even a zero device balance does not prove all carrier conditions are met.',
    'If buying second-hand, ask the seller to obtain eligibility confirmation from their carrier before you pay them or agree to settle an installment balance.',
  ],
  'net10-iphone-unlock-policy-records-guide': [
    'Check the original receipt and first activation record: did Net10 supply the iPhone, or did the owner bring it to Net10?',
    'An active Net10 number does not show that Net10 sold the handset or controls its lock.',
    'For a supplied device, verify the applicable policy against its activation record. For a bring-your-own phone, trace the earlier seller or carrier instead of counting Net10 service days.',
  ],
  'invalid-sim-iphone-carrier-lock-or-sim-failure': [
    'Record whether the alert says Invalid SIM, SIM Failure or Locked SIM, then check the Carrier Lock field and whether the line is active.',
    'The error message alone cannot tell you whether the handset is carrier-locked, the SIM is faulty or the line has not been provisioned.',
    'With No SIM restrictions, ask the line provider to test the physical SIM or verify the eSIM profile. For a SIM PIN or PUK prompt, contact the SIM issuer before entering more codes.',
  ],
  'iphone-carrier-unlock-code-authorization-guide': [
    'Read the exact prompt before entering anything: a SIM PIN, a PUK and the screen passcode protect different things.',
    'A seller advertising a generic unlock code has not shown that the carrier approved a network unlock for this iPhone.',
    'For a SIM PIN or PUK, use the issuing carrier’s recovery route. For a network restriction in About, request authorization from the carrier that controls the device record.',
  ],
  'will-factory-reset-unlock-iphone-carrier': [
    'Check Carrier Lock and find the carrier’s actual approval before using Erase All Content and Settings.',
    'Seeing the Hello screen after a reset proves the phone was erased. It says nothing about whether the carrier released it.',
    'Without approval, follow up with the carrier and leave your data intact. If already approved, try activation with a compatible SIM before considering a backed-up erase and restore.',
  ],
  'us-mobile-unlock-policy-iphone-guide': [
    'Locate the device purchase confirmation, not just your US Mobile plan receipt, and read the terms attached to that sale.',
    'Using a US Mobile line or passing a compatibility check does not establish who placed a restriction on a used iPhone.',
    'For a US Mobile purchase, ask about that order’s terms. For a bring-your-own phone with a restriction, use its earlier sales record to identify the right carrier.',
  ],
  'c-spire-iphone-unlock-policy-guide': [
    'Find the C Spire device sale and determine whether the line was postpaid or no-contract before counting days or billing cycles.',
    'Time since you bought the phone second-hand is not evidence of the paid service cycles or activation history on the requesting line.',
    'Have C Spire match the IMEI to the correct policy route. If it was another carrier’s device brought to C Spire, return to that carrier for the unlock decision.',
  ],
  'assurance-wireless-iphone-unlock-policy': [
    'Look for an Assurance device shipment or purchase record rather than relying on the SIM or your Lifeline enrollment.',
    'Eligibility for the wireless program is not unlock eligibility for the handset; a phone brought from another carrier keeps its separate history.',
    'For an Assurance-supplied handset, check its activation record and any unlock notification. For a bring-your-own phone, identify the carrier that restricted it.',
  ],
  'airtalk-wireless-iphone-unlock-policy': [
    'Find the terms issued with the handset and note whether your question concerns ownership, a management profile or Carrier Lock in About.',
    'Completing a period specified for ownership or management controls does not itself authorize use on another carrier.',
    'For an AirTalk-supplied phone, ask which terms apply to that order before paying for an unlock. For your own imported handset, check its original carrier and AirTalk compatibility separately.',
  ],
  'puretalk-unlock-policy-iphone-guide': [
    'Compare the PureTalk order record with the iPhone in hand and read Carrier Lock under Settings → General → About.',
    'A positive PureTalk compatibility result concerns network support; it cannot confirm that the phone is free of another carrier’s lock.',
    'If a PureTalk-sold phone reports a restriction, ask PureTalk to check the order and IMEI. If the phone came from elsewhere, consult its original carrier.',
  ],
  'safelink-iphone-unlock-policy-guide': [
    'Identify the device’s source first: a SafeLink-supplied phone, a personal T-Mobile phone or another bring-your-own handset.',
    'SafeLink Line Lock protects changes to the line. Disabling it does not release Carrier Lock on the iPhone.',
    'For a personal T-Mobile handset, use the device unlock route for that carrier. For another BYOP handset, check the existing lock and compatibility before starting SafeLink activation.',
  ],
  'red-pocket-iphone-unlock-policy-guide': [
    'Open the original Red Pocket order and check whether you selected a locked offer or the Buy Unlocked option.',
    'Two listings for the same iPhone model can have different sale terms. The product name alone does not establish which one you bought.',
    'If a Buy Unlocked order still shows a restriction, take that order to Red Pocket support. For a locked purchase, use the eligibility rules attached to its offer.',
  ],
  'iphone-carrier-unlock-software-jailbreak-guide': [
    'Read Carrier Lock on the phone before installing any utility, and ask whether the carrier has approved an unlock for its IMEI.',
    'A jailbreak or a downloaded app changing what appears on screen is not carrier authorization to use another network.',
    'If restricted, open a request with the carrier. After it confirms release, verify No SIM restrictions rather than relying on a software vendor’s success message.',
  ],
  'google-fi-unlock-policy-iphone-guide': [
    'Check whether you bought the handset through Fi or the Google Store or brought an iPhone purchased from another seller.',
    'Fi Number Lock protects a number transfer. Turning it off does not unlock a handset for another network.',
    'If bringing a restricted iPhone to Fi, contact the carrier that locked it first. With No SIM restrictions, check the model in Fi’s compatibility guidance before activating.',
  ],
  'iphone-carrier-unlock-near-me-shop-checklist': [
    'Read Carrier Lock before visiting the shop, then ask for a written quote identifying whether the fee buys a check, request assistance or an unlock.',
    'A local counter and an IMEI printout do not give a repair shop the power to overturn a carrier refusal.',
    'If the price covers only a diagnosis, decide whether you need it before leaving the phone. For a claimed completed unlock, verify the result on the handset before leaving.',
  ],
  'mint-mobile-unlock-policy-iphone-guide': [
    'Check whether Mint sold the phone, when it was first activated and whether the purchase included financing.',
    'Time on a Mint plan does not transfer a bring-your-own iPhone to Mint’s device unlock policy.',
    'For a Mint purchase that still shows a restriction, ask support to check the activation and finance records for that handset. For a BYOD phone, go back to its original supplier.',
  ],
  'how-to-unlock-iphone-without-carrier-access': [
    'Read Carrier Lock and collect any receipt or order reference you can provide legitimately without signing in to someone else’s account.',
    'Possession of an IMEI does not grant access to another person’s account or prove that financing and eligibility conditions were met.',
    'Ask the carrier whether it accepts non-customer requests. If only the original holder can resolve an account issue, ask the seller to act or discuss a return.',
  ],
}
