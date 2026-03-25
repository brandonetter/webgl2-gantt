function readOptions(rawOptions) {
  const options = rawOptions && typeof rawOptions === 'object' ? rawOptions : {};
  return {
    paneWidth: typeof options.paneWidth === 'number' && Number.isFinite(options.paneWidth)
      ? Math.max(140, Math.min(260, Math.round(options.paneWidth)))
      : 176,
  };
}

function cloneTaskWithRow(task, rowIndex) {
  return {
    ...task,
    rowIndex,
    dependencies: Array.isArray(task.dependencies) ? task.dependencies.slice() : undefined,
  };
}

function compareTasks(left, right) {
  return (
    left.rowIndex - right.rowIndex ||
    left.start - right.start ||
    left.end - right.end ||
    String(left.id).localeCompare(String(right.id))
  );
}

function readAssignee(task) {
  return typeof task.assignedTo === 'string' && task.assignedTo.trim().length > 0
    ? task.assignedTo.trim()
    : 'Unassigned';
}

function projectScene(scene, collapsedGroups) {
  const groupsByName = new Map();

  for (const task of scene.tasks.slice().sort(compareTasks)) {
    const assignee = readAssignee(task);
    const group = groupsByName.get(assignee);
    if (group) {
      group.push(task);
    } else {
      groupsByName.set(assignee, [task]);
    }
  }

  const groupNames = Array.from(groupsByName.keys()).sort((left, right) => left.localeCompare(right));
  const nextTasks = [];
  const rowLabels = [];
  const groups = [];
  let nextRowIndex = 0;

  for (const name of groupNames) {
    const tasks = (groupsByName.get(name) ?? []).slice().sort(compareTasks);
    const collapsed = collapsedGroups.has(name);
    const rowStart = nextRowIndex;

    if (collapsed) {
      rowLabels.push(name);
      for (const task of tasks) {
        nextTasks.push(cloneTaskWithRow(task, rowStart));
      }
      nextRowIndex += 1;
    } else {
      for (let index = 0; index < tasks.length; index += 1) {
        rowLabels.push(index === 0 ? name : '');
        nextTasks.push(cloneTaskWithRow(tasks[index], nextRowIndex + index));
      }
      nextRowIndex += tasks.length;
    }

    groups.push({
      name,
      collapsed,
      rowStart,
      rowEnd: Math.max(rowStart, nextRowIndex - 1),
      taskCount: tasks.length,
    });
  }

  return {
    scene: {
      ...scene,
      tasks: nextTasks,
      rowLabels,
      timelineStart: scene.timelineStart,
      timelineEnd: scene.timelineEnd,
    },
    groups,
  };
}

const COLORS = {
  pane: [0.06, 0.09, 0.14, 0.94],
  paneBorder: [0.18, 0.24, 0.32, 0.95],
  paneHeader: [0.11, 0.16, 0.23, 0.98],
  rowIdle: [0.12, 0.18, 0.26, 0.72],
  rowHover: [0.2, 0.3, 0.43, 0.9],
  rowCollapsed: [0.82, 0.53, 0.26, 0.92],
  rowCollapsedSoft: [0.82, 0.53, 0.26, 0.16],
  rowExpandedSoft: [0.45, 0.72, 0.98, 0.08],
  title: [0.8, 0.88, 0.96, 0.92],
  text: [0.96, 0.98, 1, 0.96],
  subtle: [0.65, 0.74, 0.84, 0.82],
  shadow: [0, 0, 0, 0.4],
};

const assigneeGroupCollapsePlugin = {
  meta: {
    id: 'demo-assignee-group-collapse',
    version: '1.0.0',
    apiRange: '^1.4.0',
  },

  create(context) {
    const options = readOptions(context.pluginConfig.options);
    const cleanups = [];
    const collapsedGroups = new Set();
    let hoveredGroup = null;
    let projection = {
      scene: context.safe.getSceneSnapshot(),
      groups: [],
    };

    function requestRender() {
      context.safe.requestRender();
    }

    function toggleGroup(name) {
      if (collapsedGroups.has(name)) {
        collapsedGroups.delete(name);
      } else {
        collapsedGroups.add(name);
      }
      requestRender();
    }

    return {
      onInit() {
        cleanups.push(
          context.safe.registerSceneTransform((scene) => {
            projection = projectScene(scene, collapsedGroups);
            return projection.scene;
          }),
        );

        cleanups.push(
          context.safe.registerCanvasLayer(({ camera, render, visibleWindow, draw }) => {
            const paneWidth = options.paneWidth;
            const viewportHeight = camera.viewportHeight;

            draw.rect({
              space: 'screen',
              x: 0,
              y: 0,
              width: paneWidth,
              height: viewportHeight,
              color: COLORS.pane,
            });
            draw.rect({
              space: 'screen',
              x: 0,
              y: 0,
              width: paneWidth,
              height: render.headerHeight,
              color: COLORS.paneHeader,
            });
            draw.line({
              space: 'screen',
              x1: paneWidth - 1,
              y1: 0,
              x2: paneWidth - 1,
              y2: viewportHeight,
              color: COLORS.paneBorder,
              thickness: 1,
            });
            draw.line({
              space: 'screen',
              x1: 0,
              y1: render.headerHeight,
              x2: paneWidth,
              y2: render.headerHeight,
              color: COLORS.paneBorder,
              thickness: 1,
            });
            draw.text({
              space: 'screen',
              x: 16,
              y: render.headerHeight * 0.5 - 8,
              text: 'ASSIGNEES',
              fontPx: 11,
              color: COLORS.subtle,
              baseline: 'middle',
              shadowColor: COLORS.shadow,
            });
            draw.text({
              space: 'screen',
              x: 16,
              y: render.headerHeight * 0.5 + 9,
              text: 'Canvas extension',
              fontPx: 14,
              color: COLORS.title,
              baseline: 'middle',
              shadowColor: COLORS.shadow,
            });

            for (const group of projection.groups) {
              const worldTop = group.rowStart * render.rowPitch;
              const worldBottom = (group.rowEnd + 1) * render.rowPitch;
              const screenTop = (worldTop - camera.scrollY) * camera.zoomY;
              const screenBottom = (worldBottom - camera.scrollY) * camera.zoomY;
              if (screenBottom <= render.headerHeight || screenTop >= viewportHeight) {
                continue;
              }

              const bandTop = Math.max(render.headerHeight, screenTop);
              const bandBottom = Math.min(viewportHeight, screenBottom);
              const bandHeight = Math.max(1, bandBottom - bandTop);
              const isHovered = hoveredGroup === group.name;
              const rowColor = group.collapsed
                ? (isHovered ? COLORS.rowHover : COLORS.rowCollapsed)
                : (isHovered ? COLORS.rowHover : COLORS.rowIdle);
              const softBandColor = group.collapsed ? COLORS.rowCollapsedSoft : COLORS.rowExpandedSoft;

              draw.rect({
                space: 'world',
                x: visibleWindow.start,
                y: worldTop,
                width: visibleWindow.end - visibleWindow.start,
                height: worldBottom - worldTop,
                color: isHovered
                  ? [softBandColor[0], softBandColor[1], softBandColor[2], softBandColor[3] + 0.06]
                  : softBandColor,
              });
              draw.rect({
                space: 'screen',
                x: 0,
                y: bandTop,
                width: paneWidth - 1,
                height: bandHeight,
                color: rowColor,
              });
              draw.text({
                space: 'screen',
                x: 16,
                y: bandTop + bandHeight * 0.5,
                text: group.name,
                fontPx: 13,
                color: COLORS.text,
                baseline: 'middle',
                shadowColor: COLORS.shadow,
              });
              draw.text({
                space: 'screen',
                x: paneWidth - 16,
                y: bandTop + bandHeight * 0.5,
                text: `${group.collapsed ? '+' : '-'} ${group.taskCount}`,
                fontPx: 12,
                color: group.collapsed ? COLORS.title : COLORS.subtle,
                align: 'right',
                baseline: 'middle',
                shadowColor: COLORS.shadow,
              });
              draw.hitRegion({
                id: `group:${group.name}`,
                space: 'screen',
                x: 0,
                y: bandTop,
                width: paneWidth,
                height: bandHeight,
                cursor: 'pointer',
                onPointerEnter: (event) => {
                  hoveredGroup = group.name;
                  event.requestRender();
                },
                onPointerLeave: (event) => {
                  if (hoveredGroup === group.name) {
                    hoveredGroup = null;
                    event.requestRender();
                  }
                },
                onPointerDown: (event) => {
                  event.capture();
                },
                onPointerUp: (event) => {
                  event.capture();
                },
                onClick: (event) => {
                  event.capture();
                  toggleGroup(group.name);
                },
              });
            }
          }),
        );
      },

      onDispose() {
        for (const cleanup of cleanups.splice(0).reverse()) {
          cleanup();
        }
      },
    };
  },
};

export default assigneeGroupCollapsePlugin;
