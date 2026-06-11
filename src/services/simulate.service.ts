// Tunable funnel probabilities. Each is conditional on reaching the prior stage.
const P = {
  delivered: 0.92, // of sent
  opened: 0.65, // of delivered
  read: 0.8, // of opened
  clicked: 0.35, // of read
  converted: 0.2, // of clicked
};

export type ChannelEvent =
  | "delivered"
  | "failed"
  | "opened"
  | "read"
  | "clicked"
  | "converted";

export interface SimulatedEvent {
  event: ChannelEvent;
  delayMs: number; // when (after send) this callback should fire
}

const rand = () => Math.random();
// Spread events out over a few seconds so the funnel fills progressively in the demo.
const jitter = (min: number, max: number) =>
  Math.floor(min + rand() * (max - min));

/**
 * Produce the ordered sequence of events for one communication.
 * Failure short-circuits the funnel; otherwise each stage is a conditional coin-flip.
 */
export function simulateOutcome(): SimulatedEvent[] {
  const events: SimulatedEvent[] = [];

  // First hop: delivered or failed.
  if (rand() > P.delivered) {
    events.push({ event: "failed", delayMs: jitter(300, 1500) });
    return events; // terminal
  }
  let t = jitter(300, 1500);
  events.push({ event: "delivered", delayMs: t });

  if (rand() > P.opened) return events;
  t += jitter(500, 2500);
  events.push({ event: "opened", delayMs: t });

  if (rand() > P.read) return events;
  t += jitter(500, 2000);
  events.push({ event: "read", delayMs: t });

  if (rand() > P.clicked) return events;
  t += jitter(500, 3000);
  events.push({ event: "clicked", delayMs: t });

  if (rand() > P.converted) return events;
  t += jitter(1000, 4000);
  events.push({ event: "converted", delayMs: t });

  return events;
}
