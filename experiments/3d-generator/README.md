# 3D Generator — Phase 1 (isolated prototype)

This folder is a standalone, static prototype for uploading multiple views of **one object** (e.g. a single AF1 High shoe), previewing them, and viewing an already-generated GLB/GLTF file.

## Safety boundaries

- Does **not** modify LibreChat client routes, API routes, auth, Dockerfiles, compose, Render environment or deploy settings.
- Does **not** execute AI inference, GPU jobs, image uploads to remote services or paid APIs.
- File operations happen **inside the browser** using local File objects and object URLs only.
- This is **not yet linked to the production navigation**; intentionally no production entry point.
- The Generate action stays disabled until a separately deployed, authenticated and cost-controlled GPU worker has been selected and verified.

## Try locally

From repository root, serve this directory with a static HTTP server:

```bash
cd experiments/3d-generator
python3 -m http.server 8765
```

Open http://localhost:8765. Choose up to four image files and optionally a local .glb/.gltf model. The preview uses Google's <model-viewer> client component loaded from its CDN; if offline, model viewing may be unavailable. No image or mesh is uploaded.

## Future integration checkpoints

1. Decide whether generator lives under LibreChat via deliberate routing/auth integration or a separate subdomain with SSO.
2. Select a legally compatible inference engine supporting multi-view generation, and check VRAM/hardware requirements.
3. Build a separately hosted async worker with per-user auth, upload size limits, input validation, job states, cancellation, TTL cleanup, rate limiting and explicit spend limits.
4. Preserve strict fail-closed default: generator not available unless GPU endpoint is explicitly configured and verified.
5. Test actual export, mesh quality and licensing before exposing it in Sneaker Design Studio.

NOTE: A local file viewer is **not** a working image-to-3D model generator. Blender panel segmentation remains separate work.
