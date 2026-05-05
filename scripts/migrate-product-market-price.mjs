/**
 * Migre les produits vers le modèle « prix marché unique » :
 * - crée `marketSellingPrice` à partir de `defaultMarketSellingPrice` ou `sellingPrice`
 * - supprime `sellingPrice` et `defaultMarketSellingPrice`
 *
 * Usage (PowerShell) :
 *   $env:MONGODB_URI="mongodb+srv://.../e_stock"
 *   node scripts/migrate-product-market-price.mjs
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { MongoClient } from "mongodb";

function loadEnvFromFile() {
  for (const name of [".env.local", ".env"]) {
    const full = resolve(process.cwd(), name);
    if (!existsSync(full)) continue;
    const text = readFileSync(full, "utf8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

loadEnvFromFile();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Définissez MONGODB_URI (ou un fichier .env.local avec MONGODB_URI).");
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db().collection("products");

  const cursor = col.find({});
  let updated = 0;
  for await (const doc of cursor) {
    let m = doc.defaultMarketSellingPrice;
    if (m == null || !Number.isFinite(Number(m)) || Number(m) <= 0) {
      m = doc.sellingPrice;
    }
    const n = Number(m);
    const marketSellingPrice = Number.isFinite(n) && n > 0 ? n : 1;

    await col.updateOne(
      { _id: doc._id },
      {
        $set: { marketSellingPrice },
        $unset: { sellingPrice: "", defaultMarketSellingPrice: "" },
      }
    );
    updated += 1;
  }

  await client.close();
  console.log(`Migration terminée : ${updated} produit(s) mis à jour.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
