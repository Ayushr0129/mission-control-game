import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flame/game.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'models/models.dart';
import 'services/engineering.dart';
import 'services/storage.dart';
import 'services/campaign.dart';
import 'services/flight.dart';
import 'services/operations.dart';
import 'services/audio.dart';
import 'game/mission_game.dart';
import 'widgets/art.dart';
import 'widgets/ui.dart';
import 'widgets/startup.dart';
import 'widgets/flight_input.dart';

part 'app/controller.dart';
part 'screens/console.dart';
part 'screens/mission_screens.dart';
part 'screens/extras.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const StartupScreen());
  final minimumSplash = Future<void>.delayed(const Duration(milliseconds: 850));
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  final data = await Future.wait([
    rootBundle.loadString('assets/data/missions.json'),
    rootBundle.loadString('assets/data/components.json'),
  ]);
  final store = SaveStore(await SharedPreferences.getInstance());
  await minimumSplash;
  runApp(
    MissionControl(
      store: store,
      missions: (jsonDecode(data[0]) as List).map((j) => Mission(j)).toList(),
      parts: (jsonDecode(data[1]) as List).map((j) => Part(j)).toList(),
    ),
  );
}

class MissionControl extends StatefulWidget {
  final SaveStore store;
  final List<Mission> missions;
  final List<Part> parts;
  const MissionControl({
    super.key,
    required this.store,
    required this.missions,
    required this.parts,
  });
  @override
  State<MissionControl> createState() => _ControlState();
}
