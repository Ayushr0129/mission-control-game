import 'dart:math';
import '../models/models.dart';
import 'engineering.dart';

class Operations {
  final Mission mission;
  final Engineering craft;
  late double deltaV;
  double batteryCapacity;
  double battery = 300,
      arrayFactor = 1,
      scienceFactor = 1,
      altitude = 1500,
      descentSpeed = 12,
      landingFuel = 95,
      landingThrottle = .45;
  int phase = 0, observations = 0;
  bool eventResolved = false, safeMode = false, link = true, landed = false;
  String? failure;
  late int event;
  Operations(this.mission, this.craft, int seed, {this.batteryCapacity = 300}) {
    deltaV = craft.deltaV;
    event = Random(seed).nextInt(3);
  }
  String get phaseName => [
    'Trajectory check',
    'Destination approach',
    'Science operations',
    'Data downlink',
  ][phase.clamp(0, 3)];
  List<String> get eventOptions => [
    [
      'Shed instrument load',
      'Use battery reserve',
      'Continue at reduced output',
    ],
    ['Enter safe mode', 'Reacquire the link', 'Wait for the next window'],
    [
      'Correct trajectory · 120 m/s',
      'Use a longer coast · 60 Wh',
      'Accept a distant pass',
    ],
  ][event];
  String get eventTitle => [
    'Solar array underperformance',
    'Communications dropout',
    'Trajectory dispersal',
  ][event];
  String get eventText => [
    'One solar wing is producing less than expected. Protect the spacecraft or trade energy for science.',
    'The antenna lost Earth lock. Recovery costs energy; waiting changes the observation window.',
    'Tracking reveals a small navigation error. Spend propellant, battery energy, or scientific value.',
  ][event];
  void resolve(int choice) {
    if (eventResolved) return;
    eventResolved = true;
    if (event == 0) {
      arrayFactor = .65;
      if (choice == 0) {
        safeMode = true;
        scienceFactor = .8;
      }
      if (choice == 1) battery -= 65;
      if (choice == 2) scienceFactor = .7;
    }
    if (event == 1) {
      if (choice == 0) {
        safeMode = true;
        scienceFactor = .8;
        link = true;
      }
      if (choice == 1) {
        battery -= 45;
        link = true;
      }
      if (choice == 2) {
        battery -= 15;
        scienceFactor = .65;
        link = true;
      }
    }
    if (event == 2) {
      if (choice == 0) deltaV -= 120;
      if (choice == 1) battery -= 60;
      if (choice == 2) scienceFactor = .55;
    }
    check();
  }

  bool spendPower(double minutes) {
    final demand = safeMode ? craft.consumption * .6 : craft.consumption;
    battery =
        (battery + (craft.generation * arrayFactor - demand) * minutes / 60)
            .clamp(0, batteryCapacity);
    check();
    return failure == null;
  }

  void check() {
    if (battery <= 0) {
      failure =
          'Battery depleted. Your damaged array could not support the instrument load. Reduce power demand or choose a larger array.';
    }
    if (deltaV < 0) {
      failure =
          'The spacecraft exhausted its manoeuvre budget. Add propellant, reduce mass, or select a higher-Isp engine.';
    }
  }

  bool advance() {
    if (!eventResolved || failure != null) return false;
    if (phase == 0) {
      deltaV -= mission.deltaV * (mission.id == 'landing' ? 0.68 : 1);
      spendPower(8);
    }
    if (phase == 1) {
      if (mission.id == 'landing' && !landed) return false;
      spendPower(5);
    }
    if (phase == 2) {
      observations = (craft.science * 20 * scienceFactor).round();
      spendPower(12);
    }
    if (phase == 3) {
      if (!link) return false;
      spendPower(6);
      return failure == null && observations > 0;
    }
    check();
    if (failure == null) phase++;
    return false;
  }

  void startLanding() {
    deltaV -= mission.deltaV * .32;
    check();
  }

  void stepLanding(double dt) {
    if (landed || failure != null) return;
    final throttle = landingFuel > 0 ? landingThrottle : 0;
    landingFuel = max(0, landingFuel - throttle * 1.6 * dt);
    descentSpeed += (1.62 - throttle * 4.3) * dt;
    descentSpeed = descentSpeed.clamp(-25, 65);
    altitude -= descentSpeed * dt;
    battery = max(0, battery - .04 * dt);
    if (altitude <= 0) {
      altitude = 0;
      if (descentSpeed.abs() <= 5) {
        landed = true;
      } else {
        failure =
            'Hard landing at ${descentSpeed.toStringAsFixed(1)} m/s. Lunar gravity is weak, but there is no atmosphere to slow you down. Brake earlier and touch down below 5 m/s.';
      }
    }
    if (altitude > 2000) {
      failure =
          'The lander climbed beyond its approach corridor. Lower throttle to descend.';
    }
    check();
  }

  Map<String, dynamic> toJson() => {
    'deltaV': deltaV,
    'battery': battery,
    'arrayFactor': arrayFactor,
    'scienceFactor': scienceFactor,
    'altitude': altitude,
    'descentSpeed': descentSpeed,
    'landingFuel': landingFuel,
    'landingThrottle': landingThrottle,
    'phase': phase,
    'observations': observations,
    'eventResolved': eventResolved,
    'safeMode': safeMode,
    'link': link,
    'landed': landed,
    'failure': failure,
    'event': event,
  };
  void restore(Map<String, dynamic> j) {
    deltaV = (j['deltaV'] as num).toDouble();
    battery = (j['battery'] as num).toDouble();
    arrayFactor = (j['arrayFactor'] as num).toDouble();
    scienceFactor = (j['scienceFactor'] as num).toDouble();
    altitude = (j['altitude'] as num).toDouble();
    descentSpeed = (j['descentSpeed'] as num).toDouble();
    landingFuel = (j['landingFuel'] as num).toDouble();
    landingThrottle = (j['landingThrottle'] as num).toDouble();
    phase = j['phase'];
    observations = j['observations'];
    eventResolved = j['eventResolved'];
    safeMode = j['safeMode'];
    link = j['link'];
    landed = j['landed'];
    failure = j['failure'];
    event = j['event'];
  }
}
