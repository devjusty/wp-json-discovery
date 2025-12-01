export async function readBodyWithLimit(response, limitBytes) {
  const reader = response.body?.getReader ? response.body.getReader() : null;
  let received = 0;
  let truncated = false;
  const chunks = [];

  if (!reader) {
    const text = await response.text();
    const slice = text.slice(0, limitBytes);
    return {
      body: slice,
      size: text.length,
      truncated: text.length > limitBytes
    };
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    received += value.length;
    if (!truncated) {
      chunks.push(Buffer.from(value));
    }

    if (received > limitBytes && !truncated) {
      truncated = true;
      try {
        await reader.cancel();
      } catch {
        // ignore cancellation errors
      }
      break;
    }
  }

  const buffered = Buffer.concat(chunks);
  return {
    body: buffered.toString('utf-8'),
    size: received,
    truncated
  };
}
