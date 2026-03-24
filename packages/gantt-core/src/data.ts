import { DAY_MS, type GanttScene, type GanttTask } from './core';

export type SampleOptions = {
  seed?: number;
  orderCount?: number;
};

type OrderProfile = 'rapid' | 'standard' | 'complex';

type WorkflowStep = {
  label: string;
  minDuration: number;
  maxDuration: number;
  minLag: number;
  maxLag: number;
  skipChance?: number;
  longTailChance?: number;
  longTailMaxDuration?: number;
};

type ProfileTuning = {
  durationScaleMin: number;
  durationScaleMax: number;
  mediumDurationChance: number;
  longTailBias: number;
  lagScaleMin: number;
  lagScaleMax: number;
  optionalSkipBias: number;
  secondaryDependencyChance: number;
};

const MAX_TASK_DURATION_DAYS = 60;
const SHORT_TASK_MAX_DAYS = 14;

const PROFILE_TUNING: Record<OrderProfile, ProfileTuning> = {
  rapid: {
    durationScaleMin: 0.7,
    durationScaleMax: 0.95,
    mediumDurationChance: 0.08,
    longTailBias: 0.4,
    lagScaleMin: 0.35,
    lagScaleMax: 0.8,
    optionalSkipBias: 1.15,
    secondaryDependencyChance: 0.06,
  },
  standard: {
    durationScaleMin: 0.85,
    durationScaleMax: 1.1,
    mediumDurationChance: 0.16,
    longTailBias: 0.9,
    lagScaleMin: 0.55,
    lagScaleMax: 1,
    optionalSkipBias: 1,
    secondaryDependencyChance: 0.1,
  },
  complex: {
    durationScaleMin: 0.95,
    durationScaleMax: 1.3,
    mediumDurationChance: 0.24,
    longTailBias: 1.35,
    lagScaleMin: 0.75,
    lagScaleMax: 1.2,
    optionalSkipBias: 0.82,
    secondaryDependencyChance: 0.18,
  },
};

const WORKFLOW: WorkflowStep[] = [
  { label: 'Intake', minDuration: 1, maxDuration: 3, minLag: 0, maxLag: 1 },
  { label: 'Scope Check', minDuration: 1, maxDuration: 4, minLag: 0, maxLag: 1 },
  { label: 'Estimate', minDuration: 2, maxDuration: 5, minLag: 0, maxLag: 2 },
  { label: 'Client Reply', minDuration: 1, maxDuration: 4, minLag: 0, maxLag: 2, skipChance: 0.12 },
  { label: 'Schedule', minDuration: 1, maxDuration: 3, minLag: 0, maxLag: 2 },
  { label: 'Parts Hold', minDuration: 7, maxDuration: 18, minLag: 0, maxLag: 2, skipChance: 0.88, longTailChance: 0.22, longTailMaxDuration: 60 },
  { label: 'Prep', minDuration: 1, maxDuration: 5, minLag: 0, maxLag: 2 },
  { label: 'Execution', minDuration: 2, maxDuration: 10, minLag: 0, maxLag: 3, longTailChance: 0.06, longTailMaxDuration: 45 },
  { label: 'Touch-up', minDuration: 1, maxDuration: 4, minLag: 0, maxLag: 1, skipChance: 0.28 },
  { label: 'QA', minDuration: 1, maxDuration: 3, minLag: 0, maxLag: 1 },
  { label: 'Delivery', minDuration: 1, maxDuration: 5, minLag: 0, maxLag: 2, skipChance: 0.14, longTailChance: 0.03, longTailMaxDuration: 28 },
  { label: 'Closeout', minDuration: 1, maxDuration: 2, minLag: 0, maxLag: 1 },
];

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function jitter(rng: () => number, min: number, max: number): number {
  return Math.round(min + rng() * (max - min));
}

function sampleProfile(rng: () => number): OrderProfile {
  const roll = rng();
  if (roll < 0.48) {
    return 'rapid';
  }
  if (roll < 0.9) {
    return 'standard';
  }
  return 'complex';
}

function sampleDuration(rng: () => number, step: WorkflowStep, profile: OrderProfile): number {
  const tuning = PROFILE_TUNING[profile];
  const baseDuration = jitter(rng, step.minDuration, step.maxDuration);
  const scale = tuning.durationScaleMin + rng() * (tuning.durationScaleMax - tuning.durationScaleMin);
  let duration = Math.max(1, Math.round(baseDuration * scale));

  if (duration < SHORT_TASK_MAX_DAYS - 2 && rng() < tuning.mediumDurationChance) {
    duration = Math.max(duration, jitter(rng, 8, SHORT_TASK_MAX_DAYS));
  }

  const longTailChance = Math.min(0.35, (step.longTailChance ?? 0) * tuning.longTailBias);
  if (longTailChance > 0 && rng() < longTailChance) {
    const tailMax = Math.min(MAX_TASK_DURATION_DAYS, step.longTailMaxDuration ?? 28);
    const tailMin = Math.min(tailMax, Math.max(15, duration + jitter(rng, 4, 10)));
    duration = jitter(rng, tailMin, tailMax);
  }

  return Math.max(1, Math.min(MAX_TASK_DURATION_DAYS, duration));
}

function sampleLag(rng: () => number, step: WorkflowStep, profile: OrderProfile): number {
  const tuning = PROFILE_TUNING[profile];
  const baseLag = jitter(rng, step.minLag, step.maxLag);
  const scale = tuning.lagScaleMin + rng() * (tuning.lagScaleMax - tuning.lagScaleMin);
  return Math.max(0, Math.min(6, Math.round(baseLag * scale)));
}

function shouldSkipStep(rng: () => number, step: WorkflowStep, profile: OrderProfile): boolean {
  if (step.skipChance === undefined) {
    return false;
  }
  const tuning = PROFILE_TUNING[profile];
  const skipChance = Math.min(0.96, step.skipChance * tuning.optionalSkipBias);
  return rng() < skipChance;
}

function buildOrderNumber(index: number): string {
  return `${1236500 + index}`.padStart(8, '0');
}

function buildDependencies(
  rng: () => number,
  profile: OrderProfile,
  previousTaskId: string | null,
  recentTaskIds: string[],
): string[] | undefined {
  if (!previousTaskId) {
    return undefined;
  }

  const dependencies = [previousTaskId];
  const secondaryDependencyChance = PROFILE_TUNING[profile].secondaryDependencyChance;

  if (recentTaskIds.length >= 3 && rng() < secondaryDependencyChance) {
    const maxOffset = Math.min(4, recentTaskIds.length);
    const offset = jitter(rng, 2, maxOffset);
    const secondary = recentTaskIds[recentTaskIds.length - offset];
    if (secondary && secondary !== previousTaskId) {
      dependencies.push(secondary);
    }
  }

  return dependencies;
}

export function createSampleScene(options: SampleOptions = {}): GanttScene {
  const rng = mulberry32(options.seed ?? 1337);
  const orderCount = options.orderCount ?? 320;
  const tasks: GanttTask[] = [];
  const rowLabels: string[] = [];
  const baseDay = Math.floor(Date.UTC(2026, 0, 6) / DAY_MS);

  let taskOrdinal = 0;
  let rowIndex = 0;
  let timelineStart = Number.POSITIVE_INFINITY;
  let timelineEnd = Number.NEGATIVE_INFINITY;

  for (let orderIndex = 0; orderIndex < orderCount; orderIndex += 1) {
    const orderNumber = buildOrderNumber(orderIndex);
    const profile = sampleProfile(rng);
    let cursorDays = orderIndex * jitter(rng, 2, 5) + jitter(rng, 0, 10);
    let previousTaskId: string | null = null;
    const recentTaskIds: string[] = [];
    let visibleStepNumber = 1;

    for (const step of WORKFLOW) {
      if (shouldSkipStep(rng, step, profile)) {
        continue;
      }

      cursorDays += sampleLag(rng, step, profile);
      const duration = sampleDuration(rng, step, profile);
      const start = baseDay + cursorDays;
      const end = start + duration;
      const id = `task-${taskOrdinal}`;
      const label = `${orderNumber} | #${visibleStepNumber} ${step.label}`;

      tasks.push({
        id,
        rowIndex,
        start,
        end,
        label,
        dependencies: buildDependencies(rng, profile, previousTaskId, recentTaskIds),
      });

      rowLabels.push(label);
      previousTaskId = id;
      recentTaskIds.push(id);
      visibleStepNumber += 1;
      taskOrdinal += 1;
      rowIndex += 1;
      cursorDays = end - baseDay;
      timelineStart = Math.min(timelineStart, start);
      timelineEnd = Math.max(timelineEnd, end);
    }
  }

  return {
    tasks,
    rowLabels,
    timelineStart: Number.isFinite(timelineStart) ? timelineStart : 0,
    timelineEnd: Number.isFinite(timelineEnd) ? timelineEnd : 0,
  };
}
