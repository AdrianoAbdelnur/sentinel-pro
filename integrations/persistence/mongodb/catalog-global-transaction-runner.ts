import type { Db, MongoClient } from "mongodb";
import type { GlobalCatalogRepositories } from "@/application/catalog-global/ports";
import { createGlobalCatalogRepositories } from "./catalog-global-repositories";

export class MongoGlobalCatalogTransactionRunner {
  constructor(private readonly client: MongoClient, private readonly db: Db) {}

  async run<T>(work: (repositories: GlobalCatalogRepositories) => Promise<T>): Promise<T> {
    const session = this.client.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => { result = await work(createGlobalCatalogRepositories(this.db, session)); });
      return result;
    } finally { await session.endSession(); }
  }

  isConflict(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000; }
}
