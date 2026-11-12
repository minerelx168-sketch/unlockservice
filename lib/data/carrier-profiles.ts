export type CarrierProfile = {
  slug: string
  country: string
  name: string
  kind: 'check' | 'unlock'
  primary: string
  secondary?: string
  rule: string
  source: string
}
const canadaRules = 'https://crtc.gc.ca/eng/archive/2026/lt261030a.htm'
const britishRules = 'https://www.ofcom.org.uk/phones-and-broadband/mobile-phones/mobile-companies-now-banned-from-selling-locked-handsets'
export const carrierProfiles: CarrierProfile[] = [
  { country: 'us', slug: 'att', name: 'AT&T', kind: 'unlock', primary: 'UNLOCK_346', secondary: 'UNLOCK_340', rule: 'Use the free AT&T portal first. Postpaid devices must meet the purchase-age and payoff requirements. AT&T Prepaid requires twelve months of paid service.', source: 'https://www.att.com/deviceunlock/' },
  { country: 'us', slug: 'c-spire', name: 'C Spire', kind: 'unlock', primary: 'UNLOCK_649', rule: 'Have the account holder or authorized user ask C Spire to confirm eligibility for the handset. An IMEI alone cannot establish authorization.', source: 'https://www.cspire.com/web/legal/terms-of-use' },
  { country: 'canada', slug: 'telus', name: 'TELUS', kind: 'unlock', primary: 'UNLOCK_39', rule: 'Check the activation date with TELUS before paying. Ask TELUS to verify a temporary security lock; a device financing balance is a separate question.', source: 'https://www.telus.com/en/support/article/unlock-mobile-device' },
  { country: 'canada', slug: 'koodo', name: 'Koodo', kind: 'unlock', primary: 'UNLOCK_39', rule: 'Identify whether the phone was bought on a Koodo Tab or brought to Koodo. A Tab balance concerns how the device was financed; it does not establish which network locked it.', source: 'https://www.koodomobile.com/en/help/everything-you-need-to-know-about-tab' },
  { country: 'canada', slug: 'rogers', name: 'Rogers', kind: 'unlock', primary: 'UNLOCK_36', rule: 'Rogers directs current customers and customers who cancelled within the previous twelve months to its support team for qualifying Rogers devices.', source: 'https://www.rogers.com/support/mobility/device-unlocking-faqs' },
  { country: 'canada', slug: 'fido', name: 'Fido', kind: 'unlock', primary: 'UNLOCK_36', rule: 'Fido says new phones sold directly by Fido are unlocked. For a used phone, establish whether it was bought from Fido or merely used with a Fido SIM.', source: 'https://www.fido.ca/support/mobility/device-unlocking-faqs' },
  { country: 'canada', slug: 'videotron', name: 'Vidéotron', kind: 'unlock', primary: 'UNLOCK_289', rule: 'Vidéotron says its devices sold after December 1, 2017 were already unlocked. Identify the original seller before considering a paid service.', source: 'https://www.videotron.com/en/support/mobile/devices/unlock-mobile' },
  { country: 'canada', slug: 'sasktel', name: 'SaskTel', kind: 'unlock', primary: 'UNLOCK_329', rule: 'Ask SaskTel to confirm the original device and activation record. A DeviceCheck Canada loss or theft result cannot establish that SaskTel placed a SIM lock.', source: canadaRules },
  { country: 'uk', slug: 'ee', name: 'EE', kind: 'unlock', primary: 'UNLOCK_48', secondary: 'UNLOCK_49', rule: 'UK operators could no longer sell locked handsets from December 17, 2021. For earlier EE devices, verify the actual policy and purchase date before considering a six-month-old-device service.', source: britishRules },
  { country: 'uk', slug: 'vodafone', name: 'Vodafone UK', kind: 'unlock', primary: 'UNLOCK_461', rule: 'Establish that this is a legacy Vodafone UK handset. A Vodafone SIM used in another country does not establish the locking network or the applicable UK rule.', source: britishRules },
  { country: 'japan', slug: 'docomo', name: 'Docomo', kind: 'unlock', primary: 'UNLOCK_294', rule: 'Docomo models released on or after August 27, 2021 ship without a network lock. Older locked devices can use the official Docomo procedure.', source: 'https://www.docomo.ne.jp/english/support/procedure/simcard/unlock_dcm/' },
  { country: 'japan', slug: 'au-kddi', name: 'au KDDI', kind: 'unlock', primary: 'UNLOCK_453', rule: 'au says models released on or after October 1, 2021 are not SIM locked. Use the original model release date, not the date of a second-hand purchase.', source: 'https://www.au.com/english/support/faq/eservice/epg00002077/' },
  { country: 'japan', slug: 'softbank', name: 'SoftBank', kind: 'unlock', primary: 'UNLOCK_589', rule: 'SoftBank iPhones released from June 2021 ship SIM-free. For an earlier handset, check the original SoftBank purchase and lock result before ordering.', source: 'https://www.softbank.jp/support/faq/view/10614' },
  { country: 'austria', slug: 'telering', name: 'tele.ring', kind: 'unlock', primary: 'UNLOCK_87', rule: 'Confirm a legacy tele.ring contract and a lock placed by the original operator. The available service covers out-of-contract devices.', source: 'https://www.magenta.at/' },
  { country: 'austria', slug: 'a1', name: 'A1', kind: 'unlock', primary: 'UNLOCK_84', rule: 'A1 distinguishes legacy purchases before August 2024. The listed service also requires an out-of-contract device with an IMEI at least two years old.', source: 'https://www.a1.net/faq/telefonie/sim-karten-aktivieren/handy-sim-lock-entsperren' },
  { country: 'us', slug: 't-mobile-us', name: 'T-Mobile US', kind: 'check', primary: 'TMOBILE_USA', rule: 'This is a status report. T-Mobile applies different postpaid and prepaid eligibility rules and handles eligible device releases itself.', source: 'https://www.t-mobile.com/responsibility/consumer-info/policies/sim-unlock-policy' },
  { country: 'us', slug: 'verizon-us', name: 'Verizon US', kind: 'check', primary: 'VERIZON_USA_PRO', rule: 'This is a status report. Check the original activation date and plan with Verizon; its historical 60-day rule does not cover every current purchase.', source: 'https://www.verizon.com/support/device-locking-faqs/' },
  { country: 'canada', slug: 'bell-canada', name: 'Bell Canada', kind: 'check', primary: 'APPLE_CARRIER_LITE', rule: 'Bell describes a temporary security lock following activation. The Apple Carrier Lite report reads device policy and cannot shorten that waiting period.', source: 'https://support.bell.ca/Mobility/smartphones_and_mobile_internet/unlock_your_Bell_device' },
]
