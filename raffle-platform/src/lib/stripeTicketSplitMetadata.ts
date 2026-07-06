const TICKET_SPLIT_KEY = "ticket_split";
const TICKET_SPLIT_PARTS_KEY = "ticket_split_parts";
const TICKET_SPLIT_CHUNK_PREFIX = "ticket_split_";
const STRIPE_METADATA_VALUE_LIMIT = 500;
const SAFE_CHUNK_LENGTH = 480;
const MAX_TICKET_SPLIT_CHUNKS = 20;

type StripeMetadataLike = Record<string, string | null | undefined>;

function parseTicketSplitJson(raw: string): Record<string, number> {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const split: Record<string, number> = {};
  for (const [k, v] of Object.entries(parsed)) {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    if (n > 0) split[k] = n;
  }
  return split;
}

export function encodeTicketSplitMetadata(split: Record<string, number>): Record<string, string> {
  const json = JSON.stringify(split);
  if (json.length <= SAFE_CHUNK_LENGTH) {
    return { [TICKET_SPLIT_KEY]: json };
  }

  const chunks: string[] = [];
  for (let i = 0; i < json.length; i += SAFE_CHUNK_LENGTH) {
    chunks.push(json.slice(i, i + SAFE_CHUNK_LENGTH));
  }
  if (chunks.length > MAX_TICKET_SPLIT_CHUNKS) {
    throw new Error("ticket_split_metadata_too_large");
  }

  const metadata: Record<string, string> = {
    [TICKET_SPLIT_PARTS_KEY]: String(chunks.length),
  };
  chunks.forEach((chunk, idx) => {
    if (chunk.length > STRIPE_METADATA_VALUE_LIMIT) {
      throw new Error("ticket_split_metadata_too_large");
    }
    metadata[`${TICKET_SPLIT_CHUNK_PREFIX}${idx}`] = chunk;
  });
  return metadata;
}

export function decodeTicketSplitMetadata(metadata: StripeMetadataLike): Record<string, number> {
  const partsRaw = metadata[TICKET_SPLIT_PARTS_KEY];
  if (partsRaw) {
    const parts = Number(partsRaw);
    if (!Number.isInteger(parts) || parts <= 0 || parts > MAX_TICKET_SPLIT_CHUNKS) {
      throw new Error("invalid_ticket_split_metadata");
    }
    let json = "";
    for (let i = 0; i < parts; i++) {
      const chunk = metadata[`${TICKET_SPLIT_CHUNK_PREFIX}${i}`];
      if (typeof chunk !== "string") {
        throw new Error("invalid_ticket_split_metadata");
      }
      json += chunk;
    }
    return parseTicketSplitJson(json);
  }

  const legacy = metadata[TICKET_SPLIT_KEY];
  return parseTicketSplitJson(typeof legacy === "string" && legacy ? legacy : "{}");
}
