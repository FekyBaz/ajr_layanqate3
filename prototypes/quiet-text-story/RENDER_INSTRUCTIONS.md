## Render Instructions

### Files
- `index.html` — main HyperFrames composition
- `DESIGN.md` — visual guardrails
- `SCRIPT.md` — text script
- `scene-manifest.json` — exact beat map
- `PROTOTYPE_NOTES.md` — intent and review criteria

### Validation completed
- `npx hyperframes lint`
- `npx hyperframes inspect --at 2.2,7.4,12.6,15.5`

### Preview locally
```bash
cd prototypes/quiet-text-story
npx hyperframes preview --port 3018
```

### Render locally once FFmpeg is installed
```bash
cd prototypes/quiet-text-story
npx hyperframes render --quality draft --output renders\\quiet-text-story.mp4
```

### Current blocker
Local MP4 render remains blocked in this environment because `FFmpeg` is not installed.
