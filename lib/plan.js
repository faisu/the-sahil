// Free-plan notice shown on every page. Set these in Vercel → Environment Variables:
//   NEXT_PUBLIC_PLAN_PROVIDER     who builds and licenses the 3D experience (shown in the notice)
//   NEXT_PUBLIC_PLAN_CONTACT_URL  where "Upgrade" goes: mailto:, https://wa.me/…, or a pricing page
//   NEXT_PUBLIC_PLAN              set to "pro" once the developer has purchased; the notice disappears
export const PLAN = {
  tier: process.env.NEXT_PUBLIC_PLAN || 'free',
  provider: process.env.NEXT_PUBLIC_PLAN_PROVIDER || 'the 3D experience provider',
  contactUrl: process.env.NEXT_PUBLIC_PLAN_CONTACT_URL || '',
  perks: ['Remove this notice and branding', 'Custom domain', 'Full-detail 3D model', 'Monthly visitor reports', 'Priority updates & support'],
};
