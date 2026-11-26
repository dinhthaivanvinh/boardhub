import { infoMetadata, InfoPageView } from '@/features/legal/InfoPageView';

export const generateMetadata = () => infoMetadata('about');

export default function AboutPage() {
  return <InfoPageView id="about" />;
}
