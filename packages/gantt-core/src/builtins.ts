import {
  DAY_MS,
  type DependencyPath,
  type GanttTask,
} from './core';
import type { FrameScene } from './core';
import {
  buildTaskEditPointer,
  createTaskEditEvent,
  resolveTaskEditDraft,
  resolveTaskEditHitTarget,
} from './edit';
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

  const interactionMode = context.host.getInteractionState().mode;
  const modeButtons = toolbar.querySelectorAll<HTMLButtonElement>('[data-interaction-mode]');
  for (const button of modeButtons) {
    button.dataset.active = button.dataset.interactionMode === interactionMode ? 'true' : 'false';
  }
}

const POINTER_DRAG_THRESHOLD_PX = 4;

export function createCameraControlsModule(): GanttModule {
  return {
    id: 'camera-controls',
    onInit: ({ host }) => {
      const canvas = host.canvas;

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
      type PointerSession = {
        pointerId: number;
        originX: number;
        originY: number;
        lastX: number;
        lastY: number;
        dragStarted: boolean;
        mode: 'pan' | 'pan-or-select' | 'edit-or-select';
        task: GanttTask | null;
        operation: 'move' | 'resize-start' | 'resize-end' | null;
        startPointer: ReturnType<typeof buildTaskEditPointer>;
        lastPreviewEvent: ReturnType<typeof createTaskEditEvent> | null;
      };

      let pointerSession: PointerSession | null = null;
      let spacePressed = false;

      const localPoint = (event: PointerEvent | MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        return {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
      };

      const resetPointerSession = () => {
        pointerSession = null;
        canvas.dataset.dragging = 'false';
      };

      canvas.dataset.dragging = 'false';

      canvas.addEventListener('pointermove', (event) => {
        if (!pointerSession) {
          const point = localPoint(event);
          host.updateHoverFromScreen(point.x, point.y);
          return;
        }

        if (event.pointerId !== pointerSession.pointerId) {
          return;
        }

        const point = localPoint(event);
        const dx = point.x - pointerSession.lastX;
        const dy = point.y - pointerSession.lastY;
        pointerSession.lastX = point.x;
        pointerSession.lastY = point.y;

        if (!pointerSession.dragStarted) {
          const distance = Math.hypot(point.x - pointerSession.originX, point.y - pointerSession.originY);
          if (distance < POINTER_DRAG_THRESHOLD_PX) {
            return;
          }
          pointerSession.dragStarted = true;
          canvas.dataset.dragging = 'true';
        }

        if (pointerSession.mode === 'pan' || pointerSession.mode === 'pan-or-select') {
          host.panByScreenDelta(dx, dy);
          return;
        }

        if (!pointerSession.task || host.isTaskEditPending()) {
          return;
        }

        const pointer = buildTaskEditPointer(host.getCamera(), point.x, point.y);
        const draft = resolveTaskEditDraft({
          task: pointerSession.task,
          operation: pointerSession.operation ?? 'move',
          pointer,
          startPointer: pointerSession.startPointer,
          rowPitch: host.getRenderOptions().rowPitch,
          rowCount: host.getScene().rowLabels.length,
          editConfig: host.getEditConfig(),
          disableSnap: event.shiftKey,
        });
        const previewEvent = createTaskEditEvent({
          operation: pointerSession.operation ?? 'move',
          originalTask: pointerSession.task,
          proposedTask: draft.draftTask,
          previousDraftTask: host.getInteractionState().activeEdit?.draftTask ?? pointerSession.lastPreviewEvent?.proposedTask ?? null,
          pointer,
          snap: draft.snap,
        });
        const nextPreview = host.previewTaskEdit(previewEvent);
        if (nextPreview) {
          pointerSession.lastPreviewEvent = nextPreview;
        }
      });

      canvas.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) {
          return;
        }

        host.stopCameraAnimation();
        const point = localPoint(event);
        const pointer = buildTaskEditPointer(host.getCamera(), point.x, point.y);
        const interactionState = host.getInteractionState();
        const inEditMode = host.getEditConfig().enabled && interactionState.mode === 'edit';
        const pendingCommit = host.isTaskEditPending();
        const pickedTask = host.pickTaskAtScreen(point.x, point.y);
        const hitTarget = inEditMode && !pendingCommit
          ? resolveTaskEditHitTarget({
              task: pickedTask,
              selectedTaskId: host.getSelection().selectedTask?.id ?? null,
              camera: host.getCamera(),
              rowPitch: host.getRenderOptions().rowPitch,
              barHeight: host.getRenderOptions().barHeight,
              handleWidthPx: host.getEditConfig().resize.handleWidthPx,
              resizeEnabled: host.getEditConfig().resize.enabled,
              screenX: point.x,
              screenY: point.y,
            })
          : null;

        if (pickedTask) {
          host.setSelectionByTaskId(pickedTask.id);
        }

        pointerSession = {
          pointerId: event.pointerId,
          originX: point.x,
          originY: point.y,
          lastX: point.x,
          lastY: point.y,
          dragStarted: false,
          mode: spacePressed
            ? 'pan'
            : hitTarget
              ? 'edit-or-select'
              : pickedTask
                ? 'pan-or-select'
                : 'pan',
          task: hitTarget?.task ?? pickedTask ?? null,
          operation: hitTarget?.operation ?? null,
          startPointer: pointer,
          lastPreviewEvent: null,
        };

        canvas.setPointerCapture(event.pointerId);
      });

      const finishPointerSession = async (
        event: PointerEvent,
        cancelled: boolean,
      ) => {
        if (!pointerSession || event.pointerId !== pointerSession.pointerId) {
          return;
        }

        const session = pointerSession;
        const point = localPoint(event);

        try {
          if (cancelled) {
            host.cancelActiveEdit();
            return;
          }

          if (!session.dragStarted) {
            if (session.task) {
              host.setSelectionByTaskId(session.task.id);
            } else {
              host.setSelectionByScreenPoint(point.x, point.y);
            }
            return;
          }

          if (session.mode === 'edit-or-select' && session.lastPreviewEvent) {
            await host.commitActiveEdit(session.lastPreviewEvent);
          }
        } finally {
          if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
          }
          resetPointerSession();
          host.updateHoverFromScreen(point.x, point.y);
        }
      };

      canvas.addEventListener('pointerup', (event) => {
        void finishPointerSession(event, false);
      });

      canvas.addEventListener('pointercancel', (event) => {
        void finishPointerSession(event, true);
      });

      canvas.addEventListener('dblclick', (event) => {
        if (host.getInteractionState().mode !== 'view') {
          return;
        }

        const point = localPoint(event);
        const task = host.pickTaskAtScreen(point.x, point.y);
        if (!task) {
          return;
        }

        host.setSelectionByTaskId(task.id);
        host.animateCameraToTask(task);
      });

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          if (host.getInteractionState().activeEdit?.status === 'preview') {
            host.cancelActiveEdit();
          } else {
            host.setSelectionByTaskId(null);
          }
          return;
        }

        if (event.key === ' ' || event.code === 'Space') {
          spacePressed = true;
          event.preventDefault();
          return;
        }

        if ((event.key === 'e' || event.key === 'E') && !event.altKey && !event.ctrlKey && !event.metaKey) {
          host.setInteractionMode(host.getInteractionState().mode === 'edit' ? 'view' : 'edit');
        }
      };

      const onKeyUp = (event: KeyboardEvent) => {
        if (event.key === ' ' || event.code === 'Space') {
          spacePressed = false;
          event.preventDefault();
        }
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      host.registerCleanup(() => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
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
        const target = event.target as HTMLElement;
        const modeButton = target.closest<HTMLButtonElement>('[data-interaction-mode]');
        if (modeButton) {
          const mode = modeButton.dataset.interactionMode;
          if (mode === 'view' || mode === 'edit') {
            host.setInteractionMode(mode);
          }
          return;
        }

        const zoomButton = target.closest<HTMLButtonElement>('[data-zoom-preset]');
        if (!zoomButton) {
          return;
        }

        const presetId = zoomButton.dataset.zoomPreset;
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
