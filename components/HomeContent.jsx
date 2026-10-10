import MapControls from './MapControls';

// Home page markup: a scroll-driven virtual tour. The real map of Mahim (#map) and the furnished
// 3D model (#stage) stay on screen throughout; each section is a short panel beside them and
// lib/tour.js moves the camera to the matching place (exterior shots on the map, then into the
// model for the lobby, the residence, the gym and the rooftop). No pictures: everything shown
// is the 3D model.

const Metro = ({ inv = true }) => <img className={inv ? 'inv' : ''} src="/assets/img/logo-metro.png" alt="Metro Estates" />;
const Quba = ({ inv = true }) => <img className={inv ? 'inv' : ''} src="/assets/img/logo-quba.png" alt="Quba Groups" />;

/** Brochure panel on the left; the map / 3D stage occupies the rest of the screen. */
function Panel({ id, title, nav, night = false, step, children }) {
  return (
    <section id={id} className={`sec split${night ? ' nightsec' : ''}`} data-title={title} data-nav={nav}>
      <div className="panel">
        <div className="logo-top"><Metro />{step && <span className="step">{step}</span>}</div>
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
      <div id="map" className="stage map-stage" role="img" aria-label="Map of Mahim with the 3D model of The Sahil on its plot beside the Arabian Sea" />
      <div id="stage" className="stage" role="img" aria-label="Furnished 3D model of The Sahil. Drag to look around." />
      <div className="callout" aria-hidden="true"><i /><span /></div>
      <div className="hint"><span className="h-drag">Drag to look around</span><span className="h-swipe">Swipe sideways to look around</span><span className="h-scroll">Scroll to tour</span></div>
      <aside className="rail" aria-label="Sections" />

      <main>
        <section id="cover" className="sec cover" data-title="The Sahil">
          <div className="inner">
            <img className="mark reveal" src="/assets/img/logo-sahil-mark.png" alt="The Sahil" width="400" height="302" />
            <h1 className="hero reveal d1">Luxury<br /><em>begins here</em></h1>
            <p className="where reveal d2">Exclusive 5 BHK sea-facing residences · Mahim, Mumbai</p>
            <ul className="facts reveal d2" aria-label="At a glance">
              <li><b>22</b>storeys</li>
              <li><b>1</b>flat per floor</li>
              <li><b>69 m</b>above the bay</li>
            </ul>
            <div className="by reveal d3"><Metro inv={false} /><Quba inv={false} /></div>
          </div>
          <a className="cue" href="#intro">Start the virtual tour <i /></a>
        </section>

        <Panel id="intro" title="Overview" nav="intro" step="01 · Arrival">
          <p className="kicker reveal">A landmark on SVS Road, Mahim</p>
          <ul className="bullets">
            <li className="reveal">Exclusive 5 BHK Residences</li>
            <li className="reveal d1">1 Floor – 1 Flat</li>
            <li className="reveal d1">Low Density</li>
            <li className="reveal d2">Life Long Uninterrupted Sea Views</li>
            <li className="reveal d2">Column Less Fully Customizable Flats</li>
            <li className="reveal d3">Maximum Carpet Area</li>
          </ul>
          <p className="copy reveal d3">Ground + 22 storeys rising 69 m above the Arabian Sea shoreline, with refuge decks on the 7th and 14th floors and a rooftop sanctuary on the terrace. Scroll on: the tour takes you from the street into the lobby, through a residence and up to the roof.</p>
        </Panel>

        <Panel id="compare" title="Sea view" step="02 · The view">
          <p className="kicker reveal">A view beyond</p>
          <h2 className="display sm reveal d1">Compare</h2>
          <div className="rule reveal d2" />
          <p className="tagline kicker reveal d2" style={{ letterSpacing: '.2em' }}>The finest sea view on the Arabian Sea coast</p>
          <p className="copy reveal d2">Horizons that belong to you. From the 20th floor every residence looks over Mahim Bay through the curved, column-free glass bay.</p>
        </Panel>

        <Panel id="location" title="Location" nav="location" step="03 · Location">
          <h2 className="loc-title reveal"><small>At the centre of</small>Everything<br /><em>that matters</em></h2>
          <p className="copy reveal d1">122/124 SVS Road, Mahim: the plot sits on the seaward side of the old Cadell Road, a few hundred metres from Mahim Bay. Pick a view or a destination to explore the map.</p>
          <MapControls />
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
        </Panel>

        <Panel id="lobby" title="Lobby" step="04 · Ground floor">
          <p className="kicker reveal">Ground floor · Arrival</p>
          <h2 className="retreat reveal">Lobby Retreat</h2>
          <p className="copy reveal d1">“Luxury is not a place, it’s an experience that begins the moment you step in.” A statuario reception desk with a glowing reveal, ring chandeliers, a stone-and-brass feature wall and a lounge by the art wall, beside the two high-speed lifts.</p>
        </Panel>

        <section id="floor" className="sec split" data-title="Entire floor" data-nav="floor">
          <div className="panel">
            <div className="logo-top"><img src="/assets/img/logo-sahil-mark.png" alt="The Sahil" style={{ height: '56px' }} /><span className="step">05 · The residence</span></div>
            <div className="body">
              <p className="kicker reveal">Exclusive · Rare · Yours</p>
              <h2 className="display sm reveal d1">An entire<br />floor</h2>
              <p className="tagline kicker reveal d2" style={{ letterSpacing: '.22em' }}>Privacy &nbsp;|&nbsp; Space &nbsp;|&nbsp; Uninterrupted sea views</p>
              <div className="tiles reveal d3">
                <div><svg viewBox="0 0 32 32"><path d="M16 4l12 12-12 12L4 16z" /><path d="M16 9l7 7-7 7-7-7z" /></svg>One flat on one floor</div>
                <div><svg viewBox="0 0 32 32"><path d="M2 16s5-9 14-9 14 9 14 9-5 9-14 9S2 16 2 16z" /><circle cx="16" cy="16" r="4" /></svg>Uninterrupted sea views</div>
                <div><svg viewBox="0 0 32 32"><rect x="8" y="14" width="16" height="14" rx="1" /><path d="M11 14v-4a5 5 0 0110 0v4" /><circle cx="16" cy="21" r="1.5" /></svg>Complete privacy</div>
                <div><svg viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" /><path d="M12 20l8-8M14 12h6v6" /></svg>Expansive living spaces</div>
              </div>
              <p className="copy reveal d3">The roof of the 12th floor lifts away: four bedrooms, a living and dining room along the curved glass, a curved kitchen, a namaz room and the private lift lobby, furnished as in the brochure.</p>
            </div>
            <div className="logos"><Metro /><Quba /></div>
          </div>
        </section>

        <Panel id="plan" title="Typical plan" step="06 · Plan">
          <p className="kicker reveal">Typical floor plan · 5 BHK</p>
          <ul className="legend reveal d1">
            <li><i className="wood" />Bedrooms · oak floors</li>
            <li><i className="marble" />Living, dining &amp; kitchen · marble</li>
            <li><i className="stone" />Baths · stone</li>
            <li><i className="carpet" />Namaz room · carpet</li>
          </ul>
          <p className="copy reveal d2">Seen from above, the plan matches the brochure layout. Open the <a href="/units" style={{ color: 'var(--blue)' }}>Flat Units overview</a> to inspect every floor.</p>
        </Panel>

        <Panel id="living" title="Living" nav="floor" step="07 · Walk-through">
          <p className="kicker reveal">Sea-facing bay · Typical floor</p>
          <h2 className="retreat reveal">Livingroom Retreat</h2>
          <p className="copy reveal d1">Whether you are a connoisseur of comfort or a lover of light, these well-laid-out living spaces provide the perfect backdrop for your memorable moments. A U-shaped sofa under a crystal chandelier, a marble dining table for eight and the full curve of sea-facing glass.</p>
        </Panel>

        <Panel id="kitchen" title="Kitchen" step="08 · Kitchen">
          <p className="kicker reveal">West bay · Typical floor</p>
          <h2 className="retreat reveal">Kitchen Retreat</h2>
          <p className="copy reveal d1">The vibrant modular kitchen designed with ample storage for you to cook and relish delicacies with family and friends: white gloss units on a curve along the glass, a stone worktop and chevron screens framing the sea.</p>
        </Panel>

        <Panel id="bedroom" title="Bedroom" step="09 · Bedroom">
          <p className="kicker reveal">Private wing · Typical floor</p>
          <h2 className="retreat reveal">Master Bedroom</h2>
          <p className="copy reveal d1">A huge room with a panelled headboard wall, a sitting area of tub chairs at the window, a walk-in wardrobe and an en-suite bath.</p>
        </Panel>

        <Panel id="namaz" title="Namaz room" step="10 · Namaz room">
          <p className="kicker reveal">Beside the lift lobby · Typical floor</p>
          <h2 className="retreat reveal">Namaz Room</h2>
          <p className="copy reveal d1">A room for prayers, a place of peace: an illuminated mihrab arch in geometric lattice, set on the wall that faces the qibla.</p>
        </Panel>

        <Panel id="gym" title="Fitness centre" nav="amenities" step="11 · 3rd floor">
          <p className="kicker reveal">Amenity floor · 3rd floor</p>
          <h2 className="retreat reveal">Fitness Center</h2>
          <p className="copy reveal d1">Bikes along the glass, treadmills, a leg press, free weights and lockers between exposed-brick walls under a coffered ceiling.</p>
        </Panel>

        <Panel id="rooftop" title="Rooftop" step="12 · Terrace +69 m">
          <p className="kicker reveal">Terrace · +69 m</p>
          <ul className="bullets">
            <li className="reveal">Sitting Deck With Uninterrupted Arabian Sea Views</li>
            <li className="reveal d1">Fully Functional Open To Sky Cafeteria</li>
            <li className="reveal d2">Fully Functional Swimming Pool</li>
            <li className="reveal d3">Lockers, Toilets &amp; Changing Rooms On Top</li>
          </ul>
        </Panel>

        <Panel id="pool" title="Pool" step="13 · Pool">
          <p className="kicker reveal">Rooftop · East curve</p>
          <h2 className="retreat reveal">Swimming Pool</h2>
          <p className="copy reveal d1">Loungers on a timber deck beside the pool that fills the curve of the crown, with the bay below.</p>
        </Panel>

        <Panel id="cafe" title="Café" step="14 · Café">
          <p className="kicker reveal">Rooftop · Open to sky</p>
          <h2 className="retreat reveal">Terrace Cafeteria</h2>
          <p className="copy reveal d1">A coffee kiosk with a lit counter and bar stools, set into the rooftop core under the crown.</p>
        </Panel>

        <Panel id="terrace" title="Sit-out" step="15 · Sit-out">
          <p className="kicker reveal">Rooftop · West curve</p>
          <h2 className="retreat reveal">Terrace View</h2>
          <p className="copy reveal d1">A curved run of sofas along the west curve, armchairs, planters and bollard lights looking out to the Arabian Sea.</p>
        </Panel>

        <Panel id="amenities" title="Amenities" nav="amenities" step="16 · Amenities">
          <h2 className="amen-title reveal">Amenities</h2>
          <h3 className="amen-h reveal">External Amenities</h3>
          <ul className="chips reveal d1" aria-label="Hover or tap to see it on the model">
            <li data-view="lobby">Decorative Entrance Lobby</li>
            <li data-view="lifts">High-Speed Elevators</li>
            <li data-view="cctv">24 × 7 CCTV Surveillance</li>
            <li data-view="garden">Roof Top Garden</li>
            <li data-view="sitout">Sit-Out Space</li>
            <li data-view="kitchen">Modular Kitchen</li>
            <li data-view="gym">Fitness Center</li>
            <li data-view="pool">Swimming Pool</li>
            <li data-view="cafe">Terrace Cafeteria</li>
          </ul>
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

        <Panel id="night" title="By night" night step="17 · By night">
          <h2 className="serif reveal" style={{ textAlign: 'center' }}>A Radiant <em>Masterpiece</em><small>on the Skyline</small></h2>
          <p className="copy reveal d1">Crowned by a glowing rooftop sanctuary and rising gracefully above a lush, moonlit landscape, it stands as a striking symbol of prestige — a landmark that doesn’t just touch the sky, but commands it.</p>
          <p className="glow reveal d2">Welcome to a home that shines brighter, day or night.</p>
        </Panel>

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
            <p className="disclaimer">Note: The Developers reserve the right to change plans, specifications and features without prior notice or obligation, at their sole discretion and subject to approval of Government authorities. Specifications, writeup, internal layouts, plans and pictures shown are only indicative. All renderings, floor plans, pictures and maps are the artist's conceptions and not actual depictions of the building, its walls, roadways or landscaping. All the amenities will be provided only as per list mentioned in the agreement. The 3D model on this page is generated from structural drawing R0 (06-07-26) and furnished after the brochure; it is indicative. Furniture models: Kenney Furniture Kit (CC0).</p>
            <p className="fine">Virtual tour · The Sahil · Metro Estates × Quba Groups</p>
          </div>
        </footer>
      </main>
    </>
  );
}
