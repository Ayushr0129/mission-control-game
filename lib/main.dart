import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart';
import 'package:flame/game.dart';
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
import 'simulator/simulator_screen.dart';

part 'app/controller.dart';
part 'app/bootstrap.dart';
part 'screens/console.dart';
part 'screens/mission_screens.dart';
part 'screens/extras.dart';
part 'screens/planning.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MissionBootstrap());
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
