import 'dart:math';
import 'engineering.dart';

/// Single-stage launch surrogate with optional inert interstage jettison.
/// Integrates thrust / mass, variable gravity, mass flow and quadratic drag.
/// Guidance is intentionally simplified; no N-body or full orbital propagator.
class Flight {
  double time = 0,
      altitude = 0,
      vertical = 0,
      horizontal = 0,
      fuel = 180000,
      throttle = 1,
      guidance = 0;
  bool separated = false, started = false;
  String? failure;
  final double payload;
  Flight(this.payload);
  double get mass => fuel + 8500 + payload + (separated ? 0 : 6000);
  double get fuelFraction => fuel / 180000;
  double get speed => sqrt(vertical * vertical + horizontal * horizontal);
  double get circularSpeed => sqrt(3.986004418e14 / (6371000 + altitude));
  bool achieved(bool orbit) =>
      altitude >= 100000 &&
      (!orbit ||
          (horizontal >= 7600 && altitude < 450000 && vertical.abs() < 2500));
  bool get canSeparate => time >= 80 && !separated;
  bool separate() {
    if (!canSeparate) return false;
    separated = true;
    return true;
  }

  void step(double dt) {
    if (!started || failure != null || !dt.isFinite || dt <= 0) return;
    time += dt;
    final burn = min(fuel, 3000000 * throttle / (390 * g0) * dt);
    final actual = burn / (3000000 / (390 * g0) * dt);
    fuel -= burn;
    final gravity = g0 * pow(6371000 / (6371000 + max(altitude, 0)), 2);
    // A timed gravity turn is a training aid; the player can bias pitch ±15°.
    final angle =
        ((90 - (time - 35).clamp(0, 120) * .75) + guidance).clamp(0, 90) *
        pi /
        180;
    final acceleration = 3000000 * actual / mass;
    final drag =
        .5 * 1.225 * exp(-max(altitude, 0) / 8500) * speed * speed * 4 / mass;
    vertical +=
        (acceleration * sin(angle) -
            gravity +
            horizontal * horizontal / (6371000 + max(altitude, 0)) -
            (speed > 0 ? drag * vertical / speed : 0)) *
        dt;
    horizontal +=
        (acceleration * cos(angle) -
            (speed > 0 ? drag * horizontal / speed : 0)) *
        dt;
    altitude += vertical * dt;
    if (altitude < 0) {
      altitude = 0;
      vertical = 0;
      if (time > 12) {
        failure =
            'The vehicle returned to the pad. Thrust must overcome weight: increase throttle for liftoff.';
      }
    }
    if (fuel <= 0) {
      failure =
          'Launch propellant depleted. Gravity losses grow during long, low-throttle ascents. Try full thrust and separate the interstage when available.';
    }
    if (time > 340) {
      failure =
          'The launch window expired. Use a higher throttle and follow the gravity-turn guidance.';
    }
  }

  Map<String, dynamic> toJson() => {
    'time': time,
    'altitude': altitude,
    'vertical': vertical,
    'horizontal': horizontal,
    'fuel': fuel,
    'throttle': throttle,
    'guidance': guidance,
    'separated': separated,
    'started': started,
    'failure': failure,
  };
  void restore(Map<String, dynamic> j) {
    time = (j['time'] as num).toDouble();
    altitude = (j['altitude'] as num).toDouble();
    vertical = (j['vertical'] as num).toDouble();
    horizontal = (j['horizontal'] as num).toDouble();
    fuel = (j['fuel'] as num).toDouble();
    throttle = (j['throttle'] as num).toDouble();
    guidance = (j['guidance'] as num).toDouble();
    separated = j['separated'];
    started = j['started'];
    failure = j['failure'];
  }
}
