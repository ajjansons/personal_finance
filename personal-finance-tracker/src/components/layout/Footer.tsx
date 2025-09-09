export default function Footer() {
  return (
    <footer className="border-t bg-white">
      <div className="container mx-auto p-4 text-sm text-gray-500">
        <span>Local-only. No telemetry. © {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}

