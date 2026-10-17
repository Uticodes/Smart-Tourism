const express = require('express');
const { z } = require('zod');
const { optionalAuth, requireAuth } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const service = require('./reviews.service');

// Mounted at /api/attractions/:id/reviews (FR-08).
const router = express.Router({ mergeParams: true });

const reviewSchema = z.object({
  rating: z.coerce.number({ message: 'Choose a rating from 1 to 5 stars.' }).int().min(1, 'Choose a rating from 1 to 5 stars.').max(5, 'Choose a rating from 1 to 5 stars.'),
  comment: z.string().trim().max(1000, 'Keep your review under 1,000 characters.').optional().nullable().transform((v) => (v ? v : null)),
});

const idParam = (req) => z.coerce.number().int().positive().parse(req.params.id);

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    res.json(await service.list(idParam(req), req.user?.id));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, validate(reviewSchema), async (req, res, next) => {
  try {
    res.status(201).json(await service.create(req.user.id, idParam(req), req.body));
  } catch (err) {
    next(err);
  }
});

router.put('/mine', requireAuth, validate(reviewSchema), async (req, res, next) => {
  try {
    res.json(await service.update(req.user.id, idParam(req), req.body));
  } catch (err) {
    next(err);
  }
});

router.delete('/mine', requireAuth, async (req, res, next) => {
  try {
    res.json(await service.remove(req.user.id, idParam(req)));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
