import type { Locale } from '@retarget3mf/ui/plural';
import { LandingPage } from '../../lib/document';

export default async function LocalizedHome({ params }: { params: Promise<{ locale: string }> }) {
  return <LandingPage locale={(await params).locale as Locale} />;
}
