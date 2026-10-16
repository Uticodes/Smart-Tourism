const express = require('express');
const { optionalAuth } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { recommendationsQuery, selectionBody } = require('./recommendations.schemas');
const service = require('./recommendations.service');

const router = express.Router();

// FR-04: personalised when signed in with saved interests, otherwise ranked by rating and distance.
router.get('/', optionalAuth, validate(recommendationsQuery, 'query'), async (req, res, next) => {
  try {
    const q = req.validatedQuery;
    res.json(await service.recommend({ userId: req.user?.id, ...q }));
  } catch (err) {
    next(err);
  }
});

// Which result was opened, and at what rank (MRR evaluation, Section 3.8.3).
router.post('/selection', optionalAuth, validate(selectionBody), async (req, res, next) => {
  try {
    const b = req.body;
    res.json(await service.recordSelection({ userId: req.user?.id, searchId: b.search_id, attractionId: b.attraction_id, rank: b.rank }));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
