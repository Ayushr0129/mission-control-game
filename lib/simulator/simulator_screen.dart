import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/storage.dart';
import '../widgets/art.dart';
import '../widgets/ui.dart';
import 'physics.dart';
import 'simulator_art.dart';
export 'simulator_art.dart' show AssemblyPainter, FlightPainter;
import 'catalogue.dart';
import 'campaign_session.dart';
import 'orbit_tutor.dart';
import 'time_warp.dart';
import '../models/models.dart';

class SimulatorScreen extends StatefulWidget {
  final SaveStore store;
  final VoidCallback? onInteraction;
  final Programme? programme;
  final Mission? mission;
  final int? missionIndex;
  const SimulatorScreen({
    super.key,
    required this.store,
    this.onInteraction,
    this.programme,
    this.mission,
    this.missionIndex,
  });
  @override
  State<SimulatorScreen> createState() => _SimulatorState();
}

class _SimulatorState extends State<SimulatorScreen>
    with WidgetsBindingObserver {
  static const keyName = 'assembly_simulator_v1';
  Assembly design = Assembly.starter();
  AssemblyCampaign? campaign;
  bool guideEnabled = false;
  final timeWarp = FlightTimeWarp();
  final tutor = OrbitTutor();
  bool get campaignMode => widget.programme != null && widget.mission != null;
  Widget enginePanel() => ExpansionTile(
    title: const Text(
      'Engine ignition / shutdown',
      style: TextStyle(fontSize: 12),
    ),
    children: [
      for (final p in flight!.craft.parts.where((p) => p.spec.thrust > 0))
        SwitchListTile(
          title: Text(
            '${p.spec.name} (${p.x},${p.y})',
            style: const TextStyle(fontSize: 11),
          ),
          subtitle: Text(
            flight!.craft.exhaustClear(p) ? 'Exhaust clear' : 'Exhaust blocked',
            style: const TextStyle(fontSize: 10),
          ),
          value: p.enabled,
          onChanged: (v) {
            guideEnabled = false;
            setState(() => p.enabled = v);
            campaign?.refreshReserve();
            refresh();
          },
        ),
    ],
  );
  Widget missionPanel() {
    final session = campaign;
    if (session == null) return const SizedBox();
    if (session.settled) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            session.success ? 'MISSION ACCOMPLISHED' : 'MISSION DEBRIEF',
            style: const TextStyle(color: cyan, fontSize: 18),
          ),
          Text(session.report, style: const TextStyle(height: 1.6)),
          Text(
            'Actual launch cost \$${session.launchCost.toStringAsFixed(1)}M · Science returned ${session.success ? session.operations?.observations ?? 0 : 0}\nFuel retained ${(session.flight.craft.fuel / 1000).toStringAsFixed(2)} t · Battery ${session.flight.battery.round()} Wh\nProgramme funds \$${widget.programme!.funding.toStringAsFixed(1)}M',
            style: const TextStyle(color: dim, height: 1.8),
          ),
          const Text(
            'Compare engine efficiency, payload mass, electrical load and recorder size before your next attempt. Launch costs are spent once; no refunds after launch.',
            style: TextStyle(color: dim, fontSize: 12),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Return to mission control'),
          ),
        ],
      );
    }
    final o = session.operations;
    if (session.phase != 'operations' || o == null) return const SizedBox();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          widget.mission!.name,
          style: const TextStyle(color: cyan, fontSize: 18),
        ),
        Text(
          widget.mission!.history,
          style: const TextStyle(fontSize: 12, height: 1.6),
        ),
        const Divider(),
        Text(session.report, style: const TextStyle(fontSize: 12, height: 1.6)),
        Text(
          'STEP ${o.phase + 1}: ${o.phaseName}',
          style: const TextStyle(color: cyan),
        ),
        Text(
          'Actual payload: ${flight!.craft.science} science · ${flight!.craft.range == 2 ? 'lunar' : 'Earth'} link\nBattery ${o.battery.toStringAsFixed(1)} Wh · Manoeuvre reserve ${o.deltaV.round()} m/s\nRecorder ${session.data.toStringAsFixed(1)} / ${flight!.craft.dataCapacity.round()} MB · Link ${flight!.craft.downlink} MB/s',
          style: const TextStyle(
            fontFamily: 'JetBrainsMono',
            fontSize: 11,
            height: 1.8,
          ),
        ),
        enginePanel(),
        if (flight!.craft.separators.isNotEmpty)
          OutlinedButton(
            onPressed: stage,
            child: const Text('Separate stage / expose reserve'),
          ),
        if (!o.eventResolved) ...[
          Text(o.eventText, style: const TextStyle(fontSize: 13, height: 1.6)),
          for (var i = 0; i < o.eventOptions.length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: OutlinedButton(
                onPressed: () {
                  session.resolveEvent(i);
                  refresh();
                },
                child: Text(o.eventOptions[i]),
              ),
            ),
        ],
        if (o.eventResolved)
          FilledButton(
            onPressed: () {
              session.advance();
              flight = session.flight;
              paused = true;
              guideEnabled = false;
              refresh();
            },
            child: Text(
              [
                'Execute mission manoeuvre',
                widget.mission!.id == 'landing' && !o.landed
                    ? 'Begin lunar descent'
                    : 'Confirm destination approach',
                'Collect payload observations',
                'Downlink & complete mission',
              ][o.phase.clamp(0, 3)],
            ),
          ),
        TextButton(
          onPressed: () {
            session.settle(
              false,
              'Mission abandoned by flight director; launch expenditure remains spent.',
            );
            refresh();
          },
          child: const Text('Abandon assembled mission'),
        ),
      ],
    );
  }

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
  final gridKey = GlobalKey();
  final editorTransform = TransformationController();
  final undoStack = <String>[], redoStack = <String>[];
  bool panMode = false, draggingPart = false, editorFitted = false;
  String category = 'All';
  Offset mapPan = Offset.zero;
  double cameraZoom = 1;
  RocketPart? dropPreview;
  String snapshot() => jsonEncode({
    'parts': design.parts.map((p) => p.toJson()).toList(),
    'order': design.stageOrder,
    'legacyFuelRouting': design.legacyFuelRouting,
  });
  void checkpoint() {
    undoStack.add(snapshot());
    if (undoStack.length > 100) undoStack.removeAt(0);
    redoStack.clear();
  }

  void restoreDesign(String raw) {
    final j = jsonDecode(raw);
    design = Assembly(
      (j['parts'] as List).map((p) => RocketPart.fromJson(p)).toList(),
      stageOrder: List<String>.from(j['order']),
      legacyFuelRouting: j['legacyFuelRouting'] ?? false,
    );
    selected = null;
    save();
  }

  void undo() {
    if (undoStack.isEmpty) return;
    setState(() {
      redoStack.add(snapshot());
      restoreDesign(undoStack.removeLast());
    });
  }

  void redo() {
    if (redoStack.isEmpty) return;
    setState(() {
      undoStack.add(snapshot());
      restoreDesign(redoStack.removeLast());
    });
  }

  bool fits(RocketPart p) =>
      p.x >= 0 &&
      p.y >= 0 &&
      p.x + p.width <= 9 &&
      p.y + p.height <= 12 &&
      !design.parts.any((b) => b != p && p.overlaps(b));
  void duplicate() {
    final p = selected;
    if (p == null) return;
    for (var y = 0; y < 12; y++) {
      for (var x = 0; x < 9; x++) {
        final copy = RocketPart(
          p.kind,
          x,
          y,
          rotation: p.rotation,
          fuel: p.fuel,
          crossfeed: p.crossfeed,
        );
        if (fits(copy)) {
          checkpoint();
          setState(() {
            design.parts.add(copy);
            selected = copy;
          });
          save();
          return;
        }
      }
    }
    setState(() => message = 'No free space for this part.');
  }

  void rotate() {
    final p = selected;
    if (p == null) return;
    final old = p.rotation;
    p.rotation = (p.rotation + 1) % 4;
    if (!fits(p)) {
      p.rotation = old;
      setState(() => message = 'Rotation would overlap or leave the grid.');
      return;
    }
    p.rotation = old;
    checkpoint();
    setState(() => p.rotation = (old + 1) % 4);
    save();
  }

  void remove() {
    if (selected == null) return;
    checkpoint();
    setState(() {
      design.parts.remove(selected);
      selected = null;
    });
    save();
  }

  void reorderStage(int from, int to) {
    final ids = design.separators.map((p) => p.id).toList();
    if (to < 0 || to >= ids.length) return;
    checkpoint();
    final id = ids.removeAt(from);
    ids.insert(to, id);
    setState(() {
      design.stageOrder
        ..clear()
        ..addAll(ids);
    });
    save();
  }

  Widget catalogueItem(PartSpec spec) {
    final chip = ChoiceChip(
      label: Text(spec.name, style: const TextStyle(fontSize: 11)),
      selected: tool == spec.id,
      onSelected: (_) => setState(() => tool = spec.id),
    );
    final feedback = Material(
      color: panel,
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Text(
          spec.name,
          style: const TextStyle(color: cyan, fontSize: 14),
        ),
      ),
    );
    return Tooltip(
      message: '${spec.purpose}\n${spec.summary}',
      child: MediaQuery.sizeOf(context).width > 900
          ? Draggable<String>(
              data: spec.id,
              dragAnchorStrategy: pointerDragAnchorStrategy,
              feedback: feedback,
              child: chip,
            )
          : LongPressDraggable<String>(
              data: spec.id,
              dragAnchorStrategy: pointerDragAnchorStrategy,
              feedback: feedback,
              child: chip,
            ),
    );
  }

  Widget constructionCanvas(BoxConstraints box) {
    const cell = 48.0, width = 432.0, height = 576.0;
    if (!editorFitted) {
      final fit = min(box.maxWidth / width, box.maxHeight / height);
      editorTransform.value = Matrix4.diagonal3Values(fit, fit, 1)
        ..setTranslationRaw(
          (box.maxWidth - width * fit) / 2,
          (box.maxHeight - height * fit) / 2,
          0,
        );
      editorFitted = true;
    }
    return InteractiveViewer(
      transformationController: editorTransform,
      constrained: false,
      panEnabled: panMode,
      scaleEnabled: true,
      minScale: .25,
      maxScale: 3,
      boundaryMargin: const EdgeInsets.all(600),
      child: SizedBox(
        width: width,
        height: height,
        child: DragTarget<String>(
          onWillAcceptWithDetails: (_) => true,
          onMove: (details) {
            final render =
                gridKey.currentContext!.findRenderObject() as RenderBox;
            final point = render.globalToLocal(details.offset);
            setState(
              () => dropPreview = RocketPart(
                details.data,
                (point.dx / cell).floor(),
                (point.dy / cell).floor(),
              ),
            );
          },
          onLeave: (_) => setState(() => dropPreview = null),
          onAcceptWithDetails: (details) {
            final render =
                gridKey.currentContext!.findRenderObject() as RenderBox;
            final point = render.globalToLocal(details.offset);
            tool = details.data;
            place(
              (point.dx / cell).floor(),
              (point.dy / cell).floor(),
              selectExisting: false,
            );
            setState(() => dropPreview = null);
          },
          builder: (c, accepted, rejected) => GestureDetector(
            key: const ValueKey('assembly-grid'),
            onTapUp: panMode
                ? null
                : (d) => place(
                    (d.localPosition.dx / cell).floor(),
                    (d.localPosition.dy / cell).floor(),
                  ),
            onPanStart: panMode
                ? null
                : (d) {
                    selected = design.at(
                      (d.localPosition.dx / cell).floor(),
                      (d.localPosition.dy / cell).floor(),
                    );
                    if (selected != null) {
                      checkpoint();
                      draggingPart = true;
                    }
                    setState(() {});
                  },
            onPanUpdate: panMode
                ? null
                : (d) {
                    final p = selected;
                    if (p != null) {
                      move(
                        (d.localPosition.dx / cell).floor() - p.x,
                        (d.localPosition.dy / cell).floor() - p.y,
                      );
                    }
                  },
            onPanEnd: panMode
                ? null
                : (_) {
                    draggingPart = false;
                    save();
                  },
            onPanCancel: panMode ? null : () => draggingPart = false,
            child: Semantics(
              container: true,
              image: true,
              label: 'Rocket assembly grid',
              child: CustomPaint(
                key: gridKey,
                painter: AssemblyPainter(
                  design,
                  selected,
                  preview: dropPreview,
                ),
                child: const SizedBox.expand(),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    try {
      final raw = widget.store.readString(
        campaignMode ? 'campaign_assembly_editor_v1' : keyName,
      );
      if (raw != null) {
        final j = jsonDecode(raw);
        design = Assembly(
          (j['design'] as List).map((p) => RocketPart.fromJson(p)).toList(),
          stageOrder: List<String>.from(j['stageOrder'] ?? []),
          legacyFuelRouting:
              j['legacyFuelRouting'] ??
              (j['design'] as List).any((p) => p['id'] == null),
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
    if (campaignMode) {
      final active = widget.programme!.active;
      if (active?['stage'] == 'assembly' &&
          active?['mission'] == widget.missionIndex) {
        campaign = AssemblyCampaign.restore(
          widget.programme!,
          widget.mission!,
          widget.missionIndex!,
          Map<String, dynamic>.from(active!['snapshot']),
        );
        flight = campaign!.flight;
        prediction = flight!.predict();
      } else {
        flight = null;
      }
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
      final stopped = timeWarp.advance(
        flight!,
        dt,
        (step) {
          if (guideEnabled && flight!.body.name == 'Earth') {
            tutor.update(flight!);
          }
          if (campaign == null) {
            flight!.step(step);
          } else {
            campaign!.step(step);
            flight = campaign!.flight;
          }
        },
        canAdvance: () =>
            campaign == null ||
            (!campaign!.settled && campaign!.phase != 'operations'),
      );
      if (stopped != null) {
        paused = true;
        turn = 0;
        message = stopped;
        prediction = flight!.predict();
        save();
      }
      if (flight!.ended ||
          campaign?.phase == 'operations' ||
          (campaign?.settled ?? false)) {
        paused = true;
        guideEnabled = false;
        timeWarp.cancel();
        timeWarp.rate = 1;
        save();
      }
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
      if (campaignMode) {
        campaign?.persist();
        await widget.store.save(widget.programme!);
      }
      await widget.store.writeString(
        campaignMode ? 'campaign_assembly_editor_v1' : keyName,
        jsonEncode({
          'design': design.parts.map((p) => p.toJson()).toList(),
          'flight': campaignMode ? null : flight?.toJson(),
          'stageOrder': design.stageOrder,
          'legacyFuelRouting': design.legacyFuelRouting,
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
    editorTransform.dispose();
    focus.dispose();
    super.dispose();
  }

  void refresh() {
    widget.onInteraction?.call();
    if (flight != null) prediction = flight!.predict();
    setState(() {});
    save();
  }

  void move(int dx, int dy) {
    widget.onInteraction?.call();
    final p = selected;
    if (p == null) return;
    final x = p.x + dx, y = p.y + dy;
    final oldX = p.x, oldY = p.y;
    p.x = x;
    p.y = y;
    final valid = fits(p);
    p.x = oldX;
    p.y = oldY;
    if (!valid) {
      setState(() => message = 'Move blocked: overlap or grid boundary.');
      return;
    }
    if (!draggingPart) checkpoint();
    setState(() {
      p.x = x;
      p.y = y;
    });
    save();
  }

  void place(int x, int y, {bool selectExisting = true}) {
    widget.onInteraction?.call();
    final at = design.at(x, y);
    if (at != null && selectExisting) {
      setState(() => selected = at);
      return;
    }
    final part = RocketPart(tool, x, y);
    if (!fits(part)) {
      setState(() => message = 'Placement blocked: overlap or grid boundary.');
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
      return;
    }
    checkpoint();
    setState(() {
      selected = part;
      design.parts.add(part);
    });
    save();
  }

  Future<void> launch() async {
    final issues = campaignMode
        ? AssemblyCampaign.requirements(
            design,
            widget.mission!,
            widget.programme!,
          )
        : design.problems;
    if (issues.isNotEmpty) {
      setState(() => message = issues.join(' '));
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
      return;
    }
    if (flight != null) return;
    if (campaignMode) {
      try {
        campaign = AssemblyCampaign.launch(
          widget.programme!,
          widget.mission!,
          widget.missionIndex!,
          design,
        );
      } catch (e) {
        setState(() => message = e.toString());
        return;
      }
    }
    if (campaignMode) {
      await widget.store.save(widget.programme!);
      if (!mounted) return;
    }
    setState(() {
      timeWarp.cancel();
      timeWarp.rate = 1;
      flight = campaign?.flight ?? SandboxFlight(design.copy());
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
    f.battery = f.battery.clamp(0, f.craft.batteryCapacity);
    campaign?.refreshReserve();
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
    widget.onInteraction?.call();
    final k = event.logicalKey;
    if (flight != null &&
        [
          LogicalKeyboardKey.keyA,
          LogicalKeyboardKey.keyD,
          LogicalKeyboardKey.keyW,
          LogicalKeyboardKey.keyS,
        ].contains(k)) {
      guideEnabled = false;
    }
    if (flight == null &&
        (HardwareKeyboard.instance.isControlPressed ||
            HardwareKeyboard.instance.isMetaPressed) &&
        k == LogicalKeyboardKey.keyZ) {
      if (HardwareKeyboard.instance.isShiftPressed) {
        redo();
      } else {
        undo();
      }
      return KeyEventResult.handled;
    }
    if (flight == null && k == LogicalKeyboardKey.delete) {
      remove();
      return KeyEventResult.handled;
    }
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
      if (campaign != null && !campaign!.settled) {
        campaign!.settle(
          false,
          'Returned to assembly; launch costs remain spent.',
        );
      }
      setState(() {
        flight = null;
        campaign = null;
        guideEnabled = false;
      });
      save();
    }
  }

  Widget builderTools() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      if (campaignMode) ...[
        Text(
          'CAMPAIGN / ${widget.mission!.name}',
          style: const TextStyle(color: cyan, fontSize: 17),
        ),
        Text(
          widget.mission!.objective,
          style: const TextStyle(fontSize: 12, height: 1.6),
        ),
        Text(
          'Budget \$${widget.mission!.budget}M · Programme \$${widget.programme!.funding.toStringAsFixed(1)}M\nProcurement \$${design.cost.toStringAsFixed(1)}M + \$1M pad fee = \$${(design.cost + 1).toStringAsFixed(1)}M\nRemaining cap \$${(widget.mission!.budget - design.cost - 1).toStringAsFixed(1)}M · Science ≥${widget.mission!.science} · ${widget.mission!.range == 2 ? 'Lunar' : 'Earth'} link',
          style: const TextStyle(fontSize: 12, height: 1.6),
        ),
        const Text(
          'Editing is free. Launch charges the displayed total once; no refunds after launch.',
          style: TextStyle(color: dim, fontSize: 11),
        ),
        TextButton(
          onPressed: () {
            checkpoint();
            setState(() {
              design = Assembly.missionBaseline(widget.missionIndex!);
              selected = null;
            });
            save();
          },
          child: const Text('Load mission baseline'),
        ),
      ],
      if (design.legacyFuelRouting)
        const Text(
          'Legacy fuel routing preserved for this saved design. Load a new baseline to use explicit crossfeed rules.',
          style: TextStyle(fontSize: 10, color: orange),
        ),
      Row(
        children: [
          IconButton(
            tooltip: 'Zoom in',
            onPressed: () => setState(
              () => editorTransform.value = Matrix4.diagonal3Values(
                (editorTransform.value.getMaxScaleOnAxis() * 1.25).clamp(
                  .25,
                  3,
                ),
                (editorTransform.value.getMaxScaleOnAxis() * 1.25).clamp(
                  .25,
                  3,
                ),
                1,
              ),
            ),
            icon: const Icon(Icons.zoom_in),
          ),
          IconButton(
            tooltip: 'Zoom out',
            onPressed: () => setState(
              () => editorTransform.value = Matrix4.diagonal3Values(
                (editorTransform.value.getMaxScaleOnAxis() / 1.25).clamp(
                  .25,
                  3,
                ),
                (editorTransform.value.getMaxScaleOnAxis() / 1.25).clamp(
                  .25,
                  3,
                ),
                1,
              ),
            ),
            icon: const Icon(Icons.zoom_out),
          ),
          const Text('Workspace zoom', style: TextStyle(fontSize: 11)),
        ],
      ),
      label('PART CATALOGUE', color: cyan),
      const Text(
        'Drag a part onto the grid (touch: hold first), or select it then tap a cell.',
        style: TextStyle(color: dim, fontSize: 11),
      ),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (final c in [
              'All',
              ...PartSpec.all.map((s) => s.category).toSet(),
            ])
              Padding(
                padding: const EdgeInsets.only(right: 4),
                child: ChoiceChip(
                  label: Text(c),
                  selected: category == c,
                  onSelected: (_) => setState(() => category = c),
                ),
              ),
          ],
        ),
      ),
      Wrap(
        spacing: 5,
        runSpacing: 2,
        children: [
          for (final spec in PartSpec.all.where(
            (s) => category == 'All' || s.category == category,
          ))
            catalogueItem(spec),
        ],
      ),
      const SizedBox(height: 8),
      Text(
        (selected?.spec ?? PartSpec.get(tool)).purpose,
        style: const TextStyle(fontSize: 12, color: cyan),
      ),
      Text(
        (selected?.spec ?? PartSpec.get(tool)).summary,
        style: const TextStyle(fontSize: 11, height: 1.6),
      ),
      const Text(
        'Edge attachment ports · grid snapping · dry/filled mass differ',
        style: TextStyle(fontSize: 10, color: dim),
      ),
      Wrap(
        children: [
          IconButton(
            tooltip: 'Undo',
            onPressed: undoStack.isEmpty ? null : undo,
            icon: const Icon(Icons.undo),
          ),
          IconButton(
            tooltip: 'Redo',
            onPressed: redoStack.isEmpty ? null : redo,
            icon: const Icon(Icons.redo),
          ),
          TextButton(
            onPressed: () => setState(() => panMode = !panMode),
            child: Text(panMode ? 'Edit parts' : 'Pan workspace'),
          ),
        ],
      ),
      Row(
        children: [
          const Text('Workspace zoom', style: TextStyle(fontSize: 11)),
          Expanded(
            child: Slider(
              value: editorTransform.value.getMaxScaleOnAxis().clamp(.25, 3),
              min: .25,
              max: 3,
              onChanged: (v) {
                setState(
                  () =>
                      editorTransform.value = Matrix4.diagonal3Values(v, v, 1),
                );
              },
            ),
          ),
        ],
      ),
      TextButton(
        onPressed: () => setState(() => editorFitted = false),
        child: const Text('Fit assembly'),
      ),
      Text(
        '${design.parts.length} parts · Dry ${(design.dryMass / 1000).toStringAsFixed(1)} t · Fuel ${(design.fuel / 1000).toStringAsFixed(1)} t · Wet ${(design.mass / 1000).toStringAsFixed(1)} t\nDesign \$${design.cost.toStringAsFixed(1)}M · Thrust ${(design.totalThrust / 1000).round()} kN · Flow ${design.flow.toStringAsFixed(1)} kg/s · TWR ${(design.thrust / max(design.mass * 9.80665, 1)).toStringAsFixed(2)}\nPower ${design.generation.round()} W / ${design.consumption.round()} W · Battery ${design.batteryCapacity.round()} Wh\nScience ${design.science} · Storage ${design.dataCapacity.round()} MB · Link ${design.range == 2
            ? 'lunar'
            : design.range == 1
            ? 'Earth'
            : 'none'}',
        style: const TextStyle(
          fontFamily: 'JetBrainsMono',
          fontSize: 11,
          height: 1.7,
        ),
      ),
      if (selected != null) ...[
        Text(
          'Selected: ${selected!.spec.name} (${selected!.x}, ${selected!.y})',
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
              onPressed: rotate,
              icon: const Icon(Icons.rotate_right),
            ),
            IconButton(
              tooltip: 'Duplicate part',
              onPressed: duplicate,
              icon: const Icon(Icons.copy),
            ),
            IconButton(
              tooltip: 'Remove part',
              onPressed: remove,
              icon: const Icon(Icons.delete_outline),
            ),
          ],
        ),
        if (selected!.kind == 'separator')
          SwitchListTile(
            title: const Text('Allow fuel crossfeed'),
            value: selected!.crossfeed,
            onChanged: (v) {
              checkpoint();
              setState(() => selected!.crossfeed = v);
              save();
            },
          ),
        if (selected!.spec.thrust > 0)
          Text(
            design.exhaustClear(selected!)
                ? 'Exhaust clear'
                : 'Exhaust blocked — stowed until its stage is exposed',
            style: const TextStyle(color: orange, fontSize: 11),
          ),
      ],
      const SizedBox(height: 8),
      label('STAGE ORDER / ALIGNED VACUUM ESTIMATES'),
      for (var i = 0; i < design.separators.length; i++)
        Row(
          children: [
            Expanded(
              child: Text(
                'Stage ${i + 1}: decoupler (${design.separators[i].x},${design.separators[i].y})',
                style: const TextStyle(fontSize: 11),
              ),
            ),
            IconButton(
              tooltip: 'Move stage ${i + 1} earlier',
              onPressed: () => reorderStage(i, i - 1),
              icon: const Icon(Icons.arrow_upward),
            ),
            IconButton(
              tooltip: 'Move stage ${i + 1} later',
              onPressed: () => reorderStage(i, i + 1),
              icon: const Icon(Icons.arrow_downward),
            ),
          ],
        ),
      for (final s in design.stages)
        Text(
          '${(s.mass / 1000).toStringAsFixed(1)} t · ${(s.thrust / 1000).round()} kN · ${(s.fuel / 1000).toStringAsFixed(1)} t fuel · Δv ${s.deltaV.round()} m/s',
          style: const TextStyle(fontSize: 11, color: dim),
        ),
      const Text(
        'Vacuum rocket equation; assumes aligned thrust and complete stage burn. Gravity/drag reduce achieved velocity.',
        style: TextStyle(color: dim, fontSize: 10),
      ),
      const SizedBox(height: 8),
      FilledButton.icon(
        onPressed: launch,
        icon: const Icon(Icons.rocket_launch),
        label: const Text('Launch assembled rocket'),
      ),
      TextButton(
        onPressed: () {
          checkpoint();
          setState(() {
            design = Assembly.starter();
            selected = null;
          });
          save();
        },
        child: const Text('Load two-stage training rocket'),
      ),
      TextButton(
        onPressed: () {
          checkpoint();
          setState(() {
            design = Assembly.orbital();
            selected = null;
            message =
                'Orbital example: launch vertically, begin a gradual gravity turn, separate when booster fuel is exhausted. Use the orbital flight tutorial.';
          });
          save();
        },
        child: const Text('Load orbital example'),
      ),
      TextButton(
        onPressed: () async {
          final confirmed = await showDialog<bool>(
            context: context,
            builder: (c) => AlertDialog(
              title: const Text('Start an empty assembly?'),
              content: const Text('Replace this design? Undo can restore it.'),
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
            checkpoint();
            setState(() {
              design = Assembly([]);
              selected = null;
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
    if (campaign != null &&
        (campaign!.phase == 'operations' || campaign!.settled)) {
      return missionPanel();
    }
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
        Text(
          'Vertical ${f.verticalSpeed.toStringAsFixed(0)} m/s · Horizontal ${sqrt(max(0, f.velocity.dot(f.velocity) - f.verticalSpeed * f.verticalSpeed)).toStringAsFixed(0)} m/s',
          style: const TextStyle(color: cyan, fontSize: 11),
        ),
        Text(
          'Mass ${(f.craft.mass / 1000).toStringAsFixed(2)} t · Available thrust ${(f.craft.totalThrust / 1000).round()} kN · Stage Δv ${f.craft.stageDeltaV.round()} m/s\nBattery ${f.battery.toStringAsFixed(1)} / ${f.craft.batteryCapacity.round()} Wh · Power ${f.craft.generation.round()} / ${f.craft.consumption.round()} W',
          style: const TextStyle(color: dim, fontSize: 10, height: 1.6),
        ),
        Row(
          children: [
            const Text('Throttle'),
            Expanded(
              child: Slider(
                key: const ValueKey('sim-throttle'),
                value: f.throttle,
                onChanged: (v) {
                  guideEnabled = false;
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
                  guideEnabled = false;
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
        if (!map)
          Row(
            children: [
              const Text('Camera zoom'),
              Expanded(
                child: Slider(
                  value: cameraZoom,
                  min: .5,
                  max: 3,
                  onChanged: (v) => setState(() => cameraZoom = v),
                ),
              ),
            ],
          ),
        if (map)
          TextButton(
            onPressed: () => setState(() => mapPan = Offset.zero),
            child: const Text('Centre trajectory map'),
          ),
        enginePanel(),
        if (f.body.name == 'Earth')
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Orbital flight tutor'),
            subtitle: Text(
              guideEnabled
                  ? tutor.instruction
                  : 'Optional feedback pilot. Manual steering or throttle disables it.',
              style: const TextStyle(fontSize: 10),
            ),
            value: guideEnabled,
            onChanged: (v) {
              setState(() => guideEnabled = v);
            },
          ),
        const Text('Time rate', style: TextStyle(fontSize: 11)),
        Wrap(
          spacing: 4,
          children: [
            for (final rate in FlightTimeWarp.rates)
              TextButton(
                style: TextButton.styleFrom(
                  backgroundColor: timeWarp.rate == rate
                      ? cyan.withValues(alpha: .18)
                      : null,
                ),
                onPressed: () => setState(() => timeWarp.rate = rate),
                child: Text('${rate.round()}×'),
              ),
          ],
        ),
        PopupMenuButton<WarpStop>(
          tooltip: 'Choose a flight milestone for automatic pause',
          onSelected: (target) {
            final error = timeWarp.arm(target, f);
            setState(
              () => message =
                  error ??
                  (target == WarpStop.none
                      ? 'Automatic pause cancelled.'
                      : 'Auto-pause armed: ${target.label}. Select a rate and resume flight.'),
            );
          },
          itemBuilder: (_) => [
            for (final target in WarpStop.values)
              PopupMenuItem(value: target, child: Text(target.label)),
          ],
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text(
              'Auto-pause: ${timeWarp.target == WarpStop.none ? "Off" : timeWarp.target.label}',
              style: const TextStyle(color: cyan, fontSize: 12),
            ),
          ),
        ),
        const Text(
          'Fast-forward advances burns, fuel and power. Pause targets do not steer. Reload restores paused at 1×.',
          style: TextStyle(color: dim, fontSize: 10),
        ),
        OutlinedButton.icon(
          onPressed: ignition,
          icon: Icon(paused ? Icons.play_arrow : Icons.pause),
          label: Text(
            paused ? 'Run at ${timeWarp.rate.round()}×' : 'Pause time warp',
          ),
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
                    ? (campaignMode
                          ? 'CAMPAIGN MISSION · Assembled vehicle / actual costs and payload · Restored flights pause'
                          : 'TRAINING SANDBOX · Campaign funds and progress are separate · Autosave; restored flights pause')
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
                          builder: (c, box) => constructionCanvas(box),
                        )
                      : GestureDetector(
                          onPanUpdate: map
                              ? (d) => setState(() => mapPan += d.delta)
                              : null,
                          child: Semantics(
                            container: true,
                            image: true,
                            label: map
                                ? 'Flight trajectory map'
                                : 'Vehicle tracking view',
                            child: CustomPaint(
                              painter: FlightPainter(
                                flight!,
                                prediction,
                                map,
                                map ? zoom : cameraZoom,
                                !paused,
                                pan: mapPan,
                              ),
                              child: const SizedBox.expand(),
                            ),
                          ),
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
