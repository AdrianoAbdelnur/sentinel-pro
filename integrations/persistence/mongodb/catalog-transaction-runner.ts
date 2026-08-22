import type { Db, MongoClient } from "mongodb";
import type { CatalogRepositories } from "@/application/catalog/ports";
import { createCatalogRepositories } from "./catalog-repositories";

export class MongoCatalogTransactionRunner {
  constructor(private readonly client: MongoClient, private readonly db: Db) {}

  async run<T>(work: (repositories: CatalogRepositories) => Promise<T>): Promise<T> {
    const session = this.client.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => { result = await work(createCatalogRepositories(this.db, session)); });
      return result;
    } finally { await session.endSession(); }
  }

  isConflict(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000; }
}
