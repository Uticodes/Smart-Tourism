const { z } = require('zod');

const optionalText = (max) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

const attractionSchema = z.object({
  name: z.string().trim().min(2, 'Enter the attraction name.').max(150),
  category_id: z.coerce.number().int().positive('Choose a category.'),
  description: optionalText(5000),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  address: optionalText(255),
  image_url: optionalText(255).refine((v) => !v || /^https?:\/\/|^\/uploads\//.test(v), 'Use a full web address starting with http.'),
  status: z.enum(['active', 'inactive']).default('active'),
});

const nearbyQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(50).default(10),
  minRating: z.coerce.number().min(0).max(5).default(0),
  category: z.coerce.number().int().positive().optional(),
});

const adminListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  category: z.coerce.number().int().positive().optional(),
});

module.exports = { attractionSchema, nearbyQuery, adminListQuery };
