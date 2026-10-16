const express = require('express');
const { pool } = require('../../config/db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT category_id, category_name, description FROM Categories ORDER BY category_name'
    );
    res.json({ categories: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
