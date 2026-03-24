import {
  GANTT_PLUGIN_API_VERSION,
  loadPluginDefinition,
  loadPlugins,
  validatePluginCompatibility,
  type GanttPlugin,
  type PluginLoaderEnv,
} from '@gantt/gantt-core';

function makePlugin(id: string, apiRange = '^1.0.0'): GanttPlugin {
  return {
    meta: {
      id,
      version: '1.0.0',
      apiRange,
    },
    create: () => ({}),
  };
}

describe('plugin loader', () => {
  it('loads ESM plugin definitions', async () => {
    const env: PluginLoaderEnv = {
      importModule: async () => ({ default: makePlugin('esm.plugin') }),
      loadScript: async () => undefined,
      readGlobal: () => undefined,
    };

    const plugin = await loadPluginDefinition(
      {
        source: {
          type: 'esm',
          url: 'https://example.com/plugin.mjs',
        },
      },
      env,
    );

    expect(plugin.meta.id).toBe('esm.plugin');
  });

  it('loads UMD plugin definitions', async () => {
    const env: PluginLoaderEnv = {
      importModule: async () => ({}),
      loadScript: async () => undefined,
      readGlobal: () => makePlugin('umd.plugin'),
    };

    const plugin = await loadPluginDefinition(
      {
        source: {
          type: 'umd',
          url: 'https://example.com/plugin.umd.js',
          global: 'DemoPlugin',
        },
      },
      env,
    );

    expect(plugin.meta.id).toBe('umd.plugin');
  });

  it('rejects incompatible API ranges', () => {
    const compatible = validatePluginCompatibility(makePlugin('good', `>=${GANTT_PLUGIN_API_VERSION} <2.0.0`));
    const incompatible = validatePluginCompatibility(makePlugin('bad', '<1.0.0'));

    expect(compatible.ok).toBe(true);
    expect(incompatible.ok).toBe(false);
  });

  it('isolates plugin load failures', async () => {
    const errors: string[] = [];
    const env: PluginLoaderEnv = {
      importModule: async (url) => {
        if (url.includes('bad')) {
          throw new Error('boom');
        }
        return { default: makePlugin('good') };
      },
      loadScript: async () => undefined,
      readGlobal: () => undefined,
    };

    const loaded = await loadPlugins(
      [
        {
          source: { type: 'esm', url: 'https://example.com/bad-plugin.mjs' },
        },
        {
          source: { type: 'esm', url: 'https://example.com/good-plugin.mjs' },
        },
      ],
      {
        env,
        onError: ({ pluginHint }) => {
          errors.push(pluginHint);
        },
      },
    );

    expect(errors.length).toBe(1);
    expect(loaded.length).toBe(1);
    expect(loaded[0].definition.meta.id).toBe('good');
  });
});
