const MAX_METADATA_VALUE_LENGTH = 480;
const MAX_SPLIT_CHUNKS = 45;

function cleanTicketSplit(split) {
  const out = {};
  if (!split || typeof split !== "object" || Array.isArray(split)) return out;
  for (const [poolId, raw] of Object.entries(split)) {
    const id = String(poolId);
    const tickets = Math.max(0, Math.floor(Number(raw) || 0));
    if (id && tickets > 0) out[id] = tickets;
  }
  return out;
}

function chunkString(value, size) {
  const chunks = [];
  for (let i = 0; i < value.length; i += size) chunks.push(value.slice(i, i + size));
  return chunks.length ? chunks : ["{}"];
}

export function encodeTicketSplitMetadata(split) {
  const json = JSON.stringify(cleanTicketSplit(split));
  const chunks = chunkString(json, MAX_METADATA_VALUE_LENGTH);
  if (chunks.length > MAX_SPLIT_CHUNKS) {
    throw new Error("ticket_split_metadata_too_large");
  }

  const metadata = {
    ticket_split: chunks[0],
    ticket_split_chunks: String(chunks.length),
  };
  for (let i = 1; i < chunks.length; i++) metadata[`ticket_split_${i}`] = chunks[i];
  return metadata;
}

export function decodeTicketSplitMetadata(metadata) {
  const md = metadata && typeof metadata === "object" ? metadata : {};
  const chunkCount = Math.max(0, Math.floor(Number(md.ticket_split_chunks) || 0));
  const raw =
    chunkCount > 1
      ? [String(md.ticket_split || ""), ...Array.from({ length: chunkCount - 1 }, (_, i) => String(md[`ticket_split_${i + 1}`] || ""))].join("")
      : String(md.ticket_split || "{}");

  const parsed = JSON.parse(raw || "{}");
  return cleanTicketSplit(parsed);
}
