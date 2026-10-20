const fs = require('fs');
const path = require('path');
const { withAttractionPhoto } = require('../../src/lib/attractionPhotos');
const photos = require('../../data/place-photos.json');

it('supplies researched photos and credits for curated places without photos', () => {
  const row = withAttractionPhoto({ name: 'Eagle Square', source: 'curated', image_url: null });
  expect(row.image_url).toBe(photos['Eagle Square'].url);
  expect(row.photo_credit.source_url).toMatch(/^https:\/\/commons.wikimedia.org\//);
});

it.each(['curated', 'community'])('preserves an existing %s photo', (source) => {
  const row = { name: 'Eagle Square', source, image_url: '/uploads/reports/existing.jpg' };
  expect(withAttractionPhoto(row)).toBe(row);
});

it('does not attach another place’s photo to a community report or unknown place', () => {
  for (const row of [{ name: 'Eagle Square', source: 'community' }, { name: 'Unknown', source: 'curated' }]) {
    expect(withAttractionPhoto(row)).toBe(row);
  }
});

it('ships an asset and complete source credits for every researched photo', () => {
  for (const photo of Object.values(photos)) {
    if (photo.reuse_status === 'externally-hosted-source') {
      expect(photo.url).toMatch(/^https:\/\//);
      expect(photo.license).toBeNull();
      expect(photo.license_note).toBeTruthy();
      continue;
    }
    expect(fs.existsSync(path.join(__dirname, '../../../client/public', photo.url))).toBe(true);
    expect(photo.author).toBeTruthy();
    expect(photo.source_url).toMatch(/^https:\/\//);
    if (photo.source_name && photo.source_name !== 'Wikimedia Commons') {
      expect(photo.license_evidence_url).toMatch(/^https:\/\//);
    }
    expect(photo.license).toMatch(/^(CC BY|CC0|Public domain)/);
    if (photo.license.startsWith('CC BY')) expect(photo.license_url).toMatch(/^https?:\/\/creativecommons.org\//);
  }
});
