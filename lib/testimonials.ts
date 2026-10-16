/**
 * Review cards on the homepage.
 *
 * These rows are SAMPLES. They exist so the section has a shape while
 * verified reviews are collected, and every one carries `sample: true`,
 * which the component turns into a visible label. Nothing here feeds an
 * aggregate rating or review structured data — a figure like "4.8 from
 * 3,000 reviews" that nobody gave would be a lie to buyers and a breach
 * of the ad policies this site runs under. Replace the array with real,
 * attributable reviews and drop the flag; the component needs no change.
 */

export type Testimonial = {
  name: string
  place: string
  title: string
  body: string
  /** ISO date, shown as month and year. */
  date: string
  rating: 1 | 2 | 3 | 4 | 5
  sample: boolean
}

export const SAMPLE_TESTIMONIALS: Testimonial[] = [
  {
    name: 'Example customer',
    place: 'Bangkok',
    title: 'Checked before I paid for the phone',
    body: 'Ran a blacklist report on a second-hand iPhone from a marketplace listing. The report came back in a few minutes and the seller could not explain the result, so I walked away.',
    date: '2026-09-02',
    rating: 5,
    sample: true,
  },
  {
    name: 'Example customer',
    place: 'Manchester',
    title: 'The credit came back when the network said no',
    body: 'My order was refused because the handset was still on a plan. The held credit returned to my balance the same day, which is the part I had been worried about.',
    date: '2026-08-21',
    rating: 4,
    sample: true,
  },
  {
    name: 'Example customer',
    place: 'Toronto',
    title: 'Status was visible the whole time',
    body: 'I could see the order sitting with the carrier, then the code arrived on the order page and by email. Nothing to install and the phone kept its warranty.',
    date: '2026-07-30',
    rating: 5,
    sample: true,
  },
]
