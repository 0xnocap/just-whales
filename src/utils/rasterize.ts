export const imageCache = new Map<string, string>();

export const rasterizeImage = (dataUri: string, tokenId: number): Promise<string> => {
  const cacheKey = String(tokenId);
  if (imageCache.has(cacheKey)) return Promise.resolve(imageCache.get(cacheKey)!);
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 400; // thumbnail size
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // pixelated rendering for pixel art
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, 0, 0, size, size);
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              imageCache.set(cacheKey, url);
              resolve(url);
            } else {
              imageCache.set(cacheKey, dataUri);
              resolve(dataUri);
            }
          }, 'image/png');
        } else {
          imageCache.set(cacheKey, dataUri);
          resolve(dataUri);
        }
      } catch {
        imageCache.set(cacheKey, dataUri);
        resolve(dataUri);
      }
    };
    img.onerror = () => {
      imageCache.set(cacheKey, dataUri);
      resolve(dataUri);
    };
    img.src = dataUri;
  });
};
