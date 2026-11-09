part of '../main.dart';

mixin PlanningScreens on MissionController {
  Engineering? comparison;
  Widget missionPlanning() {
    final e = craft;
    final margins = <(String, double, String)>[
      (
        'Budget remaining',
        (sandbox
                ? mission.budget
                : mission.budget < p.funding
                ? mission.budget
                : p.funding) -
            e.cost,
        'M',
      ),
      ('Payload margin', e.launcher.capacity - e.wetMass, 'kg'),
      ('Power surplus', e.netPower, 'W'),
      ('Manoeuvre reserve', e.deltaV - mission.deltaV - 150, 'm/s'),
    ];
    return Plate(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          label('MISSION DESIGN REVIEW', color: cyan),
          const SizedBox(height: 12),
          Text(
            mission.objective,
            style: const TextStyle(fontSize: 15, height: 1.6),
          ),
          const SizedBox(height: 12),
          Text(
            'Destination: ${mission.destination} • Science rating ≥${mission.science} • ${mission.range == 2 ? "Lunar communications" : "Earth-local communications"}\n${selected == 0 ? "Suborbital objective: cross 100 km; orbital velocity is not required." : "Ascent gate: 100–450 km, horizontal speed ≥7.6 km/s, vertical speed <2.5 km/s."}',
            style: const TextStyle(color: dim, fontSize: 12, height: 1.7),
          ),
          const SizedBox(height: 18),
          label('SELECT LAUNCH VEHICLE'),
          const SizedBox(height: 10),
          RadioGroup<String>(
            groupValue: e.launcher.id,
            onChanged: (id) {
              if (p.active == null && id != null) {
                setState(() => p.launcherId = id);
                save();
              }
            },
            child: Column(
              children: [
                for (final vehicle in LaunchVehicle.options)
                  RadioListTile<String>(
                    value: vehicle.id,
                    enabled: p.active == null,
                    title: Text(
                      '${vehicle.name} · \$${vehicle.price.round()}M · ${vehicle.capacity.round()} kg',
                      style: const TextStyle(fontSize: 12),
                    ),
                    subtitle: Text(
                      vehicle.description,
                      style: const TextStyle(color: dim, fontSize: 11),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 24,
            runSpacing: 18,
            children: [
              for (final margin in margins)
                SizedBox(
                  width: 165,
                  child: Metric(
                    margin.$1.toUpperCase(),
                    '${margin.$2 >= 0 ? "+" : ""}${margin.$2.toStringAsFixed(0)}',
                    unit: margin.$3,
                    color: margin.$2 < 0 ? orange : cyan,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          const Text(
            'Margins include the 150 m/s manoeuvre contingency. More science adds mass, power demand and cost. A larger launcher helps ascent but cannot replace spacecraft propellant or a lunar radio.',
            style: TextStyle(color: dim, fontSize: 12, height: 1.7),
          ),
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: () => setState(
              () => comparison = Engineering(
                List.of(e.parts),
                launcher: e.launcher,
              ),
            ),
            icon: const Icon(Icons.compare_arrows),
            label: Text(
              comparison == null
                  ? 'Pin design for comparison'
                  : 'Replace pinned comparison',
            ),
          ),
          if (comparison != null) ...[
            const SizedBox(height: 10),
            Text(
              'Change versus pinned design (this session):\nCost ${(e.cost - comparison!.cost).toStringAsFixed(1)} M · Mass ${(e.wetMass - comparison!.wetMass).round()} kg · Power ${(e.netPower - comparison!.netPower).round()} W · Δv ${(e.deltaV - comparison!.deltaV).round()} m/s · Science ${e.science - comparison!.science}',
              style: const TextStyle(color: cyan, fontSize: 12, height: 1.8),
            ),
          ],
          const SizedBox(height: 10),
          const Text(
            'Training models and fictional prices; launchers are not specifications of real vehicles. Negative margins block launch. Free Play waives financial limits only.',
            style: TextStyle(color: dim, fontSize: 10, height: 1.6),
          ),
        ],
      ),
    );
  }
}
