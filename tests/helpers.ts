import type { FontAtlas, FontAtlasGlyph } from '@gantt/gantt-core';

export function makeTestAtlas(): FontAtlas {
  const glyphs = new Map<number, FontAtlasGlyph>();
  for (let codepoint = 32; codepoint <= 126; codepoint += 1) {
    glyphs.set(codepoint, {
      codepoint,
      advance: 10,
      planeBounds: [0, -2, 8, 8],
      atlasBounds: [0, 0, 1, 1],
    });
  }

  return {
    name: 'test-atlas',
    mode: 'alpha',
    image: {} as TexImageSource,
    width: 1,
    height: 1,
    lineHeight: 20,
    ascender: 16,
    descender: 4,
    pxRange: 0,
    glyphs,
    kerning: new Map(),
  };
}
