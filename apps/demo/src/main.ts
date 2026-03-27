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
type ApiDocCard = {
  id: string;
  eyebrow: string;
  title: string;
  copy: string;
  items: string[];
  code?: string;
  codeLabel?: string;
};
type ApiReferenceParam = {
  name: string;
  type: string;
  description: string;
};
type ApiReferenceEntry = {
  id: string;
  kind: 'function' | 'method' | 'property';
  name: string;
  signature: string;
  description: string;
  returns?: string;
  params?: ApiReferenceParam[];
  notes?: string[];
};
type ApiReferenceGroup = {
  id: string;
  eyebrow: string;
  title: string;
  copy: string;
  methods: ApiReferenceEntry[];
  notes?: string[];
};

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
const API_QUICKSTART_SNIPPET = [
  "import { createGanttHost } from '@gantt/gantt-core';",
  '',
  "const host = await createGanttHost(document.querySelector('#chart')!, {",
  '  data: {',
  "    type: 'static',",
  '    scene: {',
  "      rowLabels: ['Design', 'Build', 'QA'],",
  '      tasks: [],',
  '      timelineStart: 0,',
  '      timelineEnd: 28,',
  '    },',
  '  },',
  "  ui: { title: 'Release plan', showToolbar: true, showStatusLine: true },",
  "  edit: { enabled: true, defaultMode: 'select' },",
  '});',
  '',
  'const controller = host.getController();',
  'controller.importTasks([',
  "  { id: 'design', rowIndex: 0, start: '2026-04-06', end: '2026-04-09', label: 'Design' },",
  "  { id: 'build', rowIndex: 1, start: '2026-04-09', end: '2026-04-17', label: 'Build', dependencies: ['design'] },",
  "  { id: 'qa', rowIndex: 2, start: '2026-04-17', end: '2026-04-21', label: 'QA', dependencies: [{ taskId: 'build', type: 'FS' }] },",
  ']);',
  "controller.animateToZoomPresetId('month');",
].join('\n');
const API_PLUGIN_SNIPPET = [
  'import {',
  '  GANTT_PLUGIN_API_VERSION,',
  '  definePlugin,',
  "} from '@gantt/gantt-plugin-sdk';",
  '',
  'export default definePlugin({',
  '  meta: {',
  "    id: 'selection-logger',",
  "    version: '0.1.0',",
  "    apiRange: '>=' + GANTT_PLUGIN_API_VERSION + ' <2.0.0',",
  '  },',
  '  create({ safe }) {',
  '    const unregister = safe.registerUiCommand({',
  "      id: 'log-selection',",
  "      label: 'Log selection',",
  "      run: () => safe.logger.info('selection', safe.getSelection()),",
  '    });',
  '',
  '    return {',
  '      onDispose: unregister,',
  '    };',
  '  },',
  '});',
].join('\n');
const API_DOC_CARDS: ApiDocCard[] = [
  {
    id: 'api-host',
    eyebrow: 'Host',
    title: 'Mount once and keep the controller.',
    copy: 'The host wraps lifecycle and DOM setup. The controller is the imperative layer for scene updates, selection, editing, and camera control.',
    items: [
      '<code>createGanttHost(root, config)</code> resolves to an object with <code>dispose()</code> and <code>getController()</code>.',
      '<code>startApp(root)</code> is still available as a compatibility wrapper around the default host boot path.',
      'Use <code>syncCanvasSize()</code> when a parent layout changes size outside the built-in flow.',
      'Call <code>requestRender()</code> after external state changes that should redraw overlays or plugin canvas layers.',
    ],
  },
  {
    id: 'api-data',
    eyebrow: 'Data Model',
    title: 'Committed scenes stay small and predictable.',
    copy: 'The core scene is plain data. Tasks are row-based, the timeline is numeric, and dependencies can stay legacy-simple or become fully typed.',
    items: [
      '<code>GanttScene</code> owns <code>tasks</code>, <code>rowLabels</code>, <code>timelineStart</code>, and <code>timelineEnd</code>.',
      '<code>GanttTask</code> stores numeric UTC day serials for committed <code>start</code> and <code>end</code> values.',
      'Dependencies accept legacy task ids or typed refs with <code>FS</code>, <code>SS</code>, <code>FF</code>, and <code>SF</code>.',
      'Runtime task methods accept <code>number</code>, ISO strings, or <code>Date</code> inputs through <code>GanttRuntimeTaskInput</code>.',
    ],
  },
  {
    id: 'api-config',
    eyebrow: 'Config',
    title: 'Compose rendering, editing, and plugins from one config object.',
    copy: 'The exported <code>GanttConfig</code> type is the single setup point for scene creation, UI chrome, edit behavior, extension loading, and host policy.',
    items: [
      '<code>data</code> supports <code>sample</code>, <code>static</code>, and async <code>factory</code> scene sources.',
      '<code>ui</code>, <code>container</code>, <code>render</code>, <code>display</code>, and <code>font</code> shape the host shell and chart output.',
      '<code>edit</code> controls mode, drag, resize, snapping, and commit callbacks.',
      '<code>plugins</code>, <code>modules</code>, <code>features</code>, and <code>pluginSecurity</code> govern extension behavior and safety.',
    ],
  },
  {
    id: 'api-controller',
    eyebrow: 'Controller',
    title: 'Drive runtime changes without rebuilding the chart.',
    copy: 'The controller exposes the live scene, import/export helpers, selection state, edit operations, and camera utilities that the demo itself uses.',
    items: [
      'Task data methods: <code>getTask</code>, <code>getTasks</code>, <code>addTask</code>, <code>updateTask</code>, <code>deleteTask</code>, <code>deleteTasks</code>, <code>importTasks</code>, <code>exportTasks</code>.',
      'Selection methods: <code>getSelection</code>, <code>setSelectionByTaskId</code>, <code>setSelectionByDependencyId</code>, <code>setSelectionByTaskIds</code>.',
      'Camera methods: <code>panByScreenDelta</code>, <code>zoomAt</code>, <code>resetCamera</code>, <code>animateToZoomPresetId</code>, <code>animateCameraToTask</code>, <code>getZoomPresets</code>.',
      'Edit methods: <code>setInteractionMode</code>, <code>previewTaskEdit</code>, <code>commitActiveEdit</code>, <code>commitTaskEdits</code>, <code>cancelActiveEdit</code>.',
    ],
  },
  {
    id: 'api-plugins',
    eyebrow: 'Plugins',
    title: 'Extend through the safe API first.',
    copy: 'The plugin SDK re-exports the core types and adds <code>definePlugin()</code>. Most extensions only need the safe API surface.',
    items: [
      'Register style resolvers, overlays, scene transforms, canvas layers, UI commands, modules, and task edit resolvers from <code>safe</code>.',
      'Read snapshots with <code>getSceneSnapshot()</code>, <code>getCameraSnapshot()</code>, and <code>getSelection()</code>.',
      'Mutate committed data from plugins with the same runtime task helpers the controller uses.',
      "The advanced API only appears when the plugin declares <code>'advanced-api'</code>, the host enables <code>features.allowAdvancedPlugins</code>, and the plugin config sets <code>allowAdvanced: true</code>.",
    ],
    code: API_PLUGIN_SNIPPET,
    codeLabel: 'Plugin',
  },
];
const API_REFERENCE_GROUPS: ApiReferenceGroup[] = [
  {
    id: 'api-reference-host',
    eyebrow: 'Host Surface',
    title: 'Entry points, wrapper methods, and DOM handles.',
    copy: 'These are the top-level functions and wrapper members you reach before working through the controller.',
    methods: [
      {
        id: 'api-ref-create-gantt-host',
        kind: 'function',
        name: 'createGanttHost',
        signature: 'createGanttHost(root: HTMLElement, config?: GanttConfig): Promise<GanttHost>',
        description: 'Builds the host, resolves data, loads plugins and modules, sizes the canvas, and returns the wrapper once initialization is complete.',
        returns: 'A promise that resolves to a host wrapper with `dispose()` and `getController()`.',
        params: [
          { name: 'root', type: 'HTMLElement', description: 'Container element that will be replaced with the host shell and canvas.' },
          { name: 'config', type: 'GanttConfig | undefined', description: 'Optional host configuration for data, rendering, editing, plugins, modules, and policy.' },
        ],
      },
      {
        id: 'api-ref-start-app',
        kind: 'function',
        name: 'startApp',
        signature: 'startApp(root: HTMLElement): Promise<void>',
        description: 'Compatibility wrapper that boots the host with an empty config.',
        returns: 'A promise that resolves after `createGanttHost(root, {})` finishes.',
        params: [
          { name: 'root', type: 'HTMLElement', description: 'Container element for the default host boot path.' },
        ],
        notes: [
          'Use `createGanttHost()` instead when you need the controller or a dispose handle.',
        ],
      },
      {
        id: 'api-ref-dispose',
        kind: 'method',
        name: 'dispose',
        signature: 'dispose(): Promise<void>',
        description: 'Stops camera animation, runs registered cleanup callbacks, disposes modules and plugins, and clears the host root.',
        returns: 'A promise that resolves after teardown completes.',
      },
      {
        id: 'api-ref-get-controller',
        kind: 'method',
        name: 'getController',
        signature: 'getController(): GanttHostController',
        description: 'Returns the imperative controller for data, selection, editing, picking, and camera operations.',
        returns: 'The live `GanttHostController` instance for the mounted host.',
      },
      {
        id: 'api-ref-root',
        kind: 'property',
        name: 'root',
        signature: 'root: HTMLElement',
        description: 'The root element managed by the host shell.',
      },
      {
        id: 'api-ref-canvas',
        kind: 'property',
        name: 'canvas',
        signature: 'canvas: HTMLCanvasElement',
        description: 'The WebGL canvas used for gantt rendering and picking.',
      },
      {
        id: 'api-ref-hud',
        kind: 'property',
        name: 'hud',
        signature: 'hud: HTMLDivElement | null',
        description: 'Optional HUD mount created by host UI config and built-in modules.',
      },
      {
        id: 'api-ref-inspector',
        kind: 'property',
        name: 'inspector',
        signature: 'inspector: HTMLDivElement | null',
        description: 'Optional inspector mount created by the host shell.',
      },
      {
        id: 'api-ref-toolbar',
        kind: 'property',
        name: 'toolbar',
        signature: 'toolbar: HTMLDivElement | null',
        description: 'Optional toolbar container rendered by the host shell.',
      },
      {
        id: 'api-ref-status-line',
        kind: 'property',
        name: 'statusLine',
        signature: 'statusLine: HTMLDivElement | null',
        description: 'Optional status line element when the UI config enables it.',
      },
    ],
  },
  {
    id: 'api-reference-controller',
    eyebrow: 'Controller',
    title: 'Query and mutate committed runtime state.',
    copy: 'These methods expose the committed scene, render state, runtime import/export helpers, and host status.',
    notes: [
      'Task runtime methods validate inputs, normalize dates, and preserve task extras. `addTask()`, `updateTask()`, `deleteTask()`, `deleteTasks()`, and `importTasks()` throw on invalid input.',
      'Task lookups return cloned task objects. `getScene()` returns the committed scene object itself, so prefer the runtime helpers instead of mutating the scene in place.',
    ],
    methods: [
      {
        id: 'api-ref-get-scene',
        kind: 'method',
        name: 'getScene',
        signature: 'getScene(): GanttScene',
        description: 'Returns the current committed scene tracked by the host.',
        returns: 'The current `GanttScene` backing the host.',
      },
      {
        id: 'api-ref-get-task',
        kind: 'method',
        name: 'getTask',
        signature: 'getTask(taskId: string): GanttTask | null',
        description: 'Looks up one committed task by id.',
        returns: 'A cloned task when the id exists, otherwise `null`.',
        params: [
          { name: 'taskId', type: 'string', description: 'Task id to read from the committed scene.' },
        ],
      },
      {
        id: 'api-ref-get-tasks',
        kind: 'method',
        name: 'getTasks',
        signature: 'getTasks(): GanttTask[]',
        description: 'Returns all committed tasks sorted by row, start, end, and id.',
        returns: 'A cloned, sorted task array.',
      },
      {
        id: 'api-ref-add-task',
        kind: 'method',
        name: 'addTask',
        signature: 'addTask(input: GanttRuntimeTaskInput, options?: GanttRuntimeImportOptions): GanttTask',
        description: 'Adds one committed task from runtime-friendly date input.',
        returns: 'The added task as a clone.',
        params: [
          { name: 'input', type: 'GanttRuntimeTaskInput', description: 'Task payload with runtime date input for `start` and `end`.' },
          { name: 'options', type: 'GanttRuntimeImportOptions | undefined', description: 'Optional numeric date mode for number inputs.' },
        ],
        notes: [
          'The runtime end date is inclusive. Internally the scene stores an exclusive `end` value.',
        ],
      },
      {
        id: 'api-ref-update-task',
        kind: 'method',
        name: 'updateTask',
        signature: 'updateTask(taskId: string, patch: GanttRuntimeTaskPatch, options?: GanttRuntimeImportOptions): GanttTask',
        description: 'Applies a validated patch to one committed task.',
        returns: 'The updated task as a clone.',
        params: [
          { name: 'taskId', type: 'string', description: 'Task id to patch.' },
          { name: 'patch', type: 'GanttRuntimeTaskPatch', description: 'Partial task update. The task id cannot be changed.' },
          { name: 'options', type: 'GanttRuntimeImportOptions | undefined', description: 'Optional numeric date mode for number inputs.' },
        ],
      },
      {
        id: 'api-ref-delete-task',
        kind: 'method',
        name: 'deleteTask',
        signature: 'deleteTask(taskId: string): GanttTask',
        description: 'Removes one task from the committed scene.',
        returns: 'The removed task as a clone.',
        params: [
          { name: 'taskId', type: 'string', description: 'Task id to remove.' },
        ],
        notes: [
          'Dependencies pointing at the removed task are stripped from remaining tasks.',
        ],
      },
      {
        id: 'api-ref-delete-tasks',
        kind: 'method',
        name: 'deleteTasks',
        signature: 'deleteTasks(taskIds: string[]): GanttTask[]',
        description: 'Removes multiple tasks as one committed mutation.',
        returns: 'Removed tasks in request order.',
        params: [
          { name: 'taskIds', type: 'string[]', description: 'Unique task ids to remove.' },
        ],
        notes: [
          'The method rejects duplicate ids in the same delete request.',
        ],
      },
      {
        id: 'api-ref-import-tasks',
        kind: 'method',
        name: 'importTasks',
        signature: 'importTasks(inputs: GanttRuntimeTaskInput[], options?: GanttRuntimeImportOptions): { added: GanttTask[]; updated: GanttTask[] }',
        description: 'Adds new tasks and overwrites existing tasks by id in one batch.',
        returns: 'Separate arrays for newly added tasks and updated tasks.',
        params: [
          { name: 'inputs', type: 'GanttRuntimeTaskInput[]', description: 'Runtime task payloads to add or replace by id.' },
          { name: 'options', type: 'GanttRuntimeImportOptions | undefined', description: 'Optional numeric date mode for number inputs.' },
        ],
      },
      {
        id: 'api-ref-export-tasks',
        kind: 'method',
        name: 'exportTasks',
        signature: 'exportTasks(): GanttExportedTask[]',
        description: 'Exports committed tasks to normalized date strings and durations.',
        returns: 'A sorted array of `GanttExportedTask` objects with `startDate`, `endDate`, and `durationDays`.',
      },
      {
        id: 'api-ref-get-camera',
        kind: 'method',
        name: 'getCamera',
        signature: 'getCamera(): CameraState',
        description: 'Returns the current camera state used for rendering.',
        returns: 'The current camera object.',
      },
      {
        id: 'api-ref-get-index',
        kind: 'method',
        name: 'getIndex',
        signature: 'getIndex(): TaskIndex',
        description: 'Returns the current render index used by drawing and picking.',
        returns: 'The current `TaskIndex`, including preview or transform state when active.',
      },
      {
        id: 'api-ref-get-render-options',
        kind: 'method',
        name: 'getRenderOptions',
        signature: 'getRenderOptions(): FrameOptions',
        description: 'Returns the normalized frame/render options for the host.',
        returns: 'The active `FrameOptions` object.',
      },
      {
        id: 'api-ref-get-edit-config',
        kind: 'method',
        name: 'getEditConfig',
        signature: 'getEditConfig(): NormalizedGanttEditConfig',
        description: 'Returns the normalized edit config after defaults have been merged.',
        returns: 'The active normalized edit config.',
      },
      {
        id: 'api-ref-get-renderer',
        kind: 'method',
        name: 'getRenderer',
        signature: 'getRenderer(): unknown',
        description: 'Exposes the renderer instance behind the host.',
        returns: 'The renderer object used by the host.',
      },
      {
        id: 'api-ref-get-gl',
        kind: 'method',
        name: 'getGl',
        signature: 'getGl(): WebGL2RenderingContext',
        description: 'Returns the host WebGL2 context.',
        returns: 'The active `WebGL2RenderingContext`.',
      },
      {
        id: 'api-ref-get-current-frame',
        kind: 'method',
        name: 'getCurrentFrame',
        signature: 'getCurrentFrame(): FrameScene | null',
        description: 'Returns the last rendered frame buffers and dependency paths.',
        returns: 'The latest `FrameScene`, or `null` before the first completed frame.',
      },
      {
        id: 'api-ref-get-last-frame-ms',
        kind: 'method',
        name: 'getLastFrameMs',
        signature: 'getLastFrameMs(): number',
        description: 'Returns the duration of the most recent frame draw.',
        returns: 'A frame time in milliseconds.',
      },
      {
        id: 'api-ref-get-visible-window',
        kind: 'method',
        name: 'getVisibleWindow',
        signature: 'getVisibleWindow(): ViewWindow',
        description: 'Computes the currently visible time window from the camera.',
        returns: 'A `{ start, end }` range in day serials.',
      },
      {
        id: 'api-ref-get-interaction-state',
        kind: 'method',
        name: 'getInteractionState',
        signature: 'getInteractionState(): GanttInteractionState',
        description: 'Returns the current mode plus any active edit snapshot.',
        returns: 'The current interaction state.',
      },
      {
        id: 'api-ref-is-task-edit-pending',
        kind: 'method',
        name: 'isTaskEditPending',
        signature: 'isTaskEditPending(): boolean',
        description: 'Reports whether an edit commit is currently in flight.',
        returns: '`true` when the active edit is in `committing` state.',
      },
      {
        id: 'api-ref-request-render',
        kind: 'method',
        name: 'requestRender',
        signature: 'requestRender(): void',
        description: 'Invalidates render caches and schedules the next animation-frame draw.',
      },
      {
        id: 'api-ref-set-status-text',
        kind: 'method',
        name: 'setStatusText',
        signature: 'setStatusText(text: string): void',
        description: 'Replaces the status line text when a status line is mounted.',
        params: [
          { name: 'text', type: 'string', description: 'Status copy to display.' },
        ],
      },
      {
        id: 'api-ref-replace-scene',
        kind: 'method',
        name: 'replaceScene',
        signature: 'replaceScene(scene: GanttScene): void',
        description: 'Replaces the entire committed scene and recomputes indices, dependents, and selection references.',
        params: [
          { name: 'scene', type: 'GanttScene', description: 'Next committed scene to install.' },
        ],
      },
      {
        id: 'api-ref-register-cleanup',
        kind: 'method',
        name: 'registerCleanup',
        signature: 'registerCleanup(callback: () => void): void',
        description: 'Registers custom teardown work that runs during host disposal.',
        params: [
          { name: 'callback', type: '() => void', description: 'Cleanup callback invoked during `dispose()`.' },
        ],
      },
      {
        id: 'api-ref-get-selection',
        kind: 'method',
        name: 'getSelection',
        signature: 'getSelection(): PluginSelectionState',
        description: 'Returns the current selection and hover state for tasks and dependencies.',
        returns: 'The current selection snapshot.',
      },
      {
        id: 'api-ref-get-zoom-preset-id',
        kind: 'method',
        name: 'getZoomPresetIdForVisibleWindow',
        signature: 'getZoomPresetIdForVisibleWindow(): string | null',
        description: 'Matches the current visible range to the closest built-in zoom preset.',
        returns: 'A preset id such as `day`, `week`, `month`, `quarter`, or `year`, or `null` when no preset is close enough.',
      },
      {
        id: 'api-ref-get-zoom-presets',
        kind: 'method',
        name: 'getZoomPresets',
        signature: 'getZoomPresets(): Array<{ id: string; label: string; visibleDays: number }>',
        description: 'Returns the built-in preset list used by the host toolbar and zoom animations.',
        returns: 'The built-in zoom preset descriptors.',
      },
    ],
  },
  {
    id: 'api-reference-selection',
    eyebrow: 'Selection And Picking',
    title: 'Select tasks, target dependency paths, preview ranges, and pick from screen space.',
    copy: 'These methods come from the host interaction layer and are the main selection and picking entry points exposed on the controller.',
    notes: [
      'Screen coordinates are canvas-local pixel coordinates, not world-space day or row values.',
      'Dependency selection works against rendered dependency path ids from the current frame.',
    ],
    methods: [
      {
        id: 'api-ref-set-selection-by-task-id',
        kind: 'method',
        name: 'setSelectionByTaskId',
        signature: 'setSelectionByTaskId(taskId: string | null): void',
        description: 'Sets the primary selection to one task or clears selection when `null` is passed.',
        params: [
          { name: 'taskId', type: 'string | null', description: 'Task id to select, or `null` to clear task/dependency selection.' },
        ],
      },
      {
        id: 'api-ref-set-selection-by-dependency-id',
        kind: 'method',
        name: 'setSelectionByDependencyId',
        signature: 'setSelectionByDependencyId(dependencyId: string | null): void',
        description: 'Targets one rendered dependency path by id or clears selection.',
        params: [
          { name: 'dependencyId', type: 'string | null', description: 'Rendered dependency path id from `getCurrentFrame().dependencyPaths`, or `null` to clear selection.' },
        ],
      },
      {
        id: 'api-ref-set-selection-by-task-ids',
        kind: 'method',
        name: 'setSelectionByTaskIds',
        signature: 'setSelectionByTaskIds(taskIds: string[], primaryTaskId?: string | null): void',
        description: 'Sets a multi-task selection and optionally pins a primary task.',
        params: [
          { name: 'taskIds', type: 'string[]', description: 'Task ids to keep selected. Invalid or duplicate ids are ignored.' },
          { name: 'primaryTaskId', type: 'string | null | undefined', description: 'Optional primary task id. Falls back to the first valid id in the list.' },
        ],
      },
      {
        id: 'api-ref-set-selection-by-screen-point',
        kind: 'method',
        name: 'setSelectionByScreenPoint',
        signature: 'setSelectionByScreenPoint(x: number, y: number): void',
        description: 'Picks a task or dependency under one canvas-local screen point and sets selection from that hit test.',
        params: [
          { name: 'x', type: 'number', description: 'Canvas-local screen x coordinate in pixels.' },
          { name: 'y', type: 'number', description: 'Canvas-local screen y coordinate in pixels.' },
        ],
      },
      {
        id: 'api-ref-preview-selection-by-task-ids',
        kind: 'method',
        name: 'previewSelectionByTaskIds',
        signature: 'previewSelectionByTaskIds(taskIds: string[], primaryTaskId?: string | null): void',
        description: 'Shows a temporary multi-task selection preview without replacing the committed selection.',
        params: [
          { name: 'taskIds', type: 'string[]', description: 'Task ids to preview.' },
          { name: 'primaryTaskId', type: 'string | null | undefined', description: 'Optional primary preview task id.' },
        ],
        notes: [
          'Selection preview is visual state only and is cleared by `clearSelectionPreview()` or several normal selection/edit transitions.',
        ],
      },
      {
        id: 'api-ref-clear-selection-preview',
        kind: 'method',
        name: 'clearSelectionPreview',
        signature: 'clearSelectionPreview(): void',
        description: 'Clears any active selection preview and redraws if needed.',
      },
      {
        id: 'api-ref-update-hover-from-screen',
        kind: 'method',
        name: 'updateHoverFromScreen',
        signature: 'updateHoverFromScreen(x: number, y: number): void',
        description: 'Updates hovered task or dependency state from one canvas-local screen point.',
        params: [
          { name: 'x', type: 'number', description: 'Canvas-local screen x coordinate in pixels.' },
          { name: 'y', type: 'number', description: 'Canvas-local screen y coordinate in pixels.' },
        ],
      },
      {
        id: 'api-ref-pick-task-at-screen',
        kind: 'method',
        name: 'pickTaskAtScreen',
        signature: 'pickTaskAtScreen(x: number, y: number): GanttTask | null',
        description: 'Returns the task under one canvas-local screen point.',
        returns: 'A task when the point hits a bar or milestone, otherwise `null`.',
        params: [
          { name: 'x', type: 'number', description: 'Canvas-local screen x coordinate in pixels.' },
          { name: 'y', type: 'number', description: 'Canvas-local screen y coordinate in pixels.' },
        ],
      },
      {
        id: 'api-ref-pick-tasks-in-screen-rect',
        kind: 'method',
        name: 'pickTasksInScreenRect',
        signature: 'pickTasksInScreenRect(x0: number, y0: number, x1: number, y1: number): GanttTask[]',
        description: 'Returns tasks intersecting a screen-space rectangle.',
        returns: 'All tasks hit by the rectangle in current render state.',
        params: [
          { name: 'x0', type: 'number', description: 'First screen-space x coordinate.' },
          { name: 'y0', type: 'number', description: 'First screen-space y coordinate.' },
          { name: 'x1', type: 'number', description: 'Second screen-space x coordinate.' },
          { name: 'y1', type: 'number', description: 'Second screen-space y coordinate.' },
        ],
      },
      {
        id: 'api-ref-pick-dependency-at-screen',
        kind: 'method',
        name: 'pickDependencyAtScreen',
        signature: 'pickDependencyAtScreen(x: number, y: number): DependencyPath | null',
        description: 'Returns the rendered dependency path under one screen point.',
        returns: 'A `DependencyPath` from the current frame, otherwise `null`.',
        params: [
          { name: 'x', type: 'number', description: 'Canvas-local screen x coordinate in pixels.' },
          { name: 'y', type: 'number', description: 'Canvas-local screen y coordinate in pixels.' },
        ],
      },
    ],
  },
  {
    id: 'api-reference-editing',
    eyebrow: 'Editing',
    title: 'Preview, commit, cancel, and inspect edit state.',
    copy: 'These methods expose the host edit lifecycle that powers drag, resize, and programmatic edit flows.',
    notes: [
      'Preview methods return `null` when editing is disabled, a commit is already pending, no valid events remain after resolvers, or a resolver rejects the edit.',
      'Commit methods return `false` when there is no active edit, a resolver rejects the final event set, the configured commit callback returns `false`, or the callback throws.',
    ],
    methods: [
      {
        id: 'api-ref-set-interaction-mode',
        kind: 'method',
        name: 'setInteractionMode',
        signature: 'setInteractionMode(mode: GanttInteractionMode): void',
        description: 'Switches between `view`, `select`, and `edit` modes.',
        params: [
          { name: 'mode', type: 'GanttInteractionMode', description: 'Requested interaction mode.' },
        ],
        notes: [
          'Requesting `edit` falls back to `view` when editing is disabled.',
          'Leaving edit mode cancels preview edits. Leaving select mode clears selection preview.',
        ],
      },
      {
        id: 'api-ref-cancel-active-edit',
        kind: 'method',
        name: 'cancelActiveEdit',
        signature: 'cancelActiveEdit(): void',
        description: 'Cancels the current preview edit batch and fires cancel hooks.',
      },
      {
        id: 'api-ref-preview-task-edit',
        kind: 'method',
        name: 'previewTaskEdit',
        signature: 'previewTaskEdit(event: GanttTaskEditEvent): GanttTaskEditEvent | null',
        description: 'Runs one edit event through edit resolvers and installs it as the active preview.',
        returns: 'The resolved edit event, or `null` when preview cannot start.',
        params: [
          { name: 'event', type: 'GanttTaskEditEvent', description: 'Edit event to preview.' },
        ],
      },
      {
        id: 'api-ref-preview-task-edits',
        kind: 'method',
        name: 'previewTaskEdits',
        signature: 'previewTaskEdits(events: GanttTaskEditEvent[]): GanttTaskEditEvent[] | null',
        description: 'Previews a batch of task edit events as one edit session.',
        returns: 'Resolved edit events for the batch, or `null` when preview is rejected.',
        params: [
          { name: 'events', type: 'GanttTaskEditEvent[]', description: 'Edit events to resolve and preview together.' },
        ],
        notes: [
          'The first event determines the primary edited task when no later event matches that task id.',
        ],
      },
      {
        id: 'api-ref-commit-active-edit',
        kind: 'method',
        name: 'commitActiveEdit',
        signature: 'commitActiveEdit(event?: GanttTaskEditEvent | null): Promise<boolean>',
        description: 'Commits the current active edit, optionally replacing the primary event used for the commit.',
        returns: 'A promise resolving to `true` on success, otherwise `false`.',
        params: [
          { name: 'event', type: 'GanttTaskEditEvent | null | undefined', description: 'Optional replacement event for the active primary edit.' },
        ],
      },
      {
        id: 'api-ref-commit-task-edits',
        kind: 'method',
        name: 'commitTaskEdits',
        signature: 'commitTaskEdits(events?: GanttTaskEditEvent[] | null): Promise<boolean>',
        description: 'Commits a batch of edit events, running resolvers and the configured commit callback before replacing committed tasks.',
        returns: 'A promise resolving to `true` when the commit succeeds, otherwise `false`.',
        params: [
          { name: 'events', type: 'GanttTaskEditEvent[] | null | undefined', description: 'Optional replacement batch. When omitted, the host commits the active preview batch.' },
        ],
      },
    ],
  },
  {
    id: 'api-reference-camera',
    eyebrow: 'Camera',
    title: 'Resize, pan, zoom, and animate the viewport.',
    copy: 'These methods expose the host camera controls used by the toolbar and interactive navigation.',
    methods: [
      {
        id: 'api-ref-stop-camera-animation',
        kind: 'method',
        name: 'stopCameraAnimation',
        signature: 'stopCameraAnimation(): void',
        description: 'Stops any in-flight camera animation started by zoom presets or task focus animation.',
      },
      {
        id: 'api-ref-sync-canvas-size',
        kind: 'method',
        name: 'syncCanvasSize',
        signature: 'syncCanvasSize(): void',
        description: 'Recomputes canvas backing size from the host surface rect and updates the WebGL viewport.',
        notes: [
          'The host caps device pixel ratio at 2 when sizing the canvas.',
        ],
      },
      {
        id: 'api-ref-pan-by-screen-delta',
        kind: 'method',
        name: 'panByScreenDelta',
        signature: 'panByScreenDelta(dx: number, dy: number): void',
        description: 'Pans the camera by screen-space pixel deltas.',
        params: [
          { name: 'dx', type: 'number', description: 'Horizontal delta in screen pixels.' },
          { name: 'dy', type: 'number', description: 'Vertical delta in screen pixels.' },
        ],
      },
      {
        id: 'api-ref-zoom-at',
        kind: 'method',
        name: 'zoomAt',
        signature: 'zoomAt(zoomFactor: number, anchorX: number, anchorY: number): void',
        description: 'Applies a multiplicative zoom around one screen-space anchor point.',
        params: [
          { name: 'zoomFactor', type: 'number', description: 'Multiplier applied to the current zoom level.' },
          { name: 'anchorX', type: 'number', description: 'Screen-space x anchor in pixels.' },
          { name: 'anchorY', type: 'number', description: 'Screen-space y anchor in pixels.' },
        ],
        notes: [
          'Horizontal zoom changes. Vertical zoom stays fixed at the host level.',
        ],
      },
      {
        id: 'api-ref-reset-camera',
        kind: 'method',
        name: 'resetCamera',
        signature: 'resetCamera(): void',
        description: 'Returns the camera to the default home view for the current committed scene.',
        notes: [
          'Home view starts slightly before `scene.timelineStart` and targets a 28-day visible range when tasks exist.',
        ],
      },
      {
        id: 'api-ref-animate-to-zoom-preset-id',
        kind: 'method',
        name: 'animateToZoomPresetId',
        signature: 'animateToZoomPresetId(presetId: string): void',
        description: 'Animates to one of the built-in zoom presets.',
        params: [
          { name: 'presetId', type: 'string', description: 'Preset id such as `day`, `week`, `month`, `quarter`, or `year`.' },
        ],
        notes: [
          'Unknown preset ids are ignored.',
        ],
      },
      {
        id: 'api-ref-animate-camera-to-task',
        kind: 'method',
        name: 'animateCameraToTask',
        signature: 'animateCameraToTask(task: GanttTask): void',
        description: 'Animates the camera to frame one task plus its immediate dependencies and dependents.',
        params: [
          { name: 'task', type: 'GanttTask', description: 'Task to focus in the viewport.' },
        ],
      },
    ],
  },
  {
    id: 'api-reference-plugin-safe',
    eyebrow: 'Plugin Safe API',
    title: 'Canvas, scene, selection, and runtime task hooks for plugins.',
    copy: 'The safe plugin API is the main extension surface. It exposes registration hooks plus a curated subset of controller behavior.',
    notes: [
      'Registration methods return unregister functions. Drawing-related registrations request a rerender when added or removed.',
      'Safe task and selection methods mirror controller semantics. They keep plugin code out of direct renderer and WebGL internals.',
    ],
    methods: [
      {
        id: 'api-ref-safe-register-task-style-resolver',
        kind: 'method',
        name: 'safe.registerTaskStyleResolver',
        signature: 'registerTaskStyleResolver(resolver: TaskStyleResolver): () => void',
        description: 'Registers a task style resolver that can override bar fill and emphasis per task.',
        returns: 'An unregister function.',
      },
      {
        id: 'api-ref-safe-register-overlay',
        kind: 'method',
        name: 'safe.registerOverlay',
        signature: 'registerOverlay(overlay: OverlayRenderer): () => void',
        description: 'Registers a DOM overlay callback that runs after frame rendering.',
        returns: 'An unregister function.',
      },
      {
        id: 'api-ref-safe-register-scene-transform',
        kind: 'method',
        name: 'safe.registerSceneTransform',
        signature: 'registerSceneTransform(transform: GanttSceneTransform): () => void',
        description: 'Registers a transform that can derive a render scene without rewriting the committed scene.',
        returns: 'An unregister function.',
      },
      {
        id: 'api-ref-safe-register-canvas-layer',
        kind: 'method',
        name: 'safe.registerCanvasLayer',
        signature: 'registerCanvasLayer(layer: GanttCanvasLayer): () => void',
        description: 'Registers a custom canvas drawing layer with optional hit regions and pointer handling.',
        returns: 'An unregister function.',
      },
      {
        id: 'api-ref-safe-register-ui-command',
        kind: 'method',
        name: 'safe.registerUiCommand',
        signature: 'registerUiCommand(command: UiCommand): () => void',
        description: 'Registers a command that built-in UI can surface in host controls.',
        returns: 'An unregister function.',
      },
      {
        id: 'api-ref-safe-register-module',
        kind: 'method',
        name: 'safe.registerModule',
        signature: 'registerModule(module: GanttModule): () => void',
        description: 'Registers a host module with lifecycle hooks and host access.',
        returns: 'An unregister function.',
      },
      {
        id: 'api-ref-safe-register-task-edit-resolver',
        kind: 'method',
        name: 'safe.registerTaskEditResolver',
        signature: 'registerTaskEditResolver(resolver: GanttTaskEditResolver): () => void',
        description: 'Registers an edit resolver that can adjust or reject previewed edit events.',
        returns: 'An unregister function.',
      },
      {
        id: 'api-ref-safe-request-render',
        kind: 'method',
        name: 'safe.requestRender',
        signature: 'requestRender(): void',
        description: 'Requests a host rerender. Same behavior as `controller.requestRender()`.',
      },
      {
        id: 'api-ref-safe-get-scene-snapshot',
        kind: 'method',
        name: 'safe.getSceneSnapshot',
        signature: 'getSceneSnapshot(): Readonly<GanttScene>',
        description: 'Returns the current scene snapshot exposed to the plugin runtime.',
      },
      {
        id: 'api-ref-safe-task-methods',
        kind: 'method',
        name: 'safe task methods',
        signature: 'getTask(), getTasks(), addTask(), updateTask(), deleteTask(), deleteTasks(), importTasks(), exportTasks()',
        description: 'Task data methods mirror the controller runtime task surface and validation behavior.',
        notes: [
          '`getTask()` and `getTasks()` read committed data.',
          '`addTask()`, `updateTask()`, `deleteTask()`, `deleteTasks()`, and `importTasks()` mutate committed data.',
          '`exportTasks()` returns normalized export objects with ISO date strings.',
        ],
      },
      {
        id: 'api-ref-safe-get-camera-snapshot',
        kind: 'method',
        name: 'safe.getCameraSnapshot',
        signature: 'getCameraSnapshot(): Readonly<CameraState>',
        description: 'Returns the current camera snapshot for plugin logic.',
      },
      {
        id: 'api-ref-safe-selection-methods',
        kind: 'method',
        name: 'safe selection methods',
        signature: 'getSelection(), setSelectionByTaskId(), setSelectionByDependencyId(), setSelectionByTaskIds()',
        description: 'Selection methods mirror the controller selection surface for plugins.',
      },
      {
        id: 'api-ref-safe-interaction-methods',
        kind: 'method',
        name: 'safe interaction methods',
        signature: 'getInteractionState(), setInteractionMode()',
        description: 'Interaction methods mirror controller mode inspection and mode switching.',
      },
      {
        id: 'api-ref-safe-logger',
        kind: 'method',
        name: 'safe.logger',
        signature: 'logger.info(message, details?), logger.warn(message, details?), logger.error(message, details?)',
        description: 'Console-backed logger exposed to plugin code.',
      },
    ],
  },
  {
    id: 'api-reference-plugin-advanced',
    eyebrow: 'Plugin Advanced API',
    title: 'Opt-in renderer and WebGL internals.',
    copy: 'The advanced API exists for plugins that need lower-level host internals.',
    notes: [
      'A plugin only receives `advanced` when it declares the `advanced-api` capability, host config enables `features.allowAdvancedPlugins`, and that plugin config sets `allowAdvanced: true`.',
    ],
    methods: [
      {
        id: 'api-ref-advanced-request-render',
        kind: 'method',
        name: 'advanced.requestRender',
        signature: 'requestRender(): void',
        description: 'Requests a host rerender from advanced plugin code.',
      },
      {
        id: 'api-ref-advanced-get-internals',
        kind: 'method',
        name: 'advanced.getInternals',
        signature: 'getInternals(): { index: TaskIndex; renderer: unknown; gl: WebGL2RenderingContext }',
        description: 'Returns the current task index, renderer instance, and WebGL2 context.',
        returns: 'Low-level host internals for advanced plugins.',
      },
    ],
  },
];

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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function renderApiCodeBlock(code: string, label = 'TypeScript'): string {
  return `
    <div class="api-doc-code">
      <div class="api-doc-code__header">
        <span>${label}</span>
        <span>API docs</span>
      </div>
      <pre><code>${escapeHtml(code)}</code></pre>
    </div>
  `;
}

function renderApiDocCard(card: ApiDocCard): string {
  return `
    <article class="api-doc-card" id="${card.id}">
      <p class="api-doc-card__eyebrow">${card.eyebrow}</p>
      <h3 class="api-doc-card__title">${card.title}</h3>
      <p class="api-doc-card__copy">${card.copy}</p>
      <ul class="api-doc-card__list">
        ${card.items.map((item) => `<li>${item}</li>`).join('')}
      </ul>
      ${card.code ? renderApiCodeBlock(card.code, card.codeLabel) : ''}
    </article>
  `;
}

function renderApiReferenceEntry(entry: ApiReferenceEntry): string {
  return `
    <article class="api-reference-entry" id="${entry.id}">
      <div class="api-reference-entry__header">
        <span class="api-reference-entry__kind">${entry.kind}</span>
        <h4 class="api-reference-entry__title">${entry.name}</h4>
      </div>
      <pre class="api-reference-entry__signature"><code>${escapeHtml(entry.signature)}</code></pre>
      <p class="api-reference-entry__copy">${entry.description}</p>
      ${entry.params?.length
        ? `
      <dl class="api-reference-params">
        ${entry.params.map((param) => `
          <div class="api-reference-params__row">
            <dt><code>${escapeHtml(param.name)}</code> <span>${escapeHtml(param.type)}</span></dt>
            <dd>${param.description}</dd>
          </div>
        `).join('')}
      </dl>
      `
        : ''}
      ${entry.returns
        ? `<p class="api-reference-entry__returns"><strong>Returns</strong> ${entry.returns}</p>`
        : ''}
      ${entry.notes?.length
        ? `
      <ul class="api-reference-entry__notes">
        ${entry.notes.map((note) => `<li>${note}</li>`).join('')}
      </ul>
      `
        : ''}
    </article>
  `;
}

function renderApiReferenceGroup(group: ApiReferenceGroup): string {
  return `
    <section class="api-reference-group" id="${group.id}">
      <div class="api-reference-group__intro">
        <p class="api-reference-group__eyebrow">${group.eyebrow}</p>
        <h3 class="api-reference-group__title">${group.title}</h3>
        <p class="api-reference-group__copy">${group.copy}</p>
      </div>
      ${group.notes?.length
        ? `
      <ul class="api-reference-group__notes">
        ${group.notes.map((note) => `<li>${note}</li>`).join('')}
      </ul>
      `
        : ''}
      <div class="api-reference-group__entries">
        ${group.methods.map((entry) => renderApiReferenceEntry(entry)).join('')}
      </div>
    </section>
  `;
}

function buildApiDocsSection(): string {
  return `
    <section class="demo-section reveal" id="api" style="--delay: 380ms;">
      <div class="demo-copy">
        <p class="section-label">API</p>
        <h2>Instantiate, control, extend.</h2>
        <p>The demo page now carries method-by-method reference docs for the current public surface in this repo: host boot, controller members, interaction helpers, camera controls, and the plugin APIs.</p>
        <div class="api-doc-pills" aria-label="API section quick links">
          <a class="api-doc-pill" href="#api-quickstart">Quick start</a>
          <a class="api-doc-pill" href="#api-reference-host">Host</a>
          <a class="api-doc-pill" href="#api-reference-controller">Controller</a>
          <a class="api-doc-pill" href="#api-reference-selection">Selection</a>
          <a class="api-doc-pill" href="#api-reference-editing">Editing</a>
          <a class="api-doc-pill" href="#api-reference-camera">Camera</a>
          <a class="api-doc-pill" href="#api-reference-plugin-safe">Plugins</a>
        </div>
      </div>
      <div class="api-docs-shell">
        <article class="api-doc-card api-doc-card--hero" id="api-quickstart">
          <div class="api-doc-card__intro">
            <p class="api-doc-card__eyebrow">Quick Start</p>
            <h3 class="api-doc-card__title">Create the host, then work through the controller.</h3>
            <p class="api-doc-card__copy">The chart boots from <code>createGanttHost()</code>. After that, runtime imports, selection updates, camera moves, and plugin state all flow through the controller.</p>
          </div>
          ${renderApiCodeBlock(API_QUICKSTART_SNIPPET)}
          <p class="api-doc-note">Use numeric day serials in committed <code>GanttScene</code> data, or pass ISO strings, <code>Date</code>, and numeric inputs through the runtime task helpers.</p>
        </article>
        <div class="api-doc-grid">
          ${API_DOC_CARDS.map((card) => renderApiDocCard(card)).join('')}
        </div>
        <div class="api-reference-stack">
          ${API_REFERENCE_GROUPS.map((group) => renderApiReferenceGroup(group)).join('')}
        </div>
      </div>
    </section>
  `;
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
        <div class="landing-topbar__actions">
          <a class="landing-button landing-button--secondary" href="#api">API Docs</a>
          <a class="landing-button landing-button--ghost" href="${REPO_URL}" target="_blank" rel="noreferrer">View Source</a>
        </div>
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

      ${buildApiDocsSection()}
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
