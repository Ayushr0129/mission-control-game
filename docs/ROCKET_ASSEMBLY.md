# Rocket assembly and campaign flight

## Start in the right builder

Choose a mission, read its historical briefing, and press **Design spacecraft**. This now opens the physical rocket assembly editor. **Rocket assembly** in navigation opens the next unlocked campaign mission. The old subsystem selector is preserved as **Subsystem planner** / **Subsystem design planner**. **Build & fly a rocket** on the overview remains an uncharged training sandbox.

In a campaign, press **Load mission baseline** for a mission-appropriate starting design. You may edit it completely or begin with **New empty assembly**. No construction money is spent while editing. **Launch assembled rocket** commits procurement cost plus a $1M pad fee once, before ignition. After that commitment there are no refunds, including aborts, impact, or return to assembly. Reload/continue does not buy another vehicle. A new flight is another procurement.

## Build

The catalogue has 19 typed modules grouped by purpose. Each entry shows its purpose, cost, dry mass, nominal dimensions, and applicable fuel/thrust/Isp/power/data/link specifications. Only propulsion modules produce thrust. Tanks show full propellant capacity separately from dry mass. Dimensions are schematic nominal grid dimensions, not manufacturing/CAD specifications.

- Mouse: drag catalogue parts directly onto the grid.
- Touch: hold a catalogue part, then drag it to the grid. Alternatively select a catalogue item and tap a cell.
- Tap installed parts to inspect, drag to move, or use move/rotate/duplicate/remove tools. Long tanks occupy two cells; rotated footprints and overlaps are checked.
- Undo/redo cover construction and stage edits for the current editor session (up to 100 actions). Ctrl/Cmd-Z and Ctrl/Cmd-Shift-Z work in the editor. Undo history is not retained across reloads.
- Use **Pan workspace** to move the work area; switch back with **Edit parts**. Pinch or use the zoom controls; **Fit assembly** resets the view.
- Cyan edge ports and structural connectors show attachments. Disconnected/overlapping parts and invalid drop previews are highlighted. Launch explains missing control, fuel, exhaust clearance, lift-off thrust, budget, science, link, recorder or energy requirements.

All structural edge joints attach. New fuel routing passes through tanks and engine plumbing, not arbitrary payload/electrical modules. Fuel does not cross a decoupler unless **Allow fuel crossfeed** is enabled on that decoupler. Engines consume only matching propellant. Engine exhaust requires one free adjacent cell in its mounting direction; exhaust heating farther downstream is not simulated.

Side boosters can attach through side decouplers. Reorder the decouplers with stage up/down controls. Staging removes that joint and components no longer connected to the command capsule. If another joint bypasses the decoupler, the bypassed component stays attached. Engines can be individually armed/shut down in flight. The global throttle applies to armed, exposed, supplied engines, respecting their minimum throttle. Set throttle to zero for cutoff/coast.

Dry/wet mass, maximum active thrust, mass flow, pad thrust-to-weight, per-stage fuel/delta-v, power, battery, data storage, science and communications are derived from the current parts. Stage delta-v estimates assume aligned thrust, vacuum and complete stage burns; gravity and drag reduce achieved velocity. Mixed-propellant mission manoeuvres consume each propellant according to engine mass flow.

## Fly and inspect the trajectory

- Space: ignite/pause/resume; Esc: pause.
- Hold A/D: turn continuously. Touch/mouse one-degree buttons also support holding. The attitude slider provides individual degree settings clockwise from fixed inertial north. Near the launch site, zero points upward.
- W/S or throttle slider: adjust thrust. G or **Separate stage**: execute the next stage. M: toggle trajectory map.
- The camera renders the retained assembly around its mass-weighted centre, including multi-cell parts. Pan the map by dragging, use map zoom and **Centre trajectory map**. Vehicle camera zoom is separate.
- The map shows the vehicle, a gravity-only coast prediction, AP/PE markers, and predicted Earth/Moon surface intersection. Negative periapsis intersects the body. A coast line excludes future thrust and atmospheric drag; it is not a powered-burn forecast. Burns change velocity, so the preview updates as the actual state evolves.
- Choose 1×, 2×, 5×, 10× or 25×. Fast-forward advances actual motion, burns, fuel and electricity; it does not steer or create an orbit. The optional tutor can fly the reference vehicle while time advances.
- Open **Auto-pause** to choose 100 km altitude, stable orbit (bound with periapsis above 100 km), next apoapsis/periapsis, or one/five additional simulated minutes. Choose a speed, then press **Run at 25×** (or the selected rate) beside the time controls. The main ignition/resume button also works. Targets also work if armed during a running flight. An apsis target requires a bound trajectory above 1 km; a powered burn can move or eliminate that apsis.
- Targets are checked at most every 0.1 simulated seconds, while the normal gravity/fuel integrator retains 0.025-second substeps. Timer targets stop exactly. Arrival pauses and returns to 1×. Impact, landing and campaign operation gates interrupt warp. Reload always restores paused at 1× without an armed target.

## Verified orbital example and tutorial

In training, press **Load orbital example** (or use the orbit campaign baseline). Its booster engine, three main-stage tanks, decoupler, vacuum engine, two transfer tanks, capsule, camera, array, radio and battery are all real editable modules.

1. Launch the assembly. Set full throttle and ignite.
2. Climb vertically initially, then gradually turn east. Watch vertical speed and apoapsis; aim to climb toward about 150 km while building horizontal velocity.
3. Separate when the booster is empty. The exposed vacuum engine burns upper-stage fuel only.
4. Near 150 km, burn nearly tangentially. Regulate vertical speed toward zero; local vertical rotates as the craft moves around Earth. Raise periapsis above 120 km while keeping apoapsis below 450 km.
5. Cut throttle and inspect the orbit in map view. A coast should keep periapsis above the atmosphere reference.

For an exact reproducible demonstration, enable **Orbital flight tutor**, then ignite at 10×. This optional feedback pilot uses current altitude, vertical speed, gravity, available thrust and orbital elements to command attitude/throttle/staging. It never writes position, velocity or fuel. Manual steering/throttle disables it. The reference model run reaches roughly 149 × 158 km in about 359 simulated seconds, with propellant remaining, and is checked for another 600 seconds of coast. Frame timing may cause small differences.

## Mission operations use the launched vehicle

Earth flight must actually cross 100 km (first mission), or reach a bound orbit with periapsis at least 100 km and apoapsis at most 450 km (later missions). At that gate, the campaign enters its original story/event and operations sequence using the retained payload, radio, battery, generator and active-stage manoeuvre reserve. You can expose another stage or change engine arming in operations before committing a burn.

Event manoeuvres and planned manoeuvres deduct actual propellant using the rocket equation. Power effects use actual generator/load and battery capacity. Scientific observations generate 60 seconds of instrument data and require recorder capacity. Downlink requires the appropriate retained radio; its throughput determines additional transmit energy/time. Scientific quality is affected by the story decisions. Rewards and unlocks apply once, after successful downlink; losses retain the actual launch expenditure. Debriefs store expenditure, results, science returned, generated/transmitted data, fuel, battery and altitude.

Power planning permits battery-supported deficits when stored energy covers the conservative planned interval (40 minutes Earth / 120 minutes lunar, plus 25% reserve). The operational preparation windows retain the existing campaign's minute-based power costs, separate from the 60-second observation. Mission scene transitions are not a continuous multi-body Moon intercept simulation: transfer/encounter manoeuvres use explicit delta-v budgets. Lunar terminal descent then uses Moon gravity and the actual remaining craft/engines/fuel; point-mass touchdown must be at 0–5 m/s. Legs are required for that objective.

## Saves and limits

Campaign launch charge and active snapshot are stored together in the programme save. Settled launch IDs make rewards idempotent. Campaign editor designs and uncharged training flights use separate slots. Restored flights pause. Legacy subsystem campaigns and music preferences remain supported. Old physical-flight saves without part IDs keep the original structural fuel routing; this is labelled in the editor. Loading a new baseline uses explicit routing. Site-storage failures remain session-only and are clearly labelled.

The game uses fictional hardware/prices and a 2D rigid point-mass model with idealised RCS, spherical nonrotating bodies, inverse-square gravity, simple drag and aggregate electrical storage. There is no structural flex/torque solver, terrain collision geometry, exhaust damage/heating, atmospheric lift, debris tracking, docking, or multi-body encounter solver. Cells/attachments and projected aerodynamic area are schematic approximations. This is an educational simulator, not a real vehicle design or flight-certification tool. Browser verification is in cloud Chromium/WebKit and iPhone emulation; physical Safari hardware testing is not claimed.
