# Space Bar flight physics

The historical-campaign flight simulation uses SI units throughout: metres, seconds, kilograms, newtons, pascals and radians. The fixed integration step is **0.02 s (50 Hz)**. Rendering may run at any frame rate; elapsed frame time is accumulated and consumed in fixed physics steps.

## Constants

| Constant | Value | Use | Source |
|---|---:|---|---|
| Standard gravity, `g0` | 9.80665 m/s² | Rocket equation and engine mass flow | [NIST standard acceleration of gravity](https://physics.nist.gov/cgi-bin/cuu/Value?gn) |
| Earth gravitational parameter, `μ` | 3.986004418 × 10¹⁴ m³/s² | Gravity and Earth orbits | [NASA/JPL Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html) |
| Earth mean radius | 6,371,000 m | Altitude and launch radius | [NASA/JPL Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html) |
| Earth rotation period | 86,164.1 s | Launch-site velocity and rotating atmosphere | [NASA/JPL Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html) |
| Air heat-capacity ratio, `γ` | 1.4 | Speed of sound | Standard dry-air approximation |
| Specific gas constant for air, `R` | 287.05 J/(kg·K) | Speed of sound | U.S. Standard Atmosphere convention |

Body constants for the Sun, Moon and planets are stored in `src/domain/sim/bodies.ts`. They are based on the [NASA/JPL Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/).

## Forces

### Gravity

Gravity varies with distance from the body centre:

`g = μ / r²`

The acceleration vector points toward the body centre. This replaces a constant surface-gravity approximation and allows coast and orbital flight.

### Thrust

Thrust is applied along the vehicle body axis:

`F⃗thrust = F (r̂ cos θ + êast sin θ)`

`θ = 0` points vertically away from Earth; `θ = 90°` points east. Attitude changes are rate-limited, and aerodynamic stability blends the commanded attitude toward the velocity direction while dynamic pressure is significant.

### Engine performance and fuel flow

Sea-level and vacuum thrust and specific impulse are interpolated using ambient pressure fraction `p / p0`.

`ṁ = F / (Isp g0)`

Propellant removed during one step is `ṁ Δt`. A stage cannot burn more propellant than remains. Separating a stage removes its dry mass and remaining propellant from the active vehicle.

### Aerodynamic drag

Velocity is measured relative to the rotating atmosphere:

`v⃗air = v⃗vehicle − (ω⃗ × r⃗)`

Drag magnitude is:

`D = ½ ρ |v⃗air|² Cd A`

where `A = π(d/2)²`. The drag vector points opposite `v⃗air`. `Cd` rises around Mach 1 and approaches a lower vacuum value as density tends to zero. Dynamic pressure is:

`q = ½ ρ |v⃗air|²`

The simulation records the greatest `q` as Max-Q and warns when it exceeds the vehicle structural limit.

Atmospheric density, pressure and temperature are log-interpolated from the [U.S. Standard Atmosphere 1976](https://ntrs.nasa.gov/citations/19770009539) table through 86 km. Above 86 km, density and pressure use a 7 km exponential scale-height fallback and become zero above 180 km.

## Numerical integration

Acceleration is the net force divided by current mass:

`a⃗ = (F⃗thrust + F⃗drag + F⃗gravity) / m`

The fixed-step integrator updates velocity and then position (semi-implicit Euler):

`v⃗(t + Δt) = v⃗(t) + a⃗ Δt`

`r⃗(t + Δt) = r⃗(t) + v⃗(t + Δt) Δt`

This method is stable for powered ascent. Orbital regression tests check conservation of specific energy and angular momentum during unpowered coast.

## Orbit calculation

Specific angular momentum and orbital energy are:

`h⃗ = r⃗ × v⃗`

`ε = |v⃗|² / 2 − μ / |r⃗|`

The eccentricity vector and semi-major axis are:

`e⃗ = (v⃗ × h⃗)/μ − r̂`

`a = −μ / (2ε)`

Apoapsis and periapsis altitude are `a(1 + e) − R` and `a(1 − e) − R`. For a closed orbit, period is:

`T = 2π √(a³/μ)`

The game calls an Earth orbit stable when periapsis is at least 160 km. A circular orbit near 200 km requires about 7.8 km/s horizontal speed. See [NASA Basics of Space Flight: Orbits](https://science.nasa.gov/learn/basics-of-space-flight/chapter5-1/).

## Educational energy estimates

The post-flight report samples display telemetry once per simulated second. Sampling does not alter the 50 Hz physics loop.

Energy dissipated by drag is accumulated as:

`Eloss,drag = Σ D |v⃗air| Δt`

Energy used to climb against gravity is estimated during positive radial motion as:

`Eloss,gravity = Σ m g max(0, vradial) Δt`

These values are instructional estimates: they separate two major ascent losses, but do not constitute a complete engine or thermodynamic energy audit.

## Vehicle data

Dimensions and engine data are stored in `src/data/rockets.ts` and `src/data/parts/index.ts`. Vehicle-specific references are listed in `src/data/sources.ts` and on the in-game Sources & Credits page. The repository currently has no challenge-provided `/data/sources/` directory, so official NASA and manufacturer sources are used directly.
