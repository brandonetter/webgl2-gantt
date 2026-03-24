export type FontAtlasMode = 'alpha' | 'msdf';

export type FontAtlasGlyph = {
  codepoint: number;
  advance: number;
  planeBounds: [number, number, number, number];
  atlasBounds: [number, number, number, number];
};

export type FontAtlas = {
  name: string;
  mode: FontAtlasMode;
  image: TexImageSource;
  width: number;
  height: number;
  lineHeight: number;
  ascender: number;
  descender: number;
  pxRange: number;
  glyphs: Map<number, FontAtlasGlyph>;
  kerning: Map<string, number>;
};

export type GlyphSink = {
  appendGlyph(
    x: number,
    y: number,
    w: number,
    h: number,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    r: number,
    g: number,
    b: number,
    a: number,
  ): void;
};

const PRINTABLE_ASCII = Array.from({ length: 95 }, (_, index) => String.fromCharCode(32 + index)).join('');

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load font atlas image: ${url}`));
    image.src = url;
  });
}

export type MsdfAtlasManifest = {
  name?: string;
  mode?: FontAtlasMode;
  atlas: {
    image: string;
    width: number;
    height: number;
    pxRange?: number;
  };
  metrics: {
    lineHeight: number;
    ascender: number;
    descender: number;
  };
  glyphs: Array<{
    codepoint: number;
    advance: number;
    planeBounds: [number, number, number, number];
    atlasBounds: [number, number, number, number];
  }>;
  kerning?: Array<[number, number, number]>;
};

export async function loadMsdfFontAtlas(manifestUrl: string): Promise<FontAtlas> {
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Failed to load font atlas manifest: ${manifestUrl}`);
  }

  const manifest = (await response.json()) as MsdfAtlasManifest;
  const imageUrl = new URL(manifest.atlas.image, manifestUrl).toString();
  const image = await loadImage(imageUrl);
  const glyphs = new Map<number, FontAtlasGlyph>();

  for (const glyph of manifest.glyphs) {
    glyphs.set(glyph.codepoint, glyph);
  }

  const kerning = new Map<string, number>();
  for (const entry of manifest.kerning ?? []) {
    kerning.set(`${entry[0]}:${entry[1]}`, entry[2]);
  }

  return {
    name: manifest.name ?? 'msdf-atlas',
    mode: manifest.mode ?? 'msdf',
    image,
    width: manifest.atlas.width,
    height: manifest.atlas.height,
    lineHeight: manifest.metrics.lineHeight,
    ascender: manifest.metrics.ascender,
    descender: manifest.metrics.descender,
    pxRange: manifest.atlas.pxRange ?? 4,
    glyphs,
    kerning,
  };
}

export function createFallbackFontAtlas(options: {
  name?: string;
  family?: string;
  weight?: string;
  sizePx?: number;
  chars?: string;
  columns?: number;
  cellSize?: number;
} = {}): FontAtlas {
  const name = options.name ?? 'fallback-system-ui';
  const family = options.family ?? 'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  const weight = options.weight ?? '600';
  const sizePx = options.sizePx ?? 28;
  const chars = options.chars ?? PRINTABLE_ASCII;
  const columns = options.columns ?? 16;
  const cellSize = options.cellSize ?? Math.ceil(sizePx * 1.8);
  const rows = Math.ceil(chars.length / columns);
  const width = columns * cellSize;
  const height = rows * cellSize;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('2D canvas is unavailable for fallback font atlas generation.');
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${weight} ${sizePx}px ${family}`;

  const glyphs = new Map<number, FontAtlasGlyph>();
  let ascender = 0;
  let descender = 0;

  for (let index = 0; index < chars.length; index += 1) {
    const ch = chars[index];
    const codepoint = ch.codePointAt(0) ?? 32;
    const col = index % columns;
    const row = Math.floor(index / columns);
    const cellX = col * cellSize;
    const cellY = row * cellSize;
    const metrics = ctx.measureText(ch);
    const ascent = metrics.actualBoundingBoxAscent || sizePx * 0.8;
    const descent = metrics.actualBoundingBoxDescent || sizePx * 0.2;
    const left = metrics.actualBoundingBoxLeft || 0;
    const right = metrics.actualBoundingBoxRight || metrics.width;
    const advance = Math.ceil(metrics.width + 1);
    const baselineX = cellX + Math.max(2, (cellSize - metrics.width) * 0.35);
    const baselineY = cellY + Math.round(cellSize * 0.72);

    ctx.fillText(ch, baselineX, baselineY);

    const drawnLeft = baselineX - left;
    const drawnTop = baselineY - ascent;
    const drawnRight = baselineX + right;
    const drawnBottom = baselineY + descent;

    const atlasBounds: [number, number, number, number] = [
      clamp(drawnLeft / width, 0, 1),
      clamp(drawnTop / height, 0, 1),
      clamp(drawnRight / width, 0, 1),
      clamp(drawnBottom / height, 0, 1),
    ];

    const planeBounds: [number, number, number, number] = [
      -left,
      -descent,
      right,
      ascent,
    ];

    glyphs.set(codepoint, {
      codepoint,
      advance,
      planeBounds,
      atlasBounds,
    });

    ascender = Math.max(ascender, ascent);
    descender = Math.max(descender, descent);
  }

  return {
    name,
    mode: 'alpha',
    image: canvas,
    width,
    height,
    lineHeight: Math.ceil(sizePx * 1.35),
    ascender: Math.ceil(ascender),
    descender: Math.ceil(descender),
    pxRange: 0,
    glyphs,
    kerning: new Map<string, number>(),
  };
}

export class TextLayoutEngine {
  private readonly widthCache = new Map<string, number>();

  constructor(private atlas: FontAtlas) {}

  setAtlas(atlas: FontAtlas): void {
    this.atlas = atlas;
    this.widthCache.clear();
  }

  getAtlas(): FontAtlas {
    return this.atlas;
  }

  private glyphForCodepoint(codepoint: number): FontAtlasGlyph | undefined {
    return this.atlas.glyphs.get(codepoint) ?? this.atlas.glyphs.get(63) ?? this.atlas.glyphs.get(32);
  }

  measure(text: string, fontPx: number, tracking = 0): number {
    const cacheKey = `${fontPx}:${tracking}:${text}`;
    const cached = this.widthCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const scale = fontPx / this.atlas.lineHeight;
    let width = 0;
    let previous = -1;

    for (const ch of text) {
      const codepoint = ch.codePointAt(0) ?? 32;
      const glyph = this.glyphForCodepoint(codepoint);
      if (!glyph) {
        continue;
      }

      if (previous >= 0) {
        width += this.atlas.kerning.get(`${previous}:${codepoint}`) ?? 0;
      }

      width += glyph.advance;
      width += tracking;
      previous = codepoint;
    }

    const measured = width * scale;
    this.widthCache.set(cacheKey, measured);
    return measured;
  }

  fit(text: string, maxWidth: number, fontPx: number, ellipsis = '...'): string {
    if (maxWidth <= 0) {
      return '';
    }

    const fullWidth = this.measure(text, fontPx);
    if (fullWidth <= maxWidth) {
      return text;
    }

    const ellipsisWidth = this.measure(ellipsis, fontPx);
    if (ellipsisWidth >= maxWidth) {
      return '';
    }

    let low = 0;
    let high = text.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      const candidate = `${text.slice(0, mid)}${ellipsis}`;
      if (this.measure(candidate, fontPx) <= maxWidth) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    return `${text.slice(0, low)}${ellipsis}`;
  }

  appendText(
    sink: GlyphSink,
    text: string,
    x: number,
    baselineY: number,
    fontPx: number,
    color: [number, number, number, number],
    maxWidth = Number.POSITIVE_INFINITY,
    tracking = 0,
  ): void {
    const fitted = Number.isFinite(maxWidth) ? this.fit(text, maxWidth, fontPx) : text;
    const scale = fontPx / this.atlas.lineHeight;
    const atlas = this.atlas;
    let penX = x;
    let previous = -1;

    for (const ch of fitted) {
      const codepoint = ch.codePointAt(0) ?? 32;
      const glyph = this.glyphForCodepoint(codepoint);
      if (!glyph) {
        continue;
      }

      if (previous >= 0) {
        penX += (atlas.kerning.get(`${previous}:${codepoint}`) ?? 0) * scale;
      }

      const [left, bottom, right, top] = glyph.planeBounds;
      const gx = penX + left * scale;
      const gy = baselineY - top * scale;
      const gw = (right - left) * scale;
      const gh = (top - bottom) * scale;
      const [u0, v0, u1, v1] = glyph.atlasBounds;

      sink.appendGlyph(gx, gy, gw, gh, u0, v0, u1, v1, color[0], color[1], color[2], color[3]);

      penX += (glyph.advance + tracking) * scale;
      previous = codepoint;
    }
  }
}
