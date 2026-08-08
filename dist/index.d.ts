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
    /**
     * Every chrome id in the tree, on the final batch only. Lets a reinstall
     * subtract as well as add — see `syncImportRequestSchema`.
     */
    presentChromeIds?: string[];
}
interface SyncImportResponse {
    deviceId: Uuid;
    accepted: number;
    deduped: number;
    cursor: number;
    /** Rows soft-deleted because the manifest did not list them. */
    pruned?: number;
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
    serverBookmarks: number;
    serverFolders: number;
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
/**
 * The review queue, shaped for display.
 *
 * `Proposal` alone cannot render a diff — it has counts, not the bookmark
 * titles or destinations a user needs to judge the change. This is the read
 * model for that screen, assembled server-side so the client makes one request
 * rather than N+1.
 */
interface ReviewItem {
    proposalId: Uuid;
    bookmarkId: Uuid;
    title: string;
    url: string;
    /** Where it lives now. `null` means loose at the top level. */
    currentFolder: string | null;
    /** Where the proposal would put it. */
    targetCategory: string;
    confidence: number;
    rationale: string;
}
/**
 * Proposals grouped by destination, not by bookmark.
 *
 * Grouping is what makes bulk approval possible: a user judges "these 40 belong
 * in Development" once, rather than answering the same question 40 times.
 */
interface ReviewGroup {
    kind: ProposalKind;
    targetCategory: string;
    /** Mean confidence across the group, for sorting the shakiest to the top. */
    confidence: number;
    items: ReviewItem[];
}
interface ReviewQueueResponse {
    groups: ReviewGroup[];
    total: number;
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
interface ApiError {
    statusCode: number;
    error: string;
    message: string;
    /** Present on 426 so the client can tell the user exactly what to update. */
    minProtocolVersion?: number;
}
/**
 * The web dashboard.
 *
 * Built from the server's mirror using the same `buildCleanupReport` the
 * extension runs locally, so the two never disagree about how many duplicates
 * a user has. The extension's copy works offline and signed out; this one works
 * on any device.
 */
interface DashboardResponse {
    bookmarks: number;
    folders: number;
    maxDepth: number;
    duplicates: number;
    emptyFolders: number;
    singleItemFolders: number;
    untitled: number;
    /** The number behind the "fix these" call to action. */
    issueCount: number;
    /** Proposals waiting in the review queue. */
    pendingProposals: number;
    /** ISO timestamp of the last sync from any device, or null if never. */
    lastSyncAt: string | null;
    deviceCount: number;
}

/**
 * Client telemetry.
 *
 * The extension cannot export to Alloy directly. Alloy requires basic auth, and
 * an extension ships to users' machines — any credential compiled into it is
 * public the moment someone unzips the `.crx`. So events travel to the API,
 * which holds the credential server-side and re-emits them.
 *
 * That makes the ingest endpoint an **unauthenticated write path**, because the
 * activation funnel is mostly pre-sign-in and gating it would measure only the
 * users who already converted. The protection is not authentication but shape:
 * event names and attribute values come from closed sets, and the server drops
 * anything outside them. Nothing a client sends can become a new metric label,
 * so nothing a client sends can inflate cardinality.
 */
type TelemetryEventName = 'popup.opened' | 'report.generated' | 'report.cta_clicked' | 'report.history_permission' | 'extension.installed' | 'extension.updated' | 'sync.imported' | 'sync.flushed' | 'sync.rejected' | 'sync.drift' | 'sync.flush_failed';
/**
 * Attributes allowed to become metric labels.
 *
 * A label whose values come from the client is a cardinality bomb: one attacker
 * sending a million distinct values creates a million time series, and Mimir
 * does not forget them quickly. So every one of these is a small closed set.
 */
type TelemetryLabel = 'size' | 'issues' | 'signedIn' | 'granted' | 'historyAvailable';
/**
 * Numeric attributes recorded as measurements rather than labels.
 *
 * A count belongs in a histogram, never in a label — `duplicates=417` as a
 * label is a unique time series per user.
 */
type TelemetryMeasure = 'durationMs' | 'duplicates' | 'emptyFolders' | 'singleItemFolders' | 'maxDepth' | 'nodes' | 'batches' | 'sent' | 'applied' | 'count' | 'pruned';
type TelemetryClient = 'extension' | 'web';
interface TelemetryEvent {
    name: string;
    /** Counts and buckets only — never a URL, title, or anything user-authored. */
    attributes: Record<string, number | string | boolean>;
    at: EpochMs;
}
interface TelemetryBatch {
    /** Which client sent this. Not a user id — there may not be a user. */
    client: TelemetryClient;
    events: TelemetryEvent[];
}
interface TelemetryIngestResponse {
    /** Events that matched the allowlist and were re-emitted. */
    accepted: number;
    /** Events dropped for an unknown name. Surfaced so drift is visible. */
    dropped: number;
}

/**
 * Categorisation.
 *
 * The preset taxonomy is a seed, not a cage — the LLM may propose a new
 * category, but only when it can justify one (spec §6.2). Keeping the seed
 * here means the rule pass, the prompt and the review queue all name categories
 * identically; three copies of this list would produce three folder trees.
 */
type Category = 'Development' | 'DevOps & Infra' | 'AI & ML' | 'Design & UI' | 'Product & Business' | 'Career & Jobs' | 'Learning & Courses' | 'Documentation & Reference' | 'Tools & Utilities' | 'News & Articles' | 'Research & Papers' | 'Finance' | 'Health' | 'Travel' | 'Shopping' | 'Entertainment' | 'Social & Community' | 'Personal' | 'Unsorted';
/** Where a classification came from. Drives whether it draws quota. */
type ClassificationSource = 'rule' | 'llm';
interface Classification {
    category: Category;
    /** 0–1. The rule pass never returns below `RULE_CONFIDENCE_FLOOR`. */
    confidence: number;
    source: ClassificationSource;
    /** Short human-readable "why", shown verbatim in the review queue. */
    rationale: string;
}
/** What the rule pass needs to decide. Deliberately not a full `FlatNode`. */
interface ClassifiableBookmark {
    id: string;
    url: string;
    title: string;
}
interface RulePassResult {
    /** Confidently classified at zero cost. These never reach an LLM. */
    classified: {
        id: string;
        classification: Classification;
    }[];
    /** Everything the rules would only be guessing at. */
    unresolved: ClassifiableBookmark[];
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
/**
 * Upper bound on the id manifest. Well past any real profile — a 5,000-node
 * tree is about 60 KB of ids — but bounded so a malformed client cannot make
 * the server hold an unbounded array.
 */
declare const MAX_MANIFEST_IDS = 50000;
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
    presentChromeIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
declare const syncImportResponseSchema: z.ZodObject<{
    deviceId: z.ZodString;
    accepted: z.ZodNumber;
    deduped: z.ZodNumber;
    cursor: z.ZodNumber;
    pruned: z.ZodOptional<z.ZodNumber>;
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
    serverBookmarks: z.ZodNumber;
    serverFolders: z.ZodNumber;
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
 * The closed sets behind client telemetry.
 *
 * These are the actual defence on an unauthenticated write path. Validation
 * here decides what can become a metric label, and therefore bounds how many
 * time series a hostile client can create — which is the only attack that
 * matters against a metrics ingest.
 */
/** A batch larger than this is a client bug or an attack. Neither deserves service. */
declare const MAX_TELEMETRY_EVENTS = 200;
declare const telemetryEventNames: readonly ["popup.opened", "report.generated", "report.cta_clicked", "report.history_permission", "extension.installed", "extension.updated", "sync.imported", "sync.flushed", "sync.rejected", "sync.drift", "sync.flush_failed"];
/**
 * Allowed label values, per label.
 *
 * Booleans arrive as real booleans and are stringified server-side; the string
 * forms are listed so the check is one lookup either way.
 */
declare const telemetryLabelValues: {
    readonly size: readonly ["0", "1-99", "100-499", "500-999", "1k-5k", "5k+"];
    readonly issues: readonly ["0", "1-9", "10-49", "50-199", "200+"];
    readonly signedIn: readonly ["true", "false"];
    readonly granted: readonly ["true", "false"];
    readonly historyAvailable: readonly ["true", "false"];
};
declare const telemetryMeasures: readonly ["durationMs", "duplicates", "emptyFolders", "singleItemFolders", "maxDepth", "nodes", "batches", "sent", "applied", "count", "pruned"];
declare const telemetryEventNameSchema: z.ZodEnum<{
    "popup.opened": "popup.opened";
    "report.generated": "report.generated";
    "report.cta_clicked": "report.cta_clicked";
    "report.history_permission": "report.history_permission";
    "extension.installed": "extension.installed";
    "extension.updated": "extension.updated";
    "sync.imported": "sync.imported";
    "sync.flushed": "sync.flushed";
    "sync.rejected": "sync.rejected";
    "sync.drift": "sync.drift";
    "sync.flush_failed": "sync.flush_failed";
}>;
declare const telemetryClientSchema: z.ZodEnum<{
    extension: "extension";
    web: "web";
}>;
/**
 * Note the loose `name`: an unknown event is **dropped, not rejected**.
 *
 * A newer extension emitting an event this API has not heard of must not have
 * its whole batch refused — the other events in it are still true, and users
 * sit on stale builds for weeks in both directions.
 */
declare const telemetryEventSchema: z.ZodObject<{
    name: z.ZodString;
    attributes: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodNumber, z.ZodString, z.ZodBoolean]>>;
    at: z.ZodNumber;
}, z.core.$strip>;
declare const telemetryBatchSchema: z.ZodObject<{
    client: z.ZodEnum<{
        extension: "extension";
        web: "web";
    }>;
    events: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        attributes: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodNumber, z.ZodString, z.ZodBoolean]>>;
        at: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
declare const telemetryIngestResponseSchema: z.ZodObject<{
    accepted: z.ZodNumber;
    dropped: z.ZodNumber;
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
 * Fingerprints a bookmark tree so the extension and the server can compare
 * theirs without shipping the whole thing.
 *
 * This function is the drift check. Both sides must compute it identically, so
 * it lives here rather than being written twice — two implementations that
 * disagree would report drift that does not exist, and the alert on
 * `squishy_mirror_drift_total` would cry wolf until nobody trusted it.
 *
 * What is included is deliberately narrow: identity, position and the fields a
 * user can see. Timestamps are excluded because the server rewrites
 * `updated_at` on every touch, and a hash that changes when nothing the user
 * did changed is worse than no hash.
 *
 * URLs are canonicalised first. The server stores the canonical form, so
 * hashing the raw one here would report drift on every bookmark with a
 * tracking parameter.
 */
declare function treeHash(nodes: FlatNode[]): string;
/**
 * Counts what the hash covers, so a mismatch can say whether the trees differ
 * in size or only in content. "3,000 vs 3,000 but different" and "3,000 vs
 * 2,998" point at very different bugs.
 */
declare function treeSize(nodes: FlatNode[]): {
    bookmarks: number;
    folders: number;
};

/**
 * The deterministic rule pass.
 *
 * Runs before any LLM call and short-circuits the obvious cases at zero cost.
 * `github.com/user/repo` and `stackoverflow.com/questions/…` do not need a
 * language model to classify, and spending one on them is money burned on a
 * problem a lookup table solves.
 *
 * This is also a quota decision, not just a cost one: rule-based results
 * **do not draw down a user's 20 free URLs** (spec §5). So the honest bar for
 * putting a domain in this table is "I would be comfortable showing this
 * classification to the user with no further thought" — a rule that is merely
 * probable belongs in `unresolved`, where the LLM can look at the title too.
 *
 * Pure: no I/O, no `chrome.*`, no network. It runs identically in the
 * extension, the API and the worker.
 */
/**
 * Confidence assigned to a domain match.
 *
 * Not 1.0 — a domain is strong evidence, never proof. `github.com` hosts blogs
 * and `medium.com` hosts engineering posts. Leaving headroom keeps the number
 * meaningful when the LLM later reports its own.
 */
declare const RULE_CONFIDENCE_DOMAIN = 0.9;
/** A path or title match on top of a weaker domain signal. */
declare const RULE_CONFIDENCE_PATH = 0.8;
/** Below this the rule pass declines to answer and defers to the LLM. */
declare const RULE_CONFIDENCE_FLOOR = 0.8;
/**
 * Classifies one bookmark, or declines.
 *
 * Returns `null` rather than guessing. A wrong category that costs nothing is
 * still wrong, and the user sees it in the review queue either way — the rule
 * pass saves money, not trust.
 */
declare function classifyByRule(bookmark: ClassifiableBookmark): Classification | null;
/**
 * Splits a set of bookmarks into "already answered" and "worth paying for".
 *
 * The ratio is the number that decides what categorisation costs. It is worth
 * watching: a corpus where the rules answer 40% is a corpus where the LLM bill
 * is 40% smaller, and the cheapest way to reduce spend is to add a domain here
 * rather than to tune a prompt.
 */
declare function runRulePass(bookmarks: ClassifiableBookmark[]): RulePassResult;

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

export { type ApiError, type AppliedChange, type Bookmark, type BookmarkStatus, type BrowserNode, CLIENT_HEADER, type Category, type ClassifiableBookmark, type Classification, type ClassificationSource, type CleanupReport, type ClientKind, type ContentState, type DashboardResponse, type DuplicateGroup, type EpochMs, type FlatNode, type Folder, type FolderOrigin, type FolderSummary, type HistoryStat, IMPORT_BATCH_SIZE, type IsoDateTime, type KeySource, MAX_CHANGES_PER_FLUSH, MAX_MANIFEST_IDS, MAX_TELEMETRY_EVENTS, MIN_SUPPORTED_PROTOCOL, type MeResponse, type MutationOp, type MutationOpKind, type MutationOpResult, type MutationPlan, type MutationPlanAck, PROTOCOL_HEADER, PROTOCOL_VERSION, type Paginated, type Plan, type Proposal, type ProposalBulkApproveRequest, type ProposalDecisionResponse, type ProposalItem, type ProposalItemOp, type ProposalKind, type ProposalStatus, type QuotaState, RULE_CONFIDENCE_DOMAIN, RULE_CONFIDENCE_FLOOR, RULE_CONFIDENCE_PATH, type ReportAge, type ReportDuplicates, type ReportEngagement, type ReportFolders, type ReportInput, type ReportNaming, type ReportTotals, type ReviewGroup, type ReviewItem, type ReviewQueueResponse, type RulePassResult, type SimilarFolderGroup, type SyncChange, type SyncChangesRequest, type SyncChangesResponse, type SyncDiffResponse, type SyncImportRequest, type SyncImportResponse, type SyncOpKind, type SyncRejection, type TelemetryBatch, type TelemetryClient, type TelemetryEvent, type TelemetryEventName, type TelemetryIngestResponse, type TelemetryLabel, type TelemetryMeasure, type TitleSample, type UrlParts, type Uuid, apiErrorSchema, bookmarkStatusSchema, buildCleanupReport, canonicalizeUrl, classifyByRule, clientKindSchema, contentStateSchema, editDistance, epochMsSchema, flatNodeSchema, flattenTree, folderOriginSchema, isProtocolSupported, isUntitled, isVagueTitle, isoDateTimeSchema, jsonObjectSchema, keySourceSchema, meResponseSchema, mutationOpKindSchema, mutationOpResultSchema, mutationOpSchema, mutationPlanAckSchema, mutationPlanSchema, normalizeFolderName, parseUrl, pathTokens, planSchema, proposalBulkApproveRequestSchema, proposalDecisionResponseSchema, proposalItemOpSchema, proposalItemSchema, proposalKindSchema, proposalSchema, proposalStatusSchema, quotaStateSchema, runRulePass, sha256Hex, stripSubdomain, syncChangeSchema, syncChangesRequestSchema, syncChangesResponseSchema, syncDiffResponseSchema, syncImportRequestSchema, syncImportResponseSchema, syncOpKindSchema, syncRejectionSchema, telemetryBatchSchema, telemetryClientSchema, telemetryEventNameSchema, telemetryEventNames, telemetryEventSchema, telemetryIngestResponseSchema, telemetryLabelValues, telemetryMeasures, titleEqualsUrl, treeHash, treeSize, urlHash, uuidSchema };
