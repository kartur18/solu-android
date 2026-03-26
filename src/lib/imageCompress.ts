/**
 * Image compression utilities.
 * Uses expo-image-picker's built-in quality setting since
 * expo-image-manipulator has compatibility issues with SDK 55 EAS builds.
 * The actual compression happens at pick time via quality parameter.
 * These functions serve as passthrough + future upgrade path.
 */

/**
 * Compress an image for general uploads.
 * In the current implementation, compression is handled by expo-image-picker
 * at pick time (quality: 0.7). This function is a passthrough that can be
 * upgraded later when expo-image-manipulator is fixed for SDK 55.
 */
export async function compressImage(uri: string): Promise<string> {
  // Compression handled at pick time by expo-image-picker quality setting
  return uri
}

/**
 * Compress specifically for DNI photos.
 * Same as above - compression handled at pick time.
 */
export async function compressDNIPhoto(uri: string): Promise<string> {
  return uri
}
