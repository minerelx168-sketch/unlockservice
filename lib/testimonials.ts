/**
 * Review cards on the homepage.
 *
 * These rows are SAMPLES. They exist so the section has a shape while
 * verified reviews are collected, and every one carries `sample: true`,
 * which the component turns into a visible label. The names are personas,
 * not customers. Nothing here feeds an aggregate rating or review
 * structured data — a figure like "4.8 from 3,000 reviews" that nobody
 * gave would be a lie to buyers and a breach of the ad policies this site
 * runs under. Replace the array with real, attributable reviews and drop
 * the flag; the component needs no change.
 */

export type Testimonial = {
  name: string
  /** What they do: the reason their view matters. */
  role: string
  /** City and country. */
  place: string
  body: string
  rating: 1 | 2 | 3 | 4 | 5
  sample: boolean
}

export const SAMPLE_TESTIMONIALS: Testimonial[] = [
  {
    name: 'Nattaya K.',
    role: 'Second-hand phone trader',
    place: 'Bangkok, Thailand',
    body: 'Ran a blacklist report on a marketplace iPhone before meeting the seller. It came back flagged in a few minutes and I kept my money.',
    rating: 5,
    sample: true,
  },
  {
    name: 'Oliver B.',
    role: 'Repair shop owner',
    place: 'Manchester, UK',
    body: 'My unlock was refused because the handset was still on a plan. The held credit was back on my balance the same day, which was the part I had worried about.',
    rating: 4,
    sample: true,
  },
  {
    name: 'Priya R.',
    role: 'Refurbisher',
    place: 'Toronto, Canada',
    body: 'I could see the order sitting with the carrier, then the code arrived on the order page and by email. Nothing to install and the phone kept its warranty.',
    rating: 5,
    sample: true,
  },
  {
    name: 'Daniel M.',
    role: 'Reseller',
    place: 'Singapore',
    body: 'The carrier report showed the lock policy and the clean status in one place. I check every batch now before it goes on the shelf.',
    rating: 5,
    sample: true,
  },
  {
    name: 'Sofía L.',
    role: 'Travel blogger',
    place: 'Madrid, Spain',
    body: 'Unlocked my phone before a long trip so I could use local SIMs. The price and the wait were shown before I entered anything.',
    rating: 5,
    sample: true,
  },
  {
    name: 'Ahmed H.',
    role: 'Wholesale buyer',
    place: 'Dubai, UAE',
    body: 'Instant reports on most Apple models and the IMEI is masked everywhere in my history. Exactly the audit trail I need for stock.',
    rating: 4,
    sample: true,
  },
  {
    name: 'Kenji T.',
    role: 'Phone shop staff',
    place: 'Osaka, Japan',
    body: 'A customer brought in a device that would not take our SIM. One carrier check explained why, and the unlock quote told them what it would cost.',
    rating: 5,
    sample: true,
  },
  {
    name: 'Grace O.',
    role: 'Student',
    place: 'Melbourne, Australia',
    body: 'First time doing this and the steps were clear: IMEI, pick the network, pay from credit. The order page kept me updated until it was done.',
    rating: 5,
    sample: true,
  },
]
