import { useEffect, useRef, useState } from 'react';
import { silhouetteToGlb } from './localSilhouetteGlb';

const VIEWER_SCRIPT = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js';
const labels = ['Front', 'Left', 'Right', 'Back', 'Top', 'Bottom'];

export default function ThreeDGenerator() {
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState('');
  const [modelUrl, setModelUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [modelError, setModelError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generationInfo, setGenerationInfo] = useState('');
  const viewerHost = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    photos.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);
  useEffect(() => () => {
    if (modelUrl) URL.revokeObjectURL(modelUrl);
  }, [modelUrl]);

  useEffect(() => {
    if (!modelUrl || !viewerHost.current) return;
    const element = document.createElement('model-viewer');
    element.setAttribute('src', modelUrl);
    element.setAttribute('alt', 'Selected local 3D model');
    element.setAttribute('camera-controls', '');
    element.setAttribute('auto-rotate', '');
    element.style.cssText = 'display:block;width:100%;height:350px;background:#111827;border-radius:12px';
    viewerHost.current.replaceChildren(element);
    if (!customElements.get('model-viewer') && !document.querySelector('script[data-local-model-viewer]')) {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = VIEWER_SCRIPT;
      script.dataset.localModelViewer = 'true';
      document.head.appendChild(script);
    }
    return () => element.remove();
  }, [modelUrl]);

  function onImages(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (selected.length > 6 || selected.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024)) {
      setPhotoError('Select up to six JPG, PNG or WebP images, each under 12 MB.');
      return;
    }
    setPhotoError('');
    setPhotos(selected.map((file) => URL.createObjectURL(file)));
  }

  async function generateLocal() {
    // Side silhouette drives this coarse prototype. Other views are reference only.
    const source = photos[1] || photos[2];
    if (!source) { setGenerationInfo('Upload a LEFT or RIGHT side photograph first.'); return; }
    setGenerating(true); setGenerationInfo('Creating a coarse mesh locally…');
    try {
      const blob = await silhouetteToGlb(source);
      setModelUrl(URL.createObjectURL(blob));
      setModelName('local-silhouette-prototype.glb');
      setModelError('');
      setGenerationInfo('GLB created locally. This is an approximate side-silhouette extrusion, not a faithful multi-view reconstruction. Other images are not yet used by the geometry algorithm.');
    } catch (err) {
      setGenerationInfo(err instanceof Error ? err.message : 'Local reconstruction failed.');
    } finally { setGenerating(false); }
  }

  function onModel(file: File | undefined) {
    if (!file) return;
    if (!/\.glb$/i.test(file.name) || file.size > 150 * 1024 * 1024) {
      setModelError('Choose a GLB file under 150 MB.');
      return;
    }
    setModelError('');
    setModelName(file.name);
    setModelUrl(URL.createObjectURL(file));
  }

  return (
    <main className="h-full w-full overflow-y-auto bg-surface-primary p-5 text-text-primary" aria-label="3D Generator">
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <h1 className="text-2xl font-semibold">3D Generator</h1>
          <p className="mt-1 text-sm text-text-secondary">Upload reference views of one object. Free browser-based silhouette generation is available; AI generation is not connected.</p>
        </header>
        <section className="rounded-xl border border-border-light bg-surface-primary-alt p-5">
          <h2 className="mb-3 text-lg font-semibold">1. Reference photos</h2>
          <label htmlFor="three-d-photos" className="mb-2 block text-sm">Choose up to 6 views in order: front, left, right, back, top, bottom</label>
          <input id="three-d-photos" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => onImages(event.target.files)} />
          {photoError && <p className="mt-2 text-sm text-red-500" role="alert">{photoError}</p>}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {labels.map((label, index) => <div key={label} className="flex h-36 items-center justify-center overflow-hidden rounded-lg border border-border-light bg-surface-primary">
              {photos[index] ? <img className="h-full w-full object-contain" src={photos[index]} alt={label} /> : <span className="text-sm text-text-secondary">{label}</span>}
            </div>)}
          </div>
          <p className="mt-2 text-xs text-text-secondary">Photos stay in this browser. No upload or remote inference takes place.</p>
        </section>
        <section className="rounded-xl border border-border-light bg-surface-primary-alt p-5">
          <h2 className="mb-2 text-lg font-semibold">2. Generate 3D</h2>
          <p className="mb-3 text-sm text-text-secondary">Free prototype: builds a rough solid from the LEFT or RIGHT side photograph. It cannot reconstruct accurate laces, soles, logos or unseen surfaces. The other views are saved as visual references only. No GPU or paid service is used.</p>
          <button type="button" onClick={generateLocal} disabled={generating} className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60">{generating ? 'Generating locally…' : 'Generate approximate GLB — free'}</button>
          {generationInfo && <p role="status" className="mt-3 text-sm text-text-secondary">{generationInfo}</p>
        </section>
        <section className="rounded-xl border border-border-light bg-surface-primary-alt p-5">
          <h2 className="mb-3 text-lg font-semibold">3. Preview a local 3D model</h2>
          <input type="file" accept=".glb,model/gltf-binary" aria-label="Select a GLB model" onChange={(event) => onModel(event.target.files?.[0])} />
          {modelError && <p className="mt-2 text-sm text-red-500" role="alert">{modelError}</p>}
          {modelName && <p className="mt-2 text-sm text-text-secondary">Selected: {modelName}</p>}
          {modelUrl ? <><div className="mt-3" ref={viewerHost} /><a href={modelUrl} download={modelName} className="mt-3 inline-block text-blue-500 underline">Save selected GLB</a></> : <p className="mt-3 text-sm text-text-secondary">Select a GLB to display its interactive preview. The viewer requires its external component script to load.</p>}
        </section>
      </div>
    </main>
  );
}
