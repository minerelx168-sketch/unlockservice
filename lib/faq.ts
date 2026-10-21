/**
 * The questions answered on the homepage and in the help centre. One list,
 * so the two pages cannot disagree, and so the FAQPage structured data on
 * the homepage describes what the help centre actually says.
 */
export type FaqEntry = { question: string; answer: string }

export const FAQ: FaqEntry[] = [
  {
    question: 'What does a network unlock change?',
    answer:
      'A network unlock removes the carrier restriction for an eligible device. It does not remove Activation Lock, a finance agreement or a theft report. The method, eligibility and warranty terms depend on the device, carrier and selected service; review them before ordering.',
  },
  {
    question: 'How long does it take?',
    answer:
      'It depends on the network — some authorise within hours, others take a couple of days. The turnaround for your exact carrier is quoted before you order, and the order shows its live status until it lands.',
  },
  {
    question: 'What if my device cannot be unlocked?',
    answer:
      'For a direct card order that we cannot deliver, we request a full refund to the original payment method, including the card fee. Bank processing time may vary. For orders paid using an existing account balance, the reserved credit is released back to that balance.',
  },
  {
    question: 'Where do I find my IMEI?',
    answer:
      'Dial *#06# on the device — it works on iOS and Android. It is also printed on the SIM tray, on the original box, and shown in the settings app under the device’s About screen.',
  },
  {
    question: 'Do I have to send my phone anywhere?',
    answer:
      'No. Everything is done remotely against the IMEI. Apple devices are released over the air — connect to Wi-Fi and follow the prompt. Other brands receive a code you enter once, with a SIM from the new network in the device.',
  },
  {
    question: 'Can you unlock a phone that is still on contract?',
    answer:
      'Eligibility depends on the carrier. An unpaid balance, an active contract or a lost-or-stolen report may prevent unlocking. If the carrier refuses the order, direct card payments are refunded to the original payment method; balance-paid orders release the reserved credit.',
  },
  {
    question: 'Can I pay without creating an account?',
    answer:
      'Yes. Choose an available service, enter your IMEI and delivery email, then pay for that order by card. A 5% card fee is shown before payment. No iUnlockMobile login or wallet top-up is required. Track your order using its private link and receive the result by email. Existing customers can still pay with account credit and add credit by card or the supported crypto networks.',
  },
  {
    question: 'Will any SIM work after the unlock?',
    answer:
      'Any SIM from a network whose bands the phone supports. A network unlock removes the carrier restriction; it does not add radio bands the handset never had, so a phone bought for one region may still lack a band used elsewhere.',
  },
]
