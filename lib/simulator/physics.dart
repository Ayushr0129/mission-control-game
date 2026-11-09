import 'dart:math';
import 'catalogue.dart';

class RocketPart {
  static int _next = 0;
  final String kind, id;
  int x, y, rotation;
  double fuel;
  bool crossfeed, enabled;
  RocketPart(
    this.kind,
    this.x,
    this.y, {
    this.rotation = 0,
    double? fuel,
    String? id,
    this.crossfeed = false,
    this.enabled = true,
  }) : id = id ?? 'p${DateTime.now().microsecondsSinceEpoch}_${_next++}',
       fuel = fuel ?? PartSpec.get(kind).capacity;
  PartSpec get spec => PartSpec.get(kind);
  double get dryMass => spec.mass;
  double get cost => spec.cost;
  int get width => rotation.isEven ? spec.width : spec.height;
  int get height => rotation.isEven ? spec.height : spec.width;
  bool contains(int cx, int cy) =>
      cx >= x && cx < x + width && cy >= y && cy < y + height;
  bool overlaps(RocketPart b) =>
      x < b.x + b.width &&
      x + width > b.x &&
      y < b.y + b.height &&
      y + height > b.y;
  bool touches(RocketPart b) =>
      ((x + width == b.x || b.x + b.width == x) &&
          y < b.y + b.height &&
          y + height > b.y) ||
      ((y + height == b.y || b.y + b.height == y) &&
          x < b.x + b.width &&
          x + width > b.x);
  Map<String, dynamic> toJson() => {
    'id': id,
    'kind': kind,
    'x': x,
    'y': y,
    'rotation': rotation,
    'fuel': fuel,
    'crossfeed': crossfeed,
    'enabled': enabled,
  };
  factory RocketPart.fromJson(Map<String, dynamic> j) => RocketPart(
    j['kind'],
    j['x'],
    j['y'],
    id: j['id'],
    rotation: j['rotation'] ?? 0,
    fuel: (j['fuel'] as num).toDouble(),
    crossfeed: j['crossfeed'] ?? false,
    enabled: j['enabled'] ?? true,
  );
  RocketPart copy() => RocketPart.fromJson(toJson());
}

class Assembly {
  final List<RocketPart> parts;
  final List<String> stageOrder;
  final bool legacyFuelRouting;
  String _graphKey = '';
  double lastBurnSeconds = 0;
  Map<RocketPart, List<RocketPart>> _graph = {};
  List<RocketPart> neighbors(RocketPart part) {
    final key = parts
        .map(
          (p) => '${identityHashCode(p)}:${p.x}:${p.y}:${p.width}:${p.height}',
        )
        .join('|');
    if (key != _graphKey) {
      _graphKey = key;
      _graph = {
        for (final p in parts)
          p: parts.where((b) => b != p && p.touches(b)).toList(),
      };
    }
    return _graph[part] ?? [];
  }

  Assembly(
    this.parts, {
    List<String>? stageOrder,
    this.legacyFuelRouting = false,
  }) : stageOrder = stageOrder ?? [];
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
  factory Assembly.orbital() => Assembly([
    RocketPart('capsule', 4, 0),
    RocketPart('science', 3, 0),
    RocketPart('solar', 2, 0),
    RocketPart('antenna', 5, 0),
    RocketPart('battery', 6, 0),
    RocketPart('tank_small', 4, 1),
    RocketPart('tank_small', 4, 2),
    RocketPart('vacuum', 4, 3),
    RocketPart('separator', 4, 4),
    RocketPart('tank', 4, 5),
    RocketPart('tank', 4, 6),
    RocketPart('tank', 4, 7),
    RocketPart('engine', 4, 8),
  ]);
  factory Assembly.missionBaseline(int index) {
    if (index == 0) {
      return Assembly.starter()
        ..parts.addAll([
          RocketPart('solar', 3, 1),
          RocketPart('antenna', 5, 1),
        ]);
    }
    final a = Assembly.orbital();
    if (index >= 2) {
      for (var i = 0; i < a.parts.length; i++) {
        final p = a.parts[i];
        final kind = switch (p.kind) {
          'vacuum' => 'thermal',
          'science' => 'spectrometer',
          'solar' => 'solar_large',
          'antenna' => 'dish',
          _ => p.kind,
        };
        if (kind != p.kind) {
          a.parts[i] = RocketPart(
            kind,
            p.x,
            p.y,
            id: p.id,
            rotation: p.rotation,
          );
        }
      }
    }
    if (index == 3) a.parts.add(RocketPart('legs', 6, 1));
    return a;
  }
  Assembly copy() => Assembly(
    parts.map((p) => p.copy()).toList(),
    stageOrder: List.of(stageOrder),
    legacyFuelRouting: legacyFuelRouting,
  );
  RocketPart? at(int x, int y) =>
      parts.where((p) => p.contains(x, y)).firstOrNull;
  double get dryMass => parts.fold(0, (m, p) => m + p.dryMass);
  double get mass => dryMass + fuel;
  double get fuel => parts.fold(0, (m, p) => m + p.fuel);
  double get cost => parts.fold(0, (m, p) => m + p.cost);
  double get generation => parts.fold(0, (m, p) => m + p.spec.power);
  double get consumption => parts.fold(
    0,
    (m, p) => m + (p.spec.thrust > 0 && !p.enabled ? 0 : p.spec.draw),
  );
  double get batteryCapacity => parts.fold(0, (m, p) => m + p.spec.battery);
  double get dataCapacity => parts.fold(0, (m, p) => m + p.spec.storage);
  double get dataRate => parts.fold(0, (m, p) => m + p.spec.dataRate);
  double get downlink => parts.fold(0, (m, p) => max(m, p.spec.downlink));
  int get science => parts.fold(0, (m, p) => m + p.spec.science);
  int get range => parts.fold(0, (m, p) => max(m, p.spec.range));
  Set<RocketPart> connected() {
    final root = parts.where((p) => p.kind == 'capsule').firstOrNull;
    if (root == null) return {};
    final found = <RocketPart>{root}, todo = [root];
    while (todo.isNotEmpty) {
      final a = todo.removeLast();
      for (final b in neighbors(a)) {
        if (!found.contains(b)) {
          found.add(b);
          todo.add(b);
        }
      }
    }
    return found;
  }

  bool exhaustClear(RocketPart p) =>
      at(
        p.x - sin(p.rotation * pi / 2).round(),
        p.y + cos(p.rotation * pi / 2).round(),
      ) ==
      null;
  List<RocketPart> get engines => parts
      .where((p) => p.spec.thrust > 0 && p.enabled && exhaustClear(p))
      .toList();
  List<RocketPart> tanksFor(RocketPart engine) {
    final found = <RocketPart>{engine}, todo = [engine];
    while (todo.isNotEmpty) {
      final a = todo.removeLast();
      for (final b in neighbors(a)) {
        if ((legacyFuelRouting
                ? b.kind != 'separator'
                : (b.spec.capacity > 0 || b.spec.thrust > 0 || b.crossfeed)) &&
            !found.contains(b) &&
            a.touches(b)) {
          found.add(b);
          todo.add(b);
        }
      }
    }
    return found
        .where(
          (p) =>
              p.spec.capacity > 0 &&
              p.spec.propellant == engine.spec.propellant &&
              p.fuel > 0,
        )
        .toList()
      ..sort((a, b) => b.y.compareTo(a.y));
  }

  List<RocketPart> get activeEngines =>
      engines.where((e) => tanksFor(e).isNotEmpty).toList();
  double get thrust => activeEngines.fold(
    0,
    (m, e) => m + e.spec.thrust * cos(e.rotation * pi / 2),
  );
  double get totalThrust => activeEngines.fold(0, (m, e) => m + e.spec.thrust);
  double get flow => activeEngines.fold(
    0,
    (m, e) => m + e.spec.thrust / (e.spec.isp * 9.80665),
  );
  double get effectiveIsp => flow > 0 ? totalThrust / (flow * 9.80665) : 0;
  Set<RocketPart> get feedingTanks => {
    for (final e in activeEngines) ...tanksFor(e),
  };
  double get stageFuel => feedingTanks.fold(0, (m, p) => m + p.fuel);
  double get stageDeltaV => mass > stageFuel && effectiveIsp > 0
      ? effectiveIsp * 9.80665 * log(mass / (mass - stageFuel))
      : 0;
  bool expendDeltaV(double dv) {
    lastBurnSeconds = 0;
    if (!dv.isFinite || dv < 0) return false;
    var remaining = dv;
    for (var step = 0; step < 10000 && remaining > .001; step++) {
      final active = activeEngines;
      if (active.isEmpty) return false;
      final totalFlow = flow;
      final fx = active.fold<double>(
        0,
        (s, e) => s + e.spec.thrust * sin(e.rotation * pi / 2),
      );
      final fy = active.fold<double>(
        0,
        (s, e) => s + e.spec.thrust * cos(e.rotation * pi / 2),
      );
      final exhaustVelocity = sqrt(fx * fx + fy * fy) / totalFlow;
      if (exhaustVelocity < 1) return false;
      final request = mass * (1 - exp(-min(remaining, 10) / exhaustVelocity));
      var fraction = 1.0;
      final types = active.map((e) => e.spec.propellant).toSet();
      for (final type in types) {
        final rate = active
            .where((e) => e.spec.propellant == type)
            .fold<double>(
              0,
              (s, e) => s + e.spec.thrust / (e.spec.isp * 9.80665),
            );
        final tanks = feedingTanks.where((t) => t.spec.propellant == type);
        final available = tanks.fold<double>(0, (s, t) => s + t.fuel);
        fraction = min(fraction, available / (request * rate / totalFlow));
      }
      if (fraction <= 1e-10) return false;
      final before = mass;
      final tanks = feedingTanks;
      for (final type in types) {
        final rate = active
            .where((e) => e.spec.propellant == type)
            .fold<double>(
              0,
              (s, e) => s + e.spec.thrust / (e.spec.isp * 9.80665),
            );
        var amount = request * fraction * rate / totalFlow;
        for (final t in tanks.where((t) => t.spec.propellant == type)) {
          final used = min(t.fuel, amount);
          t.fuel -= used;
          amount -= used;
        }
      }
      lastBurnSeconds += (before - mass) / totalFlow;
      remaining -= exhaustVelocity * log(before / mass);
    }
    return remaining <= .001;
  }

  List<RocketPart> get separators {
    final list = parts.where((p) => p.kind == 'separator').toList()
      ..sort((a, b) {
        final ai = stageOrder.indexOf(a.id), bi = stageOrder.indexOf(b.id);
        if (ai >= 0 || bi >= 0) {
          return (ai < 0 ? 999 : ai).compareTo(bi < 0 ? 999 : bi);
        }
        return b.y.compareTo(a.y);
      });
    return list;
  }

  List<({double mass, double fuel, double thrust, double deltaV})> get stages {
    final a = copy();
    final result =
        <({double mass, double fuel, double thrust, double deltaV})>[];
    for (var i = 0; i <= parts.length; i++) {
      result.add((
        mass: a.mass,
        fuel: a.stageFuel,
        thrust: a.totalThrust,
        deltaV: a.stageDeltaV,
      ));
      for (final t in a.feedingTanks) {
        t.fuel = 0;
      }
      if (!a.separate()) break;
    }
    return result;
  }

  Set<String> get invalidIds {
    final connectedParts = connected();
    return {
      for (final p in parts)
        if (!connectedParts.contains(p) ||
            parts.any((b) => b != p && p.overlaps(b)))
          p.id,
    };
  }

  List<String> get problems => [
    if (parts.where((p) => p.kind == 'capsule').length != 1)
      'Use exactly one command capsule.',
    if (connected().length != parts.length)
      'Every part must connect to the capsule through edge attachment points.',
    if (parts.any((p) => parts.any((b) => b != p && p.overlaps(b))))
      'Parts overlap; highlighted parts must be moved.',
    if (thrust <= 0)
      'An exposed engine needs compatible fuel in its own stage; inspect exhaust and crossfeed.',
    if (mass > 0 && thrust / (mass * 9.80665) < 1.05)
      'Pad thrust-to-weight must exceed 1.05. Add thrust or remove mass.',
  ];
  bool separate([String? id]) {
    final list = separators;
    if (list.isEmpty) return false;
    final target = id == null
        ? list.first
        : parts.where((p) => p.id == id && p.kind == 'separator').firstOrNull;
    if (target == null) return false;
    parts.remove(target);
    stageOrder.remove(target.id);
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

class CelestialBody {
  final String name;
  final double radius, mu;
  final bool atmosphere;
  const CelestialBody(this.name, this.radius, this.mu, this.atmosphere);
  static const moonRadius = 1737400.0;
  static const earth = CelestialBody('Earth', 6371000, 3.986004418e14, true);
  static const moon = CelestialBody('Moon', moonRadius, 4.9048695e12, false);
}

/// Earth-centred inertial SI model. Spherical, nonrotating Earth; 2D point mass.
/// Velocity Verlet gravity, exponential atmosphere, no lift or structural flex.
class SandboxFlight {
  static const radius = 6371000.0, mu = 3.986004418e14;
  final Assembly craft;
  final CelestialBody body;
  Point2 position = const Point2(0, radius + 20), velocity = const Point2(0, 0);
  double time = 0, angle = 0, throttle = 1, maxAltitude = 0;
  bool launched = false, ended = false;
  String status = 'Pad hold';
  double battery = 0, generationFactor = 1, loadFactor = 1;
  SandboxFlight(this.craft, {this.body = CelestialBody.earth}) {
    position = Point2(0, body.radius + 20);
    battery = craft.batteryCapacity;
  }
  double get altitude => position.length - body.radius;
  double get verticalSpeed => velocity.dot(position) * (1 / position.length);
  double get pitch => ((angle * 180 / pi) % 360 + 360) % 360;
  Point2 gravity(Point2 p) => p * (-body.mu / pow(p.length, 3));
  double get periapsis {
    final r = position.length, v = velocity.length;
    final energy = v * v / 2 - body.mu / r;
    final h = position.x * velocity.y - position.y * velocity.x;
    final eccentricity = sqrt(
      max(0, 1 + 2 * energy * h * h / (body.mu * body.mu)),
    );
    return h * h / (body.mu * (1 + eccentricity)) - body.radius;
  }

  double? get apoapsis {
    final energy = velocity.dot(velocity) / 2 - body.mu / position.length;
    if (energy >= 0) return null;
    return -body.mu / energy - (periapsis + body.radius) - body.radius;
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
        final requested =
            engine.spec.thrust *
            (throttle == 0 ? 0 : max(throttle, engine.spec.minThrottle)) /
            (engine.spec.isp * 9.80665) *
            h;
        final burned = min(available, requested);
        var remaining = burned;
        for (final tank in tanks) {
          final used = min(tank.fuel, remaining);
          tank.fuel -= used;
          remaining -= used;
        }
        final thrust = burned * engine.spec.isp * 9.80665 / h;
        force =
            force +
            Point2(
                  sin(angle + engine.rotation * pi / 2),
                  cos(angle + engine.rotation * pi / 2),
                ) *
                thrust;
      }
      final speed = velocity.length;
      final density = body.atmosphere
          ? 1.225 * exp(-max(altitude, 0) / 8500)
          : 0.0;
      final width = craft.parts.isEmpty
          ? 1
          : craft.parts.map((p) => p.x + p.width).reduce(max) -
                craft.parts.map((p) => p.x).reduce(min);
      final length = craft.parts.isEmpty
          ? 1
          : craft.parts.map((p) => p.y + p.height).reduce(max) -
                craft.parts.map((p) => p.y).reduce(min);
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
      battery =
          (battery +
                  (craft.generation * generationFactor -
                          craft.consumption * loadFactor) *
                      h /
                      3600)
              .clamp(0, craft.batteryCapacity);
      position = next;
      time += h;
      maxAltitude = max(maxAltitude, altitude);
      if (altitude <= 0) {
        ended = true;
        status = velocity.length <= 5
            ? 'Landed'
            : 'Impact — redesign or try a different flight path';
        position = position * (body.radius / position.length);
      } else if (apoapsis == null && altitude > 100000) {
        status = 'Escape trajectory';
      } else if (apoapsis != null && periapsis > 100000) {
        status = 'Stable orbit — periapsis above 100 km';
      } else if (altitude > 100000) {
        status = 'Space reached — raise periapsis to stay in orbit';
      } else {
        status = body.atmosphere ? 'Atmospheric flight' : 'Lunar descent';
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
      if (p.length < body.radius) break;
    }
    return path;
  }

  Map<String, dynamic> toJson() => {
    'parts': craft.parts.map((p) => p.toJson()).toList(),
    'stageOrder': craft.stageOrder,
    'legacyFuelRouting': craft.legacyFuelRouting,
    'battery': battery,
    'generationFactor': generationFactor,
    'loadFactor': loadFactor,
    'body': body.name,
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
        stageOrder: List<String>.from(j['stageOrder'] ?? []),
        legacyFuelRouting:
            j['legacyFuelRouting'] ??
            (j['parts'] as List).any((p) => p['id'] == null),
      ),
      body: j['body'] == 'Moon' ? CelestialBody.moon : CelestialBody.earth,
    );
    f.position = Point2((j['x'] as num).toDouble(), (j['y'] as num).toDouble());
    f.velocity = Point2(
      (j['vx'] as num).toDouble(),
      (j['vy'] as num).toDouble(),
    );
    f.generationFactor = (j['generationFactor'] as num?)?.toDouble() ?? 1;
    f.loadFactor = (j['loadFactor'] as num?)?.toDouble() ?? 1;
    f.battery = (j['battery'] as num?)?.toDouble() ?? f.craft.batteryCapacity;
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
