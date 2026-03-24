import { GANTT_PLUGIN_API_VERSION, type GanttPlugin, type LoadedPlugin, type PluginConfig, type PluginSourceConfig } from './types';
import { satisfiesSemverRange } from './semver';

export type PluginLoaderEnv = {
  importModule: (url: string) => Promise<unknown>;
  loadScript: (url: string) => Promise<void>;
  readGlobal: (path: string) => unknown;
};

const dynamicImporter = new Function('u', 'return import(/* @vite-ignore */ u);') as (u: string) => Promise<unknown>;

function resolveGlobalPath(path: string): unknown {
  const parts = path.split('.');
  let cursor: unknown = globalThis;

  for (const part of parts) {
    if (!part) {
      continue;
    }
    if (cursor == null || typeof cursor !== 'object') {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }

  return cursor;
}

async function loadScriptTag(url: string): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error('UMD plugin loading requires a DOM environment.');
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load plugin script: ${url}`));
    document.head.appendChild(script);
  });
}

export const defaultPluginLoaderEnv: PluginLoaderEnv = {
  importModule: (url) => dynamicImporter(url),
  loadScript: (url) => loadScriptTag(url),
  readGlobal: (path) => resolveGlobalPath(path),
};

function isPluginDefinition(value: unknown): value is GanttPlugin {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<GanttPlugin>;
  return !!candidate.meta && typeof candidate.create === 'function';
}

export type PluginCompatibilityResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validatePluginCompatibility(plugin: GanttPlugin, apiVersion = GANTT_PLUGIN_API_VERSION): PluginCompatibilityResult {
  if (!satisfiesSemverRange(apiVersion, plugin.meta.apiRange)) {
    return {
      ok: false,
      reason: `Plugin ${plugin.meta.id}@${plugin.meta.version} requires API ${plugin.meta.apiRange} but host is ${apiVersion}`,
    };
  }

  return { ok: true };
}

export async function loadPluginDefinition(config: PluginConfig, env: PluginLoaderEnv = defaultPluginLoaderEnv): Promise<GanttPlugin> {
  if (config.source.type === 'esm') {
    const mod = await env.importModule(config.source.url);
    const exportName = config.source.exportName ?? 'default';
    const candidate = (mod as Record<string, unknown>)[exportName];
    if (!isPluginDefinition(candidate)) {
      throw new Error(`ESM plugin export '${exportName}' is not a valid plugin definition.`);
    }
    return candidate;
  }

  await env.loadScript(config.source.url);
  const candidate = env.readGlobal(config.source.global);
  if (!isPluginDefinition(candidate)) {
    throw new Error(`UMD global '${config.source.global}' is not a valid plugin definition.`);
  }
  return candidate;
}

export function pluginHint(config: PluginConfig): string {
  if (config.idHint) {
    return config.idHint;
  }
  return config.source.type === 'esm'
    ? config.source.url
    : `${config.source.url}#${config.source.global}`;
}

export async function loadPlugins(
  configs: PluginConfig[],
  options: {
    env?: PluginLoaderEnv;
    apiVersion?: string;
    canLoadSource?: (source: PluginSourceConfig) => boolean;
    onError?: (error: { pluginHint: string; source: PluginSourceConfig; error: unknown }) => void;
  } = {},
): Promise<LoadedPlugin[]> {
  const loaded: LoadedPlugin[] = [];

  for (const config of configs) {
    if (config.enabled === false) {
      continue;
    }

    const hint = pluginHint(config);

    try {
      if (options.canLoadSource && !options.canLoadSource(config.source)) {
        throw new Error(`Plugin source blocked by host policy: ${hint}`);
      }

      const definition = await loadPluginDefinition(config, options.env ?? defaultPluginLoaderEnv);
      const compatibility = validatePluginCompatibility(definition, options.apiVersion ?? GANTT_PLUGIN_API_VERSION);
      if (!compatibility.ok) {
        throw new Error(compatibility.reason);
      }

      loaded.push({ definition, config });
    } catch (error) {
      options.onError?.({
        pluginHint: hint,
        source: config.source,
        error,
      });
    }
  }

  return loaded;
}
