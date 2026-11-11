import 'dart:math';
import 'package:flutter/material.dart';
import '../widgets/art.dart';
import 'physics.dart';

void paintPart(
  Canvas c,
  RocketPart p,
  Offset center,
  double size, {
  bool selected = false,
  double flame = 0,
}) {
  c.save();
  c.translate(center.dx, center.dy);
  c.rotate(p.rotation * pi / 2);
  final r = Rect.fromCenter(
    center: Offset.zero,
    width: size * .74,
    height: size * .94,
  );
  final metal = Paint()
    ..shader = const LinearGradient(
      colors: [Color(0xff737e88), Color(0xffe4e9eb), Color(0xff8c969e)],
    ).createShader(r);
  if (p.kind == 'capsule') {
    c.drawPath(
      Path()
        ..moveTo(0, -size * .46)
        ..lineTo(size * .37, size * .4)
        ..lineTo(-size * .37, size * .4)
        ..close(),
      metal,
    );
    c.drawCircle(
      Offset(0, size * .1),
      size * .1,
      Paint()..color = const Color(0xff253949),
    );
  } else if (p.spec.thrust > 0) {
    c.drawRect(
      Rect.fromLTWH(-size * .25, -size * .45, size * .5, size * .2),
      metal,
    );
    c.drawPath(
      Path()
        ..moveTo(-size * .17, -size * .3)
        ..lineTo(-size * .36, size * .4)
        ..lineTo(size * .36, size * .4)
        ..lineTo(size * .17, -size * .3)
        ..close(),
      Paint()..color = dim,
    );
    if (flame > 0) {
      c.drawPath(
        Path()
          ..moveTo(-size * .2, size * .4)
          ..lineTo(0, size * (.6 + flame))
          ..lineTo(size * .2, size * .4)
          ..close(),
        Paint()..color = orange,
      );
    }
  } else if (p.kind == 'separator') {
    c.drawRect(
      Rect.fromCenter(
        center: Offset.zero,
        width: size * .8,
        height: size * .25,
      ),
      Paint()..color = orange,
    );
  } else {
    c.drawRect(
      r,
      p.spec.science > 0 ? (Paint()..color = const Color(0xff9f8c54)) : metal,
    );
    c.drawLine(
      Offset(r.left, r.top + size * .12),
      Offset(r.right, r.top + size * .12),
      Paint()..color = ink,
    );
    if (p.spec.capacity > 0) {
      c.drawRect(
        Rect.fromLTWH(
          r.left + 2,
          r.bottom - 4,
          (r.width - 4) * (p.fuel / p.spec.capacity).clamp(0, 1),
          2,
        ),
        Paint()..color = cyan,
      );
    }
    if (p.spec.science > 0) {
      c.drawCircle(Offset.zero, size * .18, Paint()..color = ink);
    }
  }
  if (p.spec.power > 0) {
    c.drawRect(r, Paint()..color = const Color(0xff203f5c));
    for (var i = 1; i < 4; i++) {
      c.drawLine(
        Offset(r.left + r.width * i / 4, r.top),
        Offset(r.left + r.width * i / 4, r.bottom),
        Paint()
          ..color = cyan
          ..strokeWidth = .5,
      );
      c.drawLine(
        Offset(r.left, r.top + r.height * i / 4),
        Offset(r.right, r.top + r.height * i / 4),
        Paint()
          ..color = cyan
          ..strokeWidth = .5,
      );
    }
  }
  if (p.spec.range > 0) {
    c.drawLine(
      Offset(0, size * .3),
      Offset(0, -size * .3),
      Paint()
        ..color = ink
        ..strokeWidth = 2,
    );
    c.drawArc(
      Rect.fromCenter(
        center: Offset(0, -size * .15),
        width: size * .6,
        height: size * .45,
      ),
      0,
      pi,
      true,
      Paint()..color = white,
    );
  }
  if (p.kind == 'battery') {
    c.drawRect(
      Rect.fromCenter(center: Offset.zero, width: size * .4, height: size * .6),
      Paint()..color = const Color(0xff3f765c),
    );
    instrumentText(
      c,
      '+',
      Offset(-size * .08, -size * .15),
      color: white,
      size: size * .22,
    );
  }
  if (p.kind == 'recorder') {
    c.drawRect(
      Rect.fromCenter(
        center: Offset.zero,
        width: size * .5,
        height: size * .35,
      ),
      Paint()..color = ink,
    );
    instrumentText(
      c,
      'DATA',
      Offset(-size * .2, -size * .07),
      color: cyan,
      size: size * .12,
    );
  }
  if (p.kind == 'legs') {
    for (final d in [-1.0, 1.0]) {
      c.drawLine(
        Offset(d * size * .15, -size * .2),
        Offset(d * size * .4, size * .4),
        Paint()
          ..color = orange
          ..strokeWidth = 2,
      );
      c.drawLine(
        Offset(d * size * .25, size * .4),
        Offset(d * size * .48, size * .4),
        Paint()
          ..color = white
          ..strokeWidth = 2,
      );
    }
  }
  if (selected) {
    c.drawRect(
      Rect.fromCenter(
        center: Offset.zero,
        width: size * .98,
        height: size * .98,
      ),
      Paint()
        ..color = cyan
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
  }
  c.restore();
}

class AssemblyPainter extends CustomPainter {
  final Assembly design;
  final RocketPart? selected;
  final RocketPart? preview;
  AssemblyPainter(this.design, this.selected, {this.preview});
  @override
  void paint(Canvas c, Size s) {
    c.drawRect(Offset.zero & s, Paint()..color = panel);
    final cell = s.width / 9,
        pen = Paint()
          ..color = dim.withValues(alpha: .2)
          ..strokeWidth = .6;
    for (var i = 0; i <= 9; i++) {
      c.drawLine(Offset(i * cell, 0), Offset(i * cell, s.height), pen);
    }
    for (var i = 0; i <= 12; i++) {
      c.drawLine(Offset(0, i * cell), Offset(s.width, i * cell), pen);
    }
    for (final a in design.parts) {
      for (final b in design.parts) {
        if (a.touches(b)) {
          c.drawLine(
            Offset((a.x + a.width / 2) * cell, (a.y + a.height / 2) * cell),
            Offset((b.x + b.width / 2) * cell, (b.y + b.height / 2) * cell),
            Paint()
              ..color = dim
              ..strokeWidth = 3,
          );
        }
      }
    }
    final invalid = design.invalidIds;
    for (final p in design.parts) {
      final center = Offset(
        (p.x + p.width / 2) * cell,
        (p.y + p.height / 2) * cell,
      );
      c.save();
      c.translate(center.dx, center.dy);
      c.scale(p.width.toDouble(), p.height.toDouble());
      paintPart(c, p, Offset.zero, cell, selected: p == selected);
      c.restore();
      if (invalid.contains(p.id)) {
        c.drawRect(
          Rect.fromLTWH(
            p.x * cell,
            p.y * cell,
            p.width * cell,
            p.height * cell,
          ),
          Paint()
            ..color = orange
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2,
        );
      }
      for (final offset in [
        Offset(p.x * cell, (p.y + p.height / 2) * cell),
        Offset((p.x + p.width) * cell, (p.y + p.height / 2) * cell),
        Offset((p.x + p.width / 2) * cell, p.y * cell),
        Offset((p.x + p.width / 2) * cell, (p.y + p.height) * cell),
      ]) {
        c.drawCircle(offset, 2, Paint()..color = cyan);
      }
    }
    if (preview != null) {
      final p = preview!;
      c.drawRect(
        Rect.fromLTWH(p.x * cell, p.y * cell, p.width * cell, p.height * cell),
        Paint()
          ..color =
              (design.parts.any((b) => p.overlaps(b)) ||
                          p.x < 0 ||
                          p.y < 0 ||
                          p.x + p.width > 9 ||
                          p.y + p.height > 12
                      ? orange
                      : cyan)
                  .withValues(alpha: .3),
      );
    }
  }

  @override
  bool shouldRepaint(AssemblyPainter old) => true;
}

class FlightPainter extends CustomPainter {
  final SandboxFlight f;
  final List<Point2> prediction;
  final bool map, running;
  final double zoom;
  final Offset pan;
  FlightPainter(
    this.f,
    this.prediction,
    this.map,
    this.zoom,
    this.running, {
    this.pan = Offset.zero,
  });
  void surfaceMap(Canvas c, Size s) {
    final points = prediction.isEmpty ? [f.position] : prediction;
    final left = points.fold<double>(
      min(0, f.position.x),
      (v, p) => min(v, p.x),
    );
    final right = points.fold<double>(
      max(0, f.position.x),
      (v, p) => max(v, p.x),
    );
    final height = points.fold<double>(
      max(100, f.altitude),
      (v, p) => max(v, p.y - f.body.radius),
    );
    final scale =
        min(s.width * .8 / max(100, right - left), s.height * .65 / height) *
        zoom;
    final ground = s.height * .85 + pan.dy;
    Offset screen(Point2 p) => Offset(
      s.width / 2 + (p.x - (left + right) / 2) * scale + pan.dx,
      ground - (p.y - f.body.radius) * scale,
    );
    c.drawRect(
      Rect.fromLTRB(0, ground.clamp(0, s.height), s.width, s.height),
      Paint()..color = const Color(0xff293832),
    );
    c.drawLine(
      Offset(0, ground),
      Offset(s.width, ground),
      Paint()..color = dim,
    );
    final path = Path()
      ..moveTo(screen(points.first).dx, screen(points.first).dy);
    for (final p in points.skip(1)) {
      final at = screen(p);
      path.lineTo(at.dx, at.dy);
    }
    c.drawPath(
      path,
      Paint()
        ..color = cyan
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
    c.drawCircle(screen(f.position), 5, Paint()..color = orange);
    if (points.last.y <= f.body.radius) {
      c.drawCircle(
        screen(points.last),
        4,
        Paint()..color = const Color(0xffdc7777),
      );
    }
    instrumentText(
      c,
      'FLAT GROUND / COAST PREDICTION · g = 9.8 m/s²',
      const Offset(12, 15),
      color: cyan,
      size: 9,
    );
  }

  @override
  void paint(Canvas c, Size s) {
    c.save();
    c.clipRect(Offset.zero & s);
    c.drawRect(Offset.zero & s, Paint()..color = ink);
    if (map && f.surfaceMode) {
      surfaceMap(c, s);
    } else if (map) {
      final extent = max(
        f.body.radius * 1.3,
        min(
          f.body.radius * 8,
          prediction.fold<double>(
            f.position.length,
            (a, p) => max(a, p.length),
          ),
        ),
      );
      final scale = s.shortestSide * .44 / extent * zoom;
      final focus = max(0.0, 1 - 1 / zoom);
      final center =
          Offset(s.width / 2, s.height / 2) +
          pan -
          Offset(f.position.x * scale, -f.position.y * scale) * focus;
      Offset screen(Point2 p) => center + Offset(p.x * scale, -p.y * scale);
      c.drawCircle(
        center,
        f.body.radius * scale,
        Paint()
          ..color = (f.body.atmosphere
              ? const Color(0xff244558)
              : const Color(0xff626970)),
      );
      c.drawCircle(
        center,
        (f.body.radius + 100000) * scale,
        Paint()
          ..color = dim
          ..style = PaintingStyle.stroke
          ..strokeWidth = .7,
      );
      final path = Path();
      for (var i = 0; i < prediction.length; i++) {
        final p = screen(prediction[i]);
        if (i == 0) {
          path.moveTo(p.dx, p.dy);
        } else {
          path.lineTo(p.dx, p.dy);
        }
      }
      c.drawPath(
        path,
        Paint()
          ..color = cyan
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5,
      );
      c.drawCircle(screen(f.position), 5, Paint()..color = orange);
      final r = f.position.length, velocitySquared = f.velocity.dot(f.velocity);
      final eccentric =
          f.position * (velocitySquared / f.body.mu - 1 / r) -
          f.velocity * (f.position.dot(f.velocity) / f.body.mu);
      final direction = eccentric.length > 1e-7
          ? eccentric * (1 / eccentric.length)
          : f.position * (1 / r);
      final pe = direction * (f.periapsis + f.body.radius);
      final pep = screen(pe);
      c.drawCircle(pep, 3, Paint()..color = white);
      instrumentText(c, 'PE', pep + const Offset(6, 0), size: 8);
      if (f.apoapsis != null) {
        final ap = screen(direction * (-(f.apoapsis! + f.body.radius)));
        c.drawCircle(ap, 3, Paint()..color = cyan);
        instrumentText(c, 'AP', ap + const Offset(6, 0), size: 8);
      }
      if (prediction.isNotEmpty &&
          prediction.last.length <= f.body.radius + .01) {
        final impact = screen(
          prediction.last * (f.body.radius / prediction.last.length),
        );
        c.drawCircle(impact, 4, Paint()..color = orange);
        instrumentText(
          c,
          'COAST IMPACT',
          impact + const Offset(6, 8),
          color: orange,
          size: 8,
        );
      }

      instrumentText(
        c,
        '${f.body.name.toUpperCase()} / COAST TRAJECTORY',
        const Offset(12, 15),
        color: cyan,
      );
      instrumentText(
        c,
        f.body.atmosphere
            ? '100 KM ATMOSPHERE REFERENCE'
            : 'AIRLESS BODY / COAST PREDICTION',
        const Offset(12, 32),
        size: 8,
      );
    } else {
      final altitude = max(0, f.altitude);
      c.drawRect(
        Offset.zero & s,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              ink,
              zoom < .001 && !f.surfaceMode
                  ? ink
                  : Color.lerp(
                      f.body.atmosphere
                          ? const Color(0xff527e98)
                          : const Color(0xff222428),
                      ink,
                      (altitude / 100000).clamp(0, 1),
                    )!,
            ],
          ).createShader(Offset.zero & s),
      );
      final baseCell = min(s.width / 12, s.height / 16).clamp(12.0, 40.0);
      final metresScale = baseCell * zoom / 2;
      final cell = f.surfaceMode
          ? baseCell * zoom
          : (baseCell * zoom).clamp(2.0, 120.0);
      final bearing = f.surfaceMode ? 0.0 : atan2(f.position.x, f.position.y);
      final viewAngle = f.angle - bearing;
      final anchor = Offset(s.width / 2, s.height * .45);
      if (!f.surfaceMode) {
        final radius = f.body.radius * metresScale;
        final center = anchor + Offset(0, f.position.length * metresScale);
        final surface = Paint()
          ..color = f.body.atmosphere
              ? const Color(0xff293f45)
              : const Color(0xff626970);
        if (radius < 100000) {
          if (f.body.atmosphere) {
            c.drawCircle(
              center,
              (f.body.radius + SandboxFlight.atmosphereHeight) * metresScale,
              Paint()..color = const Color(0x66446d8e),
            );
          }
          c.drawCircle(center, radius, surface);
          c.drawCircle(
            center,
            radius,
            Paint()
              ..color = dim
              ..style = PaintingStyle.stroke
              ..strokeWidth = 1,
          );
        } else {
          // A stable local arc avoids float precision loss from a huge circle
          // when only a few metres of the planet are visible.
          final top = anchor.dy + altitude * metresScale;
          final boundary = Path();
          for (var x = -12.0; x <= s.width + 12; x += 12) {
            final dx = x - anchor.dx;
            final sag =
                dx * dx / (radius + sqrt(max(0, radius * radius - dx * dx)));
            if (x == -12) {
              boundary.moveTo(x, top + sag);
            } else {
              boundary.lineTo(x, top + sag);
            }
          }
          final fill = Path.from(boundary)
            ..lineTo(s.width + 12, s.height + 12)
            ..lineTo(-12, s.height + 12)
            ..close();
          c.drawPath(fill, surface);
          c.drawPath(
            boundary,
            Paint()
              ..color = dim
              ..style = PaintingStyle.stroke
              ..strokeWidth = 1,
          );
        }
        Offset project(Point2 p) {
          final relative = p - f.position;
          return anchor +
              Offset(
                (relative.x * cos(bearing) - relative.y * sin(bearing)) *
                    metresScale,
                -(relative.x * sin(bearing) + relative.y * cos(bearing)) *
                    metresScale,
              );
        }

        final coast = Path();
        for (var i = 0; i < prediction.length; i++) {
          final at = project(prediction[i]);
          if (i == 0) {
            coast.moveTo(at.dx, at.dy);
          } else {
            coast.lineTo(at.dx, at.dy);
          }
        }
        c.drawPath(
          coast,
          Paint()
            ..color = cyan
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5,
        );
      }
      final parts = f.craft.parts;
      final cx = parts.isEmpty
          ? 4.0
          : parts.fold<double>(
                  0,
                  (m, p) => m + (p.x + p.width / 2) * (p.dryMass + p.fuel),
                ) /
                f.craft.mass;
      final cy = parts.isEmpty
          ? 5.0
          : parts.fold<double>(
                  0,
                  (m, p) => m + (p.y + p.height / 2) * (p.dryMass + p.fuel),
                ) /
                f.craft.mass;
      if (f.surfaceMode) {
        var bottom = 0.0;
        for (final p in parts) {
          for (final x in [p.x.toDouble(), (p.x + p.width).toDouble()]) {
            for (final y in [p.y.toDouble(), (p.y + p.height).toDouble()]) {
              bottom = max(
                bottom,
                ((x - cx) * sin(f.angle) + (y - cy) * cos(f.angle)) * cell,
              );
            }
          }
        }
        final ground = f.surfaceMode
            ? s.height * .45 + bottom + altitude * cell / 2
            : min(s.height - 15, s.height * .65 + altitude * .15);
        c.drawRect(
          Rect.fromLTRB(0, ground.clamp(0, s.height), s.width, s.height),
          Paint()
            ..color = (f.body.atmosphere
                ? const Color(0xff293832)
                : const Color(0xff555b61)),
        );
        if (f.surfaceMode && ground < s.height) {
          c.drawLine(
            Offset(0, ground),
            Offset(s.width, ground),
            Paint()..color = dim,
          );
          final spacing = cell * 10;
          final offset = (s.width / 2 - f.position.x * cell / 2) % spacing;
          for (var x = offset - spacing; x < s.width; x += spacing) {
            c.drawLine(
              Offset(x, ground),
              Offset(x, ground + 8),
              Paint()..color = cyan,
            );
          }
        }
      }
      c.save();
      c.translate(s.width / 2, s.height * .45);
      c.rotate(viewAngle);
      for (final a in parts) {
        for (final b in f.craft.neighbors(a)) {
          c.drawLine(
            Offset(
              (a.x + a.width / 2 - cx) * cell,
              (a.y + a.height / 2 - cy) * cell,
            ),
            Offset(
              (b.x + b.width / 2 - cx) * cell,
              (b.y + b.height / 2 - cy) * cell,
            ),
            Paint()
              ..color = dim
              ..strokeWidth = 3,
          );
        }
      }
      for (final p in parts) {
        c.save();
        c.translate(
          (p.x + p.width / 2 - cx) * cell,
          (p.y + p.height / 2 - cy) * cell,
        );
        c.scale(p.width.toDouble(), p.height.toDouble());
        paintPart(
          c,
          p,
          Offset.zero,
          cell,
          flame:
              running &&
                  f.launched &&
                  f.enginesOn &&
                  !f.ended &&
                  f.craft.engines.contains(p) &&
                  f.craft.tanksFor(p).isNotEmpty
              ? f.throttle
              : 0,
        );
        c.restore();
      }
      c.restore();
      instrumentText(
        c,
        f.surfaceMode
            ? 'TRACKING / ACTUAL ASSEMBLY'
            : 'PLANET FLIGHT / FOLLOW CAMERA',
        const Offset(12, 15),
        color: cyan,
      );
      instrumentText(
        c,
        zoom < .001 && !f.surfaceMode
            ? 'Vehicle symbol enlarged · Coast prediction includes drag, excludes thrust.'
            : 'Coast prediction includes drag, excludes future thrust.',
        Offset(12, s.height - 20),
        size: 8,
      );
    }
    c.restore();
  }

  @override
  bool shouldRepaint(FlightPainter old) => true;
}
