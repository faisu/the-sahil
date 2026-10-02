import Nav from '@/components/Nav';
import Tour from '@/components/Tour';
import HomeContent from '@/components/HomeContent';

export const metadata = {
  title: 'The Sahil — Luxury Begins Here | Metro Estates × Quba Groups, Mahim',
  description: 'The Sahil, Mahim: exclusive 5 BHK sea-facing residences, one flat per floor, by Metro Estates and Quba Groups. Take the scroll tour of the tower.',
};

export default function Home() {
  return (
    <>
      <Nav page="home" />
      <Tour>
        <HomeContent />
      </Tour>
    </>
  );
}
