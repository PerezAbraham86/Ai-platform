# Option B: Hunyuan3D-2mv isolated GPU worker

This is **not deployed** and is not connected to LibreChat. It provides a manually executable, local GPU inference entry point using Tencent's official model, with fail-closed configuration. It does not create any Render services, purchase GPU time, or start notebook instances.

## Prerequisites

- Separate NVIDIA CUDA GPU host, suitable VRAM, Python, CUDA/PyTorch, and dependency installation **per the pinned official upstream instructions** at https://github.com/Tencent-Hunyuan/Hunyuan3D-2.
- Review the upstream **Tencent Hunyuan 3D 2.0 Community License**, including territorial/service restrictions and attribution. This is not MIT.
- Download the model weights from https://huggingface.co/tencent/Hunyuan3D-2mv using the official tooling.
- Never install this environment into the production LibreChat Docker container.

## Input mapping

LibreChat currently displays Front / Left / Right / Back / Top / Bottom. The official `examples/shape_gen_multiview.py` demonstrates **front, left and back**. This experimental worker **only accepts front, left and back** in its current adapter. Right/top/bottom are deliberately rejected, rather than silently ignored or passed as unsupported condition keys. Validate any additional views against the actual model before expanding.

## Manual execution on a separate GPU machine

```bash
# After installing upstream Hunyuan3D-2 dependencies in an isolated Python environment:
export ENABLE_HUNYUAN_3D=1
python experiments/3d-worker/run_hunyuan_multiview.py \
  --front /path/front.png --left /path/left.png --back /path/back.png \
  --output /path/output.glb
```

Without `ENABLE_HUNYUAN_3D=1`, the worker refuses to run. With no compatible CUDA device, it refuses. This does not expose a public HTTP API and has no cloud billing integration.

## Future gated website integration

A dedicated, authenticated job service is required to safely accept uploads and return GLB results. Build it **separately**, including server-side auth, size/type validation, one-job-per-user limits, rate limits, explicit spending caps, job expiration, output cleanup and safe file retrieval. Do not connect browser directly to a notebook or expose anonymous GPU generation. The existing browser-local silhouette mode should remain available as a fallback.
