import "./admin-shell.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <nav>
        <a href="/">← Raffle home</a>
      </nav>
      {children}
    </div>
  );
}
