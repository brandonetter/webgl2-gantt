import {
  DAY_MS,
  type DependencyPath,
  type GanttTask,
} from './core';
import type { FrameScene } from './core';
import type { GanttModule, GanttModuleContext } from './types';

const DETAIL_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatDaySerial(daySerial: number): string {
  return DETAIL_DATE_FORMATTER.format(new Date(Math.floor(daySerial) * DAY_MS));
}

function formatDurationDays(start: number, end: number): string {
  return `${(end - start).toFixed(0)}d`;
}

function getHudField(root: HTMLElement, field: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(`[data-field="${field}"]`);
  if (!element) {
    throw new Error(`Missing HUD field: ${field}`);
  }
  return element;
}

function formatTaskDetails(task: GanttTask | null): string {
  if (!task) {
    return 'No task selected';
  }

  const deps = task.dependencies?.length ?? 0;
  return [
    task.label,
    '',
    `id: ${task.id}`,
    `row: ${task.rowIndex}`,
    `start: ${formatDaySerial(task.start)}`,
    `end: ${formatDaySerial(task.end)}`,
    `duration: ${formatDurationDays(task.start, task.end)}`,
    `milestone: ${task.milestone ? 'yes' : 'no'}`,
    `dependencies: ${deps}`,
  ].join('\n');
}

function formatDependencyDetails(path: DependencyPath | null): string {
  if (!path) {
    return 'No dependency selected';
  }

  return [
    `dependency: ${path.id}`,
    '',
    `source: ${path.sourceTaskId}`,
    `target: ${path.targetTaskId}`,
    `segments: ${path.segments.length}`,
  ].join('\n');
}

function updateInspector(context: GanttModuleContext): void {
  const { host } = context;
  const inspector = host.inspector;
  if (!inspector) {
    return;
  }

  const selection = host.getSelection();
  const field = getHudField(inspector, 'selection');
  const text = selection.selectedTask
    ? formatTaskDetails(selection.selectedTask)
    : selection.selectedDependency
      ? formatDependencyDetails(selection.selectedDependency)
      : selection.hoveredTask
        ? `Hover Task\n\n${formatTaskDetails(selection.hoveredTask)}`
        : selection.hoveredDependency
          ? `Hover Dependency\n\n${formatDependencyDetails(selection.hoveredDependency)}`
          : 'No task or dependency selected';

  field.textContent = text;
  field.classList.toggle(
    'inspector-empty',
    !selection.selectedTask && !selection.hoveredTask && !selection.selectedDependency && !selection.hoveredDependency,
  );
}

function updateHud(context: GanttModuleContext, frame: FrameScene): void {
  const { host } = context;
  const hud = host.hud;
  if (!hud) {
    return;
  }

  const visibleWindow = host.getVisibleWindow();
  getHudField(hud, 'rows').textContent = `${frame.stats.visibleRows}`;
  getHudField(hud, 'tasks').textContent = `${frame.stats.visibleTasks}`;
  getHudField(hud, 'glyphs').textContent = `${frame.stats.glyphCount}`;
  getHudField(hud, 'lines').textContent = `${frame.stats.gridLineCount + frame.stats.visibleDependencies}`;
  getHudField(hud, 'frame').textContent = `${host.getLastFrameMs().toFixed(2)}ms`;
  getHudField(hud, 'camera').textContent =
    `${formatDaySerial(visibleWindow.start)} - ${formatDaySerial(visibleWindow.end)} | zoom ${host.getCamera().zoomX.toFixed(2)}x`;
}

function updateZoomToolbar(context: GanttModuleContext): void {
  const toolbar = context.host.toolbar;
  if (!toolbar) {
    return;
  }
  const activePresetId = context.host.getZoomPresetIdForVisibleWindow();
  const buttons = toolbar.querySelectorAll<HTMLButtonElement>('[data-zoom-preset]');
  for (const button of buttons) {
    button.dataset.active = button.dataset.zoomPreset === activePresetId ? 'true' : 'false';
  }
}

export function createCameraControlsModule(): GanttModule {
  return {
    id: 'camera-controls',
    onInit: ({ host }) => {
      const canvas = host.canvas;

      canvas.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) {
          return;
        }
        host.stopCameraAnimation();
        canvas.setPointerCapture(event.pointerId);
        canvas.dataset.dragging = 'true';
        let lastX = event.clientX;
        let lastY = event.clientY;

        const move = (moveEvent: PointerEvent) => {
          const dx = moveEvent.clientX - lastX;
          const dy = moveEvent.clientY - lastY;
          lastX = moveEvent.clientX;
          lastY = moveEvent.clientY;
          host.panByScreenDelta(dx, dy);
        };

        const up = (upEvent: PointerEvent) => {
          if (upEvent.pointerId === event.pointerId) {
            canvas.removeEventListener('pointermove', move);
            canvas.removeEventListener('pointerup', up);
            canvas.removeEventListener('pointercancel', up);
            canvas.dataset.dragging = 'false';
          }
        };

        canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', up);
      });

      canvas.addEventListener(
        'wheel',
        (event) => {
          event.preventDefault();
          host.stopCameraAnimation();
          const rect = canvas.getBoundingClientRect();
          const anchorX = event.clientX - rect.left;
          const anchorY = event.clientY - rect.top;

          if (event.ctrlKey || event.metaKey || event.altKey) {
            const zoomFactor = Math.exp(-event.deltaY * 0.0015);
            host.zoomAt(zoomFactor, anchorX, anchorY);
          } else {
            host.panByScreenDelta(-event.deltaX, -event.deltaY);
          }
        },
        { passive: false },
      );

      const onKeyDown = (event: KeyboardEvent) => {
        host.stopCameraAnimation();

        if (event.key === '0') {
          host.resetCamera();
        }

        if (event.key === '=' || event.key === '+') {
          const camera = host.getCamera();
          host.zoomAt(1.12, camera.viewportWidth * 0.5, camera.viewportHeight * 0.5);
        }

        if (event.key === '-' || event.key === '_') {
          const camera = host.getCamera();
          host.zoomAt(1 / 1.12, camera.viewportWidth * 0.5, camera.viewportHeight * 0.5);
        }
      };

      window.addEventListener('keydown', onKeyDown);
      host.registerCleanup(() => {
        window.removeEventListener('keydown', onKeyDown);
      });

      const onResize = () => {
        host.syncCanvasSize();
      };

      window.addEventListener('resize', onResize);
      host.registerCleanup(() => {
        window.removeEventListener('resize', onResize);
      });
    },
  };
}

export function createSelectionModule(): GanttModule {
  return {
    id: 'selection',
    onInit: ({ host }) => {
      const canvas = host.canvas;

      canvas.addEventListener('pointermove', (event) => {
        if (canvas.dataset.dragging === 'true') {
          return;
        }

        const rect = canvas.getBoundingClientRect();
        host.updateHoverFromScreen(event.clientX - rect.left, event.clientY - rect.top);
      });

      canvas.addEventListener('click', (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        host.setSelectionByScreenPoint(x, y);
      });

      canvas.addEventListener('dblclick', (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const task = host.pickTaskAtScreen(x, y);
        if (!task) {
          return;
        }

        host.setSelectionByTaskId(task.id);
        host.animateCameraToTask(task);
      });

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          host.setSelectionByTaskId(null);
        }
      };

      window.addEventListener('keydown', onKeyDown);
      host.registerCleanup(() => {
        window.removeEventListener('keydown', onKeyDown);
      });
    },
  };
}

export function createHudInspectorModule(): GanttModule {
  return {
    id: 'hud-inspector',
    onAfterFrame(context, frame) {
      updateHud(context, frame);
      updateInspector(context);
    },
  };
}

export function createToolbarModule(): GanttModule {
  return {
    id: 'toolbar',
    onInit: ({ host }) => {
      if (!host.toolbar) {
        return;
      }

      host.toolbar.addEventListener('click', (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-zoom-preset]');
        if (!button) {
          return;
        }

        const presetId = button.dataset.zoomPreset;
        if (!presetId) {
          return;
        }

        host.animateToZoomPresetId(presetId);
      });
    },

    onAfterFrame(context) {
      updateZoomToolbar(context);
    },
  };
}

export function createBuiltinModule(id: 'camera-controls' | 'selection' | 'hud-inspector' | 'toolbar'): GanttModule {
  switch (id) {
    case 'camera-controls':
      return createCameraControlsModule();
    case 'selection':
      return createSelectionModule();
    case 'hud-inspector':
      return createHudInspectorModule();
    case 'toolbar':
      return createToolbarModule();
    default:
      return createHudInspectorModule();
  }
}
