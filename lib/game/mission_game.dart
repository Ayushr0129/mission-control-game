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
  KeyEventResult onKeyEvent(KeyEvent event, Set<LogicalKeyboardKey> keysPressed) =>
      KeyEventResult.ignored;
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
    for (var i = 0; i < 80; i++) {
      final x = rand.nextDouble() * s.width,
          y =
              (rand.nextDouble() * s.height + (!simPaused ? clock * 12 : 0)) %
              s.height;
      c.drawCircle(
        Offset(x, y),
        rand.nextDouble() + .3,
        Paint()..color = white.withValues(alpha: .15 + rand.nextDouble() * .4),
      );
    }
    final altitude = landing?.altitude ?? flight.altitude;
    if (landing == null) {
      final ground = s.height - 50 + (altitude / 600).clamp(0, s.height);
      c.drawRect(
        Rect.fromLTWH(0, ground, s.width, s.height),
        Paint()..color = const Color(0xff193e4c),
      );
      c.drawRect(
        Rect.fromLTWH(s.width / 2 - 58, ground - 10, 116, 10),
        Paint()..color = dim,
      );
      c.drawLine(
        Offset(s.width / 2 + 45, ground),
        Offset(s.width / 2 + 45, ground - 150),
        Paint()
          ..color = dim.withValues(alpha: .4)
          ..strokeWidth = 5,
      );
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
      final y = flight.started ? s.height * .49 : s.height - 120;
      drawRocket(
        c,
        Offset(s.width / 2 + sin(clock * 9) * (!simPaused ? 1 : 0), y),
        1.15,
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
    final p = Paint()
      ..color = cyan.withValues(alpha: .16)
      ..style = PaintingStyle.stroke
      ..strokeWidth = .7;
    c.drawCircle(Offset(s.width / 2, s.height * .46), 90, p);
    c.drawLine(
      Offset(s.width / 2 - 108, s.height * .46),
      Offset(s.width / 2 - 98, s.height * .46),
      p,
    );
    c.drawLine(
      Offset(s.width / 2 + 98, s.height * .46),
      Offset(s.width / 2 + 108, s.height * .46),
      p,
    );
  }
}
