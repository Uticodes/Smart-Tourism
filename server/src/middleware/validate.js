/**
 * Validates and replaces req[part] with the parsed result of a zod schema.
 * Invalid input is turned into a 400 by the error handler.
 */
function validate(schema, part = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) return next(result.error);
    if (part === 'query') {
      Object.defineProperty(req, 'validatedQuery', { value: result.data });
    } else {
      req[part] = result.data;
    }
    next();
  };
}

module.exports = { validate };
