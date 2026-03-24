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
      scrollY: 30,
      zoomX: 1,
      zoomY: 1,
    };

    const anchorWorld = screenToWorld(camera, 220, 140);
    const zoomed = zoomCameraAt(camera, 2, 220, 140);
    const after = worldToScreen(zoomed, anchorWorld[0], anchorWorld[1]);

    expect(zoomed.zoomX).toBeCloseTo(2);
    expect(zoomed.zoomY).toBeCloseTo(2);
    expect(after[0]).toBeCloseTo(220);
    expect(after[1]).toBeCloseTo(140);
  });

  it('re-attaches vertical zoom correctly when zooming back out', () => {
    const detached = {
      ...createCamera(1200, 800),
      scrollX: 50,
      scrollY: 30,
      zoomX: 10,
      zoomY: 2.15,
    };

    const firstStep = zoomCameraAt(detached, 0.5, 220, 140);
    const secondStep = zoomCameraAt(firstStep, 0.5, 220, 140);

    expect(firstStep.zoomX).toBeCloseTo(5);
    expect(firstStep.zoomY).toBeCloseTo(2.15);
    expect(secondStep.zoomX).toBeCloseTo(2.5);
    expect(secondStep.zoomY).toBeCloseTo(2.15);
  });
});
