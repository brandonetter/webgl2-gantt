import { buildTaskIndex, computeVisibleRowRange, computeVisibleTimeWindow, createCamera } from '@gantt/gantt-core';

describe('visibility helpers', () => {
  it('computes a visible row range with overscan', () => {
    const camera = {
      ...createCamera(800, 240),
      scrollY: 45,
    };

    const range = computeVisibleRowRange(camera, 30, 20, 1);

    expect(range.start).toBe(0);
    expect(range.end).toBe(11);
  });

  it('expands the visible time window by the requested overscan', () => {
    const camera = {
      ...createCamera(900, 600),
      scrollX: 100,
      zoomX: 2,
    };

    const window = computeVisibleTimeWindow(camera, 200);

    expect(window.start).toBe(0);
    expect(window.end).toBe(650);
  });

  it('indexes tasks by row and duration', () => {
    const index = buildTaskIndex([
      { id: 'a', rowIndex: 1, start: 20, end: 45, label: 'a' },
      { id: 'b', rowIndex: 0, start: 10, end: 25, label: 'b' },
      { id: 'c', rowIndex: 1, start: 5, end: 15, label: 'c' },
    ]);

    expect(index.rowCount).toBe(2);
    expect(index.rows[1].map((task) => task.id)).toEqual(['c', 'a']);
    expect(index.rowMaxDuration[1]).toBe(25);
    expect(index.byId.get('b')?.start).toBe(10);
  });
});
