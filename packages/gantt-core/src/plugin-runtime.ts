import type { FrameScene, GanttScene } from './core';
import { loadPlugins } from './plugin-loader';
import {
  GANTT_PLUGIN_API_VERSION,
  type GanttAdvancedApi,
  type GanttInteractionMode,
  type GanttPlugin,
  type GanttPluginContext,
  type GanttTaskEditEvent,
  type GanttPluginInstance,
  type GanttSafeApi,
  type NormalizedGanttConfig,
  type PluginSelectionState,
} from './types';

type PluginRecord = {
  definition: GanttPlugin;
  instance: GanttPluginInstance;
};

export type PluginRuntimeHostApi = {
  safeApi: GanttSafeApi;
  advancedApi: GanttAdvancedApi;
  config: NormalizedGanttConfig;
  logger: {
    info: (message: string, details?: unknown) => void;
    warn: (message: string, details?: unknown) => void;
    error: (message: string, details?: unknown) => void;
  };
};

export class PluginRuntime {
  private readonly plugins: PluginRecord[] = [];

  constructor(private readonly hostApi: PluginRuntimeHostApi) {}

  async load(): Promise<void> {
    const loaded = await loadPlugins(this.hostApi.config.plugins, {
      apiVersion: GANTT_PLUGIN_API_VERSION,
      canLoadSource: this.hostApi.config.pluginSecurity.canLoadSource,
      onError: ({ pluginHint, source, error }) => {
        this.hostApi.logger.error(`Failed to load plugin: ${pluginHint}`, { source, error });
      },
    });

    for (const loadedPlugin of loaded) {
      const { definition, config } = loadedPlugin;

      try {
        const wantsAdvanced = definition.meta.capabilities?.includes('advanced-api') ?? false;
        const advancedEnabled =
          wantsAdvanced &&
          this.hostApi.config.features.allowAdvancedPlugins &&
          config.allowAdvanced === true;

        if (wantsAdvanced && !advancedEnabled) {
          throw new Error(
            `Plugin ${definition.meta.id} requests advanced-api capability but host/plugin flags do not allow it.`,
          );
        }

        const context: GanttPluginContext = {
          safe: this.hostApi.safeApi,
          advanced: advancedEnabled ? this.hostApi.advancedApi : undefined,
          pluginConfig: config,
        };

        const instance = await definition.create(context);
        this.plugins.push({ definition, instance });
      } catch (error) {
        this.hostApi.logger.error(`Failed to initialize plugin: ${definition.meta.id}`, error);
      }
    }

  }

  async init(): Promise<void> {
    for (const plugin of this.plugins) {
      try {
        await plugin.instance.onInit?.();
        this.hostApi.logger.info(`Plugin initialized: ${plugin.definition.meta.id}@${plugin.definition.meta.version}`);
      } catch (error) {
        this.hostApi.logger.error(`Plugin onInit failed: ${plugin.definition.meta.id}`, error);
      }
    }
  }

  async applySceneHooks(scene: GanttScene): Promise<GanttScene> {
    let current = scene;

    for (const plugin of this.plugins) {
      try {
        const next = await plugin.instance.onSceneBuild?.(current);
        if (next) {
          current = next;
        }
      } catch (error) {
        this.hostApi.logger.error(`Plugin onSceneBuild failed: ${plugin.definition.meta.id}`, error);
      }
    }

    return current;
  }

  async applyFrameHooks(frame: FrameScene): Promise<FrameScene> {
    let current = frame;

    for (const plugin of this.plugins) {
      try {
        const next = await plugin.instance.onFrameBuild?.(current);
        if (next) {
          current = next;
        }
      } catch (error) {
        this.hostApi.logger.error(`Plugin onFrameBuild failed: ${plugin.definition.meta.id}`, error);
      }
    }

    return current;
  }

  async notifySelection(selection: PluginSelectionState): Promise<void> {
    for (const plugin of this.plugins) {
      try {
        await plugin.instance.onSelectionChange?.(selection);
      } catch (error) {
        this.hostApi.logger.error(`Plugin onSelectionChange failed: ${plugin.definition.meta.id}`, error);
      }
    }
  }

  private notifyLifecycle(
    hook: keyof Pick<
      GanttPluginInstance,
      'onEditModeChange' | 'onTaskEditStart' | 'onTaskEditPreview' | 'onTaskEditCommit' | 'onTaskEditCancel'
    >,
    payload: GanttInteractionMode | GanttTaskEditEvent,
  ): void {
    for (const plugin of this.plugins) {
      const handler = plugin.instance[hook];
      if (!handler) {
        continue;
      }

      Promise.resolve(handler(payload as never)).catch((error) => {
        this.hostApi.logger.error(`${String(hook)} failed: ${plugin.definition.meta.id}`, error);
      });
    }
  }

  notifyEditModeChange(mode: GanttInteractionMode): void {
    this.notifyLifecycle('onEditModeChange', mode);
  }

  notifyTaskEditStart(event: GanttTaskEditEvent): void {
    this.notifyLifecycle('onTaskEditStart', event);
  }

  notifyTaskEditPreview(event: GanttTaskEditEvent): void {
    this.notifyLifecycle('onTaskEditPreview', event);
  }

  notifyTaskEditCommit(event: GanttTaskEditEvent): void {
    this.notifyLifecycle('onTaskEditCommit', event);
  }

  notifyTaskEditCancel(event: GanttTaskEditEvent): void {
    this.notifyLifecycle('onTaskEditCancel', event);
  }

  async dispose(): Promise<void> {
    for (const plugin of [...this.plugins].reverse()) {
      try {
        await plugin.instance.onDispose?.();
      } catch (error) {
        this.hostApi.logger.error(`Plugin onDispose failed: ${plugin.definition.meta.id}`, error);
      }
    }

    this.plugins.length = 0;
  }
}
