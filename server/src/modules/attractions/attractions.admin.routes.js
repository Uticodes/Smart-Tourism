const express = require('express');
const { z } = require('zod');
const { requireAdmin } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { attractionSchema, adminListQuery } = require('./attractions.schemas');
const service = require('./attractions.service');

const router = express.Router();
router.use(requireAdmin);

const idParam = (req) => z.coerce.number().int().positive().parse(req.params.id);

router.get('/', validate(adminListQuery, 'query'), async (req, res, next) => {
  try {
    res.json({ attractions: await service.listForAdmin(req.validatedQuery) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json({ attraction: await service.getById(idParam(req), { includeInactive: true }) });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(attractionSchema), async (req, res, next) => {
  try {
    res.status(201).json({ attraction: await service.create(req.body) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', validate(attractionSchema), async (req, res, next) => {
  try {
    res.json({ attraction: await service.update(idParam(req), req.body) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    res.json({ attraction: await service.deactivate(idParam(req)) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
