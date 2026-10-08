'use client';
import { useEffect, useState } from 'react';
import { PLAN } from '@/lib/plan';

const FIRST_MS = 1500;        // the upgrade dialog opens shortly after every page load…
const REPEAT_MS = 3 * 60e3;   // …and again every few minutes while browsing

// Free plan: a "FREE PLAN" watermark over the site, a fixed bar at the bottom of every page
// and an upgrade dialog that keeps coming back. All of it disappears with NEXT_PUBLIC_PLAN=pro.
export default function PlanNotice() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (PLAN.tier !== 'free') return;
    const t = setTimeout(() => setOpen(true), FIRST_MS);
    const i = setInterval(() => setOpen(true), REPEAT_MS);
    document.body.classList.add('free-plan');
    return () => { clearTimeout(t); clearInterval(i); document.body.classList.remove('free-plan'); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);
  if (PLAN.tier !== 'free') return null;

  const cta = PLAN.contactUrl
    ? <a className="plan-cta" href={PLAN.contactUrl} target="_blank" rel="noopener">Upgrade now</a>
    : <button type="button" className="plan-cta" onClick={() => setOpen(true)}>Upgrade now</button>;

  return (
    <>
      <div className="plan-mark" aria-hidden="true" />
      <div className="plan-bar" role="status">
        <span className="plan-badge">Free plan</span>
        <span className="plan-msg">This website is a limited free preview by {PLAN.provider}. Not licensed for commercial launch.</span>
        <button type="button" className="plan-more" onClick={() => setOpen(true)}>Details</button>
        {cta}
      </div>
      {open && (
        <div className="plan-scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="plan-card" role="dialog" aria-modal="true" aria-labelledby="plan-title">
            <button type="button" className="plan-x" onClick={() => setOpen(false)} aria-label="Close">×</button>
            <p className="plan-badge">Free plan · Preview only</p>
            <h2 id="plan-title">You are viewing the free version of this 3D website</h2>
            <p>Built and hosted by <b>{PLAN.provider}</b>. The free plan is a limited preview with watermarks and
              restricted features. To launch it for buyers, the project developer needs a paid plan, which includes:</p>
            <ul>{PLAN.perks.map((p) => <li key={p}>{p}</li>)}</ul>
            <div className="plan-act">
              {PLAN.contactUrl && <a className="plan-cta big" href={PLAN.contactUrl} target="_blank" rel="noopener">Upgrade to a paid plan</a>}
              <button type="button" className="plan-later" onClick={() => setOpen(false)}>Continue with the free preview</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
