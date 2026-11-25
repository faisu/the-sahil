import Showroom from '@/components/Showroom';
import { getProject } from '@/lib/projects';
import '../../showroom.css';

const p = getProject('mansouza');
export const metadata = {
  title: `${p.name} — 3D showroom | ${p.developer}`,
  description: `Orbit ${p.name} in 3D: exterior views, the furnished typical floor, every flat type, floor-by-floor cut-away and night view.`,
};
export const viewport = { themeColor: '#0f1b2d', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function Page() {
  return <Showroom slug="mansouza" />;
}
