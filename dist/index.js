import { z } from 'zod';

// src/schemas/common.ts
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var uuidSchema = z.string().regex(UUID_RE, "must be a UUID");
var isoDateTimeSchema = z.string().min(1);
var epochMsSchema = z.number().int().nonnegative();
var planSchema = z.enum(["free", "pro"]);
var keySourceSchema = z.enum(["platform", "byok"]);
var clientKindSchema = z.enum(["extension", "web"]);
var jsonObjectSchema = z.record(z.string(), z.unknown());
var bookmarkStatusSchema = z.enum(["active", "dead", "archived", "deleted"]);
var contentStateSchema = z.enum(["pending", "client", "scraped", "failed"]);
var folderOriginSchema = z.enum(["user", "sqishy"]);
var flatNodeSchema = z.object({
  id: z.string().min(1).max(128),
  parentId: z.string().min(1).max(128).nullable(),
  title: z.string().max(2048),
  url: z.string().max(4096).nullable(),
  dateAdded: epochMsSchema.nullable(),
  depth: z.number().int().min(0).max(64),
  index: z.number().int().min(0)
});
var IMPORT_BATCH_SIZE = 500;
var MAX_CHANGES_PER_FLUSH = 1e3;
var syncOpKindSchema = z.enum(["create", "update", "move", "remove", "reorder"]);
var syncChangeSchema = z.object({
  localSeq: z.number().int().nonnegative(),
  kind: syncOpKindSchema,
  chromeId: z.string().min(1).max(128),
  parentId: z.string().min(1).max(128).nullable(),
  index: z.number().int().min(0).nullable(),
  title: z.string().max(2048).nullable(),
  url: z.string().max(4096).nullable(),
  dateAdded: epochMsSchema.nullable(),
  occurredAt: epochMsSchema
});
var MAX_MANIFEST_IDS = 5e4;
var syncImportRequestSchema = z.object({
  deviceId: uuidSchema.nullable(),
  deviceLabel: z.string().min(1).max(120),
  batchIndex: z.number().int().min(0),
  batchCount: z.number().int().min(1),
  nodes: z.array(flatNodeSchema).max(IMPORT_BATCH_SIZE),
  /**
   * Every chrome id in the tree being imported, sent on the final batch only.
   *
   * An import is chunked, so no single batch knows the whole tree and the
   * server cannot tell "absent from this batch" from "gone from the browser".
   * The manifest is what makes a reinstall able to *subtract*: bookmarks
   * deleted while the extension was uninstalled emitted no events and are
   * absent from the replayed tree, so without it the server keeps them forever.
   *
   * Optional because it is additive — an older extension omits it and simply
   * gets the old add-only behaviour rather than a rejected import.
   */
  presentChromeIds: z.array(z.string().min(1).max(128)).max(MAX_MANIFEST_IDS).optional()
});
var syncImportResponseSchema = z.object({
  deviceId: uuidSchema,
  accepted: z.number().int().nonnegative(),
  deduped: z.number().int().nonnegative(),
  cursor: z.number().int().nonnegative(),
  /** Rows soft-deleted because the manifest did not list them. */
  pruned: z.number().int().nonnegative().optional()
});
var syncChangesRequestSchema = z.object({
  deviceId: uuidSchema,
  cursor: z.number().int().nonnegative(),
  changes: z.array(syncChangeSchema).max(MAX_CHANGES_PER_FLUSH)
});
var syncRejectionSchema = z.object({
  localSeq: z.number().int().nonnegative(),
  reason: z.string()
});
var mutationOpKindSchema = z.enum(["move", "rename", "create_folder", "remove"]);
var mutationOpSchema = z.object({
  opId: uuidSchema,
  kind: mutationOpKindSchema,
  chromeId: z.string().min(1).max(128).nullable(),
  targetParentChromeId: z.string().min(1).max(128).nullable(),
  index: z.number().int().min(0).nullable(),
  title: z.string().max(2048).nullable()
});
var mutationPlanSchema = z.object({
  planId: uuidSchema,
  proposalId: uuidSchema,
  createdAt: isoDateTimeSchema,
  ops: z.array(mutationOpSchema)
});
var syncChangesResponseSchema = z.object({
  cursor: z.number().int().nonnegative(),
  applied: z.number().int().nonnegative(),
  rejected: z.array(syncRejectionSchema),
  plans: z.array(mutationPlanSchema)
});
var mutationOpResultSchema = z.object({
  opId: uuidSchema,
  ok: z.boolean(),
  error: z.string().optional(),
  newChromeId: z.string().max(128).optional()
});
var mutationPlanAckSchema = z.object({
  planId: uuidSchema,
  results: z.array(mutationOpResultSchema)
});
var syncDiffResponseSchema = z.object({
  serverTreeHash: z.string(),
  serverBookmarks: z.number().int().nonnegative(),
  serverFolders: z.number().int().nonnegative(),
  cursor: z.number().int().nonnegative()
});
var quotaStateSchema = z.object({
  period: z.string(),
  limit: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  keySource: keySourceSchema
});
var meResponseSchema = z.object({
  /** Served rather than compiled in — see MeResponse. */
  webAppUrl: z.string().url(),
  userId: uuidSchema,
  email: z.string().email(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  plan: planSchema,
  byokEnabled: z.boolean(),
  quota: quotaStateSchema
});
var apiErrorSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
  minProtocolVersion: z.number().int().optional()
});
var proposalKindSchema = z.enum(["categorize", "dedupe", "merge_folder", "dead_link"]);
var proposalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "applied",
  "expired"
]);
var proposalItemOpSchema = z.enum([
  "move",
  "rename",
  "delete",
  "create_folder",
  "merge"
]);
var proposalItemSchema = z.object({
  id: uuidSchema,
  proposalId: uuidSchema,
  bookmarkId: uuidSchema.nullable(),
  folderId: uuidSchema.nullable(),
  op: proposalItemOpSchema,
  before: jsonObjectSchema,
  after: jsonObjectSchema
});
var proposalSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  kind: proposalKindSchema,
  status: proposalStatusSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  batchId: uuidSchema,
  itemCount: z.number().int().nonnegative(),
  createdAt: isoDateTimeSchema,
  items: z.array(proposalItemSchema).optional()
});
var proposalBulkApproveRequestSchema = z.object({
  proposalIds: z.array(uuidSchema).min(1).max(1e3),
  overrides: z.record(uuidSchema, z.string()).optional()
});
var proposalDecisionResponseSchema = z.object({
  approved: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  planIds: z.array(uuidSchema)
});
var MAX_TELEMETRY_EVENTS = 200;
var telemetryEventNames = [
  "popup.opened",
  "report.generated",
  "report.cta_clicked",
  "report.history_permission",
  "extension.installed",
  "extension.updated",
  "sync.imported",
  "sync.flushed",
  "sync.rejected",
  "sync.drift",
  "sync.flush_failed"
];
var telemetryLabelValues = {
  size: ["0", "1-99", "100-499", "500-999", "1k-5k", "5k+"],
  issues: ["0", "1-9", "10-49", "50-199", "200+"],
  signedIn: ["true", "false"],
  granted: ["true", "false"],
  historyAvailable: ["true", "false"]
};
var telemetryMeasures = [
  "durationMs",
  "duplicates",
  "emptyFolders",
  "singleItemFolders",
  "maxDepth",
  "nodes",
  "batches",
  "sent",
  "applied",
  "count",
  "pruned"
];
var telemetryEventNameSchema = z.enum(telemetryEventNames);
var telemetryClientSchema = z.enum(["extension", "web"]);
var telemetryEventSchema = z.object({
  name: z.string().min(1).max(64),
  attributes: z.record(
    z.string().max(40),
    z.union([z.number(), z.string().max(64), z.boolean()])
  ),
  at: epochMsSchema
});
var telemetryBatchSchema = z.object({
  client: telemetryClientSchema,
  events: z.array(telemetryEventSchema).max(MAX_TELEMETRY_EVENTS)
});
var telemetryIngestResponseSchema = z.object({
  accepted: z.number().int().nonnegative(),
  dropped: z.number().int().nonnegative()
});

// src/url/sha256.ts
var K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var HEX = "0123456789abcdef";
function rotr(x, n) {
  return x >>> n | x << 32 - n;
}
function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const bitLenHi = Math.floor(data.length * 8 / 4294967296);
  const bitLenLo = data.length * 8 >>> 0;
  const paddedLen = data.length + 9 + 63 >> 6 << 6;
  const buf = new Uint8Array(paddedLen);
  buf.set(data);
  buf[data.length] = 128;
  const view = new DataView(buf.buffer);
  view.setUint32(paddedLen - 8, bitLenHi, false);
  view.setUint32(paddedLen - 4, bitLenLo, false);
  const h = new Uint32Array([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15];
      const y = w[i - 2];
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ x >>> 3;
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ y >>> 10;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
    }
    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let hh = h[7];
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = e & f ^ ~e & g;
      const temp1 = hh + s1 + ch + K[i] + w[i] >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = a & b ^ a & c ^ b & c;
      const temp2 = s0 + maj >>> 0;
      hh = g;
      g = f;
      f = e;
      e = d + temp1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = temp1 + temp2 >>> 0;
    }
    h[0] = h[0] + a >>> 0;
    h[1] = h[1] + b >>> 0;
    h[2] = h[2] + c >>> 0;
    h[3] = h[3] + d >>> 0;
    h[4] = h[4] + e >>> 0;
    h[5] = h[5] + f >>> 0;
    h[6] = h[6] + g >>> 0;
    h[7] = h[7] + hh >>> 0;
  }
  let out = "";
  for (let i = 0; i < 8; i++) {
    const word = h[i];
    for (let shift = 28; shift >= 0; shift -= 4) {
      out += HEX[word >>> shift & 15];
    }
  }
  return out;
}

// src/url/canonical.ts
var TRACKING_PARAMS = /* @__PURE__ */ new Set([
  "gclid",
  "gclsrc",
  "gbraid",
  "wbraid",
  "dclid",
  "fbclid",
  "msclkid",
  "yclid",
  "twclid",
  "ttclid",
  "igshid",
  "igsh",
  "si",
  "spm",
  "scm",
  "ref_src",
  "ref_url",
  "mkt_tok",
  "trk",
  "ncid",
  "cmpid",
  "icid",
  "epik",
  "s_kwcid",
  "li_fat_id",
  "oly_enc_id",
  "oly_anon_id",
  "_ga",
  "_gl",
  "_hsenc",
  "_hsmi",
  "wt_mc",
  "at_medium",
  "at_campaign",
  "campaignid",
  "adgroupid",
  "sc_cid",
  "source"
]);
var TRACKING_PREFIXES = ["utm_", "pk_", "piwik_", "mc_", "vero_", "hsa_", "ga_"];
var STRIPPABLE_SUBDOMAINS = ["www.", "m.", "mobile."];
var DEFAULT_PORTS = { "http:": "80", "https:": "443" };
function isTrackingParam(key) {
  const lower = key.toLowerCase();
  if (TRACKING_PARAMS.has(lower)) return true;
  return TRACKING_PREFIXES.some((prefix) => lower.startsWith(prefix));
}
function stripSubdomain(hostname) {
  const lower = hostname.toLowerCase();
  for (const prefix of STRIPPABLE_SUBDOMAINS) {
    if (lower.startsWith(prefix) && lower.length > prefix.length) {
      return lower.slice(prefix.length);
    }
  }
  return lower;
}
function canonicalizeUrl(raw) {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return trimmed;
  }
  const host = stripSubdomain(url.hostname);
  const isDefaultPort = url.port === "" || url.port === DEFAULT_PORTS[url.protocol] || url.port === "443";
  const port = isDefaultPort ? "" : `:${url.port}`;
  const params = [];
  url.searchParams.forEach((value, key) => {
    if (!isTrackingParam(key)) params.push([key, value]);
  });
  params.sort((a, b) => a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0]));
  const search = params.length > 0 ? `?${params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")}` : "";
  let path = url.pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path === "/") path = "";
  return `https://${host}${port}${path}${search}`;
}
function urlHash(raw) {
  return sha256Hex(canonicalizeUrl(raw));
}
function pathTokens(pathname) {
  return pathname.toLowerCase().split(/[/\-_.]+/).map((token) => token.trim()).filter((token) => token.length > 1 && !/^\d+$/.test(token));
}
function parseUrl(raw) {
  const canonical = canonicalizeUrl(raw);
  let host = "";
  let tokens = [];
  try {
    const url = new URL(canonical);
    host = url.hostname;
    tokens = pathTokens(url.pathname);
  } catch {
    host = "";
  }
  return {
    original: raw,
    canonical,
    hash: sha256Hex(canonical),
    host,
    domain: stripSubdomain(host),
    pathTokens: tokens
  };
}

// src/report/flatten.ts
function unwrapRoots(nodes) {
  if (nodes.length !== 1) return nodes;
  const root = nodes[0];
  if (!root) return nodes;
  const isSynthetic = root.url === void 0 && root.title === "" && Array.isArray(root.children);
  return isSynthetic ? root.children ?? [] : nodes;
}
function flattenTree(nodes, unwrap = true) {
  const out = [];
  const roots = unwrap ? unwrapRoots(nodes) : nodes;
  const walk = (node, parentId, depth, index) => {
    out.push({
      id: node.id,
      parentId,
      title: node.title ?? "",
      url: node.url ?? null,
      dateAdded: node.dateAdded ?? null,
      depth,
      index: node.index ?? index
    });
    const children = node.children ?? [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child) walk(child, node.id, depth + 1, i);
    }
  };
  for (let i = 0; i < roots.length; i++) {
    const root = roots[i];
    if (root) walk(root, null, 0, i);
  }
  return out;
}

// src/protocol.ts
var PROTOCOL_VERSION = 1;
var MIN_SUPPORTED_PROTOCOL = 1;
var PROTOCOL_HEADER = "x-squishy-protocol";
var CLIENT_HEADER = "x-squishy-client";
function isProtocolSupported(version) {
  return Number.isInteger(version) && version >= MIN_SUPPORTED_PROTOCOL && version <= PROTOCOL_VERSION;
}

// src/report/naming.ts
var FILLER_TOKENS = /* @__PURE__ */ new Set([
  "stuff",
  "misc",
  "miscellaneous",
  "things",
  "random",
  "other",
  "others",
  "new",
  "folder",
  "my",
  "saved",
  "bookmarks",
  "bookmark",
  "links",
  "link",
  "general",
  "various",
  "assorted",
  // Conjunctions and articles. `&` expands to `and`, so this must include it or
  // "Design & UI" and "UI / Design" stop matching.
  "and",
  "or",
  "the",
  "a",
  "an",
  "of",
  "for",
  "to",
  "in",
  "on",
  "with"
]);
var ALIASES = {
  javascript: "js",
  ecmascript: "js",
  typescript: "ts",
  python: "py",
  golang: "go",
  kubernetes: "k8s",
  postgresql: "postgres",
  psql: "postgres",
  documentation: "docs",
  doc: "docs",
  reference: "docs",
  tutorials: "tutorial",
  articles: "article",
  tools: "tool",
  utilities: "tool",
  utils: "tool",
  jobs: "job",
  career: "job",
  careers: "job",
  design: "design",
  ui: "design",
  ux: "design"
};
var VAGUE_TITLES = /* @__PURE__ */ new Set([
  "untitled",
  "new tab",
  "read later",
  "read it later",
  "later",
  "todo",
  "to do",
  "to-do",
  "stuff",
  "misc",
  "temp",
  "tmp",
  "test",
  "link",
  "page",
  "document",
  "bookmark",
  "home",
  "index",
  "(no title)",
  "no title",
  "unknown",
  "loading",
  "error",
  "..."
]);
function normalizeFolderName(title) {
  const tokens = title.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter((token) => token.length > 0 && !FILLER_TOKENS.has(token)).map((token) => ALIASES[token] ?? token);
  const unique = [...new Set(tokens)].sort();
  return unique.join(" ");
}
function isUntitled(title) {
  return title.trim() === "";
}
function isVagueTitle(title, url) {
  const trimmed = title.trim();
  if (trimmed === "") return false;
  const lower = trimmed.toLowerCase();
  if (VAGUE_TITLES.has(lower)) return true;
  if (trimmed.length <= 2) return true;
  if (lower === url.toLowerCase()) return true;
  return /^https?:\/\//i.test(trimmed);
}
function titleEqualsUrl(title, url) {
  const t = title.trim().toLowerCase().replace(/\/$/, "");
  const u = url.trim().toLowerCase().replace(/\/$/, "");
  if (t === "") return false;
  return t === u || t === u.replace(/^https?:\/\//, "");
}
function editDistance(a, b, max = 2) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
      curr[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length];
}

// src/report/engine.ts
var YEAR_MS = 365 * 24 * 60 * 60 * 1e3;
var DEEP_NESTING_THRESHOLD = 4;
var DUMPING_GROUND_MIN_ITEMS = 20;
var DUMPING_GROUND_MIN_SHARE = 0.25;
var MAX_SAMPLES = 10;
var MAX_GROUPS = 200;
function buildPath(node, byId) {
  const parts = [];
  let current = node;
  const seen = /* @__PURE__ */ new Set();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    parts.unshift(current.title || "(untitled)");
    current = current.parentId ? byId.get(current.parentId) : void 0;
  }
  return `/${parts.join("/")}`;
}
function pickSurvivor(nodes) {
  let best = nodes[0];
  for (const node of nodes) {
    const bestDate = best.dateAdded ?? Number.MAX_SAFE_INTEGER;
    const nodeDate = node.dateAdded ?? Number.MAX_SAFE_INTEGER;
    if (nodeDate < bestDate) {
      best = node;
    } else if (nodeDate === bestDate && node.title.length > best.title.length) {
      best = node;
    }
  }
  return best.id;
}
function groupDuplicates(bookmarks, keyOf, kind) {
  const buckets = /* @__PURE__ */ new Map();
  for (const node of bookmarks) {
    const key = keyOf(node);
    if (key === "") continue;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(node);
    else buckets.set(key, [node]);
  }
  const groups = [];
  for (const [key, nodes] of buckets) {
    if (nodes.length < 2) continue;
    groups.push({
      key,
      kind,
      url: nodes[0].url ?? "",
      nodeIds: nodes.map((n) => n.id),
      keepNodeId: pickSurvivor(nodes),
      count: nodes.length
    });
  }
  groups.sort((a, b) => b.count - a.count);
  return groups.slice(0, MAX_GROUPS);
}
function groupSimilarFolders(folders) {
  const byNormalized = /* @__PURE__ */ new Map();
  for (const folder of folders) {
    const key = normalizeFolderName(folder.title);
    if (key === "") continue;
    const bucket = byNormalized.get(key);
    if (bucket) bucket.push(folder);
    else byNormalized.set(key, [folder]);
  }
  const keys = [...byNormalized.keys()];
  const mergedInto = /* @__PURE__ */ new Map();
  for (let i = 0; i < keys.length; i++) {
    const a = keys[i];
    if (mergedInto.has(a)) continue;
    for (let j = i + 1; j < keys.length; j++) {
      const b = keys[j];
      if (mergedInto.has(b)) continue;
      if (a.length < 4 || b.length < 4) continue;
      if (editDistance(a, b, 1) <= 1) mergedInto.set(b, a);
    }
  }
  const merged = /* @__PURE__ */ new Map();
  for (const [key, list] of byNormalized) {
    const target = mergedInto.get(key) ?? key;
    const bucket = merged.get(target);
    if (bucket) bucket.push(...list);
    else merged.set(target, [...list]);
  }
  const groups = [];
  for (const [normalized, list] of merged) {
    if (list.length < 2) continue;
    groups.push({ normalized, folders: list });
  }
  groups.sort((a, b) => b.folders.length - a.folders.length);
  return groups.slice(0, MAX_GROUPS);
}
function buildCleanupReport(input) {
  const now = input.now ?? Date.now();
  const nodes = input.nodes;
  const byId = /* @__PURE__ */ new Map();
  for (const node of nodes) byId.set(node.id, node);
  const bookmarks = [];
  const folderNodes = [];
  for (const node of nodes) {
    if (node.url === null) folderNodes.push(node);
    else bookmarks.push(node);
  }
  const directBookmarks = /* @__PURE__ */ new Map();
  const directFolders = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    if (node.parentId === null) continue;
    const target = node.url === null ? directFolders : directBookmarks;
    target.set(node.parentId, (target.get(node.parentId) ?? 0) + 1);
  }
  const folderSummaries = folderNodes.map((folder) => ({
    id: folder.id,
    title: folder.title,
    path: buildPath(folder, byId),
    depth: folder.depth,
    bookmarkCount: directBookmarks.get(folder.id) ?? 0,
    childFolderCount: directFolders.get(folder.id) ?? 0
  }));
  const empty = folderSummaries.filter((f) => f.bookmarkCount === 0 && f.childFolderCount === 0);
  const singleItem = folderSummaries.filter((f) => f.bookmarkCount + f.childFolderCount === 1);
  const deeplyNested = folderSummaries.filter((f) => f.depth > DEEP_NESTING_THRESHOLD);
  const similarNames = groupSimilarFolders(folderSummaries);
  let dumpingGround = null;
  for (const folder of folderSummaries) {
    if (folder.depth > 1) continue;
    if (folder.bookmarkCount < DUMPING_GROUND_MIN_ITEMS) continue;
    if (folder.bookmarkCount < bookmarks.length * DUMPING_GROUND_MIN_SHARE) continue;
    if (!dumpingGround || folder.bookmarkCount > dumpingGround.bookmarkCount) {
      dumpingGround = folder;
    }
  }
  const exactGroups = groupDuplicates(bookmarks, (n) => (n.url ?? "").trim(), "exact");
  const canonicalGroups = groupDuplicates(bookmarks, (n) => n.url ? urlHash(n.url) : "", "canonical");
  const wastedEntries = canonicalGroups.reduce((sum, group) => sum + group.count - 1, 0);
  let untitled = 0;
  let vague = 0;
  let sameAsUrl = 0;
  const samples = [];
  for (const node of bookmarks) {
    const url = node.url ?? "";
    if (isUntitled(node.title)) {
      untitled += 1;
    } else if (isVagueTitle(node.title, url)) {
      vague += 1;
    }
    if (titleEqualsUrl(node.title, url)) sameAsUrl += 1;
    if (samples.length < MAX_SAMPLES && (isUntitled(node.title) || isVagueTitle(node.title, url))) {
      samples.push({ id: node.id, title: node.title, url });
    }
  }
  let oldest = null;
  let newest = null;
  let olderThan1Year = 0;
  let olderThan3Years = 0;
  let olderThan5Years = 0;
  let undated = 0;
  for (const node of bookmarks) {
    const added = node.dateAdded;
    if (added === null) {
      undated += 1;
      continue;
    }
    if (oldest === null || added < oldest) oldest = added;
    if (newest === null || added > newest) newest = added;
    const age = now - added;
    if (age > YEAR_MS) olderThan1Year += 1;
    if (age > YEAR_MS * 3) olderThan3Years += 1;
    if (age > YEAR_MS * 5) olderThan5Years += 1;
  }
  const historyAvailable = Array.isArray(input.history);
  let neverRevisited = 0;
  let notVisitedIn1Year = 0;
  if (historyAvailable) {
    const visits = /* @__PURE__ */ new Map();
    for (const stat of input.history ?? []) {
      const key = canonicalizeUrl(stat.url);
      const existing = visits.get(key);
      if (existing) {
        existing.visitCount += stat.visitCount;
        if ((stat.lastVisitAt ?? 0) > (existing.lastVisitAt ?? 0)) existing.lastVisitAt = stat.lastVisitAt;
      } else {
        visits.set(key, { visitCount: stat.visitCount, lastVisitAt: stat.lastVisitAt });
      }
    }
    for (const node of bookmarks) {
      const stat = visits.get(canonicalizeUrl(node.url ?? ""));
      if (!stat || stat.visitCount <= 1) neverRevisited += 1;
      if (!stat || stat.lastVisitAt === null || now - stat.lastVisitAt > YEAR_MS) notVisitedIn1Year += 1;
    }
  }
  const similarNameSurplus = similarNames.reduce((sum, group) => sum + group.folders.length - 1, 0);
  const issueCount = wastedEntries + empty.length + singleItem.length + deeplyNested.length + similarNameSurplus + untitled + vague;
  return {
    generatedAt: now,
    protocolVersion: PROTOCOL_VERSION,
    totals: {
      bookmarks: bookmarks.length,
      folders: folderNodes.length,
      maxDepth: nodes.reduce((max, node) => Math.max(max, node.depth), 0),
      topLevelBookmarks: bookmarks.filter((node) => node.depth <= 1).length,
      averageFolderSize: folderNodes.length === 0 ? 0 : bookmarks.length / folderNodes.length
    },
    duplicates: {
      exactGroups,
      canonicalGroups,
      exactCount: exactGroups.length,
      canonicalCount: canonicalGroups.length,
      wastedEntries
    },
    folders: {
      total: folderNodes.length,
      empty,
      singleItem,
      deeplyNested,
      similarNames,
      dumpingGround
    },
    naming: { untitled, vague, titleEqualsUrl: sameAsUrl, samples },
    age: {
      oldestAddedAt: oldest,
      newestAddedAt: newest,
      olderThan1Year,
      olderThan3Years,
      olderThan5Years,
      undated
    },
    engagement: { historyAvailable, neverRevisited, notVisitedIn1Year },
    issueCount
  };
}

// src/sync/tree-hash.ts
function treeHash(nodes) {
  const lines = nodes.map((node) => {
    const url = node.url === null ? "" : canonicalizeUrl(node.url);
    return [node.id, node.parentId ?? "", node.title, url, String(node.index)].join("\0");
  });
  lines.sort();
  return sha256Hex(lines.join("\n"));
}
function treeSize(nodes) {
  let bookmarks = 0;
  let folders = 0;
  for (const node of nodes) {
    if (node.url === null) folders += 1;
    else bookmarks += 1;
  }
  return { bookmarks, folders };
}

// src/classify/rules.ts
var RULE_CONFIDENCE_DOMAIN = 0.9;
var RULE_CONFIDENCE_PATH = 0.8;
var RULE_CONFIDENCE_FLOOR = 0.8;
var DOMAIN_RULES = [
  // Development
  ["github.com", "Development"],
  ["gitlab.com", "Development"],
  ["bitbucket.org", "Development"],
  ["stackoverflow.com", "Development"],
  ["stackexchange.com", "Development"],
  ["npmjs.com", "Development"],
  ["pypi.org", "Development"],
  ["crates.io", "Development"],
  ["packagist.org", "Development"],
  ["rubygems.org", "Development"],
  ["codepen.io", "Development"],
  ["codesandbox.io", "Development"],
  ["leetcode.com", "Development"],
  ["codewars.com", "Development"],
  // DevOps & Infra
  ["docker.com", "DevOps & Infra"],
  ["hub.docker.com", "DevOps & Infra"],
  ["kubernetes.io", "DevOps & Infra"],
  ["terraform.io", "DevOps & Infra"],
  ["aws.amazon.com", "DevOps & Infra"],
  ["console.aws.amazon.com", "DevOps & Infra"],
  ["cloud.google.com", "DevOps & Infra"],
  ["azure.microsoft.com", "DevOps & Infra"],
  ["digitalocean.com", "DevOps & Infra"],
  ["cloudflare.com", "DevOps & Infra"],
  ["grafana.com", "DevOps & Infra"],
  ["prometheus.io", "DevOps & Infra"],
  // AI & ML
  ["huggingface.co", "AI & ML"],
  ["openai.com", "AI & ML"],
  ["anthropic.com", "AI & ML"],
  ["claude.ai", "AI & ML"],
  ["kaggle.com", "AI & ML"],
  ["pytorch.org", "AI & ML"],
  ["tensorflow.org", "AI & ML"],
  ["paperswithcode.com", "AI & ML"],
  // Design & UI
  ["figma.com", "Design & UI"],
  ["dribbble.com", "Design & UI"],
  ["behance.net", "Design & UI"],
  ["unsplash.com", "Design & UI"],
  ["fonts.google.com", "Design & UI"],
  ["coolors.co", "Design & UI"],
  // Documentation & Reference
  ["developer.mozilla.org", "Documentation & Reference"],
  ["docs.python.org", "Documentation & Reference"],
  ["docs.rs", "Documentation & Reference"],
  ["readthedocs.io", "Documentation & Reference"],
  ["w3.org", "Documentation & Reference"],
  ["caniuse.com", "Documentation & Reference"],
  // Research & Papers
  ["arxiv.org", "Research & Papers"],
  ["scholar.google.com", "Research & Papers"],
  ["pubmed.ncbi.nlm.nih.gov", "Research & Papers"],
  ["jstor.org", "Research & Papers"],
  ["sciencedirect.com", "Research & Papers"],
  ["nature.com", "Research & Papers"],
  // Learning & Courses
  ["coursera.org", "Learning & Courses"],
  ["udemy.com", "Learning & Courses"],
  ["edx.org", "Learning & Courses"],
  ["khanacademy.org", "Learning & Courses"],
  ["freecodecamp.org", "Learning & Courses"],
  ["pluralsight.com", "Learning & Courses"],
  // Career & Jobs
  ["linkedin.com", "Career & Jobs"],
  ["indeed.com", "Career & Jobs"],
  ["glassdoor.com", "Career & Jobs"],
  ["wellfound.com", "Career & Jobs"],
  // News & Articles
  ["news.ycombinator.com", "News & Articles"],
  ["bbc.com", "News & Articles"],
  ["theguardian.com", "News & Articles"],
  ["reuters.com", "News & Articles"],
  ["techcrunch.com", "News & Articles"],
  ["arstechnica.com", "News & Articles"],
  // Social & Community
  ["facebook.com", "Social & Community"],
  ["instagram.com", "Social & Community"],
  ["discord.com", "Social & Community"],
  ["mastodon.social", "Social & Community"],
  // Entertainment
  ["netflix.com", "Entertainment"],
  ["twitch.tv", "Entertainment"],
  ["spotify.com", "Entertainment"],
  ["imdb.com", "Entertainment"],
  // Shopping
  ["amazon.com", "Shopping"],
  ["ebay.com", "Shopping"],
  ["etsy.com", "Shopping"],
  ["aliexpress.com", "Shopping"],
  // Finance
  ["coinbase.com", "Finance"],
  ["binance.com", "Finance"],
  ["tradingview.com", "Finance"],
  ["bloomberg.com", "Finance"],
  // Travel
  ["booking.com", "Travel"],
  ["airbnb.com", "Travel"],
  ["tripadvisor.com", "Travel"],
  ["skyscanner.net", "Travel"],
  // Health
  ["who.int", "Health"],
  ["mayoclinic.org", "Health"],
  ["healthline.com", "Health"],
  // Product & Business
  ["producthunt.com", "Product & Business"],
  ["notion.so", "Product & Business"],
  ["atlassian.net", "Product & Business"],
  ["trello.com", "Product & Business"]
];
var AMBIGUOUS_DOMAINS = /* @__PURE__ */ new Set([
  // Platforms, not subjects. A LangGraph course and a music video are both
  // youtube.com; r/StableDiffusion and r/cooking are both reddit.com. Filing
  // by host puts a machine-learning tutorial in "Entertainment", which is not
  // a small inaccuracy — it is the product actively making someone's
  // bookmarks worse, confidently, in bulk.
  "youtube.com",
  "youtu.be",
  "reddit.com",
  "x.com",
  "twitter.com",
  "medium.com",
  "substack.com",
  "dev.to",
  "hashnode.dev",
  "blogspot.com",
  "wordpress.com",
  "tumblr.com",
  "google.com",
  "docs.google.com",
  "drive.google.com",
  "dropbox.com",
  "pinterest.com",
  "quora.com",
  "wikipedia.org"
]);
var PATH_RULES = [
  [/^\/questions\//, "Development", "a question thread"],
  [/^\/(docs|documentation|reference|api)(\/|$)/, "Documentation & Reference", "a docs path"],
  [/^\/(blog|posts?|articles?)(\/|$)/, "News & Articles", "an article path"],
  [/^\/(jobs?|careers?)(\/|$)/, "Career & Jobs", "a careers path"],
  [/^\/(pricing|checkout|cart)(\/|$)/, "Shopping", "a commerce path"]
];
function matchDomain(host) {
  for (const [domain, category] of DOMAIN_RULES) {
    if (host === domain || host.endsWith(`.${domain}`)) return category;
  }
  return null;
}
function isAmbiguous(host) {
  for (const domain of AMBIGUOUS_DOMAINS) {
    if (host === domain || host.endsWith(`.${domain}`)) return true;
  }
  return false;
}
function classifyByRule(bookmark) {
  const parts = parseUrl(bookmark.url);
  if (parts.host === "") return null;
  const host = parts.domain;
  if (isAmbiguous(host)) return null;
  const byDomain = matchDomain(host);
  if (byDomain) {
    return {
      category: byDomain,
      confidence: RULE_CONFIDENCE_DOMAIN,
      source: "rule",
      rationale: `${host} is a ${byDomain.toLowerCase()} site`
    };
  }
  let pathname = "";
  try {
    pathname = new URL(parts.canonical).pathname;
  } catch {
    return null;
  }
  for (const [pattern, category, why] of PATH_RULES) {
    if (pattern.test(pathname)) {
      return {
        category,
        confidence: RULE_CONFIDENCE_PATH,
        source: "rule",
        rationale: `${host} on ${why}`
      };
    }
  }
  return null;
}
function runRulePass(bookmarks) {
  const classified = [];
  const unresolved = [];
  for (const bookmark of bookmarks) {
    const classification = classifyByRule(bookmark);
    if (classification && classification.confidence >= RULE_CONFIDENCE_FLOOR) {
      classified.push({ id: bookmark.id, classification });
    } else {
      unresolved.push(bookmark);
    }
  }
  return { classified, unresolved };
}

// src/classify/cluster.ts
var STOP_WORDS = /* @__PURE__ */ new Set([
  "how",
  "what",
  "why",
  "when",
  "where",
  "who",
  "which",
  "guide",
  "tutorial",
  "introduction",
  "intro",
  "getting",
  "started",
  "start",
  "learn",
  "learning",
  "best",
  "top",
  "ultimate",
  "complete",
  "beginners",
  "beginner",
  "advanced",
  "part",
  "using",
  "use",
  "build",
  "building",
  "create",
  "creating",
  "make",
  "making",
  "understand",
  "understanding",
  "example",
  "examples",
  "tips",
  "tricks",
  "guide",
  "overview",
  "about",
  "home",
  "page",
  "index",
  "welcome",
  "blog",
  "post",
  "article",
  "news",
  "docs",
  "doc",
  "documentation",
  "reference",
  "api",
  "github",
  "com",
  "www",
  "org",
  "net",
  "io",
  "the",
  "and",
  "or",
  "a",
  "an",
  "of",
  "for",
  "to",
  "in",
  "on",
  "with",
  "your",
  "you",
  "my",
  "is",
  "are",
  "it",
  "this",
  "that",
  "from",
  "by",
  "at",
  "as",
  "be"
]);
var DEFAULTS = {
  // Spec §6.2: a new category needs at least five members. A folder of two is
  // the sprawl the cleanup report complains about, so creating one here would
  // be the product arguing with itself.
  minClusterSize: 5,
  // A token has to describe a real share of the group, or the group is a
  // coincidence rather than a topic.
  minCoverage: 0.6,
  maxClusters: 12
};
function tokensOf(bookmark) {
  const parts = parseUrl(bookmark.url);
  const fromTitle = bookmark.title.toLowerCase().split(/[^a-z0-9+#]+/i).filter(Boolean);
  const tokens = /* @__PURE__ */ new Set();
  for (const token of [...fromTitle, ...parts.pathTokens]) {
    if (token.length < 3 || /^\d+$/.test(token)) continue;
    if (STOP_WORDS.has(token)) continue;
    tokens.add(token);
  }
  const host = parts.domain.split(".")[0];
  if (host) tokens.delete(host);
  return tokens;
}
function asFolderName(token) {
  return token.charAt(0).toUpperCase() + token.slice(1);
}
function clusterByTitle(bookmarks, options = {}) {
  const settings = { ...DEFAULTS, ...options };
  if (bookmarks.length < settings.minClusterSize) return [];
  const tokensById = /* @__PURE__ */ new Map();
  const documentFrequency = /* @__PURE__ */ new Map();
  for (const bookmark of bookmarks) {
    const tokens = tokensOf(bookmark);
    tokensById.set(bookmark.id, tokens);
    for (const token of tokens) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const total = bookmarks.length;
  const candidates = [];
  for (const [token, frequency] of documentFrequency) {
    if (frequency < settings.minClusterSize) continue;
    if (frequency / total > 0.5) continue;
    const ids = bookmarks.filter((b) => tokensById.get(b.id)?.has(token)).map((b) => b.id);
    const idf = Math.log(total / frequency);
    candidates.push({ token, ids, score: ids.length * idf });
  }
  candidates.sort((a, b) => b.score - a.score);
  const claimed = /* @__PURE__ */ new Set();
  const clusters = [];
  for (const candidate of candidates) {
    if (clusters.length >= settings.maxClusters) break;
    const available = candidate.ids.filter((id) => !claimed.has(id));
    if (available.length < settings.minClusterSize) continue;
    if (available.length / candidate.ids.length < settings.minCoverage) continue;
    for (const id of available) claimed.add(id);
    clusters.push({
      name: asFolderName(candidate.token),
      token: candidate.token,
      bookmarkIds: available,
      // Deliberately capped below the rule pass's floor: a shared word is
      // weaker evidence than a known domain, and the review queue sorts by
      // confidence so these should be read first.
      confidence: Math.min(0.75, 0.4 + available.length / (total * 2)),
      rationale: `${available.length} bookmarks mention "${candidate.token}"`
    });
  }
  return clusters;
}

export { CLIENT_HEADER, IMPORT_BATCH_SIZE, MAX_CHANGES_PER_FLUSH, MAX_MANIFEST_IDS, MAX_TELEMETRY_EVENTS, MIN_SUPPORTED_PROTOCOL, PROTOCOL_HEADER, PROTOCOL_VERSION, RULE_CONFIDENCE_DOMAIN, RULE_CONFIDENCE_FLOOR, RULE_CONFIDENCE_PATH, apiErrorSchema, bookmarkStatusSchema, buildCleanupReport, canonicalizeUrl, classifyByRule, clientKindSchema, clusterByTitle, contentStateSchema, editDistance, epochMsSchema, flatNodeSchema, flattenTree, folderOriginSchema, isProtocolSupported, isUntitled, isVagueTitle, isoDateTimeSchema, jsonObjectSchema, keySourceSchema, meResponseSchema, mutationOpKindSchema, mutationOpResultSchema, mutationOpSchema, mutationPlanAckSchema, mutationPlanSchema, normalizeFolderName, parseUrl, pathTokens, planSchema, proposalBulkApproveRequestSchema, proposalDecisionResponseSchema, proposalItemOpSchema, proposalItemSchema, proposalKindSchema, proposalSchema, proposalStatusSchema, quotaStateSchema, runRulePass, sha256Hex, stripSubdomain, syncChangeSchema, syncChangesRequestSchema, syncChangesResponseSchema, syncDiffResponseSchema, syncImportRequestSchema, syncImportResponseSchema, syncOpKindSchema, syncRejectionSchema, telemetryBatchSchema, telemetryClientSchema, telemetryEventNameSchema, telemetryEventNames, telemetryEventSchema, telemetryIngestResponseSchema, telemetryLabelValues, telemetryMeasures, titleEqualsUrl, treeHash, treeSize, urlHash, uuidSchema };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map