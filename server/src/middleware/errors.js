/** An error with an HTTP status that is safe to show to the client. */
class HttpError extends Error {
  /** `extra` adds fields to the JSON body, e.g. { code: 'DUPLICATE', nearby: {...} }. */
  constructor(status, message, details, extra) {
    super(message);
    this.status = status;
    this.details = details;
    this.extra = extra;
  }
}

function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Some details are missing or not valid.', details: err.issues });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? 'Something went wrong' : err.message,
    ...(err.details ? { details: err.details } : {}),
    ...(status < 500 && err.extra ? err.extra : {}),
  });
}

module.exports = { HttpError, notFound, errorHandler };
