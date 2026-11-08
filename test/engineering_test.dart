import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mission_control/models/models.dart';
import 'package:mission_control/services/engineering.dart';
import 'package:mission_control/services/flight.dart';
import 'package:mission_control/services/operations.dart';
import 'package:mission_control/services/storage.dart';
import 'package:mission_control/services/campaign.dart';

void main() {
  late List<Part> parts;
  late List<Mission> missions;
  setUpAll(() {
    parts =
        (jsonDecode(File('assets/data/components.json').readAsStringSync())
                as List)
            .map((j) => Part(j))
            .toList();
    missions =
        (jsonDecode(File('assets/data/missions.json').readAsStringSync())
                as List)
            .map((j) => Mission(j))
            .toList();
  });
  Engineering build(int index) => Engineering(
    parts
        .where(
          (p) => [
            'core',
            index >= 2 ? 'engine2' : 'engine1',
            index == 3
                ? 'tank3'
                : index == 2
                ? 'tank2'
                : 'tank1',
            index >= 2 ? 'solar2' : 'solar1',
            index >= 2 ? 'antenna2' : 'antenna1',
            index >= 2 ? 'spectrometer' : 'camera',
            if (index == 3) 'legs',
          ].contains(p.id),
        )
        .toList(),
  );
  test('Mass, cost, power and rocket equation match independent values', () {
    final e = build(0);
    expect(e.dryMass, 445);
    expect(e.fuel, 350);
    expect(e.wetMass, 795);
    expect(e.cost, closeTo(10.8, .001));
    expect(e.netPower, 75);
    expect(e.deltaV, closeTo(320 * 9.80665 * log(795 / 445), .001));
    expect(e.twr, greaterThan(1));
  });
  test('Adding an imager lowers delta-v and increases cost and draw', () {
    final a = build(0),
        b = Engineering([
          ...build(0).parts,
          parts.firstWhere((p) => p.id == 'spectrometer'),
        ]);
    expect(b.deltaV, lessThan(a.deltaV));
    expect(b.cost, greaterThan(a.cost));
    expect(b.netPower, lessThan(a.netPower));
  });
  for (var i = 0; i < 4; i++) {
    test('Recommended mission $i design passes readiness', () {
      expect(build(i).warnings(missions[i], 45), isEmpty);
    });
    test('Mission $i full-throttle guided launch reaches target', () {
      final f = Flight(build(i).wetMass)..started = true;
      while (f.failure == null && !f.achieved(i > 0) && f.time < 350) {
        if (f.canSeparate) f.separate();
        f.step(.05);
      }
      expect(
        f.achieved(i > 0),
        isTrue,
        reason:
            't=${f.time} alt=${f.altitude} horizontal=${f.horizontal} vertical=${f.vertical} fuel=${f.fuel} error=${f.failure}',
      );
    });
  }
  test('Readiness catches budget, power, link and landing omissions', () {
    final e = Engineering(
      build(0).parts.where((p) => p.id != 'solar1').toList(),
    );
    final w = e.warnings(missions[3], 1);
    expect(w.any((s) => s.contains('Power')), isTrue);
    expect(w.any((s) => s.contains('dish')), isTrue);
    expect(w.any((s) => s.contains('landing')), isTrue);
    expect(w.any((s) => s.contains('funding')), isTrue);
  });
  test('Zero-duration engine frames do not corrupt telemetry or saves', () {
    final f=Flight(800)..started=true; final before=f.toJson(); f.step(0); expect(f.toJson(),before); f.step(.05); expect(f.altitude.isFinite,isTrue); expect(f.horizontal.isFinite,isTrue); expect(()=>jsonEncode(f.toJson()),returnsNormally);
  });
  test('Low throttle prevents launch and explains the failure', () {
    final f = Flight(800)
      ..started = true
      ..throttle = .2;
    for (var i = 0; i < 300; i++) {
      f.step(.05);
    }
    expect(f.failure, contains('Thrust'));
    expect(f.achieved(false), isFalse);
  });
  test('Flight snapshot preserves controls, velocities and fuel', () {
    final f = Flight(800)..started = true;
    for (var i = 0; i < 100; i++) {
      f.step(.05);
    }
    final g = Flight(800)..restore(jsonDecode(jsonEncode(f.toJson())));
    expect(g.toJson(), f.toJson());
    f.step(.05);
    g.step(.05);
    expect(g.altitude, f.altitude);
  });
  test('Orbit cannot be awarded by altitude alone', () {
    final f = Flight(800)..altitude = 150000;
    expect(f.achieved(false), isTrue);
    expect(f.achieved(true), isFalse);
    f.horizontal = 7600;
    expect(f.achieved(true), isTrue);
    f.vertical = 3000;
    expect(f.achieved(true), isFalse);
  });
  test(
    'All three events are seeded, repeatable and have distinct responses',
    () {
      for (var event = 0; event < 3; event++) {
        var seed = 0;
        while (Operations(missions[2], build(2), seed).event != event) {
          seed++;
        }
        final outcomes = <String>{};
        for (var option = 0; option < 3; option++) {
          final o = Operations(missions[2], build(2), seed);
          expect(o.event, event);
          o.resolve(option);
          outcomes.add(
            '${o.deltaV}/${o.battery}/${o.scienceFactor}/${o.safeMode}',
          );
          final once = o.toJson();
          o.resolve(option);
          expect(o.toJson(), once);
        }
        expect(outcomes.length, 3);
      }
    },
  );
  test('All recommended craft can complete operations after any event', () {
    for (var i = 0; i < 4; i++) {
      for (var seed = 0; seed < 10; seed++) {
        final o = Operations(missions[i], build(i), seed);
        expect(o.advance(), isFalse);
        o.resolve(0);
        o.advance();
        if (i == 3) {
          o.startLanding();
          o.landed = true;
        }
        o.advance();
        o.advance();
        expect(
          o.advance(),
          isTrue,
          reason: 'mission $i event ${o.event}: ${o.failure}',
        );
        expect(o.observations, greaterThan(0));
      }
    }
  });
  test('Landing has safe and hard touchdown conditions', () {
    final safe = Operations(missions[3], build(3), 42)
      ..altitude = 1
      ..descentSpeed = 2
      ..landingThrottle = .38;
    safe.stepLanding(.6);
    expect(safe.landed, isTrue);
    final hard = Operations(missions[3], build(3), 42)
      ..altitude = 1
      ..descentSpeed = 15
      ..landingThrottle = 0;
    hard.stepLanding(.2);
    expect(hard.failure, contains('Hard landing'));
  });
  test('Lunar descent is flyable with coast then braking control', () {
    final o = Operations(missions[3], build(3), 42);
    var t = 0.0;
    while (!o.landed && o.failure == null && t < 400) {
      final brakingDistance = max(
        0,
        (o.descentSpeed * o.descentSpeed - 9) / (2 * (4.3 - 1.62)),
      );
      o.landingThrottle = o.altitude < brakingDistance + 8
          ? 1
          : o.descentSpeed > 3
          ? 0.38
          : 0;
      o.stepLanding(.05);
      t += .05;
    }
    expect(
      o.landed,
      isTrue,
      reason:
          '${o.failure}, altitude ${o.altitude}, speed ${o.descentSpeed}, fuel ${o.landingFuel}',
    );
  });
  test(
    'Power deficit can exhaust the battery and cause a meaningful failure',
    () {
      final o = Operations(missions[2], build(2), 1)
        ..arrayFactor = 0
        ..battery = 1;
      o.spendPower(12);
      expect(o.failure, contains('Battery depleted'));
    },
  );
  test('Campaign debits at launch and rewards once settled by controller', () {
    final p = Programme();
    Campaign.launch(p, 10.8);
    expect(p.funding, 34.2);
    expect(p.attempts, 1);
    expect(p.achievements, contains('First Launch'));
    Campaign.settle(
      p,
      missions[0],
      success: true,
      science: 20,
      cost: 10,
      netPower: 150,
    );
    expect(p.funding, 50.2);
    expect(p.completed, contains('space'));
    expect(
      p.achievements,
      containsAll([
        'Reached Space',
        'Budget Master',
        'Power Efficiency Expert',
      ]),
    );
    expect(p.science, 20);
    Campaign.settle(
      p,
      missions[1],
      success: false,
      science: 0,
      cost: 10,
      netPower: 0,
    );
    expect(p.trust, 60);
    expect(p.completed, isNot(contains('orbit')));
  });
  test('Save and restore all campaign and active operations data', () async {
    SharedPreferences.setMockInitialValues({});
    final store = SaveStore(await SharedPreferences.getInstance());
    final p = Programme();
    p.active = {
      'mission': 2,
      'stage': 'ops',
      'ops': Operations(missions[2], build(2), 42).toJson(),
    };
    p.completed.add('space');
    p.design.add('legs');
    expect(await store.save(p), isTrue);
    expect(store.load().toJson(), p.toJson());
    final ops = Operations(missions[2], build(2), 1)
      ..restore(Map<String, dynamic>.from(store.load().active!['ops']));
    expect(ops.toJson(), p.active!['ops']);
  });
  test('Campaign closes only at defined thresholds', () {
    expect(Programme(funding: 4).gameOver, isTrue);
    expect(Programme(trust: 0).gameOver, isTrue);
    expect(Programme(funding: 5, trust: 1).gameOver, isFalse);
  });
}
