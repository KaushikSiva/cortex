/** Browser interruption epochs and per-response IDs prevent delayed TTS packets
 * from reviving an interrupted reply. No robot control depends on this gate. */
export function interruptsPlayback(message: unknown): boolean {
 if (!message || typeof message !== 'object') return false;
 const m = message as {type?: string; text?: string; name?: string};
 return ['speech_start','stop','reset','mic_start','mic_stop'].includes(m.type ?? '') ||
  (m.type === 'fixture' && m.name === 'stop') ||
  (m.type === 'text' && /\b(stop|wait|halt|freeze)\b/i.test(m.text ?? ''));
}

export class PlaybackEpoch {
 value = 0;
 interrupt() {this.value++;}
 accepts(epoch: unknown) {return epoch === this.value;}
}

export class SpeechResponses {
 private epoch = 0;
 private sequence = 0;
 private current: {requestId: string; voiceEpoch: number} | null = null;
 observe(epoch: unknown) {
  if (typeof epoch === 'number' && Number.isSafeInteger(epoch) && epoch > this.epoch) {
   this.epoch = epoch; this.cancel();
  }
 }
 begin() {return this.current = {requestId: String(++this.sequence), voiceEpoch: this.epoch};}
 cancel() {this.current = null;}
 match(requestId: unknown) {return this.current?.requestId === requestId ? this.current : null;}
}
