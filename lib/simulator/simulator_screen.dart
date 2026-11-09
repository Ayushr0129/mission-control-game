import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/storage.dart';
import '../widgets/art.dart';
import '../widgets/ui.dart';
import 'physics.dart';

class SimulatorScreen extends StatefulWidget {
  final SaveStore store;
  const SimulatorScreen({super.key, required this.store});
  @override
  State<SimulatorScreen> createState() => _SimulatorState();
}

class _SimulatorState extends State<SimulatorScreen>
    with WidgetsBindingObserver {
  static const keyName = 'assembly_simulator_v1';
  Assembly design = Assembly.starter();
  SandboxFlight? flight;
  RocketPart? selected;
  String
  tool = 'tank',
  message =
      'Build a connected rocket. Tap an empty cell to place a part; tap or drag a part to edit it.';
  bool paused = true, map = false, saving = false;
  double zoom = 1, turn = 0;
  List<Point2> prediction = [];
  late Timer timer;
  final clock = Stopwatch();
  int last = 0, frames = 0;
  final focus = FocusNode();
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    try {
      final raw = widget.store.readString(keyName);
      if (raw != null) {
        final j = jsonDecode(raw);
        design = Assembly(
          (j['design'] as List).map((p) => RocketPart.fromJson(p)).toList(),
        );
        if (j['flight'] != null) {
          flight = SandboxFlight.fromJson(j['flight']);
          prediction = flight!.predict();
        }
      }
    } catch (_) {
      message =
          'Saved simulator data could not be read. Starter restored; campaign saves are separate.';
    }
    clock.start();
    timer = Timer.periodic(const Duration(milliseconds: 16), (_) => tick());
  }

  void tick() {
    final now = clock.elapsedMicroseconds;
    final dt = last == 0 ? 0.0 : ((now - last) / 1e6).clamp(0.0, .08);
    last = now;
    if (!mounted) return;
    if (flight != null && !paused && !flight!.ended) {
      flight!.angle += turn * 30 * pi / 180 * dt;
      flight!.step(dt);
      if (frames % 20 == 0) prediction = flight!.predict();
      setState(() {});
    }
    frames++;
    if (frames % 120 == 0) save();
  }

  Future<void> save() async {
    if (saving) return;
    saving = true;
    try {
      await widget.store.writeString(
        keyName,
        jsonEncode({
          'design': design.parts.map((p) => p.toJson()).toList(),
          'flight': flight?.toJson(),
        }),
      );
    } finally {
      saving = false;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) {
      paused = true;
      turn = 0;
      save();
    }
  }

  @override
  void dispose() {
    timer.cancel();
    clock.stop();
    WidgetsBinding.instance.removeObserver(this);
    focus.dispose();
    super.dispose();
  }

  void refresh() {
    if (flight != null) prediction = flight!.predict();
    setState(() {});
    save();
  }

  void move(int dx, int dy) {
    final p = selected;
    if (p == null) return;
    final x = p.x + dx, y = p.y + dy;
    if (x < 0 ||
        x > 8 ||
        y < 0 ||
        y > 11 ||
        design.parts.any((b) => b != p && b.x == x && b.y == y)) {
      return;
    }
    setState(() {
      p.x = x;
      p.y = y;
    });
    save();
  }

  void place(int x, int y) {
    if (x < 0 || x > 8 || y < 0 || y > 11) return;
    setState(() {
      final at = design.parts.where((p) => p.x == x && p.y == y).firstOrNull;
      if (at != null) {
        selected = at;
      } else {
        selected = RocketPart(tool, x, y);
        design.parts.add(selected!);
      }
    });
    save();
  }

  void launch() {
    if (design.problems.isNotEmpty) {
      setState(() => message = design.problems.join(' '));
      return;
    }
    setState(() {
      flight = SandboxFlight(design.copy());
      paused = true;
      map = false;
      selected = null;
      message =
          'Flight director: throttle up, then launch. Pitch gradually after clearing the pad.';
    });
    refresh();
    focus.requestFocus();
  }

  void ignition() {
    final f = flight!;
    if (f.ended) return;
    f.launched = true;
    paused = !paused;
    turn = 0;
    refresh();
  }

  void stage() {
    final f = flight;
    if (f == null || f.ended) return;
    final old = f.craft.mass;
    final changed = f.craft.separate();
    message = changed
        ? 'Stage separated: ${(old - f.craft.mass).round()} kg released. Upper engines receive fuel only from their own stage.'
        : 'No separator remains.';
    refresh();
  }

  KeyEventResult key(FocusNode node, KeyEvent event) {
    if (event is KeyUpEvent &&
        [
          LogicalKeyboardKey.keyA,
          LogicalKeyboardKey.keyD,
        ].contains(event.logicalKey)) {
      turn = 0;
      return KeyEventResult.handled;
    }
    if (event is! KeyDownEvent && event is! KeyRepeatEvent) {
      return KeyEventResult.ignored;
    }
    final k = event.logicalKey;
    if (flight != null) {
      if (k == LogicalKeyboardKey.keyA) {
        turn = -1;
      } else if (k == LogicalKeyboardKey.keyD) {
        turn = 1;
      } else if (k == LogicalKeyboardKey.keyW) {
        flight!.throttle = (flight!.throttle + .05).clamp(0, 1);
      } else if (k == LogicalKeyboardKey.keyS) {
        flight!.throttle = (flight!.throttle - .05).clamp(0, 1);
      } else if (k == LogicalKeyboardKey.space && event is KeyDownEvent) {
        ignition();
      } else if (k == LogicalKeyboardKey.keyG && event is KeyDownEvent) {
        stage();
      } else if (k == LogicalKeyboardKey.keyM && event is KeyDownEvent) {
        setState(() => map = !map);
      } else if (k == LogicalKeyboardKey.escape) {
        paused = true;
        turn = 0;
      } else {
        return KeyEventResult.ignored;
      }
      setState(() {});
      return KeyEventResult.handled;
    }
    if (k == LogicalKeyboardKey.arrowLeft) {
      move(-1, 0);
    } else if (k == LogicalKeyboardKey.arrowRight) {
      move(1, 0);
    } else if (k == LogicalKeyboardKey.arrowUp) {
      move(0, -1);
    } else if (k == LogicalKeyboardKey.arrowDown) {
      move(0, 1);
    } else {
      return KeyEventResult.ignored;
    }
    return KeyEventResult.handled;
  }

  Future<void> rebuild() async {
    setState(() {
      paused = true;
      turn = 0;
    });
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Return to assembly?'),
        content: const Text(
          'This ends the current training flight. Your original design is preserved.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Keep flying'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Return to assembly'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      setState(() => flight = null);
      save();
    }
  }

  Widget builderTools() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      label('PART CATALOGUE', color: cyan),
      const SizedBox(height: 8),
      Wrap(
        spacing: 6,
        runSpacing: 4,
        children: [
          for (final kind in [
            'capsule',
            'tank',
            'engine',
            'separator',
            'science',
          ])
            ChoiceChip(
              label: Text(kind),
              selected: tool == kind,
              onSelected: (_) => setState(() => tool = kind),
            ),
        ],
      ),
      const SizedBox(height: 8),
      Text(
        '${design.parts.length} parts · ${(design.mass / 1000).toStringAsFixed(1)} t · \$${design.cost.toStringAsFixed(1)}M\nPad TWR ${(design.thrust / max(design.mass * 9.80665, 1)).toStringAsFixed(2)}',
        style: const TextStyle(
          fontFamily: 'JetBrainsMono',
          fontSize: 12,
          height: 1.6,
        ),
      ),
      if (selected != null) ...[
        Text(
          'Selected: ${selected!.kind} (${selected!.x}, ${selected!.y})',
          style: const TextStyle(color: cyan, fontSize: 12),
        ),
        Wrap(
          children: [
            IconButton(
              tooltip: 'Move left',
              onPressed: () => move(-1, 0),
              icon: const Icon(Icons.arrow_back),
            ),
            IconButton(
              tooltip: 'Move up',
              onPressed: () => move(0, -1),
              icon: const Icon(Icons.arrow_upward),
            ),
            IconButton(
              tooltip: 'Move down',
              onPressed: () => move(0, 1),
              icon: const Icon(Icons.arrow_downward),
            ),
            IconButton(
              tooltip: 'Move right',
              onPressed: () => move(1, 0),
              icon: const Icon(Icons.arrow_forward),
            ),
            IconButton(
              tooltip: 'Rotate part',
              onPressed: () {
                setState(
                  () => selected!.rotation = (selected!.rotation + 1) % 4,
                );
                save();
              },
              icon: const Icon(Icons.rotate_right),
            ),
            IconButton(
              tooltip: 'Remove part',
              onPressed: () {
                setState(() {
                  design.parts.remove(selected);
                  selected = null;
                });
                save();
              },
              icon: const Icon(Icons.delete_outline),
            ),
          ],
        ),
      ],
      const SizedBox(height: 8),
      FilledButton.icon(
        onPressed: launch,
        icon: const Icon(Icons.rocket_launch),
        label: const Text('Launch assembled rocket'),
      ),
      TextButton(
        onPressed: () {
          setState(() {
            design = Assembly.starter();
            selected = null;
          });
          save();
        },
        child: const Text('Load two-stage training rocket'),
      ),
      TextButton(
        onPressed: () async {
          final confirmed = await showDialog<bool>(
            context: context,
            builder: (c) => AlertDialog(
              title: const Text('Start an empty assembly?'),
              content: const Text(
                'The current design will be replaced. You can reload the training rocket anytime.',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(c, false),
                  child: const Text('Cancel'),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(c, true),
                  child: const Text('Start empty'),
                ),
              ],
            ),
          );
          if (confirmed == true && mounted) {
            setState(() {
              design = Assembly([]);
              selected = null;
              message =
                  'Choose a part, then tap a grid cell. Start with one command capsule.';
            });
            save();
          }
        },
        child: const Text('New empty assembly'),
      ),
      Text(
        message,
        style: const TextStyle(fontSize: 11, color: dim, height: 1.5),
      ),
    ],
  );
  Widget hold(String title, double direction) => Listener(
    onPointerDown: (_) {
      focus.requestFocus();
      turn = direction;
    },
    onPointerUp: (_) => turn = 0,
    onPointerCancel: (_) => turn = 0,
    child: OutlinedButton(
      onPressed: () {
        flight!.angle += direction * pi / 180;
        refresh();
      },
      child: Text(title),
    ),
  );
  Widget controls() {
    final f = flight!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          '${f.status} · ${paused ? "PAUSED" : "LIVE"}',
          style: const TextStyle(color: cyan, fontSize: 12),
        ),
        Text(
          'ALT ${(f.altitude / 1000).toStringAsFixed(1)} km · SPEED ${f.velocity.length.round()} m/s\nAP ${f.apoapsis == null ? "ESCAPE" : (f.apoapsis! / 1000).toStringAsFixed(1)} km · PE ${(f.periapsis / 1000).toStringAsFixed(1)} km · T+${f.time.round()} s',
          style: const TextStyle(
            fontFamily: 'JetBrainsMono',
            fontSize: 11,
            height: 1.6,
          ),
        ),
        Row(
          children: [
            const Text('Throttle'),
            Expanded(
              child: Slider(
                key: const ValueKey('sim-throttle'),
                value: f.throttle,
                onChanged: (v) {
                  f.throttle = v;
                  refresh();
                },
                semanticFormatterCallback: (v) =>
                    'Throttle ${(v * 100).round()} percent',
              ),
            ),
            Text('${(f.throttle * 100).round()}%'),
          ],
        ),
        Row(
          children: [
            Expanded(child: hold('−1°', -1)),
            Expanded(
              child: Slider(
                key: const ValueKey('sim-attitude'),
                value: f.pitch,
                min: 0,
                max: 360,
                divisions: 360,
                onChanged: (v) {
                  f.angle = v * pi / 180;
                  refresh();
                },
                semanticFormatterCallback: (v) =>
                    'Attitude ${v.round()} degrees',
              ),
            ),
            Expanded(child: hold('+1°', 1)),
          ],
        ),
        Text(
          'Attitude ${f.pitch.toStringAsFixed(1)}° clockwise from inertial north · Fuel ${(f.craft.fuel / 1000).toStringAsFixed(1)} t',
          style: const TextStyle(fontSize: 10, color: dim),
        ),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          children: [
            FilledButton(
              onPressed: f.ended ? null : ignition,
              child: Text(
                paused
                    ? (f.launched ? 'Resume simulation' : 'Ignite & launch')
                    : 'Pause simulation',
              ),
            ),
            OutlinedButton(
              onPressed: stage,
              child: const Text('Separate stage'),
            ),
            OutlinedButton(
              onPressed: () => setState(() => map = !map),
              child: Text(map ? 'Vehicle camera' : 'Trajectory map'),
            ),
            TextButton(
              onPressed: rebuild,
              child: const Text('Return to assembly'),
            ),
          ],
        ),
        if (map)
          Row(
            children: [
              const Text('Map zoom'),
              Expanded(
                child: Slider(
                  value: zoom,
                  min: .4,
                  max: 8,
                  onChanged: (v) => setState(() => zoom = v),
                ),
              ),
            ],
          ),
        Text(
          message,
          style: const TextStyle(color: dim, fontSize: 10, height: 1.5),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) => Focus(
    focusNode: focus,
    autofocus: true,
    onKeyEvent: key,
    onFocusChange: (has) {
      if (!has) turn = 0;
    },
    child: Scaffold(
      appBar: AppBar(
        title: const Text(
          'ROCKET ASSEMBLY / FLIGHT LAB',
          style: TextStyle(fontSize: 14),
        ),
        leading: IconButton(
          tooltip: 'Save and return to mission control',
          icon: const Icon(Icons.arrow_back),
          onPressed: () async {
            paused = true;
            turn = 0;
            await save();
            if (context.mounted) Navigator.pop(context);
          },
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: Text(
                widget.store.persistent
                    ? 'TRAINING SANDBOX · Campaign funds and progress are separate · Autosave; restored flights pause'
                    : 'SESSION ONLY · Simulator progress will be lost on reload',
                style: TextStyle(
                  color: widget.store.persistent ? dim : orange,
                  fontSize: 10,
                ),
              ),
            ),
            Expanded(
              child: LayoutBuilder(
                builder: (c, b) {
                  final wide = b.maxWidth > 900;
                  final canvas = flight == null
                      ? LayoutBuilder(
                          builder: (c, box) {
                            final cell = min(
                              box.maxWidth / 9,
                              box.maxHeight / 12,
                            );
                            final width = cell * 9, height = cell * 12;
                            return Center(
                              child: SizedBox(
                                width: width,
                                height: height,
                                child: GestureDetector(
                                  key: const ValueKey('assembly-grid'),
                                  onTapUp: (d) => place(
                                    (d.localPosition.dx / cell).floor(),
                                    (d.localPosition.dy / cell).floor(),
                                  ),
                                  onPanStart: (d) {
                                    selected = design.parts
                                        .where(
                                          (p) =>
                                              p.x ==
                                                  (d.localPosition.dx / cell)
                                                      .floor() &&
                                              p.y ==
                                                  (d.localPosition.dy / cell)
                                                      .floor(),
                                        )
                                        .firstOrNull;
                                    setState(() {});
                                  },
                                  onPanUpdate: (d) {
                                    final p = selected;
                                    if (p != null) {
                                      move(
                                        (d.localPosition.dx / cell).floor() -
                                            p.x,
                                        (d.localPosition.dy / cell).floor() -
                                            p.y,
                                      );
                                    }
                                  },
                                  child: Semantics(
                                    container: true,
                                    image: true,
                                    label: 'Rocket assembly grid',
                                    child: CustomPaint(
                                      painter: AssemblyPainter(
                                        design,
                                        selected,
                                      ),
                                      child: const SizedBox.expand(),
                                    ),
                                  ),
                                ),
                              ),
                            );
                          },
                        )
                      : CustomPaint(
                          painter: FlightPainter(
                            flight!,
                            prediction,
                            map,
                            zoom,
                            !paused,
                          ),
                          child: const SizedBox.expand(),
                        );
                  final tools = Padding(
                    padding: const EdgeInsets.all(12),
                    child: flight == null ? builderTools() : controls(),
                  );
                  if (wide) {
                    return Row(
                      children: [
                        Expanded(child: canvas),
                        SizedBox(
                          width: 380,
                          child: SingleChildScrollView(child: tools),
                        ),
                      ],
                    );
                  }
                  return Column(
                    children: [
                      Expanded(child: canvas),
                      ConstrainedBox(
                        constraints: BoxConstraints(
                          maxHeight: b.maxHeight * .48,
                        ),
                        child: SingleChildScrollView(child: tools),
                      ),
                    ],
                  );
                },
              ),
            ),
            const Padding(
              padding: EdgeInsets.all(6),
              child: Text(
                'A/D hold turn · W/S throttle · Space launch/pause · G stage · M map. Coast prediction excludes thrust and drag.',
                style: TextStyle(color: dim, fontSize: 10),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

void paintPart(
  Canvas c,
  RocketPart p,
  Offset center,
  double size, {
  bool selected = false,
  double flame = 0,
}) {
  c.save();
  c.translate(center.dx, center.dy);
  c.rotate(p.rotation * pi / 2);
  final r = Rect.fromCenter(
    center: Offset.zero,
    width: size * .74,
    height: size * .94,
  );
  final metal = Paint()
    ..shader = const LinearGradient(
      colors: [Color(0xff737e88), Color(0xffe4e9eb), Color(0xff8c969e)],
    ).createShader(r);
  if (p.kind == 'capsule') {
    c.drawPath(
      Path()
        ..moveTo(0, -size * .46)
        ..lineTo(size * .37, size * .4)
        ..lineTo(-size * .37, size * .4)
        ..close(),
      metal,
    );
    c.drawCircle(
      Offset(0, size * .1),
      size * .1,
      Paint()..color = const Color(0xff253949),
    );
  } else if (p.kind == 'engine') {
    c.drawRect(
      Rect.fromLTWH(-size * .25, -size * .45, size * .5, size * .2),
      metal,
    );
    c.drawPath(
      Path()
        ..moveTo(-size * .17, -size * .3)
        ..lineTo(-size * .36, size * .4)
        ..lineTo(size * .36, size * .4)
        ..lineTo(size * .17, -size * .3)
        ..close(),
      Paint()..color = dim,
    );
    if (flame > 0) {
      c.drawPath(
        Path()
          ..moveTo(-size * .2, size * .4)
          ..lineTo(0, size * (.6 + flame))
          ..lineTo(size * .2, size * .4)
          ..close(),
        Paint()..color = orange,
      );
    }
  } else if (p.kind == 'separator') {
    c.drawRect(
      Rect.fromCenter(
        center: Offset.zero,
        width: size * .8,
        height: size * .25,
      ),
      Paint()..color = orange,
    );
  } else {
    c.drawRect(
      r,
      p.kind == 'science' ? (Paint()..color = const Color(0xff9f8c54)) : metal,
    );
    c.drawLine(
      Offset(r.left, r.top + size * .12),
      Offset(r.right, r.top + size * .12),
      Paint()..color = ink,
    );
    if (p.kind == 'tank') {
      c.drawRect(
        Rect.fromLTWH(
          r.left + 2,
          r.bottom - 4,
          (r.width - 4) * (p.fuel / 12000).clamp(0, 1),
          2,
        ),
        Paint()..color = cyan,
      );
    }
    if (p.kind == 'science') {
      c.drawCircle(Offset.zero, size * .18, Paint()..color = ink);
    }
  }
  if (selected) {
    c.drawRect(
      Rect.fromCenter(
        center: Offset.zero,
        width: size * .98,
        height: size * .98,
      ),
      Paint()
        ..color = cyan
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
  }
  c.restore();
}

class AssemblyPainter extends CustomPainter {
  final Assembly design;
  final RocketPart? selected;
  AssemblyPainter(this.design, this.selected);
  @override
  void paint(Canvas c, Size s) {
    c.drawRect(Offset.zero & s, Paint()..color = panel);
    final cell = s.width / 9,
        pen = Paint()
          ..color = dim.withValues(alpha: .2)
          ..strokeWidth = .6;
    for (var i = 0; i <= 9; i++) {
      c.drawLine(Offset(i * cell, 0), Offset(i * cell, s.height), pen);
    }
    for (var i = 0; i <= 12; i++) {
      c.drawLine(Offset(0, i * cell), Offset(s.width, i * cell), pen);
    }
    for (final a in design.parts) {
      for (final b in design.parts) {
        if ((a.x - b.x).abs() + (a.y - b.y).abs() == 1) {
          c.drawLine(
            Offset((a.x + .5) * cell, (a.y + .5) * cell),
            Offset((b.x + .5) * cell, (b.y + .5) * cell),
            Paint()
              ..color = dim
              ..strokeWidth = 3,
          );
        }
      }
    }
    for (final p in design.parts) {
      paintPart(
        c,
        p,
        Offset((p.x + .5) * cell, (p.y + .5) * cell),
        cell,
        selected: p == selected,
      );
    }
  }

  @override
  bool shouldRepaint(AssemblyPainter old) => true;
}

class FlightPainter extends CustomPainter {
  final SandboxFlight f;
  final List<Point2> prediction;
  final bool map, running;
  final double zoom;
  FlightPainter(this.f, this.prediction, this.map, this.zoom, this.running);
  @override
  void paint(Canvas c, Size s) {
    c.save();
    c.clipRect(Offset.zero & s);
    c.drawRect(Offset.zero & s, Paint()..color = ink);
    if (map) {
      final extent = max(
        SandboxFlight.radius * 1.3,
        min(
          SandboxFlight.radius * 8,
          prediction.fold<double>(
            f.position.length,
            (a, p) => max(a, p.length),
          ),
        ),
      );
      final scale = s.shortestSide * .44 / extent * zoom;
      final focus = max(0.0, 1 - 1 / zoom);
      final center =
          Offset(s.width / 2, s.height / 2) -
          Offset(f.position.x * scale, -f.position.y * scale) * focus;
      Offset screen(Point2 p) => center + Offset(p.x * scale, -p.y * scale);
      c.drawCircle(
        center,
        SandboxFlight.radius * scale,
        Paint()..color = const Color(0xff244558),
      );
      c.drawCircle(
        center,
        (SandboxFlight.radius + 100000) * scale,
        Paint()
          ..color = dim
          ..style = PaintingStyle.stroke
          ..strokeWidth = .7,
      );
      final path = Path();
      for (var i = 0; i < prediction.length; i++) {
        final p = screen(prediction[i]);
        if (i == 0) {
          path.moveTo(p.dx, p.dy);
        } else {
          path.lineTo(p.dx, p.dy);
        }
      }
      c.drawPath(
        path,
        Paint()
          ..color = cyan
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5,
      );
      c.drawCircle(screen(f.position), 5, Paint()..color = orange);
      instrumentText(
        c,
        'EARTH / COAST TRAJECTORY',
        const Offset(12, 15),
        color: cyan,
      );
      instrumentText(
        c,
        '100 KM ATMOSPHERE REFERENCE',
        const Offset(12, 32),
        size: 8,
      );
    } else {
      final altitude = max(0, f.altitude);
      c.drawRect(
        Offset.zero & s,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              ink,
              Color.lerp(
                const Color(0xff527e98),
                ink,
                (altitude / 100000).clamp(0, 1),
              )!,
            ],
          ).createShader(Offset.zero & s),
      );
      final cell = min(s.width / 12, s.height / 16).clamp(12.0, 40.0);
      final parts = f.craft.parts;
      final cx = parts.isEmpty
          ? 4.0
          : parts.map((p) => p.x).reduce((a, b) => a + b) / parts.length;
      final cy = parts.isEmpty
          ? 5.0
          : parts.map((p) => p.y).reduce((a, b) => a + b) / parts.length;
      if (altitude < 1000) {
        final ground = min(s.height - 15, s.height * .65 + altitude * .15);
        c.drawRect(
          Rect.fromLTWH(0, ground, s.width, s.height),
          Paint()..color = const Color(0xff293832),
        );
      }
      c.save();
      c.translate(s.width / 2, s.height * .45);
      c.rotate(f.angle);
      for (final p in parts) {
        paintPart(
          c,
          p,
          Offset((p.x - cx) * cell, (p.y - cy) * cell),
          cell,
          flame:
              running &&
                  f.launched &&
                  !f.ended &&
                  f.craft.engines.contains(p) &&
                  f.craft.tanksFor(p).isNotEmpty
              ? f.throttle
              : 0,
        );
      }
      c.restore();
      instrumentText(
        c,
        'TRACKING / ACTUAL ASSEMBLY',
        const Offset(12, 15),
        color: cyan,
      );
      instrumentText(
        c,
        'Use Trajectory map to inspect orbit and impact.',
        Offset(12, s.height - 20),
        size: 8,
      );
    }
    c.restore();
  }

  @override
  bool shouldRepaint(FlightPainter old) => true;
}
