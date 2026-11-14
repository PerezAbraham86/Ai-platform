# Multi-model 3D generator integration

The authenticated LibreChat API endpoint `GET /api/3d-generation/models` returns the
server-side model catalog. `POST /api/3d-generation/jobs` intentionally returns a
failure until an actual GPU worker, persistent job store, and abuse protections are
implemented. No AI generation, billing, or uploads are enabled by this change.

## Intended next implementation

1. Persist user-owned job records with explicit queued/running/succeeded/failed/cancelled states.
2. Implement authenticated image uploads with MIME/magic-byte validation, size/count
   limits, image decoding, per-user quotas, and job cancellation.
3. Implement worker credentials, signed storage references, timeouts, retry policy,
   and isolated GPU adapters for Pixal3D and Hunyuan3D.
4. Validate Pixal3D camera transforms against prepared multiview inputs. Do not
   treat arbitrary ordered photos as calibrated views.
5. Convert GLB embedded WebP textures to broadly compatible PNG as needed.
6. Add status polling and authorized result downloads with expiration and cleanup.
7. Run build, API/auth tests, and GPU end-to-end tests before deployment.

Never run the Pixal3D checkpoint loader inside the production LibreChat server.
