import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Flight-only shortcuts leave the menu's Tab/Enter navigation unchanged.
class FlightInput extends StatelessWidget {
  final Widget child;
  final VoidCallback togglePause, pause, stage;
  final ValueChanged<double> throttle, pitch;
  const FlightInput({
    super.key,
    required this.child,
    required this.togglePause,
    required this.pause,
    required this.stage,
    required this.throttle,
    required this.pitch,
  });

  @override
  Widget build(BuildContext context) => CallbackShortcuts(
    bindings: {
      const SingleActivator(LogicalKeyboardKey.space): togglePause,
      const SingleActivator(LogicalKeyboardKey.escape): pause,
      const SingleActivator(LogicalKeyboardKey.keyG): stage,
      const SingleActivator(LogicalKeyboardKey.keyW): () => throttle(.05),
      const SingleActivator(LogicalKeyboardKey.keyS): () => throttle(-.05),
      const SingleActivator(LogicalKeyboardKey.keyA): () => pitch(1),
      const SingleActivator(LogicalKeyboardKey.keyD): () => pitch(-1),
    },
    child: Focus(autofocus: true, child: child),
  );
}
