import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mission_control/main.dart';
import 'package:mission_control/models/models.dart';
import 'package:mission_control/services/storage.dart';

void main() {
  test(
    'Blocked browser storage falls back without pretending to persist',
    () async {
      final store = await SaveStore.open(
        preferences: () => Future.error(StateError('Storage denied')),
      );
      expect(store.persistent, isFalse);
      final programme = store.load()
        ..funding = 34.2
        ..attempts = 1;
      programme.active = {
        'mission': 0,
        'stage': 'flight',
        'flight': {'time': 80},
      };
      programme.achievements.add('First Launch');
      expect(await store.save(programme), isFalse);
      expect(store.load().toJson(), programme.toJson());
      expect(await store.writeString('gallery', '[]'), isFalse);
      expect(store.readString('gallery'), '[]');
      // A new session does not claim that a previous tab was saved to the device.
      expect(SaveStore.session().load().funding, 45);
    },
  );
  test(
    'Storage initialization cannot hold the loading screen forever',
    () async {
      final store = await SaveStore.open(
        preferences: () => Completer<SharedPreferences>().future,
        timeout: const Duration(milliseconds: 10),
      );
      expect(store.persistent, isFalse);
      expect(store.load().funding, 45);
    },
  );
  test(
    'Normal storage still restores campaign and gallery across store instances',
    () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final store = SaveStore(prefs);
      final programme = Programme()
        ..science = 37
        ..completed.add('space');
      expect(await store.save(programme), isTrue);
      expect(await store.writeString('gallery', '[{"title":"Moon"}]'), isTrue);
      final reopened = SaveStore(prefs);
      expect(reopened.persistent, isTrue);
      expect(reopened.load().toJson(), programme.toJson());
      expect(reopened.readString('gallery'), '[{"title":"Moon"}]');
    },
  );
  testWidgets('An asset-loading error presents Retry and can recover', (
    t,
  ) async {
    var calls = 0;
    await t.pumpWidget(
      MissionBootstrap(
        minimumSplash: Duration.zero,
        loader: () async {
          calls++;
          if (calls == 1) throw StateError('Network interrupted');
          return const MaterialApp(
            home: Scaffold(body: Text('Flight systems ready')),
          );
        },
      ),
    );
    await t.pump();
    await t.pump();
    expect(
      find.textContaining('Core flight data could not be loaded'),
      findsOneWidget,
    );
    expect(find.text('Retry loading'), findsOneWidget);
    expect(t.takeException(), isNull);
    await t.tap(find.text('Retry loading'));
    await t.pump();
    await t.pump();
    expect(find.text('Flight systems ready'), findsOneWidget);
    expect(calls, 2);
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
  });
  testWidgets(
    'Session-only storage still permits designing, launching and continuing',
    (t) async {
      t.view.physicalSize = const Size(390, 900);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.resetPhysicalSize);
      addTearDown(t.view.resetDevicePixelRatio);
      final store = SaveStore.session();
      await t.pumpWidget(
        MissionControl(
          store: store,
          missions:
              (jsonDecode(File('assets/data/missions.json').readAsStringSync())
                      as List)
                  .map((j) => Mission(j))
                  .toList(),
          parts:
              (jsonDecode(
                        File('assets/data/components.json').readAsStringSync(),
                      )
                      as List)
                  .map((j) => Part(j))
                  .toList(),
        ),
      );
      Future<void> tap(String text) async {
        final item = find.text(text).first;
        await t.ensureVisible(item);
        await t.tap(item);
        await t.pump(const Duration(milliseconds: 300));
      }

      await t.pump();
      expect(find.text('SESSION ONLY'), findsOneWidget);
      expect(find.textContaining('Reloading will lose it'), findsOneWidget);
      await tap('Enter mission control');
      await tap('Touch the edge');
      await tap('Subsystem design planner');
      await tap('Proceed to launch');
      await tap('Save & return to console');
      expect(store.load().funding, closeTo(34.2, .001));
      expect(store.load().active!['stage'], 'flight');
      await tap('Continue mission');
      expect(find.text('Ignition & liftoff'), findsOneWidget);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      await t.pump();
    },
  );
}
