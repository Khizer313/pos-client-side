import Dexie, { type Table } from "dexie";






type SaleItem = {
  productId: number;
  productName: string;
  ctn: number;
  pieces: number;
  quantity: number;
  price: number;
  total: number;
};

// Yehi wahi structure rakho jo aap backend/GraphQL pe use karte ho
export type Sale = {
  saleId: number;
  customerId: number; // instead of customer
  invoiceNo: string;
  date: string; // ya Date if you prefer
  status: "Pending" | "Paid";
  createdAt: string;
  paymentMethod: "Cash" | "Bank";
  notes?: string;
  items: SaleItem[];
  total:number;
  
};

export class MyAppDexie extends Dexie {
  sales!: Table<Sale, number>; // yahan bhi wahi type use karo

  constructor() {
    super("MyAppDatabase");

    this.version(1).stores({
      sales: "saleId, customerId, status, createdAt", 
      // compound index bhi bana sakte ho agar search/filter karna ho
    });
  }
}

export const db = new MyAppDexie();
