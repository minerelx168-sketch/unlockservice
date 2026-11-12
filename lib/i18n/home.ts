import type {GeoLocale} from '../geo-locales'
import type {FaqEntry} from '../faq'
type Translations = readonly [string,string,string,string,string]
const languages=['es','fr','pt','de','ar'] as const
const copy = {
 "Not reported missing or stolen": [
  "Sin reporte de pérdida o robo",
  "Aucun signalement de perte ou de vol",
  "Sem registro de perda ou roubo",
  "Nicht als verloren oder gestohlen gemeldet",
  "غير مبلّغ عنه كمفقود أو مسروق"
 ],
 "A missing-device report can block the unlock. Run a Phone Check first if unsure.": [
  "Un reporte puede impedir el desbloqueo. Si tienes dudas, comprueba el IMEI primero.",
  "Un signalement peut bloquer le déverrouillage. En cas de doute, vérifiez d’abord l’IMEI.",
  "Um registro pode impedir o desbloqueio. Na dúvida, consulte o IMEI primeiro.",
  "Eine Verlustmeldung kann die Freigabe verhindern. Prüfen Sie im Zweifel zuerst die IMEI.",
  "قد يمنع البلاغ فتح القفل. افحص رقم IMEI أولاً إذا لم تكن متأكداً."
 ],
 "Account in good standing": [
  "Cuenta al corriente",
  "Compte en règle",
  "Conta em dia",
  "Konto ohne Rückstände",
  "حساب بلا مستحقات متأخرة"
 ],
 "An unpaid balance or active contract is the most common reason for a refusal.": [
  "Un saldo pendiente o un contrato vigente puede causar el rechazo.",
  "Un solde impayé ou un contrat en cours peut entraîner un refus.",
  "Saldo em aberto ou contrato ativo pode causar recusa.",
  "Offene Beträge oder laufende Verträge können zur Ablehnung führen.",
  "قد تؤدي المستحقات المتبقية أو العقد الساري إلى رفض الطلب."
 ],
 "Check financing requirements": [
  "Revisa el financiamiento",
  "Vérifiez le financement",
  "Confira o financiamento",
  "Finanzierung prüfen",
  "تحقّق من شروط التمويل"
 ],
 "Rules depend on the original carrier. If it refuses, card payments are refunded.": [
  "Las reglas dependen del operador original. Si rechaza el pedido, se reembolsa el pago con tarjeta.",
  "Les règles dépendent du fournisseur d’origine. En cas de refus, le paiement par carte est remboursé.",
  "As regras dependem da operadora original. Em caso de recusa, o pagamento no cartão é reembolsado.",
  "Es gelten die Regeln des ursprünglichen Anbieters. Bei Ablehnung werden Kartenzahlungen erstattet.",
  "تختلف الشروط بحسب المشغّل الأصلي. عند الرفض نردّ الدفعة بالبطاقة."
 ],
 "Choose your service": [
  "Elige el servicio",
  "Choisissez le service",
  "Escolha o serviço",
  "Dienst auswählen",
  "اختر الخدمة"
 ],
 "Pick your network or report and see the price and delivery time.": [
  "Elige la red o el informe para ver precio y plazo.",
  "Choisissez le réseau ou le rapport pour voir le prix et le délai.",
  "Escolha a rede ou o relatório para ver preço e prazo.",
  "Netz oder Bericht auswählen und Preis und Dauer ansehen.",
  "اختر الشبكة أو التقرير لمعرفة السعر والمدة."
 ],
 "Add your IMEI and review": [
  "Ingresa tu IMEI y revisa el pedido",
  "Entrez l’IMEI et vérifiez la commande",
  "Informe o IMEI e confira",
  "IMEI eingeben und prüfen",
  "أدخل رقم IMEI وراجع الطلب"
 ],
 "Dial *#06# for the 15-digit IMEI, add your email, then pay by card or crypto.": [
  "Marca *#06# para ver el IMEI de 15 dígitos, agrega tu correo y paga con tarjeta o criptomonedas.",
  "Composez *#06# pour obtenir l’IMEI à 15 chiffres, ajoutez votre courriel et payez par carte ou en cryptomonnaie.",
  "Digite *#06# para ver o IMEI de 15 dígitos, informe seu e-mail e pague com cartão ou cripto.",
  "Mit *#06# die 15-stellige IMEI anzeigen, E-Mail angeben und per Karte oder Krypto bezahlen.",
  "اطلب ‎*#06#‎ لعرض رقم IMEI المكوّن من 15 رقماً، ثم أدخل بريدك وادفع بالبطاقة أو بالعملات الرقمية."
 ],
 "Use a supported SIM": [
  "Usa una SIM compatible",
  "Utilisez une carte SIM compatible",
  "Use um SIM compatível",
  "Kompatible SIM einsetzen",
  "استخدم شريحة متوافقة"
 ],
 "Follow the instructions you receive and insert your new SIM. Refused orders are refunded.": [
  "Sigue las instrucciones e inserta la nueva SIM. Los pedidos rechazados se reembolsan.",
  "Suivez les instructions reçues et insérez votre nouvelle SIM. Les commandes refusées sont remboursées.",
  "Siga as instruções e insira o novo SIM. Pedidos recusados são reembolsados.",
  "Anweisungen befolgen und neue SIM einsetzen. Abgelehnte Aufträge werden erstattet.",
  "اتبع التعليمات وأدخل الشريحة الجديدة. نردّ قيمة الطلبات المرفوضة."
 ],
 "Network unlock": [
  "Desbloqueo de red",
  "Déverrouillage réseau",
  "Desbloqueio de rede",
  "Netzentsperrung",
  "فتح قفل الشبكة"
 ],
 "Remove the carrier lock by IMEI. Price and turnaround quoted per network.": [
  "Quita el bloqueo del operador por IMEI. El precio y el plazo dependen de la red.",
  "Retirez le verrouillage réseau par IMEI. Le prix et le délai varient selon le réseau.",
  "Remova o bloqueio de operadora pelo IMEI. Preço e prazo variam por rede.",
  "Netzsperre per IMEI entfernen. Preis und Dauer hängen vom Netz ab.",
  "افتح قفل المشغّل عبر IMEI. يختلف السعر والوقت حسب الشبكة."
 ],
 "Phone Check reports": [
  "Informes del teléfono",
  "Rapports sur l’appareil",
  "Relatórios do aparelho",
  "Geräteberichte",
  "تقارير الهاتف"
 ],
 "Carrier, blacklist, warranty, activation lock and more, from the IMEI alone.": [
  "Consulta operador, lista negra, garantía y bloqueo de activación por IMEI.",
  "Vérifiez par IMEI le fournisseur, la liste noire, la garantie et le verrouillage d’activation.",
  "Consulte operadora, lista de bloqueio, garantia e bloqueio de ativação pelo IMEI.",
  "Anbieter, Sperrliste, Garantie und Aktivierungssperre per IMEI prüfen.",
  "تحقّق عبر IMEI من المشغّل والقائمة السوداء والضمان وقفل التنشيط."
 ],
 "Blacklist and missing-device": [
  "Lista negra y equipos extraviados",
  "Liste noire et appareils perdus",
  "Lista de bloqueio e aparelhos perdidos",
  "Sperrliste und vermisste Geräte",
  "القائمة السوداء والأجهزة المفقودة"
 ],
 "The one report to run before paying for a used phone.": [
  "Consulta este informe antes de pagar por un teléfono usado.",
  "Consultez ce rapport avant de payer un téléphone d’occasion.",
  "Consulte antes de pagar por um celular usado.",
  "Vor dem Kauf eines gebrauchten Handys prüfen.",
  "افحص التقرير قبل دفع ثمن هاتف مستعمل."
 ],
 "Apple Free Check": [
  "Consulta gratuita de Apple",
  "Vérification Apple gratuite",
  "Consulta gratuita Apple",
  "Kostenlose Apple-Prüfung",
  "فحص Apple المجاني"
 ],
 "Get Apple Basic Info with 3 free checks per verified account each day.": [
  "Obtén información básica de Apple: 3 consultas gratis al día por cuenta verificada.",
  "Obtenez les renseignements de base Apple : 3 vérifications gratuites par jour et par compte vérifié.",
  "Veja os dados básicos Apple: 3 consultas grátis por dia por conta verificada.",
  "Apple-Gerätedaten: 3 kostenlose Abfragen pro Tag und verifiziertem Konto.",
  "اعرض بيانات Apple الأساسية مجاناً ثلاث مرات يومياً لكل حساب موثّق."
 ],
 "Free": [
  "Gratis",
  "Gratuit",
  "Grátis",
  "Kostenlos",
  "مجاني"
 ],
 "Track an order": [
  "Rastrear pedido",
  "Suivre une commande",
  "Acompanhar pedido",
  "Auftrag verfolgen",
  "تتبّع طلب"
 ],
 "Live status for every order, and the result kept on the order page.": [
  "Consulta el estado actual y el resultado en la página del pedido.",
  "Retrouvez l’état et le résultat sur la page de commande.",
  "Consulte o andamento e o resultado na página do pedido.",
  "Status und Ergebnis auf der Auftragsseite ansehen.",
  "تابع حالة الطلب واطّلع على النتيجة في صفحته."
 ],
 "Guides": [
  "Guías",
  "Guides",
  "Guias",
  "Ratgeber",
  "الأدلة"
 ],
 "Carrier policies, unlock timing and what an IMEI check really tells you.": [
  "Políticas de operadores, plazos y qué revela una consulta de IMEI.",
  "Politiques des fournisseurs, délais et portée d’une vérification IMEI.",
  "Regras das operadoras, prazos e o que o IMEI revela.",
  "Anbieterregeln, Bearbeitungszeiten und Aussagekraft einer IMEI-Prüfung.",
  "سياسات المشغّلين ومدد التنفيذ وما يكشفه فحص IMEI."
 ],
 "Remote": [
  "A distancia",
  "À distance",
  "Remoto",
  "Aus der Ferne",
  "عن بُعد"
 ],
 "No shop visit": [
  "Sin ir a una tienda",
  "Sans visite en magasin",
  "Sem ir à loja",
  "Kein Ladenbesuch",
  "دون زيارة متجر"
 ],
 "Pay per order": [
  "Paga por pedido",
  "Paiement par commande",
  "Pague por pedido",
  "Pro Auftrag zahlen",
  "الدفع لكل طلب"
 ],
 "Card or crypto": [
  "Tarjeta o cripto",
  "Carte ou crypto",
  "Cartão ou cripto",
  "Karte oder Krypto",
  "بطاقة أو عملات رقمية"
 ],
 "Carrier-approved": [
  "Autorizado por el operador",
  "Autorisé par le fournisseur",
  "Autorizado pela operadora",
  "Vom Anbieter freigegeben",
  "بموافقة المشغّل"
 ],
 "Permanent unlock": [
  "Desbloqueo permanente",
  "Déverrouillage permanent",
  "Desbloqueio permanente",
  "Dauerhafte Entsperrung",
  "فتح دائم"
 ],
 "Unlock your phone.": [
  "Desbloquea tu teléfono.",
  "Déverrouillez votre téléphone.",
  "Desbloqueie seu celular.",
  "Entsperren Sie Ihr Handy.",
  "افتح قفل هاتفك."
 ],
 "Know your phone.": [
  "Conoce tu teléfono.",
  "Découvrez votre appareil.",
  "Conheça seu celular.",
  "Lernen Sie Ihr Gerät kennen.",
  "تعرّف على هاتفك."
 ],
 "See the price and delivery time for your network before you pay.": [
  "Consulta el precio y el plazo de tu red antes de pagar.",
  "Voyez le prix et le délai de votre réseau avant de payer.",
  "Veja o preço e o prazo da sua rede antes de pagar.",
  "Preis und Dauer für Ihr Netz vor der Zahlung ansehen.",
  "اعرف سعر الخدمة ومدتها لشبكتك قبل الدفع."
 ],
 "Compare device reports and unlock services, then pay by card or crypto.": [
  "Compara informes y desbloqueos; paga con tarjeta o cripto.",
  "Comparez les rapports et les déverrouillages, puis payez par carte ou en crypto.",
  "Compare relatórios e desbloqueios e pague com cartão ou cripto.",
  "Berichte und Entsperrungen vergleichen und per Karte oder Krypto zahlen.",
  "قارن التقارير وخدمات فتح القفل ثم ادفع بالبطاقة أو بالعملات الرقمية."
 ],
 "Unlock ordering is paused.": [
  "Los pedidos de desbloqueo están en pausa.",
  "Les commandes de déverrouillage sont suspendues.",
  "Os pedidos de desbloqueio estão pausados.",
  "Entsperraufträge sind derzeit pausiert.",
  "طلبات فتح القفل متوقفة مؤقتاً."
 ],
 "You can browse service prices and follow existing orders.": [
  "Puedes ver precios y rastrear tus pedidos.",
  "Vous pouvez consulter les prix et suivre vos commandes.",
  "Você pode ver preços e acompanhar pedidos.",
  "Sie können Preise ansehen und Aufträge verfolgen.",
  "يمكنك عرض الأسعار وتتبّع طلباتك."
 ],
 "iUnlockmobile since 2016": [
  "iUnlockMobile desde 2016",
  "iUnlockMobile depuis 2016",
  "iUnlockMobile desde 2016",
  "iUnlockMobile seit 2016",
  "iUnlockMobile منذ 2016"
 ],
 "See your options.": [
  "Conoce tus opciones.",
  "Voyez vos options.",
  "Veja suas opções.",
  "Ihre Möglichkeiten im Überblick.",
  "اطّلع على خياراتك."
 ],
 "Quick picks": [
  "Accesos rápidos",
  "Raccourcis",
  "Acesso rápido",
  "Schnellauswahl",
  "اختصارات"
 ],
 "All services →": [
  "Todos los servicios →",
  "Tous les services →",
  "Todos os serviços →",
  "Alle Dienste →",
  "جميع الخدمات ←"
 ],
 "Unlock my phone": [
  "Desbloquear mi teléfono",
  "Déverrouiller mon téléphone",
  "Desbloquear meu celular",
  "Mein Handy entsperren",
  "فتح قفل هاتفي"
 ],
 "Global carriers": [
  "Operadores internacionales",
  "Fournisseurs internationaux",
  "Operadoras internacionais",
  "Internationale Anbieter",
  "مشغّلون حول العالم"
 ],
 "Carriers": [
  "Operadores",
  "Réseaux",
  "Redes",
  "Unterstützte",
  "الشبكات"
 ],
 "We Unlock": [
  "compatibles",
  "pris en charge",
  "compatíveis",
  "Mobilfunknetze",
  "المدعومة"
 ],
 "Not listed? The full catalog has more networks.": [
  "¿No aparece? Hay más redes en el catálogo completo.",
  "Votre réseau est absent? Consultez le catalogue complet.",
  "Não encontrou? Veja mais redes no catálogo completo.",
  "Netz fehlt? Im vollständigen Katalog finden Sie weitere.",
  "لم تجد شبكتك؟ راجع القائمة الكاملة."
 ],
 "Find your network": [
  "Buscar mi red",
  "Trouver mon réseau",
  "Encontrar minha rede",
  "Netz suchen",
  "ابحث عن شبكتك"
 ],
 "Before you order": [
  "Antes de pedir",
  "Avant de commander",
  "Antes do pedido",
  "Vor der Bestellung",
  "قبل الطلب"
 ],
 "Is your phone eligible?": [
  "¿Tu teléfono cumple los requisitos?",
  "Votre appareil est-il admissible?",
  "Seu celular é elegível?",
  "Ist Ihr Handy geeignet?",
  "هل هاتفك مؤهل؟"
 ],
 "Thirty seconds of checking saves a refused order. Three things decide it.": [
  "Revisa estos tres puntos para evitar un rechazo.",
  "Vérifiez ces trois points pour éviter un refus.",
  "Confira estes três pontos para evitar uma recusa.",
  "Prüfen Sie diese drei Punkte, um eine Ablehnung zu vermeiden.",
  "راجع هذه النقاط الثلاث لتفادي رفض الطلب."
 ],
 "Not sure? If the network refuses the device, your payment or credit comes back.": [
  "Si el operador rechaza el equipo, se devuelve el pago o el crédito.",
  "Si le fournisseur refuse l’appareil, le paiement ou le crédit est remboursé.",
  "Se a operadora recusar, o pagamento ou crédito é devolvido.",
  "Lehnt der Anbieter ab, erhalten Sie Zahlung oder Guthaben zurück.",
  "إذا رفض المشغّل الجهاز نعيد المبلغ أو الرصيد."
 ],
 "How it works": [
  "Cómo funciona",
  "Fonctionnement",
  "Como funciona",
  "So funktioniert es",
  "كيف تعمل الخدمة"
 ],
 "Three steps.": [
  "Tres pasos.",
  "Trois étapes.",
  "Três passos.",
  "Drei Schritte.",
  "ثلاث خطوات."
 ],
 "Nothing to install.": [
  "Sin instalar nada.",
  "Aucune installation.",
  "Sem instalações.",
  "Keine Installation.",
  "دون تثبيت برامج."
 ],
 "The phone stays in your hand the whole time.": [
  "El teléfono permanece en tus manos.",
  "Vous gardez toujours votre téléphone.",
  "O celular fica com você o tempo todo.",
  "Das Handy bleibt bei Ihnen.",
  "يبقى الهاتف معك طوال الوقت."
 ],
 "Common questions": [
  "Preguntas frecuentes",
  "Questions fréquentes",
  "Perguntas frequentes",
  "Häufige Fragen",
  "الأسئلة الشائعة"
 ],
 "Straight answers before you pay.": [
  "Respuestas claras antes de pagar.",
  "Des réponses claires avant de payer.",
  "Respostas claras antes de pagar.",
  "Klare Antworten vor der Zahlung.",
  "إجابات واضحة قبل الدفع."
 ],
 "Including the one most unlock sites leave out — when it will not work.": [
  "También explicamos cuándo no funcionará el desbloqueo.",
  "Nous expliquons aussi quand le déverrouillage ne fonctionnera pas.",
  "Explicamos também quando o desbloqueio não funciona.",
  "Auch wann eine Entsperrung nicht funktioniert, erfahren Sie hier.",
  "نوضّح أيضاً متى يتعذّر فتح القفل."
 ],
 "Still have a question? Visit the help centre": [
  "¿Más dudas? Visita el centro de ayuda",
  "D’autres questions? Consultez le centre d’aide",
  "Ainda tem dúvidas? Visite a central de ajuda",
  "Noch Fragen? Zum Hilfecenter",
  "هل لديك سؤال آخر؟ زر مركز المساعدة"
 ],
 "Supported devices": [
  "Dispositivos compatibles",
  "Appareils pris en charge",
  "Aparelhos compatíveis",
  "Unterstützte Geräte",
  "الأجهزة المدعومة"
 ],
 "Top Brands": [
  "Marcas",
  "Marques",
  "Marcas",
  "Unterstützte",
  "العلامات التجارية"
 ],
 "We Support": [
  "compatibles",
  "prises en charge",
  "compatíveis",
  "Marken",
  "المدعومة"
 ],
 "Everything on offer": [
  "Todos los servicios",
  "Tous nos services",
  "Nossos serviços",
  "Unser Angebot",
  "جميع خدماتنا"
 ],
 "One place for the lock": [
  "Desbloqueos",
  "Déverrouillages",
  "Desbloqueios",
  "Entsperrungen",
  "فتح الأقفال"
 ],
 "and the facts.": [
  "e informes.",
  "et rapports.",
  "e relatórios.",
  "und Berichte.",
  "والتقارير."
 ],
 "Learn more": [
  "Más información",
  "En savoir plus",
  "Saiba mais",
  "Mehr erfahren",
  "معرفة المزيد"
 ],
 "Not sure which one you need?": [
  "¿No sabes qué servicio elegir?",
  "Vous hésitez entre deux services?",
  "Não sabe qual serviço escolher?",
  "Unsicher, welchen Dienst Sie brauchen?",
  "لا تعرف أي خدمة تختار؟"
 ],
 "Buying used, switching network or seeing “SIM not supported”? The help centre points you to the right service.": [
  "¿Compras un equipo usado, cambias de red o ves «SIM no compatible»? Te ayudamos a elegir.",
  "Achat d’occasion, changement de réseau ou SIM non prise en charge? Le centre d’aide vous oriente.",
  "Vai comprar usado, trocar de rede ou viu «SIM incompatível»? A central de ajuda orienta você.",
  "Gebrauchtkauf, Netzwechsel oder SIM nicht unterstützt? Das Hilfecenter hilft bei der Auswahl.",
  "هل تشتري جهازاً مستعملاً أو تغيّر الشبكة أو تظهر رسالة شريحة غير مدعومة؟ يساعدك مركز المساعدة."
 ],
 "Open the help centre": [
  "Abrir centro de ayuda",
  "Ouvrir le centre d’aide",
  "Abrir central de ajuda",
  "Zum Hilfecenter",
  "فتح مركز المساعدة"
 ],
 "Contact support": [
  "Contactar a soporte",
  "Joindre le soutien",
  "Falar com o suporte",
  "Support kontaktieren",
  "التواصل مع الدعم"
 ],
 "{n} networks": [
  "{n} redes",
  "{n} réseaux",
  "{n} redes",
  "{n} Netze",
  "{n} شبكات"
 ],
 "In {n} countries": [
  "En {n} países",
  "Dans {n} pays",
  "Em {n} países",
  "In {n} Ländern",
  "في {n} دول"
 ],
 "{n} networks in {c} countries. See the price and turnaround before you order.": [
  "{n} redes en {c} países. Consulta precio y plazo antes de pedir.",
  "{n} réseaux dans {c} pays. Voyez le prix et le délai avant de commander.",
  "{n} redes em {c} países. Veja preço e prazo antes de pedir.",
  "{n} Netze in {c} Ländern. Preis und Dauer vor der Bestellung ansehen.",
  "{n} شبكات في {c} دول. راجع السعر والمدة قبل الطلب."
 ],
 "Explore services for {n} leading phone brands. Review eligibility and compatible radio bands before ordering.": [
  "Consulta servicios para {n} marcas. Revisa los requisitos y las bandas compatibles antes de pedir.",
  "Découvrez les services pour {n} marques. Vérifiez l’admissibilité et les bandes compatibles avant de commander.",
  "Veja serviços para {n} marcas. Confira os requisitos e as bandas compatíveis antes de pedir.",
  "Dienste für {n} Marken. Voraussetzungen und Frequenzbänder vor der Bestellung prüfen.",
  "استعرض خدمات {n} علامات تجارية. تحقّق من الأهلية والترددات المتوافقة قبل الطلب."
 ],
 "Blacklist": [
  "Lista negra",
  "Liste noire",
  "Lista de bloqueio",
  "Sperrliste",
  "القائمة السوداء"
 ],
 "Any brand": [
  "Cualquier marca",
  "Toutes marques",
  "Qualquer marca",
  "Alle Marken",
  "أي علامة تجارية"
 ],
 "Carrier & lock": [
  "Operador y bloqueo",
  "Fournisseur et verrouillage",
  "Operadora e bloqueio",
  "Anbieter und Sperre",
  "المشغّل والقفل"
 ],
 "Apple devices": [
  "Dispositivos Apple",
  "Appareils Apple",
  "Aparelhos Apple",
  "Apple-Geräte",
  "أجهزة Apple"
 ],
 "Device facts": [
  "Datos del equipo",
  "Données de l’appareil",
  "Dados do aparelho",
  "Gerätedaten",
  "بيانات الجهاز"
 ],
 "Model, warranty, dates": [
  "Modelo, garantía y fechas",
  "Modèle, garantie et dates",
  "Modelo, garantia e datas",
  "Modell, Garantie, Daten",
  "الطراز والضمان والتواريخ"
 ],
 "Samsung Knox": [
  "Samsung Knox",
  "Samsung Knox",
  "Samsung Knox",
  "Samsung Knox",
  "Samsung Knox"
 ],
 "Knox Guard & lock": [
  "Knox Guard y bloqueo",
  "Knox Guard et verrouillage",
  "Knox Guard e bloqueio",
  "Knox Guard und Sperre",
  "Knox Guard والقفل"
 ],
 "Networks": [
  "Redes",
  "Réseaux",
  "Redes",
  "Netze",
  "الشبكات"
 ],
 "Brands": [
  "Marcas",
  "Marques",
  "Marcas",
  "Marken",
  "العلامات التجارية"
 ]
} satisfies Record<string,Translations>
const questions = [
 [
  "¿Qué cambia al desbloquear la red?",
  "Que change le déverrouillage réseau?",
  "O que muda ao desbloquear a rede?",
  "Was ändert eine Netzentsperrung?",
  "ما الذي يتغيّر بعد فتح قفل الشبكة؟"
 ],
 [
  "Elimina la restricción del operador en equipos elegibles. No elimina el bloqueo de activación, las deudas ni los reportes de robo. Revisa los requisitos, el método y la garantía del servicio.",
  "Il retire la restriction du fournisseur sur les appareils admissibles, sans lever le verrouillage d’activation, une dette ou un signalement de vol. Vérifiez les conditions et la garantie du service.",
  "Remove a restrição da operadora em aparelhos elegíveis. Não remove bloqueio de ativação, financiamento ou registro de roubo. Confira método, requisitos e garantia do serviço.",
  "Sie entfernt bei berechtigten Geräten die Netzsperre, nicht aber Aktivierungssperren, Finanzierung oder Diebstahlmeldungen. Prüfen Sie Verfahren, Bedingungen und Garantie des Dienstes.",
  "يزيل قيد المشغّل للأجهزة المؤهلة، ولا يزيل قفل التنشيط أو التمويل أو بلاغ السرقة. راجع طريقة التنفيذ والشروط والضمان قبل الطلب."
 ],
 [
  "¿Cuánto tarda?",
  "Quel est le délai?",
  "Quanto tempo leva?",
  "Wie lange dauert es?",
  "كم تستغرق الخدمة؟"
 ],
 [
  "Según la red, puede tardar horas o días. Verás el plazo de tu operador antes de pedir y podrás seguir el estado del pedido.",
  "Selon le fournisseur, comptez des heures ou quelques jours. Le délai est affiché avant la commande, que vous pouvez ensuite suivre.",
  "Dependendo da operadora, pode levar horas ou dias. Veja o prazo antes de pedir e acompanhe o andamento.",
  "Je nach Anbieter dauert es Stunden oder Tage. Die Schätzung sehen Sie vor der Bestellung, den Status auf der Auftragsseite.",
  "تختلف المدة من ساعات إلى أيام حسب الشبكة. يظهر التقدير قبل الطلب ويمكنك متابعة الحالة لاحقاً."
 ],
 [
  "¿Qué pasa si no se puede desbloquear?",
  "Et si l’appareil ne peut pas être déverrouillé?",
  "E se não for possível desbloquear?",
  "Was passiert bei einer Ablehnung?",
  "ماذا يحدث إذا تعذّر فتح القفل؟"
 ],
 [
  "Solicitamos la devolución íntegra del pago directo a la tarjeta original, incluida la comisión. Si ya usaste o reservaste crédito de un pago pequeño, soporte revisa el caso. El plazo depende del banco. Los reembolsos cripto se revisan manualmente; el saldo reservado vuelve a la cuenta.",
  "Nous demandons le remboursement intégral sur la carte d’origine, frais inclus. Si un crédit issu d’un petit paiement est déjà utilisé ou réservé, le soutien examine le dossier. Les délais bancaires varient. Les remboursements en crypto sont examinés manuellement; les crédits réservés sont libérés.",
  "Solicitamos estorno integral no cartão original, incluindo a taxa. Se o crédito de um pagamento pequeno já foi usado ou reservado, o suporte analisa o caso. O prazo depende do banco. Reembolsos em cripto exigem análise manual; o saldo reservado volta à conta.",
  "Bei direkter Kartenzahlung beantragen wir die volle Erstattung samt Gebühr auf die ursprüngliche Karte. Bereits genutztes oder gebundenes Guthaben aus Kleinzahlungen prüft der Support. Banklaufzeiten variieren. Kryptozahlungen prüfen wir manuell; reserviertes Kontoguthaben wird freigegeben.",
  "نطلب ردّ كامل دفعة البطاقة مع الرسوم إلى البطاقة الأصلية. يراجع الدعم الحالات التي استُخدم فيها رصيد دفعة صغيرة أو حُجز. تختلف المدة حسب البنك. تُراجع مدفوعات العملات الرقمية يدوياً ويُعاد رصيد الحساب المحجوز."
 ],
 [
  "¿Dónde encuentro mi IMEI?",
  "Où trouver mon IMEI?",
  "Onde encontro o IMEI?",
  "Wo finde ich meine IMEI?",
  "أين أجد رقم IMEI؟"
 ],
 [
  "Marca *#06# o abre la información del teléfono en Ajustes. También puede estar en la caja original o en la bandeja SIM.",
  "Composez *#06# ou consultez les informations de l’appareil dans les réglages. L’IMEI peut aussi figurer sur la boîte ou le tiroir SIM.",
  "Digite *#06# ou abra as informações do aparelho nos ajustes. O IMEI também pode estar na caixa ou na bandeja do SIM.",
  "Wählen Sie *#06# oder öffnen Sie die Geräteinformationen. Die IMEI kann auch auf der Verpackung oder dem SIM-Fach stehen.",
  "اطلب ‎*#06#‎ أو افتح معلومات الجهاز في الإعدادات. قد تجده أيضاً على العلبة الأصلية أو درج الشريحة."
 ],
 [
  "¿Tengo que enviar mi teléfono?",
  "Dois-je expédier le téléphone?",
  "Preciso enviar o celular?",
  "Muss ich das Handy einschicken?",
  "هل أحتاج إلى إرسال الهاتف؟"
 ],
 [
  "No. El trámite se hace a distancia con el IMEI. En Apple, conéctate a wifi y sigue las instrucciones. En otros equipos puede ser necesario ingresar un código con la SIM de la nueva red.",
  "Non. Le traitement utilise l’IMEI à distance. Sur Apple, connectez-vous au Wi-Fi et suivez les instructions. Sur d’autres appareils, un code peut être requis avec la nouvelle SIM.",
  "Não. Tudo é feito remotamente pelo IMEI. No Apple, conecte ao Wi-Fi e siga as instruções. Outros aparelhos podem pedir um código com o SIM da nova rede.",
  "Nein. Der Vorgang läuft per IMEI aus der Ferne. Bei Apple folgen Sie über WLAN den Anweisungen. Andere Geräte benötigen eventuell einen Code mit der neuen SIM.",
  "لا. تُنفّذ الخدمة عن بُعد عبر IMEI. على أجهزة Apple اتصل بالواي فاي واتبع التعليمات. وقد تحتاج أجهزة أخرى إلى رمز مع الشريحة الجديدة."
 ],
 [
  "¿Se puede desbloquear un teléfono con contrato vigente?",
  "Peut-on déverrouiller un appareil encore sous contrat?",
  "É possível desbloquear um aparelho com contrato ativo?",
  "Geht das bei einem laufenden Vertrag?",
  "هل يمكن فتح هاتف ما زال مرتبطاً بعقد؟"
 ],
 [
  "Depende del operador. Un adeudo, contrato activo o reporte de pérdida puede impedirlo. Si el operador rechaza el pedido, se devuelve el pago directo a la tarjeta original o se libera el saldo reservado.",
  "Cela dépend du fournisseur. Un solde impayé, un contrat actif ou une déclaration de perte peuvent empêcher le déverrouillage. En cas de refus, la carte d’origine est remboursée ou les crédits réservés sont libérés.",
  "Depende da operadora. Dívida, contrato ativo ou registro de perda podem impedir o desbloqueio. Em caso de recusa, o pagamento no cartão é estornado ou o saldo reservado é liberado.",
  "Das hängt vom Anbieter ab. Offene Beträge, Laufzeitverträge oder Verlustmeldungen können die Freigabe verhindern. Bei Ablehnung erfolgt die Erstattung auf die ursprüngliche Karte oder die Freigabe des Guthabens.",
  "يعتمد ذلك على المشغّل. قد يمنع الدين أو العقد الساري أو بلاغ الفقد فتح القفل. عند الرفض نردّ الدفعة إلى البطاقة الأصلية أو نحرر الرصيد المحجوز."
 ],
 [
  "¿Cómo pago mi pedido?",
  "Comment payer ma commande?",
  "Como pago meu pedido?",
  "Wie bezahle ich den Auftrag?",
  "كيف أدفع قيمة الطلب؟"
 ],
 [
  "Paga con tarjeta (+5 %) o con USDT/USDC en BNB Smart Chain (BEP20), sin mínimo ni comisión de plataforma. Pueden aplicarse cargos de red o del exchange. También puedes usar saldo existente. El trámite comienza tras confirmar el pago.",
  "Payez par carte (+5 %) ou en USDT/USDC sur BNB Smart Chain (BEP20), sans minimum ni frais de plateforme. Des frais de réseau ou d’échange peuvent s’appliquer. Le solde existant est aussi accepté. Le traitement commence après confirmation.",
  "Pague com cartão (+5%) ou USDT/USDC na BNB Smart Chain (BEP20), sem mínimo nem taxa da plataforma. A rede ou corretora pode cobrar tarifas. Você também pode usar saldo existente. O serviço começa após a confirmação.",
  "Per Karte (+5 %) oder USDT/USDC auf der BNB Smart Chain (BEP20), ohne Mindestbetrag oder Plattformgebühr. Netzwerk- oder Börsengebühren sind möglich. Vorhandenes Guthaben ist ebenfalls nutzbar. Die Bearbeitung beginnt nach Zahlungsbestätigung.",
  "ادفع بالبطاقة مع رسوم 5٪ أو عبر USDT وUSDC على شبكة BNB Smart Chain ‏(BEP20) بلا حد أدنى أو رسوم منصة. قد تُفرض رسوم شبكة أو صرافة. يمكنك أيضاً استخدام رصيد حسابك. يبدأ التنفيذ بعد تأكيد الدفع."
 ],
 [
  "¿Puedo pagar sin crear una cuenta?",
  "Puis-je payer sans créer de compte?",
  "Posso pagar sem criar conta?",
  "Kann ich ohne Konto bezahlen?",
  "هل يمكنني الدفع دون إنشاء حساب؟"
 ],
 [
  "Sí, con cripto o con tarjeta para servicios desde 1 USD. Ingresa IMEI y correo para recibir el resultado y el enlace de seguimiento. Para servicios inferiores a 1 USD con tarjeta, inicia sesión o regístrate. Pagas 1 USD más el 5 % y la diferencia queda como saldo.",
  "Oui, en crypto ou par carte pour un service d’au moins 1 USD. Entrez l’IMEI et votre courriel pour obtenir le suivi et le résultat. Sous 1 USD par carte, connectez-vous ou inscrivez-vous. Vous payez 1 USD plus 5 % et la différence devient un crédit.",
  "Sim, com cripto ou cartão para serviços a partir de US$ 1. Informe IMEI e e-mail para receber o resultado e o link de acompanhamento. Abaixo de US$ 1 no cartão, entre ou cadastre-se. Você paga US$ 1 mais 5% e a diferença vira saldo.",
  "Ja, mit Krypto oder per Karte ab 1 USD Dienstpreis. Geben Sie IMEI und E-Mail für Ergebnis und privaten Statuslink an. Unter 1 USD ist bei Kartenzahlung ein Konto nötig. Sie zahlen 1 USD plus 5 %; die Differenz zum Preis wird gutgeschrieben.",
  "نعم، بالعملات الرقمية أو بالبطاقة لخدمة سعرها دولار واحد أو أكثر. أدخل IMEI وبريدك للحصول على النتيجة ورابط التتبّع. إذا قلّ السعر عن دولار عند الدفع بالبطاقة، سجّل الدخول أو أنشئ حساباً. تدفع دولاراً مع 5٪ ويُضاف فرق السعر إلى رصيدك."
 ],
 [
  "¿Funcionará cualquier SIM después?",
  "Toute carte SIM fonctionnera-t-elle ensuite?",
  "Qualquer SIM funcionará depois?",
  "Funktioniert danach jede SIM?",
  "هل تعمل أي شريحة بعد فتح القفل؟"
 ],
 [
  "La red debe usar bandas compatibles con el equipo. El desbloqueo elimina la restricción del operador, pero no añade bandas de radio.",
  "Le réseau doit utiliser des bandes compatibles avec l’appareil. Le déverrouillage retire la restriction du fournisseur sans ajouter de bandes radio.",
  "A rede precisa usar bandas compatíveis. O desbloqueio remove a restrição da operadora, mas não adiciona frequências ao aparelho.",
  "Das Gerät muss die Frequenzbänder des Netzes unterstützen. Die Entsperrung hebt nur die Netzsperre auf und fügt keine Frequenzbänder hinzu.",
  "يجب أن تدعم ترددات الهاتف شبكة الشريحة الجديدة. يزيل فتح القفل قيد المشغّل ولا يضيف ترددات جديدة."
 ]
] satisfies Translations[]
export function homeText(l:GeoLocale,k:string){return l==='en'?k:(copy[k as keyof typeof copy]?.[languages.indexOf(l)]??k)}
export function homeFaq(l:GeoLocale,english:FaqEntry[]){if(l==='en')return english
 const i=languages.indexOf(l);return english.map((_,n)=>({question:questions[n*2][i],answer:questions[n*2+1][i]}))}
