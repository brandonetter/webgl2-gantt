import { vi } from 'vitest';

const createGanttHostMock = vi.hoisted(() => vi.fn(async () => ({
  dispose: async () => undefined,
  getController: () => ({}) as never,
})));

vi.mock('../packages/gantt-core/src/host', () => ({
  createGanttHost: createGanttHostMock,
}));

import { startApp } from '../packages/gantt-core/src/start-app';

describe('startApp compatibility wrapper', () => {
  it('calls createGanttHost with default config', async () => {
    const root = {} as HTMLElement;
    await startApp(root);

    expect(createGanttHostMock).toHaveBeenCalledTimes(1);
    expect(createGanttHostMock).toHaveBeenCalledWith(root, {});
  });
});
