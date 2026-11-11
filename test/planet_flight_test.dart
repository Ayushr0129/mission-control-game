import 'dart:math';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mission_control/services/storage.dart';
import 'package:mission_control/simulator/physics.dart';
import 'package:mission_control/simulator/simulator_screen.dart';

void main() {
  test(
    'Gravity points to centre and falls to a quarter at twice the radius',
    () {
      final f = SandboxFlight(Assembly.starter());
      final r = f.body.radius;
      final east = f.gravity(Point2(r, 0));
      final north = f.gravity(Point2(0, r));
      expect(east.x, lessThan(0));
      expect(east.y, 0);
      expect(north.x, 0);
      expect(north.y, lessThan(0));
      expect(north.length, closeTo(9.8, .05));
      expect(
        f.gravity(Point2(0, 2 * r)).length,
        closeTo(north.length / 4, 1e-10),
      );
    },
  );
  test('Atmosphere and drag fade to zero; drag opposes motion', () {
    final f = SandboxFlight(Assembly.starter());
    Point2 at(double height) => Point2(0, f.body.radius + height);
    expect(f.airDensity(at(0)), 1.225);
    expect(f.airDensity(at(10000)), lessThan(f.airDensity(at(0))));
    expect(f.airDensity(at(90000)), lessThan(f.airDensity(at(80000))));
    expect(f.airDensity(at(100000)), 0);
    expect(f.airDensity(at(300000)), 0);
    const velocity = Point2(500, 100);
    expect(f.dragAcceleration(at(10000), velocity).dot(velocity), lessThan(0));
    expect(f.dragAcceleration(at(100000), velocity).length, 0);
    final moon = SandboxFlight(Assembly.starter(), body: CelestialBody.moon);
    expect(moon.airDensity(Point2(0, moon.body.radius)), 0);
  });
  test(
    'Coast preview includes drag, matches propagation and consumes no resources',
    () {
      final f = SandboxFlight(Assembly.starter())
        ..launched = true
        ..enginesOn = false
        ..position = const Point2(0, SandboxFlight.radius + 10000)
        ..velocity = const Point2(500, 0);
      final before = jsonEncode(f.toJson());
      final predicted = f.predict(count: 40, dt: .25).last;
      expect(jsonEncode(f.toJson()), before);
      f.step(10);
      expect((f.position - predicted).length, lessThan(10));
      expect(f.velocity.x, lessThan(500));
    },
  );
  test(
    'Circular orbit preview curves around the planet and updates after a burn',
    () {
      final f = SandboxFlight(Assembly.orbital())..launched = true;
      final r = f.body.radius + 300000;
      f.position = Point2(0, r);
      f.velocity = Point2(sqrt(f.body.mu / r), 0);
      final before = jsonEncode(f.toJson());
      final path = f.predict(count: 800);
      expect(path.any((p) => p.y < 0), true);
      expect(path.any((p) => p.x < 0), true);
      expect(path.every((p) => p.length > f.body.radius + 290000), true);
      expect(jsonEncode(f.toJson()), before);
      f.angle = pi / 2;
      f.step(5);
      final changed = f.predict(count: 800);
      expect((changed[100] - path[100]).length, greaterThan(1000));
    },
  );
  test(
    'Flat save migration preserves hardware, altitude, engine state and local velocity',
    () {
      final flat = SandboxFlight(Assembly.starter(), surfaceMode: true)
        ..launched = true
        ..enginesOn = false
        ..position = Point2(
          SandboxFlight.radius * pi / 2,
          SandboxFlight.radius + 200,
        )
        ..velocity = const Point2(70, -20)
        ..angle = .1;
      final migrated = flat.asPlanetFlight();
      expect(migrated.surfaceMode, false);
      expect(migrated.altitude, closeTo(200, 1e-6));
      expect(migrated.verticalSpeed, closeTo(-20, 1e-6));
      expect(migrated.velocity.x, closeTo(-20, 1e-6));
      expect(migrated.velocity.y, closeTo(-70, 1e-6));
      expect(migrated.enginesOn, false);
      expect(migrated.craft.fuel, flat.craft.fuel);
      expect(
        migrated.craft.parts.map((p) => p.id),
        flat.craft.parts.map((p) => p.id),
      );
      expect(migrated.angle, closeTo(.1 + pi / 2, 1e-8));
    },
  );
  testWidgets(
    'Training defaults to planet flight and camera reaches planet scale',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.resetPhysicalSize);
      addTearDown(t.view.resetDevicePixelRatio);
      await t.pumpWidget(
        MaterialApp(
          theme: ThemeData.dark(),
          home: SimulatorScreen(store: SaveStore.session()),
        ),
      );
      await t.ensureVisible(find.text('Launch assembled rocket'));
      await t.tap(find.text('Launch assembled rocket'));
      await t.pump();
      FlightPainter view() =>
          t
                  .widget<CustomPaint>(
                    find.byWidgetPredicate(
                      (w) => w is CustomPaint && w.painter is FlightPainter,
                    ),
                  )
                  .painter
              as FlightPainter;
      expect(view().f.surfaceMode, false);
      await t.ensureVisible(find.text('Planet scale'));
      await t.tap(find.text('Planet scale'));
      await t.pump();
      expect(view().zoom, 1e-6);
      await t.tap(find.text('Follow rocket'));
      await t.pump();
      expect(view().zoom, .5);
      await t.ensureVisible(find.text('Trajectory map'));
      await t.tap(find.text('Trajectory map'));
      await t.pump();
      expect(view().map, true);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
    },
  );
}
