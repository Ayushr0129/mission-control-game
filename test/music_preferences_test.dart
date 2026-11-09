import 'package:flutter_test/flutter_test.dart';
import 'package:mission_control/models/models.dart';

void main() {
  test(
    'Legacy saves get safe music defaults without changing campaign data',
    () {
      final json = Programme(funding: 31, science: 42).toJson()
        ..remove('musicEnabled')
        ..remove('musicVolume')
        ..remove('musicTrack');
      final restored = Programme.fromJson(json);
      expect(restored.musicEnabled, true);
      expect(restored.musicVolume, .4);
      expect(restored.musicTrack, 'music_control');
      expect(restored.funding, 31);
      expect(restored.science, 42);
    },
  );
  test(
    'Music choices survive save restoration and invalid values are normalized',
    () {
      final p = Programme(
        musicEnabled: false,
        musicVolume: .7,
        musicTrack: 'music_horizon',
        muted: true,
      );
      final restored = Programme.fromJson(p.toJson());
      expect(restored.toJson(), p.toJson());
      final json = p.toJson()
        ..['musicVolume'] = 5
        ..['musicTrack'] = 'missing';
      final safe = Programme.fromJson(json);
      expect(safe.musicVolume, 1);
      expect(safe.musicTrack, 'music_control');
    },
  );
}
