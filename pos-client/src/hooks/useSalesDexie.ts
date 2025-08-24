import { db, type Sale } from "../db/salesDexie";

// Add multiple sales
export const addSalesToDexie = async (sales: Sale[]) => {
  const valid = sales.filter(s => typeof s.saleId === "number");
  if (valid.length > 0) {
    await db.sales.bulkPut(valid);
  }
};

// Add single sale
export const addSaleToDexie = async (sale: Sale) => {
  if (sale.saleId) {
    await db.sales.put(sale);
  }
};

// Update sale
export const updateSaleInDexie = async (saleId: number, updatedData: Partial<Sale>) => {
  await db.sales.update(saleId, updatedData);
};

// Delete sale
export const deleteSaleFromDexie = async (saleId: number) => {
  await db.sales.delete(saleId);
};

// Get sales by page (simulate pagination offline)
export const getSalesFromDexie = async (page: number, limit: number): Promise<Sale[]> => {
  const offset = (page - 1) * limit;
  return db.sales.offset(offset).limit(limit).toArray();
};

// Get total sales count
export const getSalesCountFromDexie = async (): Promise<number> => {
  return db.sales.count();
};


// Clear old sales (example: keep only the most recent N records)
export const clearOldSales = async (keepLatest: number) => {
  const total = await db.sales.count();
  if (total > keepLatest) {
    const oldSales = await db.sales
      .orderBy("saleId") // assuming saleId increases over time
      .limit(total - keepLatest)
      .toArray();

    const oldIds = oldSales.map(s => s.saleId);
    await db.sales.bulkDelete(oldIds);
  }
};

