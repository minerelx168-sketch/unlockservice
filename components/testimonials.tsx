import type { Testimonial } from '@/lib/testimonials'
import { Icon } from './icons'

function monthYear(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/**
 * Review cards. Sample rows are labelled as such on every card and in the
 * section eyebrow, and the section never shows an average or a count —
 * there is nothing honest to compute one from until real reviews exist.
 */
export function Testimonials({ items }: { items: Testimonial[] }) {
  if (items.length === 0) return null
  const allSample = items.every((item) => item.sample)

  return (
    <section className="section section--tint home-section reviews" id="reviews" aria-labelledby="reviews-heading">
      <div className="shell">
        <div className="section-head section-head--center">
          <span className="kicker">
            <Icon name="star" strokeWidth={2} />
            {allSample ? 'Sample reviews' : 'Customer reviews'}
          </span>
          <h2 className="t-section" id="reviews-heading">
            What people check for, <span className="accent">in their words.</span>
          </h2>
          {allSample ? (
            <p className="t-lead">
              These cards are illustrative while verified reviews are collected. No rating or review
              count is claimed.
            </p>
          ) : null}
        </div>

        <ul className="reviews-track">
          {items.map((item, index) => (
            <li className="review-card" key={`${item.name}-${index}`}>
              <div className="review-top">
                <span className="stars" aria-label={`${item.rating} out of 5`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Icon key={i} name="star" strokeWidth={i < item.rating ? 0 : 1.8} className={i < item.rating ? 'is-on' : undefined} />
                  ))}
                </span>
                {item.sample ? <span className="review-sample">Sample</span> : null}
              </div>
              <h3 className="t-card">{item.title}</h3>
              <p className="t-small">{item.body}</p>
              <div className="review-meta">
                <span className="review-avatar" aria-hidden="true">
                  {item.name.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <b>{item.name}</b>
                  <small>
                    {item.place} · {monthYear(item.date)}
                  </small>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
