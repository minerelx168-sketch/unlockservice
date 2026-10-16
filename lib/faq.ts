/**
 * The questions answered on the homepage and in the help centre. One list,
 * so the two pages cannot disagree, and so the FAQPage structured data on
 * the homepage describes what the help centre actually says.
 */
export type FaqEntry = { question: string; answer: string }

export const FAQ: FaqEntry[] = [
  {
    question: 'Is this permanent, and is my warranty safe?',
    answer:
      'Yes to both. The unlock is recorded against the IMEI in the carrier or manufacturer database, so it survives updates, resets and new SIMs. Nothing is installed on the device and no software is modified, which is what puts a warranty at risk.',
  },
  {
    question: 'How long does it take?',
    answer:
      'It depends on the network — some authorise within hours, others take a couple of days. The turnaround for your exact carrier is quoted before you order, and the order shows its live status until it lands.',
  },
  {
    question: 'What if my device cannot be unlocked?',
    answer:
      'Your account credit is reserved while the order is with the carrier and charged only when the unlock is delivered. If the carrier refuses the order, the full reserved amount returns to your account balance. This releases account credit; it is not a refund to your original payment method.',
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
      'Eligibility depends on the carrier. An unpaid balance, an active contract or a lost-or-stolen report may prevent unlocking. If the carrier refuses the order, the full reserved credit returns to your account balance.',
  },
  {
    question: 'How do I pay, and what is "credit"?',
    answer:
      'You add credit to your account with USDT on the TRC20 or BEP20 network, and orders are paid from that balance. Credit is held while an order runs and only becomes a charge when the result is delivered, which is what makes a refused order free.',
  },
  {
    question: 'Will any SIM work after the unlock?',
    answer:
      'Any SIM from a network whose bands the phone supports. A network unlock removes the carrier restriction; it does not add radio bands the handset never had, so a phone bought for one region may still lack a band used elsewhere.',
  },
]
