const express = require('express');
const { z } = require('zod');
const { requireAdmin } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const service = require('./analytics.service');

const router = express.Router();

const query = z.object({
  range: z.enum(['7', '30', '90', 'all']).default('30'),
});

// FR-10: admin analytics dashboard.
router.get('/', requireAdmin, validate(query, 'query'), async (req, res, next) => {
  try {
    const { range } = req.validatedQuery;
    res.json(await service.summary({ days: range === 'all' ? null : Number(range) }));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
