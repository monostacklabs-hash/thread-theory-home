/**
 * Minimal Firestore client over the REST API, shaped like the subset of the
 * firebase-admin Firestore API this app uses, so it runs on Cloudflare Workers.
 *
 * Supported: doc get/set/delete, set with { merge: true } (top-level fields),
 * collection get, single orderBy, subcollections, read-write transactions,
 * FieldValue.serverTimestamp().
 */
import { getProjectId, googleFetch, GoogleApiError } from "@/lib/firebase/google-auth";

const HOST = "https://firestore.googleapis.com/v1";
const MAX_TRANSACTION_ATTEMPTS = 5;

// ---------------------------------------------------------------- values

const SERVER_TIMESTAMP = Symbol.for("tth.firestore.serverTimestamp");

type ServerTimestampSentinel = { readonly __sentinel: typeof SERVER_TIMESTAMP };

export const FieldValue = {
  serverTimestamp(): ServerTimestampSentinel {
    return { __sentinel: SERVER_TIMESTAMP };
  }
};

function isServerTimestamp(value: unknown): value is ServerTimestampSentinel {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { __sentinel?: unknown }).__sentinel === SERVER_TIMESTAMP
  );
}

export class Timestamp {
  constructor(private readonly iso: string) {}

  toDate(): Date {
    return new Date(this.iso);
  }

  toMillis(): number {
    return this.toDate().getTime();
  }
}

export type FirestoreValue = Record<string, unknown>;
export type DocumentData = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function encodeValue(value: unknown): FirestoreValue {
  if (value === null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (value instanceof Timestamp) return { timestampValue: value.toDate().toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((item) => encodeValue(item)) } };
  }
  if (typeof value === "object") {
    return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
  }

  throw new Error(`Unsupported Firestore value: ${typeof value}`);
}

/** Encodes plain fields, skipping undefined and server-timestamp sentinels. */
export function encodeFields(data: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || isServerTimestamp(value)) continue;
    fields[key] = encodeValue(value);
  }
  return fields;
}

export function decodeValue(value: FirestoreValue): unknown {
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return new Timestamp(value.timestampValue as string);
  if ("referenceValue" in value) return value.referenceValue;
  if ("bytesValue" in value) return value.bytesValue;
  if ("geoPointValue" in value) return value.geoPointValue;
  if ("arrayValue" in value) {
    const values = (value.arrayValue as { values?: FirestoreValue[] }).values || [];
    return values.map((item) => decodeValue(item));
  }
  if ("mapValue" in value) {
    return decodeFields((value.mapValue as { fields?: Record<string, FirestoreValue> }).fields);
  }
  return undefined;
}

export function decodeFields(fields: Record<string, FirestoreValue> | undefined): DocumentData {
  const data: DocumentData = {};
  for (const [key, value] of Object.entries(fields || {})) {
    data[key] = decodeValue(value);
  }
  return data;
}

const SIMPLE_FIELD = /^[A-Za-z_][A-Za-z0-9_]*$/;

function fieldPath(name: string) {
  return SIMPLE_FIELD.test(name) ? name : `\`${name.replace(/\\/g, "\\\\").replace(/`/g, "\\`")}\``;
}

type Write = Record<string, unknown>;

/** Builds the REST write for set(data) / set(data, { merge: true }). */
export function buildSetWrite(
  name: string,
  data: Record<string, unknown>,
  options: { merge?: boolean } = {}
): Write {
  const transforms = Object.entries(data)
    .filter(([, value]) => isServerTimestamp(value))
    .map(([key]) => ({ fieldPath: fieldPath(key), setToServerValue: "REQUEST_TIME" }));

  const write: Write = { update: { name, fields: encodeFields(data) } };

  if (options.merge) {
    write.updateMask = {
      fieldPaths: Object.entries(data)
        .filter(([, value]) => value !== undefined && !isServerTimestamp(value))
        .map(([key]) => fieldPath(key))
    };
  }

  if (transforms.length) {
    write.updateTransforms = transforms;
  }

  return write;
}

// ---------------------------------------------------------------- client

type RestDocument = { name: string; fields?: Record<string, FirestoreValue> };

function databasePath() {
  return `projects/${getProjectId()}/databases/(default)`;
}

function documentName(path: string) {
  return `${databasePath()}/documents/${path}`;
}

function documentUrl(path: string) {
  return `${HOST}/${databasePath()}/documents/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function rootUrl(suffix: string) {
  return `${HOST}/${databasePath()}/documents${suffix}`;
}

async function fetchDocument(path: string, transaction?: string): Promise<RestDocument | null> {
  const query = transaction ? `?transaction=${encodeURIComponent(transaction)}` : "";
  try {
    return await googleFetch<RestDocument>(`${documentUrl(path)}${query}`);
  } catch (error) {
    if (error instanceof GoogleApiError && error.httpStatus === 404) {
      return null;
    }
    throw error;
  }
}

async function commit(writes: Write[], transaction?: string) {
  await googleFetch(rootUrl(":commit"), {
    body: transaction ? { writes, transaction } : { writes }
  });
}

export class DocumentSnapshot {
  constructor(
    readonly ref: DocumentReference,
    private readonly document: RestDocument | null
  ) {}

  get id() {
    return this.ref.id;
  }

  get exists() {
    return this.document !== null;
  }

  data(): DocumentData | undefined {
    return this.document ? decodeFields(this.document.fields) : undefined;
  }
}

/** A document returned by a query: it always exists, so data() is defined. */
export class QueryDocumentSnapshot extends DocumentSnapshot {
  constructor(ref: DocumentReference, private readonly found: RestDocument) {
    super(ref, found);
  }

  data(): DocumentData {
    return decodeFields(this.found.fields);
  }
}

export class QuerySnapshot {
  constructor(readonly docs: QueryDocumentSnapshot[]) {}

  get size() {
    return this.docs.length;
  }

  get empty() {
    return this.docs.length === 0;
  }
}

export class DocumentReference {
  constructor(readonly path: string) {}

  get id() {
    return this.path.slice(this.path.lastIndexOf("/") + 1);
  }

  collection(name: string) {
    return new CollectionReference(`${this.path}/${name}`);
  }

  async get() {
    return new DocumentSnapshot(this, await fetchDocument(this.path));
  }

  async set(data: Record<string, unknown>, options: { merge?: boolean } = {}) {
    await commit([buildSetWrite(documentName(this.path), data, options)]);
  }

  async delete() {
    await commit([{ delete: documentName(this.path) }]);
  }
}

class Query {
  constructor(
    protected readonly path: string,
    private readonly order?: { field: string; direction: "ASCENDING" | "DESCENDING" }
  ) {}

  orderBy(field: string, direction: "asc" | "desc" = "asc") {
    return new Query(this.path, {
      field,
      direction: direction === "desc" ? "DESCENDING" : "ASCENDING"
    });
  }

  async get() {
    const separator = this.path.lastIndexOf("/");
    const parent = separator === -1 ? "" : `/${this.path.slice(0, separator)}`;
    const collectionId = this.path.slice(separator + 1);

    const rows = await googleFetch<Array<{ document?: RestDocument }>>(
      `${HOST}/${databasePath()}/documents${parent
        .split("/")
        .map(encodeURIComponent)
        .join("/")}:runQuery`,
      {
        body: {
          structuredQuery: {
            from: [{ collectionId }],
            ...(this.order
              ? { orderBy: [{ field: { fieldPath: fieldPath(this.order.field) }, direction: this.order.direction }] }
              : {})
          }
        }
      }
    );

    const prefix = `${databasePath()}/documents/`;
    const docs = (rows || [])
      .filter((row): row is { document: RestDocument } => Boolean(row.document))
      .map(
        (row) =>
          new QueryDocumentSnapshot(
            new DocumentReference(row.document.name.slice(prefix.length)),
            row.document
          )
      );

    return new QuerySnapshot(docs);
  }
}

export class CollectionReference extends Query {
  constructor(path: string) {
    super(path);
  }

  doc(id: string) {
    return new DocumentReference(`${this.path}/${id}`);
  }
}

export class Transaction {
  readonly writes: Write[] = [];

  constructor(private readonly id: string) {}

  async get(ref: DocumentReference) {
    return new DocumentSnapshot(ref, await fetchDocument(ref.path, this.id));
  }

  set(ref: DocumentReference, data: Record<string, unknown>, options: { merge?: boolean } = {}) {
    this.writes.push(buildSetWrite(documentName(ref.path), data, options));
    return this;
  }

  delete(ref: DocumentReference) {
    this.writes.push({ delete: documentName(ref.path) });
    return this;
  }
}

export class Firestore {
  collection(name: string) {
    return new CollectionReference(name);
  }

  async runTransaction<T>(run: (transaction: Transaction) => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      const { transaction: id } = await googleFetch<{ transaction: string }>(
        rootUrl(":beginTransaction"),
        { body: { options: { readWrite: {} } } }
      );
      const transaction = new Transaction(id);

      let result: T;
      try {
        result = await run(transaction);
      } catch (error) {
        await googleFetch(rootUrl(":rollback"), { body: { transaction: id } }).catch(() => undefined);
        throw error;
      }

      try {
        await commit(transaction.writes, id);
        return result;
      } catch (error) {
        const contended =
          error instanceof GoogleApiError &&
          (error.status === "ABORTED" || error.httpStatus === 409);
        if (!contended) throw error;
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Transaction failed");
  }
}
