const photos = require('../../data/place-photos.json');

/** Keep uploaded/admin photos first; use the researched photo only when none exists. */
function withAttractionPhoto(attraction) {
  const photo = attraction.source === 'curated' ? photos[attraction.name] : null;
  if (!photo || (attraction.image_url && attraction.image_url !== photo.url)) return attraction;
  return { ...attraction, image_url: photo.url, photo_credit: photo };
}

module.exports = { withAttractionPhoto };
