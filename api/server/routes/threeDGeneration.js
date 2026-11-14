const express = require('express');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');

const router = express.Router();
router.use(requireJwtAuth);

const models = Object.freeze([
  {
    id: 'pixal3d',
    name: 'Pixal3D',
    status: 'not-connected',
    available: false,
    acceptedViews: ['front', 'left', 'right', 'back'],
    requiresCameraTransforms: true,
    outputFormats: ['glb'],
  },
  {
    id: 'hunyuan3d-2mv',
    name: 'Hunyuan3D 2mv',
    status: 'not-deployed',
    available: false,
    acceptedViews: ['front', 'left', 'back'],
    requiresCameraTransforms: false,
    outputFormats: ['glb'],
  },
  {
    id: 'local-silhouette',
    name: 'Local Silhouette',
    status: 'browser-only',
    available: true,
    acceptedViews: ['left', 'right'],
    requiresCameraTransforms: false,
    outputFormats: ['glb'],
  },
]);

router.get('/models', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.json({ version: 1, models });
});

// Explicitly fail closed: no GPU dispatch, remote uploads, or billing until
// authenticated, rate-limited, persistent job storage and worker are ready.
router.post('/jobs', (req, res) => {
  const model = models.find((item) => item.id === req.body?.model);
  if (!model) return res.status(400).json({ code: 'INVALID_3D_MODEL', error: 'Unknown 3D model.' });
  return res.status(503).json({
    code: 'THREE_D_WORKER_UNAVAILABLE',
    error: model.id === 'local-silhouette'
      ? 'Local silhouette generation runs in the browser.'
      : 'AI generation is not connected to a GPU worker.',
    model: model.id,
  });
});

module.exports = router;
