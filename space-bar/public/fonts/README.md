# Bundled typefaces

The build bundles Latin WOFF/WOFF2 files from the pinned `@fontsource` packages.
There are no font requests to external services at runtime. The Latin subsets
include French accents.

- Barlow Condensed 600: display headings, SIL Open Font License 1.1.
- Public Sans 400 and 600: interface and body text, SIL Open Font License 1.1.
- IBM Plex Mono 400: telemetry and numeric readouts, SIL Open Font License 1.1.

The corresponding license texts are included in this directory and copied to
the production build. Font files and package versions are recorded in
`package-lock.json`.
