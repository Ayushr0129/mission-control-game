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
  web.GainNode? _effectsGain, _bedGain;
  web.AudioBufferSourceNode? _effect, _bed;
  bool _muted = false, _disposed = false;
  double _volume = .35;
  int _effectSerial = 0, _bedSerial = 0;

  bool get muted => _muted;
  set muted(bool value) {
    _muted = value;
    if (value) {
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
  }

  web.AudioContext _getContext() {
    if (_context == null) {
      final context = web.AudioContext();
      _context = context;
      _effectsGain = context.createGain()..connect(context.destination);
      _bedGain = context.createGain()..connect(context.destination);
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
      final data = await rootBundle.load('assets/audio/$name.wav');
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
      rootBundle.evict('assets/audio/$name.wav');
      rethrow;
    }
  }

  Future<void> play(String name) async {
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
