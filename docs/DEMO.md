# Demo script and recording provenance

`public/media/CORTEX-demo.mp4` records the working browser application and live local MuJoCo. CORTEX acoustic inputs in this film are **synthetic fixtures**, not live microphone inference. The voice-over is computer-generated narration, not audio that was sent through Gradium. The scene uses full 3D granite, animated water, reflections and scanned materials around an inferred Yerba Buena waterfall layout; it is a simulation, not footage of a physical robot or a completed neural reconstruction.

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

Photographic image and derivative scene-video attribution: Beyond My Ken, [2017 Yerba Buena Gardens](https://commons.wikimedia.org/wiki/File:2017_Yerba_Buena_Gardens_Martin_Luther_King,_Jr._Memorial.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). See `ASSETS.md` for robot and material sources.

## Combined emotion and memory

After capturing a memory, open Visual memory and select **I really need my backpack · DEMO**. Its synthetic anxious profile uses “Where is my backpack? I really need it.” CORTEX retrieves the actual saved event, plans against that evidence, and holds for confirmation with 2.0 m personal space. Choose **Yes, approach** to navigate. The main film retains the original short script; this additional flow is exercised by the browser acceptance test.
