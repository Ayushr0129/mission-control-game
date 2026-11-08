// Native targets retain audioplayers. Browser audio uses an explicitly unlocked
// Web Audio context so asynchronous asset loading cannot lose Safari activation.
export 'audio_native.dart' if (dart.library.js_interop) 'audio_web.dart';
