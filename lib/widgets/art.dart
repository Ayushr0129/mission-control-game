import 'dart:math';
import 'package:flutter/material.dart';

const ink = Color(0xff070e18),
    panel = Color(0xff101c2b),
    cyan = Color(0xff71e3df),
    orange = Color(0xffff9a63),
    dim = Color(0xff8195a8),
    white = Color(0xffeef3f5);

class SpaceArt extends CustomPainter {
  final double time;
  final bool moon, grid;
  SpaceArt({this.time = 0, this.moon = false, this.grid = true});
  @override
  void paint(Canvas c, Size s) {
    final random = Random(1969);
    for (var i = 0; i < 145; i++) {
      final x = random.nextDouble() * s.width,
          y = random.nextDouble() * s.height;
      c.drawCircle(
        Offset(x, y),
        random.nextDouble() * 1.1 + .2,
        Paint()..color = white.withValues(alpha: .1 + random.nextDouble() * .4),
      );
    }
    final center = Offset(s.width * .57, s.height * .58),
        r = min(s.width * .4, s.height * .42);
    c.drawCircle(
      center,
      r * 1.16,
      Paint()
        ..shader = RadialGradient(
          colors: [
            Colors.transparent,
            cyan.withValues(alpha: .035),
            Colors.transparent,
          ],
        ).createShader(Rect.fromCircle(center: center, radius: r * 1.16)),
    );
    c.drawCircle(
      center,
      r,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(-.5, -.5),
          colors: moon
              ? [
                  const Color(0xffd0cec3),
                  const Color(0xff6d7479),
                  const Color(0xff171f29),
                ]
              : [
                  const Color(0xff258eac),
                  const Color(0xff125475),
                  const Color(0xff081b36),
                ],
          stops: const [0, .5, 1],
        ).createShader(Rect.fromCircle(center: center, radius: r)),
    );
    c.save();
    c.clipPath(Path()..addOval(Rect.fromCircle(center: center, radius: r)));
    if (!moon) {
      final continents = [
        [
          -.9,
          -.52,
          -.55,
          -.7,
          -.21,
          -.48,
          -.34,
          -.13,
          -.12,
          .09,
          -.28,
          .32,
          -.43,
          .1,
          -.59,
          -.13,
          -.8,
          -.2,
        ],
        [-.27, .17, -.02, .2, .18, .42, .04, .68, -.16, .89, -.28, .57],
        [
          .3,
          -.7,
          .75,
          -.63,
          .95,
          -.22,
          .58,
          -.05,
          .4,
          .22,
          .16,
          .09,
          .24,
          -.2,
          .05,
          -.41,
        ],
        [.51, .45, .84, .4, 1, .68, .72, .76],
      ];
      for (final points in continents) {
        final path = Path()
          ..moveTo(center.dx + points[0] * r, center.dy + points[1] * r);
        for (var i = 2; i < points.length; i += 2) {
          path.lineTo(center.dx + points[i] * r, center.dy + points[i + 1] * r);
        }
        path.close();
        c.drawPath(
          path,
          Paint()..color = const Color(0xff549b99).withValues(alpha: .66),
        );
      }
      for (var i = 0; i < 17; i++) {
        final y = center.dy - r + random.nextDouble() * r * 2;
        final path = Path()
          ..moveTo(center.dx - r, y)
          ..quadraticBezierTo(center.dx, y - r * .2, center.dx + r, y + r * .2);
        c.drawPath(
          path,
          Paint()
            ..color = white.withValues(alpha: .08)
            ..style = PaintingStyle.stroke
            ..strokeWidth = random.nextDouble() * 8 + 2,
        );
      }
    } else {
      for (var i = 0; i < 38; i++) {
        final p =
            center +
            Offset(
              (random.nextDouble() * 2 - 1) * r,
              (random.nextDouble() * 2 - 1) * r,
            );
        c.drawCircle(
          p,
          random.nextDouble() * r * .1 + 2,
          Paint()..color = ink.withValues(alpha: .13),
        );
      }
    }
    c.drawCircle(
      center + Offset(r * .58, r * .15),
      r * .95,
      Paint()
        ..shader =
            RadialGradient(
              colors: [ink.withValues(alpha: .85), Colors.transparent],
            ).createShader(
              Rect.fromCircle(
                center: center + Offset(r * .8, r * .2),
                radius: r * 1.35,
              ),
            ),
    );
    c.restore();
    c.drawCircle(
      center,
      r,
      Paint()
        ..color = cyan.withValues(alpha: .3)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
    if (grid) {
      c.save();
      c.translate(center.dx, center.dy);
      c.rotate(-.3);
      c.drawOval(
        Rect.fromCenter(center: Offset.zero, width: r * 2.65, height: r * .9),
        Paint()
          ..color = cyan.withValues(alpha: .3)
          ..style = PaintingStyle.stroke
          ..strokeWidth = .7,
      );
      final a = time * .12 - .6,
          p = Offset(cos(a) * r * 1.325, sin(a) * r * .45);
      c.drawCircle(p, 4, Paint()..color = cyan);
      c.drawCircle(p, 9, Paint()..color = cyan.withValues(alpha: .12));
      c.restore();
    }
  }

  @override
  bool shouldRepaint(SpaceArt old) => old.time != time || old.moon != moon;
}

void drawRocket(
  Canvas c,
  Offset at,
  double scale, {
  double flame = 0,
  bool solar = false,
  bool legs = false,
  bool dish = false,
}) {
  c.save();
  c.translate(at.dx, at.dy);
  c.scale(scale);
  if (flame > 0) {
    c.drawPath(
      Path()
        ..moveTo(-10, 45)
        ..quadraticBezierTo(-18, 68, 0, 85 + flame * 25)
        ..quadraticBezierTo(16, 63, 10, 45)
        ..close(),
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xffffffff), orange, Color(0x00ff6431)],
        ).createShader(const Rect.fromLTWH(-20, 40, 40, 85)),
    );
  }
  if (solar) {
    for (final x in [-1, 1]) {
      c.drawRect(
        Rect.fromLTWH(x < 0 ? -74 : 22, -10, 52, 35),
        Paint()..color = const Color(0xff15475d),
      );
      for (var j = 0; j < 4; j++) {
        c.drawLine(
          Offset(x < 0 ? -74 + j * 13.0 : 22 + j * 13.0, -10),
          Offset(x < 0 ? -74 + j * 13.0 : 22 + j * 13.0, 25),
          Paint()
            ..color = cyan.withValues(alpha: .5)
            ..strokeWidth = .5,
        );
      }
      c.drawLine(
        Offset(x * 22.0, 8),
        Offset(x * 12.0, 8),
        Paint()
          ..color = dim
          ..strokeWidth = 3,
      );
    }
  }
  c.drawPath(
    Path()
      ..moveTo(-13, -39)
      ..quadraticBezierTo(-11, -56, 0, -70)
      ..quadraticBezierTo(11, -56, 13, -39)
      ..close(),
    Paint()..color = white,
  );
  c.drawRRect(
    RRect.fromRectAndRadius(
      const Rect.fromLTWH(-13, -40, 26, 77),
      const Radius.circular(3),
    ),
    Paint()
      ..shader = const LinearGradient(
        colors: [Color(0xff7895a5), Color(0xfff6f5ec), Color(0xffadbac0)],
      ).createShader(const Rect.fromLTWH(-13, -40, 26, 77)),
  );
  c.drawRect(const Rect.fromLTWH(-13, 12, 26, 9), Paint()..color = orange);
  c.drawRect(const Rect.fromLTWH(-13, -33, 26, 10), Paint()..color = panel);
  c.drawPath(
    Path()
      ..moveTo(-12, 15)
      ..lineTo(-29, 44)
      ..lineTo(-12, 34)
      ..close(),
    Paint()..color = const Color(0xff8dabb9),
  );
  c.drawPath(
    Path()
      ..moveTo(12, 15)
      ..lineTo(29, 44)
      ..lineTo(12, 34)
      ..close(),
    Paint()..color = const Color(0xffbacbd1),
  );
  c.drawPath(
    Path()
      ..moveTo(-8, 37)
      ..lineTo(-11, 46)
      ..lineTo(11, 46)
      ..lineTo(8, 37)
      ..close(),
    Paint()..color = dim,
  );
  if (legs) {
    for (final d in [-1, 1]) {
      c.drawLine(
        Offset(d * 12.0, 18),
        Offset(d * 39.0, 48),
        Paint()
          ..color = orange
          ..strokeWidth = 3,
      );
      c.drawLine(
        Offset(d * 30.0, 48),
        Offset(d * 47.0, 48),
        Paint()
          ..color = white
          ..strokeWidth = 3,
      );
    }
  }
  if (dish) {
    c.drawArc(
      const Rect.fromLTWH(12, -42, 30, 25),
      0,
      pi,
      true,
      Paint()..color = white,
    );
    c.drawLine(
      const Offset(25, -29),
      const Offset(30, -50),
      Paint()
        ..color = orange
        ..strokeWidth = 2,
    );
  }
  c.restore();
}

class CraftArt extends CustomPainter {
  final List<String> ids;
  final double time;
  CraftArt(this.ids, {this.time = 0});
  @override
  void paint(Canvas c, Size s) {
    final p = Paint()
      ..color = dim.withValues(alpha: .08)
      ..strokeWidth = .6;
    for (double x = 0; x < s.width; x += 28) {
      c.drawLine(Offset(x, 0), Offset(x, s.height), p);
    }
    for (double y = 0; y < s.height; y += 28) {
      c.drawLine(Offset(0, y), Offset(s.width, y), p);
    }
    c.drawCircle(
      Offset(s.width / 2, s.height / 2),
      s.shortestSide * .36,
      Paint()
        ..color = cyan.withValues(alpha: .08)
        ..style = PaintingStyle.stroke,
    );
    drawRocket(
      c,
      Offset(s.width / 2, s.height / 2 + sin(time) * 3),
      min(s.width / 210, s.height / 180),
      solar: ids.any((id) => id.startsWith('solar')),
      legs: ids.contains('legs'),
      dish: ids.contains('antenna2'),
    );
  }

  @override
  bool shouldRepaint(CraftArt old) => true;
}
