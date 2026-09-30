/**
 * Magic-byte sniffer for the binary file types the uploader allows by default.
 *
 * Multer trusts the client-supplied `Content-Type` header — fine for honest
 * users, useless against an attacker who renames `evil.exe` to `cute.jpg`
 * with `Content-Type: image/jpeg`. We additionally inspect the first bytes
 * of the buffer to verify the declared MIME matches the actual format.
 *
 * Coverage is intentional: only formats we know how to verify, all binary,
 * and all conservative on the XSS surface. Text-ish formats (svg, html,
 * csv, json) are *not* covered here — if you allow those via
 * UPLOAD_ALLOWED_MIME, sniffing is skipped for those entries (we log a
 * warning at boot) and you assume the XSS risk yourself.
 */

const SNIFFERS: Record<string, (buf: Buffer) => boolean> = {
  // FF D8 FF
  'image/jpeg': (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,

  // 89 50 4E 47 0D 0A 1A 0A
  'image/png': (buf) =>
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a,

  // "RIFF" .. "WEBP"
  'image/webp': (buf) =>
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP',

  // GIF87a or GIF89a
  'image/gif': (buf) =>
    buf.length >= 6 &&
    buf.toString('ascii', 0, 4) === 'GIF8' &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61,

  // %PDF
  'application/pdf': (buf) => buf.length >= 4 && buf.toString('ascii', 0, 4) === '%PDF',

  // OLE Compound File (legacy .doc, .xls, .ppt all share this container).
  // D0 CF 11 E0 A1 B1 1A E1
  'application/msword': (buf) =>
    buf.length >= 8 &&
    buf[0] === 0xd0 &&
    buf[1] === 0xcf &&
    buf[2] === 0x11 &&
    buf[3] === 0xe0 &&
    buf[4] === 0xa1 &&
    buf[5] === 0xb1 &&
    buf[6] === 0x1a &&
    buf[7] === 0xe1,

  // .docx (and every other Office Open XML format) is a ZIP container —
  // "PK\x03\x04" only proves it's *a* zip, not specifically a Word doc
  // (same imprecision as any other zip-based format). No XSS risk either
  // way: Cloudinary stores the raw bytes, never executes them.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (buf) =>
    buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04,

  // ISO BMFF `ftyp` box at offset 4-7, HEIF brand at offset 8-11.
  'image/heic': (buf) => isFtypBrand(buf, ['heic', 'heix', 'heim', 'heis']),
  'image/heif': (buf) =>
    isFtypBrand(buf, [
      'mif1',
      'msf1',
      'heic',
      'heix',
      'heim',
      'heis',
      'hevc',
      'hevx',
      'hevm',
      'hevs',
    ]),

  // "8BPS" — Adobe Photoshop native format.
  'image/vnd.adobe.photoshop': (buf) => buf.length >= 4 && buf.toString('ascii', 0, 4) === '8BPS',

  // Modern .ai (Adobe Illustrator) files are PDF-compatible and start with
  // "%PDF"; legacy EPS-flavoured .ai files start with the PostScript header
  // "%!PS-Adobe" instead. Accept either.
  'application/postscript': (buf) =>
    (buf.length >= 4 && buf.toString('ascii', 0, 4) === '%PDF') ||
    (buf.length >= 10 && buf.toString('ascii', 0, 10) === '%!PS-Adobe'),

  // Figma .fig export is a ZIP container — same imprecision caveat as the
  // .docx sniffer above (proves "a zip", not specifically a Figma file). No
  // XSS risk either way: Cloudinary stores the raw bytes, never executes them.
  'application/x-figma': (buf) =>
    buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04,
};

function isFtypBrand(buf: Buffer, brands: string[]): boolean {
  if (buf.length < 12) return false;
  if (buf.toString('ascii', 4, 8) !== 'ftyp') return false;
  return brands.includes(buf.toString('ascii', 8, 12));
}

/** Returns true when sniffer for this mime exists. */
export function hasMagicSniffer(mimeType: string): boolean {
  return mimeType in SNIFFERS;
}

/**
 * Verify the buffer's leading bytes match the declared MIME.
 *
 * Returns:
 *   - { match: true, sniffed: true } — the type is binary and bytes match.
 *   - { match: true, sniffed: false } — no sniffer for this MIME (you've
 *     allowed a type we don't verify, e.g. text/csv). Caller should still
 *     accept but knows the bytes weren't checked.
 *   - { match: false, sniffed: true } — type is binary and bytes mismatch.
 *     Reject the upload.
 */
export function verifyMagicBytes(
  buf: Buffer,
  mimeType: string,
): { match: boolean; sniffed: boolean } {
  const fn = SNIFFERS[mimeType];
  if (!fn) return { match: true, sniffed: false };
  return { match: fn(buf), sniffed: true };
}
