import { Jost, Cormorant_Garamond } from 'next/font/google';
import './globals.css';

const jost = Jost({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-jost', display: 'swap' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['600', '700'], style: ['normal', 'italic'], variable: '--font-cormorant', display: 'swap' });

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://the-sahil.vercel.app'),
  title: 'The Sahil — Luxury Begins Here',
  description: 'Exclusive 5 BHK sea-facing residences in Mahim, Mumbai. One flat per floor. A project by Metro Estates and Quba Groups.',
  icons: { icon: '/assets/img/logo-sahil-mark.png' },
  openGraph: { title: 'The Sahil — Luxury Begins Here', description: 'Exclusive 5 BHK sea-facing residences in Mahim, Mumbai.', images: ['/assets/img/tower-day.jpg'] },
};
export const viewport = { themeColor: '#ece5d8', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${jost.variable} ${cormorant.variable}`}>
      <body>{children}</body>
    </html>
  );
}
