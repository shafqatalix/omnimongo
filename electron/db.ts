// electron/main/db.ts
import { MongoClient, ObjectId } from 'mongodb';

const clientCache = new Map<string, MongoClient>();
const getDbName = (url: string) => url?.split("/").pop()?.split("?")[0] || ''; // crude extraction

async function getClient(uri: string): Promise<MongoClient> {
    if (!uri) throw new Error('MongoDB URI is required');

    let client = clientCache.get(uri);
    if (!client) {
        client = new MongoClient(uri);
        await client.connect();
        clientCache.set(uri, client);
    }
    return client;
}

function safeIdKey(rawId: any): string {
    // 1. If it’s already an ObjectId → toString()
    if (rawId instanceof ObjectId) return rawId.toHexString();

    // 2. If it’s a valid 24-char hex string → use it
    if (typeof rawId === 'string' && ObjectId.isValid(rawId)) {
        return rawId;
    }

    // 3. Fallback: use the raw value (number, null, etc.) → JSON string
    //     This guarantees a unique key even for non-ObjectId docs.
    return JSON.stringify(rawId);
}

export async function getCollections(uri: string) {
    const client = await getClient(uri);
    const dbName = getDbName(uri);
    const db = client.db(dbName);
    const cols = await db.listCollections().toArray();
    return cols.map(c => c.name).sort();
}

export async function getCollectionDocuments(
    uri: string,
    collectionName: string,
    keyFields: string[]
): Promise<Map<string, Record<string, any>>> {
    // ---- connect -------------------------------------------------------
    const client = await getClient(uri);
    const dbName = getDbName(uri);
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // ---- fetch ---------------------------------------------------------
    const documents = await collection.find({}).toArray();

    // ---- build Map (key = string, value = doc with string _id) ---------
    const documentMap = new Map<string, Record<string, any>>();

    for (const doc of documents) {
        const rawId = doc._id ?? doc.id;               // whatever the doc uses
        const key = safeIdKey(rawId);                 // guaranteed string

        // Normalise _id to a **string** (makes UI work easier)
        const normalised: Record<string, any> = {
            ...doc,
            _id: key,                                    // always a hex string
        };
        let searchKey = '';
        for (const field of keyFields) {
            const fieldValue = normalised[field];
            if (!fieldValue) continue;
            if (Array.isArray(fieldValue)) {
                if (fieldValue.length === 0) continue;
                searchKey += `[${field}:${fieldValue.join(",")}]`;
            } else {
                searchKey += `[${field}:${fieldValue}]`;
            }
        }
        searchKey = searchKey.split(" ").join("").toLocaleLowerCase(); // Remove spaces
        documentMap.set(searchKey, normalised);
    }

    // Optional: log for debugging
    console.log(`Fetched ${documentMap.size} docs from ${dbName}.${collectionName}`);

    // Return an array (easier for the renderer)
    return documentMap
}