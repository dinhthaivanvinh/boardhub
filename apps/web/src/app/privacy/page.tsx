import { infoMetadata, InfoPageView } from '@/features/legal/InfoPageView';

export const generateMetadata = () => infoMetadata('privacy');

export default function PrivacyPage() {
  return <InfoPageView id="privacy" />;
}
