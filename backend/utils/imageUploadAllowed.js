import path from 'path';

/**
 * Order and product photo uploads.
 * Extension is lowercased; MIME is matched as sent. Both must match
 * jpeg/jpg/png/gif/webp (substring, same as the previous inline filters).
 */
const IMAGE_TYPE = /jpeg|jpg|png|gif|webp/;

export function imageUploadAllowed(originalname, mimetype) {
  const extname = IMAGE_TYPE.test(path.extname(originalname).toLowerCase());
  const mimetypeOk = IMAGE_TYPE.test(mimetype);
  return Boolean(mimetypeOk && extname);
}
