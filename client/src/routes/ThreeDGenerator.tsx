/** Phase 2: authenticated LibreChat route; no inference calls or credentials. */
export default function ThreeDGenerator() {
  return (
    <main className="flex h-full min-h-0 w-full flex-col bg-surface-primary" aria-label="3D Generator">
      <div className="border-b border-border-light px-5 py-3">
        <h1 className="text-lg font-semibold text-text-primary">3D Generator</h1>
        <p className="text-sm text-text-secondary">Local previews only. AI generation is not connected.</p>
      </div>
      <iframe
        src="/3d-generator/index.html"
        title="3D Generator local preview workspace"
        className="min-h-0 w-full flex-1 border-0"
        sandbox="allow-scripts allow-downloads"
        referrerPolicy="no-referrer"
      />
    </main>
  );
}
