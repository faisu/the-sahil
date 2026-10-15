import Link from 'next/link';
import { PROJECT_LIST } from '@/lib/projects';

// Top bar for the GSAP project tours and the landing page: the showcase mark, the project's
// tour steps and a switcher to the other projects.
export default function ProjectNav({ project = null, steps = [] }) {
  return (
    <nav className="nav gs-nav" aria-label="Primary">
      <Link className="brand" href="/">
        <span className="gs-mark">3D</span>
        <span className="gs-brandtxt"><b>{project ? project.name : 'Property showcase'}</b><small>{project ? project.developer : 'Virtual tours from the drawings'}</small></span>
      </Link>
      <ul>
        {project ? steps.map((s) => <li key={s.id}><a href={`#${s.id}`}>{(s.step.split('·')[1] || s.title).trim()}</a></li>)
          : PROJECT_LIST.map((p) => <li key={p.slug}><Link href={p.href}>{p.name}</Link></li>)}
      </ul>
      <div className="gs-switch">
        {PROJECT_LIST.map((p) => (
          <Link key={p.slug} href={p.href} className={p.slug === project?.slug ? 'on' : ''} title={p.name}>{p.name.split(' ')[0] === 'The' ? p.name.split(' ')[1] : p.name.split(' ')[0]}</Link>
        ))}
      </div>
      <Link className="cta" href={project ? '/' : PROJECT_LIST[0].href}>{project ? 'All projects' : 'Start a tour'}</Link>
    </nav>
  );
}
