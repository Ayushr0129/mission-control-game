import 'dart:async';
import 'dart:js_interop';
import 'dart:typed_data';
import 'package:flutter/foundation.dart' show ValueNotifier;
import 'package:flutter/services.dart' show rootBundle;
import 'package:web/web.dart' as web;

class MissionAudio {
  final ValueNotifier<bool> needsGesture = ValueNotifier(false);
  final Map<String, Future<web.AudioBuffer>> _buffers = {};
  web.AudioContext? _context;
  web.GainNode? _effectsGain, _bedGain, _musicGain;
  web.AudioBufferSourceNode? _effect, _bed, _music;
  bool _muted = false, _disposed = false;
  double _volume = .35;
  int _effectSerial = 0, _bedSerial = 0, _musicSerial = 0;
  bool _musicEnabled = true, _musicPending = false;
  double _musicVolume = .4;
  String _musicTrack = 'music_control';
  bool get musicEnabled => _musicEnabled;
  set musicEnabled(bool value) {
    _musicEnabled = value;
    if (!value) {
      stopMusic();
    } else if (_context != null) {
      unawaited(startMusic());
    }
  }

  double get musicVolume => _musicVolume;
  set musicVolume(double value) {
    _musicVolume = value.clamp(0, 1);
    _updateVolume();
  }

  String get musicTrack => _musicTrack;
  set musicTrack(String value) {
    final track = value == 'music_horizon' ? value : 'music_control';
    if (track == _musicTrack) return;
    _musicTrack = track;
    stopMusic();
    if (_context != null) {
      unawaited(startMusic());
    }
  }

  void stopMusic() {
    _musicSerial++;
    _musicPending = false;
    _stopNode(_music);
    _music = null;
  }

  Future<void> startMusic() async {
    if (_disposed ||
        _muted ||
        !_musicEnabled ||
        _music != null ||
        _musicPending) {
      return;
    }
    _musicPending = true;
    final serial = _musicSerial;
    final unlocked = _unlock();
    try {
      if (!await unlocked) return;
      final buffer = await _buffer(_musicTrack);
      if (_disposed || _muted || !_musicEnabled || serial != _musicSerial) {
        return;
      }
      final source = _context!.createBufferSource()
        ..buffer = buffer
        ..loop = true;
      source.connect(_musicGain!);
      source.start();
      _music = source;
    } catch (_) {
      _blocked(true);
    } finally {
      if (serial == _musicSerial) _musicPending = false;
    }
  }

  bool get muted => _muted;
  set muted(bool value) {
    _muted = value;
    if (value) {
      stopMusic();
      _effectSerial++;
      _bedSerial++;
      _stopNode(_effect);
      _stopNode(_bed);
      _effect = _bed = null;
    }
    _updateVolume();
  }

  double get volume => _volume;
  set volume(double value) {
    _volume = value.clamp(0, 1);
    _updateVolume();
  }

  void _updateVolume() {
    _effectsGain?.gain.value = _muted ? 0 : _volume;
    _bedGain?.gain.value = _muted ? 0 : _volume * .45;
    _musicGain?.gain.value = _muted || !_musicEnabled
        ? 0
        : _volume * _musicVolume;
  }

  web.AudioContext _getContext() {
    if (_context == null) {
      final context = web.AudioContext();
      _context = context;
      _effectsGain = context.createGain()..connect(context.destination);
      _bedGain = context.createGain()..connect(context.destination);
      _musicGain = context.createGain()..connect(context.destination);
      _updateVolume();
    }
    return _context!;
  }

  void _blocked(bool value) {
    if (!_disposed) needsGesture.value = value;
  }

  Future<bool> _unlock() async {
    if (_disposed || _muted) return false;
    try {
      final context = _getContext();
      // IMPORTANT: resume is invoked synchronously in the click/tap/key handler,
      // before the first await or network/decode operation. Safari can then keep
      // the context unlocked for later engine, warning and mission sounds.
      final resumed = context.resume().toDart;
      await resumed.timeout(const Duration(seconds: 3));
      final running = !_disposed && context.state == 'running';
      _blocked(!running);
      return running;
    } catch (_) {
      _blocked(true);
      return false;
    }
  }

  Future<web.AudioBuffer> _buffer(String name) async {
    final future = _buffers.putIfAbsent(name, () async {
      final extension = name.startsWith('music_') ? 'mp3' : 'wav';
      final data = await rootBundle.load('assets/audio/$name.$extension');
      // decodeAudioData may detach its input; do not detach Flutter's asset cache.
      final copy = Uint8List.fromList(
        data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes),
      );
      return _context!.decodeAudioData(copy.buffer.toJS).toDart;
    });
    try {
      return await future;
    } catch (_) {
      _buffers.remove(name); // A failed media fetch can be retried.
      rootBundle.evict(
        'assets/audio/$name.${name.startsWith('music_') ? 'mp3' : 'wav'}',
      );
      rethrow;
    }
  }

  Future<void> play(String name) async {
    unawaited(startMusic());
    if (_disposed || _muted) return;
    final serial = ++_effectSerial;
    final unlocked = _unlock();
    try {
      if (!await unlocked) return;
      final buffer = await _buffer(name);
      if (_disposed || _muted || serial != _effectSerial) return;
      _stopNode(_effect);
      final source = _context!.createBufferSource()..buffer = buffer;
      source.connect(_effectsGain!);
      source.start();
      _effect = source;
      _blocked(false);
    } catch (_) {
      _blocked(true);
    }
  }

  Future<void> loop(String name) async {
    unawaited(startMusic());
    if (_disposed || _muted) return;
    final serial = ++_bedSerial;
    _stopNode(_bed);
    _bed = null;
    final unlocked = _unlock();
    try {
      if (!await unlocked) return;
      final buffer = await _buffer(name);
      if (_disposed || _muted || serial != _bedSerial) return;
      final source = _context!.createBufferSource()
        ..buffer = buffer
        ..loop = true;
      source.connect(_bedGain!);
      source.start();
      _bed = source;
      _blocked(false);
    } catch (_) {
      _blocked(true);
    }
  }

  Future<bool> enable() async {
    muted = false;
    // play calls resume before awaiting. The click confirms that decoded audio,
    // rather than just the AudioContext constructor, is usable.
    await play('click');
    return !_disposed && !needsGesture.value;
  }

  void _stopNode(web.AudioBufferSourceNode? source) {
    if (source == null) return;
    try {
      source.stop();
    } catch (_) {
      /* It may have already ended. */
    }
    try {
      source.disconnect();
    } catch (_) {
      /* Already disconnected. */
    }
  }

  Future<void> stop() async {
    _bedSerial++;
    _stopNode(_bed);
    _bed = null;
  }

  void dispose() {
    _disposed = true;
    stopMusic();
    _effectSerial++;
    _bedSerial++;
    _stopNode(_bed);
    _stopNode(_effect);
    final context = _context;
    if (context != null) {
      unawaited(
        context.close().toDart.then<void>((_) {}).catchError((Object _) {}),
      );
    }
    needsGesture.dispose();
  }
}
