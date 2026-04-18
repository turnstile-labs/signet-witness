// Ambient hero backdrop.
// A single soft radial glow sits behind the headline to add depth
// without competing with the typography. No decoration, no noise —
// just lighting. Parent must be `relative`.

export default function HeroBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden"
    >
      {/* Primary accent halo — centered behind the headline. */}
      <div
        className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 w-[820px] h-[420px] max-w-[120%]"
        style={{
          background:
            "radial-gradient(ellipse at center, color-mix(in oklab, var(--color-accent) 22%, transparent) 0%, transparent 62%)",
          filter: "blur(24px)",
          opacity: 0.55,
        }}
      />
      {/* Bottom fade into the page background to avoid a hard cutoff. */}
      <div
        className="absolute inset-x-0 bottom-0 h-24"
        style={{
          background:
            "linear-gradient(to bottom, transparent, var(--color-bg))",
        }}
      />
    </div>
  );
}
