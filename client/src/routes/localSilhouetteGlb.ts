// Free local silhouette extrusion. Not AI or six-view photogrammetry.
// Returns a true binary glTF 2.0 GLB with a coarse mesh and no remote calls.
export async function silhouetteToGlb(src: string): Promise<Blob> {
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
