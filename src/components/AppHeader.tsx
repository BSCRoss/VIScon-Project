export function AppHeader({ title, subtitle, right, eyebrow }: { title: string; subtitle?: React.ReactNode; right?: React.ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h1 className="truncate text-[24px] font-semibold tracking-tight">{title}</h1>
        {subtitle ? <div className="mt-0.5 text-[13px] text-muted">{subtitle}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </header>
  );
}
