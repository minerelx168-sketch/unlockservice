// Edits to existing guides. New articles without an entry keep their own content.
import type { Article, ArticleLocale } from './articles'

type Locale = Exclude<ArticleLocale, 'en'>
type Edition = {
  source: [string, string, string]
  evidence: [string, string, string]
  rows: [string, string, string][]
  section: string
  followup: [string, string, string]
}

export const editionDecisions: Record<string, readonly [string, string, string]> = {
  'consultar-imei-iphone-importado-mexico': [
    'Consulta el IMEI en el portal de la CRT y anota qué identificador revisaste.',
    'Un resultado sin reporte no confirma que el iPhone acepte una línea mexicana.',
    'Si está desbloqueado, verifica con tu compañía que tu plan se pueda activar en ese modelo.',
  ],
  'comparar-imei-con-anuncio': [
    'Pide al vendedor que abra Información en el iPhone que te entregará y compara los 15 dígitos con el informe.',
    'Un IMEI coincidente vincula el informe al equipo; no demuestra que se haya liquidado el financiamiento.',
    'Si una cifra no coincide, comprueba si el vendedor consultó el IMEI2 antes de aceptar la entrega.',
  ],
  'comparer-imei-et-annonce': [
    'À la remise du téléphone, comparez le numéro affiché dans Réglages avec celui du rapport, chiffre par chiffre.',
    'Une concordance identifie l’appareil visé par le rapport; elle ne prouve pas que le financement est remboursé.',
    'En cas d’écart, vérifiez si le vendeur a fourni le deuxième IMEI. Attendez que le doute soit levé avant de payer.',
  ],
  'comparar-imei-com-anuncio': [
    'Na entrega, peça para ver o IMEI nos Ajustes do próprio iPhone e confira os 15 dígitos do relatório.',
    'Mesmo quando os números batem, o relatório não comprova que todas as parcelas foram pagas.',
    'Se houver diferença, confira se a consulta usou o IMEI2. Não feche a compra sem identificar o aparelho consultado.',
  ],
  'imei-mit-angebot-vergleichen': [
    'Lassen Sie sich beim Kauf die IMEI am Gerät anzeigen und gleichen Sie alle 15 Ziffern mit dem Bericht ab.',
    'Stimmen die Nummern überein, gehört der Bericht zum Gerät. Ob es abbezahlt ist, bleibt offen.',
    'Klären Sie bei einer Abweichung zuerst, ob im Bericht die IMEI2 steht. Zahlen Sie erst nach dem Abgleich.',
  ],
  'match-imei-to-listing': [
    'عند استلام الهاتف، اطلب من البائع عرض رقم IMEI في الإعدادات وقارن أرقامه الخمسة عشر بما في التقرير.',
    'تطابق الرقمين يحدد الجهاز الذي يتناوله التقرير، لكنه لا يثبت سداد أقساطه.',
    'إذا اختلف الرقمان، فتحقق مما إذا كان التقرير يخص IMEI2. أجّل الدفع حتى تعرف أي جهاز خضع للفحص.',
  ],
}

const editions: Record<Locale, Edition> = {
  es: {
    source: ['Haz la comparación en persona. No necesitas publicar el IMEI completo ni pagar por localizarlo en tu teléfono.', 'Dónde encontrar el IMEI, según Apple', 'es-mx'],
    section: '¿Qué prueba cada dato que muestra el vendedor?',
    evidence: ['Dato disponible', 'Qué puedes comprobar', 'Qué sigue sin saberse'],
    rows: [
      ['IMEI del teléfono y del informe', 'Si coinciden los 15 dígitos del mismo identificador.', 'Si el equipo se reportó después de la consulta.'],
      ['Etiqueta de la caja', 'Si el número impreso coincide con el de la pantalla.', 'Si esa caja corresponde al iPhone de la entrega sin abrir Información.'],
      ['Captura con cuatro cifras visibles', 'Si el final es compatible con el del teléfono.', 'Si las once cifras ocultas también coinciden.'],
    ],
    followup: ['Si ya identificaste el equipo y falta saber qué operador lo bloquea, revisa qué incluye el informe de operador antes de pedirlo.', 'Ver qué incluye la consulta de operador', '/es/checar-imei-iphone'],
  },
  'fr-ca': {
    source: ['Faites la comparaison ensemble sur le téléphone. Vous pouvez trouver le numéro gratuitement, sans l’afficher dans une annonce publique.', 'Trouver l’IMEI sur un iPhone : instructions d’Apple', 'fr-ca'],
    section: 'Que permettent de vérifier les pièces présentées?',
    evidence: ['Pièce présentée', 'Vérification possible', 'Limite'],
    rows: [
      ['IMEI à l’écran et dans le rapport', 'Comparer les 15 chiffres du même identifiant.', 'Un rapport daté ne couvre pas un signalement ultérieur.'],
      ['Étiquette de la boîte', 'Comparer le numéro imprimé à celui de l’appareil.', 'La boîte seule ne permet pas d’identifier le téléphone remis.'],
      ['Capture où seuls quatre chiffres sont visibles', 'Écarter le rapport si les derniers chiffres diffèrent.', 'Les onze chiffres masqués peuvent être différents.'],
    ],
    followup: ['Le rapport correspond au téléphone, mais le nom de l’opérateur de verrouillage manque? Vérifiez si une recherche par IMEI répond à cette question.', 'Voir les renseignements sur l’opérateur', '/fr-ca/verifier-operateur-iphone-imei'],
  },
  pt: {
    source: ['Faça a conferência no encontro com o vendedor. Você pode localizar o identificador sem pagar e sem publicá-lo no anúncio.', 'Instruções da Apple para encontrar o IMEI', 'pt-br'],
    section: 'O que cada comprovante permite verificar?',
    evidence: ['O que o vendedor mostra', 'O que conferir', 'Limite da prova'],
    rows: [
      ['IMEI do aparelho e do relatório', 'Se os 15 dígitos do mesmo identificador coincidem.', 'Um relatório antigo não descarta um bloqueio posterior.'],
      ['Etiqueta da caixa', 'Se o número impresso é o mesmo que aparece nos Ajustes.', 'Só a embalagem não identifica o aparelho entregue.'],
      ['Foto com apenas os quatro últimos dígitos', 'Se o final do IMEI é compatível.', 'Os onze dígitos ocultos podem ser de outro aparelho.'],
    ],
    followup: ['O IMEI bate, mas ainda falta saber qual operadora bloqueou o iPhone? Confira o que a consulta identifica antes de contratar.', 'Ver detalhes da consulta de operadora', '/pt/verificar-operadora-iphone-imei'],
  },
  de: {
    source: ['Vergleichen Sie die Nummern vor Ort. Sie können die IMEI kostenlos ablesen, ohne sie in der Anzeige offenzulegen.', 'Apple-Anleitung zum Auffinden der IMEI', 'de-de'],
    section: 'Was belegen die Unterlagen des Verkäufers?',
    evidence: ['Beleg', 'Das lässt sich prüfen', 'Das bleibt offen'],
    rows: [
      ['IMEI am Gerät und im Bericht', 'Ob alle 15 Ziffern derselben Kennung übereinstimmen.', 'Ob nach dem Prüfdatum eine Meldung einging.'],
      ['Etikett auf der Verpackung', 'Ob die aufgedruckte Kennung der am Gerät entspricht.', 'Ob das übergebene Telefon tatsächlich aus dieser Schachtel stammt.'],
      ['Bild mit vier sichtbaren Endziffern', 'Ob bereits die Endziffern abweichen.', 'Ob auch die elf verdeckten Stellen übereinstimmen.'],
    ],
    followup: ['Gehört der Bericht zum Gerät, nennt aber den sperrenden Netzbetreiber nicht? Prüfen Sie, welche Angaben eine Betreiberabfrage liefert.', 'Umfang der Betreiberabfrage ansehen', '/de/iphone-simlock-betreiber-pruefen'],
  },
  ar: {
    source: ['يمكنكما مقارنة الرقمين معًا عند المعاينة من دون دفع رسوم أو نشر رقم الجهاز كاملًا في الإعلان.', 'دليل Apple للعثور على رقم IMEI', 'ar-ae'],
    section: 'ماذا تثبت المعلومات التي يعرضها البائع؟',
    evidence: ['ما يعرضه البائع', 'ما يمكن التحقق منه', 'ما لا يثبته'],
    rows: [
      ['رقم IMEI على الهاتف وفي التقرير', 'تطابق الأرقام الخمسة عشر للمعرّف نفسه.', 'عدم ورود بلاغ عن الجهاز بعد تاريخ التقرير.'],
      ['ملصق علبة الهاتف', 'تطابق الرقم المطبوع مع الرقم الظاهر على الجهاز.', 'أن العلبة تخص الهاتف المعروض إذا لم تفحص الهاتف نفسه.'],
      ['صورة تظهر آخر أربعة أرقام فقط', 'ما إذا كانت نهاية الرقم مختلفة.', 'تطابق الأرقام الأحد عشر المحجوبة.'],
    ],
    followup: ['إذا تأكدت أن التقرير يخص هاتفك ولم تعرف بعد اسم الشبكة التي تفرض القفل، فاطّلع على البيانات التي يوفرها فحص شركة الاتصالات.', 'اطّلع على تفاصيل فحص شبكة آيفون', '/ar/check-iphone-carrier-imei'],
  },
}

export function enrichEdition(article: Article): Article {
  const locale = article.locale
  if (!locale || locale === 'en' || article.translationGroup !== 'match-seller-report') return article
  const { source, section, evidence, rows, followup } = editions[locale]
  return {
    ...article,
    blocks: [
      ...article.blocks,
      { kind: 'p', text: source[0], links: [{ label: source[1], href: 'https://support.apple.com/' + source[2] + '/108037' }] },
      { kind: 'h2', id: 'seller-evidence', text: section },
      { kind: 'table', head: evidence, rows },
      { kind: 'cta', text: followup[0], label: followup[1], href: followup[2] },
    ],
  }
}
