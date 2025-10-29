import { MediaItem } from '../types';

// The list of PNG filenames provided by the user
const imageFilenames = [
  '0004', '0005', '0006', '0015', '0016', '0017', '0022', '0023', '0024', '0026',
  '0027', '0028', '0029', '0030', '0031', '0034', '0037', '0038', '0039', '0041'
];

/**
 * Fetches an image from a URL and converts it to a base64 string.
 * @param url The URL of the image to fetch.
 * @returns A promise that resolves with the base64 string and its MIME type.
 */
async function urlToBase64(url: string): Promise<{ base64: string, mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: blob.type });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Loads the preloaded PNG images from the /data/image/ directory,
 * converts them to base64, and returns them as an array of MediaItem objects.
 */
export async function loadAndProcessPreloadedImages(): Promise<MediaItem[]> {
  const imagePromises = imageFilenames.map(async (filename, index) => {
    const path = `/data/image/${filename}.png`;
    try {
      const { base64, mimeType } = await urlToBase64(path);
      return {
        id: `preloaded-${index + 1}`,
        type: 'image',
        file: null,
        previewUrl: path, // Use the direct path for the preview image source
        base64: base64,
        mimeType: mimeType,
        isPreloaded: true,
      } as MediaItem;
    } catch (error) {
      console.error(`Failed to load or process preloaded image: ${path}`, error);
      // Return null to handle individual image failures gracefully
      return null;
    }
  });

  const results = await Promise.all(imagePromises);
  // Filter out any images that failed to load
  return results.filter((item): item is MediaItem => item !== null);
}
