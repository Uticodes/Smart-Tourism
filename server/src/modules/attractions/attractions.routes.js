const express = require('express');
const { z } = require('zod');
const { pool } = require('../../config/db');
const { optionalAuth } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { nearbyQuery } = require('./attractions.schemas');
const service = require('./attractions.service');

const router = express.Router();

// FR-03 / FR-05: attractions within a radius of a point, nearest first.
router.get('/nearby', optionalAuth, validate(nearbyQuery, 'query'), async (req, res, next) => {
  try {
    const q = req.validatedQuery;
    const attractions = await service.findNearby(q);
    let categoryName = null;
    if (q.category) {
      const [[c]] = await pool.execute('SELECT category_name FROM Categories WHERE category_id = ?', [q.category]);
      categoryName = c?.category_name || null;
    }
    const searchId = await service.logSearch({ userId: req.user?.id, lat: q.lat, lng: q.lng, categoryName });
    res.json({ search_id: searchId, count: attractions.length, radius_km: q.radius, attractions });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    res.json({ attraction: await service.getDetails(id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
