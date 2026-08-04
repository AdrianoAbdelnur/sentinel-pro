import { MongoClient, type Db } from "mongodb";

let sharedClient: Promise<MongoClient> | undefined;
export function getMongoClient(uri = process.env.SENTINEL_MONGODB_URI): Promise<MongoClient> {
  if (!uri) throw new Error("SENTINEL_MONGODB_URI is required");
  sharedClient ??= new MongoClient(uri).connect();
  return sharedClient;
}
export async function getMongoDatabase(name = process.env.SENTINEL_MONGODB_DATABASE): Promise<Db> {
  if (!name) throw new Error("SENTINEL_MONGODB_DATABASE is required");
  return (await getMongoClient()).db(name);
}
export function createMongoClient(uri: string) { return new MongoClient(uri); }
