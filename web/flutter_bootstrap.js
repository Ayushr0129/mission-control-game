{{flutter_js}}
{{flutter_build_config}}

// The full CanvasKit build supports Safari as well as Chromium. Do not require
// WasmGC, cross-origin isolation, or a third-party renderer CDN.
_flutter.loader.load({
  config: { canvasKitVariant: 'full' },
  onEntrypointLoaded: async function (engineInitializer) {
    try {
      const runner = await engineInitializer.initializeEngine();
      await runner.runApp();
    } catch (error) {
      window.showMissionLoadError(error);
    }
  }
}).catch(window.showMissionLoadError);
