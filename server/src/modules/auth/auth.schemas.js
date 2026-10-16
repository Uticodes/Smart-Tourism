const { z } = require('zod');

const registerSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name.').max(100),
  display_name: z.string().trim().min(2).max(50).optional().or(z.literal('').transform(() => undefined)),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(150),
  // bcrypt only uses the first 72 bytes, so longer passwords are refused rather than silently cut
  password: z.string().min(8, 'Use at least 8 characters.').max(72, 'Use 72 characters or fewer.'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

module.exports = { registerSchema, loginSchema };
