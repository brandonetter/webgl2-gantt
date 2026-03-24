import type { FrameScene } from './core';
import type { GanttModule, GanttModuleContext } from './types';

export class ModuleManager {
  private readonly modules = new Map<string, GanttModule>();

  register(module: GanttModule): () => void {
    this.modules.set(module.id, module);
    return () => {
      this.modules.delete(module.id);
    };
  }

  getAll(): GanttModule[] {
    return Array.from(this.modules.values());
  }

  async init(context: GanttModuleContext): Promise<void> {
    for (const module of this.modules.values()) {
      await module.onInit?.(context);
    }
  }

  beforeFrame(context: GanttModuleContext): void {
    for (const module of this.modules.values()) {
      module.onBeforeFrame?.(context);
    }
  }

  afterFrame(context: GanttModuleContext, frame: FrameScene): void {
    for (const module of this.modules.values()) {
      module.onAfterFrame?.(context, frame);
    }
  }

  async dispose(context: GanttModuleContext): Promise<void> {
    const list = this.getAll().reverse();
    for (const module of list) {
      await module.onDispose?.(context);
    }
    this.modules.clear();
  }
}
