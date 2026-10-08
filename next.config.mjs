/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // the GLBs live in /private (never served statically); ship them with the route that encrypts them
  outputFileTracingIncludes: { '/api/scene/part/[name]': ['./private/models/**'] },
  async headers() {
    return [
      {
        // brochure images never change without a new filename
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // ask AI crawlers not to train on or index the site's media
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noai, noimageai' }],
      },
    ];
  },
};
export default nextConfig;
