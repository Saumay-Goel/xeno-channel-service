import type { Request, Response } from "express";
import { z } from "zod";
import { simulateOutcome } from "../services/simulate.service.js";
import { scheduleCallback } from "../services/callback.service.js";

const sendSchema = z.object({
  messages: z
    .array(
      z.object({
        communicationId: z.string().uuid(),
        recipient: z.string(), // email/phone — we don't actually use it, just model it
        channel: z.enum(["whatsapp", "sms", "email", "rcs"]),
        message: z.string(),
      }),
    )
    .min(1),
});

export async function send(req: Request, res: Response) {
  const { messages } = sendSchema.parse(req.body);

  for (const msg of messages) {
    // Log the "send" so it's visible in the demo that a message went out.
    console.log(
      `[channel] accepted ${msg.channel} → ${msg.recipient} (${msg.communicationId})`,
    );
    const events = simulateOutcome();
    for (const ev of events) {
      scheduleCallback(msg.communicationId, ev.event, ev.delayMs);
    }
  }

  // ACK immediately — delivery outcomes arrive later via callbacks.
  res.status(202).json({ accepted: messages.length });
}
