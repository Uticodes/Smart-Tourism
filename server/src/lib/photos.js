const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const env = require('../config/env');
const { HttpError } = require('../middleware/errors');

const MAX_PHOTOS = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const SUBDIR = 'reports';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: MAX_PHOTOS, fields: 20 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) return cb(null, true);
    cb(new HttpError(400, 'Photos must be JPEG or PNG images.', [{ path: ['photos'], message: 'Use JPEG or PNG photos.' }]));
  },
});

/** Accepts up to 3 files in the "photos" field and turns multer's errors into plain messages. */
function photoUpload(req, res, next) {
  upload.array('photos', MAX_PHOTOS)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof HttpError) return next(err);
    const message = {
      LIMIT_FILE_SIZE: 'Each photo must be 5 MB or smaller.',
      LIMIT_FILE_COUNT: `Add no more than ${MAX_PHOTOS} photos.`,
      LIMIT_UNEXPECTED_FILE: `Add no more than ${MAX_PHOTOS} photos.`,
    }[err.code] || 'The photos could not be uploaded.';
    next(new HttpError(400, message, [{ path: ['photos'], message }]));
  });
}

/**
 * Checks every file really is an image, then re-encodes it as JPEG (max 1600 px).
 * Re-encoding drops all metadata, including EXIF GPS tags, so a photo never reveals more than the report does.
 * Files get random names. Returns the public URLs. Nothing is written unless every photo is valid.
 */
async function savePhotos(files) {
  const encoded = [];
  for (const f of files) {
    try {
      const buffer = await sharp(f.buffer, { failOn: 'error' })
        .rotate() // apply the camera's orientation before the metadata is dropped
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
      encoded.push(buffer);
    } catch {
      throw new HttpError(400, `"${f.originalname}" is not a readable image.`, [{ path: ['photos'], message: 'One of the photos could not be read.' }]);
    }
  }
  const dir = path.join(env.uploadDir, SUBDIR);
  await fs.mkdir(dir, { recursive: true });
  const urls = [];
  for (const buffer of encoded) {
    const name = `${crypto.randomUUID()}.jpg`;
    await fs.writeFile(path.join(dir, name), buffer);
    urls.push(`/uploads/${SUBDIR}/${name}`);
  }
  return urls;
}

/** Removes saved photos again, e.g. when the database insert fails afterwards. */
async function deletePhotos(urls) {
  await Promise.all(urls.map((u) => fs.rm(path.join(env.uploadDir, SUBDIR, path.basename(u)), { force: true })));
}

module.exports = { photoUpload, savePhotos, deletePhotos, MAX_PHOTOS };
