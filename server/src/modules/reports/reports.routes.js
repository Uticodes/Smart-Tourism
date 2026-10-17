const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { photoUpload, savePhotos, deletePhotos } = require('../../lib/photos');
const { reportSchema, updateSchema, nearbyQuery, responseSchema } = require('./reports.schemas');
const service = require('./reports.service');
const { HttpError } = require('../../middleware/errors');

const router = express.Router();
const idParam = (req) => z.coerce.number().int().positive().parse(req.params.id);

/**
 * FR-11, FR-12, FR-15: report a place that is not on the map yet.
 * Order matters: sign-in, then the form, then the cheap checks (daily limit, FCT, duplicates),
 * and only then are the photos re-encoded and saved.
 */
router.post('/', requireAuth, photoUpload, validate(reportSchema), async (req, res, next) => {
  let saved = [];
  try {
    const files = req.files || [];
    if (files.length === 0) {
      throw new HttpError(400, 'Add at least one photo of the place.', [{ path: ['photos'], message: 'Add at least one photo.' }]);
    }
    const nearest = await service.preflight(req.user.id, req.body);
    saved = await savePhotos(files);
    const report = await service.create(req.user.id, { ...req.body, _nearest: nearest }, saved);
    res.status(201).json({ report });
  } catch (err) {
    if (saved.length) await deletePhotos(saved).catch(() => {});
    next(err);
  }
});

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    res.json({ reports: await service.listMine(req.user.id) });
  } catch (err) {
    next(err);
  }
});

// FR-13: unverified reports near the user (not their own, not hidden).
router.get('/nearby', requireAuth, validate(nearbyQuery, 'query'), async (req, res, next) => {
  try {
    res.json({ reports: await service.listNearby(req.user.id, req.validatedQuery) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, validate(updateSchema), async (req, res, next) => {
  try {
    res.json({ report: await service.updateOwn(req.user.id, idParam(req), req.body) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/responses', requireAuth, validate(responseSchema), async (req, res, next) => {
  try {
    res.status(201).json({ result: await service.respond(req.user.id, idParam(req), req.body) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
