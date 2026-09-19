# Conversational voice for the street robot

The voice owner can work independently of navigation. Audio uses the existing browser PCM worklet → Pipecat/Gradium STT → TypeScript conversation → SambaNova → Gradium TTS → browser path.

## Start

Set these in `.env.local` (never commit keys):

```dotenv
GRADIUM_API_KEY=...
GRADIUM_VOICE_ID=...
SAMBANOVA_API_KEY=...
```

Install with the README instructions, then `npm run local`. Connect the microphone in the app. Questions also work through the text box; typed replies are spoken when a configured microphone session is connected. `/api/capabilities` reports only configuration booleans. No camera understanding or street data is inferred from the rendered background.

Try:

1. “What can you do?”
2. “Explain that more briefly.”
3. While moving: “Where are you heading?”
4. Ask a longer question, then speak over the answer.
5. “Stop!” then “Continue slowly.”

General questions need SambaNova. A missing model key produces an explicit configuration answer; the existing labeled DEMO fixtures, direct stop, and bounded offline commands (“come here,” “take me there,” “return home,” “continue slowly”) still work. Live cloud credentials and an actual microphone trial are required to validate end-to-end latency and acoustics.

## Connect the teammate's street tools

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

**Stop integration matters:** direct STOP intentionally bypasses the model and calls `CortexRuntime.stop()` → `SafetyGovernor.stop()` → the robot backend. If the street movement uses another backend, connect that same stop path to it. Replacing a model tool named `stop` alone will not wire emergency stop. Replace `resume_navigation` and `return_home` if the new backend changes their semantics. Custom tools must enforce safety themselves; the registry validates arguments, not physical movement.

The current built-in `navigate_to` uses the existing waypoint enum until replaced. `inspect_scene` means robot telemetry, not vision. Register read-only street lookup tools for directions or landmarks if available. `getNavigationContext` can supply the street name and observed surroundings, but must not expose hidden object locations as camera observations.

## Turn behavior

- Last 10 completed user/assistant exchanges are retained in memory; reset clears them.
- Questions preserve the navigation epoch, motion policy, and pending confirmation.
- Speech start cancels a pending model answer and interrupts synthesized audio. It does not stop an already running journey. Explicit STOP stops motion.
- Superseded model output cannot dispatch new tools or replace the answer.
- Tool calls are schema-validated, limited to four rounds of up to eight calls, and results are fed back to the model. The model request loop has a 25-second deadline; custom executors must honor the abort signal.
- “Where is the bus stop?” and “Why did you stop?” do not trigger the deterministic stop matcher. Direct “Stop,” “Please stop,” and “Yes, wait! Stop!” do.
- The Conversation tab shows completed exchanges and a thinking indicator independently of robot motion.

## Validation

`npm test` includes mocked model tests for multi-turn context, tool results, malformed/unknown tools, interruption races, question/motion isolation, and emergency stop. `npm run typecheck` and `npm run build` check the app. `node scripts/test-voice-transport.mjs` exercises the real web runtime against local voice/robot test doubles, without provider credentials. The existing `voice/test_voice.py` exercises Pipecat against a local Gradium protocol double. Neither test substitutes for a live microphone/provider run.

Implementation references: [Pipecat Gradium TTS](https://reference-server.pipecat.ai/en/stable/api/pipecat.services.gradium.tts.html).
