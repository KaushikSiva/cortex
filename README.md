<div align="center">

# CORTEX

### A voice interface for the physical world.

**Same words. Different voice. Different physical response.**

[The demo](public/media/CORTEX-demo.mp4) · [Five-slide pitch](public/media/CORTEX-pitch.pdf) · [How it works](#the-system) · [Run locally](#run-cortex) · [Evidence](docs/ACCEPTANCE.md)

![CORTEX — Unitree G1 at the Yerba Buena waterfall](public/media/reality.png)

**Gradium** voice · **Pipecat** orchestration · **SambaNova** inference · **MuJoCo** physics

</div>

Most voice-controlled robots understand words. CORTEX also turns measured vocal delivery into a physical behavior policy—then routes every action through an independent safety governor.

Say **“Come here.”** quietly. The G1 approaches at a measured pace. Reset, say the same words more emphatically, and its walking policy changes. Ask about a previously seen backpack, retrieve its actual camera evidence, and walk to that place. Say **“WAIT! STOP!”** and the reflex path interrupts without waiting for a language model.

This repository contains the app, simulator, voice service, tests, five-page pitch, and recorded demonstration. No locomotion training is required.

> **Honest build status:** MuJoCo runs real dynamics and an existing Unitree gait. DEMO inputs are explicitly synthetic acoustic fixtures. Gradium supplies STT/TTS; it does **not** supply the local acoustic heuristics or emotion labels. Provider calls require credentials. The waterfall is a full 3D, reference-informed scene with scanned materials—not a surveyed reconstruction or a claimed photorealism-test pass.

![Actual application recording](public/media/demo.gif)

## The moment

| Same transcript | Physical policy | What you see |
|---|---|---|
| “Come here.” · moderate intensity | 0.55 m/s ceiling · 1.2 m space | Measured walk and approach |
| “Come here.” · high intensity | 0.90 m/s ceiling · 1.2 m space | Faster walking and shorter acknowledgement |
| Paused / hesitant delivery | 0.45 m/s ceiling · 2.0 m space · confirmation | Robot holds, then approaches cautiously |
| “WAIT! STOP!” | Latched stop | Motion command cancels before any planner call |

These are bounded design heuristics, not claims about a person's internal emotional state. Device gain and background noise affect acoustic measurements; live acceptance requires calibration and real microphone trials.

## The system

![CORTEX architecture](public/media/architecture.svg)

```text
Microphone PCM → Pipecat → Gradium streaming STT
                        + local measured acoustic cues
                              │
                 ┌────────────┴──────────────┐
                 │                          │
          hard-rule reflex            SambaNova tools
          optional Jev                ↕ visual memory
                 │                          │
                 └────────────┬──────────────┘
                        BehaviorPolicy
                              ↓
                        SafetyGovernor
                              ↓
                      MuJoCo / Unitree G1
                              ↓
                  safe response → Gradium TTS
```

**Inference · SambaNova.** Agent inference runs on SambaNova RDU dataflow infrastructure, designed for interactive responses. CORTEX measures observed request and action timings; it does not substitute advertised provider latency for local measurements.

**Voice · Gradium.** Streaming transcription and synthesized replies use the official Pipecat Gradium services. Credentials stay server-side. Interim STOP transcripts reach the reflex path immediately.

**Orchestration · Pipecat.** A Python pipeline handles PCM audio, transcription frames, turn boundaries, interruption, and speech output. Structured robot planning stays in the TypeScript control runtime, across a deliberate safety boundary.

**Memory · Memories.ai.** Captured camera evidence is indexed locally in DEMO or uploaded in REAL mode. A provider evidence ID must match a recorded waypoint before a retrieved sighting can authorize navigation. No invented confidence scores.

**Execution · local / EdgeOne.** Health checks and constrained software operations have adapters. No model can request an arbitrary shell command. Cloud deployment is optional and not claimed complete.

## A real 3D place

The demo is situated beside **Revelation, the Martin Luther King Jr. Memorial waterfall at Yerba Buena Gardens, San Francisco**.

The scene contains modeled granite piers and galleries, animated falling water, a reflecting basin, scanned stone paving, a planter, a bench, and a backpack. Water reflections, lighting, shadows, occlusion, and camera parallax are rendered in 3D. The robot's position and joints come from MuJoCo physics.

Use **Inspect 3D scene** in the viewport to orbit and check the geometry. Reality Mode restores a fixed phone-height hero camera. An image-based reference study is included for art direction; it is not used as the scene's screen-filling background.

Physics uses separately defined collision geometry. The water edge is a physical barrier. A real capture-to-reconstruction workflow remains documented in [SCENE_CAPTURE.md](docs/SCENE_CAPTURE.md); no overlapping capture dataset is bundled.

## Run CORTEX

Requires Node.js 22+, Python 3.12, and a browser with WebGL2. Chrome is used for the supplied browser tests. No GPU training environment is needed for the frozen gait.

```sh
git clone https://github.com/KaushikSiva/cortex.git
cd cortex
npm ci
uv venv .venv --python 3.12
uv pip install --python .venv/bin/python -r robot/requirements.txt -r voice/requirements.txt
cp .env.example .env.local
npm run local
```

Open **http://localhost:3000**. The launcher starts MuJoCo on `8002`, Pipecat on `8003`, and the web/control runtime on `3000`. All services bind to loopback.

Without credentials, choose the labeled DEMO controls. To enable live voice, configure:

```dotenv
GRADIUM_API_KEY=
GRADIUM_VOICE_ID=
SAMBANOVA_API_KEY=
MEMORIES_API_KEY=
```

`GRADIUM_VOICE_ID` enables automatic synthesized replies after safe voice-command handling, plus replay with the speaker button. `GRADIUM_API_KEY` enables transcription. The SambaNova and Memories.ai keys enable their corresponding live adapters. Restart all services after changing configuration. Never commit `.env.local` or paste keys into chat.

Additional variables, including Jev and EdgeOne, are in [.env.example](.env.example). AgentX is not part of this build.

## The demo script

1. Open Reality Mode. Say calmly: **“Come here.”**
2. Reset. Say more urgently: **“COME HERE!”**
3. Reveal CORTEX Mode. Compare measured acoustic cues, policy, speed and trace.
4. Capture scene memory. Ask: **“Where did you last see my backpack?”**
5. Say: **“Take me there.”**
6. While moving: **“WAIT! STOP!”** Inspect actual command and settling latency.
7. Say: **“Continue, but slowly.”**

Without live keys, use the corresponding DEMO controls. The included video uses synthetic acoustic fixtures, actual MuJoCo dynamics, and generated narration. [Full provenance](docs/DEMO.md).

**Combined demo:** capture a memory, then choose **I really need my backpack · DEMO**. Retrieval feeds actual evidence to a bounded planning step. Hesitation requests confirmation before the robot heads to the retrieved waypoint.

## Safety is a separate system

- STOP preempts planning and confirmation, including “Yes—wait, stop.”
- Velocity, approach speed, and personal space have hard bounds.
- Stale commands, stale telemetry, obstacles, falls, and heartbeat loss prevent movement.
- Motion has a deadline and STOP stays latched until explicit reset or resume.
- Tool arguments are schema-validated; evidence constrains memory navigation.
- Acknowledgement and physical settling are measured separately.

This is a simulation prototype, not a certified controller for physical hardware.

## Test and record

```sh
npm test
npm run build
.venv/bin/python robot/test_robot.py
.venv/bin/python voice/test_voice.py
# With the three local services running, one operator at a time:
node scripts/test-integration.mjs
node scripts/test-browser.mjs
node scripts/capture.mjs
python3 scripts/narrate.py
node scripts/render-pitch.mjs
```

The Pipecat protocol test uses a local Gradium test double. It validates the actual pipeline mechanics without claiming to exercise the cloud service. The recording scripts use Chrome and ffmpeg; narration uses macOS system speech.

## Repository map

```text
src/app/                   Next.js control room and Reality Mode
src/emotion/voicePolicy.ts  Documented acoustic-to-behavior mapping
src/cognition/             Planning, memory, reflex and mission lifecycle
src/integrations/          Gradium bridge, SambaNova, Memories.ai, Jev, EdgeOne
src/robot/                 Backend adapter and safety governor
src/scene/                 Full 3D waterfall and optional reconstruction loader
voice/                     Pipecat service and measured PCM acoustics
robot/                     MuJoCo server and existing G1 gait inference
public/media/              Pitch deck, demonstration, GIF and screenshots
```

[Implementation notes](docs/IMPLEMENTATION_NOTES.md) · [Acceptance record](docs/ACCEPTANCE.md) · [Asset credits](docs/ASSETS.md) · [Deployment](docs/DEPLOYMENT.md)

CORTEX explores a simple question: **what changes when a robot can respond to the way a person speaks?**
