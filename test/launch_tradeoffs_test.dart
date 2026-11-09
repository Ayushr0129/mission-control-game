import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:mission_control/models/models.dart';
import 'package:mission_control/services/engineering.dart';
import 'package:mission_control/services/flight.dart';

void main() {
  final parts =
      (jsonDecode(File('assets/data/components.json').readAsStringSync())
              as List)
          .map((j) => Part(j))
          .toList();
  final mission = Mission(
    (jsonDecode(File('assets/data/missions.json').readAsStringSync()) as List)
        .first,
  );
  Engineering design(LaunchVehicle vehicle) => Engineering(
    parts.where((p) => Programme().design.contains(p.id)).toList(),
    launcher: vehicle,
  );
  test('Launcher choice changes procurement and payload readiness', () {
    final light = design(LaunchVehicle.options.first),
        standard = design(LaunchVehicle.standard);
    expect(standard.cost - light.cost, 2);
    final overloaded = Engineering(
      parts,
      launcher: LaunchVehicle.options.first,
    );
    expect(
      overloaded
          .warnings(mission, 100)
          .any((s) => s.contains('payload exceeds')),
      isTrue,
    );
    expect(standard.warnings(mission, 45), isEmpty);
    expect(
      standard.twr,
      closeTo(3000000 / ((194500 + standard.wetMass) * g0), .00001),
    );
  });
  test('Launcher affects flight dynamics and survives save restoration', () {
    final a = Flight(1200, launcher: LaunchVehicle.options.first)
      ..started = true;
    final b = Flight(1200, launcher: LaunchVehicle.options.last)
      ..started = true;
    for (var i = 0; i < 200; i++) {
      a.step(.05);
      b.step(.05);
    }
    expect(b.altitude, greaterThan(a.altitude));
    final restored = Flight(1200)..restore(a.toJson());
    expect(restored.launcher.id, 'light');
    expect(restored.toJson(), a.toJson());
    a.step(.1);
    restored.step(.1);
    expect(restored.toJson(), a.toJson());
  });
  test('Legacy campaigns and flights default to original launcher', () {
    final json = Programme().toJson()..remove('launcherId');
    expect(Programme.fromJson(json).launcherId, 'standard');
    final state = Flight(795).toJson()..remove('launcherId');
    final restored = Flight(795, launcher: LaunchVehicle.options.first)
      ..restore(state);
    expect(restored.launcher, LaunchVehicle.standard);
    final programme = Programme(launcherId: 'heavy');
    expect(Programme.fromJson(programme.toJson()).launcherId, 'heavy');
  });
}
