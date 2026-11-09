import 'dart:math';
import 'package:flutter/material.dart';

const ink = Color(0xff101214),
    panel = Color(0xff191d21),
    cyan = Color(0xff9fcae0),
    orange = Color(0xffe6b665),
    dim = Color(0xff9aa5ae),
    white = Color(0xffedf0f2);

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

// Shared technical illustration; vector geometry adds no image downloads.
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
  final metal = Paint()
    ..shader = const LinearGradient(
      colors: [
        Color(0xff777f87),
        Color(0xfff0f1ed),
        Color(0xffb6bec3),
        Color(0xff59636c),
      ],
      stops: [0, .32, .7, 1],
    ).createShader(const Rect.fromLTWH(-13, -70, 26, 120));
  if (flame > 0) {
    final length = 50 + flame * 75;
    final plume = Path()
      ..moveTo(-8, 46)
      ..quadraticBezierTo(-16, 70, 0, 46 + length)
      ..quadraticBezierTo(16, 70, 8, 46)
      ..close();
    c.drawPath(
      plume,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xffeff5ff), Color(0xffffcd83), Color(0x00d9773f)],
        ).createShader(Rect.fromLTWH(-16, 46, 32, length)),
    );
    c.drawPath(
      Path()
        ..moveTo(-4, 46)
        ..lineTo(0, 75 + flame * 28)
        ..lineTo(4, 46)
        ..close(),
      Paint()..color = white,
    );
  }
  if (solar) drawSolarArrays(c);
  // Slender fairing and cylindrical launch stack, with visible stage joints.
  c.drawPath(
    Path()
      ..moveTo(-13, -39)
      ..quadraticBezierTo(-12, -59, 0, -78)
      ..quadraticBezierTo(12, -59, 13, -39)
      ..close(),
    metal,
  );
  c.drawRect(const Rect.fromLTWH(-13, -40, 26, 77), metal);
  for (final y in [-38.0, -13.0, 14.0, 33.0]) {
    c.drawRect(
      Rect.fromLTWH(-13, y, 26, 2),
      Paint()..color = const Color(0xff424b53),
    );
  }
  c.drawRect(
    const Rect.fromLTWH(-13, -9, 26, 12),
    Paint()..color = const Color(0xff262b30),
  );
  for (final x in [-10.0, -5.0, 0.0, 5.0, 10.0]) {
    c.drawLine(
      Offset(x, 16),
      Offset(x, 31),
      Paint()
        ..color = const Color(0xff758089)
        ..strokeWidth = .5,
    );
  }
  c.drawLine(
    const Offset(7, -35),
    const Offset(7, 30),
    Paint()
      ..color = dim
      ..strokeWidth = 1.3,
  );
  c.drawPath(
    Path()
      ..moveTo(-7, 37)
      ..lineTo(-10, 46)
      ..lineTo(10, 46)
      ..lineTo(7, 37)
      ..close(),
    Paint()..color = const Color(0xff525c64),
  );
  c.drawLine(
    const Offset(-10, 46),
    const Offset(10, 46),
    Paint()
      ..color = white
      ..strokeWidth = 1,
  );
  // Small stabilisers instead of oversized cartoon fins.
  for (final d in [-1.0, 1.0]) {
    c.drawPath(
      Path()
        ..moveTo(d * 12, 22)
        ..lineTo(d * 21, 39)
        ..lineTo(d * 12, 35)
        ..close(),
      Paint()..color = dim,
    );
    if (legs) {
      c.drawLine(
        Offset(d * 12, 20),
        Offset(d * 36, 48),
        Paint()
          ..color = dim
          ..strokeWidth = 2,
      );
      c.drawLine(
        Offset(d * 29, 48),
        Offset(d * 43, 48),
        Paint()
          ..color = white
          ..strokeWidth = 2,
      );
    }
  }
  if (dish) drawDish(c);
  c.restore();
}

void drawSolarArrays(Canvas c) {
  for (final d in [-1.0, 1.0]) {
    c.drawLine(
      Offset(d * 14, 0),
      Offset(d * 76, 0),
      Paint()
        ..color = dim
        ..strokeWidth = 2,
    );
    final rect = Rect.fromLTWH(d < 0 ? -78 : 26, -21, 52, 42);
    c.drawRect(rect, Paint()..color = const Color(0xff1d344a));
    c.drawRect(
      rect,
      Paint()
        ..color = dim
        ..style = PaintingStyle.stroke
        ..strokeWidth = .7,
    );
    for (var i = 1; i < 8; i++) {
      final x = rect.left + i * 6.5;
      c.drawLine(
        Offset(x, rect.top),
        Offset(x, rect.bottom),
        Paint()
          ..color = const Color(0xff7896af)
          ..strokeWidth = .5,
      );
    }
    for (var i = 1; i < 5; i++) {
      final y = rect.top + i * 8.4;
      c.drawLine(
        Offset(rect.left, y),
        Offset(rect.right, y),
        Paint()
          ..color = const Color(0xff7896af)
          ..strokeWidth = .5,
      );
    }
  }
}

void drawDish(Canvas c) {
  c.drawLine(
    const Offset(7, -24),
    const Offset(30, -47),
    Paint()
      ..color = dim
      ..strokeWidth = 2,
  );
  c.save();
  c.translate(29, -43);
  c.rotate(-.55);
  c.drawArc(
    const Rect.fromLTWH(-16, -13, 32, 26),
    0,
    pi,
    true,
    Paint()..color = white,
  );
  c.drawLine(
    const Offset(0, 0),
    const Offset(0, -17),
    Paint()
      ..color = dim
      ..strokeWidth = 1,
  );
  c.drawCircle(const Offset(0, -17), 1.8, Paint()..color = orange);
  c.restore();
}

void instrumentText(
  Canvas c,
  String text,
  Offset position, {
  Color color = dim,
  double size = 9,
}) {
  final painter = TextPainter(
    text: TextSpan(
      text: text,
      style: TextStyle(
        color: color,
        fontFamily: 'JetBrainsMono',
        fontSize: size,
        letterSpacing: .7,
      ),
    ),
    textDirection: TextDirection.ltr,
  )..layout();
  painter.paint(c, position);
}

class CraftArt extends CustomPainter {
  final List<String> ids;
  final double time;
  CraftArt(List<String> ids, {this.time = 0}) : ids = List.of(ids);
  @override
  void paint(Canvas c, Size s) {
    final line = Paint()
      ..color = dim.withValues(alpha: .12)
      ..strokeWidth = .5;
    for (double x = 0; x < s.width; x += 24) {
      c.drawLine(Offset(x, 0), Offset(x, s.height), line);
    }
    for (double y = 0; y < s.height; y += 24) {
      c.drawLine(Offset(0, y), Offset(s.width, y), line);
    }
    instrumentText(
      c,
      'PAYLOAD / CONFIGURATION VIEW',
      const Offset(14, 12),
      size: 8,
    );
    instrumentText(c, 'NOT TO SCALE', Offset(14, s.height - 23), size: 8);
    final scale = min(s.width / 255, s.height / 200);
    c.save();
    c.translate(s.width / 2, s.height * .52);
    c.scale(scale);
    final outline = Paint()
      ..color = dim
      ..style = PaintingStyle.stroke
      ..strokeWidth = .7;
    c.drawLine(
      const Offset(0, -85),
      const Offset(0, 83),
      Paint()..color = dim.withValues(alpha: .3),
    );
    if (ids.any((id) => id.startsWith('solar'))) drawSolarArrays(c);
    if (ids.contains('core')) {
      c.drawPath(
        Path()
          ..moveTo(-18, -28)
          ..lineTo(10, -28)
          ..lineTo(20, -18)
          ..lineTo(20, 24)
          ..lineTo(-9, 29)
          ..lineTo(-20, 18)
          ..lineTo(-20, -18)
          ..close(),
        Paint()..color = const Color(0xffa39469),
      );
      // Multi-layer thermal insulation, folded facets and structural rails.
      for (var i = 0; i < 7; i++) {
        c.drawLine(
          Offset(-18 + i * 5.0, -25),
          Offset(-16 + i * 5.0, 24),
          Paint()
            ..color = const Color(0xffd7c593).withValues(alpha: .5)
            ..strokeWidth = .7,
        );
      }
      c.drawRect(const Rect.fromLTWH(-19, -26, 38, 51), outline);
      c.drawRect(const Rect.fromLTWH(-12, -34, 24, 7), Paint()..color = white);
      c.drawRect(
        const Rect.fromLTWH(15, -20, 7, 40),
        Paint()..color = const Color(0xffc2c9cd),
      );
    }
    if (ids.any((id) => id.startsWith('tank'))) {
      c.drawOval(
        const Rect.fromLTWH(-15, 19, 30, 24),
        Paint()..color = const Color(0xff919ba3),
      );
      c.drawLine(const Offset(0, 21), const Offset(0, 42), outline);
    }
    if (ids.any((id) => id.startsWith('engine'))) {
      c.drawPath(
        Path()
          ..moveTo(-6, 38)
          ..lineTo(-13, 57)
          ..quadraticBezierTo(0, 61, 13, 57)
          ..lineTo(6, 38)
          ..close(),
        Paint()..color = dim,
      );
      c.drawOval(const Rect.fromLTWH(-13, 54, 26, 6), Paint()..color = ink);
    }
    if (ids.any((id) => id.startsWith('antenna'))) {
      if (ids.contains('antenna2')) {
        drawDish(c);
      } else {
        c.drawLine(
          const Offset(6, -34),
          const Offset(6, -65),
          Paint()
            ..color = white
            ..strokeWidth = 1.2,
        );
      }
    }
    if (ids.contains('camera') || ids.contains('spectrometer')) {
      c.drawRect(
        const Rect.fromLTWH(-29, -10, 12, 18),
        Paint()..color = const Color(0xff59646d),
      );
      c.drawCircle(const Offset(-24, -1), 4, Paint()..color = ink);
      c.drawCircle(const Offset(-24, -1), 2, Paint()..color = cyan);
    }
    if (ids.contains('legs')) {
      for (final d in [-1.0, 1.0]) {
        c.drawLine(
          Offset(d * 17, 16),
          Offset(d * 40, 58),
          Paint()
            ..color = dim
            ..strokeWidth = 2,
        );
        c.drawLine(
          Offset(d * 32, 58),
          Offset(d * 49, 58),
          Paint()
            ..color = white
            ..strokeWidth = 2,
        );
      }
    }
    // Dimension witness lines frame the spacecraft like an integration drawing.
    for (final y in [-70.0, 65.0]) {
      c.drawLine(Offset(88, y), Offset(101, y), outline);
    }
    c.drawLine(const Offset(96, -70), const Offset(96, 65), outline);
    c.restore();
    instrumentText(c, '+Z', Offset(s.width / 2 + 8, 36), color: cyan, size: 8);
  }

  @override
  bool shouldRepaint(CraftArt old) => old.ids.join(',') != ids.join(',');
}
