import 'dart:math';
import 'physics.dart';

enum WarpStop {
  none('No automatic pause'),
  minute('In 1 minute'),
  fiveMinutes('In 5 minutes'),
  space('100 km altitude'),
  orbit('Stable orbit'),
  apoapsis('Next apoapsis'),
  periapsis('Next periapsis');

  final String label;
  const WarpStop(this.label);
}

/// Advances the normal integrator, never teleports to a predicted state.
/// Event checks are at most 0.1 simulated seconds apart at every speed.
class FlightTimeWarp {
  static const rates = [1.0, 2.0, 5.0, 10.0, 25.0];
  double rate = 1;
  WarpStop target = WarpStop.none;
  double deadline = 0;

  String? arm(WarpStop next, SandboxFlight flight) {
    if (next == WarpStop.space && flight.altitude >= 100000) {
      return 'Already above 100 km. Choose another pause target.';
    }
    if (next == WarpStop.orbit &&
        flight.apoapsis != null &&
        flight.periapsis > 100000) {
      return 'Already in a stable orbit. Choose another pause target.';
    }
    if ((next == WarpStop.apoapsis || next == WarpStop.periapsis) &&
        (flight.apoapsis == null || flight.altitude < 1000)) {
      return 'An apsis target needs a bound trajectory above 1 km.';
    }
    target = next;
    deadline = flight.time + (next == WarpStop.fiveMinutes ? 300 : 60);
    return null;
  }

  void cancel() => target = WarpStop.none;

  String? advance(
    SandboxFlight flight,
    double realSeconds,
    void Function(double) step, {
    bool Function()? canAdvance,
  }) {
    if (!realSeconds.isFinite ||
        realSeconds <= 0 ||
        !flight.launched ||
        flight.ended) {
      return null;
    }
    var remaining = realSeconds * rate;
    while (remaining > 1e-9 && !flight.ended && (canAdvance?.call() ?? true)) {
      final previousVertical = flight.verticalSpeed;
      var dt = min(.1, remaining);
      if (target == WarpStop.minute || target == WarpStop.fiveMinutes) {
        dt = min(dt, max(0, deadline - flight.time));
      }
      if (dt > 1e-9) step(dt);
      remaining -= dt;
      final reached = switch (target) {
        WarpStop.none => false,
        WarpStop.minute ||
        WarpStop.fiveMinutes => flight.time >= deadline - 1e-8,
        WarpStop.space => flight.altitude >= 100000,
        WarpStop.orbit => flight.apoapsis != null && flight.periapsis > 100000,
        WarpStop.apoapsis => previousVertical > 0 && flight.verticalSpeed <= 0,
        WarpStop.periapsis => previousVertical < 0 && flight.verticalSpeed >= 0,
      };
      if (reached && !flight.ended) {
        final label = target.label;
        cancel();
        rate = 1;
        return 'Auto-paused: $label. Rate reset to 1×.';
      }
      if (dt <= 1e-9) break;
    }
    return null;
  }
}
