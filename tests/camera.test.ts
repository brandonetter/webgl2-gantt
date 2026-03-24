import { createCamera, screenToWorld, worldToScreen, zoomCameraAt } from '@gantt/gantt-core';

describe('camera transforms', () => {
  it('round-trips world and screen coordinates', () => {
    const camera = {
      ...createCamera(1280, 720),
      scrollX: 40,
      scrollY: 80,
      zoomX: 1.5,
      zoomY: 1,
    };

    const point = worldToScreen(camera, 100, 240);
    const world = screenToWorld(camera, point[0], point[1]);

    expect(world[0]).toBeCloseTo(100);
    expect(world[1]).toBeCloseTo(240);
  });

  it('keeps the zoom anchor stable', () => {
    const camera = {
      ...createCamera(1200, 800),
      scrollX: 50,
      scrollY: -40,
      zoomX: 1,
      zoomY: 1,
    };

    const anchorWorld = screenToWorld(camera, 220, 140);
    const zoomed = zoomCameraAt(camera, 2, 220, 140);
    const after = worldToScreen(zoomed, anchorWorld[0], anchorWorld[1]);

    expect(zoomed.zoomX).toBeCloseTo(2);
    expect(zoomed.zoomY).toBeCloseTo(1);
    expect(after[0]).toBeCloseTo(220);
    expect(after[1]).toBeCloseTo(140);
    expect(worldToScreen(zoomed, 0, 0)[1]).toBeCloseTo(40);
  });

  it('normalizes legacy vertical zoom without moving the zoom anchor', () => {
    const detached = {
      ...createCamera(1200, 800),
      scrollX: 50,
      scrollY: 30,
      zoomX: 10,
      zoomY: 2.15,
    };

    const anchorWorld = screenToWorld(detached, 220, 140);
    const normalized = zoomCameraAt(detached, 0.5, 220, 140);
    const after = worldToScreen(normalized, anchorWorld[0], anchorWorld[1]);

    expect(normalized.zoomX).toBeCloseTo(5);
    expect(normalized.zoomY).toBeCloseTo(1);
    expect(after[0]).toBeCloseTo(220);
    expect(after[1]).toBeCloseTo(140);
  });
});
