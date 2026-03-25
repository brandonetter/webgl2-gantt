import './styles.css';
import './themes.css';
import {
  cloneDependencyRef,
  createGanttHost,
  getDependencyTaskId,
  type GanttConfig,
  type DependencyPath,
  type GanttDependencyType,
  type GanttDependencyRef,
  type GanttHost,
  type GanttScene,
  type GanttTask,
} from '@gantt/gantt-core';
import { buildThemeConfig, getDemoTheme, type DemoThemeId } from './themes';

const root = document.getElementById('app');

if (!root) {
  throw new Error('Missing application root element.');
}

const appRoot = root;
const DAY_MS = 24 * 60 * 60 * 1000;
const REPO_URL = 'https://github.com/brandonetter/webgl2-gantt';
const DEMO_CHART_HEIGHT_SCALE = 1.3;

const PAPER_LIGHT_THEME = getDemoTheme('paper-light').className;

type MountId = 'timeline-demo' | 'editing-demo' | 'dependency-demo' | 'json-plugin';
type GanttController = ReturnType<GanttHost['getController']>;
type DependencyLocator = { targetTaskId: string; dependencyIndex: number };
type SceneTaskInput = {
  id: string;
  rowIndex: number;
  startDate: string;
  endDate: string;
  label: string;
  dependencies?: GanttDependencyRef[];
  milestone?: boolean;
} & Record<string, unknown>;

const timelineScene = createScene(
  ['Scope', 'Design', 'Build', 'QA', 'Launch', 'Review'],
  [
    {
      id: 'timeline-scope',
      rowIndex: 0,
      startDate: '2026-08-03',
      endDate: '2026-08-06',
      label: 'Scope',
    },
    {
      id: 'timeline-design',
      rowIndex: 1,
      startDate: '2026-08-06',
      endDate: '2026-08-12',
      label: 'Design',
      dependencies: ['timeline-scope'],
    },
    {
      id: 'timeline-build',
      rowIndex: 2,
      startDate: '2026-08-10',
      endDate: '2026-08-20',
      label: 'Build',
      dependencies: ['timeline-design'],
    },
    {
      id: 'timeline-qa',
      rowIndex: 3,
      startDate: '2026-08-18',
      endDate: '2026-08-24',
      label: 'QA',
      dependencies: ['timeline-build'],
    },
    {
      id: 'timeline-launch',
      rowIndex: 4,
      startDate: '2026-08-25',
      endDate: '2026-08-25',
      label: 'Launch',
      dependencies: ['timeline-qa'],
      milestone: true,
    },
    {
      id: 'timeline-review',
      rowIndex: 5,
      startDate: '2026-08-28',
      endDate: '2026-08-29',
      label: 'Review',
      dependencies: ['timeline-launch'],
    },
  ],
);

const editingScene = createScene(
  ['Brief', 'Design', 'Build', 'QA', 'Release'],
  [
    {
      id: 'edit-brief',
      rowIndex: 0,
      startDate: '2026-09-01',
      endDate: '2026-09-03',
      label: 'Brief',
    },
    {
      id: 'edit-design',
      rowIndex: 1,
      startDate: '2026-09-03',
      endDate: '2026-09-08',
      label: 'Design',
      dependencies: ['edit-brief'],
    },
    {
      id: 'edit-build',
      rowIndex: 2,
      startDate: '2026-09-05',
      endDate: '2026-09-12',
      label: 'Build',
      dependencies: ['edit-design'],
    },
    {
      id: 'edit-qa',
      rowIndex: 3,
      startDate: '2026-09-11',
      endDate: '2026-09-15',
      label: 'QA',
      dependencies: ['edit-build'],
    },
    {
      id: 'edit-release',
      rowIndex: 4,
      startDate: '2026-09-16',
      endDate: '2026-09-16',
      label: 'Release',
      dependencies: ['edit-qa'],
      milestone: true,
    },
  ],
);

const extensionScene = createScene(
  ['Planning', 'Design', 'Build', 'QA', 'Launch', 'Follow-up'],
  [
    {
      id: 'extension-brief',
      rowIndex: 0,
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      label: 'Release brief',
      assignedTo: 'Ada',
    },
    {
      id: 'extension-design',
      rowIndex: 1,
      startDate: '2026-10-03',
      endDate: '2026-10-09',
      label: 'Design review',
      assignedTo: 'Grace',
    },
    {
      id: 'extension-build',
      rowIndex: 2,
      startDate: '2026-10-04',
      endDate: '2026-10-10',
      label: 'Build pipeline',
      assignedTo: 'June',
    },
    {
      id: 'extension-qa',
      rowIndex: 3,
      startDate: '2026-10-09',
      endDate: '2026-10-13',
      label: 'QA sweep',
      dependencies: ['extension-brief'],
      assignedTo: 'Ada',
    },
    {
      id: 'extension-launch',
      rowIndex: 4,
      startDate: '2026-10-14',
      endDate: '2026-10-16',
      label: 'Launch prep',
      dependencies: ['extension-design'],
      assignedTo: 'Grace',
    },
    {
      id: 'extension-followup',
      rowIndex: 5,
      startDate: '2026-10-17',
      endDate: '2026-10-20',
      label: 'Post-launch follow-up',
      assignedTo: 'Unassigned',
    },
  ],
);

const dependencyWorkbenchScene = createScene(
  [
    'FS: Scope',
    'FS: Build',
    'FS: Release',
    '',
    'SS: Kickoff',
    'SS: Design',
    'SS: QA',
    '',
    'FF: Build',
    'FF: QA',
    'FF: Sign-off',
    '',
    'SF: Launch Gate',
    'SF: Support',
    'SF: Closeout',
  ],
  [
    {
      id: 'ex1-scope',
      rowIndex: 0,
      startDate: '2026-11-02',
      endDate: '2026-11-04',
      label: 'Scope',
    },
    {
      id: 'ex1-build',
      rowIndex: 1,
      startDate: '2026-11-05',
      endDate: '2026-11-09',
      label: 'Build',
      dependencies: [{ taskId: 'ex1-scope', type: 'FS' }],
    },
    {
      id: 'ex1-release',
      rowIndex: 2,
      startDate: '2026-11-10',
      endDate: '2026-11-11',
      label: 'Release',
      dependencies: [{ taskId: 'ex1-build', type: 'FS' }],
    },
    {
      id: 'ex2-kickoff',
      rowIndex: 4,
      startDate: '2026-11-03',
      endDate: '2026-11-04',
      label: 'Kickoff',
    },
    {
      id: 'ex2-design',
      rowIndex: 5,
      startDate: '2026-11-03',
      endDate: '2026-11-07',
      label: 'Design stream',
      dependencies: [{ taskId: 'ex2-kickoff', type: 'SS' }],
    },
    {
      id: 'ex2-qa',
      rowIndex: 6,
      startDate: '2026-11-03',
      endDate: '2026-11-05',
      label: 'QA prep',
      dependencies: [{ taskId: 'ex2-kickoff', type: 'SS' }],
    },
    {
      id: 'ex3-build',
      rowIndex: 8,
      startDate: '2026-11-10',
      endDate: '2026-11-16',
      label: 'Build',
    },
    {
      id: 'ex3-qa',
      rowIndex: 9,
      startDate: '2026-11-12',
      endDate: '2026-11-16',
      label: 'QA completion',
      dependencies: [{ taskId: 'ex3-build', type: 'FF' }],
    },
    {
      id: 'ex3-signoff',
      rowIndex: 10,
      startDate: '2026-11-14',
      endDate: '2026-11-16',
      label: 'Sign-off',
      dependencies: [{ taskId: 'ex3-build', type: 'FF' }],
    },
    {
      id: 'ex4-launch',
      rowIndex: 12,
      startDate: '2026-11-18',
      endDate: '2026-11-19',
      label: 'Launch gate',
    },
    {
      id: 'ex4-support',
      rowIndex: 13,
      startDate: '2026-11-10',
      endDate: '2026-11-18',
      label: 'Support sunset',
      dependencies: [{ taskId: 'ex4-launch', type: 'SF' }],
    },
    {
      id: 'ex4-closeout',
      rowIndex: 14,
      startDate: '2026-11-20',
      endDate: '2026-11-21',
      label: 'Closeout',
      dependencies: [{ taskId: 'ex4-launch', type: 'FS' }],
    },
  ],
);

const DEPENDENCY_TYPE_OPTIONS: GanttDependencyType[] = ['FS', 'SS', 'FF', 'SF'];
const DETAIL_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function toUtcDaySerial(isoDate: string): number {
  return Math.floor(new Date(`${isoDate}T00:00:00Z`).getTime() / DAY_MS);
}

function formatDaySerial(daySerial: number): string {
  return DETAIL_DATE_FORMATTER.format(new Date(Math.floor(daySerial) * DAY_MS));
}

function createScene(rowLabels: string[], tasks: SceneTaskInput[]): GanttScene {
  const normalizedTasks: GanttTask[] = tasks.map((task) => {
    const { startDate, endDate, ...extraFields } = task;
    return {
      ...extraFields,
      id: task.id,
      rowIndex: task.rowIndex,
      start: toUtcDaySerial(task.startDate),
      end: toUtcDaySerial(task.endDate) + 1,
      label: task.label,
      dependencies: task.dependencies?.slice(),
      milestone: task.milestone,
    };
  });

  return {
    tasks: normalizedTasks,
    rowLabels: rowLabels.slice(),
    timelineStart: Math.min(...normalizedTasks.map((task) => task.start)),
    timelineEnd: Math.max(...normalizedTasks.map((task) => task.end)),
  };
}

function expandScene(
  scene: GanttScene,
  options: { copies: number; dayOffset: number; labelSuffixes: string[] },
): GanttScene {
  const baseRows = scene.rowLabels.length;
  const tasks: GanttTask[] = [];
  const rowLabels: string[] = [];

  for (let copyIndex = 0; copyIndex < options.copies; copyIndex += 1) {
    const suffix = options.labelSuffixes[copyIndex] ?? ` ${copyIndex + 1}`;
    const taskIdPrefix = `copy-${copyIndex + 1}`;
    const taskIdMap = new Map<string, string>();
    const rowOffset = copyIndex * baseRows;
    const dateOffset = copyIndex * options.dayOffset;

    scene.tasks.forEach((task) => {
      const nextId = `${taskIdPrefix}-${task.id}`;
      taskIdMap.set(task.id, nextId);
      tasks.push({
        ...task,
        id: nextId,
        rowIndex: task.rowIndex + rowOffset,
        start: task.start + dateOffset,
        end: task.end + dateOffset,
        label: `${task.label}${suffix}`,
        dependencies: task.dependencies?.slice(),
      });
    });

    scene.rowLabels.forEach((label) => {
      rowLabels.push(`${label}${suffix}`);
    });

    tasks.forEach((task) => {
      if (!task.id.startsWith(taskIdPrefix)) {
        return;
      }

      const sourceTask = scene.tasks.find(
        (candidate) => `${taskIdPrefix}-${candidate.id}` === task.id,
      );
      if (!sourceTask?.dependencies?.length) {
        return;
      }

      task.dependencies = sourceTask.dependencies.map(
        (dependency) => {
          const dependencyTaskId = getDependencyTaskId(dependency);
          const remappedTaskId = taskIdMap.get(dependencyTaskId);
          if (!remappedTaskId) {
            return cloneDependencyRef(dependency);
          }

          return typeof dependency === 'string'
            ? remappedTaskId
            : {
                ...dependency,
                taskId: remappedTaskId,
              };
        },
      );
    });
  }

  return {
    tasks,
    rowLabels,
    timelineStart: Math.min(...tasks.map((task) => task.start)),
    timelineEnd: Math.max(...tasks.map((task) => task.end)),
  };
}

function fontUrl(path: string): string {
  return new URL(path, window.location.href).href;
}

function pluginUrl(path: string): string {
  return new URL(path, window.location.href).href;
}

function demoMsdfManifestUrls() {
  return {
    400: fontUrl('./fonts/atkinson-hyperlegible-400-msdf.json'),
    700: fontUrl('./fonts/atkinson-hyperlegible-700-msdf.json'),
  };
}

function createEditConfig(
  defaultMode: 'view' | 'select' | 'edit',
): GanttConfig['edit'] {
  return {
    enabled: true,
    defaultMode,
    drag: { allowRowChange: true },
    resize: { enabled: true, handleWidthPx: 14, minDurationDays: 1 },
    snap: { mode: 'day' },
    callbacks: {
      onTaskEditCommit: async (event) => ({
        ...event.proposedTask,
        dependencies: event.proposedTask.dependencies?.slice(),
      }),
    },
  };
}

function tallerDemoHeight(height: number): number {
  return Math.round(height * DEMO_CHART_HEIGHT_SCALE);
}

function createDemoConfig(
  scene: GanttScene,
  themeId: DemoThemeId,
  msdfManifestUrls: Record<string, string>,
  options: {
    title: string;
    height: number;
    defaultMode: 'view' | 'select' | 'edit';
    editable?: boolean;
    plugins?: GanttConfig['plugins'];
    statusText?: string;
  },
): GanttConfig {
  const base = buildThemeConfig(scene, themeId, msdfManifestUrls);

  return {
    ...base,
    container: {
      ...base.container,
      height: options.height,
      toolbar: {
        position: 'top',
        ...base.container?.toolbar,
      },
    },
    edit: options.editable === false
      ? {
          enabled: false,
          defaultMode: 'view',
        }
      : createEditConfig(options.defaultMode),
    ui: {
      ...base.ui,
      title: options.title,
      showHud: false,
      showInspector: false,
      showToolbar: true,
      showStatusLine: true,
      statusText: options.statusText ?? '',
    },
    plugins: options.plugins,
  };
}

function buildPage(): string {
  return `
    <main class="landing-page">
      <header class="landing-topbar reveal">
        <a class="landing-brand" href="#top" aria-label="PaperGantt home">
          <span class="landing-brand__mark">G</span>
          <span class="landing-brand__copy">
            <strong>PaperGantt</strong>
          </span>
        </a>
        <a class="landing-button landing-button--ghost" href="${REPO_URL}" target="_blank" rel="noreferrer">View Source</a>
      </header>

      <section class="hero-block reveal" id="top" style="--delay: 80ms;">
        <div class="hero-copy">
          <p class="hero-kicker">Open source WebGL2 gantt library</p>
          <h1>PaperGantt</h1>
        </div>
      </section>

      <section class="demo-section reveal" id="timeline" style="--delay: 140ms;">
        <div class="demo-copy">
          <p class="section-label">Timeline</p>
          <h2>Navigate the schedule.</h2>
          <p>Starts in view mode. Mousewheel zoom. Drag to pan. Stay on the timeline.</p>
        </div>
        <div class="demo-frame demo-frame--light ${PAPER_LIGHT_THEME}">
          <div class="demo-chart demo-chart--themed" data-demo-mount="timeline-demo" aria-label="Timeline demo"></div>
        </div>
      </section>

      <section class="demo-section demo-section--reverse reveal" id="editing" style="--delay: 200ms;">
        <div class="demo-copy">
          <p class="section-label">Editing</p>
          <h2>Edit inline.</h2>
          <p>Starts in edit mode. Resize bars, move work, and commit changes on the chart.</p>
        </div>
        <div class="demo-frame demo-frame--light ${PAPER_LIGHT_THEME}">
          <div class="demo-chart demo-chart--themed" data-demo-mount="editing-demo" aria-label="Editing demo"></div>
        </div>
      </section>

      <section class="demo-section demo-section--panel reveal" id="dependencies" style="--delay: 260ms;">
        <div class="demo-frame demo-frame--light ${getDemoTheme('warm').className}">
          <div class="dependency-demo-shell">
            <div class="demo-chart demo-chart--themed dependency-demo-chart" data-demo-mount="dependency-demo" aria-label="Typed dependency demo"></div>
            <aside class="dependency-side-panel" data-dependency-panel aria-label="Dependency workbench">
              <p class="dependency-side-panel__eyebrow">Dependency Workbench</p>
              <h2 class="dependency-side-panel__title">Typed links, live.</h2>
              <p class="dependency-side-panel__lede">Select a task for schedule details, or click a dependency line to retag that exact link as <code>FS</code>, <code>SS</code>, <code>FF</code>, or <code>SF</code>.</p>
              <div class="dependency-side-panel__content" data-dependency-panel-content></div>
            </aside>
          </div>
        </div>
      </section>

      <section class="demo-section reveal" id="plugins" style="--delay: 320ms;">
        <div class="demo-copy">
          <p class="section-label">Extensibility</p>
          <h2>Draw and interact from extensions.</h2>
          <p>Assignee groups render in the canvas, switch between expanded and collapsed rows, and never rewrite the committed scene.</p>
        </div>
        <div class="demo-frame demo-frame--light ${getDemoTheme('standard').className}">
          <div class="demo-chart demo-chart--themed" data-demo-mount="json-plugin" aria-label="Extension canvas demo"></div>
        </div>
      </section>
    </main>
  `;
}

function getMount(id: MountId): HTMLElement {
  const element = appRoot.querySelector(`[data-demo-mount="${id}"]`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing mount for "${id}".`);
  }
  return element;
}

function createTimelineConfig(
  msdfManifestUrls: Record<string, string>,
): GanttConfig {
  return createDemoConfig(
    expandScene(timelineScene, {
      copies: 3,
      dayOffset: 16,
      labelSuffixes: [' A', ' B', ' C'],
    }),
    'paper-light',
    msdfManifestUrls,
    {
      title: 'Timeline view',
      height: tallerDemoHeight(408),
      defaultMode: 'view',
      statusText: 'View mode. Mousewheel zoom and drag to pan.',
    },
  );
}

function createEditingConfig(
  msdfManifestUrls: Record<string, string>,
): GanttConfig {
  return createDemoConfig(
    expandScene(editingScene, {
      copies: 3,
      dayOffset: 14,
      labelSuffixes: [' A', ' B', ' C'],
    }),
    'paper-light',
    msdfManifestUrls,
    {
      title: 'Editing demo',
      height: tallerDemoHeight(426),
      defaultMode: 'edit',
      statusText: 'Edit mode. Resize bars, move work, commit changes.',
    },
  );
}

function createPluginConfig(
  msdfManifestUrls: Record<string, string>,
): GanttConfig {
  return createDemoConfig(
    expandScene(extensionScene, {
      copies: 3,
      dayOffset: 15,
      labelSuffixes: [' A', ' B', ' C'],
    }),
    'standard',
    msdfManifestUrls,
    {
      title: 'Extension canvas demo',
      height: tallerDemoHeight(438),
      defaultMode: 'view',
      editable: false,
      statusText: 'Click an assignee in the left pane to collapse or expand that group.',
      plugins: [
        {
          source: {
            type: 'esm',
            url: pluginUrl('./plugins/assignee-group-collapse-plugin.mjs'),
          },
          idHint: 'json-plugin',
          options: {
            paneWidth: 176,
          },
        },
      ],
    },
  );
}

function createDependencyWorkbenchConfig(
  msdfManifestUrls: Record<string, string>,
): GanttConfig {
  return createDemoConfig(
    dependencyWorkbenchScene,
    'warm',
    msdfManifestUrls,
    {
      title: 'Typed dependency workbench',
      height: tallerDemoHeight(418),
      defaultMode: 'select',
      statusText: 'Select lines or tasks from the panel, or switch to edit mode to move and resize the demo tasks.',
    },
  );
}

function getDependencyPanel(): HTMLElement {
  const element = appRoot.querySelector('[data-dependency-panel]');
  if (!(element instanceof HTMLElement)) {
    throw new Error('Missing dependency panel.');
  }
  return element;
}

function getDependencyRefType(
  dependency: GanttDependencyRef,
): GanttDependencyType | undefined {
  return typeof dependency === 'string' ? undefined : dependency.type;
}

function buildDependencyBaseId(
  sourceTaskId: string,
  targetTaskId: string,
  type: GanttDependencyType | undefined,
): string {
  return type ? `${sourceTaskId}->${targetTaskId}:${type}` : `${sourceTaskId}->${targetTaskId}`;
}

function resolveDependencyLocatorFromPath(
  controller: GanttController,
  path: DependencyPath | null,
): DependencyLocator | null {
  if (!path) {
    return null;
  }

  const targetTask = controller.getTask(path.targetTaskId);
  const dependencies = targetTask?.dependencies ?? [];
  if (dependencies.length === 0) {
    return null;
  }

  const indexedPathSlot = path.dependencyIndex;
  if (Number.isInteger(indexedPathSlot ?? Number.NaN) && dependencies[indexedPathSlot ?? -1]) {
    return {
      targetTaskId: path.targetTaskId,
      dependencyIndex: indexedPathSlot ?? 0,
    };
  }

  const suffixMatch = path.id.match(/#(\d+)$/);
  const baseId = suffixMatch && typeof suffixMatch.index === 'number'
    ? path.id.slice(0, suffixMatch.index)
    : path.id;
  const ordinal = suffixMatch ? Number.parseInt(suffixMatch[1] ?? '1', 10) : 1;
  let matchingOrdinal = 0;

  for (const [dependencyIndex, dependency] of dependencies.entries()) {
    const candidateId = buildDependencyBaseId(
      getDependencyTaskId(dependency),
      path.targetTaskId,
      getDependencyRefType(dependency),
    );
    if (candidateId !== baseId) {
      continue;
    }

    matchingOrdinal += 1;
    if (matchingOrdinal === ordinal) {
      return {
        targetTaskId: path.targetTaskId,
        dependencyIndex,
      };
    }
  }

  const fallbackIndex = dependencies.findIndex((dependency) => (
    getDependencyTaskId(dependency) === path.sourceTaskId &&
    getDependencyRefType(dependency) === path.dependencyType
  ));
  if (fallbackIndex < 0) {
    return null;
  }

  return {
    targetTaskId: path.targetTaskId,
    dependencyIndex: fallbackIndex,
  };
}

function renderDependencyPanelContent(
  panel: HTMLElement,
  selection: {
    task: GanttTask | null;
    dependency: {
      targetTaskId: string;
      dependencyIndex: number;
      renderedPath: DependencyPath | null;
    } | null;
  },
  taskLookup: Map<string, GanttTask>,
): void {
  const content = panel.querySelector('[data-dependency-panel-content]');
  if (!(content instanceof HTMLElement)) {
    throw new Error('Missing dependency panel content mount.');
  }

  if (selection.dependency) {
    const dependency = selection.dependency;
    const targetTask = taskLookup.get(dependency.targetTaskId);
    const liveDependency = targetTask?.dependencies?.[dependency.dependencyIndex];
    if (!targetTask || !liveDependency) {
      content.innerHTML = `
        <section class="dependency-panel-card dependency-panel-card--empty">
          <p class="dependency-panel-card__title">Connection no longer available</p>
          <p class="dependency-panel-card__meta">Select a task or click another dependency line to continue editing links.</p>
        </section>
      `;
      return;
    }

    const sourceTaskId = getDependencyTaskId(liveDependency);
    const sourceTask = taskLookup.get(sourceTaskId);
    const currentType = typeof liveDependency === 'string' ? 'FS' : liveDependency.type ?? 'FS';
    const renderedPath = dependency.renderedPath;
    const connectionLabel = renderedPath?.id ?? `${sourceTaskId}->${targetTask.id}:${currentType}`;

    content.innerHTML = `
      <section class="dependency-panel-card">
        <div class="dependency-task-summary">
          <div>
            <p class="dependency-task-summary__eyebrow">Selected Connection</p>
            <h3 class="dependency-task-summary__title">${sourceTask?.label ?? sourceTaskId} to ${targetTask.label}</h3>
          </div>
          <span class="dependency-task-summary__badge">${connectionLabel}</span>
        </div>
        <dl class="dependency-facts">
          <div><dt>Source</dt><dd>${sourceTaskId}</dd></div>
          <div><dt>Target</dt><dd>${targetTask.id}</dd></div>
          <div><dt>Type</dt><dd>${currentType}</dd></div>
          <div><dt>Segments</dt><dd>${renderedPath?.segments.length ?? 'Rerouting'}</dd></div>
        </dl>
      </section>
      <section class="dependency-panel-card">
        <div class="dependency-panel-card__header">
          <p class="dependency-panel-card__title">Swap Link Type</p>
          <p class="dependency-panel-card__meta">Selecting a connection targets one exact dependency and keeps that link selected after the route updates.</p>
        </div>
        <label class="dependency-link-row">
          <span class="dependency-link-row__copy">
            <span class="dependency-link-row__title">${sourceTask?.label ?? sourceTaskId} -> ${targetTask.label}</span>
            <span class="dependency-link-row__meta">Dependency slot ${dependency.dependencyIndex + 1} on ${targetTask.id}</span>
          </span>
          <select
            class="dependency-link-row__select"
            data-selected-dependency="true"
            data-target-task-id="${targetTask.id}"
            data-dependency-index="${dependency.dependencyIndex}"
            aria-label="Dependency type for selected connection"
          >
            ${DEPENDENCY_TYPE_OPTIONS.map((option) => `<option value="${option}"${option === currentType ? ' selected' : ''}>${option}</option>`).join('')}
          </select>
        </label>
      </section>
    `;
    return;
  }

  const task = selection.task;
  if (!task) {
    content.innerHTML = `
      <section class="dependency-panel-card dependency-panel-card--empty">
        <p class="dependency-panel-card__title">Nothing selected</p>
        <p class="dependency-panel-card__meta">Click a task for schedule details or click a dependency line to edit that exact connection type.</p>
      </section>
    `;
    return;
  }

  const dependencies = task.dependencies ?? [];
  const dependencyMarkup = dependencies.length > 0
    ? dependencies.map((dependency, index) => {
      const sourceTask = taskLookup.get(getDependencyTaskId(dependency));
      const type = typeof dependency === 'string' ? 'Legacy' : dependency.type ?? 'Legacy';
      return `
        <label class="dependency-link-row">
          <span class="dependency-link-row__copy">
            <span class="dependency-link-row__title">${sourceTask?.label ?? getDependencyTaskId(dependency)}</span>
            <span class="dependency-link-row__meta">${getDependencyTaskId(dependency)} -> ${task.id}</span>
          </span>
          <select class="dependency-link-row__select" data-dependency-index="${index}" aria-label="Dependency type for ${sourceTask?.label ?? getDependencyTaskId(dependency)}">
            ${DEPENDENCY_TYPE_OPTIONS.map((option) => `<option value="${option}"${option === type ? ' selected' : ''}>${option}</option>`).join('')}
          </select>
        </label>
      `;
    }).join('')
    : `
      <section class="dependency-panel-card dependency-panel-card--empty">
        <p class="dependency-panel-card__title">No predecessors</p>
        <p class="dependency-panel-card__meta">This task has no inbound dependencies. Select another task to experiment with typed links.</p>
      </section>
    `;

  content.innerHTML = `
    <section class="dependency-panel-card">
      <div class="dependency-task-summary">
        <div>
          <p class="dependency-task-summary__eyebrow">Selected Task</p>
          <h3 class="dependency-task-summary__title">${task.label}</h3>
        </div>
        <span class="dependency-task-summary__badge">${task.id}</span>
      </div>
      <dl class="dependency-facts">
        <div><dt>Row</dt><dd>${task.rowIndex + 1}</dd></div>
        <div><dt>Start</dt><dd>${formatDaySerial(task.start)}</dd></div>
        <div><dt>End</dt><dd>${formatDaySerial(task.end - 1)}</dd></div>
        <div><dt>Duration</dt><dd>${task.end - task.start}d</dd></div>
        <div><dt>Milestone</dt><dd>${task.milestone ? 'Yes' : 'No'}</dd></div>
        <div><dt>Links</dt><dd>${dependencies.length}</dd></div>
      </dl>
    </section>
    <section class="dependency-panel-card">
      <div class="dependency-panel-card__header">
        <p class="dependency-panel-card__title">Incoming Links</p>
        <p class="dependency-panel-card__meta">You can edit here from the selected task, or click an arrow to edit just one connection directly.</p>
      </div>
      <div class="dependency-links-list">
        ${dependencyMarkup}
      </div>
    </section>
  `;
}

function wireDependencyWorkbench(
  host: GanttHost,
  panel: HTMLElement,
): void {
  const controller = host.getController();
  let rafId = 0;
  let lastSelectionSignature = '';
  let pinnedDependencyLocator: DependencyLocator | null = null;

  const resolvePinnedDependencyPath = (): DependencyPath | null => {
    if (!pinnedDependencyLocator) {
      return null;
    }

    return controller.getCurrentFrame()?.dependencyPaths.find((path) =>
      path.targetTaskId === pinnedDependencyLocator?.targetTaskId &&
      path.dependencyIndex === pinnedDependencyLocator?.dependencyIndex,
    ) ?? null;
  };

  const restoreDependencySelection = (
    targetTaskId: string,
    dependencyIndex: number,
    attemptsRemaining = 8,
  ): void => {
    const nextPath = controller.getCurrentFrame()?.dependencyPaths.find((path) =>
      path.targetTaskId === targetTaskId &&
      path.dependencyIndex === dependencyIndex,
    );
    if (nextPath) {
      controller.setSelectionByDependencyId(nextPath.id);
      return;
    }

    if (attemptsRemaining <= 0) {
      controller.setSelectionByTaskId(targetTaskId);
      return;
    }

    window.requestAnimationFrame(() => restoreDependencySelection(targetTaskId, dependencyIndex, attemptsRemaining - 1));
  };

  const refresh = (): void => {
    const selection = controller.getSelection();
    const selectedTask = selection.selectedTask;
    const resolvedSelectedDependency = resolveDependencyLocatorFromPath(
      controller,
      selection.selectedDependency,
    );

    if (resolvedSelectedDependency) {
      pinnedDependencyLocator = resolvedSelectedDependency;
    } else if (
      selectedTask &&
      (!pinnedDependencyLocator || selectedTask.id !== pinnedDependencyLocator.targetTaskId)
    ) {
      pinnedDependencyLocator = null;
    }
    const pinnedDependencyTargetTask = pinnedDependencyLocator
      ? controller.getTask(pinnedDependencyLocator.targetTaskId)
      : null;
    const pinnedDependencyRef = pinnedDependencyLocator
      ? pinnedDependencyTargetTask?.dependencies?.[pinnedDependencyLocator.dependencyIndex]
      : null;
    const renderedPinnedPath = resolvePinnedDependencyPath();
    const signature = pinnedDependencyLocator && pinnedDependencyRef
      ? `dep:${pinnedDependencyLocator.targetTaskId}:${pinnedDependencyLocator.dependencyIndex}:${JSON.stringify(pinnedDependencyRef)}:${renderedPinnedPath?.id ?? ''}`
      : selectedTask
        ? `task:${selectedTask.id}:${JSON.stringify(selectedTask.dependencies ?? [])}:${selectedTask.start}:${selectedTask.end}:${selectedTask.rowIndex}`
        : 'none';
    if (signature !== lastSelectionSignature) {
      lastSelectionSignature = signature;
      renderDependencyPanelContent(
        panel,
        {
          task: selectedTask,
          dependency: pinnedDependencyLocator
            ? {
                targetTaskId: pinnedDependencyLocator.targetTaskId,
                dependencyIndex: pinnedDependencyLocator.dependencyIndex,
                renderedPath: renderedPinnedPath,
              }
            : null,
        },
        new Map(controller.getTasks().map((task) => [task.id, task] as const)),
      );
    }
    rafId = window.requestAnimationFrame(refresh);
  };

  const handleChange = (event: Event): void => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    const dependencyIndex = Number.parseInt(select.dataset.dependencyIndex ?? '', 10);
    const targetTaskId = select.dataset.targetTaskId;
    const fallbackSelectedTask = controller.getSelection().selectedTask;
    const targetTask = targetTaskId ? controller.getTask(targetTaskId) : fallbackSelectedTask;
    if (!targetTask || !Number.isInteger(dependencyIndex)) {
      return;
    }

    const currentDependencies = targetTask.dependencies ?? [];
    if (!currentDependencies[dependencyIndex]) {
      return;
    }

    const nextType = select.value as GanttDependencyType;
    const nextDependencies = currentDependencies.map((dependency, index) => {
      if (index !== dependencyIndex) {
        return cloneDependencyRef(dependency);
      }

      return {
        taskId: getDependencyTaskId(dependency),
        type: nextType,
      };
    });

    const editingSelectedDependency = select.dataset.selectedDependency === 'true';
    controller.updateTask(targetTask.id, { dependencies: nextDependencies });
    controller.requestRender();

    if (editingSelectedDependency) {
      pinnedDependencyLocator = {
        targetTaskId: targetTask.id,
        dependencyIndex,
      };
      restoreDependencySelection(targetTask.id, dependencyIndex);
      return;
    }

    pinnedDependencyLocator = null;
    controller.setSelectionByTaskId(targetTask.id);
  };

  panel.addEventListener('change', handleChange);
  controller.registerCleanup(() => {
    panel.removeEventListener('change', handleChange);
    window.cancelAnimationFrame(rafId);
  });

  renderDependencyPanelContent(
    panel,
    {
      task: controller.getSelection().selectedTask,
      dependency: null,
    },
    new Map(controller.getTasks().map((task) => [task.id, task] as const)),
  );
  rafId = window.requestAnimationFrame(refresh);
}

async function mountDemo(
  target: HTMLElement,
  config: GanttConfig,
): Promise<GanttHost> {
  return createGanttHost(target, config);
}

async function boot(): Promise<void> {
  appRoot.innerHTML = buildPage();

  const msdfManifestUrls = demoMsdfManifestUrls();
  const hosts: GanttHost[] = [];

  try {
    hosts.push(
      await mountDemo(
        getMount('timeline-demo'),
        createTimelineConfig(msdfManifestUrls),
      ),
    );
    hosts.push(
      await mountDemo(
        getMount('editing-demo'),
        createEditingConfig(msdfManifestUrls),
      ),
    );
    const dependencyHost = await mountDemo(
      getMount('dependency-demo'),
      createDependencyWorkbenchConfig(msdfManifestUrls),
    );
    wireDependencyWorkbench(dependencyHost, getDependencyPanel());
    hosts.push(dependencyHost);
    hosts.push(
      await mountDemo(
        getMount('json-plugin'),
        createPluginConfig(msdfManifestUrls),
      ),
    );
  } catch (error) {
    await Promise.allSettled(hosts.map((host) => host.dispose()));
    throw error;
  }
}

boot().catch((error) => {
  console.error(error);
  appRoot.innerHTML = `
    <main class="landing-page">
      <section class="demo-error">
        <h1>PaperGantt</h1>
      </section>
    </main>
  `;
});
