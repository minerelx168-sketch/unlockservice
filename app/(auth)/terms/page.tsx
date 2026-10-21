import { pageMetadata } from '@/lib/seo'
import Link from 'next/link'
import { Brand } from '@/components/brand'



export const metadata = pageMetadata("/terms", "Terms of Service", "Read the iUnlockMobile terms covering accounts, phone checks, unlock orders, payments and service limitations before placing an order.")

export default function TermsPage() {
  return (
    <article className="auth-card legal-card">
      <Brand />
      <h1>Terms of Service</h1>
      <p className="legal-meta">Last updated: October 21, 2026</p>

      <section>
        <h2>Agreement and eligibility</h2>
        <p>
          By creating an account or using iUnlockMobile, you agree to these terms and confirm that you are
          legally able to enter into this agreement. You are responsible for providing accurate information,
          protecting your credentials, and all activity performed through your account.
        </p>
      </section>

      <section>
        <h2>Permitted use</h2>
        <p>
          You may submit requests only for devices you own or are authorized to service. You must not use the
          platform for stolen devices, fraud, sanctions evasion, unauthorized access, unlawful interference
          with a carrier or manufacturer, automated abuse, or activity that infringes another person&apos;s rights.
          We may suspend or reject accounts and orders when misuse, legal risk, or inconsistent information is
          reasonably suspected.
        </p>
      </section>

      <section>
        <h2>Orders and service results</h2>
        <p>
          Availability, estimated completion times, eligibility rules, and supplier outcomes may vary by
          device, carrier, region, and service. An order is accepted only after the platform records it as
          processing. Results depend on information supplied by you and applicable third-party systems; we do
          not guarantee that every device or request can be completed.
        </p>
      </section>

      <section id="refunds">
        <h2>Direct orders, credits, payments, and refunds</h2>
        <p>You can pay for a service directly by card or supported crypto. Provide an accurate IMEI and delivery email, review the service requirements, and keep your private order link secure. Processing starts after payment is confirmed.</p>
        <p>Card orders with a service price of $1 or more support guest checkout without an iUnlockMobile account. Card orders below $1 require an account: the payment funds $1 plus a 5% card fee, and the difference between $1 and the service price is saved as account credit after payment. Registration returns you to the same checkout. The minimum card payment is $1.05 before any applicable tax. The service price, credit amount, fee and total are shown before payment.</p>
        <p>Crypto checkout supports USDT or USDC on BNB Smart Chain (BEP-20), with no iUnlockMobile processing fee or minimum service amount. It does not require an account or wallet top-up. Send only the supported token on the network shown at checkout and use the exact transfer instructions. Network or exchange fees may apply.</p>
        <p>If we cannot deliver a direct card order, we request a full refund to the original payment method, including the card fee. Any unused account credit created by that payment is reversed. If that credit has been used or reserved, our team reviews the allocation before arranging the refund. Bank processing time may vary. Crypto refunds require manual review and confirmation of a safe receiving wallet; contact support with your order reference. Completed services are not automatically refundable. This does not restrict any rights available under applicable law.</p>
        <p>
          Account credits are a closed-loop balance for purchasing services on iUnlockMobile and are not a
          bank deposit or transferable currency. Prices and payment instructions shown at checkout control
          each transaction. Credits may be reserved while an order is processed, charged on completion, or
          released when an order is rejected or cancelled. Refund eligibility depends on order status,
          supplier outcome, payment finality, and applicable law.
        </p>
      </section>

      <section>
        <h2>Third-party services</h2>
        <p>
          The platform may rely on Google authentication, email delivery, payment networks, hosting providers,
          carriers, and device-service suppliers. Their services and policies may affect availability. Google
          sign-in is optional; password authentication remains available unless otherwise stated.
        </p>
      </section>

      <section>
        <h2>Availability and liability</h2>
        <p>
          The service is provided on an as-available basis. To the extent permitted by law, iUnlockMobile is
          not responsible for indirect, incidental, or consequential loss, supplier outages, carrier policy
          changes, inaccurate device information, or events outside reasonable control. Nothing in these terms
          excludes rights or liabilities that cannot lawfully be excluded.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms when the service, providers, or legal requirements change. Material changes
          will be reflected by a revised date or an appropriate notice. Questions may be sent to{' '}
          <a href="mailto:support@iunlockmobile.com">support@iunlockmobile.com</a>.
        </p>
      </section>

      <p className="auth-foot">
        <Link href="/">Return to iUnlockMobile</Link> · <Link href="/privacy">Privacy Policy</Link>
      </p>
    </article>
  )
}
