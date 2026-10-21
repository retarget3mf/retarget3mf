import { PRINTERS } from '@retarget3mf/profiles/printers';
import { DESCRIPTION, SITE_NAME, SITE_URL } from '../lib/site';
import { Landing } from './landing/Landing';
import { LANDING_MESSAGES } from './landing/messages';

/** Structured data: the app itself, and the FAQ (English, as the static HTML is). */
const JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    description: DESCRIPTION,
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web, macOS, Windows, Linux',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
    featureList: `Converts 3MF projects for ${PRINTERS.length} printers`,
    ...(SITE_URL && { url: `${SITE_URL}/` }),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: LANDING_MESSAGES.en.faq.items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  },
];

export default function Home() {
  return (
    <>
      {/* Static JSON from our own constants; escaping "<" keeps it from closing the script element. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, '\\u003c') }} />
      <Landing />
    </>
  );
}
