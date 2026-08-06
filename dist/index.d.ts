import { z } from 'zod';

/** UUID v4, string-encoded. Server-generated. */
type Uuid = string;
/** ISO-8601 timestamp, e.g. `2026-08-06T12:00:00.000Z`. */
type IsoDateTime = string;
/** Milliseconds since epoch. Browser APIs hand us these, so they stay numeric. */
type EpochMs = number;
type Plan = 'free' | 'pro';
/** Which credential paid for an AI call. Drives the usage ledger. */
type KeySource = 'platform' | 'byok';
/** Which client is talking to the API. Sent alongside the protocol version. */
type ClientKind = 'extension' | 'web';
interface Paginated<T> {
    items: T[];
    total: number;
    limit: number;
    offset: number;
}

type BookmarkStatus = 'active' | 'dead' | 'archived' | 'deleted';
/** How far up the enrichment tiers a bookmark has climbed. */
type ContentState = 'pending' | 'client' | 'scraped' | 'failed';
/** Who created a folder. `sqishy` folders are safe to merge away; `user` ones are not. */
type FolderOrigin = 'user' | 'sqishy';
/**
 * A node exactly as the browser hands it to us
 * (`chrome.bookmarks.BookmarkTreeNode` / `browser.bookmarks.BookmarkTreeNode`),
 * minus the fields we never read.
 */
interface BrowserNode {
    id: string;
    parentId?: string;
    title: string;
    url?: string;
    dateAdded?: EpochMs;
    dateGroupModified?: EpochMs;
    index?: number;
    children?: BrowserNode[];
}
/** A browser node after `flattenTree`: depth resolved, parents normalised to `null` at the root. */
interface FlatNode {
    id: string;
    parentId: string | null;
    title: string;
    /** `null` marks a folder. */
    url: string | null;
    dateAdded: EpochMs | null;
    depth: number;
    index: number;
}
interface Folder {
    id: Uuid;
    userId: Uuid;
    chromeId: string;
    parentId: Uuid | null;
    title: string;
    /** Materialised path, e.g. `/Dev/Frontend/React`. */
    path: string;
    origin: FolderOrigin;
    createdAt: IsoDateTime;
    updatedAt: IsoDateTime;
}
interface Bookmark {
    id: Uuid;
    userId: Uuid;
    chromeId: string;
    folderId: Uuid | null;
    url: string;
    /** sha256 of `urlCanonical`. Cross-device identity key. */
    urlHash: string;
    urlCanonical: string;
    title: string;
    dateAdded: IsoDateTime;
    status: BookmarkStatus;
    contentState: ContentState;
    lastCheckedAt: IsoDateTime | null;
    createdAt: IsoDateTime;
    updatedAt: IsoDateTime;
}
interface UrlParts {
    /** Original input, untouched. */
    original: string;
    /** Normalised form used for dedupe and hashing. */
    canonical: string;
    /** sha256 hex of `canonical`. */
    hash: string;
    host: string;
    /** Registrable-ish domain with `www.`/`m.` stripped. Used by the rule-based classifier. */
    domain: string;
    pathTokens: string[];
}

type SyncOpKind = 'create' | 'update' | 'move' | 'remove' | 'reorder';
/**
 * One browser bookmark event, recorded locally before it is ever sent.
 * `localSeq` is monotonic per device and is the idempotency key server-side:
 * `(userId, deviceId, localSeq)` is applied at most once.
 */
interface SyncChange {
    localSeq: number;
    kind: SyncOpKind;
    chromeId: string;
    parentId: string | null;
    index: number | null;
    title: string | null;
    url: string | null;
    dateAdded: EpochMs | null;
    occurredAt: EpochMs;
}
interface SyncImportRequest {
    deviceId: Uuid | null;
    deviceLabel: string;
    batchIndex: number;
    batchCount: number;
    nodes: FlatNode[];
}
interface SyncImportResponse {
    deviceId: Uuid;
    accepted: number;
    deduped: number;
    cursor: number;
}
interface SyncChangesRequest {
    deviceId: Uuid;
    cursor: number;
    changes: SyncChange[];
}
interface SyncRejection {
    localSeq: number;
    reason: string;
}
interface SyncChangesResponse {
    cursor: number;
    applied: number;
    rejected: SyncRejection[];
    /** Plans approved elsewhere (e.g. the web app) that this device must now execute. */
    plans: MutationPlan[];
}
type MutationOpKind = 'move' | 'rename' | 'create_folder' | 'remove';
/**
 * A single browser write. The server never touches the bookmark tree —
 * it emits these and the extension executes them.
 */
interface MutationOp {
    opId: Uuid;
    kind: MutationOpKind;
    /** `null` for `create_folder`, which has no node yet. */
    chromeId: string | null;
    targetParentChromeId: string | null;
    index: number | null;
    title: string | null;
}
interface MutationPlan {
    planId: Uuid;
    proposalId: Uuid;
    createdAt: IsoDateTime;
    ops: MutationOp[];
}
interface MutationOpResult {
    opId: Uuid;
    ok: boolean;
    error?: string;
    /** Set when the op created a node, so the server can map it back. */
    newChromeId?: string;
}
interface MutationPlanAck {
    planId: Uuid;
    results: MutationOpResult[];
}
/** Server tree fingerprint vs a fresh `getTree()` — the drift check. */
interface SyncDiffResponse {
    serverTreeHash: string;
    serverNodeCount: number;
    cursor: number;
}

type ProposalKind = 'categorize' | 'dedupe' | 'merge_folder' | 'dead_link';
type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'expired';
type ProposalItemOp = 'move' | 'rename' | 'delete' | 'create_folder' | 'merge';
interface ProposalItem {
    id: Uuid;
    proposalId: Uuid;
    bookmarkId: Uuid | null;
    folderId: Uuid | null;
    op: ProposalItemOp;
    /** Inverse payload — replayed to undo. */
    before: Record<string, unknown>;
    after: Record<string, unknown>;
}
interface Proposal {
    id: Uuid;
    userId: Uuid;
    kind: ProposalKind;
    status: ProposalStatus;
    confidence: number;
    /** Short human-readable "why". Shown verbatim in the review queue. */
    rationale: string;
    /** Groups everything produced by one cleanup run. */
    batchId: Uuid;
    itemCount: number;
    createdAt: IsoDateTime;
    items?: ProposalItem[];
}
interface AppliedChange {
    id: Uuid;
    userId: Uuid;
    proposalId: Uuid;
    appliedAt: IsoDateTime;
    inversePlan: Record<string, unknown>;
    undoneAt: IsoDateTime | null;
}
interface ProposalBulkApproveRequest {
    proposalIds: Uuid[];
    /** Optional per-proposal destination override from "Edit destination". */
    overrides?: Record<Uuid, string>;
}
interface ProposalDecisionResponse {
    approved: number;
    rejected: number;
    planIds: Uuid[];
}

/** One `chrome.history` datum. Optional — the permission is requested in-context, not at install. */
interface HistoryStat {
    url: string;
    visitCount: number;
    lastVisitAt: EpochMs | null;
}
interface ReportInput {
    nodes: FlatNode[];
    history?: HistoryStat[];
    /** Injectable clock so report snapshots are deterministic in tests. */
    now?: EpochMs;
}
interface DuplicateGroup {
    /** `urlHash` for canonical groups, the raw URL for exact groups. */
    key: string;
    kind: 'exact' | 'canonical';
    url: string;
    nodeIds: string[];
    /** Earliest `dateAdded` wins; ties break on the longest title. */
    keepNodeId: string;
    count: number;
}
interface FolderSummary {
    id: string;
    title: string;
    path: string;
    depth: number;
    bookmarkCount: number;
    childFolderCount: number;
}
interface SimilarFolderGroup {
    /** Shared normalised name, e.g. `js` for `JS` / `Javascript` / `JS Stuff`. */
    normalized: string;
    folders: FolderSummary[];
}
interface TitleSample {
    id: string;
    title: string;
    url: string;
}
interface ReportTotals {
    bookmarks: number;
    folders: number;
    maxDepth: number;
    /** Bookmarks sitting loose at the root — the classic dumping ground. */
    topLevelBookmarks: number;
    averageFolderSize: number;
}
interface ReportDuplicates {
    exactGroups: DuplicateGroup[];
    canonicalGroups: DuplicateGroup[];
    exactCount: number;
    canonicalCount: number;
    /** How many entries would disappear if every group collapsed to one. */
    wastedEntries: number;
}
interface ReportFolders {
    total: number;
    empty: FolderSummary[];
    singleItem: FolderSummary[];
    deeplyNested: FolderSummary[];
    similarNames: SimilarFolderGroup[];
    dumpingGround: FolderSummary | null;
}
interface ReportNaming {
    untitled: number;
    vague: number;
    titleEqualsUrl: number;
    samples: TitleSample[];
}
interface ReportAge {
    oldestAddedAt: EpochMs | null;
    newestAddedAt: EpochMs | null;
    olderThan1Year: number;
    olderThan3Years: number;
    olderThan5Years: number;
    undated: number;
}
interface ReportEngagement {
    /** False when the `history` permission was declined — the section degrades, the report still ships. */
    historyAvailable: boolean;
    neverRevisited: number;
    notVisitedIn1Year: number;
}
/**
 * The first-run hook. Built entirely from free signals, computed in the
 * extension, and never sent to the server before sign-in.
 */
interface CleanupReport {
    generatedAt: EpochMs;
    protocolVersion: number;
    totals: ReportTotals;
    duplicates: ReportDuplicates;
    folders: ReportFolders;
    naming: ReportNaming;
    age: ReportAge;
    engagement: ReportEngagement;
    /** The number behind the "Fix N issues" CTA. */
    issueCount: number;
}

interface QuotaState {
    /** Month bucket, `YYYY-MM-01`. */
    period: string;
    limit: number;
    used: number;
    remaining: number;
    /** `byok` users are unmetered; the UI says so explicitly. */
    keySource: KeySource;
}
interface MeResponse {
    userId: Uuid;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    plan: Plan;
    byokEnabled: boolean;
    quota: QuotaState;
}
interface AuthGoogleRequest {
    /** Google-issued `id_token`; verified server-side, never trusted as-is. */
    idToken: string;
    client: ClientKind;
    deviceLabel?: string;
}
interface AuthTokens {
    accessToken: string;
    /** Rotating. Stored hashed server-side; the plaintext is shown exactly once. */
    refreshToken: string;
    /** Access-token lifetime in seconds. */
    expiresIn: number;
}
interface AuthResponse {
    tokens: AuthTokens;
    user: MeResponse;
}
interface RefreshRequest {
    refreshToken: string;
}
interface ApiError {
    statusCode: number;
    error: string;
    message: string;
    /** Present on 426 so the client can tell the user exactly what to update. */
    minProtocolVersion?: number;
}

/** Regex rather than `z.uuid()` so the schema behaves identically across zod minors. */
declare const uuidSchema: z.ZodString;
declare const isoDateTimeSchema: z.ZodString;
declare const epochMsSchema: z.ZodNumber;
declare const planSchema: z.ZodEnum<{
    free: "free";
    pro: "pro";
}>;
declare const keySourceSchema: z.ZodEnum<{
    platform: "platform";
    byok: "byok";
}>;
declare const clientKindSchema: z.ZodEnum<{
    extension: "extension";
    web: "web";
}>;
declare const jsonObjectSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;

declare const bookmarkStatusSchema: z.ZodEnum<{
    active: "active";
    dead: "dead";
    archived: "archived";
    deleted: "deleted";
}>;
declare const contentStateSchema: z.ZodEnum<{
    pending: "pending";
    client: "client";
    scraped: "scraped";
    failed: "failed";
}>;
declare const folderOriginSchema: z.ZodEnum<{
    user: "user";
    sqishy: "sqishy";
}>;
/**
 * The unit of the sync payload. Titles are capped because browsers do not cap
 * them and a hostile page can set a multi-megabyte one.
 */
declare const flatNodeSchema: z.ZodObject<{
    id: z.ZodString;
    parentId: z.ZodNullable<z.ZodString>;
    title: z.ZodString;
    url: z.ZodNullable<z.ZodString>;
    dateAdded: z.ZodNullable<z.ZodNumber>;
    depth: z.ZodNumber;
    index: z.ZodNumber;
}, z.core.$strip>;

declare const IMPORT_BATCH_SIZE = 500;
declare const MAX_CHANGES_PER_FLUSH = 1000;
declare const syncOpKindSchema: z.ZodEnum<{
    create: "create";
    update: "update";
    move: "move";
    remove: "remove";
    reorder: "reorder";
}>;
declare const syncChangeSchema: z.ZodObject<{
    localSeq: z.ZodNumber;
    kind: z.ZodEnum<{
        create: "create";
        update: "update";
        move: "move";
        remove: "remove";
        reorder: "reorder";
    }>;
    chromeId: z.ZodString;
    parentId: z.ZodNullable<z.ZodString>;
    index: z.ZodNullable<z.ZodNumber>;
    title: z.ZodNullable<z.ZodString>;
    url: z.ZodNullable<z.ZodString>;
    dateAdded: z.ZodNullable<z.ZodNumber>;
    occurredAt: z.ZodNumber;
}, z.core.$strip>;
declare const syncImportRequestSchema: z.ZodObject<{
    deviceId: z.ZodNullable<z.ZodString>;
    deviceLabel: z.ZodString;
    batchIndex: z.ZodNumber;
    batchCount: z.ZodNumber;
    nodes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        parentId: z.ZodNullable<z.ZodString>;
        title: z.ZodString;
        url: z.ZodNullable<z.ZodString>;
        dateAdded: z.ZodNullable<z.ZodNumber>;
        depth: z.ZodNumber;
        index: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
declare const syncImportResponseSchema: z.ZodObject<{
    deviceId: z.ZodString;
    accepted: z.ZodNumber;
    deduped: z.ZodNumber;
    cursor: z.ZodNumber;
}, z.core.$strip>;
declare const syncChangesRequestSchema: z.ZodObject<{
    deviceId: z.ZodString;
    cursor: z.ZodNumber;
    changes: z.ZodArray<z.ZodObject<{
        localSeq: z.ZodNumber;
        kind: z.ZodEnum<{
            create: "create";
            update: "update";
            move: "move";
            remove: "remove";
            reorder: "reorder";
        }>;
        chromeId: z.ZodString;
        parentId: z.ZodNullable<z.ZodString>;
        index: z.ZodNullable<z.ZodNumber>;
        title: z.ZodNullable<z.ZodString>;
        url: z.ZodNullable<z.ZodString>;
        dateAdded: z.ZodNullable<z.ZodNumber>;
        occurredAt: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
declare const syncRejectionSchema: z.ZodObject<{
    localSeq: z.ZodNumber;
    reason: z.ZodString;
}, z.core.$strip>;
declare const mutationOpKindSchema: z.ZodEnum<{
    move: "move";
    remove: "remove";
    rename: "rename";
    create_folder: "create_folder";
}>;
declare const mutationOpSchema: z.ZodObject<{
    opId: z.ZodString;
    kind: z.ZodEnum<{
        move: "move";
        remove: "remove";
        rename: "rename";
        create_folder: "create_folder";
    }>;
    chromeId: z.ZodNullable<z.ZodString>;
    targetParentChromeId: z.ZodNullable<z.ZodString>;
    index: z.ZodNullable<z.ZodNumber>;
    title: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
declare const mutationPlanSchema: z.ZodObject<{
    planId: z.ZodString;
    proposalId: z.ZodString;
    createdAt: z.ZodString;
    ops: z.ZodArray<z.ZodObject<{
        opId: z.ZodString;
        kind: z.ZodEnum<{
            move: "move";
            remove: "remove";
            rename: "rename";
            create_folder: "create_folder";
        }>;
        chromeId: z.ZodNullable<z.ZodString>;
        targetParentChromeId: z.ZodNullable<z.ZodString>;
        index: z.ZodNullable<z.ZodNumber>;
        title: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
declare const syncChangesResponseSchema: z.ZodObject<{
    cursor: z.ZodNumber;
    applied: z.ZodNumber;
    rejected: z.ZodArray<z.ZodObject<{
        localSeq: z.ZodNumber;
        reason: z.ZodString;
    }, z.core.$strip>>;
    plans: z.ZodArray<z.ZodObject<{
        planId: z.ZodString;
        proposalId: z.ZodString;
        createdAt: z.ZodString;
        ops: z.ZodArray<z.ZodObject<{
            opId: z.ZodString;
            kind: z.ZodEnum<{
                move: "move";
                remove: "remove";
                rename: "rename";
                create_folder: "create_folder";
            }>;
            chromeId: z.ZodNullable<z.ZodString>;
            targetParentChromeId: z.ZodNullable<z.ZodString>;
            index: z.ZodNullable<z.ZodNumber>;
            title: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
declare const mutationOpResultSchema: z.ZodObject<{
    opId: z.ZodString;
    ok: z.ZodBoolean;
    error: z.ZodOptional<z.ZodString>;
    newChromeId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const mutationPlanAckSchema: z.ZodObject<{
    planId: z.ZodString;
    results: z.ZodArray<z.ZodObject<{
        opId: z.ZodString;
        ok: z.ZodBoolean;
        error: z.ZodOptional<z.ZodString>;
        newChromeId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
declare const syncDiffResponseSchema: z.ZodObject<{
    serverTreeHash: z.ZodString;
    serverNodeCount: z.ZodNumber;
    cursor: z.ZodNumber;
}, z.core.$strip>;

declare const quotaStateSchema: z.ZodObject<{
    period: z.ZodString;
    limit: z.ZodNumber;
    used: z.ZodNumber;
    remaining: z.ZodNumber;
    keySource: z.ZodEnum<{
        platform: "platform";
        byok: "byok";
    }>;
}, z.core.$strip>;
declare const meResponseSchema: z.ZodObject<{
    userId: z.ZodString;
    email: z.ZodString;
    displayName: z.ZodNullable<z.ZodString>;
    avatarUrl: z.ZodNullable<z.ZodString>;
    plan: z.ZodEnum<{
        free: "free";
        pro: "pro";
    }>;
    byokEnabled: z.ZodBoolean;
    quota: z.ZodObject<{
        period: z.ZodString;
        limit: z.ZodNumber;
        used: z.ZodNumber;
        remaining: z.ZodNumber;
        keySource: z.ZodEnum<{
            platform: "platform";
            byok: "byok";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>;
declare const authGoogleRequestSchema: z.ZodObject<{
    idToken: z.ZodString;
    client: z.ZodEnum<{
        extension: "extension";
        web: "web";
    }>;
    deviceLabel: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const authTokensSchema: z.ZodObject<{
    accessToken: z.ZodString;
    refreshToken: z.ZodString;
    expiresIn: z.ZodNumber;
}, z.core.$strip>;
declare const authResponseSchema: z.ZodObject<{
    tokens: z.ZodObject<{
        accessToken: z.ZodString;
        refreshToken: z.ZodString;
        expiresIn: z.ZodNumber;
    }, z.core.$strip>;
    user: z.ZodObject<{
        userId: z.ZodString;
        email: z.ZodString;
        displayName: z.ZodNullable<z.ZodString>;
        avatarUrl: z.ZodNullable<z.ZodString>;
        plan: z.ZodEnum<{
            free: "free";
            pro: "pro";
        }>;
        byokEnabled: z.ZodBoolean;
        quota: z.ZodObject<{
            period: z.ZodString;
            limit: z.ZodNumber;
            used: z.ZodNumber;
            remaining: z.ZodNumber;
            keySource: z.ZodEnum<{
                platform: "platform";
                byok: "byok";
            }>;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>;
declare const refreshRequestSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, z.core.$strip>;
declare const apiErrorSchema: z.ZodObject<{
    statusCode: z.ZodNumber;
    error: z.ZodString;
    message: z.ZodString;
    minProtocolVersion: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;

declare const proposalKindSchema: z.ZodEnum<{
    categorize: "categorize";
    dedupe: "dedupe";
    merge_folder: "merge_folder";
    dead_link: "dead_link";
}>;
declare const proposalStatusSchema: z.ZodEnum<{
    pending: "pending";
    approved: "approved";
    rejected: "rejected";
    applied: "applied";
    expired: "expired";
}>;
declare const proposalItemOpSchema: z.ZodEnum<{
    move: "move";
    rename: "rename";
    create_folder: "create_folder";
    delete: "delete";
    merge: "merge";
}>;
declare const proposalItemSchema: z.ZodObject<{
    id: z.ZodString;
    proposalId: z.ZodString;
    bookmarkId: z.ZodNullable<z.ZodString>;
    folderId: z.ZodNullable<z.ZodString>;
    op: z.ZodEnum<{
        move: "move";
        rename: "rename";
        create_folder: "create_folder";
        delete: "delete";
        merge: "merge";
    }>;
    before: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    after: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
declare const proposalSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    kind: z.ZodEnum<{
        categorize: "categorize";
        dedupe: "dedupe";
        merge_folder: "merge_folder";
        dead_link: "dead_link";
    }>;
    status: z.ZodEnum<{
        pending: "pending";
        approved: "approved";
        rejected: "rejected";
        applied: "applied";
        expired: "expired";
    }>;
    confidence: z.ZodNumber;
    rationale: z.ZodString;
    batchId: z.ZodString;
    itemCount: z.ZodNumber;
    createdAt: z.ZodString;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        proposalId: z.ZodString;
        bookmarkId: z.ZodNullable<z.ZodString>;
        folderId: z.ZodNullable<z.ZodString>;
        op: z.ZodEnum<{
            move: "move";
            rename: "rename";
            create_folder: "create_folder";
            delete: "delete";
            merge: "merge";
        }>;
        before: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        after: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
declare const proposalBulkApproveRequestSchema: z.ZodObject<{
    proposalIds: z.ZodArray<z.ZodString>;
    overrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
declare const proposalDecisionResponseSchema: z.ZodObject<{
    approved: z.ZodNumber;
    rejected: z.ZodNumber;
    planIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;

/**
 * Self-contained SHA-256.
 *
 * This is the identity function for the whole product: `urlHash` decides
 * dedupe and cross-device bookmark identity. The extension and the API must
 * agree byte for byte, forever. A hand-owned implementation with published
 * test vectors is cheaper to guarantee than a transitive dependency that can
 * change export paths or behaviour under us, and it keeps the extension
 * bundle free of a crypto package.
 */
declare function sha256Hex(input: string): string;

declare function stripSubdomain(hostname: string): string;
/**
 * Normalised form used for dedupe and hashing.
 *
 * - `http` is folded into `https` (the same page, not two bookmarks)
 * - `www.` / `m.` / `mobile.` stripped, host lowercased, default port dropped
 * - fragment dropped, tracking params dropped, remaining params sorted
 * - trailing slash dropped
 *
 * Non-HTTP URLs (`chrome://`, `file://`, `javascript:`) are returned trimmed
 * and otherwise untouched — normalising them has no meaning.
 */
declare function canonicalizeUrl(raw: string): string;
/** sha256 of the canonical form. The cross-device identity key. */
declare function urlHash(raw: string): string;
/** Path segments split on `/`, `-` and `_` — the cheap signal the rule-based classifier reads. */
declare function pathTokens(pathname: string): string[];
declare function parseUrl(raw: string): UrlParts;

declare function flattenTree(nodes: BrowserNode[], unwrap?: boolean): FlatNode[];

/**
 * The first-run cleanup report. Pure: no I/O, no `chrome.*`, no network.
 * Runs in the extension before sign-in, and server-side later for the web app.
 */
declare function buildCleanupReport(input: ReportInput): CleanupReport;

/**
 * Collapses a folder name to a comparison key: lowercase, punctuation removed,
 * filler dropped, aliases applied, tokens sorted so word order stops mattering.
 */
declare function normalizeFolderName(title: string): string;
declare function isUntitled(title: string): boolean;
declare function isVagueTitle(title: string, url: string): boolean;
declare function titleEqualsUrl(title: string, url: string): boolean;
/** Bounded Levenshtein — returns `max + 1` as soon as it is certain the distance exceeds `max`. */
declare function editDistance(a: string, b: string, max?: number): number;

/**
 * Wire protocol version.
 *
 * Extension users sit on stale builds for weeks, so the version travels in a
 * header on every request and the API refuses anything below its floor with
 * `426 Upgrade Required`. Bump this on any breaking change to the sync or
 * proposal contracts, and tag the package major at the same time.
 */
declare const PROTOCOL_VERSION = 1;
/** Oldest client version the API still serves. Keep N-1 alive for one extension release cycle. */
declare const MIN_SUPPORTED_PROTOCOL = 1;
declare const PROTOCOL_HEADER = "x-squishy-protocol";
declare const CLIENT_HEADER = "x-squishy-client";
declare function isProtocolSupported(version: number): boolean;

export { type ApiError, type AppliedChange, type AuthGoogleRequest, type AuthResponse, type AuthTokens, type Bookmark, type BookmarkStatus, type BrowserNode, CLIENT_HEADER, type CleanupReport, type ClientKind, type ContentState, type DuplicateGroup, type EpochMs, type FlatNode, type Folder, type FolderOrigin, type FolderSummary, type HistoryStat, IMPORT_BATCH_SIZE, type IsoDateTime, type KeySource, MAX_CHANGES_PER_FLUSH, MIN_SUPPORTED_PROTOCOL, type MeResponse, type MutationOp, type MutationOpKind, type MutationOpResult, type MutationPlan, type MutationPlanAck, PROTOCOL_HEADER, PROTOCOL_VERSION, type Paginated, type Plan, type Proposal, type ProposalBulkApproveRequest, type ProposalDecisionResponse, type ProposalItem, type ProposalItemOp, type ProposalKind, type ProposalStatus, type QuotaState, type RefreshRequest, type ReportAge, type ReportDuplicates, type ReportEngagement, type ReportFolders, type ReportInput, type ReportNaming, type ReportTotals, type SimilarFolderGroup, type SyncChange, type SyncChangesRequest, type SyncChangesResponse, type SyncDiffResponse, type SyncImportRequest, type SyncImportResponse, type SyncOpKind, type SyncRejection, type TitleSample, type UrlParts, type Uuid, apiErrorSchema, authGoogleRequestSchema, authResponseSchema, authTokensSchema, bookmarkStatusSchema, buildCleanupReport, canonicalizeUrl, clientKindSchema, contentStateSchema, editDistance, epochMsSchema, flatNodeSchema, flattenTree, folderOriginSchema, isProtocolSupported, isUntitled, isVagueTitle, isoDateTimeSchema, jsonObjectSchema, keySourceSchema, meResponseSchema, mutationOpKindSchema, mutationOpResultSchema, mutationOpSchema, mutationPlanAckSchema, mutationPlanSchema, normalizeFolderName, parseUrl, pathTokens, planSchema, proposalBulkApproveRequestSchema, proposalDecisionResponseSchema, proposalItemOpSchema, proposalItemSchema, proposalKindSchema, proposalSchema, proposalStatusSchema, quotaStateSchema, refreshRequestSchema, sha256Hex, stripSubdomain, syncChangeSchema, syncChangesRequestSchema, syncChangesResponseSchema, syncDiffResponseSchema, syncImportRequestSchema, syncImportResponseSchema, syncOpKindSchema, syncRejectionSchema, titleEqualsUrl, urlHash, uuidSchema };
