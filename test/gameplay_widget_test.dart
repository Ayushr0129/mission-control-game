import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flame/game.dart';
import 'package:mission_control/game/mission_game.dart';
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
      expect(find.text('Flight director console.'), findsOneWidget);
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
  testWidgets(
    'Keyboard and pointer controls drive the same real flight state',
    (t) async {
      await mount(t, width: 1440);
      await tap(t, 'Enter mission control');
      await tap(t, 'Touch the edge');
      await tap(t, 'Design spacecraft');
      await tap(t, 'Proceed to launch');
      final game =
          (t.widget(find.byWidgetPredicate((w) => w is GameWidget))
                      as GameWidget)
                  .game
              as MissionGame;
      await t.sendKeyEvent(LogicalKeyboardKey.keyS);
      await t.pump();
      expect(game.flight.throttle, closeTo(.95, .001));
      expect(
        t.widget<Slider>(find.byKey(const ValueKey('flight-throttle'))).value,
        closeTo(.95, .001),
      );
      await t.sendKeyEvent(LogicalKeyboardKey.keyW);
      await t.pump();
      expect(game.flight.throttle, 1);
      await t.sendKeyEvent(LogicalKeyboardKey.keyA);
      await t.pump();
      expect(game.flight.guidance, 1);
      await t.sendKeyEvent(LogicalKeyboardKey.keyD);
      await t.pump();
      expect(game.flight.guidance, 0);
      await t.sendKeyEvent(LogicalKeyboardKey.keyG);
      await t.pump();
      expect(game.flight.separated, isFalse);
      game.flight.time = 81;
      await t.sendKeyEvent(LogicalKeyboardKey.keyG);
      await t.pump();
      expect(game.flight.separated, isTrue);
      expect(find.text('Interstage separated'), findsOneWidget);
      await t.sendKeyEvent(LogicalKeyboardKey.space);
      await t.pump(const Duration(milliseconds: 50));
      expect(game.flight.started, isTrue);
      expect(game.simPaused, isFalse);
      await t.sendKeyEvent(LogicalKeyboardKey.escape);
      await t.pump();
      expect(game.simPaused, isTrue);
      // Keyboard actions do not remove or disable the original pointer slider.
      final slider = find.byKey(const ValueKey('flight-throttle'));
      await t.drag(slider, const Offset(-100, 0));
      await t.pump();
      expect(game.flight.throttle, lessThan(1));
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      await t.pump();
    },
  );
}
