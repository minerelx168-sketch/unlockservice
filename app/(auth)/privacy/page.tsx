import { pageMetadata } from '@/lib/seo'
import Link from 'next/link'
import { Brand } from '@/components/brand'



export const metadata = pageMetadata("/privacy", "Privacy Policy", "Read how iUnlockMobile handles account details, device identifiers and service information, and how to contact us about your privacy.")

export default function PrivacyPage() {
  return (
    <article className="auth-card legal-card">
      <Brand />
      <h1>Privacy Policy</h1>
      <p className="legal-meta">Last updated: October 21, 2026</p>

      <section>
        <h2>Information we collect</h2>
        <p>
          iUnlockMobile processes the information you provide when creating an account, signing in,
          placing a guest or account order, contacting support, or funding an account. This may include your
          username, email address, password hash, device identifiers such as IMEI numbers, order
          details, payment references, account balances, and support communications.
        </p>
        <p>
          If you choose Continue with Google, Google provides a stable account identifier, your email
          address, and basic profile information covered by the permissions shown on Google&apos;s consent
          screen. We do not request access to Gmail, Google Drive, contacts, calendars, or offline access,
          and we do not store Google access or refresh tokens.
        </p>
      </section>

      <section>
        <h2>How we use information</h2>
        <p>
          We use account and order information to authenticate users, process and track service requests,
          manage credits and payments, deliver status updates, prevent abuse, investigate security events,
          provide support, and maintain legally required transaction records. We do not sell personal
          information.
        </p>
      </section>

      <section>
        <h2>Cookies and optional measurement</h2>
        <p>Basic IMEI format and Luhn checksum validation runs locally in your browser. When you submit Apple Free Check, we send the IMEI to our device-data provider to request Apple Basic Info and save the result privately in your account. Paid checks and unlock services start only after order confirmation and verified payment. Guest checkout uses the identifier required by your selected service and your delivery email; an account is required for card orders with a service price below $1 so the remaining amount can be saved as account credit.</p>
        <p>In the European Economic Area, the United Kingdom and Switzerland, optional analytics and advertising storage are off until you accept them. Elsewhere they are on by default. Everyone can accept or reject them at any time using Privacy choices on any page; a rejection always takes priority. With consent, we save validated Google click identifiers (gclid, gbraid and wbraid) in signed, HttpOnly cookies for up to 90 days and snapshot them on accepted website orders for attribution. Rejection clears these cookies and disables optional funnel events. Existing transaction records remain subject to the retention policy below.</p>
        <p>With optional analytics consent, signed-in customer activity is linked using a random analytics User-ID. We record page categories, visit times and estimated active time to understand service demand and improve the customer experience. The same random ID is sent to Google Analytics 4 so activity can be understood across signed-in sessions. We do not use IP addresses to identify customers for this feature or send names, email addresses, IMEIs, wallet details or private URL parameters to Google Analytics.</p>
        <p>Active time counts focused, visible pages and pauses after 60 seconds without interaction, with a one-hour maximum per page visit. Detailed page activity stored by iUnlockMobile is available for up to 90 days and older records are regularly removed. The random analytics ID remains linked to your account while needed for this measurement or until an eligible deletion request is processed. Administrators do not appear in customer behavior tracking. You can stop future optional tracking at any time using Privacy choices; previous records remain subject to these retention and deletion rules.</p>
        <p>Google Analytics also receives sanitized campaign labels and external referrer origins to help us understand which marketing channels bring visitors. We exclude free-text search terms, arbitrary URL parameters and private account paths. With consent, payment-event markers in your browser are used for up to 90 days to reduce repeated counts. GA4 user and event data retention is configured to 14 months, with user retention restarting when new activity is recorded. This is separate from the 90-day limit for detailed page activity stored by iUnlockMobile.</p>
        <p>Funnel events contain only allowlisted service categories, statuses, currency and amounts. We do not include raw IMEI numbers, emails, names, wallet addresses, transaction hashes, CSRF tokens, account names or provider order identifiers. Purchase and payment events are sent to Google Analytics by our server only after the payment is verified, once per transaction, and contain the service, its price, a conversion value and an analytics client identifier; never your name, email address, IMEI or payment details. If you rejected optional tracking, no such event is sent. Adding account credit is recorded separately from a purchase. Google may process consent-mode signals under its own privacy terms.</p>
        <p>
          The website uses secure, HttpOnly cookies to maintain signed-in sessions and short-lived OAuth
          transactions. Passwords are stored as salted hashes. Access controls, rate limits, encrypted
          transport, database backups, and audit records are used to protect the service, but no system can
          guarantee absolute security.
        </p>
      </section>

      <section>
        <h2>Service providers and retention</h2>
        <p>
          We may share only the information needed to operate the service with infrastructure, email,
          authentication, payment, and device-service providers. Google authentication is governed by
          Google&apos;s own privacy terms. Records are retained only as long as needed for service delivery,
          security, dispute handling, accounting, or legal obligations, after which they are deleted or
          de-identified where practical.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>
          You may use password authentication instead of Google, revoke iUnlockMobile access from your
          Google Account, and request access, correction, or deletion of eligible account information. Some
          transaction records may need to be retained for fraud prevention, accounting, or legal compliance.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          For privacy questions or account requests, email{' '}
          <a href="mailto:support@iunlockmobile.com">support@iunlockmobile.com</a>.
        </p>
      </section>

      <p className="auth-foot auth-foot--links">
        <Link href="/">Return to iUnlockMobile</Link>
        <Link href="/terms">Terms of Service</Link>
      </p>
    </article>
  )
}
