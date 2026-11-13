// Editorial decision points, keyed to the evidence and limits discussed in each guide.
export const decisionsA: Record<string, readonly [string, string, string]> = {
  "iphone-model-number-lookup-carrier-lock": [
    "In Settings → General → About, tap Model Number to reveal the A-number, then match it to Apple’s model directory.",
    "The sales suffix and the A-number describe the handset, not the network allowed to activate it.",
    "If the hardware fits your plan, read Carrier Lock on that same phone before paying the seller."
  ],
  "iphone-sim-unlock-chip-vs-carrier-unlock": [
    "Ask the seller to show Carrier Lock in Settings with the adapter removed.",
    "A call made with a SIM interposer is not evidence that the carrier released the iPhone.",
    "If Settings still reports a restriction, request an unlock decision from the original carrier rather than another chip."
  ],
  "can-itunes-unlock-iphone-carrier-lock": [
    "Check whether the original carrier has confirmed the unlock before connecting the iPhone to a computer.",
    "A successful restore shows that iOS was reinstalled, not that a carrier approved the phone for other networks.",
    "After approval, try activating another carrier’s SIM or eSIM before considering Apple’s backup-and-restore procedure."
  ],
  "match-imei-to-seller-listing": [
    "At handover, compare the identifier on the handset with the seller’s report, matching IMEI to IMEI or IMEI2 to IMEI2.",
    "Matching numbers tie a report to the device but do not establish who owns it or whether its status has changed since the check.",
    "If the numbers differ, ask for a report for the phone in front of you before handing over payment."
  ],
  "unlock-iphone-before-switching-carriers": [
    "Read Carrier Lock on the phone you intend to keep and run the new provider’s compatibility check before transferring your number.",
    "An approved number transfer does not release the phone or confirm that your plan supports its eSIM.",
    "If either device check remains unresolved, keep the existing line active while the carriers review it."
  ],
  "trade-in-carrier-locked-iphone-checklist": [
    "Read the trade-in program’s terms for your region and record the condition and lock status you intend to declare.",
    "Getting an estimate does not guarantee the buyer will accept the phone at that price after inspection.",
    "If the terms do not address your restriction, get the buyer’s answer before erasing or shipping the device."
  ],
  "carrier-refused-iphone-unlock-next-steps": [
    "Save the refusal notice and ask the carrier which eligibility condition failed on your device.",
    "A payoff receipt answers the balance question but does not settle service duration, account status or other requirements.",
    "If the reason contradicts your records, attach the relevant document to the existing case and request a review."
  ],
  "network-provider-lock-iphone-meaning": [
    "Read the wording beside Network Provider Lock in About, separately from any SIM PIN prompt.",
    "A restricted status does not name the responsible network or show whether an installment agreement is settled.",
    "If it says “No SIM restrictions” but service fails, take the activation issue to the new provider."
  ],
  "check-sealed-iphone-unlocked-before-opening": [
    "Compare the sealed box’s identifier with the purchase record and ask for a return window that allows activation testing.",
    "An intact seal cannot show the Carrier Lock value on the phone inside.",
    "If the seller will not let you verify the status after opening, decide whether that uncertainty is acceptable before buying."
  ],
  "will-unlocked-iphone-work-any-carrier": [
    "Look up the exact iPhone model and run its identifier through the destination carrier’s bring-your-own-device check.",
    "An unlocked label alone says nothing about the carrier’s accepted models, SIM format or supported plan features.",
    "If the compatibility checker rejects it, ask which requirement failed before purchasing an unlock."
  ],
  "att-transfer-pin-vs-iphone-carrier-unlock": [
    "Check whether you need to move just the AT&T number or also use the same handset on the new network.",
    "Receiving a number transfer PIN does not change the Carrier Lock shown on the handset.",
    "If you are taking both, check unlock eligibility separately and keep the line active until the number transfer finishes."
  ],
  "iphone-apn-settings-after-carrier-unlock": [
    "Turn Wi-Fi off briefly and confirm which cellular line is selected for data before changing any APN settings.",
    "Working calls with failed mobile data do not by themselves identify an APN error or a carrier lock.",
    "If the selected line still has no data, obtain that plan’s APN instructions from the new carrier."
  ],
  "iphone-imei2-carrier-unlock-request": [
    "Privately copy both IMEI labels from About and check which one the carrier’s request form asks for.",
    "The presence of IMEI2 does not establish that a second line can use a different carrier.",
    "If the portal rejects the requested number, ask support which device record it expects instead of swapping in another identifier."
  ],
  "iphone-carrier-settings-update-sim-locked": [
    "Connect to Wi-Fi, open General → About and check whether the phone offers a carrier settings update.",
    "A new settings version can change network configuration without changing Carrier Lock.",
    "If the update installs but the phone still reports SIM locked, ask the locking carrier about release."
  ],
  "telus-iphone-unlock-security-lock-guide": [
    "Match the TELUS device purchase and activation dates to the handset and note the exact lock message.",
    "Counting days from a receipt alone cannot tell you which security-lock timing TELUS applied to this device.",
    "If the published timing and the handset disagree, ask TELUS to check the activation record and confirm the applicable release date."
  ],
  "bell-iphone-unlock-before-travel": [
    "Before departure, identify whether you will roam on your Bell line or activate another provider’s SIM or eSIM.",
    "Working Bell roaming does not show that the iPhone will accept a separate travel line.",
    "If the second provider is needed and Carrier Lock is restricted, contact Bell before the trip about early release."
  ],
  "rogers-iphone-unlock-sim-locked-guide": [
    "Check the original purchase paperwork for Rogers and read Carrier Lock on the actual iPhone.",
    "Seeing Rogers beside the active line does not establish that Rogers controls the device’s lock.",
    "If the purchase record points to Rogers and the phone remains restricted, ask Rogers to identify the correct support route for your account."
  ],
  "iphone-blacklist-check-canada-before-buying": [
    "Run the handset’s own IMEI through DeviceCheck Canada while you can still compare it with the seller’s listing.",
    "A clear result at the time of lookup does not settle ownership, financing or Activation Lock.",
    "If the lookup flags the phone, pause the sale and ask the seller to resolve the record through the reporting provider."
  ],
  "unlock-telstra-phone-iphone-prepaid-guide": [
    "Find the Telstra purchase or activation record and check whether the device was supplied on Pre-Paid or a month-to-month plan.",
    "A Telstra SIM currently working in the phone does not prove it was sold under either plan.",
    "If it was sold as Pre-Paid and remains restricted, ask Telstra to confirm its service age and any applicable fee."
  ],
  "optus-phone-unlock-iphone-prepaid-guide": [
    "Check the iPhone’s lock field before entering an IMEI in the Optus Prepaid unlock form.",
    "A Prepaid SIM in the tray does not establish that the handset came from Optus or that a fee applies.",
    "If an Optus-supplied iPhone shows a restriction despite the published guidance, ask Optus to reconcile its record with the handset."
  ],
  "unlock-lebara-phone-iphone-guide": [
    "Check whether the phone came from Lebara Phones or merely uses a Lebara SIM.",
    "A SIM Free label on a current Lebara listing cannot establish the status of a handset bought elsewhere.",
    "If a bring-your-own phone remains restricted, trace the original supplier; if unlocked, ask Lebara about the line."
  ],
  "are-talkmobile-phones-unlocked-guide": [
    "Check the Talkmobile upgrade order to identify who supplied the handset before requesting an unlock.",
    "An active Talkmobile plan establishes a service relationship, not the purchase history of a second-hand phone.",
    "If the order identifies another supplier, take the restriction and purchase details to that supplier first."
  ],
  "are-voxi-phones-unlocked-guide": [
    "Compare your VOXI order with the lock status in About to distinguish a VOXI purchase from a phone you brought to the plan.",
    "VOXI’s sales policy for its own Apple phones does not cover every handset using a VOXI SIM.",
    "If a direct VOXI purchase shows a restriction, ask support to investigate that discrepancy against the order."
  ],
  "unlock-bt-mobile-phone-guide": [
    "Write down the exact prompt on the older BT phone before looking for an unlock code.",
    "A request for a BT SIM’s PUK concerns that SIM and does not establish a handset network restriction.",
    "If you see a PUK prompt, use BT’s SIM support; use the handset’s purchase record for an actual Network Provider Lock restriction."
  ],
  "are-id-mobile-phones-unlocked-guide": [
    "Find the iD Mobile handset order, if there is one, and compare it with the device in About.",
    "An iD SIM working on a used iPhone does not mean iD supplied the phone or controls its lock.",
    "If the phone is unlocked but the second line fails to activate, check that plan’s activation and eSIM support first."
  ],
  "virgin-mobile-uk-iphone-unlock-guide": [
    "Keep the old Virgin Mobile handset receipt alongside the current O2 line details so support can distinguish them.",
    "A line’s migration to O2 is not evidence that an older Virgin-supplied handset was unlocked.",
    "If About still shows a restriction, ask support to trace the handset record using the original purchase details."
  ],
  "are-sky-iphones-unlocked-guide": [
    "Check whether Sky sold you the iPhone or you simply activated a Sky SIM on it.",
    "Sky’s policy for devices it supplies cannot confirm the state of a phone imported or bought second-hand.",
    "If the handset shows no restriction, troubleshoot Sky SIM activation rather than ordering a carrier unlock."
  ],
  "are-giffgaff-iphones-unlocked-guide": [
    "Look for a giffgaff new or refurbished handset order and read the status on the phone described by that order.",
    "A giffgaff airtime purchase alone does not place the phone under its handset sales policy.",
    "If the handset came from another seller and remains locked, ask for its original provider rather than entering a generic unlock code."
  ],
  "three-uk-iphone-unlock-guide": [
    "Check the origin and purchase era of the Three UK handset alongside its current lock status.",
    "Three’s published history of selling unlocked phones cannot settle the status of a particular older handset.",
    "If a legacy Three purchase still reports a lock, ask Three to check that specific device record."
  ],
  "tesco-mobile-iphone-unlock-guide": [
    "Confirm whether Tesco supplied the handset on Pay Monthly or whether you bought only a Tesco Mobile SIM.",
    "A Tesco SIM PIN or PUK prompt is not evidence that Tesco locked the iPhone to its network.",
    "If the handset itself is restricted and the purchase points to Tesco, use Tesco’s official device-unlock route."
  ],
  "ee-uk-iphone-unlock-guide": [
    "Read Network Provider Lock on the EE iPhone rather than relying on the network name at the top of the screen.",
    "Seeing EE service only identifies the active connection, not whether another carrier can activate the device.",
    "If the phone is EE-supplied and restricted, use EE’s device-unlock process before testing a different SIM."
  ],
  "o2-uk-iphone-unlock-guide": [
    "Compare the original O2 purchase date and seller with the status shown on the iPhone today.",
    "A policy for recent O2 purchases does not identify the status of an older or independently sourced device.",
    "If an O2-supplied phone remains network-restricted, request a handset unlock rather than a SIM unblock."
  ]
}
