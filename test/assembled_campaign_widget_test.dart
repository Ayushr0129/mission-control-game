import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mission_control/main.dart';
import 'package:mission_control/models/models.dart';
import 'package:mission_control/services/storage.dart';
import 'package:mission_control/simulator/simulator_screen.dart';

void main() {
  testWidgets(
    'Mission design opens physical assembly and continuation never recharges launch',
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
      await t.pumpAndSettle();
      Future<void> press(String text) async {
        final f = find.text(text).first;
        await t.ensureVisible(f);
        await t.tap(f);
        await t.pump(const Duration(milliseconds: 400));
      }

      await press('Enter mission control');
      await press('Touch the edge');
      await press('Design spacecraft');
      await t.pumpAndSettle();
      expect(find.byType(SimulatorScreen), findsOneWidget);
      expect(find.text('CAMPAIGN / Touch the edge'), findsOneWidget);
      await press('Load mission baseline');
      await press('Launch assembled rocket');
      expect(store.load().funding, closeTo(35, .001));
      expect(store.load().active!['stage'], 'assembly');
      expect(store.load().attempts, 1);
      await press('Ignite & launch');
      await t.tap(find.byTooltip('Save and return to mission control'));
      await t.pumpAndSettle();
      await press('Continue mission');
      await t.pumpAndSettle();
      expect(find.byType(SimulatorScreen), findsOneWidget);
      expect(find.text('Resume simulation'), findsOneWidget);
      expect(store.load().funding, closeTo(35, .001));
      expect(store.load().attempts, 1);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
    },
  );
}
