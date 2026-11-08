import 'dart:math';
import '../models/models.dart';

const g0 = 9.80665;

class Engineering {
  final List<Part> parts;
  Engineering(this.parts);
  double sum(double Function(Part) f) => parts.fold(0, (a, p) => a + f(p));
  double get dryMass => sum((p) => p.mass);
  double get fuel => sum((p) => p.fuel);
  double get wetMass => dryMass + fuel;
  double get cost =>
      5 + sum((p) => p.cost); // launcher procurement in fictional $M
  double get isp => sum((p) => p.isp);
  double get thrust => sum((p) => p.thrust);
  double get deltaV => dryMass > 0 ? isp * g0 * log(wetMass / dryMass) : 0;
  double get generation => sum((p) => p.power);
  double get consumption => sum((p) => p.draw);
  double get netPower => generation - consumption;
  double get twr => 3000000 / ((188500 + wetMass) * g0);
  int get range => parts.fold(0, (a, p) => max(a, p.range));
  int get science => parts.fold(0, (a, p) => a + p.science);
  bool has(String id) => parts.any((p) => p.id == id);
  List<String> warnings(Mission m, double funds, {bool sandbox = false}) => [
    if (!has('core')) 'Install a flight computer and spacecraft bus.',
    if (isp == 0 || fuel == 0) 'Install an engine and a propellant tank.',
    if (wetMass > 5000) 'Launch payload exceeds the 5,000 kg limit.',
    if (twr < 1.2) 'Liftoff thrust-to-weight must exceed 1.2.',
    if (deltaV < m.deltaV + 150)
      'Need ${(m.deltaV + 150).round()} m/s spacecraft delta-v, including a 150 m/s contingency reserve.',
    if (netPower < 0)
      'Power demand exceeds generation by ${(-netPower).round()} W. Select a larger array or a lighter instrument.',
    if (range < m.range)
      'A deep-space communications dish is required for the Moon.',
    if (science < m.science)
      'Install science instruments rated at least ${m.science}.',
    if (m.id == 'landing' && !has('legs'))
      'Install the landing assembly for a safe touchdown.',
    if (!sandbox && cost > m.budget)
      'Design exceeds the mission cap of \$${m.budget.toStringAsFixed(0)}M.',
    if (!sandbox && cost > funds) 'Programme funding cannot cover this flight.',
  ];
}
