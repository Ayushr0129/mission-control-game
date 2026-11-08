import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';

class MissionAudio {
  final ValueNotifier<bool> needsGesture = ValueNotifier(false);
  Future<bool> enable() async {
    await play('click');
    return true;
  }

  final AudioPlayer effects = AudioPlayer(), bed = AudioPlayer();
  bool muted = false;
  double volume = .35;
  Future<void> play(String name) async {
    try {
      if (!muted) {
        await effects.setVolume(volume);
        await effects.play(AssetSource('audio/$name.wav'));
      }
    } catch (_) {
      /* Audio must never block the mission. */
    }
  }

  Future<void> loop(String name) async {
    try {
      await bed.stop();
      if (!muted) {
        await bed.setVolume(volume * .45);
        await bed.setReleaseMode(ReleaseMode.loop);
        await bed.play(AssetSource('audio/$name.wav'));
      }
    } catch (_) {}
  }

  Future<void> stop() => bed.stop();
  void dispose() {
    needsGesture.dispose();
    effects.dispose();
    bed.dispose();
  }
}
