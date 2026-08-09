import type { Db, MongoClient } from "mongodb";
import type { CatalogTransactionRepositories } from "@/application/catalog";
import { createMongoCatalogRepositories } from "./catalog-repositories";

export class MongoCatalogTransactionRunner {
  constructor(private readonly client: MongoClient, private readonly db: Db) {}
  async run<T>(work: (repositories: CatalogTransactionRepositories) => Promise<T>) {
    const session = this.client.startSession();
    try { let result!: T; await session.withTransaction(async () => { result = await work(createMongoCatalogRepositories(this.db, session)); }); return result; } finally { await session.endSession(); }
  }
}
