import {
  DAY_MS,
  cloneDependencyRefs,
  getDependencyTaskId,
  normalizeColorInput,
  type GanttDependencyObject,
  type GanttDependencyRef,
  type GanttDependencyType,
  type GanttColor,
  type GanttScene,
  type GanttTask,
} from './core';
import { cloneScene, cloneTask, extractTaskExtras, mergeTaskExtras, withTaskExtras } from './task-data';
import type {
  GanttExportedTask,
  GanttRuntimeDateInput,
  GanttRuntimeImportOptions,
  GanttRuntimeTaskInput,
  GanttRuntimeTaskPatch,
} from './types';

type ResolvedRuntimeImportOptions = {
  numericDateMode: 'day-serial' | 'timestamp-ms';
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function resolveImportOptions(options: GanttRuntimeImportOptions | undefined): ResolvedRuntimeImportOptions {
  return {
    numericDateMode: options?.numericDateMode ?? 'day-serial',
  };
}

function compareTasks(left: GanttTask, right: GanttTask): number {
  return (
    left.rowIndex - right.rowIndex ||
    left.start - right.start ||
    left.end - right.end ||
    left.id.localeCompare(right.id)
  );
}

function assertObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function normalizeTaskId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function normalizeLabel(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string.`);
  }

  return value;
}

function normalizeRowIndex(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }

  return value as number;
}

function normalizeMilestone(value: unknown, label: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean when provided.`);
  }

  return value;
}

function normalizeDependencyType(value: unknown, label: string): GanttDependencyType | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === 'FS' || value === 'FF' || value === 'SF' || value === 'SS') {
    return value;
  }

  throw new Error(`${label} must be one of FS, FF, SF, or SS when provided.`);
}

function normalizeDependencyRef(value: unknown, label: string): GanttDependencyRef {
  if (typeof value === 'string') {
    return normalizeTaskId(value, label);
  }

  const candidate = assertObject(value, label);
  return {
    taskId: normalizeTaskId(candidate.taskId, `${label}.taskId`),
    type: normalizeDependencyType(candidate.type, `${label}.type`),
  } satisfies GanttDependencyObject;
}

function normalizeDependencies(value: unknown, label: string): GanttDependencyRef[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array of task ids or dependency refs when provided.`);
  }

  const dependencies = value.map((dependency, index) => normalizeDependencyRef(dependency, `${label}[${index}]`));
  return dependencies.length > 0 ? dependencies : undefined;
}

function normalizeTaskFill(value: unknown, label: string): GanttColor | undefined {
  if (value == null) {
    return undefined;
  }

  return normalizeColorInput(value as GanttTask['fill'], [0, 0, 0, 1]);
}

function parseDateOnlyString(input: string, label: string): number {
  const match = input.match(DATE_ONLY_PATTERN);
  if (!match) {
    throw new Error(`${label} must be a valid date.`);
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${label} must be a valid date.`);
  }

  return Math.floor(ms / DAY_MS);
}

function parseRuntimeDateInput(
  value: GanttRuntimeDateInput,
  options: ResolvedRuntimeImportOptions,
  label: string,
): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${label} must be a finite date value.`);
    }

    if (options.numericDateMode === 'timestamp-ms') {
      return Math.floor(value / DAY_MS);
    }

    return Math.floor(value);
  }

  if (typeof value === 'string') {
    if (DATE_ONLY_PATTERN.test(value)) {
      return parseDateOnlyString(value, label);
    }

    const ms = Date.parse(value);
    if (Number.isNaN(ms)) {
      throw new Error(`${label} must be a valid date string.`);
    }

    return Math.floor(ms / DAY_MS);
  }

  if (value instanceof Date) {
    const ms = value.getTime();
    if (Number.isNaN(ms)) {
      throw new Error(`${label} must be a valid Date.`);
    }

    return Math.floor(ms / DAY_MS);
  }

  throw new Error(`${label} must be a number, string, or Date.`);
}

function buildTaskFromRuntimeInput(
  input: GanttRuntimeTaskInput,
  options: ResolvedRuntimeImportOptions,
  label: string,
): GanttTask {
  const candidate = assertObject(input, label);
  const start = parseRuntimeDateInput(candidate.start as GanttRuntimeDateInput, options, `${label}.start`);
  const inclusiveEnd = parseRuntimeDateInput(candidate.end as GanttRuntimeDateInput, options, `${label}.end`);
  const task = withTaskExtras(
    {
      id: normalizeTaskId(candidate.id, `${label}.id`),
      rowIndex: normalizeRowIndex(candidate.rowIndex, `${label}.rowIndex`),
      start,
      end: inclusiveEnd + 1,
      label: normalizeLabel(candidate.label, `${label}.label`),
      milestone: normalizeMilestone(candidate.milestone, `${label}.milestone`),
      dependencies: normalizeDependencies(candidate.dependencies, `${label}.dependencies`),
      fill: normalizeTaskFill(candidate.fill, `${label}.fill`),
    },
    extractTaskExtras(candidate),
  );

  if (task.end <= task.start) {
    throw new Error(`${label} must have an end date on or after its start date.`);
  }

  return task;
}

function buildTaskFromRuntimePatch(
  taskId: string,
  baseTask: GanttTask,
  patch: GanttRuntimeTaskPatch,
  options: ResolvedRuntimeImportOptions,
): GanttTask {
  const candidate = assertObject(patch, `Task patch for '${taskId}'`);
  if (candidate.id !== undefined) {
    throw new Error(`Task patch for '${taskId}' cannot change the task id.`);
  }

  const start = candidate.start === undefined
    ? baseTask.start
    : parseRuntimeDateInput(candidate.start as GanttRuntimeDateInput, options, `Task patch for '${taskId}'.start`);
  const end = candidate.end === undefined
    ? baseTask.end
    : parseRuntimeDateInput(candidate.end as GanttRuntimeDateInput, options, `Task patch for '${taskId}'.end`) + 1;
  const rowIndex = candidate.rowIndex === undefined
    ? baseTask.rowIndex
    : normalizeRowIndex(candidate.rowIndex, `Task patch for '${taskId}'.rowIndex`);
  const label = candidate.label === undefined
    ? baseTask.label
    : normalizeLabel(candidate.label, `Task patch for '${taskId}'.label`);
  const milestone = candidate.milestone === undefined
    ? baseTask.milestone
    : normalizeMilestone(candidate.milestone, `Task patch for '${taskId}'.milestone`);
  const dependencies = candidate.dependencies === undefined
    ? cloneDependencies(baseTask.dependencies)
    : normalizeDependencies(candidate.dependencies, `Task patch for '${taskId}'.dependencies`);
  const fill = candidate.fill === undefined
    ? baseTask.fill
    : normalizeTaskFill(candidate.fill, `Task patch for '${taskId}'.fill`);

  if (end <= start) {
    throw new Error(`Task patch for '${taskId}' must leave the task with an end date on or after its start date.`);
  }

  return withTaskExtras(
    {
      id: baseTask.id,
      rowIndex,
      start,
      end,
      label,
      milestone,
      dependencies,
      fill,
    },
    mergeTaskExtras(baseTask, candidate),
  );
}

function normalizeTimelineBounds(tasks: GanttTask[]): { timelineStart: number; timelineEnd: number } {
  if (tasks.length === 0) {
    return {
      timelineStart: 0,
      timelineEnd: 0,
    };
  }

  return {
    timelineStart: Math.min(...tasks.map((task) => task.start)),
    timelineEnd: Math.max(...tasks.map((task) => task.end)),
  };
}

function cloneDependencies(dependencies: readonly GanttDependencyRef[] | undefined): GanttDependencyRef[] | undefined {
  return cloneDependencyRefs(dependencies);
}

export { cloneTask, cloneScene };

function buildRuntimeScene(scene: GanttScene, tasks: GanttTask[]): GanttScene {
  const nextTasks = tasks.map((task) => cloneTask(task));
  const maxRowIndex = nextTasks.reduce((maxRow, task) => Math.max(maxRow, task.rowIndex), -1);
  const rowLabels = scene.rowLabels.slice();
  while (rowLabels.length < maxRowIndex + 1) {
    rowLabels.push('');
  }

  return {
    tasks: nextTasks,
    rowLabels,
    ...normalizeTimelineBounds(nextTasks),
  };
}

function sortTaskClones(tasks: readonly GanttTask[]): GanttTask[] {
  return tasks.map((task) => cloneTask(task)).sort(compareTasks);
}

function normalizeExportDate(daySerial: number): string {
  return new Date(Math.floor(daySerial) * DAY_MS).toISOString().slice(0, 10);
}

export function getTask(scene: GanttScene, taskId: string): GanttTask | null {
  const task = scene.tasks.find((candidate) => candidate.id === taskId);
  return task ? cloneTask(task) : null;
}

export function getTasks(scene: GanttScene): GanttTask[] {
  return sortTaskClones(scene.tasks);
}

export function exportTask(task: GanttTask): GanttExportedTask {
  return {
    ...extractTaskExtras(task as Record<string, unknown>),
    id: task.id,
    rowIndex: task.rowIndex,
    label: task.label,
    milestone: Boolean(task.milestone),
    dependencies: cloneDependencies(task.dependencies) ?? [],
    fill: task.fill == null ? undefined : normalizeColorInput(task.fill, [0, 0, 0, 1]),
    startDate: normalizeExportDate(task.start),
    endDate: normalizeExportDate(task.end - 1),
    durationDays: task.end - task.start,
  };
}

export function exportTasks(scene: GanttScene): GanttExportedTask[] {
  return sortTaskClones(scene.tasks).map((task) => exportTask(task));
}

export function addTask(
  scene: GanttScene,
  input: GanttRuntimeTaskInput,
  options?: GanttRuntimeImportOptions,
): { scene: GanttScene; task: GanttTask } {
  const normalizedTask = buildTaskFromRuntimeInput(input, resolveImportOptions(options), 'Task input');
  if (scene.tasks.some((task) => task.id === normalizedTask.id)) {
    throw new Error(`Task '${normalizedTask.id}' already exists.`);
  }

  return {
    scene: buildRuntimeScene(scene, [...scene.tasks, normalizedTask]),
    task: cloneTask(normalizedTask),
  };
}

export function updateTask(
  scene: GanttScene,
  taskId: string,
  patch: GanttRuntimeTaskPatch,
  options?: GanttRuntimeImportOptions,
): { scene: GanttScene; task: GanttTask } {
  const existing = scene.tasks.find((task) => task.id === taskId);
  if (!existing) {
    throw new Error(`Task '${taskId}' does not exist.`);
  }

  const nextTask = buildTaskFromRuntimePatch(taskId, existing, patch, resolveImportOptions(options));
  const tasks = scene.tasks.map((task) => (task.id === taskId ? nextTask : cloneTask(task)));

  return {
    scene: buildRuntimeScene(scene, tasks),
    task: cloneTask(nextTask),
  };
}

export function deleteTasks(
  scene: GanttScene,
  taskIds: string[],
): { scene: GanttScene; tasks: GanttTask[] } {
  if (!Array.isArray(taskIds)) {
    throw new Error('Task ids must be an array.');
  }

  const seenIds = new Set<string>();
  const removedById = new Map<string, GanttTask>();
  for (let index = 0; index < taskIds.length; index += 1) {
    const taskId = normalizeTaskId(taskIds[index], `Task ids[${index}]`);
    if (seenIds.has(taskId)) {
      throw new Error(`Task '${taskId}' appears more than once in the delete request.`);
    }
    seenIds.add(taskId);

    const existing = scene.tasks.find((task) => task.id === taskId);
    if (!existing) {
      throw new Error(`Task '${taskId}' does not exist.`);
    }
    removedById.set(taskId, cloneTask(existing));
  }

  const remainingTasks = scene.tasks
    .filter((task) => !seenIds.has(task.id))
    .map((task) => {
      const nextDependencies = task.dependencies?.filter((dependency) => !seenIds.has(getDependencyTaskId(dependency)));
      return {
        ...cloneTask(task),
        dependencies: nextDependencies && nextDependencies.length > 0 ? nextDependencies : undefined,
      };
    });

  return {
    scene: buildRuntimeScene(scene, remainingTasks),
    tasks: taskIds.map((taskId) => cloneTask(removedById.get(taskId)!)),
  };
}

export function deleteTask(
  scene: GanttScene,
  taskId: string,
): { scene: GanttScene; task: GanttTask } {
  const result = deleteTasks(scene, [taskId]);
  return {
    scene: result.scene,
    task: result.tasks[0],
  };
}

export function importTasks(
  scene: GanttScene,
  inputs: GanttRuntimeTaskInput[],
  options?: GanttRuntimeImportOptions,
): { scene: GanttScene; added: GanttTask[]; updated: GanttTask[] } {
  if (!Array.isArray(inputs)) {
    throw new Error('Task inputs must be an array.');
  }

  const resolvedOptions = resolveImportOptions(options);
  const normalizedTasks = inputs.map((input, index) => buildTaskFromRuntimeInput(input, resolvedOptions, `Task inputs[${index}]`));
  const seenIds = new Set<string>();
  for (const task of normalizedTasks) {
    if (seenIds.has(task.id)) {
      throw new Error(`Task '${task.id}' appears more than once in the import batch.`);
    }
    seenIds.add(task.id);
  }

  const existingIds = new Set(scene.tasks.map((task) => task.id));
  const normalizedById = new Map(normalizedTasks.map((task) => [task.id, task] as const));
  const nextTasks = scene.tasks.map((task) => normalizedById.get(task.id) ?? cloneTask(task));
  const added: GanttTask[] = [];
  const updated: GanttTask[] = [];

  for (const task of normalizedTasks) {
    if (existingIds.has(task.id)) {
      updated.push(cloneTask(task));
      continue;
    }

    added.push(cloneTask(task));
    nextTasks.push(cloneTask(task));
  }

  return {
    scene: buildRuntimeScene(scene, nextTasks),
    added,
    updated,
  };
}
