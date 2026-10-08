# The Sahil — website (Next.js)

Next.js 15 (App Router) site for The Sahil, Mahim. Deploys to Vercel with no configuration.

```
app/page.jsx            scroll tour (home)           components/Tour.jsx + lib/tour.js
app/units/page.jsx      flat units overview          components/UnitsView.jsx + lib/units.js
lib/scene.js            createBuilding (per-floor GLB loading, focus/slice/explode/night state) + createViewer (three.js canvas for /units)
lib/map.js              createMapStage: MapLibre map of Mahim with the tower on its plot, driven by the tour  components/MapControls.jsx
app/globals.css         brochure design system
private/models          sahil_core.glb (exterior, 492 KB) + sahil_detail.glb (interiors, 280 KB), meshopt-compressed, served only via app/api/scene
public/assets/img       brochure renders (WebP + JPEG), logos, icons
```

## Map stage

The home page stage is a MapLibre GL map (OpenFreeMap "liberty" style, no API key) that stays
fixed behind every section. A three.js custom layer renders `sahil_core.glb` on the plot the way
the MapLibre "Add a 3D model using three.js" example does, and `lib/tour.js` drives the map camera
from the same metre-based cam/look keyframes the three.js viewer used (converted with
`map.calculateCameraOptionsFromTo`), so each section is demonstrated on the real plot with Mahim
Bay in view. Knobs in `lib/map.js`:

- `SITE` — plot centre lng/lat (19.038245, 72.839001; 122/124 SVS Road, seaward side of the road).
- `MODEL_BEARING` — compass bearing of the GLB's +Z side (curved bay). 192° lays the long axis
  along the plot, running back from SVS Road towards the sea (+X points east to the road, 102°).
- `SEA_BEARING` — bearing from the plot to Mahim Bay, used by the camera presets.
- `VIEWS` — camera presets for the chips in the Location panel (plot, from the sea, shoreline, neighbourhood, Mumbai).
- `DESTINATIONS` — the brochure drive-time places; the list in the panel flies the map to each one.

The tower's exterior follows the brochure renders (`tower-day`, `tower-night`, `aerial`,
`rooftop-aerial`): `lib/scene.js` builds a façade skin from one clean outline of the typical floor
plate (`OUTLINE`: straight road-side face and ends, the R ≈ 8.7 / 10 m curved corners and the flat
south face between them). Each floor gets a white slab-edge band (deep balcony bands on the curves),
bronze cladding with a window grid on the flat faces, full-height glass bays in rounded bronze
frames on the curves (open bays on the 7th/14th refuge floors), white pilasters where the curves
meet the flat faces and shopfront glazing on the podium. The roof gets the white crown: fascia with
"The Sahil" lettering, louvred parapet and the taller louvred screen sweeping down over the curves,
the logo panel, the pool in the east curve and planting. Façade patterns are canvas textures with
night emissive maps (lit and unlit homes, warm and cool). The skin hides on a floor while that floor
is sliced open; the drawn rooftop walls show only then. The map layer passes three.js the real eye
position (from MapLibre's camera), so glass reflections and highlights are physically placed. 3D
neighbour extrusions are removed (they overlapped the tower); flat footprints are drawn at street
zooms instead.

Picking a chip or a destination pauses the scroll keyframes ("back to the tour" or scrolling to
the next section resumes them). Figures and icons with `data-view` (gallery pictures, amenity
icons) zoom the model to that amenity on hover, focus or tap; the presets live in `VIEWS` inside
`lib/tour.js`. Night mode dims the basemap with a CSS filter on the stage and lights the glass.

## Visitors, model protection and plan notice

- **Visitor tracking**: Vercel Web Analytics (`<Analytics />` in `app/layout.jsx`). Turn it on in
  Vercel → Project → Analytics; visitors, page views, countries and referrers show there. No cookies.
- **Model protection** (`lib/sceneGuard.js`, `app/api/scene/*`): the GLBs are not public files. The
  page opens a 5-minute scene session, then fetches each model AES-encrypted and decrypts it in
  memory. Requests without browser Fetch Metadata, from bots/AI agents/scripts (by user agent) or
  with a token from another browser get 403/404. `app/robots.js` and `noai` headers turn AI crawlers
  away. Set `SCENE_SECRET` (any long random string) in Vercel. This stops scrapers and casual
  downloads; nothing rendered in a browser can be made impossible to capture.
- **Free-plan notice** (`components/PlanNotice.jsx`, `lib/plan.js`): set `NEXT_PUBLIC_PLAN_PROVIDER`
  and `NEXT_PUBLIC_PLAN_CONTACT_URL`; set `NEXT_PUBLIC_PLAN=pro` to remove it once purchased.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Deploy to Vercel

1. The repo lives at https://github.com/faisu/the-sahil.
2. In Vercel, **Add New Project → Import** that repo. The Next.js preset is detected from `vercel.json`/`package.json`; no build settings needed (build `next build`, output `.next`, Node 20).
3. Optional: set `NEXT_PUBLIC_SITE_URL` to the production domain so Open Graph URLs are absolute.

Or from the terminal:

```bash
npx vercel
```

`next.config.mjs` sets one-year immutable caching for everything under `/assets/`, so change a
filename when you replace a model or image.

## Rebuilding the 3D model

From the repo root (needs `trimesh`, `rtree`, `numpy` and `@gltf-transform/cli`). The source
model `sayyed_house_full.glb` and `building_spec.json` come from the DWG extraction and are kept
outside this repo:

```bash
python3 tools/split_floors.py /path/to/sayyed_house_full.glb /path/to/building_spec.json
cd private/models
npx @gltf-transform/cli optimize sahil_core.glb sahil_core.glb --compress meshopt --instance false --join false --flatten true
npx @gltf-transform/cli optimize sahil_detail.glb sahil_detail.glb --compress meshopt --instance false --join false --flatten true
```

See `FEASIBILITY.md` for the evaluation, loading strategy and launch checklist.
