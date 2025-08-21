import { db, type Variation } from "../db/variationDexie";

// -------------------- Add Multiple Variations -------------------- //
export const addVariationsToDexie = async (variations: Variation[]) => {
  await db.variations.bulkPut(variations);
};

// -------------------- Get All Variations -------------------- //
export const getVariationsFromDexie = async (): Promise<Variation[]> => {
  return await db.variations.toArray();
};

// -------------------- Update Single Variation -------------------- //
export const updateVariationInDexie = async (variation: Variation) => {
  await db.variations.put(variation);
};

// -------------------- Delete Single Variation -------------------- //
export const deleteVariationFromDexie = async (variationId: number) => {
  await db.variations.delete(variationId);
};

// -------------------- Clear Old Variations If Over Limit -------------------- //
export const clearOldVariations = async (max: number = 100) => {
  const count = await db.variations.count();
  if (count > max) {
    const toDelete = await db.variations
      .orderBy("createdAt")
      .limit(count - max)
      .toArray();
    const idsToDelete = toDelete.map((v) => v.variationId);
    await db.variations.bulkDelete(idsToDelete);
  }
};
