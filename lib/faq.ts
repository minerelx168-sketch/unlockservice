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
      'For a direct card order that we cannot deliver, we request a full refund to the original payment method, including the card fee. If credit from a small card order has already been used or reserved, support reviews the refund first. Bank processing time may vary. Crypto refunds require manual review with support. For orders paid using an existing account balance, the reserved credit is released back to that balance.',
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
    question: 'How can I pay for an order?',
    answer:
      'Choose card or crypto at checkout and pay for your selected service. Card payments include a 5% fee. Crypto accepts USDT or USDC on BNB Smart Chain (BEP20), with no service minimum or platform processing fee; network or exchange fees may apply. Existing customers can also pay with their account credit. Processing starts only after payment is confirmed.',
  },
  {
    question: 'Can I pay without creating an account?',
    answer:
      'Yes, for crypto payments and card services priced at $1 or more. Enter your IMEI and delivery email, then track the order through its private link and receive the result by email. For a card service below $1, create an account or sign in and return to the same checkout. You pay $1 plus the 5% card fee; the difference between $1 and the service price is saved as account credit after payment.',
  },
  {
    question: 'Will any SIM work after the unlock?',
    answer:
      'Any SIM from a network whose bands the phone supports. A network unlock removes the carrier restriction; it does not add radio bands the handset never had, so a phone bought for one region may still lack a band used elsewhere.',
  },
]
