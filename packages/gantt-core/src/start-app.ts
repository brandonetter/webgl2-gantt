import { createGanttHost } from './host';

export async function startApp(root: HTMLElement): Promise<void> {
  await createGanttHost(root, {});
}
