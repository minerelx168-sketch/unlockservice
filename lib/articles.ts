/**
 * The guides at /articles.
 *
 * Content is structured data, not markdown: no parser to add, nothing to
 * sanitise, and a broken heading or a link to a route that does not exist
 * fails `tsc` and the tests rather than shipping. Every claim here has to
 * match what the service actually does — a guide that oversells is the one
 * search engines and customers both punish.
 */

export type ArticleBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h2'; text: string; id: string }
  | { kind: 'list'; ordered?: boolean; items: string[] }
  | { kind: 'note'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'cta'; text: string; href: string; label: string }

export type ArticleFaq = { question: string; answer: string }

export type Article = {
  slug: string
  /**
   * The meta title. Kept short because app/layout.tsx appends
   * " — iUnlockMobile" to it, and the pair has to survive a SERP.
   */
  title: string
  /** The <h1>, which has a whole page to sit in rather than a result row. */
  heading: string
  /** 120–160 characters: what a search result shows under the link. */
  description: string
  /** One line under the heading, in the page. */
  standfirst: string
  published: string
  updated: string
  minutes: number
  topic: string
  blocks: ArticleBlock[]
  faq?: ArticleFaq[]
}

const ARTICLES: Article[] = [
  {
    slug: 'what-an-imei-check-tells-you',
    title: 'What an IMEI check actually tells you',
    heading: 'What an IMEI check actually tells you.',
    description:
      'An IMEI check reads what networks and manufacturers already know about a handset: the model behind the number, whether it is blacklisted, and which carrier it belongs to.',
    standfirst:
      'The number is fifteen digits long and it is the only name your phone has that a network recognises. Here is what can be read from it, and what cannot.',
    published: '2026-09-07',
    updated: '2026-09-07',
    minutes: 6,
    topic: 'Basics',
    blocks: [
      {
        kind: 'p',
        text: 'Every phone that has ever connected to a mobile network carries an IMEI — an International Mobile Equipment Identity. It identifies the handset itself, not the SIM card and not the person holding it. Dial *#06# on any phone and it appears; on iPhone it is also in Settings › General › About, and on most Android handsets in Settings › About phone.',
      },
      {
        kind: 'h2',
        id: 'what-the-number-is-made-of',
        text: 'What the number is made of',
      },
      {
        kind: 'p',
        text: 'The fifteen digits are not random. The first eight are the Type Allocation Code, which identifies the model — that is how a check can tell you a number belongs to an iPhone 15 Pro 256GB rather than something else, before anyone has taken the phone out of the box. The next six are the serial number of that particular handset within the model. The last digit is a checksum.',
      },
      {
        kind: 'p',
        text: 'The checksum is a Luhn digit, the same arithmetic that validates card numbers. It exists to catch a mistyped or misread number, and it is the first thing any honest check does. A number that fails the checksum is not a phone that does not exist — it is almost always a digit typed wrong.',
      },
      {
        kind: 'note',
        text: 'A free format check confirms the number is well formed. It cannot tell you anything about the phone itself: that needs a lookup against the databases networks and manufacturers keep.',
      },
      {
        kind: 'h2',
        id: 'what-a-lookup-can-return',
        text: 'What a lookup can return',
      },
      {
        kind: 'table',
        head: ['Check', 'What it answers', 'Why it matters'],
        rows: [
          ['Model and specification', 'Which handset the number belongs to', 'The listing says one model; the IMEI says another'],
          ['Blacklist status', 'Whether it is reported lost, stolen or unpaid', 'A blacklisted handset loses network service, often after the sale'],
          ['Carrier and country', 'Which network sold it, and where', 'A lock is filed with that network and no other'],
          ['SIM lock status', 'Whether it is tied to one network', 'Decides whether an unlock is needed at all'],
          ['Warranty and age', 'Purchase date and remaining cover', 'A "sealed, new" phone with two years of warranty gone is not new'],
          ['Activation lock', 'Whether an Apple account still holds it', 'A locked device cannot be set up by anyone else'],
        ],
      },
      {
        kind: 'p',
        text: 'Not every check answers every question. Reports are sold per source, because the sources are separate: a blacklist database is not the same system as a manufacturer warranty record. That is why prices differ between reports on the same phone.',
      },
      {
        kind: 'h2',
        id: 'what-it-cannot-tell-you',
        text: 'What an IMEI check cannot tell you',
      },
      {
        kind: 'list',
        items: [
          'Who owns the phone. No lookup returns a name, an address or a phone number — that data is not in these databases, and a service offering it is selling something it does not have.',
          'Where the phone is. Location is a network and account function, not an IMEI lookup.',
          'What is on the phone. Photos, messages and accounts are not reachable from the number.',
          'Whether the seller is honest. It tells you about the handset, which is often enough to catch the problem.',
        ],
      },
      {
        kind: 'note',
        text: 'A blacklist result reflects what has been reported so far. A phone reported stolen the day after you buy it will have been clean when you checked, which is why the receipt and the seller matter as much as the report.',
      },
      {
        kind: 'h2',
        id: 'reading-a-result',
        text: 'Reading a result without over-reading it',
      },
      {
        kind: 'p',
        text: 'Two results are commonly misread. "Clean" means not currently reported — it is a statement about a database on the day you asked, not a guarantee about the future. And "SIM locked" is not a fault: most phones sold on contract are locked by design, and the lock is removed by the network that applied it.',
      },
      {
        kind: 'cta',
        text: 'Run the format check for nothing, or see what the paid reports cover.',
        href: '/services/imei-check',
        label: 'See phone check services',
      },
    ],
    faq: [
      {
        question: 'Does checking an IMEI change anything on the phone?',
        answer:
          'No. A check is a read against databases held by networks and manufacturers. Nothing is sent to the handset and nothing on it is altered.',
      },
      {
        question: 'Do I need the phone in my hand to check it?',
        answer:
          'No, only the number. A seller can send it to you before you travel to see the phone, which is the point of checking at all.',
      },
      {
        question: 'Is a free IMEI check enough before buying?',
        answer:
          'A free check validates the format of the number. It does not read the blacklist, the carrier or the warranty, so on its own it is not enough to judge a used phone.',
      },
    ],
  },
  {
    slug: 'network-unlock-explained',
    title: 'Network unlocking explained, honestly',
    heading: 'Network unlocking, explained honestly.',
    description:
      'What a network unlock does, what it will never do, and how to tell the difference between an unlock service and something being sold as one.',
    standfirst:
      'An unlock releases a handset from the network that sold it. That is the whole of it — and most of the disappointment in this market comes from expecting more.',
    published: '2026-09-07',
    updated: '2026-09-07',
    minutes: 7,
    topic: 'Unlocking',
    blocks: [
      {
        kind: 'p',
        text: 'A network lock — a SIM lock — is a restriction the selling network applies so a subsidised handset only works on its own SIM cards. Unlocking removes that restriction. The phone is unchanged in every other way: same software, same warranty, same account, same everything.',
      },
      {
        kind: 'h2',
        id: 'how-it-is-done',
        text: 'How an unlock is actually done',
      },
      {
        kind: 'p',
        text: 'The request is filed against the IMEI with the network or the manufacturer that holds the lock. Apple devices are released remotely — the phone is unlocked the next time it activates, and there is no code to type. Most other handsets come back as a code you enter once with a different SIM inserted.',
      },
      {
        kind: 'p',
        text: 'Because the record is changed at the source, an official unlock is permanent. It survives a factory reset and a software update, and it does not need to be repeated when you change SIM again.',
      },
      {
        kind: 'note',
        text: 'The lock belongs to one network. An unlock is filed with that network and no other, which is why a check that names the carrier is the sensible first step.',
      },
      {
        kind: 'h2',
        id: 'what-it-does-not-do',
        text: 'What an unlock will never do',
      },
      {
        kind: 'table',
        head: ['Situation', 'Does an unlock fix it?', 'What it actually is'],
        rows: [
          ['Phone works only on one network', 'Yes', 'A SIM lock, which is what unlocking removes'],
          ['Reported lost or stolen', 'No', 'A blacklist entry, held separately and reversible only by the reporter'],
          ['Unpaid contract or instalments', 'No', 'A finance agreement between the seller and the account holder'],
          ['Asks for a previous Apple Account', 'No', 'Activation Lock, which needs the original account'],
          ['Google account after a reset', 'No', 'Factory Reset Protection, which needs that account'],
          ['Carrier refuses the request', 'No', 'A policy decision by the network, not a technical limit'],
        ],
      },
      {
        kind: 'p',
        text: 'Anyone offering to remove a blacklist entry, clear a finance agreement or bypass an activation lock is offering to interfere with a record that belongs to somebody else. It is worth being blunt: those services either fail, or they help move a phone that someone else is still looking for.',
      },
      {
        kind: 'h2',
        id: 'when-it-can-be-refused',
        text: 'When a request comes back refused',
      },
      {
        kind: 'list',
        items: [
          'The handset is still inside its contract or instalment plan.',
          'The account it belongs to has an unpaid balance.',
          'It has been reported lost or stolen.',
          'The network does not offer unlocking for that model or that market.',
          'The IMEI does not match a device that network ever sold.',
        ],
      },
      {
        kind: 'p',
        text: 'A refusal is a network decision, and no supplier can argue it away. What a service can do is not charge you for it — which is why credit for a refused unlock should return to your balance rather than being kept as a fee.',
      },
      {
        kind: 'h2',
        id: 'how-long-it-takes',
        text: 'How long it takes, and what to expect',
      },
      {
        kind: 'p',
        text: 'Turnaround is set by the network, not by whoever files the request. Some return within hours, some take days, and the same network can be quick one week and slow the next. Any service quoting a single number for every carrier is quoting a hope. Expect an estimate per network, and expect it to be an estimate.',
      },
      {
        kind: 'cta',
        text: 'Prices and typical turnaround are published per network and per device service.',
        href: '/services/unlock',
        label: 'See unlock prices',
      },
    ],
    faq: [
      {
        question: 'Is unlocking legal?',
        answer:
          'Releasing a handset you own from its network lock is legal in most countries, and many networks will do it themselves once the contract is settled. What is not legal anywhere is interfering with a device reported lost or stolen.',
      },
      {
        question: 'Does unlocking void the warranty?',
        answer:
          'An official unlock is a record change at the network or manufacturer. It does not modify the phone, so the warranty is unaffected.',
      },
      {
        question: 'Will the unlock survive a software update?',
        answer:
          'Yes. Because the change is held at the source rather than on the handset, it survives updates and factory resets.',
      },
      {
        question: 'Can a phone be unlocked without the IMEI?',
        answer:
          'No. The IMEI is what the request is filed against — there is nothing else that identifies the handset to the network.',
      },
    ],
  },
  {
    slug: 'checks-before-buying-a-used-phone',
    title: 'Checks to run before buying a used phone',
    heading: 'Before you buy a used phone.',
    description:
      'A short, practical order of checks for a second-hand handset: the number, the blacklist, the lock, the account and the receipt — and what each one saves you from.',
    standfirst:
      'Most bad used-phone purchases were avoidable with two minutes and the fifteen digits the seller already has.',
    published: '2026-09-07',
    updated: '2026-09-07',
    minutes: 5,
    topic: 'Buying',
    blocks: [
      {
        kind: 'p',
        text: 'The order matters. Each step below is cheap and rules out a specific way of losing money, and doing them in this order means you rarely pay for the later ones.',
      },
      {
        kind: 'h2',
        id: 'ask-for-the-imei-first',
        text: 'Ask for the IMEI first',
      },
      {
        kind: 'p',
        text: 'Before travelling anywhere, ask the seller to dial *#06# and send you the number, ideally photographed on the screen next to the phone. A seller who will not send it has told you something useful for free.',
      },
      {
        kind: 'list',
        ordered: true,
        items: [
          'Check the number is well formed. A format check is free and catches a transposed digit before you pay for anything else.',
          'Check the model behind the number matches the listing. The first eight digits identify the model, so "iPhone 15 Pro" in the advert and something else in the result ends the conversation there.',
          'Check the blacklist. This is the one that turns a working phone into a paperweight weeks after the sale, and it is the report worth paying for.',
          'Check the carrier and lock status. It tells you whether the phone works on your network as-is, and if not, what an unlock would cost.',
          'Check the activation lock before money changes hands, not after.',
        ],
      },
      {
        kind: 'note',
        text: 'Run the checks against the number the seller sends, then check the phone in your hand shows the same number before you pay. Substituting a clean IMEI for a dirty handset is the oldest trick in this market.',
      },
      {
        kind: 'h2',
        id: 'in-person',
        text: 'What to do with the phone in your hand',
      },
      {
        kind: 'list',
        items: [
          'Dial *#06# yourself and compare it with the number you checked, and with the number printed in Settings and on the SIM tray where the model has one.',
          'Ask the seller to sign out of their account and factory reset the phone in front of you, then set it up from the welcome screen. If it asks for someone else\'s account, the sale is over.',
          'Put your own SIM in and make a call before you hand over money.',
          'Ask for the receipt. It is what a network asks for if the handset later turns out to be under a finance agreement.',
        ],
      },
      {
        kind: 'h2',
        id: 'red-flags',
        text: 'The four answers that should end it',
      },
      {
        kind: 'table',
        head: ['What the seller says', 'What it usually means'],
        rows: [
          ['"I cannot send the IMEI"', 'The number would not survive a check'],
          ['"It is iCloud locked but that is easy to remove"', 'It is not removable, and the phone is not usable'],
          ['"Reset it after you buy it"', 'It will ask for an account you do not have'],
          ['"No receipt, it was a gift"', 'Nothing to show a network if a finance claim appears later'],
        ],
      },
      {
        kind: 'cta',
        text: 'The blacklist and carrier reports are the two worth running before you travel to see a phone.',
        href: '/services/imei-check',
        label: 'Browse phone checks',
      },
    ],
  },
]

export function listArticles(): Article[] {
  return [...ARTICLES].sort((left, right) => right.published.localeCompare(left.published))
}

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((article) => article.slug === slug)
}

/** Everything except the one being read, oldest last. */
export function relatedArticles(slug: string, limit = 2): Article[] {
  return listArticles()
    .filter((article) => article.slug !== slug)
    .slice(0, limit)
}
