import 'dart:math';
import '../models/models.dart';

class Campaign {
  static void launch(Programme p, double cost) {
    p.funding -= cost;
    p.attempts++;
    p.achievements.add('First Launch');
  }

  static void settle(
    Programme p,
    Mission m, {
    required bool success,
    required int science,
    required double cost,
    required double netPower,
  }) {
    if (success) {
      p.funding += m.reward;
      p.trust = min(100, p.trust + 8);
      p.reputation += 10;
      p.science += science;
      p.completed.add(m.id);
      p.achievements.add(
        {
          'space': 'Reached Space',
          'orbit': 'Stable Orbit',
          'flyby': 'First Lunar Flyby',
          'landing': 'First Lunar Landing',
        }[m.id]!,
      );
      if (cost <= m.budget * .85) p.achievements.add('Budget Master');
      if (netPower >= 100) p.achievements.add('Power Efficiency Expert');
      if (p.science >= 60) p.achievements.add('Scientific Pioneer');
    } else {
      p.trust = max(0, p.trust - 18);
      p.reputation = max(0, p.reputation - 3);
    }
    p.active = null;
  }
}
