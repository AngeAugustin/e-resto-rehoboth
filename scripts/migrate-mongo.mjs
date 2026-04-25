/**
 * Copie toutes les collections utilisateur d'une base MongoDB vers une autre.
 *
 * Usage (PowerShell) — remplacer les URI par les vôtres :
 *   $env:MONGODB_SOURCE_URI="mongodb+srv://.../e_stock"
 *   $env:MONGODB_TARGET_URI="mongodb://user:pass@host:port/e-stock"
 *   node scripts/migrate-mongo.mjs
 *
 * Variables optionnelles :
 *   MIGRATE_DROP_TARGET=1   — vide chaque collection cible avant d'insérer (défaut: 1)
 */

import { MongoClient } from "mongodb";

const SOURCE = process.env.MONGODB_SOURCE_URI;
const TARGET = process.env.MONGODB_TARGET_URI;
const dropTarget = process.env.MIGRATE_DROP_TARGET !== "0";

if (!SOURCE || !TARGET) {
  console.error(
    "Définissez MONGODB_SOURCE_URI (ancienne base) et MONGODB_TARGET_URI (nouvelle base).",
  );
  process.exit(1);
}

async function main() {
  const sourceClient = new MongoClient(SOURCE);
  const targetClient = new MongoClient(TARGET);

  await sourceClient.connect();
  await targetClient.connect();

  const sourceDb = sourceClient.db();
  const targetDb = targetClient.db();

  console.log(`Source: ${sourceDb.databaseName}`);
  console.log(`Cible : ${targetDb.databaseName}`);

  const collections = (await sourceDb.listCollections().toArray()).filter(
    (c) => !c.name.startsWith("system."),
  );

  for (const { name } of collections) {
    const src = sourceDb.collection(name);
    const count = await src.countDocuments();
    const dest = targetDb.collection(name);

    if (dropTarget) {
      await dest.deleteMany({});
    }

    if (count === 0) {
      console.log(`  ${name}: 0 document (skip insert)`);
      continue;
    }

    const docs = await src.find({}).toArray();
    const batchSize = 1000;
    for (let i = 0; i < docs.length; i += batchSize) {
      const chunk = docs.slice(i, i + batchSize);
      await dest.insertMany(chunk, { ordered: false });
    }
    console.log(`  ${name}: ${docs.length} document(s) copié(s)`);
  }

  await sourceClient.close();
  await targetClient.close();
  console.log("Migration terminée.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
