export function GlobeBackdrop() {
  return (
    <svg class="hero-globe" viewBox="0 0 800 800" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="globe-clip">
          <circle cx="400" cy="400" r="268" />
        </clipPath>
      </defs>
      <g class="globe-spin" fill="none" stroke="currentColor" stroke-width="1.05">
        <circle cx="400" cy="400" r="268" />
        <ellipse cx="400" cy="400" rx="88" ry="268" />
        <ellipse cx="400" cy="400" rx="165" ry="268" />
        <ellipse cx="400" cy="400" rx="228" ry="268" />
        <ellipse cx="400" cy="400" rx="268" ry="58" />
        <ellipse cx="400" cy="400" rx="268" ry="125" />
        <ellipse cx="400" cy="400" rx="268" ry="190" />
        <path d="M132 400h536" />
        <g clip-path="url(#globe-clip)" fill="currentColor" fill-opacity="0.09" stroke="none">
          <path d="M268 250c28-22 62-28 94-18 31 10 48 22 78 18 22-3 41 8 52 28-18 14-41 18-64 14-32-6-49 8-78 22-26 12-58 8-82-8-14-10-18-32 0-56z" />
          <path d="M430 318c36-8 70 4 92 28 18 20 14 42-6 58-22 18-58 24-88 12-26-10-52-8-72-24 22-22 40-52 74-74z" />
          <path d="M310 468c42 8 78 6 104-18 20 18 18 46-4 64-32 26-82 32-122 14-18-8-22-28-8-42 10-8 18-14 30-18z" />
          <path d="M520 490c24 4 38 22 34 44-18 16-46 18-68 6-12-6-14-22-2-30 10-6 22-16 36-20z" />
          <path d="M210 360c22-8 38 4 44 22 4 14-6 26-22 30-18 4-36-6-40-22-4-16 4-24 18-30z" />
          <path d="M560 360c18-14 42-10 52 8 8 16-4 30-22 34-20 4-38-10-40-26 0-8 4-12 10-16z" />
          <path d="M390 560c28 4 48 18 44 36-22 12-52 8-72-6-12-8-8-22 6-28 8-4 14-4 22-2z" />
        </g>
        <circle cx="400" cy="400" r="272" stroke="currentColor" stroke-opacity="0.35" />
      </g>
    </svg>
  );
}
