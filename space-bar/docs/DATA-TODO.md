# Data verification queue

Stage A does not convert uncertain figures into facts. The strict truth layer marks these fields `placeholder` until a primary document is archived and its exact table, page, or section is recorded.

- Mercury-Atlas payload capacity and Mercury spacecraft flight mass: supply the applicable NASA Mercury launch-vehicle/spacecraft technical report.
- Apollo 11 translunar spacecraft mass: supply a NASA mission report value consistent with the selected simulation boundary.
- Hubble launch mass: archive the NASA Hubble technical fact sheet or STS-31 payload manifest.
- Sputnik 1 and R-7: archive a primary Soviet/Roscosmos source or NASA historical technical record for date, payload mass, launcher, and orbital capability.
- Starship: retain `test-flight`; do not publish operational payload or human-rating values until a demonstrated-flight or regulatory primary source supports them.
- Legacy files in `src/data/rockets.ts`, `src/data/parts/`, and `src/data/missions/` predate the truth schema. They remain gameplay inputs during Stage A and are not truth-authoritative. Migration must happen in a later approved stage so Stage A does not change gameplay.

Approximate values are visibly distinct from verified values in the truth records. UI badges and the Sources page belong to a later stage.
