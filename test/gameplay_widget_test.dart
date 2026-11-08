import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mission_control/main.dart';
import 'package:mission_control/models/models.dart';
import 'package:mission_control/services/storage.dart';

void main() {
  Future<SaveStore> mount(WidgetTester tester, {double width = 390}) async {
    tester.view.physicalSize = Size(width, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    SharedPreferences.setMockInitialValues({});
    final store = SaveStore(await SharedPreferences.getInstance());
    await tester.pumpWidget(
      MissionControl(
        store: store,
        missions:
            (jsonDecode(File('assets/data/missions.json').readAsStringSync())
                    as List)
                .map((j) => Mission(j))
                .toList(),
        parts:
            (jsonDecode(File('assets/data/components.json').readAsStringSync())
                    as List)
                .map((j) => Part(j))
                .toList(),
      ),
    );
    await tester.pumpAndSettle();
    return store;
  }

  Future<void> tap(WidgetTester t, String text) async {
    final f = find.text(text).first;
    await t.ensureVisible(f);
    await t.tap(f);
    await t.pump(const Duration(milliseconds: 300));
  }

  testWidgets(
    'Phone flow: plan, change a component, launch, save and resume paused',
    (t) async {
      final store = await mount(t);
      expect(find.text('Small steps. Infinite possibilities.'), findsOneWidget);
      await tap(t, 'Enter mission control');
      await tap(t, 'Touch the edge');
      await tap(t, 'Design spacecraft');
      expect(find.text('FLIGHT READY'), findsOneWidget);
      await tap(t, 'Electrical');
      await tap(t, 'Solar wings');
      expect(
        find.textContaining('Power demand exceeds generation'),
        findsOneWidget,
      );
      await tap(t, 'Solar wings');
      expect(find.text('FLIGHT READY'), findsOneWidget);
      await tap(t, 'Proceed to launch');
      expect(find.text('SIMULATION PAUSED'), findsOneWidget);
      await tap(t, 'Save & return to console');
      expect(store.load().active!['stage'], 'flight');
      await tap(t, 'Continue mission');
      expect(find.text('SIMULATION PAUSED'), findsOneWidget);
      expect(find.text('Ignition & liftoff'), findsOneWidget);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      await t.pump();
    },
  );
  testWidgets(
    'Desktop console, achievements and settings render without layout exceptions',
    (t) async {
      await mount(t, width: 1440);
      expect(t.takeException(), isNull);
      await tap(t, 'Milestones');
      expect(find.text('Proof of possibility.'), findsOneWidget);
      await tap(t, 'Settings');
      expect(find.text('Your mission. Your pace.'), findsOneWidget);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      await t.pump();
    },
  );
}
