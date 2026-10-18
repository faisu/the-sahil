import Link from 'next/link';
import { PRODUCT } from '@/lib/platform';
import { PROJECT_LIST } from '@/lib/projects';

// Top bar of the platform landing. Transparent over the hero; Landing.jsx adds `.dark` while a
// night section is under it. The mark is three offset floor plates: a storey stack.
export function StoreyMark({ size = 40 }) {
  return (
    <svg className="ld-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="4" y="4" width="32" height="32" rx="10" fill="currentColor" />
      <g fill="none" stroke="var(--mark-ink,#fff)" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M11 26.5 20 31l9-4.5" opacity=".55" />
        <path d="M11 21 20 25.5 29 21" opacity=".8" />
        <path d="M11 15.5 20 11l9 4.5L20 20z" fill="var(--mark-ink,#fff)" fillOpacity=".18" />
      </g>
    </svg>
  );
}

export default function LandingNav() {
  return (
    <nav className="nav ld-nav" aria-label="Primary">
      <Link className="brand" href="/">
        <StoreyMark />
        <span className="gs-brandtxt"><b>{PRODUCT.name}</b><small>{PRODUCT.byline}</small></span>
      </Link>
      <ul>
        <li><a href="#why">Why</a></li>
        <li><a href="#pipeline">Pipeline</a></li>
        <li><a href="#platform">Platform</a></li>
        <li><a href="#projects">Live projects</a></li>
        <li><a href="#for">Who it’s for</a></li>
      </ul>
      <div className="gs-switch ld-switch">
        {PROJECT_LIST.map((p) => (
          <Link key={p.slug} href={p.href} title={`Open ${p.name}`}>{p.name.split(' ')[0] === 'The' ? p.name.split(' ')[1] : p.name.split(' ')[0]}</Link>
        ))}
      </div>
      <Link className="cta" href={PROJECT_LIST[0].href}>Take a tour</Link>
    </nav>
  );
}
