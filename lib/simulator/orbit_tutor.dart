import 'dart:math';
import 'physics.dart';

/// Optional feedback pilot for the reference example. Never writes position,
/// velocity or fuel. The same engine/drag/gravity integrator flies every step.
class OrbitTutor {
  String instruction = 'Launch vertically; clear the atmosphere.';
  void update(SandboxFlight f) {
    if (f.ended) return;
    if (f.apoapsis != null && f.periapsis > 120000 && f.apoapsis! < 450000) {
      f.throttle = 0;
      instruction =
          'Orbit achieved. Throttle zero; inspect apoapsis and periapsis.';
      return;
    }
    if (f.craft.totalThrust == 0 && f.craft.separators.isNotEmpty) {
      f.craft.separate();
      instruction = 'Booster depleted: separate and ignite upper stage.';
    }
    f.throttle = 1;
    if (f.time < 12) {
      f.angle = 0;
      return;
    }
    final r = f.position.length;
    final radial = f.verticalSpeed;
    final tangentialSquared = max(
      0.0,
      f.velocity.dot(f.velocity) - radial * radial,
    );
    final desiredRadial = ((150000 - f.altitude) / 55).clamp(-250.0, 1500.0);
    final required =
        (desiredRadial - radial) / 18 +
        SandboxFlight.mu / (r * r) -
        tangentialSquared / r;
    final available = f.craft.totalThrust / max(f.craft.mass, 1);
    if (available > 0) {
      final angle = acos((required / available).clamp(-1.0, 1.0));
      f.angle = atan2(f.position.x, f.position.y) + angle;
    }
    instruction = f.altitude < 80000
        ? 'Gravity turn: build horizontal velocity while climbing.'
        : 'Raise periapsis: maintain altitude near 150 km with a nearly tangential burn.';
  }
}
