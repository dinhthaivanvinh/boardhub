import { infoMetadata, InfoPageView } from '@/features/legal/InfoPageView';

export const generateMetadata = () => infoMetadata('contact');

export default function ContactPage() {
  return <InfoPageView id="contact" />;
}
