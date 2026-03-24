import type { GanttPlugin } from '@gantt/gantt-core';

export * from '@gantt/gantt-core';

export function definePlugin<TPlugin extends GanttPlugin>(plugin: TPlugin): TPlugin {
  return plugin;
}
