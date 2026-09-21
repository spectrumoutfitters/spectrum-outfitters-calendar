/**
 * Canvas size for prize JPEG compression: downscale width to maxWidth, keep aspect ratio.
 * Returns null when either side is not a positive number (invalid image).
 */
export function scaleImageDimensions(width, height, maxWidth) {
  let w = Number(width);
  let h = Number(height);
  if (!(w > 0) || !(h > 0)) return null;
  if (w > maxWidth) {
    h = (h * maxWidth) / w;
    w = maxWidth;
  }
  return { width: Math.round(w), height: Math.round(h) };
}
