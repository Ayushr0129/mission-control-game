import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mission_control/services/storage.dart';
import 'package:mission_control/simulator/physics.dart';
import 'package:mission_control/simulator/simulator_screen.dart';
import 'package:mission_control/simulator/time_warp.dart';

void main() {
  Assembly vehicle() => Assembly([
    RocketPart('capsule', 4, 0),
    RocketPart('tank_small', 4, 1),
    RocketPart('engine', 4, 2),
  ]);
  test(
    'Flat flight applies exactly 9.8 downward and preserves coasting fuel',
    () {
      final f = SandboxFlight(vehicle(), surfaceMode: true)
        ..launched = true
        ..enginesOn = false
        ..position = const Point2(1000000, SandboxFlight.radius + 1000)
        ..velocity = const Point2(500, 100);
      final mass = f.craft.mass, fuel = f.craft.fuel;
      f.step(2);
      expect(f.velocity.x, closeTo(500, 1e-8));
      expect(f.velocity.y, closeTo(80.4, 1e-8));
      expect(f.altitude, closeTo(1180.4, 1e-6));
      expect(f.craft.mass, mass);
      expect(f.craft.fuel, fuel);
      expect(f.currentThrust, 0);
    },
  );
  test(
    'Mounted engine thrust follows facing, burns fuel and reduces wet mass',
    () {
      final f = SandboxFlight(vehicle(), surfaceMode: true)
        ..launched = true
        ..angle = pi / 2
        ..position = const Point2(0, SandboxFlight.radius + 1000);
      final mass = f.craft.mass;
      expect(f.currentThrust, 900000);
      f.step(1);
      final burned = 900000 / (340 * 9.80665);
      expect(f.craft.fuel, closeTo(6000 - burned, 1e-7));
      expect(f.craft.mass, closeTo(mass - burned, 1e-7));
      expect(f.velocity.x, greaterThan(100));
      expect(f.velocity.y, closeTo(-9.8, 1e-8));
      f.enginesOn = false;
      final fuel = f.craft.fuel, horizontal = f.velocity.x;
      f.step(1);
      expect(f.time, closeTo(2, 1e-8));
      expect(f.velocity.x, horizontal);
      expect(f.craft.fuel, fuel);
      f.enginesOn = true;
      f.step(.5);
      expect(f.craft.fuel, lessThan(fuel));
    },
  );
  test(
    'Surface saves restore engine state; old saves retain orbital defaults',
    () {
      final f = SandboxFlight(vehicle(), surfaceMode: true)
        ..launched = true
        ..enginesOn = false
        ..position = const Point2(10, SandboxFlight.radius + 100);
      final restored = SandboxFlight.fromJson(
        jsonDecode(jsonEncode(f.toJson())),
      );
      expect(restored.surfaceMode, true);
      expect(restored.enginesOn, false);
      f.step(.5);
      restored.step(.5);
      expect(restored.toJson(), f.toJson());
      final old = f.toJson()
        ..remove('surfaceMode')
        ..remove('enginesOn');
      final legacy = SandboxFlight.fromJson(old);
      expect(legacy.surfaceMode, false);
      expect(legacy.enginesOn, true);
    },
  );
  test('Flat trajectory and impact meet the ground even far from origin', () {
    final f = SandboxFlight(vehicle(), surfaceMode: true)
      ..launched = true
      ..enginesOn = false
      ..position = const Point2(1000000, SandboxFlight.radius + 100);
    final prediction = f.predict();
    expect(prediction.last.y, SandboxFlight.radius);
    expect(prediction.last.x, 1000000);
    expect(FlightTimeWarp().arm(WarpStop.orbit, f), isNotNull);
    f.step(6);
    expect(f.ended, true);
    expect(f.altitude, 0);
    expect(f.status, contains('Impact'));
    expect(f.currentThrust, 0);
  });
  testWidgets('FLIGHT HUD stays visible and Space toggles engines, P pauses', (
    t,
  ) async {
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
    final painter =
        t
                .widget<CustomPaint>(
                  find.byWidgetPredicate(
                    (w) => w is CustomPaint && w.painter is FlightPainter,
                  ),
                )
                .painter
            as FlightPainter;
    final f = painter.f;
    expect(f.surfaceMode, true);
    await t.sendKeyEvent(LogicalKeyboardKey.space);
    await t.pump();
    expect(f.launched, true);
    expect(f.enginesOn, true);
    f.step(1);
    await t.sendKeyEvent(LogicalKeyboardKey.space);
    await t.pump();
    expect(f.enginesOn, false);
    expect(
      t.widget<Text>(find.byKey(const ValueKey('flight-hud'))).data,
      contains('LIVE · ENGINES OFF'),
    );
    final fuel = f.craft.fuel;
    f.step(.5);
    expect(f.craft.fuel, fuel);
    await t.sendKeyEvent(LogicalKeyboardKey.space);
    await t.pump();
    expect(f.enginesOn, true);
    final angle = f.angle;
    await t.sendKeyDownEvent(LogicalKeyboardKey.keyD);
    await t.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 80)),
    );
    await t.pump(const Duration(milliseconds: 80));
    await t.sendKeyUpEvent(LogicalKeyboardKey.keyD);
    expect(f.angle, greaterThan(angle));
    final right = f.angle;
    await t.sendKeyDownEvent(LogicalKeyboardKey.keyA);
    await t.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 80)),
    );
    await t.pump(const Duration(milliseconds: 80));
    await t.sendKeyUpEvent(LogicalKeyboardKey.keyA);
    expect(f.angle, lessThan(right));
    await t.sendKeyEvent(LogicalKeyboardKey.keyP);
    await t.pump();
    expect(
      t.widget<Text>(find.byKey(const ValueKey('flight-hud'))).data,
      contains('PAUSED'),
    );
    await t.ensureVisible(find.text('Run at 1×'));
    final hud = t.getRect(find.byKey(const ValueKey('flight-hud')));
    expect(hud.top, greaterThan(0));
    expect(hud.bottom, lessThan(844));
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
  });
}
