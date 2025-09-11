export default function Footer() {
  return (
    <footer className="glass border-t border-slate-700/30 backdrop-blur-xl mt-12">
      <div className="container mx-auto p-6 text-sm text-slate-400 text-center">
        <span>🛡️ Local-only. No telemetry. © {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}

