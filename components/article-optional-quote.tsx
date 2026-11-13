import Link from 'next/link'
import type { ArticleLocale } from '@/lib/articles'
import { CUSTOMER_IMEI_CHECK_PRODUCTS } from '@/lib/customer-provider-products'
import { guestCardQuote } from '@/lib/guest-card-quote'
import { routeFor } from '@/lib/i18n/route-map'
import { getPaidReportProduct } from '@/lib/paid-reports'

type Report = 'APPLE_CARRIER_LITE' | 'BLACKLIST_FULL'

// Only quote when the report can resolve a remaining question in this article.
// Never infer a paid offer from a brand name or an incidental keyword.
const relevant = new Map<string, Report>([
  ...['match-imei-to-seller-listing', 'comparar-imei-con-anuncio',
    'comparer-imei-et-annonce', 'comparar-imei-com-anuncio',
    'imei-mit-angebot-vergleichen', 'match-imei-to-listing',
    'how-to-unlock-iphone-without-carrier-access', 'network-provider-lock-iphone-meaning',
    'carrier-lock-not-showing-on-iphone', 'rogers-telus-sim-locked-us-iphone-in-canada',
    'what-an-imei-check-tells-you'].map(slug => [slug, 'APPLE_CARRIER_LITE'] as const),
  ...['iphone-blacklist-check-canada-before-buying', 'blacklisted-iphone-unlock-carrier-lock-difference',
    'used-iphone-imei-unlock-legitimacy-checklist', 'checks-before-buying-a-used-phone',
    'consultar-imei-iphone-importado-mexico'].map(slug => [slug, 'BLACKLIST_FULL'] as const),
])

type Text = { carrier: string; registry: string; card: string; base: string; details: string }
const copy: Record<ArticleLocale, Text> = {
  en: {carrier:'If Settings and the purchase record still do not identify the locking carrier, Apple Carrier Lite can report the available activation policy.', registry:'Check the free local registry first. If you need a separate GSMA blocklist report for this IMEI, the optional lookup checks reported device status.', base:'Service price', card:'Card total', details:'Review this report'},
  es: {carrier:'Si los ajustes y el comprobante de compra no identifican al operador que bloqueó el iPhone, Apple Carrier Lite puede mostrar la política de activación disponible.',registry:'Consulta primero el registro local gratuito. Si necesitas un informe de GSMA por separado, puedes consultar si hay un reporte para este IMEI.',base:'Precio del servicio',card:'Total con tarjeta',details:'Ver el informe'},
  'fr-ca': {carrier:'Si les réglages et la preuve d’achat ne permettent pas d’identifier l’opérateur qui a verrouillé l’iPhone, Apple Carrier Lite peut indiquer la politique d’activation disponible.',registry:'Consultez d’abord le registre local gratuit. Si vous avez besoin d’un rapport GSMA distinct, cette vérification permet de consulter les signalements associés à cet IMEI.',base:'Prix du service',card:'Total par carte',details:'Consulter la description du rapport'},
  pt: {carrier:'Se os Ajustes e o comprovante de compra não identificarem a operadora que bloqueou o iPhone, o Apple Carrier Lite pode informar a política de ativação disponível.',registry:'Consulte primeiro o cadastro local gratuito. Se precisar de um relatório separado da GSMA, a consulta verifica se há registro de impedimento para este IMEI.',base:'Preço do serviço',card:'Total no cartão',details:'Ver detalhes do relatório'},
  de: {carrier:'Lässt sich der sperrende Anbieter weder in den Einstellungen noch anhand des Kaufbelegs ermitteln, kann Apple Carrier Lite die hinterlegte Aktivierungsrichtlinie anzeigen.',registry:'Prüfen Sie zunächst das kostenlose örtliche Register. Falls Sie zusätzlich einen GSMA-Bericht benötigen, lässt sich der gemeldete Sperrstatus dieser IMEI abfragen.',base:'Preis',card:'Gesamtpreis bei Kartenzahlung',details:'Bericht ansehen'},
  ar: {carrier:'إذا لم تحدد الإعدادات أو فاتورة الشراء شركة الاتصالات التي فرضت القفل، فقد يعرض تقرير Apple Carrier Lite سياسة التنشيط المسجلة.',registry:'ابدأ بالاستعلام المجاني في السجل المحلي. إذا احتجت إلى تقرير مستقل من GSMA، فيمكنك الاستعلام عن حالة البلاغات المرتبطة بهذا الرقم.',base:'سعر الخدمة',card:'الإجمالي عند الدفع بالبطاقة',details:'عرض تفاصيل التقرير'},
}

export function ArticleOptionalQuote({slug, locale}: {slug: string; locale: ArticleLocale}) {
  const code = relevant.get(slug)
  if (!code || !CUSTOMER_IMEI_CHECK_PRODUCTS.some(p => p.productCode === code && p.status === 'available')) return null
  const product = getPaidReportProduct(code)
  if (!product?.providerReady || !product.isActive || product.domain !== 'imei_check' ||
      !Number.isSafeInteger(product.priceCents) || product.priceCents <= 0 || product.priceCents > 100000) return null
  const c = copy[locale]
  const quote = guestCardQuote(product.priceCents)
  const currency = new Intl.NumberFormat(locale, {style:'currency', currency:'USD', currencyDisplay:'code'})
  const carrier = code === 'APPLE_CARRIER_LITE'
  const page = carrier ? '/services/imei-check/apple-carrier-lock-status' : '/services/imei-check/blacklist-status'
  const href = locale === 'en' ? '/services/imei-check?product=' + code : routeFor(page, locale === 'fr-ca' ? 'fr' : locale)
  return <p className="t-small" data-report-quote={code}>
    {carrier ? c.carrier : c.registry}{' '}{c.base}: <bdi>{currency.format(quote.serviceCents / 100)}</bdi>
    {' · '}{c.card}: <bdi>{currency.format(quote.totalCents / 100)}</bdi>.{' '}
    <Link href={href}>{c.details}</Link>.
  </p>
}
