import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';

/// Keeps a session copy if Safari storage is unavailable or reaches its quota.
/// A false write result always means that progress is NOT durable across reloads.
class SaveStore {
  static const key = 'mission_control_v1';
  final SharedPreferences? _prefs;
  final Map<String, String> _session = {};
  bool _healthy;
  SaveStore(SharedPreferences prefs) : _prefs = prefs, _healthy = true;
  SaveStore.session() : _prefs = null, _healthy = false;
  bool get persistent => _prefs != null && _healthy;

  static Future<SaveStore> open({
    Future<SharedPreferences> Function()? preferences,
    Duration timeout = const Duration(seconds: 8),
  }) async {
    try {
      final prefs = await (preferences ?? SharedPreferences.getInstance)()
          .timeout(timeout);
      return SaveStore(prefs);
    } catch (_) {
      // Do not delete, reset or overwrite an inaccessible existing save.
      return SaveStore.session();
    }
  }

  String? readString(String key) {
    if (_session.containsKey(key)) return _session[key];
    try {
      final value = _prefs?.getString(key);
      if (value != null) _session[key] = value;
      return value;
    } catch (_) {
      _healthy = false;
      return null;
    }
  }

  Future<bool> writeString(String key, String value) async {
    _session[key] = value;
    if (_prefs == null) return false;
    try {
      _healthy = await _prefs.setString(key, value);
    } catch (_) {
      _healthy = false;
    }
    return _healthy;
  }

  Programme load() {
    try {
      final raw = readString(key);
      if (raw != null) return Programme.fromJson(jsonDecode(raw));
    } catch (_) {
      // An invalid save is not deleted as part of startup.
    }
    return Programme();
  }

  Future<bool> save(Programme p) => writeString(key, jsonEncode(p.toJson()));
}
