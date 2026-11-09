part of '../main.dart';

mixin MissionScreens on MissionController {
  Widget workshop() {
    final e = craft,
        warnings = e.warnings(mission, p.funding, sandbox: sandbox);
    final categories = [
      'Structure',
      'Propulsion',
      'Propellant',
      'Electrical',
      'Communications',
      'Science',
      'Landing',
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        PageHeading(
          'VEHICLE LAB / MISSION 0${selected + 1}',
          'Vehicle integration.',
          'Configure ${mission.subtitle.toLowerCase()}. Every kilogram, watt, and dollar matters.',
          trailing: Tag(
            warnings.isEmpty
                ? 'FLIGHT READY'
                : '${warnings.length} ITEMS TO RESOLVE',
            color: warnings.isEmpty ? cyan : orange,
          ),
        ),
        adaptive(
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Plate(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(18),
                      child: Row(
                        children: [
                          Expanded(
                            child: label(
                              'PATHFINDER / PAYLOAD INTEGRATION',
                              size: 9,
                            ),
                          ),
                          label('SCHEMATIC', size: 8),
                        ],
                      ),
                    ),
                    SizedBox(
                      height: 290,
                      child: CustomPaint(
                        painter: CraftArt(p.design),
                        child: const SizedBox.expand(),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(18),
                      child: Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: p.design
                            .map(
                              (id) => Tag(
                                widget.parts
                                    .firstWhere((part) => part.id == id)
                                    .name
                                    .toUpperCase(),
                              ),
                            )
                            .toList(),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Plate(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    label('LIVE ENGINEERING TELEMETRY', color: cyan),
                    const SizedBox(height: 20),
                    Wrap(
                      spacing: 20,
                      runSpacing: 24,
                      children: [
                        SizedBox(
                          width: 130,
                          child: Metric(
                            'WET MASS',
                            e.wetMass.toStringAsFixed(0),
                            unit: 'kg',
                          ),
                        ),
                        SizedBox(
                          width: 130,
                          child: Metric(
                            'SPACECRAFT Δv',
                            e.deltaV.toStringAsFixed(0),
                            unit: 'm/s',
                            color: e.deltaV < mission.deltaV + 150
                                ? orange
                                : cyan,
                          ),
                        ),
                        SizedBox(
                          width: 130,
                          child: Metric(
                            'NET POWER',
                            '${e.netPower >= 0 ? '+' : ''}${e.netPower.round()}',
                            unit: 'W',
                            color: e.netPower >= 0 ? cyan : orange,
                          ),
                        ),
                        SizedBox(
                          width: 130,
                          child: Metric(
                            'TOTAL COST',
                            '\$${e.cost.toStringAsFixed(1)}',
                            unit: 'M',
                            color: !sandbox && e.cost > mission.budget
                                ? orange
                                : white,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    const Divider(),
                    const SizedBox(height: 10),
                    Text(
                      'Dry mass ${e.dryMass.round()} kg  •  Propellant ${e.fuel.round()} kg\nIsp ${e.isp.round()} s  •  Engine ${(e.thrust / 1000).round()} kN\nLiftoff TWR ${e.twr.toStringAsFixed(2)}  •  Payload limit 5,000 kg\nPower ${e.generation.round()} W generated / ${e.consumption.round()} W used\nLink ${e.range == 2
                          ? 'lunar'
                          : e.range == 1
                          ? 'Earth-local'
                          : 'none'}  •  Science rating ${e.science}',
                      style: const TextStyle(
                        color: dim,
                        fontSize: 11,
                        height: 1.9,
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextButton(
                      onPressed: learnMore,
                      child: const Text(
                        'Understand the engineering ↗',
                        style: TextStyle(color: cyan, fontSize: 11),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 7,
                runSpacing: 7,
                children: categories
                    .map(
                      (c) => ChoiceChip(
                        label: Text(c, style: const TextStyle(fontSize: 10)),
                        selected: category == c,
                        onSelected: (_) => setState(() => category = c),
                        selectedColor: cyan.withValues(alpha: .2),
                        showCheckmark: false,
                        side: BorderSide(
                          color: category == c
                              ? cyan.withValues(alpha: .5)
                              : dim.withValues(alpha: .2),
                        ),
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 18),
              for (final part in widget.parts.where(
                (part) => part.category == category,
              ))
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: partCard(part),
                ),
              const SizedBox(height: 6),
              Plate(
                color: const Color(0xff1b2830),
                padding: const EdgeInsets.all(16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.info_outline, color: cyan, size: 17),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        lastChange,
                        style: const TextStyle(
                          color: cyan,
                          fontSize: 11,
                          height: 1.7,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Plate(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    label(
                      'READINESS REVIEW',
                      color: warnings.isEmpty ? cyan : orange,
                    ),
                    const SizedBox(height: 15),
                    if (warnings.isEmpty)
                      const Text(
                        'All systems meet the mission requirements. Flight control is ready when you are.',
                        style: TextStyle(color: dim, fontSize: 12, height: 1.8),
                      ),
                    for (final w in warnings)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(
                              Icons.warning_amber_rounded,
                              color: orange,
                              size: 16,
                            ),
                            const SizedBox(width: 9),
                            Expanded(
                              child: Text(
                                w,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: dim,
                                  height: 1.7,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: ActionButton(
                        'Proceed to launch',
                        onPressed: warnings.isEmpty && p.active == null
                            ? launch
                            : null,
                        icon: Icons.rocket_launch_outlined,
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: loadRecommended,
                      child: const Text(
                        'Load a recommended baseline',
                        style: TextStyle(color: cyan, fontSize: 11),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          flex: 5,
        ),
        const SizedBox(height: 20),
        label(
          'ILLUSTRATIVE COMPONENTS & FICTIONAL COSTS · NOT NASA HARDWARE SPECIFICATIONS',
          size: 8,
        ),
      ],
    );
  }

  Widget partCard(Part part) {
    final active = p.design.contains(part.id);
    return InkWell(
      onTap: () => selectPart(part),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: active ? const Color(0xff132d38) : panel,
          borderRadius: BorderRadius.circular(9),
          border: Border.all(
            color: active
                ? cyan.withValues(alpha: .65)
                : dim.withValues(alpha: .16),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    part.name,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Icon(
                  active ? Icons.check_circle : Icons.add_circle_outline,
                  size: 20,
                  color: active ? cyan : dim,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              part.description,
              style: const TextStyle(color: dim, fontSize: 11, height: 1.7),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 14,
              runSpacing: 8,
              children: [
                label('${part.mass.round()} KG', size: 8),
                label(
                  '\$${part.cost.toStringAsFixed(1)}M',
                  size: 8,
                  color: orange,
                ),
                if (part.draw > 0) label('−${part.draw.round()} W', size: 8),
                if (part.power > 0)
                  label('+${part.power.round()} W', size: 8, color: cyan),
                if (part.fuel > 0)
                  label('${part.fuel.round()} KG FUEL', size: 8),
                if (part.isp > 0) label('ISP ${part.isp.round()} S', size: 8),
                if (part.science > 0)
                  label('SCIENCE +${part.science}', size: 8),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  void learnMore() => showDialog(
    context: messenger.currentContext!,
    builder: (c) => AlertDialog(
      title: const Text('Engineering, in context'),
      content: const SingleChildScrollView(
        child: Text(
          'Delta-v is your ability to change velocity. We use the rocket equation: Δv = Isp × 9.80665 × ln(wet mass / dry mass). More payload lowers Δv; higher specific impulse uses propellant more efficiently.\n\nThrust-to-weight compares launcher thrust with vehicle weight. Below 1, a rocket cannot lift off. The launch model integrates thrust, propellant flow, gravity and drag at accelerated time.\n\nOrbit requires horizontal speed. The game checks 7.6 km/s plus a 100–450 km altitude corridor and bounded vertical velocity, then requires a circularisation burn. This is a training approximation, not a precision orbit solver.\n\nNet power = generation − consumption. Our 300 Wh battery covers temporary deficits. A damaged array and high instrument load can exhaust it.\n\nA communications link must reach the destination. The lunar missions need a directional deep-space dish.\n\nAll hardware values, budgets, events and programme rewards are illustrative game design values. The historical intermissions describe real events.',
          style: TextStyle(fontSize: 13, height: 1.8),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(c),
          child: const Text('Back to the vehicle'),
        ),
      ],
    ),
  );
  Widget flightView() {
    final f = flight!, landing = landingActive, o = ops;
    return LayoutBuilder(
      builder: (c, b) {
        final wide = b.maxWidth > 850;
        final telemetry = Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              label(
                landing ? 'LUNAR DESCENT' : 'LIVE / ASCENT TELEMETRY',
                color: cyan,
              ),
              const SizedBox(height: 17),
              Text(
                landing ? 'Powered descent.' : 'Ascent control.',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                  letterSpacing: -.8,
                ),
              ),
              const SizedBox(height: 20),
              Wrap(
                spacing: 25,
                runSpacing: 18,
                children: [
                  Metric(
                    'ALTITUDE',
                    landing
                        ? o!.altitude.toStringAsFixed(0)
                        : (f.altitude / 1000).toStringAsFixed(1),
                    unit: landing ? 'm' : 'km',
                  ),
                  Metric(
                    landing ? 'DESCENT RATE' : 'HORIZONTAL',
                    landing
                        ? o!.descentSpeed.toStringAsFixed(1)
                        : (f.horizontal / 1000).toStringAsFixed(2),
                    unit: landing ? 'm/s' : 'km/s',
                  ),
                  Metric(
                    landing ? 'LANDING FUEL' : 'LAUNCH FUEL',
                    landing
                        ? o!.landingFuel.toStringAsFixed(0)
                        : (f.fuelFraction * 100).toStringAsFixed(0),
                    unit: '%',
                    color: cyan,
                  ),
                  Metric(
                    landing ? 'TOUCHDOWN LIMIT' : 'MISSION CLOCK',
                    landing ? '5' : 'T+${f.time.toStringAsFixed(0)}',
                    unit: landing ? 'm/s' : 's',
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  Tag(game!.simPaused ? 'FLIGHT / HOLD' : 'FLIGHT / RUN'),
                  if (!landing)
                    Tag(
                      f.separated ? 'STAGE / SEPARATED' : 'STAGE / ATTACHED',
                      color: f.canSeparate ? orange : dim,
                    ),
                  Tag(
                    landing
                        ? 'GUIDANCE / MANUAL DESCENT'
                        : 'GUIDANCE / GRAVITY TURN',
                    color: dim,
                  ),
                ],
              ),
              if (!landing) ...[
                const SizedBox(height: 14),
                label(
                  'VERTICAL SPEED  ${f.vertical.toStringAsFixed(0)} M/S',
                  size: 9,
                ),
              ],
              const SizedBox(height: 15),
              const Divider(),
              const SizedBox(height: 10),
              Row(
                children: [
                  label(landing ? 'DESCENT THROTTLE' : 'MAIN THROTTLE'),
                  const Spacer(),
                  label(
                    '${((landing ? o!.landingThrottle : f.throttle) * 100).round()}%',
                    color: cyan,
                  ),
                ],
              ),
              Slider(
                value: landing ? o!.landingThrottle : f.throttle,
                min: 0,
                max: 1,
                key: const ValueKey('flight-throttle'),
                divisions: 100,
                onChanged: setThrottle,
                semanticFormatterCallback: (v) =>
                    'Throttle ${(v * 100).round()} percent',
              ),
              if (!landing) ...[
                Row(
                  children: [
                    label('PITCH BIAS'),
                    const Spacer(),
                    label('${f.guidance.round()}°', color: cyan),
                  ],
                ),
                Slider(
                  key: const ValueKey('flight-pitch'),
                  value: f.guidance,
                  min: -15,
                  max: 15,
                  divisions: 30,
                  semanticFormatterCallback: (v) =>
                      'Pitch bias ${v.round()} degrees',
                  onChanged: (v) => setState(() => f.guidance = v),
                ),
                Text(
                  '0° follows the gravity turn. Positive bias climbs higher; negative bias builds horizontal speed earlier.',
                  style: const TextStyle(color: dim, fontSize: 10, height: 1.6),
                ),
                const SizedBox(height: 12),
                ActionButton(
                  f.separated
                      ? 'Interstage separated'
                      : f.canSeparate
                      ? 'Separate interstage'
                      : 'Separation unlocks at T+80 s',
                  key: const ValueKey('flight-stage'),
                  onPressed: f.canSeparate ? separateStage : null,
                  secondary: true,
                  icon: Icons.layers_outlined,
                ),
              ],
              const SizedBox(height: 15),
              ActionButton(
                game!.simPaused
                    ? (f.started || landing
                          ? 'Resume flight'
                          : 'Ignition & liftoff')
                    : 'Pause flight',
                key: const ValueKey('flight-pause'),
                onPressed: toggleFlightPause,
                icon: game!.simPaused ? Icons.play_arrow : Icons.pause,
              ),
              const SizedBox(height: 10),
              Text(
                landing
                    ? 'Aim for 0–5 m/s at the surface. Lunar hover throttle ≈38%. Coast, then brake; your fuel is finite.'
                    : selected == 0
                    ? 'Target: cross 100 km. Full thrust is recommended. Simulation time runs at 5×.'
                    : 'Target: 100–450 km altitude, 7.6 km/s horizontal speed, and vertical speed below 2.5 km/s. Separate at T+80 s. Time runs at 5×.',
                style: const TextStyle(color: dim, fontSize: 11, height: 1.7),
              ),
              const SizedBox(height: 8),
              const Text(
                'Keyboard: Space launch/pause · Esc pause · W/S throttle · A/D pitch · G stage. Mouse and touch: use the same buttons and sliders.',
                style: TextStyle(color: dim, fontSize: 10, height: 1.7),
              ),
              TextButton(
                onPressed: () {
                  game!.simPaused = true;
                  go('home');
                },
                child: const Text(
                  'Save & return to console',
                  style: TextStyle(color: cyan, fontSize: 11),
                ),
              ),
            ],
          ),
        );
        final viewport = ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: Stack(
            children: [
              Positioned.fill(child: GameWidget(game: game!)),
              Positioned(
                top: 18,
                left: 18,
                child: Tag(
                  game!.simPaused ? 'SIMULATION PAUSED' : 'FLIGHT IN PROGRESS',
                  color: game!.simPaused ? orange : cyan,
                ),
              ),
              Positioned(
                bottom: 16,
                left: 18,
                child: label(
                  landing
                      ? 'MOON / TERMINAL APPROACH'
                      : 'PATHFINDER / ${mission.subtitle}',
                  size: 8,
                ),
              ),
            ],
          ),
        );
        if (wide) {
          return Padding(
            padding: const EdgeInsets.all(24),
            child: Row(
              children: [
                Expanded(flex: 6, child: viewport),
                const SizedBox(width: 24),
                Expanded(
                  flex: 4,
                  child: SingleChildScrollView(child: telemetry),
                ),
              ],
            ),
          );
        }
        return SingleChildScrollView(
          child: Column(
            children: [
              SizedBox(height: 320, child: viewport),
              telemetry,
            ],
          ),
        );
      },
    );
  }

  Widget operationsView() {
    final o = ops!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        PageHeading(
          'MISSION OPERATIONS / 0${selected + 1}',
          'Beyond the launch.',
          mission.name,
          trailing: Tag(o.phaseName.toUpperCase()),
        ),
        adaptive(
          Column(
            children: [
              SizedBox(
                height: 310,
                child: CustomPaint(
                  painter: SpaceArt(moon: selected >= 2),
                  child: const SizedBox.expand(),
                ),
              ),
              const SizedBox(height: 16),
              Plate(
                child: Wrap(
                  spacing: 25,
                  runSpacing: 20,
                  children: [
                    Metric(
                      'MANOEUVRE RESERVE',
                      o.deltaV.toStringAsFixed(0),
                      unit: 'm/s',
                      color: cyan,
                    ),
                    Metric(
                      'BATTERY',
                      o.battery.toStringAsFixed(0),
                      unit: '/ 300 Wh',
                      color: o.battery < 80 ? orange : white,
                    ),
                    Metric('SCIENCE', o.observations.toString(), unit: 'PTS'),
                    Metric(
                      'EARTH LINK',
                      o.link ? 'LOCKED' : 'LOST',
                      color: o.link ? cyan : orange,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Plate(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    label('FLIGHT TIMELINE'),
                    const SizedBox(height: 18),
                    for (var i = 0; i < 4; i++)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 17),
                        child: Row(
                          children: [
                            Icon(
                              i < o.phase
                                  ? Icons.check_circle
                                  : i == o.phase
                                  ? Icons.radio_button_checked
                                  : Icons.radio_button_off,
                              size: 17,
                              color: i <= o.phase ? cyan : dim,
                            ),
                            const SizedBox(width: 13),
                            Text(
                              [
                                'Trajectory check',
                                selected == 3
                                    ? 'Lunar descent'
                                    : 'Destination approach',
                                'Scientific observations',
                                'Downlink & mission close',
                              ][i],
                              style: TextStyle(
                                color: i == o.phase ? white : dim,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!o.eventResolved)
                Plate(
                  color: const Color(0xff25251f),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Tag('FLIGHT ADVISORY', color: orange),
                      const SizedBox(height: 20),
                      Text(
                        o.eventTitle,
                        style: const TextStyle(
                          fontSize: 23,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        o.eventText,
                        style: const TextStyle(
                          color: dim,
                          fontSize: 13,
                          height: 1.8,
                        ),
                      ),
                      const SizedBox(height: 22),
                      for (var i = 0; i < 3; i++)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: SizedBox(
                            width: double.infinity,
                            child: ActionButton(
                              o.eventOptions[i],
                              secondary: true,
                              onPressed: () {
                                o.resolve(i);
                                setState(() {});
                                save();
                                audio.play('warning');
                              },
                              icon: Icons.alt_route,
                            ),
                          ),
                        ),
                      const SizedBox(height: 8),
                      const Text(
                        'Each response trades energy, manoeuvre reserve, or science yield. Choose deliberately.',
                        style: TextStyle(fontSize: 10, color: dim, height: 1.7),
                      ),
                    ],
                  ),
                )
              else
                Plate(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      label('FLIGHT DIRECTOR / ACTION REQUIRED', color: cyan),
                      const SizedBox(height: 18),
                      Text(
                        [
                          'Commit to the trajectory.',
                          selected == 3
                              ? 'The surface is waiting.'
                              : 'You have arrived.',
                          'Make the most of the view.',
                          'Bring the knowledge home.',
                        ][o.phase],
                        style: const TextStyle(
                          fontSize: 25,
                          fontWeight: FontWeight.w500,
                          height: 1.3,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        [
                          'Execute a ${mission.deltaV.round()} m/s mission manoeuvre${selected == 3 ? ' split between transfer and descent' : ''}. A 150 m/s readiness reserve helps cover navigation errors.',
                          selected == 3
                              ? 'Use the descent engine to land below 5 m/s. There are no parachutes on the Moon: an atmosphere is needed for those.'
                              : 'Check pointing and power before opening the instrument window. The spacecraft spends 5 simulated minutes on approach.',
                          'Collect ${craft.science * 20} base science points, modified by your event response. Instruments operate for 12 simulated minutes.',
                          'Transmit the collected observations to Earth. Downlink uses 6 simulated minutes of electrical power.',
                        ][o.phase],
                        style: const TextStyle(
                          fontSize: 13,
                          color: dim,
                          height: 1.9,
                        ),
                      ),
                      const SizedBox(height: 22),
                      Tag(
                        o.safeMode
                            ? 'POWER SAVING ENABLED'
                            : 'NOMINAL INSTRUMENT LOAD',
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Array output: ${(craft.generation * o.arrayFactor).round()} W\nInstrument / systems load: ${(craft.consumption * (o.safeMode ? 0.6 : 1)).round()} W\nScience yield: ${(o.scienceFactor * 100).round()}%',
                        style: const TextStyle(
                          color: dim,
                          fontSize: 11,
                          height: 1.8,
                        ),
                      ),
                      const SizedBox(height: 24),
                      SizedBox(
                        width: double.infinity,
                        child: ActionButton(
                          [
                            'Execute manoeuvre',
                            selected == 3
                                ? 'Begin lunar descent'
                                : 'Confirm approach',
                            'Collect observations',
                            'Transmit & complete',
                          ][o.phase],
                          onPressed: advanceOps,
                          icon: o.phase == 3
                              ? Icons.satellite_alt
                              : Icons.arrow_forward,
                        ),
                      ),
                      const SizedBox(height: 10),
                      if (!o.safeMode)
                        TextButton(
                          onPressed: () {
                            setState(() {
                              o.safeMode = true;
                              o.scienceFactor *= .8;
                            });
                            save();
                          },
                          child: const Text(
                            'Enable power saving (−20% science)',
                            style: TextStyle(color: cyan, fontSize: 11),
                          ),
                        ),
                    ],
                  ),
                ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => go('home'),
                child: const Text(
                  'Save & return to console',
                  style: TextStyle(color: dim, fontSize: 12),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget result() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      PageHeading(
        resultSuccess ? 'MISSION ACCOMPLISHED' : 'MISSION DEBRIEF',
        resultSuccess ? 'Knowledge, brought home.' : 'Every flight teaches us.',
        mission.name,
        trailing: Tag(
          resultSuccess ? 'SUCCESS' : 'FLIGHT ENDED',
          color: resultSuccess ? cyan : orange,
        ),
      ),
      adaptive(
        SizedBox(
          height: 350,
          child: CustomPaint(
            painter: SpaceArt(moon: selected >= 2),
            child: const SizedBox.expand(),
          ),
        ),
        Plate(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                resultSuccess ? Icons.auto_awesome : Icons.analytics_outlined,
                size: 36,
                color: resultSuccess ? cyan : orange,
              ),
              const SizedBox(height: 20),
              Text(
                resultMessage,
                style: const TextStyle(fontSize: 17, height: 1.8),
              ),
              const SizedBox(height: 20),
              if (!sandbox)
                Text(
                  resultSuccess
                      ? 'Grant awarded: +\$${mission.reward.round()}M\nPublic trust +8 · Reputation +10\nMission unlocked in your flight programme.'
                      : 'The invested \$${craft.cost.toStringAsFixed(1)}M was spent.\nPublic trust −18 · Reputation −3\n${p.gameOver ? 'Programme closed: ${p.trust <= 0 ? 'public trust reached zero' : 'funding fell below the minimum \$5M launch cost'}. Start a new campaign or experiment in Free Play.' : 'Your programme can continue. Redesign and try again.'}',
                  style: const TextStyle(color: dim, fontSize: 12, height: 1.9),
                )
              else
                const Text(
                  'Free Play complete. Campaign resources and progress were preserved.',
                  style: TextStyle(color: dim),
                ),
              const SizedBox(height: 25),
              ActionButton(
                resultSuccess
                    ? 'Back to the programme'
                    : 'Return to vehicle lab',
                onPressed: () {
                  flight = null;
                  ops = null;
                  go(resultSuccess ? 'missions' : 'workshop');
                },
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () => go('achievements'),
                child: const Text(
                  'View milestones ↗',
                  style: TextStyle(color: cyan),
                ),
              ),
            ],
          ),
        ),
      ),
    ],
  );
}
