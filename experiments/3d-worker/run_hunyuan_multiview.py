"""Manual, fail-closed proof-of-concept for official Hunyuan3D-2mv.
Requires the official upstream Python environment on a separate CUDA GPU.
No HTTP server, deployment, subscription, or third-party API calls.
"""
import argparse
import os
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Hunyuan3D-2mv isolated 3-view inference")
    parser.add_argument("--front", required=True, type=Path)
    parser.add_argument("--left", required=True, type=Path)
    parser.add_argument("--back", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--seed", type=int, default=12345)
    args = parser.parse_args()
    if os.environ.get("ENABLE_HUNYUAN_3D") != "1":
        parser.error("Disabled by default: set ENABLE_HUNYUAN_3D=1 on the separate GPU worker.")
    if args.output.suffix.lower() != ".glb":
        parser.error("--output must be a .glb path")
    for key in ("front", "left", "back"):
        image_path = getattr(args, key)
        if not image_path.is_file() or image_path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            parser.error(f"{key} must be an existing PNG/JPEG/WebP image")
        if image_path.stat().st_size > 12 * 1024 * 1024:
            parser.error(f"{key} exceeds 12 MB")
    import torch
    if not torch.cuda.is_available():
        parser.error("CUDA GPU unavailable; refuse CPU fallback.")
    from PIL import Image
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline

    # Official upstream example uses these exact condition keys and fp16 variant.
    images = {key: Image.open(getattr(args, key)).convert("RGBA")
              for key in ("front", "left", "back")}
    model = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
        "tencent/Hunyuan3D-2mv",
        subfolder="hunyuan3d-dit-v2-mv",
        variant="fp16",
    )
    mesh = model(
        image=images,
        num_inference_steps=50,
        octree_resolution=380,
        num_chunks=20000,
        generator=torch.manual_seed(args.seed),
        output_type="trimesh",
    )[0]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    mesh.export(str(args.output))
    print(f"Exported GLB: {args.output}")


if __name__ == "__main__":
    main()
