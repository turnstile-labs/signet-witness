interface Env {
  INBOUND_URL: string;    // e.g. https://witnessed.cc/api/inbound
  INBOUND_SECRET: string; // must match INBOUND_SECRET in the Next.js app
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const raw = await streamToText(message.raw);

    const res = await fetch(env.INBOUND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "message/rfc822",
        // Shared-secret header for the inbound webhook. Must match the
        // `INBOUND_SECRET` env var on the Next.js side; the app rejects
        // any request that doesn't carry this exact header.
        "X-Witnessed-Secret": env.INBOUND_SECRET,
      },
      body: raw,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`inbound error ${res.status}:`, body);
    }
  },
};

async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const merged = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(merged);
}
