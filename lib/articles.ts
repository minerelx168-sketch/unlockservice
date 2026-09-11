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
      'An IMEI check reads what networks and manufacturers already know about a handset: the model behind the number, whether it is blacklisted, and which carrier it belongs to.',
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
      'A short, practical order of checks for a second-hand handset: the number, the blacklist, the lock, the account and the receipt — and what each one saves you from.',
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
