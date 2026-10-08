# The Sahil — website feasibility and demo notes

**Verdict: feasible, and the demo in this folder already does it.** Everything the brochure
("The Sahil_28th Sep.pdf", 16 pages) contains can be put on a website, and the structural
model that already exists in this repo (`sayyed_house_full.glb`, built from the Space
Consulting DWG) gives the site something the PDF cannot: a live, floor-by-floor 3D tower.

## What was built

| Page | What it does | Brochure pages it mirrors |
|---|---|---|
| `/` (`app/page.jsx`) | Scroll-driven tour with the 3D tower as the primary view. The model never leaves the screen: every section is a brochure-style panel beside it, and each panel's keyframe highlights the matching part of the tower (20th floor from the sea for the view, ground floor for the lobby and amenities, the sliced 12th floor from four sides for living, bedroom, kitchen and namaz room, the terrace for rooftop and pool, night mode at the end). Brochure renders appear inside the panels as supporting cards. | 1, 2, 3, 4, 5, 6–10, 12, 14, 15, 16 |
| `/units` (`app/units/page.jsx`) | Flat units overview, kept separate as requested. Interactive floor stack: click a floor card or the model to isolate a floor, switch Tower / Floor / Plan views, explode the stack, reveal the basement (pit parking, tanks, piles). Each card carries level height, type, tags (sea view, refuge, amenity) and an Enquire mail link. | 4 (right), 13 |

Design system taken from the brochure: paper-beige background with grain, royal blue
accents, navy wordmark colour, sea-gradient cover/footer, blue pill captions, tracked
uppercase kickers, large watercolour-gradient serif words ("COMPARE", "AN ENTIRE FLOOR"),
Metro Estates logo top-left and Quba logo bottom-left on every panel.

## Asset pipeline (reproducible)

```
tools/split_floors.py     sayyed_house_full.glb -> private/models/sahil_core.glb + sahil_detail.glb
                          (per-floor nodes B, G, F01..F22, T; full-height core walls cut at floor planes)
gltf-transform optimize   meshopt compression, no instancing (keeps one mesh per floor)
PyMuPDF + ImageMagick     brochure pages rendered at 2000 px, renders cropped, WebP + JPEG, logos trimmed
```

## Loading and performance strategy

| Technique | Where | Effect |
|---|---|---|
| Two-stage model: exterior shell first, interiors/structure when the browser is idle | `scene.js` `load()` / `loadDetail()` | 492 KB renders the tower; 280 KB more arrives later (5.9 MB original) |
| meshopt compression (KHR_mesh_quantization + EXT_meshopt_compression) | build step | 8.5× smaller than the source GLB, decoder ships with three.js |
| `ReactDOM.preload()` of the shell model from the client components | `Tour.jsx`, `UnitsView.jsx` | model download starts before the module graph is parsed |
| Render on demand + damped camera; the loop sleeps when nothing changes | `scene.js` `requestRender()` | near-zero GPU use while reading text sections |
| Canvas opacity 0 pauses rendering entirely | `tour.js` `setActive()` | image sections cost nothing in WebGL |
| Static shadow map (`shadowMap.autoUpdate = false`) refreshed only on state change | `scene.js` | shadows at the price of one pass, not one per frame |
| Adaptive quality: slow devices drop to DPR 1, then disable shadows | `scene.js` `degrade()` | keeps scrolling smooth on integrated GPUs / software GL |
| Pixel ratio capped at 1.75 (1.5 on phones), shadows off on narrow screens | viewer options | avoids 4K-texture-sized framebuffers on retina laptops |
| Images: `<picture>` WebP + JPEG, `loading=lazy`, `decoding=async`, explicit width/height | all pages | ~3 MB of renders never block first paint, no layout shift |
| `next/font` with `display: swap`, system fallbacks | `layout.jsx` | text visible immediately |
| `prefers-reduced-motion` honoured (no auto orbit, no reveal animation) | `tour.js`, CSS | accessibility |
| Next.js 15 App Router, both routes prerendered as static HTML; three.js bundled from npm | `app/` | hosts on Vercel with zero config, markup is server-rendered for SEO and first paint |
| `next/font` self-hosts Jost and Cormorant Garamond | `app/layout.jsx` | no third-party font request, no layout shift |
| One-year immutable cache headers for `/assets/*` | `next.config.mjs` | repeat visits never re-download models or renders |

First paint weight (desktop): HTML + CSS + JS ≈ 60 KB, logos ≈ 300 KB, fonts ≈ 90 KB, then
the 492 KB shell model. Everything else is lazy.

## Gaps to close before launch

1. **Hi-res renders.** The brochure embeds its renders at roughly 1000 px wide; the website
   crops them from a 2000 px page render, which is fine for a demo but soft on large screens.
   Ask the visualiser for the original 3000 px+ renders.
2. **MahaRERA.** Maharashtra requires the RERA registration number and QR code on every
   advertisement, including websites. Add them to the footer and the cover once available.
3. **Unit data.** Floor types, carpet areas and availability on `units.html` are derived from
   the structural drawing R0 (06-07-26) and the brochure; the badges are placeholder demo data.
   Confirm the unit mix (the drawing marks rehab allocations on several floors) and connect the
   CRM for live availability.
4. **Model fidelity.** The 3D tower is a structural/architectural extraction, not the visualiser's
   facade model (no fins, planters or signage). Options: dress the GLB with the facade from the
   architect's Revit/SketchUp model, or keep the clean "working model" look and present it as such.
5. **Fonts.** The brochure uses a Gill Sans-style face; the site uses Jost + Cormorant Garamond
   from Google Fonts to avoid licensing. Swap in the brand font if licensed.
6. **Lead capture.** Enquire links are `mailto:`; a form posting to the CRM (or a serverless
   function) plus WhatsApp click-to-chat is a small addition.
7. **Copy.** Two brochure passages are copy-paste errors ("more than a commercial space", the
   living-room text that talks about kitchens); the site uses corrected wording. Please proofread.
8. **Analytics, OG images, sitemap, favicon set** — routine launch items.

## Running and deploying

```bash
cd website && npm install && npm run dev
```

Open http://localhost:3000/ (tour) and http://localhost:3000/units (flat units).
Deep links such as `/units?floor=F17` open a specific floor. Deploy by importing the
`website/` folder into Vercel (Next.js preset, no settings) or running `npx vercel`.
