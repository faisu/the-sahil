import ProjectNav from '@/components/ProjectNav';
import GsapTour from '@/components/GsapTour';
import { getProject } from '@/lib/projects';

const p = getProject('mansouza');
export const metadata = {
  title: `${p.name} — 3D virtual tour | ${p.developer}`,
  description: `${p.blurb}`,
};

export default function Page() {
  return (
    <>
      <ProjectNav project={p} steps={p.story} />
      <GsapTour slug="mansouza" />
    </>
  );
}
