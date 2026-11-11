import { context, effectsBus } from "./audio-context";

/** A pitch sweep with a short attack and exponential decay. */
export function tone(
  frequency: number,
  end: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.12,
  delay = 0,
  destination: AudioNode | null = effectsBus,
) {
  if (!context || !destination) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(20, end),
    start + duration,
  );
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope);
  envelope.connect(destination);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
  oscillator.start(start);
  oscillator.stop(start + duration + 0.01);
}

/** A filtered white-noise burst whose cutoff falls over its duration. */
export function noise(
  duration: number,
  frequency: number,
  volume: number,
  band: BiquadFilterType = "bandpass",
  delay = 0,
  destination: AudioNode | null = effectsBus,
) {
  if (!context || !destination) return;
  const start = context.currentTime + delay;
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * duration),
    context.sampleRate,
  );
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = band;
  filter.frequency.setValueAtTime(frequency, start);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(90, frequency * 0.3),
    start + duration,
  );
  filter.Q.value = 0.8;
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(volume, start);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(destination);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    envelope.disconnect();
  };
  source.start(start);
  source.stop(start + duration);
}
