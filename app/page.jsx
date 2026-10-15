import ProjectNav from '@/components/ProjectNav';
import Landing from '@/components/Landing';

export const metadata = {
  title: '3D Property Showcases — The Sahil, Krishna Kaveri, Mansouza',
  description: 'Scroll-driven 3D virtual tours of three Mumbai residential projects, built from the architects’ drawings: The Sahil (Mahim), Krishna Kaveri and Mansouza CHSL (Dadamiya Infrastructure).',
};

export default function Home() {
  return (
    <>
      <ProjectNav />
      <Landing />
    </>
  );
}
