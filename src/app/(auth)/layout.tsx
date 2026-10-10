export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="mb-6 text-center text-3xl font-bold tracking-tight">🦒 greyGiraffe</h1>
      <div className="card">{children}</div>
    </main>
  );
}
