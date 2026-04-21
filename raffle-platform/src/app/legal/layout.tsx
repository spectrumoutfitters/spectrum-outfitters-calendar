export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-6 lg:max-w-4xl lg:px-8">{children}</div>
    </div>
  );
}
