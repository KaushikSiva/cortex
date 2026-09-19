# Indian English demo video

[Watch in the local player](http://localhost:3000/demo.html) or open [the MP4](../public/media/CORTEX-demo-indian.mp4). The original narration remains in `public/media/CORTEX-demo.mp4`.

The Indian English edition is 1 minute 53 seconds, 1920 × 1080 H.264 with 48 kHz AAC narration and 12 synchronized WebVTT captions. Voice: **Rishi**, macOS system speech, `en-IN`. This is generated narration, not a human recording.

The footage is a fresh browser recording of the working MuJoCo demo: keyboard control, calm/urgent profiles, confirmation, captured visual memory, navigation, interruption and slow resume. It uses synthetic acoustic fixtures and local planning. It does not claim a live SambaNova session, human-microphone validation, a physical robot, or a finished photorealistic reconstruction. The footage includes the refined neighborhood, façade materials, vegetation and shadows.

## Regenerate on macOS

Requires the Rishi voice (`say -v '?'`), Python 3 and FFmpeg. No cloud speech credentials or paid calls are required.

```sh
python3 scripts/narrate.py --voice Rishi --rate 170 \
  --chapters chapters-indian.json --output CORTEX-demo-indian --skip-gif
```

Narration text and actual chapter start times are in `public/media/chapters-indian.json`. The script retains the raw browser video, trims its loading lead, fits speech within chapter boundaries, normalizes narration loudness, and emits MP4, VTT and per-chapter timing evidence.

## Verification

[Validation evidence](indian-video-validation.json) records the final file hash, streams, duration, successful browser playback, 12 caption cues, full error-free FFmpeg decode and measured audio levels. Narration has no chapter overlaps; the largest tempo adjustment is about 15%. Final encoded audio measures −16.35 LUFS integrated and −1.36 dBTP true peak.
