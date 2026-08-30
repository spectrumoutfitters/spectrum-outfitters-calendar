const STRIPE_METADATA_VALUE_LIMIT = 500;
const TICKET_SPLIT_CHUNK_SIZE = 475;
const TICKET_SPLIT_MAX_CHUNKS = 46;
const TICKET_SPLIT_PARTS_KEY = "ticket_split_parts";
const TICKET_SPLIT_CHUNK_KEY_PREFIX = "ticket_split_";
const LEGACY_TICKET_SPLIT_KEY = "ticket_split";

type MetadataLike = Record<string, string | null | undefined>;

function sanitizeTicketSplit(input: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(input)) {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    if (n > 0) out[k] = n;
  }
  return out;
}

export function encodeTicketSplitMetadata(ticketSplit: Record<string, number>): Record<string, string> {
  const json = JSON.stringify(ticketSplit);
  const metadata: Record<string, string> = {};
  const chunks: string[] = [];

  for (let i = 0; i < json.length; i += TICKET_SPLIT_CHUNK_SIZE) {
    chunks.push(json.slice(i, i + TICKET_SPLIT_CHUNK_SIZE));
  }

  if (chunks.length > TICKET_SPLIT_MAX_CHUNKS) {
    throw new Error("ticket_split_too_large");
  }

  metadata[TICKET_SPLIT_PARTS_KEY] = String(chunks.length || 1);
  if (chunks.length === 0) chunks.push("{}");

  chunks.forEach((chunk, idx) => {
    if (chunk.length > STRIPE_METADATA_VALUE_LIMIT) {
      throw new Error("ticket_split_chunk_too_large");
    }
    metadata[`${TICKET_SPLIT_CHUNK_KEY_PREFIX}${idx}`] = chunk;
  });

  return metadata;
}

export function decodeTicketSplitMetadata(metadata: MetadataLike): Record<string, number> {
  let raw = "";
  const chunkCount = Math.max(0, Math.floor(Number(metadata[TICKET_SPLIT_PARTS_KEY]) || 0));

  if (chunkCount > 0 && chunkCount <= TICKET_SPLIT_MAX_CHUNKS) {
    const chunks: string[] = [];
    for (let i = 0; i < chunkCount; i += 1) {
      const chunk = metadata[`${TICKET_SPLIT_CHUNK_KEY_PREFIX}${i}`];
      if (typeof chunk !== "string") {
        chunks.length = 0;
        break;
      }
      chunks.push(chunk);
    }
    raw = chunks.join("");
  }

  if (!raw) {
    raw = String(metadata[LEGACY_TICKET_SPLIT_KEY] || "{}");
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return sanitizeTicketSplit(parsed as Record<string, unknown>);
  } catch {
    return {};
  }
}
