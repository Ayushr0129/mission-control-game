import 'dart:math';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mission_control/simulator/physics.dart';
import 'package:mission_control/simulator/simulator_screen.dart';
import 'package:mission_control/services/storage.dart';

void main() {
  test('Assembly readiness, connections and stage fuel isolation', () {
    final a = Assembly.starter();
    expect(a.problems, isEmpty);
    expect(a.engines.length, 1);
    expect(
      a.tanksFor(a.engines.single).fold<double>(0, (s, p) => s + p.fuel),
      24000,
    );
    final f = SandboxFlight(a)..launched = true;
    f.step(1);
    expect(a.parts.firstWhere((p) => p.kind == 'tank').fuel, 12000);
    final before = a.mass;
    expect(a.separate(), isTrue);
    expect(a.mass, lessThan(before));
    expect(a.parts.length, 4);
    expect(a.engines.length, 1);
    expect(a.tanksFor(a.engines.single).single.fuel, 12000);
    expect(a.separate(), isFalse);
    a.parts.add(RocketPart('tank', 8, 11));
    expect(a.problems.join(), contains('connect'));
  });
  test(
    'Throttle burns fuel; steering changes acceleration; coast burns none',
    () {
      final up = SandboxFlight(Assembly.starter())..launched = true;
      final tilted = SandboxFlight(Assembly.starter())
        ..launched = true
        ..angle = pi / 6;
      up.step(2);
      tilted.step(2);
      expect(up.altitude, greaterThan(20));
      expect(tilted.velocity.x, greaterThan(0));
      expect(up.velocity.x, 0);
      final fuel = up.craft.fuel;
      up.throttle = 0;
      up.step(1);
      expect(up.craft.fuel, fuel);
      final copy = SandboxFlight.fromJson(
        jsonDecode(jsonEncode(tilted.toJson())),
      );
      copy.step(1);
      tilted.step(1);
      expect(copy.toJson(), tilted.toJson());
    },
  );
  test('Circular orbit conserves energy and reports orbital elements', () {
    final f = SandboxFlight(Assembly.starter())
      ..launched = true
      ..throttle = 0;
    final r = SandboxFlight.radius + 300000;
    f.position = Point2(0, r);
    f.velocity = Point2(sqrt(SandboxFlight.mu / r), 0);
    expect(f.apoapsis!, closeTo(300000, .1));
    expect(f.periapsis, closeTo(300000, .1));
    final energy =
        f.velocity.dot(f.velocity) / 2 - SandboxFlight.mu / f.position.length;
    for (var i = 0; i < 600; i++) {
      f.step(1);
    }
    final after =
        f.velocity.dot(f.velocity) / 2 - SandboxFlight.mu / f.position.length;
    expect((after - energy).abs() / energy.abs(), lessThan(1e-6));
    expect(f.ended, isFalse);
    final before = f.toJson();
    expect(f.predict().length, greaterThan(100));
    expect(f.toJson(), before);
  });
  test('Impact terminates flight; escape has no finite apoapsis', () {
    final f = SandboxFlight(Assembly.starter())
      ..launched = true
      ..throttle = 0;
    f.step(5);
    expect(f.ended, isTrue);
    expect(f.altitude, closeTo(0, .001));
    final e = SandboxFlight(Assembly.starter());
    e.velocity = const Point2(12000, 0);
    expect(e.apoapsis, isNull);
    e.position = const Point2(0, SandboxFlight.radius + 200000);
    e.launched = true;
    e.throttle = 0;
    e.step(1);
    expect(e.status, 'Escape trajectory');
  });
  testWidgets('Empty grid constructs the exact three-part flight vehicle', (
    t,
  ) async {
    t.view.physicalSize = const Size(1440, 1000);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.resetPhysicalSize);
    addTearDown(t.view.resetDevicePixelRatio);
    await t.pumpWidget(
      MaterialApp(
        theme: ThemeData.dark(),
        home: SimulatorScreen(store: SaveStore.session()),
      ),
    );
    await t.ensureVisible(find.text('New empty assembly'));
    await t.tap(find.text('New empty assembly'));
    await t.pumpAndSettle();
    await t.tap(find.text('Start empty'));
    await t.pumpAndSettle();
    for (final entry in [('capsule', 1), ('tank', 2), ('engine', 3)]) {
      await t.ensureVisible(find.text(entry.$1).first);
      await t.tap(find.text(entry.$1).first);
      await t.pump();
      final box = t.getRect(find.byKey(const ValueKey('assembly-grid')));
      final cell = box.width / 9;
      await t.tapAt(
        Offset(box.left + 4.5 * cell, box.top + (entry.$2 + .5) * cell),
      );
      await t.pump();
    }
    await t.ensureVisible(find.text('Launch assembled rocket'));
    await t.tap(find.text('Launch assembled rocket'));
    await t.pump();
    final view = t.widget<CustomPaint>(
      find.byWidgetPredicate(
        (w) => w is CustomPaint && w.painter is FlightPainter,
      ),
    );
    final flight = (view.painter as FlightPainter).f;
    expect(flight.craft.parts.map((p) => p.kind), [
      'capsule',
      'tank',
      'engine',
    ]);
    expect(flight.craft.mass, 14350);
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
  });

  testWidgets('Phone builds, launches, maps and stages actual rocket', (
    t,
  ) async {
    t.view.physicalSize = const Size(390, 844);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.resetPhysicalSize);
    addTearDown(t.view.resetDevicePixelRatio);
    final store = SaveStore.session();
    await t.pumpWidget(
      MaterialApp(
        theme: ThemeData.dark(),
        home: SimulatorScreen(store: store),
      ),
    );
    await t.tap(find.text('Launch assembled rocket'));
    await t.pump();
    expect(find.text('Ignite & launch'), findsOneWidget);
    await t.tap(find.text('Ignite & launch'));
    await t.pump(const Duration(seconds: 2));
    await t.ensureVisible(find.text('Trajectory map'));
    await t.tap(find.text('Trajectory map'));
    await t.pump();
    expect(find.text('Vehicle camera'), findsOneWidget);
    await t.ensureVisible(find.text('Separate stage'));
    await t.tap(find.text('Separate stage'));
    await t.pump();
    expect(find.textContaining('Stage separated:'), findsOneWidget);
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
  });
}
