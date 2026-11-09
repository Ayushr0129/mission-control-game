import '../models/models.dart';
import '../services/campaign.dart';
import '../services/engineering.dart';
import '../services/operations.dart';
import 'physics.dart';

class AssemblyEngineering extends Engineering {
  final Assembly assembly;
  AssemblyEngineering(this.assembly) : super([]);
  @override
  double get dryMass => assembly.dryMass;
  @override
  double get fuel => assembly.fuel;
  @override
  double get wetMass => assembly.mass;
  @override
  double get cost => assembly.cost + 1;
  @override
  double get isp => assembly.effectiveIsp;
  @override
  double get thrust => assembly.totalThrust;
  @override
  double get deltaV => assembly.stageDeltaV;
  @override
  double get generation => assembly.generation;
  @override
  double get consumption => assembly.consumption;
  @override
  int get science => assembly.science;
  @override
  int get range => assembly.range;
  @override
  bool has(String id) => assembly.parts.any((p) => p.kind == id);
}

/// Shares the programme object with mission control so its autosave cannot
/// overwrite the assembled mission. Charge + active snapshot form one save.
class AssemblyCampaign {
  final Programme programme;
  final Mission mission;
  final int missionIndex;
  final String runId;
  final double launchCost;
  SandboxFlight flight;
  Operations? operations;
  String phase = 'ascent', report = '';
  double data = 0, burnSeconds = 0;
  bool success = false;
  AssemblyCampaign._(
    this.programme,
    this.mission,
    this.missionIndex,
    this.runId,
    this.launchCost,
    this.flight,
  );
  static List<String> requirements(Assembly a, Mission m, Programme p) => [
    ...a.problems,
    if (a.cost + 1 > m.budget)
      'Mission cap exceeded: design plus \$1M pad fee must fit \$${m.budget}M.',
    if (a.cost + 1 > p.funding) 'Programme cannot afford this launch.',
    if (p.gameOver)
      'Programme is closed; start a new campaign or use training.',
    if (a.science < m.science)
      'Install instruments with science rating at least ${m.science}.',
    if (a.range < m.range)
      'Install a ${m.range == 2 ? 'lunar' : 'Earth'} communications link.',
    if ((a.consumption - a.generation) * (m.range == 2 ? 120 : 40) / 60 * 1.25 >
        a.batteryCapacity)
      'Power deficit exceeds the planned energy reserve; add batteries, arrays or reduce load.',
    if (a.dataRate * 60 > a.dataCapacity)
      'A 60-second observation exceeds recorder capacity; add storage.',
    if (m.id == 'landing' && !a.parts.any((part) => part.kind == 'legs'))
      'Lunar mission requires a landing assembly.',
  ];
  factory AssemblyCampaign.launch(
    Programme p,
    Mission m,
    int index,
    Assembly a, {
    String? runId,
  }) {
    if (p.active != null) {
      throw StateError('Continue or abandon the active mission first.');
    }
    final problems = requirements(a, m, p);
    if (problems.isNotEmpty) throw StateError(problems.join(' '));
    final id =
        runId ??
        'assembly_${DateTime.now().microsecondsSinceEpoch}_${p.attempts}';
    if (p.assemblySettlements.contains(id)) {
      throw StateError('This launch was already settled.');
    }
    final cost = a.cost + 1;
    final session = AssemblyCampaign._(
      p,
      m,
      index,
      id,
      cost,
      SandboxFlight(a.copy()),
    );
    Campaign.launch(p, cost);
    session.persist();
    return session;
  }
  bool get settled => phase == 'result';
  bool get payloadReady =>
      flight.craft.science >= mission.science &&
      flight.craft.range >= mission.range &&
      (mission.id != 'landing' ||
          flight.craft.parts.any((p) => p.kind == 'legs'));
  void persist() {
    if (!settled) {
      programme.active = {
        'stage': 'assembly',
        'mission': missionIndex,
        'sandbox': false,
        'snapshot': toJson(),
      };
    }
  }

  void step(double dt) {
    if (phase != 'ascent' && phase != 'landing') return;
    flight.step(dt);
    if (flight.battery <= 0) {
      settle(
        false,
        'Electrical reserves exhausted; the retained vehicle could not support its systems.',
      );
      return;
    }
    if (flight.ended) {
      if (phase == 'landing' && flight.status == 'Landed') {
        operations!.landed = true;
        operations!.deltaV = flight.craft.stageDeltaV;
        operations!.battery = flight.battery;
        phase = 'operations';
        report = 'Touchdown confirmed. Complete science and downlink.';
      } else {
        settle(false, flight.status);
      }
      return;
    }
    if (phase == 'ascent') {
      final reached = mission.id == 'space'
          ? flight.altitude >= 100000
          : flight.periapsis >= 100000 &&
                flight.apoapsis != null &&
                flight.apoapsis! <= 450000;
      if (reached) {
        final craft = AssemblyEngineering(flight.craft);
        if (!payloadReady) {
          settle(
            false,
            'Required payload or communications were discarded during staging.',
          );
          return;
        }
        operations = Operations(
          mission,
          craft,
          programme.seed + programme.attempts,
          batteryCapacity: flight.craft.batteryCapacity,
        )..battery = flight.battery;
        phase = 'operations';
        report =
            'Flight director: ${mission.id == 'space' ? 'space threshold' : 'stable orbit'} confirmed. Resolve the mission event and operate your actual payload.';
      }
    }
  }

  void refreshReserve() {
    final o = operations;
    if (o == null) return;
    o.deltaV = flight.craft.stageDeltaV;
    o.batteryCapacity = flight.craft.batteryCapacity;
    o.battery = o.battery.clamp(0, o.batteryCapacity);
    flight.battery = o.battery;
  }

  bool spendManoeuvre(double dv, {double prepaidMinutes = 0}) {
    final ok = flight.craft.expendDeltaV(dv);
    burnSeconds += flight.craft.lastBurnSeconds;
    final extra = flight.craft.lastBurnSeconds / 60 - prepaidMinutes;
    if (extra > 0) operations?.spendPower(extra);
    return ok;
  }

  void resolveEvent(int choice) {
    final o = operations;
    if (o == null || o.eventResolved || settled) return;
    final before = o.deltaV;
    o.resolve(choice);
    if (before > o.deltaV && !spendManoeuvre(before - o.deltaV)) {
      settle(false, 'Actual tanks cannot supply the anomaly manoeuvre.');
      return;
    }
    if (o.failure != null) settle(false, o.failure!);
    persist();
  }

  void advance() {
    final o = operations;
    if (phase != 'operations' || o == null || !o.eventResolved) return;
    final a = flight.craft;
    if (!payloadReady) {
      settle(
        false,
        'Required payload, landing hardware or communications were discarded.',
      );
      return;
    }
    if (o.phase == 1 && mission.id == 'landing' && !o.landed) {
      final dv = mission.deltaV * .32;
      if (!spendManoeuvre(dv)) {
        settle(false, 'Insufficient remaining propellant for lunar braking.');
        return;
      }
      o.deltaV -= dv;
      phase = 'landing';
      flight = SandboxFlight(a, body: CelestialBody.moon)
        ..position = const Point2(0, CelestialBody.moonRadius + 1500)
        ..velocity = const Point2(0, -12)
        ..battery = o.battery
        ..generationFactor = o.arrayFactor
        ..loadFactor = (o.safeMode ? .6 : 1)
        ..throttle = 0
        ..launched = true;
      report =
          'Lunar descent: point upward and modulate thrust. Land below 5 m/s; fuel and mass are from the retained vehicle.';
      return;
    }
    if (o.phase == 2) {
      data = a.dataRate * 60;
      if (data > a.dataCapacity) {
        settle(
          false,
          'Recorder overflow: ${data.round()} MB generated, ${a.dataCapacity.round()} MB available.',
        );
        return;
      }
    }
    if (o.phase == 3) {
      if (a.range < mission.range || a.downlink <= 0) {
        settle(false, 'The retained vehicle has no compatible downlink.');
        return;
      }
      o.spendPower(data / a.downlink / 60);
    }
    final before = o.deltaV;
    final completed = o.advance();
    if (before > o.deltaV &&
        !spendManoeuvre(before - o.deltaV, prepaidMinutes: 8)) {
      settle(false, 'Actual tanks cannot supply the requested manoeuvre.');
      return;
    }
    flight.battery = o.battery;
    if (o.failure != null) {
      settle(false, o.failure!);
    } else if (completed) {
      settle(
        true,
        'Science downlink confirmed: ${o.observations} points from ${data.toStringAsFixed(1)} MB transmitted.',
      );
    }
    persist();
  }

  void settle(bool won, String reason) {
    if (settled || programme.assemblySettlements.contains(runId)) return;
    success = won;
    report = reason;
    phase = 'result';
    final science = won ? (operations?.observations ?? 0) : 0;
    Campaign.settle(
      programme,
      mission,
      success: won,
      science: science,
      cost: launchCost,
      netPower: flight.craft.generation - flight.craft.consumption,
    );
    programme.assemblySettlements.add(runId);
    programme.assemblyReport = {
      'runId': runId,
      'mission': mission.name,
      'success': won,
      'reason': reason,
      'cost': launchCost,
      'science': science,
      'data': data,
      'burnSeconds': burnSeconds,
      'peakAltitude': flight.maxAltitude,
      'remainingFuel': flight.craft.fuel,
      'battery': flight.battery,
    };
  }

  Map<String, dynamic> toJson() => {
    'runId': runId,
    'cost': launchCost,
    'flight': flight.toJson(),
    'operations': operations?.toJson(),
    'phase': phase,
    'data': data,
    'burnSeconds': burnSeconds,
    'success': success,
    'report': report,
  };
  factory AssemblyCampaign.restore(
    Programme p,
    Mission m,
    int index,
    Map<String, dynamic> j,
  ) {
    final f = SandboxFlight.fromJson(j['flight']);
    final session = AssemblyCampaign._(
      p,
      m,
      index,
      j['runId'],
      (j['cost'] as num).toDouble(),
      f,
    );
    if (j['operations'] != null) {
      session.operations = Operations(
        m,
        AssemblyEngineering(f.craft),
        p.seed + p.attempts,
        batteryCapacity: f.craft.batteryCapacity,
      )..restore(Map<String, dynamic>.from(j['operations']));
    }
    session.phase = j['phase'];
    session.data = (j['data'] as num?)?.toDouble() ?? 0;
    session.burnSeconds = (j['burnSeconds'] as num?)?.toDouble() ?? 0;
    session.success = j['success'] ?? false;
    session.report = j['report'] ?? '';
    return session;
  }
}
