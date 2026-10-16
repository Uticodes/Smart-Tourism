const express = require('express');
const { z } = require('zod');
const { pool } = require('../../config/db');
const { requireAdmin } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { HttpError } = require('../../middleware/errors');

const router = express.Router();
router.use(requireAdmin);

const categorySchema = z.object({
  category_name: z.string().trim().min(2, 'Enter a category name.').max(80),
  description: z.string().trim().max(255).optional().nullable().transform((v) => v || null),
});
const idParam = (req) => z.coerce.number().int().positive().parse(req.params.id);

async function listWithCounts() {
  const [rows] = await pool.query(
    `SELECT c.category_id, c.category_name, c.description,
            (SELECT COUNT(*) FROM Attractions a WHERE a.category_id = c.category_id) AS attraction_count
       FROM Categories c ORDER BY c.category_name`
  );
  return rows;
}

function duplicate(err) {
  if (err.code === 'ER_DUP_ENTRY') return new HttpError(409, 'A category with this name already exists.');
  return err;
}

router.get('/', async (req, res, next) => {
  try {
    res.json({ categories: await listWithCounts() });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(categorySchema), async (req, res, next) => {
  try {
    await pool.execute('INSERT INTO Categories (category_name, description) VALUES (?, ?)', [req.body.category_name, req.body.description]);
    res.status(201).json({ categories: await listWithCounts() });
  } catch (err) {
    next(duplicate(err));
  }
});

router.put('/:id', validate(categorySchema), async (req, res, next) => {
  try {
    const [r] = await pool.execute('UPDATE Categories SET category_name = ?, description = ? WHERE category_id = ?', [
      req.body.category_name, req.body.description, idParam(req),
    ]);
    if (!r.affectedRows) throw new HttpError(404, 'This category does not exist.');
    res.json({ categories: await listWithCounts() });
  } catch (err) {
    next(duplicate(err));
  }
});

// A category in use cannot be deleted, so no attraction is left without one.
router.delete('/:id', async (req, res, next) => {
  try {
    const id = idParam(req);
    const [[{ n }]] = await pool.execute(
      `SELECT (SELECT COUNT(*) FROM Attractions WHERE category_id = ?) + (SELECT COUNT(*) FROM Site_Reports WHERE category_id = ?) AS n`,
      [id, id]
    );
    if (n > 0) throw new HttpError(409, 'This category is still used by attractions or reports. Move them to another category first.');
    const [r] = await pool.execute('DELETE FROM Categories WHERE category_id = ?', [id]);
    if (!r.affectedRows) throw new HttpError(404, 'This category does not exist.');
    res.json({ categories: await listWithCounts() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
