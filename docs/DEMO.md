# Demo script and recording provenance

`public/media/CORTEX-demo.mp4` records the working browser application and live local MuJoCo. CORTEX acoustic inputs in this film are **synthetic fixtures**, not live microphone inference. The voice-over is computer-generated narration, not audio that was sent through Gradium. The scene uses a real Painted Ladies photogrammetric mesh with an authored Alamo Square park foreground; it is a simulation, not footage of a physical robot or a complete digital twin.

The film opens in Reality Mode and then reveals CORTEX. It exercises calm / urgent policy differences, evidence capture and retrieval, navigation, stop, and slow resume. It preserves actual telemetry and measured latency. Any speech-to-Gradium latency remains unknown for fixture input. The unedited browser recording, chapter timestamps, narration script and VTT captions make the presentation reproducible.

## Exact live performance script (credentials required)

1. Reset. Press **R** for Reality Mode. Connect the microphone before starting.
2. Calmly: **“Come here.”** Let the G1 approach.
3. Reset. Urgently: **“COME HERE!”** Let the changed physical policy be visible.
4. Press **R**. Show **SAME WORDS. DIFFERENT VOICE. DIFFERENT PHYSICAL POLICY.**
5. Capture the backpack frame and let indexing complete. Ask **“Where did you last see my backpack?”**
6. Expected retrieved response: **“I saw it beside the planter.”**
7. **“Take me there.”**
8. While moving: **“WAIT! STOP!”**
9. Show observed reflex, acknowledgement, and settling times.
10. **“Continue, but slowly.”**

In DEMO mode, the calm, urgent, fearful and memory buttons exercise the same policy/runtime with explicit synthetic inputs. The recording script triggers those actual UI controls. It does not replace telemetry or inject fake provider responses labeled LIVE.

## Recreate the media

With both local services running and no other operator tab:

```sh
node scripts/test-browser.mjs      # verification and application screenshots
node scripts/render-pitch.mjs      # exactly five PDF pages and slide PNGs
node scripts/capture.mjs           # actual browser film and chapter timing
python3 scripts/narrate.py         # macOS say + ffmpeg: final MP4, captions and GIF
```

`capture.mjs` records one operator session; it cannot run alongside another browser test. The macOS narration script uses installed system speech. On another OS, supply narration audio or distribute the silent raw WebM with captions. Audio is illustrative narration, not an emotion-recognition test.

Painted Ladies scan: [jtressle](https://sketchfab.com/3d-models/san-francisco-painted-ladies-cf5aeb7fb0ac4152b43f72ce1dac60d6), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), distributed via AllenAI Objaverse. Runtime transform and selected captured-sky fragment filtering are modifications. See `ASSETS.md` for robot and material sources.
