const { z } = require('zod');

const recommendationsQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(50).default(15),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const selectionBody = z.object({
  search_id: z.coerce.number().int().positive(),
  attraction_id: z.coerce.number().int().positive(),
  rank: z.coerce.number().int().min(1).max(1000),
});

module.exports = { recommendationsQuery, selectionBody };
