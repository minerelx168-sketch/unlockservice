import { pageMetadata } from '@/lib/seo'
import Link from 'next/link'
import { Brand } from '@/components/brand'



export const metadata = pageMetadata("/privacy", "Privacy Policy", "Read how iUnlockMobile handles account details, device identifiers and service information, and how to contact us about your privacy.")

export default function PrivacyPage() {
  return (
    <article className="auth-card legal-card">
      <Brand />
      <h1>Privacy Policy</h1>
      <p className="legal-meta">Last updated: October 9, 2026</p>

      <section>
        <h2>Information we collect</h2>
        <p>
          iUnlockMobile processes the information you provide when creating an account, signing in,
          placing an unlock request, contacting support, or funding an account. This may include your
          username, email address, encrypted password, device identifiers such as IMEI numbers, order
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
        <p>Free format and Luhn checksum validation runs locally in your browser and does not send the IMEI to a device-data provider. Paid services require an account and explicit order confirmation.</p>
        <p>Optional analytics and advertising storage are denied by default. You can allow or reject them using Privacy choices on any page. With consent, we save validated Google click identifiers (gclid, gbraid and wbraid) in signed, HttpOnly cookies for up to 90 days and snapshot them on accepted website orders for attribution. Rejection clears these cookies and disables optional funnel events. Existing transaction records remain subject to the retention policy below.</p>
        <p>Funnel events contain only allowlisted service categories, statuses, currency and amounts. We do not include raw IMEI numbers, emails, names, wallet addresses, transaction hashes, CSRF tokens, customer identifiers or provider order identifiers. Google advertising purchase conversions are limited to delivered services with a matching charge; adding account credit or submitting an order is not a purchase conversion. Google may process consent-mode signals under its own privacy terms.</p>
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

      <p className="legal-note">
        This operational policy should be reviewed by qualified counsel before being relied on as formal
        legal advice.
      </p>
      <p className="auth-foot">
        <Link href="/">Return to iUnlockMobile</Link> · <Link href="/terms">Terms of Service</Link>
      </p>
    </article>
  )
}
