import 'dart:math';
import 'package:flutter_test/flutter_test.dart';
import 'package:mission_control/simulator/physics.dart';
import 'package:mission_control/simulator/orbit_tutor.dart';
import 'package:mission_control/simulator/time_warp.dart';

void main() {
  SandboxFlight coasting() {
    final f = SandboxFlight(Assembly.orbital())..launched = true;
    f.position = const Point2(0, 6671000);
    f.velocity = Point2(sqrt(SandboxFlight.mu / f.position.length), 0);
    f.throttle = 0;
    return f;
  }

  test('Every rate advances ordinary simulation by the selected factor', () {
    for (final rate in FlightTimeWarp.rates) {
      final f = coasting();
      FlightTimeWarp()
        ..rate = rate
        ..advance(f, 1, f.step);
      expect(f.time, closeTo(rate, 1e-7));
      expect(f.ended, false);
    }
  });

  test('25x burns the same actual fuel and power as 25 seconds at 1x', () {
    final fast = SandboxFlight(Assembly.orbital())..launched = true;
    final normal = SandboxFlight(Assembly.orbital())..launched = true;
    final warp = FlightTimeWarp()..rate = 25;
    warp.advance(fast, 1, fast.step);
    for (var i = 0; i < 250; i++) {
      normal.step(.1);
    }
    expect(fast.craft.fuel, closeTo(normal.craft.fuel, 1e-6));
    expect(fast.altitude, closeTo(normal.altitude, .01));
    expect(fast.velocity.length, closeTo(normal.velocity.length, .001));
    expect(fast.battery, closeTo(normal.battery, 1e-6));
  });

  test('Timed targets stop exactly, clear the target and reset the rate', () {
    for (final target in [WarpStop.minute, WarpStop.fiveMinutes]) {
      final f = coasting();
      final warp = FlightTimeWarp()..rate = 25;
      expect(warp.arm(target, f), isNull);
      final result = warp.advance(f, 20, f.step);
      expect(result, contains('Auto-paused'));
      expect(f.time, closeTo(target == WarpStop.minute ? 60 : 300, 1e-7));
      expect(warp.target, WarpStop.none);
      expect(warp.rate, 1);
    }
  });

  test(
    'Apsis targets detect radial-velocity crossings without teleporting',
    () {
      for (final target in [WarpStop.apoapsis, WarpStop.periapsis]) {
        final f = coasting();
        f.velocity = Point2(
          f.velocity.x,
          target == WarpStop.apoapsis ? 100 : -100,
        );
        final warp = FlightTimeWarp()..rate = 25;
        expect(warp.arm(target, f), isNull);
        String? result;
        for (var i = 0; i < 300 && result == null; i++) {
          result = warp.advance(f, 1, f.step);
        }
        expect(result, contains(target.label));
        expect(f.time, greaterThan(100));
        expect(f.verticalSpeed.abs(), lessThan(1));
        expect(f.ended, false);
      }
    },
  );

  test(
    '25x surface launch reaches the real stable-orbit stop with the tutor',
    () {
      final f = SandboxFlight(Assembly.orbital())..launched = true;
      final tutor = OrbitTutor();
      final warp = FlightTimeWarp()..rate = 25;
      expect(warp.arm(WarpStop.apoapsis, f), isNotNull);
      expect(warp.arm(WarpStop.orbit, f), isNull);
      String? result;
      for (var i = 0; i < 600 && result == null && !f.ended; i++) {
        result = warp.advance(f, .08, (dt) {
          tutor.update(f);
          f.step(dt);
        });
      }
      expect(result, contains('Stable orbit'));
      expect(f.periapsis, greaterThan(100000));
      expect(f.apoapsis, lessThan(450000));
      expect(f.craft.fuel, greaterThan(0));
      expect(f.ended, false);
    },
  );

  test('Fast-forward honours campaign boundaries and terminal impact', () {
    final f = coasting();
    final warp = FlightTimeWarp()..rate = 25;
    warp.advance(f, 1, f.step, canAdvance: () => f.time < .5);
    expect(f.time, closeTo(.5, 1e-7));
    final falling = SandboxFlight(Assembly.starter())..launched = true;
    falling.throttle = 0;
    warp.advance(falling, 10, falling.step);
    expect(falling.ended, true);
    expect(falling.time, lessThan(10));
    expect(falling.altitude, closeTo(0, 1e-6));
  });
}
