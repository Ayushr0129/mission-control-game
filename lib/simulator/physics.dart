import 'dart:math';

class RocketPart {
  final String kind;
  int x, y, rotation;
  double fuel;
  RocketPart(this.kind, this.x, this.y, {this.rotation = 0, double? fuel})
    : fuel = fuel ?? (kind == 'tank' ? 12000 : 0);
  double get dryMass => switch (kind) {
    'capsule' => 1200,
    'tank' => 650,
    'engine' => 500,
    'separator' => 120,
    'science' => 180,
    _ => 100,
  };
  double get cost => switch (kind) {
    'capsule' => 1.5,
    'tank' => .8,
    'engine' => 1.2,
    'science' => 1.1,
    _ => .2,
  };
  Map<String, dynamic> toJson() => {
    'kind': kind,
    'x': x,
    'y': y,
    'rotation': rotation,
    'fuel': fuel,
  };
  factory RocketPart.fromJson(Map<String, dynamic> j) => RocketPart(
    j['kind'],
    j['x'],
    j['y'],
    rotation: j['rotation'] ?? 0,
    fuel: (j['fuel'] as num).toDouble(),
  );
  RocketPart copy() => RocketPart.fromJson(toJson());
}

class Assembly {
  final List<RocketPart> parts;
  Assembly(this.parts);
  factory Assembly.starter() => Assembly([
    RocketPart('capsule', 4, 1),
    RocketPart('science', 4, 2),
    RocketPart('tank', 4, 3),
    RocketPart('engine', 4, 4),
    RocketPart('separator', 4, 5),
    RocketPart('tank', 4, 6),
    RocketPart('tank', 4, 7),
    RocketPart('engine', 4, 8),
  ]);
  Assembly copy() => Assembly(parts.map((p) => p.copy()).toList());
  double get mass => parts.fold(0, (m, p) => m + p.dryMass + p.fuel);
  double get fuel => parts.fold(0, (m, p) => m + p.fuel);
  double get cost => parts.fold(0, (m, p) => m + p.cost);
  Set<RocketPart> connected() {
    final root = parts.where((p) => p.kind == 'capsule').firstOrNull;
    if (root == null) return {};
    final found = <RocketPart>{root};
    final todo = [root];
    while (todo.isNotEmpty) {
      final a = todo.removeLast();
      for (final b in parts) {
        if (!found.contains(b) && (a.x - b.x).abs() + (a.y - b.y).abs() == 1) {
          found.add(b);
          todo.add(b);
        }
      }
    }
    return found;
  }

  List<RocketPart> get engines => parts
      .where(
        (p) =>
            p.kind == 'engine' &&
            !parts.any(
              (b) =>
                  b.x == p.x - sin(p.rotation * pi / 2).round() &&
                  b.y == p.y + cos(p.rotation * pi / 2).round(),
            ),
      )
      .toList();
  List<RocketPart> tanksFor(RocketPart engine) {
    // Fuel crosses structural joints but not stage separators. Search the graph.
    final found = <RocketPart>{engine};
    final todo = [engine];
    while (todo.isNotEmpty) {
      final a = todo.removeLast();
      for (final b in parts) {
        if (b.kind != 'separator' &&
            !found.contains(b) &&
            (a.x - b.x).abs() + (a.y - b.y).abs() == 1) {
          found.add(b);
          todo.add(b);
        }
      }
    }
    return found.where((p) => p.kind == 'tank' && p.fuel > 0).toList();
  }

  double get thrust => engines
      .where((e) => tanksFor(e).isNotEmpty)
      .fold<double>(0, (sum, e) => sum + 900000 * cos(e.rotation * pi / 2));
  List<String> get problems => [
    if (parts.where((p) => p.kind == 'capsule').length != 1)
      'Use exactly one command capsule.',
    if (connected().length != parts.length)
      'Every part must connect to the capsule through adjacent grid cells.',
    if (parts.map((p) => '${p.x},${p.y}').toSet().length != parts.length)
      'Parts overlap.',
    if (thrust == 0) 'An exposed engine needs fuel in its own stage.',
    if (mass > 0 && thrust / (mass * 9.80665) < 1.05)
      'Pad thrust-to-weight must exceed 1.05. Add an engine or remove mass.',
  ];
  bool separate() {
    final separators = parts.where((p) => p.kind == 'separator').toList()
      ..sort((a, b) => b.y.compareTo(a.y));
    if (separators.isEmpty) return false;
    parts.remove(separators.first);
    final keep = connected();
    parts.removeWhere((p) => !keep.contains(p));
    return true;
  }
}

class Point2 {
  final double x, y;
  const Point2(this.x, this.y);
  Point2 operator +(Point2 b) => Point2(x + b.x, y + b.y);
  Point2 operator -(Point2 b) => Point2(x - b.x, y - b.y);
  Point2 operator *(double f) => Point2(x * f, y * f);
  double get length => sqrt(x * x + y * y);
  double dot(Point2 b) => x * b.x + y * b.y;
}

/// Earth-centred inertial SI model. Spherical, nonrotating Earth; 2D point mass.
/// Velocity Verlet gravity, exponential atmosphere, no lift or structural flex.
class SandboxFlight {
  static const radius = 6371000.0, mu = 3.986004418e14;
  final Assembly craft;
  Point2 position = const Point2(0, radius + 20), velocity = const Point2(0, 0);
  double time = 0, angle = 0, throttle = 1, maxAltitude = 0;
  bool launched = false, ended = false;
  String status = 'Pad hold';
  SandboxFlight(this.craft);
  double get altitude => position.length - radius;
  double get verticalSpeed => velocity.dot(position) * (1 / position.length);
  double get pitch => ((angle * 180 / pi) % 360 + 360) % 360;
  Point2 gravity(Point2 p) => p * (-mu / pow(p.length, 3));
  double get periapsis {
    final r = position.length, v = velocity.length;
    final energy = v * v / 2 - mu / r;
    final h = position.x * velocity.y - position.y * velocity.x;
    final eccentricity = sqrt(max(0, 1 + 2 * energy * h * h / (mu * mu)));
    return h * h / (mu * (1 + eccentricity)) - radius;
  }

  double? get apoapsis {
    final energy = velocity.dot(velocity) / 2 - mu / position.length;
    if (energy >= 0) return null;
    return -mu / energy - (periapsis + radius) - radius;
  }

  void step(double dt) {
    if (!launched || ended || !dt.isFinite || dt <= 0) return;
    // Always bound substeps, including callers using accelerated time.
    final n = (dt / .025).ceil();
    final h = dt / n;
    for (var i = 0; i < n && !ended; i++) {
      var force = const Point2(0, 0);
      for (final engine in craft.engines) {
        final tanks = craft.tanksFor(engine);
        final available = tanks.fold<double>(0, (s, t) => s + t.fuel);
        final requested = 900000 * throttle / (340 * 9.80665) * h;
        final burned = min(available, requested);
        var remaining = burned;
        for (final tank in tanks) {
          final used = min(tank.fuel, remaining);
          tank.fuel -= used;
          remaining -= used;
        }
        final thrust = burned * 340 * 9.80665 / h;
        force =
            force +
            Point2(
                  sin(angle + engine.rotation * pi / 2),
                  cos(angle + engine.rotation * pi / 2),
                ) *
                thrust;
      }
      final speed = velocity.length;
      final density = 1.225 * exp(-max(altitude, 0) / 8500);
      final width = craft.parts.isEmpty
          ? 1
          : craft.parts.map((p) => p.x).reduce(max) -
                craft.parts.map((p) => p.x).reduce(min) +
                1;
      final length = craft.parts.isEmpty
          ? 1
          : craft.parts.map((p) => p.y).reduce(max) -
                craft.parts.map((p) => p.y).reduce(min) +
                1;
      final axial = speed == 0
          ? 1.0
          : (sin(angle) * velocity.x + cos(angle) * velocity.y).abs() / speed;
      final sideways = speed == 0
          ? 0.0
          : (cos(angle) * velocity.x - sin(angle) * velocity.y).abs() / speed;
      final area = 4 * (width * axial + length * sideways);
      final drag =
          velocity * (-.5 * density * .3 * area * speed / max(craft.mass, 1));
      final acceleration = force * (1 / max(craft.mass, 1)) + drag;
      final g = gravity(position);
      final next = position + velocity * h + (g + acceleration) * (.5 * h * h);
      velocity = velocity + (g + gravity(next)) * (.5 * h) + acceleration * h;
      position = next;
      time += h;
      maxAltitude = max(maxAltitude, altitude);
      if (altitude <= 0) {
        ended = true;
        status = speed <= 5
            ? 'Landed'
            : 'Impact — redesign or try a different flight path';
        position = position * (radius / position.length);
      } else if (apoapsis == null && altitude > 100000) {
        status = 'Escape trajectory';
      } else if (apoapsis != null && periapsis > 100000) {
        status = 'Stable orbit — periapsis above 100 km';
      } else if (altitude > 100000) {
        status = 'Space reached — raise periapsis to stay in orbit';
      } else {
        status = 'Atmospheric flight';
      }
    }
  }

  List<Point2> predict({int count = 900, double dt = 8}) {
    var p = position, v = velocity;
    final path = <Point2>[p];
    for (var i = 0; i < count; i++) {
      final g = gravity(p);
      final next = p + v * dt + g * (.5 * dt * dt);
      v = v + (g + gravity(next)) * (.5 * dt);
      p = next;
      path.add(p);
      if (p.length < radius) break;
    }
    return path;
  }

  Map<String, dynamic> toJson() => {
    'parts': craft.parts.map((p) => p.toJson()).toList(),
    'x': position.x,
    'y': position.y,
    'vx': velocity.x,
    'vy': velocity.y,
    'time': time,
    'angle': angle,
    'throttle': throttle,
    'launched': launched,
    'ended': ended,
    'status': status,
    'maxAltitude': maxAltitude,
  };
  factory SandboxFlight.fromJson(Map<String, dynamic> j) {
    final f = SandboxFlight(
      Assembly(
        (j['parts'] as List).map((p) => RocketPart.fromJson(p)).toList(),
      ),
    );
    f.position = Point2((j['x'] as num).toDouble(), (j['y'] as num).toDouble());
    f.velocity = Point2(
      (j['vx'] as num).toDouble(),
      (j['vy'] as num).toDouble(),
    );
    f.time = (j['time'] as num).toDouble();
    f.angle = (j['angle'] as num).toDouble();
    f.throttle = (j['throttle'] as num).toDouble();
    f.launched = j['launched'];
    f.ended = j['ended'];
    f.status = j['status'];
    f.maxAltitude = (j['maxAltitude'] as num).toDouble();
    return f;
  }
}
