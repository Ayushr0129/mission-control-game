import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mission_control/services/storage.dart';
import 'package:mission_control/simulator/simulator_screen.dart';

void main() {
  Future<void> mount(WidgetTester t, {bool phone = false}) async {
    t.view.physicalSize = phone ? const Size(390, 844) : const Size(1440, 1000);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.resetPhysicalSize);
    addTearDown(t.view.resetDevicePixelRatio);
    await t.pumpWidget(
      MaterialApp(
        theme: ThemeData.dark(),
        home: SimulatorScreen(store: SaveStore.session()),
      ),
    );
    await t.pump();
  }

  AssemblyPainter painter(WidgetTester t) =>
      (t
              .widget<CustomPaint>(
                find.byWidgetPredicate(
                  (w) => w is CustomPaint && w.painter is AssemblyPainter,
                ),
              )
              .painter
          as AssemblyPainter);
  Offset cell(WidgetTester t, int x, int y) {
    final render = t.renderObject<RenderBox>(
      find.byKey(const ValueKey('assembly-grid')),
    );
    return render.localToGlobal(Offset((x + .5) * 48, (y + .5) * 48));
  }

  Future<void> press(WidgetTester t, Finder f) async {
    await t.ensureVisible(f);
    await t.tap(f);
    await t.pump();
  }

  testWidgets('Editing supports duplicate, undo/redo, rotation and pan', (
    t,
  ) async {
    await mount(t);
    await t.tapAt(cell(t, 4, 3));
    await t.pump();
    final original = painter(t).design.mass;
    await press(t, find.byTooltip('Duplicate part'));
    expect(painter(t).design.parts.length, 9);
    expect(painter(t).design.mass, greaterThan(original));
    await press(t, find.byTooltip('Undo'));
    expect(painter(t).design.parts.length, 8);
    await press(t, find.byTooltip('Redo'));
    expect(painter(t).design.parts.length, 9);
    await t.tapAt(cell(t, 4, 3));
    await t.pump();
    await press(t, find.byTooltip('Rotate part'));
    expect(painter(t).selected!.rotation, 1);
    await press(t, find.text('Pan workspace'));
    final controller = t
        .widget<InteractiveViewer>(find.byType(InteractiveViewer))
        .transformationController!;
    final before = controller.value.clone();
    await t.dragFrom(cell(t, 4, 3), const Offset(50, 25));
    await t.pump();
    expect(controller.value, isNot(equals(before)));
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
  });
  for (final phone in [false, true]) {
    testWidgets(
      '${phone ? 'Touch' : 'Mouse'} catalogue drag snaps a new part onto grid',
      (t) async {
        await mount(t, phone: phone);
        final label = find.text('Transfer tank').first;
        await t.ensureVisible(label);
        await t.pump();
        final start = t.getCenter(label), end = cell(t, 3, 3);
        final g = await t.startGesture(
          start,
          kind: phone ? PointerDeviceKind.touch : PointerDeviceKind.mouse,
        );
        if (phone) await t.pump(const Duration(milliseconds: 650));
        await g.moveBy(const Offset(0, -10));
        await t.pump();
        await g.moveTo(end);
        await t.pump();
        await g.up();
        await t.pump();
        final part = painter(t).design.at(3, 3);
        expect(part?.kind, 'tank_small');
        expect(painter(t).design.parts.length, 9);
        expect(t.takeException(), isNull);
        await t.pumpWidget(const SizedBox());
      },
    );
  }
}
