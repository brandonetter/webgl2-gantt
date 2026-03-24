(function () {
  globalThis.DemoAdvancedPlugin = {
    meta: {
      id: 'demo-advanced',
      version: '1.0.0',
      apiRange: '^1.0.0',
      capabilities: ['advanced-api'],
    },
    create(context) {
      return {
        onInit() {
          if (!context.advanced) {
            return;
          }
          context.safe.logger.info('Advanced plugin enabled');
          context.advanced.requestRender();
        },
      };
    },
  };
})();
