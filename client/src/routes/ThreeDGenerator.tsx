import { useEffect, useRef, useState } from 'react';


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

async function silhouetteToGlb(src: string): Promise<Blob> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const canvas = document.createElement('canvas');
  const w = 96, h = 96;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is unavailable');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const isObject = (x: number, y: number) => {
    const i = 4 * (y * w + x);
    return (data[i] + data[i + 1] + data[i + 2]) / 3 < 239;
  };
  // Determine each column's silhouette bounds; fill only the outside contour,
  // ignoring holes in laces or perforations.
  const spans: { x: number; top: number; bottom: number }[] = [];
  for (let x = 0; x < w; x++) {
    let top = h, bottom = -1;
    for (let y = 0; y < h; y++) if (isObject(x, y)) {
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (bottom >= top) spans.push({ x, top, bottom });
  }
  if (spans.length < 12 || spans.length > 94) {
    throw new Error('No usable side silhouette detected. Use a single shoe with a contrasting, plain background.');
  }
  const lo = spans[0].x, hi = spans[spans.length - 1].x;
  // A coarsely tapered solid extrusion (NOT inferred real shoe width).
  const vertices: number[] = [], indices: number[] = [];
  const sections = spans.filter((_, i) => i % 2 === 0);
  if (sections[sections.length - 1] !== spans[spans.length - 1]) sections.push(spans[spans.length - 1]);
  for (const s of sections) {
    const x = (s.x - lo) / Math.max(1, hi - lo) * 2.6 - 1.3;
    const top = (h - s.top) / h * 1.5;
    const bottom = (h - s.bottom - 1) / h * 1.5;
    const t = (s.x - lo) / Math.max(1, hi - lo);
    const width = 0.16 + 0.34 * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.52) * 1.85, 2)));
    // section ring: bottom-left, bottom-right, top-right, top-left
    vertices.push(x,-width,bottom, x,width,bottom, x,width,top, x,-width,top);
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < 4; j++) {
      const a = i * 4 + j, b = i * 4 + (j + 1) % 4;
      const c = (i + 1) * 4 + j, d = (i + 1) * 4 + (j + 1) % 4;
      indices.push(a,b,c,b,d,c);
    }
  }
  indices.push(0,2,1,0,3,2);
  const e = (sections.length - 1) * 4;
  indices.push(e,e+1,e+2,e,e+2,e+3);
  const pos = new Float32Array(vertices), idx = new Uint32Array(indices);
  const posBytes = new Uint8Array(pos.buffer), idxBytes = new Uint8Array(idx.buffer);
  const align = (n: number) => (n + 3) & ~3;
  const offset = align(posBytes.byteLength);
  const bin = new Uint8Array(align(offset + idxBytes.byteLength));
  bin.set(posBytes, 0); bin.set(idxBytes, offset);
  const mins = [Infinity,Infinity,Infinity], maxs = [-Infinity,-Infinity,-Infinity];
  for(let i=0;i<vertices.length;i+=3) for(let a=0;a<3;a++){mins[a]=Math.min(mins[a],vertices[i+a]);maxs[a]=Math.max(maxs[a],vertices[i+a]);}
  const gltf = {asset:{version:'2.0',generator:'Local silhouette extrusion prototype'},scene:0,
    scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1,material:0}]}],
    materials:[{pbrMetallicRoughness:{baseColorFactor:[0.88,0.9,0.94,1],metallicFactor:0,roughnessFactor:0.9},doubleSided:true}],
    buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:posBytes.length,target:34962},
    {buffer:0,byteOffset:offset,byteLength:idxBytes.length,target:34963}],
    accessors:[{bufferView:0,componentType:5126,count:vertices.length/3,type:'VEC3',min:mins,max:maxs},
    {bufferView:1,componentType:5125,count:indices.length,type:'SCALAR'}]};
  const json = new TextEncoder().encode(JSON.stringify(gltf));
  const padded = align(json.length), total = 12+8+padded+8+bin.length;
  const out = new ArrayBuffer(total), view = new DataView(out), bytes = new Uint8Array(out);
  view.setUint32(0,0x46546c67,true); view.setUint32(4,2,true);view.setUint32(8,total,true);
  view.setUint32(12,padded,true);view.setUint32(16,0x4e4f534a,true);
  bytes.fill(0x20,20,20+padded);bytes.set(json,20);
  view.setUint32(20+padded,bin.length,true);view.setUint32(24+padded,0x004e4942,true);
  bytes.set(bin,28+padded);
  return new Blob([out],{type:'model/gltf-binary'});
}

