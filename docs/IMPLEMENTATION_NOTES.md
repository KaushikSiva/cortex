# CORTEX implementation notes — Gradium / Pipecat edition

The voice stack is Gradium + Pipecat, with SambaNova structured inference. AgentX is excluded. MuJoCo is the simulator; no locomotion training or Isaac dependency is required.

## Provider contracts checked against official sources

- [Gradium STT WebSocket](https://docs.gradium.ai/api-reference/endpoint/stt-websocket): `wss://api.gradium.ai/api/speech/asr`, `x-api-key`, PCM audio, setup/ready/text/end_text/step/flush events. This is speech recognition, not an emotion-scoring API.
- [Pipecat Gradium STT](https://docs.pipecat.ai/api-reference/server/services/stt/gradium) and [source](https://github.com/pipecat-ai/pipecat/blob/v1.11.0/src/pipecat/services/gradium/stt.py): official streaming service, final/interim transcription frames, VAD-triggered flush. Version 1.11.0 is pinned.
- [Pipecat Gradium TTS source](https://github.com/pipecat-ai/pipecat/blob/v1.11.0/src/pipecat/services/gradium/tts.py): voice ID, streaming PCM output at 48 kHz. The browser schedules returned audio chunks, with interruption cancellation. Gradium SDK 0.6.4 is pinned.
- [SambaNova function calling](https://docs.sambanova.ai/docs/en/features/function-calling): bearer key, `POST https://api.sambanova.ai/v1/chat/completions`, schema tools, `tool_calls`. Default tool-capable model is configurable. The TypeScript planner receives the transcript, acoustic policy and retrieved evidence; it emits validated tools, never motor torques.
- [Memories.ai official CLI](https://github.com/Memories-ai-labs/memories-cli): `POST /serve/api/v1/upload_img` multipart files, and `/serve/api/v1/search` with search_param / unique_id / top_k. Raw Authorization key, no Bearer. Upload/search result shapes and indexing readiness remain credential-unverified.
- [Jev / TypeSafe quickstart](https://docs.typesafe.ai/introduction/quickstart): constrained System One choices, 180 ms deadline and hard-rule fallback. External decisions cannot relax deterministic safety.
- [EdgeOne full-stack support](https://pages.edgeone.ai/resources/pages-support-full-stack-deployment): frontend/route hosting. The EdgeOne adapter targets our own constrained execution route; no vendor shell API is invented. Stateful MuJoCo and Pipecat stay local in this build.

## Voice pipeline and behavioral mapping

Browser AudioWorklet → mono PCM16 / 16 kHz → control WebSocket → loopback Pipecat sidecar → GradiumSTTService → CORTEX voice_turn event → reflex / mission planner → SafetyGovernor. GradiumTTSService returns speech for accepted responses. Raw Gradium socket events are retained in `.data/events.jsonl` via a transparent socket observer; credentials and input audio are not written there.

`voice/acoustics.py` measures voiced RMS/peak dBFS, pitch variation and internal pause fraction from real PCM. `src/emotion/voicePolicy.ts` preserves those measurements and derives bounded cues:

```text
intensity    = clamp((rmsDb + 38) / 22)
pitchMovement = clamp(pitchVariation / .55)
pauses       = clamp(pauseRatio / .55)
urgency      = .85 × intensity + .15 × pitchMovement
hesitation   = .85 × pauses + .15 × pitchMovement
calmness     = 1 − urgency
```

Hesitation is evaluated only with more than 250 ms of voiced input. Hesitation > .55 selects .45 m/s, .20 m/s final approach, 2.0 m personal space and confirmation. Otherwise urgency > .60 selects .90 / .50 m/s and 1.2 m space. Default is .55 / .35 m/s and 1.2 m space. All values are local design heuristics, not Gradium-returned emotions, calibrated probabilities, or reliable conclusions about a person's feelings. Noise, microphone distance and gain can alter the result. No speech means no fabricated acoustic measurements.

`fixtures/voice.json` contains synthetic acoustic examples, not recorded provider responses. Typed input has null acoustics and neutral defaults. LIVE voice disables fixture injection. The Pipecat integration test runs a local protocol double; it proves pipeline mechanics, not cloud inference accuracy or latency.

## Planning and memory

Stop words are checked before confirmation and before any model await. “Yes, wait, STOP” cancels a pending mission. Interim transcripts can trigger STOP. Raw text never maps to arbitrary motor commands.

Object search retrieves actual stored evidence first. A bounded second planning round receives that event; navigation must match its waypoint and cannot recursively search. Information-only questions return the sighting without movement. Requests to be taken there or “I really need it” plan navigation, subject to cautious confirmation.

Local camera captures are actual renderer PNGs with operator-supplied object/waypoint labels. Live memory needs provider-returned evidence IDs matching the local registry. Automated object detection, camera localization and cloud indexing readiness are not claimed.

## Physics and scene fidelity

The existing official Unitree G1 12-DoF LSTM gait runs with a NumPy export. MuJoCo steps at 500 Hz and policy targets update at 50 Hz. Browser interpolation follows real simulated joint and base state; it does not slide the robot root to animate walking.

The environment is now Painted Ladies / Alamo Square. The bundled CC BY 4.0 jtressle scan is real photogrammetry (source and hash in `public/assets/painted-ladies/SOURCE.json`), loaded with Three.js GLTFLoader. Photographic texture lighting is kept baked, and selected sky fragments are discarded. Park foreground, props and collision alignment are authored approximations. The scan is incomplete at its sides and rear and carries a 1024² atlas in the Objaverse distribution. Orbit inspection is limited to its frontal region; it is not a complete digital twin. MuJoCo colliders cover the park curb, bench, planter and street boundary.

No claim is made that the current render passes a blind real-vs-simulated test. Photorealism remains a visual acceptance target. No real robot, grasping, urban autonomy or cloud deployment was performed.

## Safety and measurement

Velocity ceiling .9 m/s; approach .5 m/s; personal space ≥1.2 m. Unknown waypoints, malformed numbers, stale commands (>2 s), stale telemetry (>750 ms), obstacles, falls, motion timeouts and heartbeat loss are handled independently of the planner. STOP latches; explicit reset/resume is required. Only one operator controls the loopback runtime; browser Origin checks reject unrelated sites.

Server `performance.now()` measures durations. Voice timing starts at receipt of the browser VAD marker, excluding microphone buffering and browser transit. A command acknowledgement is separate from base-speed settling (<.08 m/s for three telemetry samples). Synthetic fixtures leave speech latency unknown. No provider latency is invented from marketing claims.

## Shared motion update

`src/cognition/tools/motion.ts` owns relative `turn`, directional `walk`, and named `walkTo`. Turning waits for measured heading convergence before translation. Keyboard and Gradium transcripts use these same primitives. Named-target controls request a structured planner call; Jev (or explicit local rules) checks fresh telemetry before the SafetyGovernor accepts it. Manual driving requires a renewable 650 ms session lease. Release, blur and visibility loss issue hold without clearing emergency stop. Robot-side expiry stops manual motion even when the web runtime still sends heartbeats.

Rendering now uses the chennai-gta solar-separated HDR light, alpha-aware GTAO, SMAA, 4096 shadow maps and bent-leaf trees, plus scanned ground materials and geometric park details. The camera has a 60° field of view and a separate 60° orbit preset. These additions do not fix the partial façade scan's missing depth and sides: the user rejected the current view as insufficiently realistic. Replacing or reconstructing the building volume remains open.

This snapshot passes TypeScript typechecking, 19 TypeScript tests, and 7 MuJoCo tests including actual left/right/180° turns, expired key leases and person clearance. The updated end-to-end browser suite did not complete (timeout with an existing operator session); the new keyboard browser script has not yet passed. Historical media and browser evidence are not proof of this snapshot's acceptance.

## Full-depth scene revision

`src/scene/victorians.ts` replaces the rejected shallow façade presentation with authored solid building volumes, polygonal bays, recessed windows, roofs, side/rear walls, entry stairs, rails and architectural details. Geometry is batched by material. No façade photo planes are used in the default view. The previous scan is hidden reference, not an accepted reconstruction. See SCENE_STATUS.md for the remaining visual gap.

Fixed missing tree rendering caused by assigning a material array to geometry without draw groups. Fixed HDR sky fogging and updated the directional shadow camera's projection matrix. Browser render checks report no WebGL/page errors. Both the keyboard and complete UI browser suites now pass on an isolated production server and MuJoCo instance.

Motion acknowledgement timestamps now bracket each safety-governed primitive request. They exclude the wait for heading convergence, which is physical motion duration rather than network acknowledgement.

## Live speech verification

With the supplied credential stored only in ignored `.env.local`, the actual Gradium socket through Pipecat returned interim and final “come here.” for generated PCM16 audio. `docs/gradium-live-results.json` records events and local acoustic measurements. This proves credential/auth and real STT pipeline operation. It does not prove a real microphone trial, calibrated expression mapping, TTS or end-to-end cloud-planned robot motion.

## Provider contract checks and material refinement

The current TypeSafe quickstart contract returned live Jev CONTINUE in about 400 ms. Three calls through the actual 180 ms adapter deadline each fell back to explicitly labeled local rules. The current official Memories.ai CLI search endpoint returned HTTP 200 containing application error 0001 (missing route). The adapter now rejects application-level failures, and runtime marks memory OFFLINE rather than presenting a false empty result. Live memory remains unverified. Details: provider-live-results.json.

The architectural study now uses 2K CC0 siding/slate scans with metric UVs and physically based glass, plus modeled arched entries and porch posts. A multisampled render target improves architectural edge rendering. Browser rendering and TypeScript checks pass; this material study does not establish photorealism. The existing demo video represents the preceding architecture revision.

## DataSF background geometry refinement

Inspected the official Data.gov catalog and ArcGIS layer metadata. The city footprint dataset is PDDL 1.0; `gnd_Min_m` and `hgt_Median_m` are meters, and the source geometry predates the current demo. Queried a small Alamo Square bounding box, rejected truncated/error responses, and retained the exact query and derived-asset checksum. The default scene now uses local-coordinate footprint extrusions around the authored row and elevation-informed street grading. This is a geometry correction, not a new photorealism claim. Live navigation and collisions remain separate.

Asset research: Waymo’s Block-NeRF page shows Alamo Square but publishes a Mission Bay dataset; it is not a usable substitute for the requested location. The available jtressle scan remains incomplete. A higher-quality, licensed Painted Ladies capture has not been obtained.

## Live Indian English speech output

Inspected the current official [Get Voices endpoint](https://docs.gradium.ai/api-reference/endpoint/get-voices) and installed Gradium SDK 0.6.4. The authenticated catalog returned 387 voices, including Michelle (`lt88kyLfD8Mqemla`), described by the provider as Indian English. No voice was cloned or created.

An isolated instance of the actual Pipecat sidecar synthesized a fixed test sentence using that voice. It returned 46 PCM16 chunks at 48 kHz, totaling 3.68 seconds; first audio arrived 368.27 ms after the test speak request. These are measured single-run values, not service guarantees. Evidence: `gradium-tts-live-results.json`. This checks live synthesis and the sidecar transport; it does not establish human microphone input, emotion recognition, memory retrieval or planner correctness.

The selected public voice ID was added to ignored local configuration. The video narration remains the independently generated Rishi/macOS track.

## Playback cancellation and robot display recovery

Browser interruption epochs silence queued speech immediately and reject late audio from an older response. Each speak request has a separate ID preserved through Pipecat's actual TTS context ID; old provider audio cannot be relabeled as a fresh response. Stop, reset, microphone changes and speech start invalidate playback. Four local voice tests and 25 TypeScript tests pass; `scripts/test-playback.mjs` checks real browser AudioContext cancellation with synthetic audio and routed sockets. A live Gradium check also returned 45 correctly correlated PCM chunks; `gradium-correlated-tts-results.json` records the measured run.

A rejected second control tab now polls the status endpoint read-only rather than mislabeling a healthy controller as offline. The scene does not render an unpositioned URDF while telemetry is absent. The actual robot server was healthy on port 8002 during diagnosis; no physical root offset was applied to conceal the display bug. The measured visual lowest point was approximately -6 mm, aligned to the rendered paving. See scene-telemetry-results.json.
