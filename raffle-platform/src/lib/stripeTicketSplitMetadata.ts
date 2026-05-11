const TICKET_SPLIT_METADATA_KEY = "ticket_split";
const TICKET_SPLIT_CHUNK_COUNT_KEY = "ticket_split_chunk_count";
const TICKET_SPLIT_CHUNK_KEY_PREFIX = "ticket_split_";

// Stripe metadata values are capped at 500 chars. Leave room for future encoding tweaks.
const TICKET_SPLIT_METADATA_CHUNK_SIZE = 480;

function cleanTicketSplit(split: Record<string, unknown>): Record<string, number> {
  const cleanSplit: Record<string, number> = {};
  for (const [poolId, raw] of Object.entries(split)) {
    const id = String(poolId);
    const n = Math.max(0, Math.floor(Number(raw) || 0));
    if (id && n > 0) cleanSplit[id] = n;
  }
  return cleanSplit;
}

export function encodeTicketSplitMetadata(split: Record<string, number>): Record<string, string> {
  const json = JSON.stringify(cleanTicketSplit(split));
  if (json.length <= TICKET_SPLIT_METADATA_CHUNK_SIZE) {
    return { [TICKET_SPLIT_METADATA_KEY]: json };
  }

  const metadata: Record<string, string> = {
    [TICKET_SPLIT_CHUNK_COUNT_KEY]: String(Math.ceil(json.length / TICKET_SPLIT_METADATA_CHUNK_SIZE)),
  };
  for (let i = 0; i < json.length; i += TICKET_SPLIT_METADATA_CHUNK_SIZE) {
    metadata[`${TICKET_SPLIT_CHUNK_KEY_PREFIX}${i / TICKET_SPLIT_METADATA_CHUNK_SIZE}`] = json.slice(
      i,
      i + TICKET_SPLIT_METADATA_CHUNK_SIZE,
    );
  }
  return metadata;
}

export function decodeTicketSplitMetadata(metadata: Record<string, string | null | undefined>): Record<string, number> {
  const chunkCount = Math.max(0, Math.floor(Number(metadata[TICKET_SPLIT_CHUNK_COUNT_KEY]) || 0));
  const raw =
    chunkCount > 0
      ? Array.from({ length: chunkCount }, (_, i) => metadata[`${TICKET_SPLIT_CHUNK_KEY_PREFIX}${i}`] ?? "").join("")
      : String(metadata[TICKET_SPLIT_METADATA_KEY] || "{}");

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return cleanTicketSplit(parsed);
}
