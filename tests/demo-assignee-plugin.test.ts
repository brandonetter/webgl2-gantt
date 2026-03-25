import { describe, expect, it, vi } from 'vitest';
import type {
  GanttCanvasHitRegion,
  GanttCanvasLayer,
  GanttCanvasLayerContext,
  GanttCanvasPointerEvent,
  GanttSafeApi,
  GanttScene,
  GanttSceneTransform,
} from '@gantt/gantt-core';

import assigneePlugin from '../apps/demo/public/plugins/assignee-group-collapse-plugin.mjs';

function makeScene(): GanttScene {
  return {
    rowLabels: ['Planning', 'Design', 'QA'],
    timelineStart: 10,
    timelineEnd: 20,
    tasks: [
      { id: 'a', rowIndex: 0, start: 10, end: 12, label: 'Brief', assignedTo: 'Ada', estimate: { days: 2 } },
      { id: 'b', rowIndex: 1, start: 12, end: 16, label: 'Design', assignedTo: 'Grace', dependencies: ['a'] },
      { id: 'c', rowIndex: 2, start: 16, end: 18, label: 'QA', assignedTo: 'Ada', dependencies: ['b'] },
    ],
  };
}

type PluginHarness = {
  scene: GanttScene;
  sceneTransform: GanttSceneTransform | null;
  canvasLayer: GanttCanvasLayer | null;
  requestRender: ReturnType<typeof vi.fn>;
};

function createPluginHarness(): PluginHarness {
  const scene = makeScene();
  let sceneTransform: GanttSceneTransform | null = null;
  let canvasLayer: GanttCanvasLayer | null = null;
  const requestRender = vi.fn();
  const safe: Pick<
    GanttSafeApi,
    'getSceneSnapshot' | 'registerSceneTransform' | 'registerCanvasLayer' | 'requestRender'
  > = {
    getSceneSnapshot: () => scene,
    registerSceneTransform: (transform) => {
      sceneTransform = transform;
      return () => undefined;
    },
    registerCanvasLayer: (layer) => {
      canvasLayer = layer;
      return () => undefined;
    },
    requestRender,
  };

  const plugin = assigneePlugin.create({
    safe,
    pluginConfig: {
      source: {
        type: 'esm',
        url: 'https://example.com/assignee-plugin.mjs',
      },
      options: {
        paneWidth: 180,
      },
    },
  });

  plugin.onInit?.();

  return {
    scene,
    sceneTransform,
    canvasLayer,
    requestRender,
  };
}

describe('assignee group collapse demo plugin', () => {
  it('projects a grouped scene without mutating the committed tasks', () => {
    const harness = createPluginHarness();
    const transformed = harness.sceneTransform?.(harness.scene);

    expect(transformed).toBeTruthy();
    if (!transformed) {
      throw new Error('Expected the plugin to register a scene transform.');
    }

    expect(harness.scene.tasks.map((task) => task.rowIndex)).toEqual([0, 1, 2]);
    expect(transformed.tasks.map((task) => task.id)).toEqual(['a', 'c', 'b']);
    expect(transformed.tasks[0]).toMatchObject({
      assignedTo: 'Ada',
      estimate: { days: 2 },
    });
    expect(transformed.tasks[1]).toMatchObject({
      assignedTo: 'Ada',
    });
    expect(transformed.rowLabels).toEqual(['Ada', '', 'Grace']);
  });

  it('toggles collapse through a canvas hit region and preserves committed row indices', () => {
    const harness = createPluginHarness();
    harness.sceneTransform?.(harness.scene);

    const hitRegions: GanttCanvasHitRegion[] = [];
    if (!harness.canvasLayer) {
      throw new Error('Expected the plugin to register a canvas layer.');
    }

    const layerContext = {
      scene: harness.scene,
      frame: { stats: {} },
      camera: {
        scrollX: 0,
        scrollY: -36,
        zoomX: 1,
        zoomY: 1,
        viewportWidth: 900,
        viewportHeight: 280,
      },
      render: {
        rowPitch: 28,
        barHeight: 14,
        milestoneSize: 10,
        headerHeight: 36,
        rowPadding: 6,
        labelPadding: 6,
        gridPadding: 0,
        overscanRows: 3,
        overscanPx: 180,
        renderSelectedDependencies: true,
      },
      visibleWindow: {
        start: 8,
        end: 26,
      },
      selection: {
        selectedTask: null,
        selectedTasks: [],
        hoveredTask: null,
        selectedDependency: null,
        hoveredDependency: null,
      },
      interaction: {
        mode: 'view',
        activeEdit: null,
      },
      draw: {
        rect: () => undefined,
        line: () => undefined,
        text: () => undefined,
        hitRegion: (region: GanttCanvasHitRegion) => {
          hitRegions.push(region);
        },
      },
    } as unknown as GanttCanvasLayerContext;
    harness.canvasLayer(layerContext);

    const adaRegion = hitRegions.find((region) => region.id === 'group:Ada');
    expect(adaRegion).toBeTruthy();
    if (!adaRegion) {
      throw new Error('Expected the plugin to register the Ada group hit region.');
    }

    const capture = vi.fn();
    const requestRender = vi.fn();
    const pointerEvent: GanttCanvasPointerEvent = {
      type: 'click',
      pointerId: 1,
      screenX: 0,
      screenY: 0,
      worldX: 0,
      worldY: 0,
      button: 0,
      buttons: 1,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      capture,
      requestRender,
    };
    adaRegion.onClick?.(pointerEvent);

    const collapsed = harness.sceneTransform?.(harness.scene);
    if (!collapsed) {
      throw new Error('Expected the plugin to keep a scene transform registered.');
    }

    const adaRows = collapsed.tasks.filter((task) => task.assignedTo === 'Ada').map((task) => task.rowIndex);

    expect(capture).toHaveBeenCalledTimes(1);
    expect(harness.requestRender).toHaveBeenCalledTimes(1);
    expect(adaRows).toEqual([0, 0]);
    expect(harness.scene.tasks.map((task) => task.rowIndex)).toEqual([0, 1, 2]);
  });
});
