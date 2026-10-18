import LandingNav from '@/components/LandingNav';
import Landing from '@/components/Landing';
import { PRODUCT } from '@/lib/platform';
import './landing.css';

export const metadata = {
  title: `${PRODUCT.name} — immersive 3D tours from architects’ drawings`,
  description: `${PRODUCT.pitch} Live on the platform: The Sahil (Mahim), Krishna Kaveri and Mansouza CHSL.`,
  openGraph: { title: `${PRODUCT.name} — ${PRODUCT.tagline}`, description: PRODUCT.pitch, images: ['/assets/img/tower-night.jpg'] },
};

export default function Home() {
  return (
    <>
      <LandingNav />
      <Landing />
    </>
  );
}
