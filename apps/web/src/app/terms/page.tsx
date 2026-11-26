import { infoMetadata, InfoPageView } from '@/features/legal/InfoPageView';

export const generateMetadata = () => infoMetadata('terms');

export default function TermsPage() {
  return <InfoPageView id="terms" />;
}
