import type { Db, MongoClient } from "mongodb";
import type { TransactionRepositories } from "@/application/identity";
import { createMongoIdentityRepositories } from "./repositories";

export class MongoTransactionRunner {
  constructor(private readonly client: MongoClient, private readonly db: Db) {}
  async run<T>(work: (repositories: TransactionRepositories) => Promise<T>) {
    const session = this.client.startSession();
    try { let result!: T; await session.withTransaction(async () => { result = await work(createMongoIdentityRepositories(this.db, this.client, session)); }); return result; } finally { await session.endSession(); }
  }
}
