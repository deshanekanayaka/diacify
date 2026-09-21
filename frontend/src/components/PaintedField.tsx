/**
 * The painted ground shared by the public pages: a warm sky that settles into
 * soft green hills along the bottom edge. It fills whatever box it is given,
 * so the same picture works behind a wide hero and inside a tall auth panel.
 *
 * It is drawn rather than photographed. A stock landscape behind a clinical
 * tool would be borrowed atmosphere, and it would cost a megabyte; three
 * gradients and two curves cost nothing and stay sharp at any size.
 *
 * Only usable inside .public-shell, which is where its colour tokens live.
 */
export function PaintedField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--sky-high)_0%,#f4f8f2_45%,var(--sky-low)_100%)]" />

      {/* Two soft lights, low and wide, the way afternoon sits on a horizon. */}
      <div className="absolute top-[45%] left-1/2 h-[60rem] w-[90rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0)_65%)]" />
      <div className="absolute top-[30%] left-[15%] h-[32rem] w-[48rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(211,234,217,0.55)_0%,rgba(211,234,217,0)_70%)]" />

      {/* The hills. Three bands, back to front, each a little greener. */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[46%] w-full"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 190 C 240 120, 420 220, 720 170 C 1020 120, 1220 210, 1440 160 L1440 320 L0 320 Z"
          fill="#dcefe2"
        />
        <path
          d="M0 240 C 260 180, 500 260, 780 220 C 1060 180, 1260 250, 1440 215 L1440 320 L0 320 Z"
          fill="#c4e4ce"
        />
        <path
          d="M0 285 C 300 245, 560 300, 860 270 C 1120 244, 1300 292, 1440 272 L1440 320 L0 320 Z"
          fill="var(--field)"
        />
      </svg>
    </div>
  );
}

