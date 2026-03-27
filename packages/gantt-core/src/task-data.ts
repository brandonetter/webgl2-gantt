import type { GanttDependencyRef, GanttScene, GanttTask } from './core';

const TASK_RESERVED_FIELDS = new Set([
  'id',
  'rowIndex',
  'start',
  'end',
  'label',
  'milestone',
  'dependencies',
  'fill',
]);

type TaskRecord = Record<string, unknown>;

function cloneFallback<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneFallback(entry)) as T;
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  if (value && typeof value === 'object') {
    const clone: TaskRecord = {};
    for (const [key, entry] of Object.entries(value as TaskRecord)) {
      clone[key] = cloneFallback(entry);
    }
    return clone as T;
  }

  return value;
}

export function cloneStructuredValue<T>(value: T): T {
  if (value == null || typeof value !== 'object') {
    return value;
  }

  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return cloneFallback(value);
}

export function cloneTask(task: GanttTask): GanttTask {
  return cloneStructuredValue(task);
}

export function cloneScene(scene: GanttScene): GanttScene {
  return {
    tasks: scene.tasks.map((task) => cloneTask(task)),
    rowLabels: scene.rowLabels.slice(),
    timelineStart: scene.timelineStart,
    timelineEnd: scene.timelineEnd,
  };
}

export function extractTaskExtras(task: TaskRecord): TaskRecord {
  const extras: TaskRecord = {};

  for (const [key, value] of Object.entries(task)) {
    if (TASK_RESERVED_FIELDS.has(key)) {
      continue;
    }
    extras[key] = cloneStructuredValue(value);
  }

  return extras;
}

export function mergeTaskExtras(baseTask: GanttTask, patch: TaskRecord): TaskRecord {
  const merged = extractTaskExtras(baseTask as TaskRecord);

  for (const [key, value] of Object.entries(patch)) {
    if (TASK_RESERVED_FIELDS.has(key)) {
      continue;
    }
    merged[key] = cloneStructuredValue(value);
  }

  return merged;
}

export function withTaskExtras(
  reserved: {
    id: string;
    rowIndex: number;
    start: number;
    end: number;
    label: string;
    milestone?: boolean;
    dependencies?: GanttDependencyRef[];
    fill?: GanttTask['fill'];
  },
  extras: TaskRecord,
): GanttTask {
  return {
    ...cloneStructuredValue(extras),
    id: reserved.id,
    rowIndex: reserved.rowIndex,
    start: reserved.start,
    end: reserved.end,
    label: reserved.label,
    milestone: reserved.milestone,
    dependencies: reserved.dependencies ? cloneStructuredValue(reserved.dependencies) : undefined,
    fill: reserved.fill == null ? undefined : cloneStructuredValue(reserved.fill),
  };
}
