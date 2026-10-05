import Pic from './Pic';
import MapControls from './MapControls';

// Home page markup. The 3D tower (canvas#stage) stays visible throughout; each section is a
// brochure-style panel beside it and lib/tour.js highlights the matching part of the model.

const Metro = ({ inv = true }) => <img className={inv ? 'inv' : ''} src="/assets/img/logo-metro.png" alt="Metro Estates" />;
const Quba = ({ inv = true }) => <img className={inv ? 'inv' : ''} src="/assets/img/logo-quba.png" alt="Quba Groups" />;


function Support({ name, alt, w, h, caption, tall = false, delay = 'd2', view }) {
  return (
    <figure className={`support reveal ${delay}${tall ? ' tall' : ''}`} data-view={view} title={view ? 'Shows this on the 3D model' : undefined}>
      <Pic name={name} alt={alt} w={w} h={h} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** Brochure panel on the left; the map stage with the 3D tower always occupies the right. */
function Panel({ id, title, nav, night = false, children }) {
  return (
    <section id={id} className={`sec split${night ? ' nightsec' : ''}`} data-title={title} data-nav={nav}>
      <div className="panel">
        <div className="logo-top"><Metro /></div>
        <div className="body">{children}</div>
        <div className="logo-bot"><Quba /></div>
      </div>
    </section>
  );
}

export default function HomeContent() {
  return (
    <>
      <div className="loader"><i /></div>
      <div className="load-note">Loading 3D model</div>
      <div className="stage-bg-night" />
      <div className="stage-bg" />
      <div id="stage" className="stage" role="img" aria-label="Street map of Mahim with the 3D model of The Sahil on its plot beside the Arabian Sea" />
      <div className="hint">Scroll to tour the tower</div>
      <aside className="rail" aria-label="Sections" />

      <main>
        {/* 01 cover — brochure page 1 */}
        <section id="cover" className="sec cover" data-title="The Sahil">
          <div className="inner">
            <img className="mark reveal" src="/assets/img/logo-sahil-mark.png" alt="The Sahil" width="400" height="302" />
            <p className="tag reveal d1">Luxury Begins Here</p>
            <p className="where reveal d2">Mahim · Mumbai · Sea-facing residences</p>
            <div className="by reveal d3"><Metro inv={false} /><Quba inv={false} /></div>
          </div>
          <div className="cue">Scroll <i /></div>
        </section>

        {/* 02 overview — page 2 */}
        <Panel id="intro" title="Overview" nav="intro">
          <p className="kicker reveal">A landmark on SVS Road, Mahim</p>
          <ul className="bullets">
            <li className="reveal">Exclusive 5 BHK Residences</li>
            <li className="reveal d1">1 Floor – 1 Flat</li>
            <li className="reveal d1">Low Density</li>
            <li className="reveal d2">Life Long Uninterrupted Sea Views</li>
            <li className="reveal d2">Column Less Fully Customizable Flats</li>
            <li className="reveal d3">Maximum Carpet Area</li>
          </ul>
          <p className="copy reveal d3">Ground + 22 storeys rising 69 m above the Arabian Sea shoreline, with refuge decks on the 7th and 14th floors and a rooftop sanctuary on the terrace.</p>
          <Support name="tower-day" alt="Day render of The Sahil tower" w={1400} h={1554} caption="Artist’s impression" tall delay="d3" />
        </Panel>

        {/* 03 compare — page 4 left; model: a high floor seen from the sea */}
        <Panel id="compare" title="Sea view">
          <p className="kicker reveal">A view beyond</p>
          <h2 className="display sm reveal d1">Compare</h2>
          <div className="rule reveal d2" />
          <p className="tagline kicker reveal d2" style={{ letterSpacing: '.2em' }}>The finest sea view on the Arabian Sea coast</p>
          <p className="copy reveal d2">Horizons that belong to you. The 20th floor is highlighted on the model, with Mahim Bay beside it: every residence looks out over the water through the curved, column-free glass bay.</p>
          <Support name="sea-view" alt="Sunset over the Arabian Sea from a Sahil balcony" w={1400} h={1040} caption="Horizons that belong to you" />
        </Panel>

        {/* 04 location — page 3; the map pulls back to show the plot with the sea behind it */}
        <Panel id="location" title="Location" nav="location">
          <h2 className="loc-title reveal"><small>At the centre of</small>Everything<br /><em>that matters</em></h2>
          <p className="copy reveal d1">122/124 SVS Road, Mahim: the plot sits on the seaward side of the old Cadell Road, a few hundred metres from Mahim Bay. The tower stands on its plot throughout the tour; pick a view or a destination to explore the map.</p>
          <MapControls />
          <div className="loc-grid">
            <Pic name="map" alt="Map of Mumbai showing The Sahil at Mahim with routes to Coastal Road, BKC, Fort, the airport and Atal Setu" w={1200} h={1252} className="map reveal d1 small" />
            <ul className="rings dests" aria-label="Drive times (click to show on the map)">
              <li className="reveal"><button type="button" data-dest="coastal"><b>8</b> Mins To Coastal Road</button></li>
              <li className="reveal d1"><button type="button" data-dest="worli"><b>13</b> Mins To Worli Connector</button></li>
              <li className="reveal d1"><button type="button" data-dest="airport"><b>14</b> Mins To CSMI Airport</button></li>
              <li className="reveal d2"><button type="button" data-dest="bkc"><b>15</b> Mins To BKC</button></li>
              <li className="reveal d2"><button type="button" data-dest="versova"><b>20</b> Mins To Versova</button></li>
              <li className="reveal d3"><button type="button" data-dest="atalsetu"><b>23</b> Mins To Atal Setu (via Worli Connector)</button></li>
              <li className="reveal d3"><button type="button" data-dest="fort"><b>28</b> Mins To Fort</button></li>
              <li className="reveal d3"><button type="button" data-dest="nariman"><b>30</b> Mins To Nariman Point</button></li>
            </ul>
            <p className="fine reveal d3" style={{ marginTop: '.4rem' }}>Tap a destination to see it from the plot on the map; scroll on to continue the tour.</p>
          </div>
        </Panel>

        {/* 05 an entire floor — page 4 right; model: 12th floor sliced */}
        <section id="floor" className="sec split" data-title="Entire floor" data-nav="floor">
          <div className="panel">
            <div className="logo-top"><img src="/assets/img/logo-sahil-mark.png" alt="The Sahil" style={{ height: '56px' }} /></div>
            <div className="body">
              <p className="kicker reveal">Exclusive · Rare · Yours</p>
              <p className="kicker reveal" style={{ letterSpacing: '.5em' }}>Not just a home</p>
              <h2 className="display sm reveal d1">An entire<br />floor</h2>
              <p className="kicker reveal d2" style={{ textAlign: 'right' }}>— All yours —</p>
              <p className="tagline kicker reveal d2" style={{ letterSpacing: '.22em' }}>Privacy &nbsp;|&nbsp; Space &nbsp;|&nbsp; Uninterrupted sea views</p>
              <div className="tiles reveal d3">
                <div><svg viewBox="0 0 32 32"><path d="M16 4l12 12-12 12L4 16z" /><path d="M16 9l7 7-7 7-7-7z" /></svg>One flat on one floor</div>
                <div><svg viewBox="0 0 32 32"><path d="M2 16s5-9 14-9 14 9 14 9-5 9-14 9S2 16 2 16z" /><circle cx="16" cy="16" r="4" /></svg>Uninterrupted sea views</div>
                <div><svg viewBox="0 0 32 32"><rect x="8" y="14" width="16" height="14" rx="1" /><path d="M11 14v-4a5 5 0 0110 0v4" /><circle cx="16" cy="21" r="1.5" /></svg>Complete privacy</div>
                <div><svg viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" /><path d="M12 20l8-8M14 12h6v6" /></svg>Expansive living spaces</div>
              </div>
              <p className="copy reveal d3">The model isolates a typical residence floor: the columnless plate lets you plan walls exactly where you want them.</p>
            </div>
            <div className="logos"><Metro /><Quba /></div>
          </div>
        </section>

        {/* 06 plan — page 13; model: top-down of the sliced floor */}
        <Panel id="plan" title="Typical plan">
          <figure className="reveal plan-fig">
            <span className="chip">Typical Floor Plan</span>
            <Pic name="floor-plan" alt="Typical 5 BHK floor plan" w={1600} h={667} />
          </figure>
          <figure className="reveal d1 plan-fig">
            <span className="chip">Isometric View</span>
            <Pic name="floor-iso" alt="Isometric cutaway of the 5 BHK residence" w={1600} h={681} />
          </figure>
          <p className="copy reveal d2">Compare the brochure plan with the live model, generated from the structural drawings. Open the <a href="/units" style={{ color: 'var(--blue)' }}>Flat Units overview</a> to inspect every floor.</p>
        </Panel>

        {/* 07–11 interiors — pages 6–10; model: ground floor, then the sliced 12th floor from four sides */}
        <Panel id="lobby" title="Lobby">
          <p className="kicker reveal">Ground floor · Arrival</p>
          <h2 className="retreat reveal">Lobby Retreat</h2>
          <p className="copy reveal d1">“Luxury is not a place, it’s an experience that begins the moment you step in.” The ground floor is highlighted: decorative entrance lobby, two high-speed lifts and retail along SVS Road.</p>
          <Support name="lobby" alt="Entrance lobby with marble reception and ring chandeliers" w={1330} h={1400} caption="Lobby" tall />
        </Panel>

        <Panel id="living" title="Living" nav="floor">
          <p className="kicker reveal">Sea-facing bay · Typical floor</p>
          <h2 className="retreat reveal">Livingroom Retreat</h2>
          <p className="copy reveal d1">Whether you are a connoisseur of comfort or a lover of light, these well-laid-out living spaces provide the perfect backdrop for your memorable moments. The living and dining run the full curve of the sea-facing glass.</p>
          <Support name="living" alt="Living and dining room with floor-to-ceiling sea view" w={1600} h={789} caption="Living & dining" />
        </Panel>

        <Panel id="bedroom" title="Bedroom">
          <p className="kicker reveal">Private wing · Typical floor</p>
          <h2 className="retreat reveal">Common Bedroom</h2>
          <p className="copy reveal d1">Includes a huge room size, walk-in wardrobe and a sitting area within the bedroom. The model turns to the quiet side of the plate where the bedrooms sit.</p>
          <Support name="bedroom" alt="Bedroom with sea-facing window and sitting area" w={1330} h={1400} caption="Bedroom" tall />
        </Panel>

        <Panel id="kitchen" title="Kitchen">
          <p className="kicker reveal">West bay · Typical floor</p>
          <h2 className="retreat reveal">Kitchen Retreat</h2>
          <p className="copy reveal d1">The vibrant modular kitchen designed with ample storage for you to cook and relish delicacies with family and friends, wrapped around the curved end of the floor.</p>
          <Support name="kitchen" alt="Curved modular kitchen facing the sea" w={1600} h={1023} caption="Kitchen" />
        </Panel>

        <Panel id="namaz" title="Namaz room">
          <p className="kicker reveal">East wing · Typical floor</p>
          <h2 className="retreat reveal">Namaz Room</h2>
          <p className="copy reveal d1">A room for prayers, a place of peace, set at the eastern end of the residence.</p>
          <Support name="namaz" alt="Namaz room with illuminated arches" w={1206} h={1400} caption="Namaz room" tall />
        </Panel>

        {/* 12 rooftop — page 5; model: terrace from above */}
        <Panel id="rooftop" title="Rooftop">
          <p className="kicker reveal">Terrace · +69 m</p>
          <ul className="bullets">
            <li className="reveal">Sitting Deck With Uninterrupted Arabian Sea Views</li>
            <li className="reveal d1">Fully Functional Open To Sky Cafeteria</li>
            <li className="reveal d2">Fully Functional Swimming Pool</li>
            <li className="reveal d3">Lockers, Toilets &amp; Changing Rooms On Top</li>
          </ul>
          <Support name="rooftop-aerial" alt="Aerial render of the rooftop pool and deck" w={1600} h={961} caption="Rooftop" delay="d3" />
        </Panel>

        {/* 13 terrace gallery — page 15; model: terrace, closer */}
        <Panel id="gallery" title="Terrace life">
          <p className="kicker reveal">Amenities on the sky deck</p>
          <div className="support-grid">
            <Support name="terrace" alt="Terrace sit-out at dusk" w={1400} h={899} caption="Terrace View" delay="" view="terrace" />
            <Support name="gym" alt="Fitness centre" w={1400} h={775} caption="Fitness Center" delay="d1" view="gym" />
            <Support name="pool" alt="Rooftop swimming pool" w={1400} h={911} caption="Swimming Pool" delay="d2" view="pool" />
            <Support name="cafe" alt="Terrace cafeteria" w={1400} h={875} caption="Terrace Cafeteria" delay="d3" view="cafe" />
          </div>
          <p className="copy reveal d3">The fitness centre sits on the 3rd floor; pool, cafeteria and deck crown the terrace. Hover or tap a picture to zoom the model to it.</p>
        </Panel>

        {/* 14 amenities — page 14; model: ground floor and street */}
        <Panel id="amenities" title="Amenities" nav="amenities">
          <h2 className="amen-title reveal">Amenities</h2>
          <h3 className="amen-h reveal">External Amenities</h3>
          <div className="icons">
            <div className="reveal" data-view="lobby"><img src="/assets/img/ic-lobby.png" alt="" loading="lazy" />Decorative<br />Entrance Lobby</div>
            <div className="reveal d1" data-view="lifts"><img src="/assets/img/ic-lift.png" alt="" loading="lazy" />High-Speed<br />Elevators</div>
            <div className="reveal d2" data-view="cctv"><img src="/assets/img/ic-cctv.png" alt="" loading="lazy" />24 × 7 CCTV<br />Surveillance</div>
            <div className="reveal" data-view="garden"><img src="/assets/img/ic-garden.png" alt="" loading="lazy" />Roof Top Garden</div>
            <div className="reveal d1" data-view="sitout"><img src="/assets/img/ic-sitout.png" alt="" loading="lazy" />Sit-Out Space</div>
            <div className="reveal d2" data-view="kitchen"><img src="/assets/img/ic-kitchen.png" alt="" loading="lazy" />Modular Kitchen</div>
          </div>
          <h3 className="amen-h reveal">Internal Amenities</h3>
          <ul className="stars">
            <li className="reveal">Floor to Floor Height</li>
            <li className="reveal">Smart Door Lock</li>
            <li className="reveal">Smart Video Door Phone</li>
            <li className="reveal">Smart Security</li>
            <li className="reveal d1">Branded Bathroom Fittings</li>
            <li className="reveal d1">Concealed Electrical Fittings</li>
            <li className="reveal d1">Vitrified Tiles Flooring</li>
            <li className="reveal d1">Designer False Ceiling</li>
          </ul>
        </Panel>

        {/* 15 night — page 12; model switches to night */}
        <Panel id="night" title="By night" night>
          <h2 className="serif reveal" style={{ textAlign: 'center' }}>A Radiant <em>Masterpiece</em><small>on the Skyline</small></h2>
          <p className="copy reveal d1">Crowned by a glowing rooftop sanctuary and rising gracefully above a lush, moonlit landscape, it stands as a striking symbol of prestige — a landmark that doesn’t just touch the sky, but commands it.</p>
          <p className="glow reveal d2">Welcome to a home that shines brighter, day or night.</p>
          <Support name="tower-night" alt="Night render of The Sahil tower" w={1400} h={1495} caption="By night" tall />
        </Panel>

        {/* 16 contact — page 16 */}
        <footer id="contact" className="footer" data-title="Contact" data-nav="contact">
          <div className="wrap">
            <img className="mark" src="/assets/img/logo-sahil-mark.png" alt="The Sahil" width="400" height="302" />
            <p className="tag">Luxury Begins Here</p>
            <p className="byline">A project by</p>
            <div className="by"><Metro inv={false} /><Quba inv={false} /></div>
            <address>
              <p><b>Site Address:</b> 122/124, SVS Road (old Cadel Road), Mahim, Mumbai – 400016.</p>
              <p><b>Office Address:</b> Shop no. 2G, Gr floor, Shirin Manzil, 38, Sitladevi Temple Road, Mahim, Mumbai – 400016.</p>
            </address>
            <div className="contact">
              <span><b>Contact No.:</b> <a href="tel:+919518378620">+91 95183 78620</a></span>
              <span><b>Mail Id:</b> <a href="mailto:Sales@metroestates.net">Sales@metroestates.net</a></span>
            </div>
            <div className="consult">
              <div>Design Architect<img src="/assets/img/logo-ara.png" alt="ARA Design Studio" /></div>
              <div>Liaison Architect<img src="/assets/img/logo-kazi.png" alt="Kazi & Associates" /></div>
              <div>Legal Advisor<img src="/assets/img/logo-abs.png" alt="ABS Ansari & Co., Advocates, High Court" /></div>
              <div>Structural Consultant<img src="/assets/img/logo-space.png" alt="Space Consulting Engineers" /></div>
            </div>
            <p className="disclaimer">Note: The Developers reserve the right to change plans, specifications and features without prior notice or obligation, at their sole discretion and subject to approval of Government authorities. Specifications, writeup, internal layouts, plans and pictures shown are only indicative. All renderings, floor plans, pictures and maps are the artist's conceptions and not actual depictions of the building, its walls, roadways or landscaping. All the amenities will be provided only as per list mentioned in the agreement. The 3D model on this page is generated from structural drawing R0 (06-07-26) and is indicative.</p>
            <p className="fine">Website demo · The Sahil · Metro Estates × Quba Groups</p>
          </div>
        </footer>
      </main>
    </>
  );
}
