import { env } from "../config/env.js";
import type { ChannelEvent } from "./simulate.service.js";

interface CallbackPayload {
  communicationId: string;
  event: ChannelEvent;
  occurredAt: string;
}

async function postWithRetry(
  payload: CallbackPayload,
  attempt = 1,
): Promise<void> {
  const MAX_ATTEMPTS = 3;
  try {
    const res = await fetch(env.CRM_RECEIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-callback-secret": env.CALLBACK_SECRET,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`CRM responded ${res.status}`);
    console.log(
      `[channel] → ${payload.event} for ${payload.communicationId} (ok)`,
    );
  } catch (err) {
    if (attempt < MAX_ATTEMPTS) {
      const backoff = 500 * attempt;
      console.warn(
        `[channel] callback failed (attempt ${attempt}), retrying in ${backoff}ms`,
      );
      await new Promise((r) => setTimeout(r, backoff));
      return postWithRetry(payload, attempt + 1);
    }
    console.error(
      `[channel] callback permanently failed for ${payload.communicationId}:`,
      err,
    );
  }
}

export function scheduleCallback(
  communicationId: string,
  event: ChannelEvent,
  delayMs: number,
) {
  setTimeout(() => {
    void postWithRetry({
      communicationId,
      event,
      occurredAt: new Date().toISOString(),
    });
  }, delayMs);
}
