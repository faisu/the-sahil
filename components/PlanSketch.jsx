// A flat's plan drawn as the pipeline is read: the walls draw themselves (step 1), the levels
// stack up behind (2), furniture and fan points land from the layouts (3), the street map
// appears underneath (4), the camera path orbits the plan (5) and the model is sealed (6).
// Landing.jsx sets `data-step` on the root; app/landing.css transitions each layer in.
export default function PlanSketch({ step = 1 }) {
  return (
    <svg className="ld-sketch" data-step={step} viewBox="0 0 520 400" role="img" aria-label="A flat's plan, from drawing to delivered model">
      <defs>
        <pattern id="sk-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0v20" fill="none" stroke="currentColor" strokeWidth=".6" />
        </pattern>
        <clipPath id="sk-clip"><rect x="110" y="70" width="300" height="260" /></clipPath>
      </defs>

      {/* 1 · blueprint grid */}
      <rect className="sk-grid" width="520" height="400" fill="url(#sk-grid)" />

      {/* 4 · the street map under the plot */}
      <g className="sk-map">
        <path d="M-10 352 L530 262" className="sk-road" />
        <path d="M58 -10 L138 410" className="sk-road" />
        <path d="M-10 352 L530 262" className="sk-road-dash" />
        <path d="M58 -10 L138 410" className="sk-road-dash" />
        <g className="sk-pin" transform="translate(432 54)">
          <path d="M0 0c-9 0-16 7-16 16 0 12 16 28 16 28s16-16 16-28c0-9-7-16-16-16z" />
          <circle cx="0" cy="16" r="5" />
        </g>
      </g>

      {/* 2 · the levels below this one */}
      <g className="sk-stack">
        <rect x="110" y="70" width="300" height="260" transform="translate(16 44)" />
        <rect x="110" y="70" width="300" height="260" transform="translate(8 22)" />
      </g>

      {/* 2 · room fills */}
      <g className="sk-rooms">
        <rect x="110" y="70" width="150" height="130" className="r-living" />
        <rect x="260" y="70" width="150" height="130" className="r-bed" />
        <rect x="110" y="200" width="120" height="130" className="r-kitchen" />
        <rect x="230" y="200" width="60" height="60" className="r-wet" />
        <rect x="230" y="260" width="60" height="70" className="r-wet" />
        <rect x="290" y="200" width="120" height="130" className="r-bed" />
      </g>

      {/* 1 · walls, drawn */}
      <g className="sk-walls">
        <rect x="110" y="70" width="300" height="260" className="w-outer" />
        <path d="M260 70v130M110 200h300M230 200v130M290 200v130M230 260h60" className="w-inner" />
        {/* windows */}
        <path d="M140 70h60M300 70h80M410 110v60M410 240v60M110 240v50M190 330h30M330 330h60" className="w-window" />
        {/* doors */}
        <path d="M110 150a28 28 0 0 1 28 -28M260 150v-28a28 28 0 0 0 -28 28M290 230h-28a28 28 0 0 1 28 -28M230 290a24 24 0 0 1 24 -24M290 290v-24a24 24 0 0 0 -24 24" className="w-door" />
      </g>

      {/* 3 · furniture from the layout, fan points and switchboards from the electrical drawing */}
      <g className="sk-furn">
        <rect x="124" y="84" width="74" height="22" rx="6" />
        <rect x="124" y="84" width="22" height="72" rx="6" />
        <circle cx="222" cy="160" r="17" />
        <circle cx="222" cy="134" r="5" /><circle cx="222" cy="186" r="5" /><circle cx="196" cy="160" r="5" /><circle cx="248" cy="160" r="5" />
        <rect x="300" y="88" width="88" height="62" rx="5" />
        <rect x="304" y="92" width="18" height="24" rx="3" className="f-pillow" /><rect x="304" y="122" width="18" height="24" rx="3" className="f-pillow" />
        <rect x="270" y="150" width="22" height="42" rx="2" />
        <rect x="118" y="206" width="104" height="18" rx="2" /><rect x="118" y="206" width="18" height="112" rx="2" />
        <circle cx="200" cy="215" r="5" className="f-hob" /><circle cx="212" cy="215" r="5" className="f-hob" />
        <ellipse cx="260" cy="214" rx="7" ry="9" /><rect x="238" y="238" width="18" height="12" rx="2" />
        <ellipse cx="260" cy="276" rx="7" ry="9" /><rect x="238" y="300" width="18" height="12" rx="2" />
        <rect x="300" y="220" width="80" height="56" rx="5" />
        <rect x="304" y="224" width="16" height="22" rx="3" className="f-pillow" /><rect x="304" y="250" width="16" height="22" rx="3" className="f-pillow" />
        <rect x="384" y="206" width="20" height="60" rx="2" />
        <g className="sk-fans">
          <g transform="translate(185 135)"><circle r="9" /><path d="M-9 0h18M0-9v18" /></g>
          <g transform="translate(335 135)"><circle r="9" /><path d="M-9 0h18M0-9v18" /></g>
          <g transform="translate(350 265)"><circle r="9" /><path d="M-9 0h18M0-9v18" /></g>
          <g transform="translate(170 265)"><circle r="9" /><path d="M-9 0h18M0-9v18" /></g>
        </g>
        <g className="sk-switch">
          <rect x="114" y="158" width="6" height="10" /><rect x="264" y="154" width="6" height="10" /><rect x="294" y="236" width="6" height="10" /><rect x="214" y="238" width="6" height="10" />
        </g>
      </g>

      {/* 5 · the scroll-driven camera orbits the plan */}
      <g className="sk-cam">
        <path id="sk-orbit" d="M60 200a200 130 0 1 0 400 0a200 130 0 1 0 -400 0" />
        <g className="sk-cam-dot">
          <circle r="7" />
          <circle r="14" className="sk-cam-ring" />
          <animateMotion dur="9s" repeatCount="indefinite" rotate="auto"><mpath href="#sk-orbit" /></animateMotion>
        </g>
      </g>

      {/* 6 · sealed: the scan line and the session lock */}
      <g className="sk-seal">
        <rect className="sk-scan" x="110" y="70" width="300" height="6" clipPath="url(#sk-clip)" />
        <g transform="translate(88 300)">
          <rect x="0" y="12" width="26" height="20" rx="4" />
          <path d="M5 12V8a8 8 0 0 1 16 0v4" />
          <circle cx="13" cy="22" r="2.6" className="sk-key" />
        </g>
        <text x="60" y="354" className="sk-label">AES · session key · 5 min</text>
      </g>
    </svg>
  );
}
