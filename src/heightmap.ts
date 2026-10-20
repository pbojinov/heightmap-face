export interface HeightMapData {
  heights: Float32Array;
  mask: Uint8Array;
  width: number;
  height: number;
}

export function heightMapFromRgba(rgba: Uint8ClampedArray, width: number, height: number): HeightMapData {
  if (width < 2 || height < 2 || rgba.length !== width * height * 4) {
    throw new Error('Invalid portrait dimensions');
  }
  const heights = new Float32Array(width * height);
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < heights.length; i++) {
    if (rgba[i * 4 + 3] > 127) {
      mask[i] = 1;
      heights[i] = (rgba[i * 4] + rgba[i * 4 + 1] + rgba[i * 4 + 2]) / 765;
    }
  }
  return { heights, mask, width, height };
}

export function createMeshIndices(mask: Uint8Array, width: number, height: number): number[] {
  if (mask.length !== width * height) throw new Error('Invalid portrait mask');
  const indices: number[] = [];
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const a = y * width + x;
      const b = a + 1;
      const c = a + width;
      const d = c + 1;
      if (mask[a] && mask[c] && mask[b]) indices.push(a, c, b);
      if (mask[c] && mask[d] && mask[b]) indices.push(c, d, b);
    }
  }
  return indices;
}
