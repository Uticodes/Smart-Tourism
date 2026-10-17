const express = require('express');
const { z } = require('zod');
const { requireAdmin } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { adminListQuery, adminDecision } = require('./reports.schemas');
const service = require('./reports.service');

const router = express.Router();
router.use(requireAdmin);

const idParam = (req) => z.coerce.number().int().positive().parse(req.params.id);

router.get('/', validate(adminListQuery, 'query'), async (req, res, next) => {
  try {
    res.json(await service.adminList(req.validatedQuery));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json({ report: await service.adminGet(idParam(req)) });
  } catch (err) {
    next(err);
  }
});

// FR-14: approve (publishes it as a community attraction), reject (reason required) or ask for more information.
router.patch('/:id', validate(adminDecision), async (req, res, next) => {
  try {
    res.json({ report: await service.adminDecide(req.user.id, idParam(req), req.body) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
