import Dexie, { type Table } from "dexie";

// -------------------- Variation Interface -------------------- //
export interface Variation {
  variationId: number;
  name: string;
  productAssigned: string;
  pieces: number;
  price: number;
  status: string;
  createdAt: string;
}

// -------------------- Dexie DB Class -------------------- //
export class VariationDexieDB extends Dexie {
  variations!: Table<Variation>;

  constructor() {
    super("VariationDB");
    this.version(1).stores({
      variations: "variationId, name, productAssigned, pieces, price, status, createdAt",
    });
  }
}

export const db = new VariationDexieDB();
