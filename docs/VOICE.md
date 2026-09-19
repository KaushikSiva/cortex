# Conversational voice for the street robot

The voice owner can work independently of navigation. Audio uses the existing browser PCM worklet → Pipecat/Gradium STT → TypeScript conversation → General Compute (or SambaNova) → Gradium TTS → browser path.

## Start

Set these in `.env.local` (never commit keys):

```dotenv
GRADIUM_API_KEY=...
GRADIUM_VOICE_ID=...
GENERAL_COMPUTE_API_KEY=...
GENERAL_COMPUTE_MODEL=gpt-oss-120b
```

Install with the README instructions, then `npm run local`. Connect the microphone in the app. Questions also work through the text box; typed replies are spoken when a configured microphone session is connected. `/api/capabilities` reports only configuration booleans. No camera understanding or street data is inferred from the rendered background.

Try:

1. “What can you do?”
2. “Explain that more briefly.”
3. While moving: “Where are you heading?”
4. Ask a longer question, then speak over the answer.
5. “Stop!” then “Continue slowly.”

General questions use General Compute when `GENERAL_COMPUTE_API_KEY` is set; `SAMBANOVA_API_KEY` remains an optional fallback. Both the conversation and mission planner share this provider selection. The UI reports the selected provider. A missing model key produces an explicit configuration answer; the existing labeled DEMO fixtures, direct stop, and bounded offline commands (“come here,” “take me there,” “return home,” “continue slowly”) still work. Live cloud credentials and an actual microphone trial are required to validate end-to-end latency and acoustics.

## Integrated street movement

The Painted Ladies scene update and its shared `turn`, `walk`, and `walk_to` tools are integrated. Conversation registers their actual schemas and descriptions and executes them through `MotionTools`, the shared reflex gate, and `SafetyGovernor`. Keyboard destination buttons use that executor directly, without requiring a model key. Offline typed direction commands remain available.

Questions preserve an active keyboard lease. Starting keyboard movement cancels any pending model response; a requested voice motion releases the held-key lease before taking control. A STOP during an awaited turn cannot be overwritten by the turn's eventual completion.

## Connect additional street tools

`CortexRuntime.conversation.register(name, tool)` adds a tool, or replaces a built-in of the same name. Register after constructing the runtime in `server.ts`. Tool arguments are validated with Zod before execution. Read-only questions can return text without any tool call. Tool results go back to the model before its final spoken answer.

Example (replace `street` with your navigation service):

```ts
import {z} from 'zod';

runtime.getNavigationContext = () => ({
  destination: street.destination,
  status: street.status,
  remainingSteps: street.remainingSteps,
  knownDestinations: street.knownDestinations,
});

runtime.conversation.register('navigate_to', {
  description: 'Start walking to a known street destination on user request. Acceptance is not arrival.',
  schema: z.object({destination: z.string().min(1).max(120)}).strict(),
  execute: async ({destination}, signal) => {
    signal.throwIfAborted();
    // Resolve against known destinations and enforce your movement safety checks.
    const result = await street.navigate(String(destination), {signal});
    return {accepted: true, arrived: false, destination, ...result};
  },
});
```

Use small JSON results: `accepted`, `status`, `destination`, or a concrete error. Refresh `getNavigationContext()` from observed state. Do not report arrival when a command has only been accepted. Actions execute serially, but navigation tools that return acceptance do not wait for arrival: multi-stop sequencing belongs in the teammate's mission executor, not a batch of model calls.

**Stop integration matters:** direct STOP intentionally bypasses the model and calls `CortexRuntime.stop()` → `SafetyGovernor.stop()` → the robot backend. If the street movement uses another backend, connect that same stop path to it. Replacing a model tool named `stop` alone will not wire immediate stop. Replace `resume_navigation` and `return_home` if the new backend changes their semantics. Custom tools must enforce safety themselves; the registry validates arguments, not physical movement.

The current built-in `navigate_to` uses the existing waypoint enum until replaced. `inspect_scene` means robot telemetry, not vision. Register read-only street lookup tools for directions or landmarks if available. `getNavigationContext` can supply the street name and observed surroundings, but must not expose hidden object locations as camera observations.

## Turn behavior

- Last 10 completed user/assistant exchanges are retained in memory; reset clears them.
- Questions preserve the navigation epoch, motion policy, and pending confirmation.
- STOP returns the robot to idle; no resume step or latched stop mode exists.
- Live speech pauses never trigger a confirmation hold.
- Speech start cancels a pending model answer and interrupts synthesized audio. It does not stop an already running journey. Explicit STOP stops motion.
- Superseded model output cannot dispatch new tools or replace the answer.
- Tool calls are schema-validated, limited to four rounds of up to eight calls, and results are fed back to the model. The model request loop has a 25-second deadline; custom executors must honor the abort signal.
- “Where is the bus stop?” and “Why did you stop?” do not trigger the deterministic stop matcher. Direct “Stop,” “Please stop,” and “Yes, wait! Stop!” do.
- The Conversation tab shows completed exchanges and a thinking indicator independently of robot motion.

## Validation

`npm test` includes mocked model tests for multi-turn context, tool results, malformed/unknown tools, interruption races, question/motion isolation, and immediate stop. `npm run typecheck` and `npm run build` check the app. `node scripts/test-voice-transport.mjs` exercises the real web runtime against local voice/robot test doubles, without provider credentials. The existing `voice/test_voice.py` exercises Pipecat against a local Gradium protocol double. Neither test substitutes for a live microphone/provider run.

Implementation references: [Pipecat Gradium TTS](https://reference-server.pipecat.ai/en/stable/api/pipecat.services.gradium.tts.html).

General Compute compatibility: [official API reference](https://www.generalcompute.com/api-reference). A live authenticated Q&A and read-only tool-result round trip were verified with `gpt-oss-120b`.

## Spatial grounding

Every conversation receives a known simulation map: bench and planter bounds, bench endpoints, walking edges, authored backpack position, and the separate navigation approach points. MuJoCo publishes collision-object coordinates in `sceneObjects`; the authored map is the fallback. `inspect_scene` refreshes robot pose and returns distances, heading-relative directions, and the robot's position relative to the bench front. Stale telemetry omits relative claims. World axes are not advertised as surveyed compass directions.

This is map knowledge, not a claim of camera recognition. Memories.ai is separately configured for uploaded camera evidence and historical retrieval. The existing capture flow labels a backpack sighting; it is not continuous scene perception or general object detection. Questions about mapped furniture do not require captured memories.

Live browser verification is recorded in `local-spatial-results.json`. The obsolete image-upload API has been replaced with the current [Video Datalake API](https://docs.memories.ai/datalake/quickstart). Capture converts the PNG into a two-second still-frame MP4 using `ffmpeg`, uploads it into a persistent collection, and polls indexing before saving searchable evidence. Search uses frame embeddings and maps returned video IDs back to local captures. The backpack location remains an authored annotation, not a detected object claim.

`npm install` installs a project-local FFmpeg binary. Optionally set `FFMPEG_PATH` or `MEMORIES_COLLECTION_ID`; otherwise the bundled executable is used and the collection ID is persisted in `.data/memories-collection.json`. Indexing may take up to three minutes. Provider errors are shown directly; failed or timed-out uploads are not advertised as searchable.

Live migration test: authentication and collection listing succeeded, but collection creation was rejected with “insufficient balance — top up your account to continue”. A live capture/retrieval round trip remains blocked on account credits. Spatial queries are independent and passed live testing.

## Latest merge validation

The conversational transport is integrated with per-response TTS IDs and browser interruption epochs. New speech, keyboard motion and typed commands cancel obsolete playback. Late audio cannot regain permission merely because a newer reply has started. The rejected-second-tab and ground-placement fixes remain in place.

`node scripts/test-keyboard.mjs` passed against isolated MuJoCo on all four WASD directions, including a full backward turn, release/blur cancellation, Space stop, turns and named-target navigation. The same new stop semantics apply to keyboard and voice: stop cancels the current motion; a new explicit command may run without a separate resume.

`CORTEX_TEST_URL=http://localhost:3001 node scripts/test-live-browser-voice.mjs` passed using generated Rishi speech injected into a browser MediaStream, the actual PCM worklet, live Gradium and Pipecat, and actual isolated MuJoCo physics. Its input files are local `.data/voice-commands/{forward,stop,right,back}.pcm`: mono PCM16 at 16 kHz. Generate phrases “Move forward two meters”, “Stop”, “Turn right ninety degrees”, and “Move back one meter” with the narration tooling and resample with FFmpeg. This is an opt-in provider test and must not target an operator's controller. Results are in `live-browser-voice-results.json`; no real human microphone trial is claimed.

The live test exposed “two meters” transcribed as “to meters.” Quantity normalization is limited to motion units inside complete explicit commands. Number words and this observed homophone now reach the same bounded executor, while the original transcript remains visible. Questions and negated instructions are rejected by the direct-motion parser.
