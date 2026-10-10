export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="grid place-items-center rounded-xl bg-brand-700 text-white shadow-sm" style={{ width: size, height: size }} aria-hidden>
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11h18" /><path d="M5 11a7 7 0 0 1 14 0" /><path d="M4 15h16l-1 4H5z" /><path d="M12 3v2" />
        </svg>
      </span>
      <span className="text-[17px] font-semibold tracking-tight">greyGiraffe</span>
    </span>
  );
}
