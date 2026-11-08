import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';

class SaveStore {
  static const key = 'mission_control_v1';
  final SharedPreferences prefs;
  SaveStore(this.prefs);
  Programme load() {
    try {
      final raw = prefs.getString(key);
      if (raw != null) return Programme.fromJson(jsonDecode(raw));
    } catch (_) {
      /* Keep a corrupt save intact until a new explicit save. */
    }
    return Programme();
  }

  Future<bool> save(Programme p) =>
      prefs.setString(key, jsonEncode(p.toJson()));
}
