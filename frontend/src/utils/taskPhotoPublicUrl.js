/**
 * Browser URL for a stored task photo path.
 * Multer on Windows records backslashes; img src needs forward slashes.
 */
export function taskPhotoPublicUrl(filePath) {
  return `/${filePath.replace(/\\/g, '/')}`;
}
