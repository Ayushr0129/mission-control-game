import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';

class MissionAudio {
  final ValueNotifier<bool> needsGesture = ValueNotifier(false);
  Future<bool> enable() async {
    await play('click');
    return true;
  }

  final AudioPlayer effects = AudioPlayer(), bed = AudioPlayer();
  final AudioPlayer music = AudioPlayer();
  bool _disposed = false;
  bool _muted = false,
      _musicEnabled = true,
      _musicPlaying = false,
      _activated = false;
  double _volume = .35, _musicVolume = .4;
  String _musicTrack = 'music_control';
  int _musicSerial = 0;
  bool get muted => _muted;
  set muted(bool value) {
    _muted = value;
    if (value) {
      stopMusic();
    }
  }

  double get volume => _volume;
  set volume(double value) {
    _volume = value.clamp(0, 1);
    unawaited(
      music
          .setVolume(_muted ? 0 : _volume * _musicVolume)
          .catchError((Object _) {}),
    );
  }

  bool get musicEnabled => _musicEnabled;
  set musicEnabled(bool value) {
    _musicEnabled = value;
    if (!value) {
      stopMusic();
    } else if (_activated) {
      unawaited(startMusic());
    }
  }

  double get musicVolume => _musicVolume;
  set musicVolume(double value) {
    _musicVolume = value.clamp(0, 1);
    volume = _volume;
  }

  String get musicTrack => _musicTrack;
  set musicTrack(String value) {
    final track = value == 'music_horizon' ? value : 'music_control';
    if (track == _musicTrack) return;
    _musicTrack = track;
    stopMusic();
    if (_activated) {
      unawaited(startMusic());
    }
  }

  void stopMusic() {
    _musicSerial++;
    _musicPlaying = false;
    unawaited(music.stop().catchError((Object _) {}));
  }

  Future<void> startMusic() async {
    _activated = true;
    if (_disposed || _muted || !_musicEnabled || _musicPlaying) return;
    _musicPlaying = true;
    final serial = _musicSerial;
    try {
      await music.setReleaseMode(ReleaseMode.loop);
      await music.setVolume(_volume * _musicVolume);
      if (serial != _musicSerial || _muted || !_musicEnabled) return;
      await music.play(AssetSource('audio/$_musicTrack.mp3'));
    } catch (_) {
      if (serial == _musicSerial) _musicPlaying = false;
    }
  }

  Future<void> play(String name) async {
    unawaited(startMusic());
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
    unawaited(startMusic());
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
    _disposed = true;
    _musicSerial++;
    needsGesture.dispose();
    music.dispose();
    effects.dispose();
    bed.dispose();
  }
}
