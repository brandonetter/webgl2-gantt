import {
  addTask,
  deleteTask,
  deleteTasks,
  exportTasks,
  getTask,
  getTasks,
  importTasks,
  updateTask,
} from '../packages/gantt-core/src/runtime-data';

function makeScene() {
  return {
    rowLabels: ['Row 1', 'Row 2'],
    timelineStart: 10,
    timelineEnd: 20,
    tasks: [
      { id: 'b', rowIndex: 1, start: 14, end: 18, label: 'Task B', dependencies: ['a'] },
      { id: 'a', rowIndex: 0, start: 10, end: 13, label: 'Task A' },
    ],
  };
}

describe('runtime task data helpers', () => {
  it('normalizes mixed date inputs and exports inclusive UTC date strings', () => {
    const emptyScene = { rowLabels: [], timelineStart: 0, timelineEnd: 0, tasks: [] };
    const start = new Date(Date.UTC(2026, 0, 5, 18, 30));
    const end = '2026-01-07T03:00:00Z';

    const added = addTask(emptyScene, {
      id: 'task-1',
      rowIndex: 2,
      start,
      end,
      label: 'Task 1',
      dependencies: [],
    });

    expect(added.task.start).toBe(Math.floor(Date.UTC(2026, 0, 5) / (24 * 60 * 60 * 1000)));
    expect(added.task.end).toBe(Math.floor(Date.UTC(2026, 0, 7) / (24 * 60 * 60 * 1000)) + 1);
    expect(added.scene.rowLabels).toEqual(['', '', '']);
    expect(exportTasks(added.scene)).toEqual([
      {
        id: 'task-1',
        rowIndex: 2,
        label: 'Task 1',
        milestone: false,
        dependencies: [],
        startDate: '2026-01-05',
        endDate: '2026-01-07',
        durationDays: 3,
      },
    ]);
  });

  it('supports numeric day serial and timestamp-ms input modes', () => {
    const emptyScene = { rowLabels: [], timelineStart: 0, timelineEnd: 0, tasks: [] };
    const byDaySerial = addTask(emptyScene, {
      id: 'day-task',
      rowIndex: 0,
      start: 100,
      end: 101,
      label: 'Day Task',
    });
    const byTimestamp = addTask(emptyScene, {
      id: 'time-task',
      rowIndex: 0,
      start: Date.UTC(2026, 0, 10, 22, 15),
      end: Date.UTC(2026, 0, 12, 2, 45),
      label: 'Timestamp Task',
    }, {
      numericDateMode: 'timestamp-ms',
    });

    expect(byDaySerial.task.start).toBe(100);
    expect(byDaySerial.task.end).toBe(102);
    expect(byTimestamp.task.start).toBe(Math.floor(Date.UTC(2026, 0, 10) / (24 * 60 * 60 * 1000)));
    expect(byTimestamp.task.end).toBe(Math.floor(Date.UTC(2026, 0, 12) / (24 * 60 * 60 * 1000)) + 1);
  });

  it('updates tasks as patches while preserving untouched fields', () => {
    const scene = makeScene();

    const result = updateTask(scene, 'a', {
      rowIndex: 3,
      end: '2026-01-18',
    });

    expect(result.task).toEqual({
      id: 'a',
      rowIndex: 3,
      start: 10,
      end: Math.floor(Date.UTC(2026, 0, 18) / (24 * 60 * 60 * 1000)) + 1,
      label: 'Task A',
      milestone: undefined,
      dependencies: undefined,
    });
    expect(result.scene.rowLabels).toEqual(['Row 1', 'Row 2', '', '']);
  });

  it('deletes tasks, removes dangling dependencies, and preserves row labels', () => {
    const scene = {
      rowLabels: ['Row 1', 'Row 2', 'Row 3'],
      timelineStart: 10,
      timelineEnd: 30,
      tasks: [
        { id: 'a', rowIndex: 0, start: 10, end: 12, label: 'Task A' },
        { id: 'b', rowIndex: 1, start: 13, end: 20, label: 'Task B', dependencies: ['a'] },
        { id: 'c', rowIndex: 2, start: 22, end: 30, label: 'Task C', dependencies: ['a', 'b'] },
      ],
    };

    const result = deleteTask(scene, 'a');

    expect(result.task.id).toBe('a');
    expect(result.scene.rowLabels).toEqual(['Row 1', 'Row 2', 'Row 3']);
    expect(result.scene.timelineStart).toBe(13);
    expect(result.scene.timelineEnd).toBe(30);
    expect(getTask(result.scene, 'b')).toEqual({
      id: 'b',
      rowIndex: 1,
      start: 13,
      end: 20,
      label: 'Task B',
      dependencies: undefined,
    });
    expect(getTask(result.scene, 'c')).toEqual({
      id: 'c',
      rowIndex: 2,
      start: 22,
      end: 30,
      label: 'Task C',
      dependencies: ['b'],
    });
  });

  it('deletes tasks atomically and rejects duplicate or missing ids', () => {
    const scene = makeScene();

    expect(() => deleteTasks(scene, ['a', 'a'])).toThrow("Task 'a' appears more than once in the delete request.");
    expect(() => deleteTasks(scene, ['a', 'missing'])).toThrow("Task 'missing' does not exist.");
  });

  it('upserts imported tasks and keeps read/export ordering stable', () => {
    const scene = makeScene();

    const result = importTasks(scene, [
      {
        id: 'a',
        rowIndex: 2,
        start: '2026-01-09',
        end: '2026-01-10',
        label: 'Task A Updated',
      },
      {
        id: 'c',
        rowIndex: 3,
        start: '2026-01-12',
        end: '2026-01-14',
        label: 'Task C',
      },
    ]);

    expect(result.updated.map((task) => task.id)).toEqual(['a']);
    expect(result.added.map((task) => task.id)).toEqual(['c']);
    expect(result.scene.rowLabels).toEqual(['Row 1', 'Row 2', '', '']);
    expect(getTasks(result.scene).map((task) => task.id)).toEqual(['b', 'a', 'c']);
    expect(exportTasks(result.scene).map((task) => task.id)).toEqual(['b', 'a', 'c']);
  });

  it('rejects invalid runtime payloads before applying mutations', () => {
    const scene = makeScene();

    expect(() => addTask(scene, {
      id: '',
      rowIndex: 0,
      start: '2026-01-01',
      end: '2026-01-01',
      label: 'Bad Task',
    })).toThrow("Task input.id must be a non-empty string.");
    expect(() => updateTask(scene, 'a', { id: 'different' } as never)).toThrow("Task patch for 'a' cannot change the task id.");
    expect(() => importTasks(scene, [
      {
        id: 'dup',
        rowIndex: 0,
        start: '2026-01-01',
        end: '2026-01-01',
        label: 'Dup 1',
      },
      {
        id: 'dup',
        rowIndex: 1,
        start: '2026-01-02',
        end: '2026-01-02',
        label: 'Dup 2',
      },
    ])).toThrow("Task 'dup' appears more than once in the import batch.");
    expect(() => addTask(scene, {
      id: 'typed-bad',
      rowIndex: 0,
      start: '2026-01-01',
      end: '2026-01-01',
      label: 'Bad Dependency',
      dependencies: [{ taskId: 'a', type: 'BAD' as never }],
    })).toThrow("Task input.dependencies[0].type must be one of FS, FF, SF, or SS when provided.");
  });

  it('imports, exports, and deletes mixed dependency refs', () => {
    const emptyScene = { rowLabels: [], timelineStart: 0, timelineEnd: 0, tasks: [] };
    const added = addTask(emptyScene, {
      id: 'target',
      rowIndex: 1,
      start: '2026-03-10',
      end: '2026-03-11',
      label: 'Target',
      dependencies: ['legacy-a', { taskId: 'typed-b', type: 'SS' }],
    });

    expect(added.task.dependencies).toEqual(['legacy-a', { taskId: 'typed-b', type: 'SS' }]);
    expect(exportTasks(added.scene)[0]?.dependencies).toEqual(['legacy-a', { taskId: 'typed-b', type: 'SS' }]);

    const scene = {
      rowLabels: ['Row 1', 'Row 2', 'Row 3'],
      timelineStart: 10,
      timelineEnd: 30,
      tasks: [
        { id: 'legacy-a', rowIndex: 0, start: 10, end: 12, label: 'Legacy A' },
        { id: 'typed-b', rowIndex: 1, start: 12, end: 16, label: 'Typed B' },
        { id: 'target', rowIndex: 2, start: 16, end: 20, label: 'Target', dependencies: ['legacy-a', { taskId: 'typed-b', type: 'FS' }] },
      ],
    };

    const deleted = deleteTask(scene, 'legacy-a');
    expect(getTask(deleted.scene, 'target')?.dependencies).toEqual([{ taskId: 'typed-b', type: 'FS' }]);
  });

  it('preserves custom top-level task fields across add, update, import, read, and export', () => {
    const emptyScene = { rowLabels: [], timelineStart: 0, timelineEnd: 0, tasks: [] };

    const added = addTask(emptyScene, {
      id: 'custom-1',
      rowIndex: 1,
      start: '2026-02-01',
      end: '2026-02-03',
      label: 'Custom Task',
      assignedTo: 'Ada',
      tags: ['frontend'],
      metadata: {
        priority: 'high',
        estimateDays: 3,
      },
    });

    expect(added.task).toMatchObject({
      assignedTo: 'Ada',
      tags: ['frontend'],
      metadata: {
        priority: 'high',
        estimateDays: 3,
      },
    });

    const updated = updateTask(added.scene, 'custom-1', {
      assignedTo: 'Grace',
      metadata: {
        priority: 'critical',
        estimateDays: 5,
      },
      status: 'blocked',
    });

    expect(updated.task).toMatchObject({
      assignedTo: 'Grace',
      tags: ['frontend'],
      metadata: {
        priority: 'critical',
        estimateDays: 5,
      },
      status: 'blocked',
    });

    const imported = importTasks(updated.scene, [
      {
        id: 'custom-1',
        rowIndex: 2,
        start: '2026-02-04',
        end: '2026-02-06',
        label: 'Custom Task Updated',
        assignedTo: 'June',
        tags: ['frontend', 'api'],
        metadata: {
          priority: 'normal',
          estimateDays: 3,
        },
        status: 'ready',
      },
      {
        id: 'custom-2',
        rowIndex: 3,
        start: '2026-02-07',
        end: '2026-02-08',
        label: 'Second Task',
        assignedTo: 'June',
        metadata: {
          priority: 'low',
        },
      },
    ]);

    expect(imported.updated[0]).toMatchObject({
      id: 'custom-1',
      assignedTo: 'June',
      tags: ['frontend', 'api'],
      metadata: {
        priority: 'normal',
        estimateDays: 3,
      },
      status: 'ready',
    });
    expect(getTask(imported.scene, 'custom-2')).toMatchObject({
      assignedTo: 'June',
      metadata: {
        priority: 'low',
      },
    });
    expect(exportTasks(imported.scene)[0]).toMatchObject({
      id: 'custom-1',
      assignedTo: 'June',
      tags: ['frontend', 'api'],
      metadata: {
        priority: 'normal',
        estimateDays: 3,
      },
      status: 'ready',
    });
  });

  it('preserves custom top-level task fields on delete results and surviving tasks', () => {
    const scene = {
      rowLabels: ['Row 1', 'Row 2'],
      timelineStart: 10,
      timelineEnd: 20,
      tasks: [
        { id: 'a', rowIndex: 0, start: 10, end: 12, label: 'Task A', assignedTo: 'Ada', metadata: { lane: 'A' } },
        { id: 'b', rowIndex: 1, start: 13, end: 20, label: 'Task B', dependencies: ['a'], assignedTo: 'Grace' },
      ],
    };

    const deleted = deleteTask(scene, 'a');

    expect(deleted.task).toMatchObject({
      assignedTo: 'Ada',
      metadata: { lane: 'A' },
    });
    expect(getTask(deleted.scene, 'b')).toMatchObject({
      assignedTo: 'Grace',
    });
  });
});
