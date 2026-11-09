import 'package:flutter/material.dart';
import 'art.dart';

class StartupScreen extends StatefulWidget {
  final String? error;
  final VoidCallback? onRetry;
  const StartupScreen({super.key, this.error, this.onRetry});
  @override
  State<StartupScreen> createState() => _StartupScreenState();
}

class _StartupScreenState extends State<StartupScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController animation = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 8),
  )..repeat();
  @override
  void dispose() {
    animation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    home: Scaffold(
      backgroundColor: ink,
      body: AnimatedBuilder(
        animation: animation,
        builder: (c, child) => Stack(
          children: [
            Positioned.fill(
              child: Opacity(
                opacity: .3,
                child: CustomPaint(
                  painter: SpaceArt(time: animation.value * 8),
                ),
              ),
            ),
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: 120,
                      height: 120,
                      child: CustomPaint(
                        painter: CraftArt(const [
                          'core',
                        ], time: animation.value * 8),
                      ),
                    ),
                    const SizedBox(height: 22),
                    const Text(
                      'MISSION\nCONTROL',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: white,
                        fontFamily: 'SpaceGrotesk',
                        fontSize: 29,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 7,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'BEYOND THE LAUNCH',
                      style: TextStyle(
                        color: dim,
                        fontFamily: 'JetBrainsMono',
                        fontSize: 10,
                        letterSpacing: 3,
                      ),
                    ),
                    const SizedBox(height: 32),
                    if (widget.error != null) ...[
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 400),
                        child: Text(
                          widget.error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: white, height: 1.7),
                        ),
                      ),
                      const SizedBox(height: 20),
                      FilledButton.icon(
                        onPressed: widget.onRetry,
                        style: FilledButton.styleFrom(
                          backgroundColor: cyan,
                          foregroundColor: ink,
                        ),
                        icon: const Icon(Icons.refresh),
                        label: const Text('Retry loading'),
                      ),
                    ] else
                      const SizedBox(
                        width: 100,
                        child: LinearProgressIndicator(
                          color: cyan,
                          backgroundColor: panel,
                          minHeight: 2,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
