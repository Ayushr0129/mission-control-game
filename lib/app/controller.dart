part of '../main.dart';

abstract class MissionController extends State<MissionControl>
    with WidgetsBindingObserver {
  late Programme programme;
  String page = 'home',
      category = 'Propulsion',
      lastChange = 'Select a component to see its engineering impact.';
  int selected = 0;
  bool sandbox = false,
      settled = false,
      resultSuccess = false,
      saveOk = true,
      landingActive = false;
  String resultMessage = '';
  Flight? flight;
  Operations? ops;
  MissionGame? game;
  final audio = MissionAudio();
  Timer? saveTimer;
  final messenger = GlobalKey<ScaffoldMessengerState>();
  List<Map<String, dynamic>> discoveries = [];
  bool searching = false;
  String galleryStatus =
      'Browse offline mission stories, or connect to the NASA Image Library.';
  Programme get p => programme;
  Mission get mission => widget.missions[selected];
  Engineering get craft => Engineering(
    widget.parts.where((x) => p.design.contains(x.id)).toList(),
    launcher: LaunchVehicle.fromId(p.launcherId),
  );
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    programme = widget.store.load();
    audio.muted = p.muted;
    audio.volume = p.volume;
    try {
      discoveries =
          (jsonDecode(widget.store.readString('gallery') ?? '[]') as List)
              .map((j) => Map<String, dynamic>.from(j))
              .toList();
    } catch (_) {}
    saveOk = widget.store.persistent;
    saveTimer = Timer.periodic(const Duration(seconds: 2), (_) => save());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    saveTimer?.cancel();
    audio.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) {
      game?.simPaused = true;
      audio.stop();
      save();
    }
  }

  Future<void> save() async {
    if (flight != null && !settled) {
      p.active = {
        'mission': selected,
        'sandbox': sandbox,
        'stage': ops == null
            ? 'flight'
            : landingActive
            ? 'landing'
            : 'ops',
        'flight': flight!.toJson(),
        'ops': ops?.toJson(),
      };
    }
    try {
      final ok = await widget.store.save(p);
      if (mounted && ok != saveOk) setState(() => saveOk = ok);
    } catch (_) {
      if (mounted) setState(() => saveOk = false);
    }
  }

  void toast(String s) {
    messenger.currentState?.showSnackBar(
      SnackBar(content: Text(s), backgroundColor: const Color(0xff284252)),
    );
  }

  void go(String next) {
    game?.simPaused = true;
    audio.stop();
    audio.play('click');
    setState(() => page = next);
    save();
  }

  Future<void> resetCampaign() async {
    if (p.attempts > 0 || p.active != null) {
      final ok = await showDialog<bool>(
        context: messenger.currentContext!,
        builder: (c) => AlertDialog(
          title: const Text('Start a new programme?'),
          content: const Text(
            'This replaces your current campaign and its saved progress. Settings and saved NASA images stay available.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Keep campaign'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('New campaign'),
            ),
          ],
        ),
      );
      if (ok != true) return;
    }
    setState(() {
      programme = Programme(muted: p.muted, volume: p.volume);
      selected = 0;
      sandbox = false;
      flight = null;
      ops = null;
      settled = false;
      page = 'missions';
    });
    save();
    audio.loop('ambient');
  }

  void continueMission() {
    final a = p.active;
    if (a == null) {
      sandbox = false;
      selected = p.completed.length.clamp(0, 3);
      go('missions');
      return;
    }
    selected = a['mission'];
    sandbox = a['sandbox'];
    settled = false;
    flight = Flight(craft.wetMass, launcher: craft.launcher)
      ..restore(Map<String, dynamic>.from(a['flight']));
    ops = a['ops'] == null
        ? null
        : (Operations(mission, craft, p.seed + p.attempts)
            ..restore(Map<String, dynamic>.from(a['ops'])));
    landingActive = a['stage'] == 'landing';
    if (a['stage'] == 'flight' || landingActive) {
      game = MissionGame(flight!, tick, landing: landingActive ? ops : null);
      page = 'flight';
    } else {
      page = 'ops';
    }
    setState(() {});
  }

  void choose(int index) {
    if (p.active != null) {
      toast('Resume or abandon the active mission first.');
      return;
    }
    if (!sandbox &&
        index > 0 &&
        !p.completed.contains(widget.missions[index - 1].id)) {
      return;
    }
    selected = index;
    go('briefing');
  }

  void selectPart(Part part) {
    if (part.id == 'core') return;
    final before = craft;
    setState(() {
      if (p.design.contains(part.id)) {
        p.design.remove(part.id);
      } else {
        if (!['Science', 'Landing'].contains(part.category)) {
          p.design.removeWhere(
            (id) => widget.parts.any(
              (q) => q.id == id && q.category == part.category,
            ),
          );
        }
        p.design.add(part.id);
      }
      final after = craft;
      String sign(double v) => '${v >= 0 ? '+' : ''}${v.toStringAsFixed(0)}';
      lastChange =
          '${part.name}: ${sign(after.wetMass - before.wetMass)} kg  •  ${sign(after.netPower - before.netPower)} W net  •  ${sign(after.deltaV - before.deltaV)} m/s Δv  •  ${after.cost >= before.cost ? '+' : ''}\$${(after.cost - before.cost).toStringAsFixed(1)}M';
    });
    audio.play('click');
    save();
  }

  void loadRecommended() {
    setState(() {
      p.launcherId = 'standard';
      p.design = [
        'core',
        selected >= 2 ? 'engine2' : 'engine1',
        selected == 3
            ? 'tank3'
            : selected == 2
            ? 'tank2'
            : 'tank1',
        selected >= 2 ? 'solar2' : 'solar1',
        selected >= 2 ? 'antenna2' : 'antenna1',
        selected >= 2 ? 'spectrometer' : 'camera',
        if (selected == 3) 'legs',
      ];
      lastChange =
          'Flight-proven baseline loaded. Try changing parts to explore the trade-offs.';
    });
    save();
  }

  Future<void> launch() async {
    if (p.active != null) {
      toast(
        'Continue or abandon the active mission before starting another flight.',
      );
      return;
    }
    if (craft.warnings(mission, p.funding, sandbox: sandbox).isNotEmpty) return;
    if (!sandbox) {
      Campaign.launch(p, craft.cost);
    }
    flight = Flight(craft.wetMass, launcher: craft.launcher);
    ops = null;
    settled = false;
    landingActive = false;
    game = MissionGame(flight!, tick);
    setState(() => page = 'flight');
    await save();
  }

  void setThrottle(double value) {
    if (page != 'flight' || game == null) return;
    setState(() {
      if (landingActive) {
        ops!.landingThrottle = value.clamp(0, 1);
      } else {
        flight!.throttle = value.clamp(0, 1);
      }
    });
  }

  void adjustThrottle(double delta) => setThrottle(
    (landingActive ? ops!.landingThrottle : flight!.throttle) + delta,
  );

  void adjustPitch(double delta) {
    if (page != 'flight' || landingActive) return;
    setState(
      () => flight!.guidance = (flight!.guidance + delta).clamp(-15, 15),
    );
  }

  void separateStage() {
    if (page != 'flight' || landingActive || !flight!.canSeparate) return;
    flight!.separate();
    setState(() {});
    audio.play('click');
    save();
  }

  void toggleFlightPause() {
    if (page != 'flight' || game == null) return;
    setState(() {
      game!.simPaused = !game!.simPaused;
      if (!landingActive) flight!.started = true;
    });
    if (game!.simPaused) {
      audio.stop();
      save();
    } else {
      // Called only by a click, tap, or key gesture: Safari may block autoplay.
      audio.loop('engine');
    }
  }

  void pauseFlight() {
    if (page == 'flight' && game != null && !game!.simPaused) {
      toggleFlightPause();
    }
  }

  void tick() {
    if (!mounted || page != 'flight') return;
    if (landingActive) {
      if (ops!.failure != null) {
        finish(false, ops!.failure!);
        return;
      }
      if (ops!.landed) {
        game!.simPaused = true;
        landingActive = false;
        setState(() => page = 'ops');
        save();
        audio.stop();
        audio.play('success');
        return;
      }
    } else {
      if (flight!.achieved(selected > 0)) {
        game!.simPaused = true;
        audio.stop();
        ops = Operations(mission, craft, p.seed + p.attempts);
        setState(() => page = 'ops');
        save();
        audio.play('success');
        return;
      }
      if (flight!.failure != null) {
        finish(false, flight!.failure!);
        return;
      }
    }
    setState(() {});
  }

  void finish(bool success, String message) {
    if (settled) return;
    game?.simPaused = true;
    audio.stop();
    audio.play(success ? 'success' : 'failure');
    if (!sandbox) {
      Campaign.settle(
        p,
        mission,
        success: success,
        science: ops?.observations ?? 0,
        cost: craft.cost,
        netPower: craft.netPower,
      );
    } else {
      p.active = null;
    }
    settled = true;
    resultSuccess = success;
    resultMessage = message;
    setState(() => page = 'result');
    save();
  }

  void advanceOps() {
    if (ops!.phase == 1 && selected == 3 && !ops!.landed) {
      ops!.startLanding();
      if (ops!.failure != null) {
        finish(false, ops!.failure!);
        return;
      }
      landingActive = true;
      game = MissionGame(flight!, tick, landing: ops);
      setState(() => page = 'flight');
      save();
      return;
    }
    final success = ops!.advance();
    if (ops!.failure != null) {
      finish(false, ops!.failure!);
      return;
    }
    if (success) {
      finish(
        true,
        'Your engineering choices made the difference. ${ops!.observations} science points returned from ${mission.destination.toLowerCase()}.',
      );
      return;
    }
    setState(() {});
    save();
    audio.play('click');
  }

  void learnMore();
}
