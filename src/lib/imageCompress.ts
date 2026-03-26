import * as ImageManipulator from 'expo-image-manipulator'

/**
 * Compress and resize an image before uploading.
 * Max dimensions: 1200x1200, quality: 0.7, format: JPEG.
 */
export async function compressImage(uri: string, maxSize = 1200): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxSize } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    )
    return result.uri
  } catch {
    // If compression fails, return original
    return uri
  }
}

/**
 * Compress specifically for DNI photos (smaller, higher quality for readability).
 */
export async function compressDNIPhoto(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1000 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    )
    return result.uri
  } catch {
    return uri
  }
}
