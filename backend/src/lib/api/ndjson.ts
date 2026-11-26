// NDJSON streaming responses (one JSON object per line), used to show the trip agents' progress
// live: {"type":"step",...} lines while they work, then one {"type":"result"} or {"type":"error"}.

export type StreamSend = (obj: unknown) => void;

/** True when the client asked for a progress stream (`Accept: application/x-ndjson`). */
export function wantsNdjson(req: Request): boolean {
  return (req.headers.get("accept") ?? "").includes("application/x-ndjson");
}

/**
 * Runs `work` and streams whatever it sends. If the client goes away the run still finishes
 * server-side (sends become no-ops). `work` must send its own result/error line; an exception
 * that escapes it becomes a generic error line.
 */
export function ndjsonResponse(work: (send: StreamSend) => Promise<void>, headers?: HeadersInit): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send: StreamSend = (obj) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          open = false;
        }
      };
      try {
        await work(send);
      } catch (err) {
        console.error("[ndjson] stream work failed", err);
        send({ type: "error", code: "GENERATION_ERROR", message: "משהו השתבש. נסו שוב בעוד רגע." });
      } finally {
        if (open) {
          try { controller.close(); } catch { /* already closed */ }
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      ...Object.fromEntries(new Headers(headers).entries()),
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
