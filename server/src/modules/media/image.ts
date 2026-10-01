import sharp from 'sharp';
import { ApiError } from '../../utils/ApiError.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MEDIA_COUNTS = { places: 6, reviews: 3 } as const;
export const imageError = (code: string, message: string, status = 400) =>
  new ApiError(status, code, message);

export async function normalizeImage(input: Buffer, filename: string, mime: string) {
  if (input.length > MAX_IMAGE_BYTES)
    throw imageError('IMAGE_TOO_LARGE', 'Images must be at most 5 MiB.', 413);
  const format = input.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
    ? 'jpeg'
    : input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? 'png'
      : input.toString('ascii', 0, 4) === 'RIFF' && input.toString('ascii', 8, 12) === 'WEBP'
        ? 'webp'
        : null;
  const extension = filename.split('.').at(-1)?.toLowerCase();
  if (
    !format ||
    /[\\/:\0]/.test(filename) ||
    mime !== `image/${format}` ||
    !(format === 'jpeg' ? ['jpg', 'jpeg'] : [format]).includes(extension ?? '')
  )
    throw imageError(
      'UNSUPPORTED_IMAGE',
      'Use a JPEG, PNG or WebP image with matching file type and extension.',
    );
  try {
    const pipeline = sharp(input, {
      failOn: 'warning',
      limitInputPixels: 16_000_000,
      limitInputChannels: 4,
    });
    const metadata = await pipeline.metadata();
    if (
      metadata.format !== format ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > 8192 ||
      metadata.height > 8192 ||
      metadata.width * metadata.height > 16_000_000 ||
      (metadata.pages ?? 1) > 1
    )
      throw imageError(
        'INVALID_IMAGE_DIMENSIONS',
        'Use a still image up to 16 megapixels and 8192 pixels per side.',
      );
    // Metadata is stripped by default. Never call keepMetadata/withMetadata.
    const output = await pipeline
      .rotate()
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .timeout({ seconds: 5 })
      .toBuffer();
    if (output.length > MAX_IMAGE_BYTES)
      throw imageError('IMAGE_TOO_LARGE', 'Normalized image is too large.', 413);
    return output;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw imageError(
      'MALFORMED_IMAGE',
      'The image could not be safely decoded. Choose a valid, smaller still image.',
    );
  }
}
