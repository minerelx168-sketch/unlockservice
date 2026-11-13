import type { GeoLocale } from '@/lib/geo-locales'

/** Widget copy for every storefront language; no English fallback on localized pages. */
export type QuickCopy = {
  chip: string; title: string; value: string; imei: string; hint: string; valid: string; left: (n: number) => string
  invalid: string; email: string; submit: string; pending: string; after: string; fee: string; error: string; unavailable: string; service: string
}

export const QUICK_IMEI_COPY: Record<GeoLocale, QuickCopy> = {
  en: {
    chip: 'Apple Carrier Lite', title: 'Which carrier locks this iPhone?',
    value: 'iOS only says “SIM Locked” — it never names the carrier. A $1.70 IMEI check shows the locking network so you don’t order the wrong unlock or buy a phone still tied to a contract.',
    imei: '15-digit IMEI', hint: 'Dial *#06# or open Settings → General → About.', valid: '✓ Valid IMEI (checksum passed)',
    left: n => `${n} digits to go`, invalid: 'Checksum failed — check the digits.', email: 'Email for your result',
    submit: 'Check carrier now →', pending: 'Opening checkout…', after: 'The real check starts after payment.',
    fee: 'USDT/USDC BEP20: 0% platform fee', error: 'Please try again.', unavailable: 'Unavailable online', service: 'Service & price',
  },
  es: {
    chip: 'Apple Carrier Lite', title: '¿Qué operador bloquea este iPhone?',
    value: 'iOS solo muestra “SIM bloqueada”, nunca el nombre del operador. La consulta por IMEI de $1.70 revela la red que bloquea el equipo para no pedir un desbloqueo equivocado ni comprar un teléfono con contrato pendiente.',
    imei: 'IMEI de 15 dígitos', hint: 'Marca *#06# o abre Ajustes → General → Información.', valid: '✓ IMEI válido (dígito de control correcto)',
    left: n => `Faltan ${n} dígitos`, invalid: 'Dígito de control incorrecto: revisa el número.', email: 'Correo para recibir el resultado',
    submit: 'Consultar operador →', pending: 'Abriendo el pago…', after: 'La consulta real comienza después del pago.',
    fee: 'USDT/USDC BEP20: 0 % de comisión de plataforma', error: 'Inténtalo de nuevo.', unavailable: 'No disponible en línea', service: 'Servicio y precio',
  },
  fr: {
    chip: 'Apple Carrier Lite', title: 'Quel opérateur verrouille cet iPhone?',
    value: 'iOS affiche seulement « SIM verrouillée » sans nommer l’opérateur. La vérification IMEI à 1,70 $ indique le réseau verrouilleur pour éviter de commander le mauvais déverrouillage ou d’acheter un téléphone encore sous contrat.',
    imei: 'IMEI à 15 chiffres', hint: 'Composez *#06# ou ouvrez Réglages → Général → Informations.', valid: '✓ IMEI valide (somme de contrôle correcte)',
    left: n => `Encore ${n} chiffres`, invalid: 'Somme de contrôle invalide : vérifiez les chiffres.', email: 'Courriel pour recevoir le résultat',
    submit: 'Vérifier l’opérateur →', pending: 'Ouverture du paiement…', after: 'La vérification réelle commence après le paiement.',
    fee: 'USDT/USDC BEP20 : 0 % de frais de plateforme', error: 'Veuillez réessayer.', unavailable: 'Indisponible en ligne', service: 'Service et prix',
  },
  pt: {
    chip: 'Apple Carrier Lite', title: 'Qual operadora bloqueia este iPhone?',
    value: 'O iOS mostra apenas “SIM bloqueado”, sem dizer a operadora. A consulta por IMEI de US$ 1,70 revela a rede que bloqueia o aparelho para você não pedir o desbloqueio errado nem comprar um celular ainda preso a contrato.',
    imei: 'IMEI de 15 dígitos', hint: 'Disque *#06# ou abra Ajustes → Geral → Sobre.', valid: '✓ IMEI válido (dígito verificador correto)',
    left: n => `Faltam ${n} dígitos`, invalid: 'Dígito verificador incorreto: confira o número.', email: 'E-mail para receber o resultado',
    submit: 'Consultar operadora →', pending: 'Abrindo o pagamento…', after: 'A consulta real começa após o pagamento.',
    fee: 'USDT/USDC BEP20: 0% de taxa da plataforma', error: 'Tente novamente.', unavailable: 'Indisponível online', service: 'Serviço e preço',
  },
  de: {
    chip: 'Apple Carrier Lite', title: 'Welcher Anbieter sperrt dieses iPhone?',
    value: 'iOS zeigt nur „SIM gesperrt“ an, aber nie den Anbieter. Die IMEI-Prüfung für 1,70 $ nennt das sperrende Netz – so bestellen Sie keine falsche Entsperrung und kaufen kein Gerät mit laufendem Vertrag.',
    imei: '15-stellige IMEI', hint: 'Wählen Sie *#06# oder öffnen Sie Einstellungen → Allgemein → Info.', valid: '✓ Gültige IMEI (Prüfziffer korrekt)',
    left: n => `Noch ${n} Ziffern`, invalid: 'Prüfziffer falsch – bitte Ziffern prüfen.', email: 'E-Mail für Ihr Ergebnis',
    submit: 'Anbieter jetzt prüfen →', pending: 'Zahlung wird geöffnet…', after: 'Die echte Prüfung startet nach der Zahlung.',
    fee: 'USDT/USDC BEP20: 0 % Plattformgebühr', error: 'Bitte erneut versuchen.', unavailable: 'Online nicht verfügbar', service: 'Dienst und Preis',
  },
  ar: {
    chip: 'Apple Carrier Lite', title: 'ما الشركة التي تقفل هذا الآيفون؟',
    value: 'يعرض iOS عبارة «SIM مقفلة» فقط دون اسم الشركة. فحص IMEI بسعر 1.70 دولار يكشف الشبكة المقفِلة حتى لا تطلب فك قفل خاطئ أو تشتري هاتفاً ما زال مرتبطاً بعقد.',
    imei: 'رقم IMEI من 15 خانة', hint: 'اطلب ‎*#06#‎ أو افتح الإعدادات ← عام ← حول.', valid: '✓ رقم IMEI صالح (رقم التحقق صحيح)',
    left: n => `متبقٍ ${n} خانات`, invalid: 'رقم التحقق غير صحيح — راجع الأرقام.', email: 'البريد الإلكتروني لاستلام النتيجة',
    submit: 'افحص الشركة الآن ←', pending: 'جارٍ فتح الدفع…', after: 'يبدأ الفحص الفعلي بعد الدفع.',
    fee: 'USDT/USDC BEP20: رسوم منصة 0%', error: 'يرجى المحاولة مرة أخرى.', unavailable: 'غير متاح عبر الإنترنت', service: 'الخدمة والسعر',
  },
}
