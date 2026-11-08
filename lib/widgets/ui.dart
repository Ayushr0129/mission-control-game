import 'package:flutter/material.dart';
import 'art.dart';

Text label(String s, {Color color = dim, double size = 10}) => Text(
  s,
  style: TextStyle(
    fontSize: size,
    fontFamily: 'JetBrainsMono',
    letterSpacing: 1.7,
    color: color,
    fontWeight: FontWeight.w500,
  ),
);

class Plate extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  final Color? color;
  const Plate({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(22),
    this.color,
  });
  @override
  Widget build(BuildContext context) => Container(
    padding: padding,
    decoration: BoxDecoration(
      color: color ?? panel.withValues(alpha: .72),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: dim.withValues(alpha: .16)),
    ),
    child: Material(type: MaterialType.transparency, child: child),
  );
}

class ActionButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool secondary;
  final IconData icon;
  const ActionButton(
    this.text, {
    super.key,
    this.onPressed,
    this.secondary = false,
    this.icon = Icons.arrow_forward_rounded,
  });
  @override
  Widget build(BuildContext context) => FilledButton.icon(
    onPressed: onPressed,
    style: FilledButton.styleFrom(
      backgroundColor: secondary ? const Color(0xff1a2c3c) : cyan,
      foregroundColor: secondary ? white : ink,
      disabledBackgroundColor: dim.withValues(alpha: .15),
      disabledForegroundColor: dim,
      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 20),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(7)),
    ),
    icon: Icon(icon, size: 17),
    label: Text(
      text,
      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
    ),
  );
}

class Metric extends StatelessWidget {
  final String title, value, unit;
  final Color color;
  const Metric(
    this.title,
    this.value, {
    super.key,
    this.unit = '',
    this.color = white,
  });
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      label(title, size: 9),
      const SizedBox(height: 10),
      Text.rich(
        TextSpan(
          text: value,
          style: TextStyle(
            fontSize: 25,
            fontWeight: FontWeight.w500,
            color: color,
            letterSpacing: -1,
          ),
          children: [
            TextSpan(
              text: ' $unit',
              style: const TextStyle(
                fontSize: 11,
                color: dim,
                letterSpacing: 0,
              ),
            ),
          ],
        ),
      ),
    ],
  );
}

class Tag extends StatelessWidget {
  final String text;
  final Color color;
  const Tag(this.text, {super.key, this.color = cyan});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .08),
      border: Border.all(color: color.withValues(alpha: .2)),
      borderRadius: BorderRadius.circular(4),
    ),
    child: label(text, color: color, size: 9),
  );
}

class PageHeading extends StatelessWidget {
  final String eyebrow, title, description;
  final Widget? trailing;
  const PageHeading(
    this.eyebrow,
    this.title,
    this.description, {
    super.key,
    this.trailing,
  });
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 28),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        label(eyebrow, color: cyan),
        const SizedBox(height: 12),
        Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 20,
          runSpacing: 12,
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: MediaQuery.sizeOf(context).width < 600 ? 31 : 40,
                fontWeight: FontWeight.w600,
                letterSpacing: -1.5,
              ),
            ),
            ?trailing,
          ],
        ),
        const SizedBox(height: 10),
        Text(
          description,
          style: const TextStyle(color: dim, fontSize: 13, height: 1.7),
        ),
      ],
    ),
  );
}
