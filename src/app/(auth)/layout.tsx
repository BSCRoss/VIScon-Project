import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo size={44} />
        <p className="text-[14px] text-muted">Lunch, decided in under a minute.</p>
      </div>
      <div className="card p-5">{children}</div>
    </main>
  );
}
