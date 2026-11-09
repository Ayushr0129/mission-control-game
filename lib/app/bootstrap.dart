part of '../main.dart';

/// Starts Flutter immediately, then reports recoverable loading failures in
/// Flutter itself (the HTML splash may already have disappeared by this point).
class MissionBootstrap extends StatefulWidget {
  final Future<Widget> Function()? loader;
  final Duration minimumSplash;
  const MissionBootstrap({
    super.key,
    this.loader,
    this.minimumSplash = const Duration(milliseconds: 850),
  });
  @override
  State<MissionBootstrap> createState() => _MissionBootstrapState();
}

class _MissionBootstrapState extends State<MissionBootstrap> {
  late Future<Widget> _app;
  Timer? _intro;
  bool _introFinished = false;

  @override
  void initState() {
    super.initState();
    _app = Future<Widget>.sync(widget.loader ?? loadMissionApp);
    _introFinished = widget.minimumSplash == Duration.zero;
    if (!_introFinished) {
      _intro = Timer(widget.minimumSplash, () {
        if (mounted) setState(() => _introFinished = true);
      });
    }
  }

  @override
  void dispose() {
    _intro?.cancel();
    super.dispose();
  }

  void retry() => setState(() {
    _app = Future<Widget>.sync(widget.loader ?? loadMissionApp);
  });

  @override
  Widget build(BuildContext context) => FutureBuilder<Widget>(
    future: _app,
    builder: (context, snapshot) {
      if (snapshot.hasError) {
        return StartupScreen(
          error:
              'Core flight data could not be loaded. Check your connection and try again.',
          onRetry: retry,
        );
      }
      if (snapshot.hasData && _introFinished) return snapshot.data!;
      return const StartupScreen();
    },
  );
}

Future<Widget> loadMissionApp({AssetBundle? bundle}) async {
  if (!kIsWeb) {
    try {
      await SystemChrome.setPreferredOrientations([
        DeviceOrientation.portraitUp,
      ]).timeout(const Duration(seconds: 3));
    } catch (_) {
      // Orientation is a native preference, never a prerequisite to playing.
    }
  }
  final assets = bundle ?? rootBundle;
  final data = await Future.wait([
    // A failed request must be fetched again when the player taps Retry.
    assets.loadString('assets/data/missions.json', cache: false),
    assets.loadString('assets/data/components.json', cache: false),
  ], eagerError: true).timeout(const Duration(seconds: 30));
  final missions = (jsonDecode(data[0]) as List)
      .map((j) => Mission(j))
      .toList();
  final parts = (jsonDecode(data[1]) as List).map((j) => Part(j)).toList();
  final store = await SaveStore.open();
  return MissionControl(store: store, missions: missions, parts: parts);
}
