/**
 * Image upload utility for iPad/mobile photo library integration.
 * Uses a hidden <input type="file" accept="image/*"> which triggers
 * the native photo picker on iOS. Resizes to a small square PNG and
 * returns a base64 data URL suitable for localStorage storage.
 */
export function pickAndResizeImage(maxSize: number = 64): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        cleanup();
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = maxSize;
          canvas.height = maxSize;
          const ctx = canvas.getContext('2d')!;

          // Crop to square from center, then scale down
          const srcSize = Math.min(img.width, img.height);
          const sx = (img.width - srcSize) / 2;
          const sy = (img.height - srcSize) / 2;
          ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, maxSize, maxSize);

          const dataUrl = canvas.toDataURL('image/png');
          cleanup();
          resolve(dataUrl);
        };
        img.onerror = () => {
          cleanup();
          resolve(null);
        };
        img.src = reader.result as string;
      };
      reader.onerror = () => {
        cleanup();
        resolve(null);
      };
      reader.readAsDataURL(file);
    });

    // If user cancels the picker
    input.addEventListener('cancel', () => {
      cleanup();
      resolve(null);
    });

    function cleanup() {
      input.remove();
    }

    input.click();
  });
}

/**
 * Register a base64 data URL as a Phaser texture.
 * Returns a promise that resolves when the texture is ready.
 */
export function registerBase64Texture(
  scene: Phaser.Scene,
  key: string,
  dataUrl: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // If texture already exists, remove it first
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }

    const img = new Image();
    img.onload = () => {
      scene.textures.addImage(key, img);
      resolve();
    };
    img.onerror = () => reject(new Error(`Failed to load texture: ${key}`));
    img.src = dataUrl;
  });
}

/**
 * Register all custom entity textures from data arrays.
 * Call this during boot to pre-load everything.
 */
export async function registerAllCustomTextures(
  scene: Phaser.Scene,
  entities: Array<{ id: string; imageData?: string; _prefix: string }>,
): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const entity of entities) {
    if (entity.imageData) {
      promises.push(
        registerBase64Texture(scene, `${entity._prefix}_${entity.id}`, entity.imageData),
      );
    }
  }
  await Promise.all(promises);
}
