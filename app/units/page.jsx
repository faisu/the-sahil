import Nav from '@/components/Nav';
import UnitsView from '@/components/UnitsView';

export const metadata = {
  title: 'Flat Units Overview — The Sahil, Mahim',
  description: 'Explore every floor of The Sahil: isolate a residence, view its plan, explode the tower and see the rooftop and podium levels.',
};

export default function UnitsPage() {
  return (
    <>
      <Nav page="units" />
      <UnitsView />
      <footer className="footer" style={{ paddingTop: '3rem' }}>
        <div className="wrap">
          <p className="byline">A project by</p>
          <div className="by"><img src="/assets/img/logo-metro.png" alt="Metro Estates" /><img src="/assets/img/logo-quba.png" alt="Quba Groups" /></div>
          <div className="contact"><span><b>Contact No.:</b> <a href="tel:+919518378620">+91 95183 78620</a></span><span><b>Mail Id:</b> <a href="mailto:Sales@metroestates.net">Sales@metroestates.net</a></span></div>
          <p className="fine">Website demo · The Sahil · Metro Estates × Quba Groups</p>
        </div>
      </footer>
    </>
  );
}
