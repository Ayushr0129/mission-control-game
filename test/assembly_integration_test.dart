import 'dart:math';
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:mission_control/models/models.dart';
import 'package:mission_control/simulator/catalogue.dart';
import 'package:mission_control/simulator/physics.dart';
import 'package:mission_control/simulator/campaign_session.dart';
import 'package:mission_control/simulator/orbit_tutor.dart';

void main() {
  final missions =
      (jsonDecode(File('assets/data/missions.json').readAsStringSync()) as List)
          .map((j) => Mission(j))
          .toList();
  Assembly spaceCraft() => Assembly.starter()
    ..parts.addAll([RocketPart('solar', 3, 1), RocketPart('antenna', 5, 1)]);
  test(
    'Catalogue defines real part differences and only engines produce thrust',
    () {
      expect(PartSpec.get('tank_long').height, 2);
      expect(PartSpec.get('tank_long').capacity, 24000);
      expect(
        PartSpec.get('vacuum').isp,
        greaterThan(PartSpec.get('engine').isp),
      );
      for (final s in PartSpec.all) {
        expect(s.mass, greaterThan(0));
        expect(s.cost, greaterThan(0));
        if (s.category != 'Propulsion') {
          expect(s.thrust, 0);
          expect(s.isp, 0);
        }
      }
      final a = Assembly([
        RocketPart('capsule', 4, 0),
        RocketPart('tank_long', 4, 1),
        RocketPart('engine', 4, 3),
      ]);
      expect(a.problems, isEmpty);
      expect(a.at(4, 2)?.kind, 'tank_long');
      a.parts.add(RocketPart('battery', 4, 2));
      expect(a.problems.join(), contains('overlap'));
    },
  );
  test(
    'Stage priority and crossfeed change which mass and propellant are retained',
    () {
      final a = Assembly.starter();
      final separator = a.separators.single;
      expect(a.stageFuel, 24000);
      separator.crossfeed = true;
      expect(a.stageFuel, 36000);
      separator.crossfeed = false;
      final restored = Assembly(
        a.parts.map((p) => RocketPart.fromJson(p.toJson())).toList(),
        stageOrder: [separator.id],
      );
      expect(restored.separate(), true);
      expect(restored.mass, lessThan(a.mass));
      expect(restored.stageFuel, 12000);
      final xenon = Assembly([
        RocketPart('capsule', 4, 0),
        RocketPart('xenon', 4, 1),
        RocketPart('engine', 4, 2),
      ]);
      expect(xenon.stageFuel, 0);
    },
  );
  test(
    'Orbital example flies from the surface to a stable orbit without injecting state',
    () {
      final f = SandboxFlight(Assembly.orbital())..launched = true;
      final tutor = OrbitTutor();
      expect(f.craft.problems, isEmpty);
      for (var i = 0; i < 2400 && !f.ended; i++) {
        tutor.update(f);
        f.step(.25);
        if (f.periapsis > 120000 &&
            f.apoapsis != null &&
            f.apoapsis! < 450000) {
          break;
        }
      }
      expect(f.ended, false);
      expect(f.periapsis, greaterThan(120000));
      expect(f.apoapsis!, lessThan(450000));
      expect(f.craft.fuel, greaterThan(0));
      f.throttle = 0;
      for (var i = 0; i < 600; i++) {
        f.step(1);
      }
      expect(f.periapsis, greaterThan(100000));
    },
  );
  test(
    'Assembled mission charges once, restores and returns real payload science',
    () {
      final p = Programme();
      final a = spaceCraft();
      final cost = a.cost + 1;
      final session = AssemblyCampaign.launch(
        p,
        missions[0],
        0,
        a,
        runId: 'mission-test',
      );
      expect(p.funding, closeTo(45 - cost, .001));
      expect(
        () => AssemblyCampaign.launch(p, missions[0], 0, a),
        throwsStateError,
      );
      session.flight.launched = true;
      for (var i = 0; i < 2400 && session.phase == 'ascent'; i++) {
        session.step(.25);
      }
      expect(session.phase, 'operations');
      session.persist();
      final recovered = Programme.fromJson(jsonDecode(jsonEncode(p.toJson())));
      final restored = AssemblyCampaign.restore(
        recovered,
        missions[0],
        0,
        Map<String, dynamic>.from(recovered.active!['snapshot']),
      );
      expect(recovered.funding, p.funding);
      restored.resolveEvent(1);
      for (var i = 0; i < 4 && !restored.settled; i++) {
        restored.advance();
      }
      expect(restored.success, true);
      expect(recovered.science, greaterThan(0));
      expect(recovered.completed, contains('space'));
      expect(recovered.active, isNull);
      final funds = recovered.funding;
      final science = recovered.science;
      restored.settle(true, 'duplicate');
      expect(recovered.funding, funds);
      expect(recovered.science, science);
      expect(recovered.assemblyReport!['data'], 30);
    },
  );
  test(
    'Cost, science, power, comms and recorder constraints block unsuitable missions',
    () {
      final a = Assembly.starter();
      expect(
        AssemblyCampaign.requirements(a, missions[0], Programme()).join(),
        contains('communications'),
      );
      final good = spaceCraft();
      expect(
        AssemblyCampaign.requirements(
          good,
          missions[0],
          Programme(funding: 1),
        ).join(),
        contains('afford'),
      );
      good.parts.add(RocketPart('spectrometer', 3, 2));
      expect(
        AssemblyCampaign.requirements(good, missions[0], Programme()).join(),
        contains('recorder'),
      );
    },
  );
  test(
    'Moon flight restores its body and uses lunar gravity and actual fuel',
    () {
      final f = SandboxFlight(Assembly.orbital(), body: CelestialBody.moon)
        ..launched = true
        ..throttle = 0;
      f.step(1);
      expect(f.velocity.y.abs(), lessThan(2));
      final restored = SandboxFlight.fromJson(
        jsonDecode(jsonEncode(f.toJson())),
      );
      expect(restored.body.name, 'Moon');
      expect(restored.toJson(), f.toJson());
    },
  );
  test('Engine and tank choices change actual ascent, mass and fuel flow', () {
    Assembly vehicle(String tank, String engine) {
      final t = RocketPart(tank, 4, 1);
      return Assembly([
        RocketPart('capsule', 4, 0),
        t,
        RocketPart(engine, 4, 1 + t.height),
      ]);
    }

    final booster = vehicle('tank', 'engine'),
        vacuum = vehicle('tank', 'vacuum');
    expect(booster.cost, isNot(vacuum.cost));
    expect(booster.flow, greaterThan(vacuum.flow));
    expect(vacuum.stageDeltaV, greaterThan(booster.stageDeltaV));
    final a = SandboxFlight(booster)..launched = true,
        b = SandboxFlight(vacuum)..launched = true;
    a.step(10);
    b.step(10);
    expect(a.altitude, greaterThan(b.altitude));
    final small = vehicle('tank_small', 'engine'),
        large = vehicle('tank_long', 'engine');
    expect(large.mass, greaterThan(small.mass));
    expect(large.stageDeltaV, greaterThan(small.stageDeltaV));
    expect(large.cost, greaterThan(small.cost));
  });
  test('Side boosters detach in selected order and preserve isolated fuel', () {
    final left = RocketPart('separator', 3, 1),
        right = RocketPart('separator', 5, 1);
    final a = Assembly(
      [
        RocketPart('capsule', 4, 0),
        RocketPart('tank', 4, 1),
        RocketPart('engine', 4, 2),
        left,
        right,
        RocketPart('tank', 2, 1),
        RocketPart('engine', 2, 2),
        RocketPart('tank', 6, 1),
        RocketPart('engine', 6, 2),
      ],
      stageOrder: [right.id, left.id],
    );
    expect(a.problems, isEmpty);
    expect(a.activeEngines.length, 3);
    expect(a.stageFuel, 36000);
    expect(a.separate(), true);
    expect(a.at(6, 1), isNull);
    expect(a.at(2, 1), isNotNull);
    expect(a.stageFuel, 24000);
    expect(a.separate(), true);
    expect(a.at(2, 1), isNull);
    expect(a.stageFuel, 12000);
  });
  test('Legacy saved vehicles preserve old structural fuel routing', () {
    final a = Assembly([
      RocketPart('capsule', 4, 0),
      RocketPart('tank', 4, 1),
      RocketPart('science', 4, 2),
      RocketPart('engine', 4, 3),
    ]);
    expect(a.stageFuel, 0);
    final raw = SandboxFlight(a).toJson()..remove('legacyFuelRouting');
    for (final part in raw['parts'] as List) {
      part.remove('id');
    }
    final recovered = SandboxFlight.fromJson(raw);
    expect(recovered.craft.legacyFuelRouting, true);
    expect(recovered.craft.stageFuel, 12000);
    expect(
      SandboxFlight.fromJson(recovered.toJson()).craft.legacyFuelRouting,
      true,
    );
  });
  test(
    'A campaign orbital mission flies the assembly, spends manoeuvre fuel and returns science',
    () {
      final p = Programme(completed: {'space'});
      final s = AssemblyCampaign.launch(
        p,
        missions[1],
        1,
        Assembly.orbital(),
        runId: 'orbit-campaign',
      );
      s.flight.launched = true;
      final tutor = OrbitTutor();
      for (var i = 0; i < 2400 && s.phase == 'ascent'; i++) {
        tutor.update(s.flight);
        s.step(.25);
      }
      expect(s.phase, 'operations');
      expect(s.flight.periapsis, greaterThanOrEqualTo(100000));
      s.resolveEvent(1);
      final before = s.flight.craft.fuel;
      s.advance();
      expect(s.flight.craft.fuel, lessThan(before));
      for (var i = 0; i < 3 && !s.settled; i++) {
        s.advance();
      }
      expect(s.success, true);
      expect(p.completed, contains('orbit'));
      expect(p.assemblyReport!['science'], greaterThan(0));
    },
  );
  for (final index in [2, 3]) {
    test(
      'Assembled ${index == 2 ? 'flyby' : 'lunar landing'} uses actual reserves through story operations',
      () {
        final p = Programme(completed: {'space', 'orbit', 'flyby'});
        final design = Assembly.missionBaseline(index);
        expect(
          AssemblyCampaign.requirements(design, missions[index], p),
          isEmpty,
        );
        final session = AssemblyCampaign.launch(
          p,
          missions[index],
          index,
          design,
        );
        session.flight.launched = true;
        final tutor = OrbitTutor();
        for (var i = 0; i < 4000 && session.phase == 'ascent'; i++) {
          tutor.update(session.flight);
          session.step(.25);
        }
        expect(session.phase, 'operations', reason: session.report);
        session.resolveEvent(1);
        session.advance();
        if (index == 3) {
          session.advance();
          expect(session.phase, 'landing', reason: session.report);
          final f = session.flight;
          for (var i = 0; i < 20000 && session.phase == 'landing'; i++) {
            final g = f.body.mu / (f.position.length * f.position.length);
            final target = -min(
              25.0,
              max(.5, sqrt(2 * .8 * max(f.altitude, 0))),
            );
            final acceleration = (target - f.verticalSpeed) / 2 + g;
            f.angle = 0;
            f.throttle =
                (acceleration * f.craft.mass / max(f.craft.totalThrust, 1))
                    .clamp(0, 1);
            session.step(.05);
          }
          expect(session.phase, 'operations', reason: session.report);
          expect(session.operations!.landed, true);
        }
        for (var i = 0; i < 4 && !session.settled; i++) {
          session.advance();
        }
        expect(session.success, true, reason: session.report);
        expect(p.completed, contains(missions[index].id));
      },
    );
  }
}
