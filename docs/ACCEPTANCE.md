# Acceptance record

This record separates exercised implementation from credential-dependent and capture-dependent acceptance. A passing fixture test is not described as a live Gradium pass.

| User test | Result | Evidence |
|---|---|---|
| A: real same words, different vocal expression | **Human microphone trial pending; real Gradium with generated audio passed** | Identical real Gradium transcripts at two generated-audio amplitudes selected different policies and MuJoCo displacement; see live-motion-results.json. Human delivery and emotion interpretation remain unverified. |
| B: robot looks like real footage | **Not passed** | Authored full-depth Painted Ladies plus DataSF neighborhood geometry. The previous partial scan is hidden. Current buildings still look rendered; a blind photorealism review has not passed. |
| C: voice STOP | **Fixture and real Gradium/generated-audio stop passed; human microphone pending** | Runtime integration test observes stop latch and records reflex, acknowledgement and physical settling durations. No speech latency is fabricated. |
| D: real stored memory retrieval | **Local capture/retrieval passed; Memories.ai live pending** | Browser test captures a real frame, retrieves that exact event ID, and checks the response. Labels are operator supplied. |
| E: navigate from memory | **Local evidence path passed** | Retrieved PLANTER waypoint causes real MuJoCo movement. |
| F: safety clamps and rejects malformed actions | **Passed in simulation tests** | Speed clamp, invalid numbers, unknown waypoint, confirmation gate, stale command, stale telemetry, obstacle hold, stop race, and independent watchdog. |
| G: optional providers unavailable | **Core fixture path passed** | All optional keys absent; hard-rule reflex and visibly labeled local/DEMO planning and memory work. Live Gradium with explicitly local planning is verified; remote-provider failure coverage remains limited. |

## Executed checks

- 16 TypeScript tests: same-words policy behavior, acoustic measurement validation, direct STOP, velocity clamping, confirmation, stop latch, stale telemetry/commands, obstacles, stop/navigation race, stop/reset race, tool validation, memory reference constraints, resume preserves the interrupted destination, fearful input stops before confirmation, STOP preempts spoken confirmation, evidence-bound follow-up planning, anxious memory confirmation/navigation, and measured-timing null semantics (some assertions share one test).
- 4 Python physics tests: frozen gait walking and stopping, independent watchdog, malformed commands, speed clamp, and calm/urgent physical distance difference.
- Waypoint rollouts: PERSON, PLANTER, BENCH and DOOR reach their stopping radii while upright; return HOME from PERSON also completes. BACKPACK aliases PLANTER. Actual poses in `waypoint-results.json`.
- WebSocket integration: calm/urgent movement, fast stop, fearful confirmation, deliberate slow resume. Exact observed durations in `integration-results.json`.
- Playwright/Chrome: desktop UI, stored-frame identity, memory navigation, Reality reveal, keyboard stop, confirmation cancellation, and mobile horizontal overflow. `browser-results.json`.
- TypeScript typecheck and optimized Next production build.

## Numeric evidence and limits

The deterministic physics test steps 4.0 simulated seconds per policy from the same reset:

| Input policy | Distance traveled | Result |
|---|---:|---|
| Calm, .55 m/s ceiling | 1.881247 m | Upright |
| Urgent, .90 m/s ceiling | 2.979501 m | Upright |

The wall-clock integration test has different distances because startup, acceleration, Python pacing and process scheduling affect elapsed simulated time. Compare only runs sharing the same timing basis. The video shows actual telemetry at recording time.

The robot reports a stop acknowledgement when it accepts a zero-motion goal. Physical settling is defined separately as base velocity below .08 m/s for three consecutive ~10 Hz telemetry samples. It can take substantially longer than acknowledgement. Neither duration is a hardware safety guarantee.

Earlier fixture runs did not measure provider latency. Later authenticated Gradium and Jev measurements are recorded in the linked live evidence files. No simulation screenshot has passed an independent photorealism review. No real robot, model training, grasping or public cloud deployment was performed.

The combined emotion + memory path is tested with the exact fixture transcript “Where is my backpack? I really need it.” Retrieval supplies a fresh evidence event to a bounded planning round. Its navigation target must match that event; distress still requires confirmation. Provider inference for this path remains unverified without credentials.

## Gradium / Pipecat migration

Three Python voice tests validate measured PCM energy, no invented state for silence, and the actual Pipecat pipeline against a local Gradium-protocol test double (interim/final text, flush, raw event retention). Four physics tests include park-curb clearance from the actual collision model. Browser inspection checks camera position changes when orbiting the Painted Ladies photogrammetric scene. These are local tests, not live cloud-provider or photorealism acceptance claims.

## Current shared-motion snapshot

19 TypeScript tests and 7 MuJoCo physics tests passed. Real simulated turns converge within 0.16 radians with under 0.3 m displacement. Lease expiry is checked independently of telemetry health. Typecheck passed. Latest browser run timed out; keyboard browser verification and production build for these changes remain pending. Historical results above describe earlier revisions. The current scene was rejected by the user as insufficiently realistic.

## Latest verification

The isolated production build passed. Both browser suites passed: full UI/memory/confirmation/stop flow and shared keyboard/voice-planner controls (see browser-results.json and keyboard-results.json). Real Gradium through the actual Pipecat sidecar recognized generated audio as “come here.” with interim and final events; measured acoustic fields were preserved (gradium-live-results.json). This is a cloud speech integration pass, not a microphone or emotional-perception validation. The default scene now uses full-depth authored architecture; photorealism remains unpassed.

## Live Gradium to physical policy

`docs/live-motion-results.json` records a successful cloud-to-simulation test: generated “Come here” audio at two amplitudes produced identical real Gradium transcripts. Moderate intensity selected 0.55 m/s and traveled 1.429 m in 3 simulated seconds; high intensity selected 0.90 m/s and traveled 2.222 m. Both runs remained upright. An interim real “wait,” transcript latched the independent stop path, with actual measured timing. The planner/reflex in this isolated test were explicitly deterministic, not live SambaNova/Jev. This is not a human microphone, emotion-recognition, or photorealism pass.

Final check for this revision: 20 TypeScript tests and 7 MuJoCo physics tests passed; typecheck and optimized production build passed; refreshed browser/keyboard suites passed. The 109.72-second demo MP4 has 1920×1080 video and an audio track; capture reported zero browser errors.

## Current speech output and presentation

Live Gradium TTS through Pipecat returned valid 48 kHz PCM using the Michelle Indian English catalog voice. `gradium-tts-live-results.json` records audio duration, chunk count, first-audio latency and scope limitations.

The Indian English narrated demo is 109.72 seconds at 1920 × 1080, with 12 captions and verified browser playback/full decode (`indian-video-validation.json`). It uses existing synthetic-profile footage, not a human-microphone recording. Latest neighborhood refinement passed production build and read-only browser rendering checks (`scene-neighborhood-validation.json`); photorealism remains unpassed.
