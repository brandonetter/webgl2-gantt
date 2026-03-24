import { DAY_MS, type GanttScene, type GanttTask } from './core';

export type SampleOptions = {
  seed?: number;
  orderCount?: number;
};

type OrderProfile = 'fast-turn' | 'standard' | 'extended';

type WorkflowStep = {
  label: string;
  minDuration: number;
  maxDuration: number;
  minLag: number;
  maxLag: number;
  skipChance?: number;
  variance?: number;
};

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

const WORKFLOW: WorkflowStep[] = [
  { label: 'New', minDuration: 7, maxDuration: 28, minLag: 0, maxLag: 2, variance: 0.9 },
  { label: 'Intake Review', minDuration: 10, maxDuration: 35, minLag: 1, maxLag: 4, variance: 0.85 },
  { label: 'Documentation Review', minDuration: 7, maxDuration: 42, minLag: 1, maxLag: 4, variance: 0.95 },
  { label: 'Scope Validation', minDuration: 14, maxDuration: 56, minLag: 1, maxLag: 5, variance: 0.9 },
  { label: 'Estimate Build', minDuration: 10, maxDuration: 42, minLag: 1, maxLag: 5, variance: 0.8 },
  { label: 'Quote', minDuration: 14, maxDuration: 70, minLag: 1, maxLag: 7, variance: 0.8 },
  { label: 'Commercial Review', minDuration: 7, maxDuration: 28, minLag: 1, maxLag: 5, variance: 0.7, skipChance: 0.28 },
  { label: 'Quote Revision', minDuration: 14, maxDuration: 63, minLag: 1, maxLag: 8, skipChance: 0.45, variance: 0.95 },
  { label: 'Client Confirmation', minDuration: 14, maxDuration: 49, minLag: 1, maxLag: 6, variance: 0.75 },
  { label: 'Procurement Planning', minDuration: 14, maxDuration: 56, minLag: 1, maxLag: 6, variance: 0.8 },
  { label: 'Capacity Reservation', minDuration: 21, maxDuration: 84, minLag: 1, maxLag: 8, variance: 0.85 },
  { label: 'Scheduled', minDuration: 28, maxDuration: 120, minLag: 1, maxLag: 10, variance: 0.9 },
  { label: 'Material Allocation', minDuration: 14, maxDuration: 70, minLag: 1, maxLag: 7, variance: 0.85, skipChance: 0.22 },
  { label: 'Production Prep', minDuration: 21, maxDuration: 84, minLag: 1, maxLag: 8, variance: 0.9 },
  { label: 'Production', minDuration: 35, maxDuration: 240, minLag: 2, maxLag: 14, variance: 1.0 },
  { label: 'Assembly', minDuration: 21, maxDuration: 120, minLag: 1, maxLag: 8, variance: 0.85, skipChance: 0.25 },
  { label: 'Quality Check', minDuration: 14, maxDuration: 56, minLag: 0, maxLag: 5, skipChance: 0.2, variance: 0.7 },
  { label: 'Packaging', minDuration: 7, maxDuration: 28, minLag: 0, maxLag: 4, variance: 0.55 },
  { label: 'Dispatch Planning', minDuration: 14, maxDuration: 42, minLag: 0, maxLag: 4, variance: 0.65 },
  { label: 'Shipment Booking', minDuration: 7, maxDuration: 35, minLag: 0, maxLag: 4, variance: 0.6 },
  { label: 'In Transit', minDuration: 21, maxDuration: 120, minLag: 1, maxLag: 5, variance: 0.85 },
  { label: 'Delivery Confirmation', minDuration: 7, maxDuration: 28, minLag: 0, maxLag: 3, variance: 0.5 },
  { label: 'Completed', minDuration: 7, maxDuration: 21, minLag: 0, maxLag: 3, variance: 0.45 },
];

function sampleDuration(
  rng: () => number,
  step: WorkflowStep,
  orderScale: number,
  volatility: number,
  profile: OrderProfile,
): number {
  const base = jitter(rng, step.minDuration, step.maxDuration);
  const variance = step.variance ?? 0.5;
  const localSwing = 0.65 + rng() * variance;
  const openingBoost =
    step.label === 'New'
      ? rng() < 0.22
        ? 2.2 + rng() * 3.2
        : 0.95 + rng() * 1.6
      : 1;
  const outlierBoost =
    rng() < 0.1
      ? 1.8 + rng() * 2.8
      : rng() < 0.28
        ? 1.15 + rng() * 0.9
        : 1;
  const rawDuration = Math.round(base * orderScale * volatility * localSwing * openingBoost * outlierBoost);

  if (profile === 'fast-turn') {
    const fastTurnDuration =
      rng() < 0.78
        ? jitter(rng, 1, 7)
        : rng() < 0.93
          ? jitter(rng, 7, 14)
          : jitter(rng, 14, 28);
    return Math.max(1, Math.min(28, Math.min(rawDuration, fastTurnDuration)));
  }

  return Math.max(7, Math.min(365, rawDuration));
}

function sampleLag(rng: () => number, minLag: number, maxLag: number, orderScale: number, profile: OrderProfile): number {
  if (profile === 'fast-turn') {
    return rng() < 0.72 ? 0 : jitter(rng, 0, Math.max(1, Math.min(2, maxLag)));
  }
  const baseLag = jitter(rng, minLag, maxLag);
  const lagScale = rng() < 0.18 ? 1.5 + rng() * 2.5 : 0.8 + rng() * 0.8;
  return Math.max(0, Math.round(baseLag * Math.max(0.85, orderScale * 0.75) * lagScale));
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
  const canAddSecondary = profile !== 'fast-turn' && recentTaskIds.length >= 3 && rng() < 0.22;

  if (canAddSecondary) {
    const maxOffset = Math.min(5, recentTaskIds.length);
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
    const chainLengthBias = rng();
    const profile: OrderProfile =
      rng() < 0.18
        ? 'fast-turn'
        : rng() < 0.34
          ? 'extended'
          : 'standard';
    const orderScale =
      profile === 'fast-turn'
        ? 0.18 + rng() * 0.18
        : profile === 'extended'
          ? 1.7 + rng() * 1.2
          : 0.8 + rng() * 0.85;
    let cursorDays = orderIndex * jitter(rng, 12, 36) + jitter(rng, 0, 48);
    let previousTaskId: string | null = null;
    const recentTaskIds: string[] = [];
    let visibleStepNumber = 1;

    for (let stepIndex = 0; stepIndex < WORKFLOW.length; stepIndex += 1) {
      const step = WORKFLOW[stepIndex];
      if (step.skipChance !== undefined && chainLengthBias < step.skipChance * 0.55 && rng() < step.skipChance) {
        continue;
      }

      const volatility = profile === 'fast-turn' ? 0.55 + rng() * 0.35 : 0.85 + rng() * 0.9;
      cursorDays += sampleLag(rng, step.minLag, step.maxLag, orderScale, profile);
      const duration = sampleDuration(rng, step, orderScale, volatility, profile);
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

      if (step.label === 'Scheduled' && profile !== 'fast-turn' && rng() < 0.28) {
        const holdStart = end + sampleLag(rng, 1, 8, orderScale, profile);
        const holdDurationBase =
          rng() < 0.22
            ? jitter(rng, 180, 365)
            : rng() < 0.55
              ? jitter(rng, 84, 220)
              : jitter(rng, 14, 98);
        const holdDuration = Math.max(7, Math.min(365, Math.round(holdDurationBase * Math.max(0.9, orderScale * (0.85 + rng() * 0.7)))));
        const holdId = `task-${taskOrdinal}`;
        const holdLabel = `${orderNumber} | #${visibleStepNumber} Hold`;

        tasks.push({
          id: holdId,
          rowIndex,
          start: holdStart,
          end: holdStart + holdDuration,
          label: holdLabel,
          dependencies: buildDependencies(rng, profile, previousTaskId, recentTaskIds),
        });

        rowLabels.push(holdLabel);
        previousTaskId = holdId;
        recentTaskIds.push(holdId);
        visibleStepNumber += 1;
        taskOrdinal += 1;
        rowIndex += 1;
        cursorDays = holdStart + holdDuration - baseDay;
        timelineStart = Math.min(timelineStart, holdStart);
        timelineEnd = Math.max(timelineEnd, holdStart + holdDuration);
      }
    }
  }

  return {
    tasks,
    rowLabels,
    timelineStart: Number.isFinite(timelineStart) ? timelineStart : 0,
    timelineEnd: Number.isFinite(timelineEnd) ? timelineEnd : 0,
  };
}
