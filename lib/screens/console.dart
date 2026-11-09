part of '../main.dart';

class _ControlState extends MissionController
    with MissionScreens, ExtrasScreens, PlanningScreens {
  @override
  Widget build(BuildContext context) {
    final theme = ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: ink,
      colorScheme: const ColorScheme.dark(
        primary: cyan,
        secondary: orange,
        surface: panel,
        onSurface: white,
      ),
      fontFamily: 'SpaceGrotesk',
      useMaterial3: true,
      dividerColor: dim.withValues(alpha: .15),
      sliderTheme: const SliderThemeData(
        activeTrackColor: cyan,
        thumbColor: cyan,
        trackHeight: 3,
      ),
      textTheme: const TextTheme(
        bodyMedium: TextStyle(color: white, fontSize: 14, height: 1.45),
        bodySmall: TextStyle(color: dim, fontSize: 12),
      ),
    );
    return MaterialApp(
      title: 'MISSION CONTROL — Beyond the Launch',
      debugShowCheckedModeBanner: false,
      theme: theme,
      scaffoldMessengerKey: messenger,
      home: LayoutBuilder(
        builder: (context, box) {
          final wide = box.maxWidth >= 1000;
          return Scaffold(
            body: SafeArea(
              child: Row(
                children: [
                  if (wide) navigation(true),
                  Expanded(
                    child: Column(
                      children: [
                        topBar(wide),
                        if (!saveOk)
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 20,
                              vertical: 10,
                            ),
                            color: orange.withValues(alpha: .1),
                            child: const Text(
                              'Session only: progress stays in this tab. Reloading will lose it while device storage is unavailable.',
                              style: TextStyle(
                                color: orange,
                                fontSize: 11,
                                height: 1.5,
                              ),
                            ),
                          ),
                        Expanded(
                          child: page == 'flight'
                              ? FlightInput(
                                  togglePause: toggleFlightPause,
                                  pause: pauseFlight,
                                  stage: separateStage,
                                  throttle: adjustThrottle,
                                  pitch: adjustPitch,
                                  child: flightView(),
                                )
                              : SingleChildScrollView(
                                  padding: EdgeInsets.fromLTRB(
                                    wide ? 40 : 20,
                                    wide ? 30 : 22,
                                    wide ? 40 : 20,
                                    32,
                                  ),
                                  child: Center(
                                    child: ConstrainedBox(
                                      constraints: const BoxConstraints(
                                        maxWidth: 1200,
                                      ),
                                      child: content(),
                                    ),
                                  ),
                                ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            bottomNavigationBar: wide || page == 'flight'
                ? null
                : navigation(false),
          );
        },
      ),
    );
  }

  Widget navigation(bool wide) {
    final items = [
      ('home', Icons.space_dashboard_outlined, 'Overview'),
      ('missions', Icons.public, 'Missions'),
      ('workshop', Icons.handyman_outlined, 'Vehicle lab'),
      ('achievements', Icons.workspace_premium_outlined, 'Milestones'),
      ('gallery', Icons.photo_library_outlined, 'Discovery'),
      ('settings', Icons.tune, 'Settings'),
    ];
    Widget entry((String, IconData, String) item) {
      final active =
          page == item.$1 ||
          (item.$1 == 'missions' &&
              ['briefing', 'ops', 'result'].contains(page));
      return Tooltip(
        message: item.$3,
        child: InkWell(
          onTap: () {
            if (item.$1 == 'workshop' && p.active != null) {
              toast(
                'Finish or abandon your active flight before editing the spacecraft.',
              );
              return;
            }
            go(item.$1);
          },
          child: Container(
            margin: wide
                ? const EdgeInsets.symmetric(horizontal: 14, vertical: 4)
                : EdgeInsets.zero,
            padding: wide
                ? const EdgeInsets.symmetric(horizontal: 15, vertical: 14)
                : const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: active ? cyan.withValues(alpha: .09) : Colors.transparent,
              borderRadius: BorderRadius.circular(3),
            ),
            child: wide
                ? Row(
                    children: [
                      Icon(item.$2, size: 19, color: active ? cyan : dim),
                      const SizedBox(width: 13),
                      Expanded(
                        child: Text(
                          item.$3,
                          style: TextStyle(
                            fontSize: 12,
                            color: active ? cyan : dim,
                          ),
                        ),
                      ),
                    ],
                  )
                : Icon(item.$2, size: 20, color: active ? cyan : dim),
          ),
        ),
      );
    }

    if (!wide) {
      return Container(
        decoration: BoxDecoration(
          color: ink,
          border: Border(top: BorderSide(color: dim.withValues(alpha: .15))),
        ),
        child: SafeArea(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: items.map(entry).toList(),
          ),
        ),
      );
    }
    return Container(
      width: 207,
      decoration: BoxDecoration(
        color: const Color(0xff15181b),
        border: Border(right: BorderSide(color: dim.withValues(alpha: .14))),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(27, 31, 20, 37),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.radar, size: 32, color: cyan),
                const SizedBox(height: 15),
                const Text(
                  'MISSION\nCONTROL',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 2,
                    height: 1.25,
                  ),
                ),
                const SizedBox(height: 8),
                label('BEYOND THE LAUNCH', size: 7),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(left: 28, bottom: 15),
            child: label('YOUR PROGRAMME', size: 8),
          ),
          ...items.map(entry),
          const Spacer(),
          Padding(
            padding: const EdgeInsets.all(27),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Tag('SYSTEMS ONLINE'),
                const SizedBox(height: 14),
                label('SPACE APPS / FLIGHT SIM', size: 7),
                const SizedBox(height: 6),
                const Text(
                  'Every decision has\nconsequences.',
                  style: TextStyle(fontSize: 11, color: dim, height: 1.6),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget topBar(bool wide) => Container(
    height: 71,
    padding: EdgeInsets.symmetric(horizontal: wide ? 40 : 20),
    decoration: BoxDecoration(
      border: Border(bottom: BorderSide(color: dim.withValues(alpha: .16))),
    ),
    child: Row(
      children: [
        if (!wide) ...[
          const Icon(Icons.radar, color: cyan, size: 24),
          const SizedBox(width: 10),
        ],
        label(
          wide ? 'FLIGHT DIRECTOR CONSOLE' : 'MISSION CONTROL',
          size: wide ? 10 : 9,
        ),
        const Spacer(),
        if (wide) ...[
          label('PROGRAMME 01', size: 9),
          const SizedBox(width: 24),
        ],
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(
            color: saveOk ? cyan : orange,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 8),
        label(
          saveOk ? (sandbox ? 'FREE PLAY' : 'LOCAL SAVE') : 'SESSION ONLY',
          size: 8,
          color: saveOk ? dim : orange,
        ),
      ],
    ),
  );
  Widget content() => switch (page) {
    'home' => home(),
    'missions' => missionsView(),
    'briefing' => briefing(),
    'workshop' => workshop(),
    'ops' => operationsView(),
    'result' => result(),
    'achievements' => achievements(),
    'gallery' => gallery(),
    'settings' => settings(),
    _ => home(),
  };
  Widget home() {
    final next = p.completed.length.clamp(0, 3);
    final m = widget.missions[next];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        PageHeading(
          'FLIGHT OPERATIONS / PROGRAMME STATUS',
          'Flight director console.',
          'Review programme resources, configure the flight vehicle, and direct the next mission.',
          trailing: const Tag('CAMPAIGN / 01'),
        ),
        LayoutBuilder(
          builder: (c, b) => Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              for (final metric in [
                Metric(
                  'PROGRAMME FUNDING',
                  '\$${p.funding.toStringAsFixed(1)}',
                  unit: 'M',
                  color: cyan,
                ),
                Metric(
                  'PUBLIC TRUST',
                  '${p.trust.round()}',
                  unit: '%',
                  color: p.trust < 35 ? orange : white,
                ),
                Metric('SCIENCE RETURNED', '${p.science}', unit: 'PTS'),
                Metric(
                  'MISSIONS COMPLETE',
                  p.completed.length.toString().padLeft(2, '0'),
                  unit: '/ 04',
                ),
              ])
                SizedBox(
                  width:
                      (b.maxWidth - (b.maxWidth > 650 ? 36 : 12)) /
                      (b.maxWidth > 650 ? 4 : 2),
                  child: Plate(child: metric),
                ),
            ],
          ),
        ),
        const SizedBox(height: 25),
        adaptive(
          Container(
            height: 410,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: const Color(0xff12171c),
              border: Border.all(color: dim.withValues(alpha: .18)),
              borderRadius: BorderRadius.circular(3),
            ),
            child: Stack(
              children: [
                Positioned.fill(
                  child: CustomPaint(painter: SpaceArt(moon: next >= 2)),
                ),
                Positioned(
                  top: 25,
                  left: 25,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      label(
                        'MISSION PLANNING / TARGET BODY',
                        color: cyan,
                        size: 9,
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'EXPLORATION\nPROGRAMME 01',
                        style: TextStyle(
                          fontSize: 29,
                          fontWeight: FontWeight.w500,
                          letterSpacing: -.8,
                          height: 1.2,
                        ),
                      ),
                    ],
                  ),
                ),
                Positioned(
                  bottom: 25,
                  left: 25,
                  right: 25,
                  child: Row(
                    children: [
                      const Icon(Icons.my_location, color: cyan, size: 17),
                      const SizedBox(width: 10),
                      label(
                        next >= 2 ? 'LUNAR VICINITY' : 'EARTH / SOL SYSTEM',
                        size: 9,
                      ),
                      const Spacer(),
                      label('01 — 04', size: 9),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Plate(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    label('NEXT MISSION', color: cyan),
                    const Spacer(),
                    const Icon(Icons.north_east, color: cyan, size: 18),
                  ],
                ),
                const SizedBox(height: 24),
                label('0${next + 1} / ${m.subtitle}', size: 9),
                const SizedBox(height: 10),
                Text(
                  m.name,
                  style: const TextStyle(
                    fontSize: 27,
                    fontWeight: FontWeight.w500,
                    letterSpacing: -.5,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  m.objective,
                  style: const TextStyle(color: dim, fontSize: 13, height: 1.8),
                ),
                const SizedBox(height: 23),
                const Divider(),
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Metric(
                      'MISSION BUDGET',
                      '\$${m.budget.round()}',
                      unit: 'M',
                    ),
                    Metric('DESTINATION', next < 2 ? 'Earth' : 'Moon'),
                  ],
                ),
                const SizedBox(height: 27),
                SizedBox(
                  width: double.infinity,
                  child: ActionButton(
                    p.active != null
                        ? 'Continue mission'
                        : 'Enter mission control',
                    onPressed: p.gameOver ? null : continueMission,
                  ),
                ),
                if (p.gameOver)
                  const Padding(
                    padding: EdgeInsets.only(top: 10),
                    child: Text(
                      'Programme closed. Start a new campaign to try a new strategy.',
                      style: TextStyle(color: orange),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 25),
        Row(
          children: [
            Expanded(child: label('THE PATH AHEAD')),
            TextButton(
              onPressed: () => go('missions'),
              child: const Text(
                'View flight programme ↗',
                style: TextStyle(color: cyan, fontSize: 11),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        progressStrip(),
        const SizedBox(height: 24),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            ActionButton(
              'New campaign',
              onPressed: resetCampaign,
              secondary: true,
              icon: Icons.add,
            ),
            ActionButton(
              'Free play',
              onPressed: () {
                if (p.active != null) {
                  toast('Complete or abandon the active mission first.');
                  return;
                }
                sandbox = true;
                go('missions');
              },
              secondary: true,
              icon: Icons.all_inclusive,
            ),
          ],
        ),
      ],
    );
  }

  Widget progressStrip() => LayoutBuilder(
    builder: (c, b) => Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        for (var i = 0; i < 4; i++)
          SizedBox(
            width: b.maxWidth > 650
                ? (b.maxWidth - 30) / 4
                : (b.maxWidth - 10) / 2,
            child: InkWell(
              onTap: () => choose(i),
              child: Plate(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        label(
                          '0${i + 1}',
                          color: p.completed.contains(widget.missions[i].id)
                              ? cyan
                              : dim,
                        ),
                        const Spacer(),
                        Icon(
                          p.completed.contains(widget.missions[i].id)
                              ? Icons.check_circle_outline
                              : i == 0 ||
                                    p.completed.contains(
                                      widget.missions[i - 1].id,
                                    ) ||
                                    sandbox
                              ? Icons.arrow_outward
                              : Icons.lock_outline,
                          size: 16,
                          color: p.completed.contains(widget.missions[i].id)
                              ? cyan
                              : dim,
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Text(
                      widget.missions[i].subtitle,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        letterSpacing: .6,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      p.completed.contains(widget.missions[i].id)
                          ? 'MISSION COMPLETE'
                          : i == 0 ||
                                p.completed.contains(
                                  widget.missions[i - 1].id,
                                ) ||
                                sandbox
                          ? 'READY TO PLAN'
                          : 'AWAITING UNLOCK',
                      style: TextStyle(
                        fontFamily: 'JetBrainsMono',
                        fontSize: 7,
                        letterSpacing: .6,
                        color: p.completed.contains(widget.missions[i].id)
                            ? cyan
                            : dim,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    ),
  );
  Widget missionsView() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      PageHeading(
        sandbox ? 'EXPERIMENT WITHOUT LIMITS' : 'EXPLORATION ROADMAP',
        'One mission changes everything.',
        sandbox
            ? 'All four missions unlocked. Campaign funds, achievements, and progression stay separate.'
            : 'Each successful flight opens a new frontier. Learn, redesign, and keep exploring.',
      ),
      if (p.active != null)
        Padding(
          padding: const EdgeInsets.only(bottom: 20),
          child: ActionButton(
            'Resume active flight',
            onPressed: continueMission,
          ),
        ),
      progressStrip(),
      const SizedBox(height: 24),
      for (var i = 0; i < 4; i++)
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: missionCard(i),
        ),
      Plate(
        child: Row(
          children: [
            const Icon(Icons.lock_outline, color: dim),
            const SizedBox(width: 15),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  label('BEYOND THE MVP'),
                  const SizedBox(height: 6),
                  const Text(
                    'Lunar rovers · Human missions · Mars exploration',
                    style: TextStyle(color: dim, fontSize: 12),
                  ),
                  const Text(
                    'Future content — not playable in this release.',
                    style: TextStyle(color: dim, fontSize: 10),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ],
  );
  Widget missionCard(int i) {
    final m = widget.missions[i],
        unlocked =
            sandbox ||
            i == 0 ||
            p.completed.contains(widget.missions[i - 1].id);
    return InkWell(
      onTap: unlocked ? () => choose(i) : null,
      borderRadius: BorderRadius.circular(3),
      child: Plate(
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: unlocked
                      ? cyan.withValues(alpha: .5)
                      : dim.withValues(alpha: .2),
                ),
              ),
              child: Center(
                child: unlocked
                    ? Text(
                        '0${i + 1}',
                        style: const TextStyle(
                          fontFamily: 'JetBrainsMono',
                          color: cyan,
                          fontSize: 17,
                        ),
                      )
                    : const Icon(Icons.lock_outline, size: 18, color: dim),
              ),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  label(m.subtitle, color: unlocked ? cyan : dim, size: 9),
                  const SizedBox(height: 7),
                  Text(
                    m.name,
                    style: TextStyle(
                      fontSize: 20,
                      color: unlocked ? white : dim,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    unlocked
                        ? '${m.duration}  •  \$${m.budget.round()}M budget  •  +\$${m.reward.round()}M grant'
                        : 'Complete ${widget.missions[i - 1].subtitle.toLowerCase()} to unlock.',
                    style: const TextStyle(color: dim, fontSize: 11),
                  ),
                ],
              ),
            ),
            if (unlocked)
              const Icon(Icons.arrow_forward, color: cyan, size: 20),
          ],
        ),
      ),
    );
  }

  Widget briefing() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      PageHeading(
        'MISSION 0${selected + 1} / BRIEFING',
        mission.name,
        mission.subtitle,
      ),
      adaptive(
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 290,
              child: CustomPaint(
                painter: SpaceArt(moon: selected >= 2),
                child: const SizedBox.expand(),
              ),
            ),
            const SizedBox(height: 20),
            Plate(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  label('FLIGHT DIRECTIVE', color: cyan),
                  const SizedBox(height: 15),
                  Text(
                    mission.objective,
                    style: const TextStyle(fontSize: 18, height: 1.6),
                  ),
                  const SizedBox(height: 20),
                  Wrap(
                    spacing: 12,
                    runSpacing: 10,
                    children: [
                      Tag('BUDGET \$${mission.budget.round()}M'),
                      Tag('REWARD +\$${mission.reward.round()}M'),
                      Tag(mission.duration),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        Plate(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              label('FROM THE ARCHIVE', color: orange),
              const SizedBox(height: 18),
              Text(
                mission.history,
                style: const TextStyle(fontSize: 15, height: 1.8),
              ),
              const SizedBox(height: 24),
              label('ENGINEERING CHECKLIST'),
              const SizedBox(height: 14),
              Text(
                '• ${selected == 0 ? '100 km altitude' : '100 km altitude + 7.6 km/s horizontal speed'}\n• ${(mission.deltaV + 150).round()} m/s spacecraft Δv with reserve\n• Positive electrical power balance\n• ${mission.range == 2 ? 'Deep-space' : 'Earth-local'} communications\n• Science rating ${mission.science}${selected == 3 ? ' + landing assembly' : ''}',
                style: const TextStyle(color: dim, fontSize: 12, height: 2),
              ),
              const SizedBox(height: 25),
              SizedBox(
                width: double.infinity,
                child: ActionButton(
                  'Design spacecraft',
                  onPressed: () => go('workshop'),
                ),
              ),
              TextButton(
                onPressed: () => go('workshop'),
                child: const Text(
                  'Skip history → vehicle lab',
                  style: TextStyle(color: dim, fontSize: 11),
                ),
              ),
            ],
          ),
        ),
      ),
    ],
  );
}

Widget adaptive(Widget left, Widget right, {int flex = 6}) => LayoutBuilder(
  builder: (c, b) => b.maxWidth > 760
      ? Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(flex: flex, child: left),
            const SizedBox(width: 24),
            Expanded(flex: 10 - flex, child: right),
          ],
        )
      : Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [left, const SizedBox(height: 20), right],
        ),
);
