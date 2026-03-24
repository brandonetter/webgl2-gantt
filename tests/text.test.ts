import { TextLayoutEngine } from '@gantt/gantt-core';
import { makeTestAtlas } from './helpers';

describe('text layout', () => {
  it('measures and truncates text against a width budget', () => {
    const atlas = makeTestAtlas();
    const layout = new TextLayoutEngine(atlas);

    expect(layout.measure('abc', 10)).toBeCloseTo(15);
    expect(layout.fit('abcdef', 18, 10)).toMatch(/\.\.\.$/);
    expect(layout.fit('abcdef', 18, 10).length).toBeLessThan('abcdef'.length);
  });

  it('writes glyph instances for visible text', () => {
    const atlas = makeTestAtlas();
    const layout = new TextLayoutEngine(atlas);
    const sink = {
      count: 0,
      appendGlyph(): void {
        this.count += 1;
      },
    };

    layout.appendText(sink, 'task', 0, 12, 10, [1, 1, 1, 1], 200);
    expect(sink.count).toBe(4);
  });
});
