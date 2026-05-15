## Render Instructions

### What this package contains
- `index.html` — standalone HyperFrames composition
- `DESIGN.md` — visual guardrails for the scene
- `scene-manifest.json` — timing and scene metadata
- `PROTOTYPE_NOTES.md` — prototype intent and validation notes

### Local validation completed
- `npx hyperframes lint`
- `npx hyperframes inspect --at 1.6,2.35,4.5`

### Render blocker
Local MP4 render is currently blocked because `FFmpeg` is not installed in this environment.

### To render locally once FFmpeg is available
```bash
cd "E:\\أجر لا ينقطع\\prototypes\\tasbeeh-interaction"
npx hyperframes render --quality draft --output renders\\tasbeeh-prototype.mp4
```

### Recommended review path before final render
```bash
cd "E:\\أجر لا ينقطع\\prototypes\\tasbeeh-interaction"
npx hyperframes preview
```

Then review:
- whether the tap feels modest
- whether the hold feels calm rather than empty
- whether the scene still works with no sound
- whether the UI feels devotional, not promotional

### Optional next-pass changes
- remove the helper text if the frame still feels too designed
- reduce the opening entrance durations by 10-15% if the first second feels too “introduced”
- add one very soft tap sound only if the silent version feels too sterile
