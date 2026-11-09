import 'dart:math';
import 'package:flame/game.dart';
import 'package:flame/events.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/flight.dart';
import '../services/operations.dart';
import '../widgets/art.dart';

class MissionGame extends FlameGame with KeyboardEvents {
  final Flight flight;
  final Operations? landing;
  final VoidCallback onTick;
  bool simPaused = true;
  double clock = 0, notify = 0;
  MissionGame(this.flight, this.onTick, {this.landing});
  @override
  Color backgroundColor() => ink;
  // GameWidget otherwise consumes all focused keys. Let the shared Flutter
  // flight controls handle shortcuts, including when the canvas has focus.
  @override
  KeyEventResult onKeyEvent(
    KeyEvent event,
    Set<LogicalKeyboardKey> keysPressed,
  ) => KeyEventResult.ignored;
  @override
  void update(double dt) {
    super.update(dt);
    clock += dt;
    if (!simPaused && dt > 0) {
      final sim = dt.clamp(0, .25) * 5;
      final steps = (sim / .05).ceil().clamp(1, 25);
      for (var i = 0; i < steps; i++) {
        if (landing != null) {
          landing!.stepLanding(sim / steps);
        } else {
          flight.step(sim / steps);
        }
      }
    }
    notify += dt;
    if (notify > .08) {
      notify = 0;
      onTick();
    }
  }

  @override
  void render(Canvas canvas) {
    super.render(canvas);
    final c = canvas;
    final s = Size(size.x, size.y);
    final rand = Random(42);
    final altitude = landing?.altitude ?? flight.altitude;
    final atmosphere = landing == null
        ? (1 - altitude / 110000).clamp(0.0, 1.0)
        : 0.0;
    c.drawRect(
      Offset.zero & s,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            const Color(0xff070b10),
            Color.lerp(
              const Color(0xff16212d),
              const Color(0xff527c96),
              atmosphere,
            )!,
          ],
        ).createShader(Offset.zero & s),
    );
    for (var i = 0; i < 90; i++) {
      c.drawCircle(
        Offset(rand.nextDouble() * s.width, rand.nextDouble() * s.height),
        rand.nextDouble() * .7 + .2,
        Paint()..color = white.withValues(alpha: (1 - atmosphere) * .6),
      );
    }
    if (landing == null) {
      final ground = s.height - 50 + (altitude / 600).clamp(0, s.height);
      c.drawRect(
        Rect.fromLTWH(0, ground, s.width, s.height),
        Paint()..color = const Color(0xff25312c),
      );
      c.drawRect(
        Rect.fromLTWH(s.width / 2 - 58, ground - 10, 116, 10),
        Paint()..color = dim,
      );
      // Open steel service structure, umbilical levels and lightning mast.
      final tower = Paint()
        ..color = const Color(0xff8a959a)
        ..strokeWidth = 2;
      final tx = s.width / 2 + 62;
      for (final x in [tx, tx + 24]) {
        c.drawLine(Offset(x, ground), Offset(x, ground - 185), tower);
      }
      for (var level = 0; level < 7; level++) {
        final y = ground - level * 26;
        c.drawLine(Offset(tx, y), Offset(tx + 24, y - 26), tower);
        c.drawLine(Offset(tx + 24, y), Offset(tx, y - 26), tower);
        c.drawLine(Offset(tx - 10, y), Offset(tx + 30, y), tower);
      }
      c.drawLine(
        Offset(tx + 12, ground - 185),
        Offset(tx + 12, ground - 215),
        tower,
      );
      if (altitude > 15000) {
        final horizon = Rect.fromCenter(
          center: Offset(s.width * .5, s.height * 2.9),
          width: s.width * 4,
          height: s.height * 4.2,
        );
        c.drawOval(horizon, Paint()..color = const Color(0xff213e52));
        c.drawOval(
          horizon,
          Paint()
            ..color = cyan.withValues(alpha: .35)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2,
        );
      }
      final glow = Paint()
        ..shader = LinearGradient(
          begin: Alignment.bottomCenter,
          end: Alignment.topCenter,
          colors: [
            const Color(
              0xff19728a,
            ).withValues(alpha: (1 - altitude / 150000).clamp(0, .45)),
            Colors.transparent,
          ],
        ).createShader(Offset.zero & s);
      c.drawRect(Offset.zero & s, glow);
      final y = flight.started ? s.height * .49 : s.height - 125;
      drawRocket(
        c,
        Offset(s.width / 2 + sin(clock * 9) * (!simPaused ? 1 : 0), y),
        min(s.height / 360, s.width / 300).clamp(.85, 1.6),
        flame: flight.started && !simPaused && flight.fuel > 0
            ? flight.throttle * (.75 + sin(clock * 21) * .2)
            : 0,
      );
      if (flight.separated) {
        c.drawRect(
          Rect.fromLTWH(s.width / 2 + 42, s.height * .7, 16, 25),
          Paint()..color = dim.withValues(alpha: .4),
        );
      }
    } else {
      final ground = s.height - 30 + (altitude / 20).clamp(0, 120);
      final path = Path()..moveTo(0, ground);
      for (double x = 0; x <= s.width; x += 25) {
        path.lineTo(x, ground - rand.nextDouble() * 9);
      }
      path.lineTo(s.width, s.height);
      path.lineTo(0, s.height);
      path.close();
      c.drawPath(path, Paint()..color = const Color(0xff69787e));
      drawRocket(
        c,
        Offset(
          s.width / 2,
          min(s.height - 96, s.height * .44 + (1500 - altitude) / 1500 * 80),
        ),
        .9,
        legs: true,
        flame: !simPaused && !landing!.landed ? landing!.landingThrottle : 0,
      );
    }
    // Calibrated display rails; the values are live simulation measurements.
    final rail = Paint()
      ..color = dim.withValues(alpha: .35)
      ..strokeWidth = .7;
    for (final x in [24.0, s.width - 24]) {
      c.drawLine(Offset(x, 72), Offset(x, s.height - 54), rail);
      for (double y = 82; y < s.height - 60; y += 24) {
        c.drawLine(Offset(x - 4, y), Offset(x + 4, y), rail);
      }
    }
    final center = Offset(s.width / 2, s.height * .46);
    c.drawLine(
      center + const Offset(-38, 0),
      center + const Offset(-25, 0),
      rail,
    );
    c.drawLine(
      center + const Offset(25, 0),
      center + const Offset(38, 0),
      rail,
    );
    instrumentText(
      c,
      'VEHICLE TRACK / SIMULATED',
      const Offset(18, 49),
      size: 8,
    );
    instrumentText(
      c,
      'ALT  ${altitude.toStringAsFixed(0)} M',
      const Offset(38, 70),
      color: white,
      size: 9,
    );
    instrumentText(
      c,
      landing == null
          ? 'VEL  ${flight.speed.toStringAsFixed(0)} M/S'
          : 'DESC  ${landing!.descentSpeed.toStringAsFixed(1)} M/S',
      const Offset(38, 85),
      size: 9,
    );
    instrumentText(
      c,
      simPaused ? 'HOLD' : 'RATE 5X',
      Offset(s.width - 88, 50),
      color: simPaused ? orange : cyan,
      size: 8,
    );
  }
}
