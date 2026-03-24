function readOptions(rawOptions) {
  const options = rawOptions && typeof rawOptions === 'object' ? rawOptions : {};
  return {
    badgeLabel: typeof options.badgeLabel === 'string' ? options.badgeLabel : 'Safe Plugin',
    accentColor: typeof options.accentColor === 'string' ? options.accentColor : '#66d1ff',
  };
}

const safePlugin = {
  meta: {
    id: 'demo-safe-style',
    version: '1.0.0',
    apiRange: '^1.0.0',
  },
  create(context) {
    const options = readOptions(context.pluginConfig.options);
    let badge = null;
    let visibleTasks = 0;
    let selectedLabel = 'No task selected';
    const cleanups = [];

    function ensureBadge(root) {
      if (badge && badge.isConnected) {
        return badge;
      }

      badge = root.querySelector('.plugin-badge');
      if (badge) {
        return badge;
      }

      badge = document.createElement('aside');
      badge.className = 'plugin-badge';
      badge.innerHTML = `
        <p class="plugin-badge__title"></p>
        <p class="plugin-badge__metric"></p>
        <p class="plugin-badge__detail"></p>
      `;
      root.append(badge);
      return badge;
    }

    function renderBadge() {
      if (!badge) {
        return;
      }

      badge.style.setProperty('--plugin-accent', options.accentColor);
      const title = badge.querySelector('.plugin-badge__title');
      const metric = badge.querySelector('.plugin-badge__metric');
      const detail = badge.querySelector('.plugin-badge__detail');

      if (title) {
        title.textContent = options.badgeLabel;
      }
      if (metric) {
        metric.textContent = `${visibleTasks} visible tasks`;
      }
      if (detail) {
        detail.textContent = selectedLabel;
      }
    }

    return {
      onInit() {
        cleanups.push(
          context.safe.registerTaskStyleResolver(({ task, selected, hovered }) => {
            if (selected) {
              return { fill: [0.98, 0.52, 0.31, 0.98], emphasis: 1 };
            }
            if (hovered && task.rowIndex % 2 === 0) {
              return { fill: [0.29, 0.82, 0.7, 0.92], emphasis: 0.8 };
            }
            return null;
          }),
        );

        cleanups.push(
          context.safe.registerOverlay(({ root, frame }) => {
            visibleTasks = frame.stats.visibleTasks;
            ensureBadge(root);
            renderBadge();
          }),
        );
      },

      onSelectionChange(selection) {
        selectedLabel = selection.selectedTask
          ? `Selected: ${selection.selectedTask.label}`
          : selection.hoveredTask
            ? `Hover: ${selection.hoveredTask.label}`
            : 'No task selected';
        renderBadge();
      },

      onDispose() {
        for (const cleanup of cleanups.splice(0).reverse()) {
          cleanup();
        }

        if (badge) {
          badge.remove();
          badge = null;
        }
      },
    };
  },
};

export default safePlugin;
