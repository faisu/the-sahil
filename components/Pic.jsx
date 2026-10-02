/** Responsive brochure image: small WebP/JPEG for phones, full size above 820px. */
export default function Pic({ name, alt, w, h, className = '', eager = false }) {
  return (
    <picture className={className}>
      <source media="(max-width: 820px)" srcSet={`/assets/img/${name}-sm.webp`} type="image/webp" />
      <source media="(max-width: 820px)" srcSet={`/assets/img/${name}-sm.jpg`} />
      <source srcSet={`/assets/img/${name}.webp`} type="image/webp" />
      <img src={`/assets/img/${name}.jpg`} alt={alt} width={w} height={h} loading={eager ? 'eager' : 'lazy'} decoding="async" />
    </picture>
  );
}
