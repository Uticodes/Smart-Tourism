const sharp = require('sharp');

/** A small JPEG carrying a camera make and GPS tags in its EXIF block, like a phone photo. */
function photoWithGps() {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: '#3a7a4b' } })
    .jpeg()
    .withExif({ IFD0: { Make: 'TestPhone' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '9/1 3/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '7/1 29/1 0/1' } })
    .toBuffer();
}

function png() {
  return sharp({ create: { width: 32, height: 32, channels: 3, background: '#9a3f22' } }).png().toBuffer();
}

module.exports = { photoWithGps, png };
