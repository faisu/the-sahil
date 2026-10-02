import Link from 'next/link';

export default function Nav({ page = 'home' }) {
  const home = page === 'home';
  const h = (hash) => (home ? `#${hash}` : `/#${hash}`);
  return (
    <nav className="nav" aria-label="Primary">
      <Link className="brand" href={home ? '#cover' : '/'}>
        <img src="/assets/img/logo-sahil-mark.png" alt="The Sahil" width="400" height="302" />
      </Link>
      <ul>
        <li><a href={h('intro')}>Overview</a></li>
        <li><a href={h('location')}>Location</a></li>
        <li><a href={h('floor')}>Residences</a></li>
        <li><a href={h('amenities')}>Amenities</a></li>
        <li><Link href="/units" aria-current={home ? undefined : 'page'}>Flat Units</Link></li>
        <li><a href={h('contact')}>Contact</a></li>
      </ul>
      <div className="partners">
        <img src="/assets/img/logo-metro.png" alt="Metro Estates" />
        <img src="/assets/img/logo-quba.png" alt="Quba Groups" />
      </div>
      {home ? <Link className="cta" href="/units">Explore units</Link> : <Link className="cta" href="/">Scroll tour</Link>}
    </nav>
  );
}
