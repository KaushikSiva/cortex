# Current acceptance record

Updated against the merged Gradium/Pipecat, Painted Ladies and MuJoCo build on 2026-09-19. Hume, AgentX, Isaac Sim and Yerba Buena are superseded by the user's later instructions. A passing fixture test is never treated as a live microphone or photorealism pass.

## Required demonstrations

| Requirement | Current result | Authoritative evidence and limits |
|---|---|---|
| Same words, different delivery → different physical policy | **DEMO and live generated-audio comparison pass; human delivery pending** | Actual Gradium returned “come here.” twice. Measured PCM intensity selected .55/.90 m/s limits and actual MuJoCo traveled 1.446/2.210 m over measured 3.06/3.04 simulated seconds. Generated audio at two amplitudes, not human emotion validation; see `live-motion-results.json`. |
| Photorealistic, full 3D Painted Ladies | **3D depth implemented; photorealism not passed** | Modeled roofs, side walls, bays, glass, park, cars, lighting and shadowing; 355 DataSF background footprints. Actual renders still look computer generated. No blind realism review has passed. [Scene status](SCENE_STATUS.md). |
| Voice STOP while moving | **Live Gradium with generated audio passes; human microphone trial pending** | [Live browser voice results](live-browser-voice-results.json): generated speech flows through the browser MediaStream/worklet, actual Pipecat/Gradium and actual isolated MuJoCo. STOP cancels current motion and returns to idle; a new explicit command can move without a separate resume. |
| Stored visual memory retrieval | **Local frame capture/retrieval passes; Memories.ai live round trip incomplete** | [Browser results](browser-results.json) checks a retrieved sighting's ID against the captured event. Object/location labels are operator annotations. Current Datalake collection creation reported insufficient account balance; [provider evidence](local-memory-results.json). |
| Navigate from retrieved memory | **Local evidence path passes** | Browser test retrieves a persisted scene frame, requests “Take me there,” and observes actual MuJoCo navigation to PLANTER. Cloud visual indexing is not established by this test. |
| Keyboard and voice share reusable motion tools | **Passes in simulation** | [Keyboard results](keyboard-results.json): all WASD directions, 180° backward turn, key release, blur, Space, turning and named target. [Live browser voice results](live-browser-voice-results.json): forward, stop, right turn and back. Both use `MotionTools` and `SafetyGovernor`. |
| Safety bounds and cancellation | **Passes in simulation tests** | Hard speed clamp, stale telemetry/commands, obstacle checks, watchdog, key lease, malformed tool rejection, and stop/reset/awaited-turn races. This is not hardware certification. |
| Optional provider failure | **Deterministic/local paths pass** | Directional commands and stop work without inference keys; absent or slow Jev uses labeled local rules. Memory and conversation failures are exposed. Not every provider outage combination has been exercised. |
| Reality / CORTEX modes and 60° view | **Implemented and browser-tested** | Fullscreen reveal, phone-height hero camera, orbit/parallax, visible telemetry and provider modes. Scene/telemetry regression verifies that a missing pose does not render a robot below ground. |

## Provider and runtime status

| Component | Verified scope | Outstanding scope |
|---|---|---|
| Gradium + Pipecat | Actual cloud STT and TTS; PCM worklet path; interim stop; request-correlated playback; generated Indian English input | Human microphone trial and calibrated expression understanding; intensity/pitch are local heuristics |
| General Compute | Actual authenticated conversation plus a structured inspect_scene tool call with live MuJoCo state; see `live-conversation-results.json` | Fresh end-to-end live model-planned movement is not proved by the latest deterministic motion tests |
| SambaNova | Structured adapter and shared tool schemas; mocked model tests | No SambaNova credential or live RDU inference verification in this checkout |
| Memories.ai | Current Datalake adapter and auth/collection checks; local evidence binding; indexing failure handling | Account credits and successful live upload → indexing → retrieval |
| Jev | Prior authenticated constrained decision; actual request exceeded the 180 ms deadline and correctly fell back | Reliable live decisions within the configured reflex deadline |
| EdgeOne | Modular execution adapter and local health check | Deployed/authenticated EdgeOne runtime and public URL |
| MuJoCo / G1 | Existing frozen Unitree policy; real dynamics, joints, contacts, turns, walking and stopping | Real hardware intentionally outside this simulation demo |
| Painted Ladies environment | Authored 3D geometry, approximate DataSF alignment, CC0 materials and lighting, attributed hidden scan | High-resolution licensed capture/reconstruction with broad view coverage and photorealism acceptance |

## Current checks

- **54 TypeScript tests** cover conversation history/tools/cancellation, explicit command parsing, spoken quantities, policy fixtures, safety, memory evidence binding and playback epochs.
- **8 MuJoCo physics tests** cover actual gait motion, turning, stop-to-idle behavior, geometry-based clearance, bounds, stale commands and renewable key leases.
- **4 Pipecat tests** use local Gradium-protocol doubles for acoustic measurements, speech events and TTS request correlation. They do not claim cloud service access.
- **Optimized production build and TypeScript check** passed after merging current `main`.
- **Full browser suite** passes: desktop/mobile layout, fixture policies, confirmation, actual local frame retrieval, memory navigation, Reality mode, Space stop and 3D inspection. See `browser-results.json`.
- **Keyboard browser suite** passes against actual isolated MuJoCo. See `keyboard-results.json`.
- **Multi-tab transfer regression** passes against actual isolated MuJoCo: explicit handoff, revoked-tab closure, reload and stop during transfer. Render animation is disabled for this control/transport test; see `control-transfer-results.json`.
- **Live browser voice test** passes using generated audio, live Gradium and actual isolated MuJoCo. No transcript fixture is used in this test. See `live-browser-voice-results.json`.
- **Playback browser test** verifies immediate cancellation, old-packet rejection and next-reply recovery using actual AudioContext scheduling with routed sockets. See `playback-browser-results.json`.
- **Telemetry display regression** covers absent → present → absent poses and a rejected second control tab. The robot uses measured qpos; no artificial height correction conceals an alignment error. See `scene-telemetry-results.json`.

## Presentation artifacts

The README, five-page pitch and narrated demo disclose simulation, synthetic acoustic profiles, operator-labeled memory and provider limits. The Indian English narrator is generated macOS Rishi speech; the configured live Gradium voice is Michelle. They are separate outputs.

The video is application footage, not proof of a live provider run. Validation details, exact streams, duration and file hash are in `indian-video-validation.json`; narration timing is in `public/media/CORTEX-demo-indian-narration.json`.

## Historical evidence

The live acoustic-policy comparison has been rerun against the current implementation. Older stop-latch language, test counts and screenshots describe earlier revisions; prefer current behavior and the dated records above.

Command acknowledgement and physical settling are distinct measurements. Settling is velocity below .08 m/s for three telemetry samples; it is not a physical-robot safety guarantee. No confidence score, human emotion judgment, public deployment, grasping, or indistinguishable-from-reality claim is supported by this record.
