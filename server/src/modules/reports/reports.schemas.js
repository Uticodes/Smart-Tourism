const { z } = require('zod');

const text = (min, max, message) => z.string().trim().min(min, message).max(max);
const optionalText = (max) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
// Multipart forms send everything as text, so booleans arrive as "true"/"false".
const formBool = z.union([z.boolean(), z.enum(['true', 'false', 'on', '1', '0'])]).transform((v) => v === true || v === 'true' || v === 'on' || v === '1');

const reportSchema = z.object({
  site_name: text(2, 150, 'Enter the name of the place.'),
  local_name: optionalText(150),
  category_id: z.coerce.number().int().positive('Choose a category.'),
  description: text(20, 2000, 'Describe the place in at least 20 characters.'),
  access_notes: optionalText(500),
  latitude: z.coerce.number({ message: 'Choose the location on the map.' }).min(-90).max(90),
  longitude: z.coerce.number({ message: 'Choose the location on the map.' }).min(-180).max(180),
  public_access: formBool.refine((v) => v === true, 'Confirm that the public can visit this place.'),
  different_place: formBool.optional().default(false),
});

const updateSchema = z.object({
  description: text(20, 2000, 'Describe the place in at least 20 characters.'),
  access_notes: optionalText(500),
});

const nearbyQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(50).default(15),
});

const responseSchema = z
  .object({
    response: z.enum(['confirm', 'flag'], { message: 'Choose confirm or flag.' }),
    reason: optionalText(255),
  })
  .refine((v) => v.response !== 'flag' || (v.reason && v.reason.length >= 3), {
    message: 'Say why you are flagging this report.',
    path: ['reason'],
  });

const adminListQuery = z.object({
  status: z.enum(['open', 'pending', 'under_review', 'needs_info', 'approved', 'rejected', 'all']).default('open'),
});

const adminDecision = z
  .object({
    action: z.enum(['approve', 'reject', 'needs_info']),
    note: optionalText(255),
    edits: z
      .object({
        site_name: text(2, 150, 'Enter the name of the place.').optional(),
        category_id: z.coerce.number().int().positive().optional(),
        description: text(20, 2000, 'Describe the place in at least 20 characters.').optional(),
      })
      .optional()
      .default({}),
  })
  .refine((v) => v.action === 'approve' || (v.note && v.note.length >= 3), {
    message: 'Write a short note for the reporter.',
    path: ['note'],
  });

module.exports = { reportSchema, updateSchema, nearbyQuery, responseSchema, adminListQuery, adminDecision };
