// src/pages/Sales/Sales.tsx
import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useTransition,
  lazy,
  Suspense,
} from "react";
import type {
  GridColDef,
  GridPaginationModel,
  GridRenderCellParams,

} from "@mui/x-data-grid";
import { useQuery, useMutation, NetworkStatus } from "@apollo/client";
import { Autocomplete, Skeleton, TextField } from "@mui/material";

import { useDebounce } from "../../hooks/useDebounce";
import { throttle } from "../../hooks/useThrottle";
import { useToast } from "../../components/use-toast";
import FallbackLoader from "../../components/FallbackLoader";

// Lazy stuff
const PartyPage = lazy(() => import("../PartyPage"));
const DataGrid = lazy(() =>
  import("@mui/x-data-grid/DataGrid").then((m) => ({ default: m.DataGrid }))
);





// GraphQL
import { GET_SALES_PAGINATED } from "../../graphql/queries/sales";
import {
  CREATE_SALE,
  UPDATE_SALE,
  DELETE_SALE,
} from "../../graphql/mutations/salesmutations";


// Dexie hooks
import {
  addSalesToDexie,
  getSalesFromDexie,
  updateSaleInDexie,
  deleteSaleFromDexie,
  clearOldSales,
} from "../../hooks/useSalesDexie";
import { GET_CUSTOMERS_PAGINATED } from "../../graphql/queries/customers";
import { GET_PRODUCTS_PAGINATED } from "../../graphql/queries/products";
import type { Customer } from "../../db/customerDexie";



/* =========================
   Types
========================= */

type FocusRef = React.RefObject<Focusable>;
type Focusable = { focus: () => void } | null;

type SaleItem = {
  productId: number;
  productName: string;
  ctn: number;
  pieces: number;
  quantity: number;
  price: number;
  total: number;
};


// salesDexie.ts ya jahan bhi tumhara Sale type defined hai
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



type RefetchVars = {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
};

type CreateSaleInput = {
  invoiceNo?: string;
  customerId: number;
  date: string;
  items: Array<{
    productName: string;
    ctn: number;
    pieces: number;
    quantity: number;
    price: number;
    total: number;
  }>;
  total: number;
  status: "Pending" | "Paid";
  paymentMethod?: "Cash" | "Bank";
  notes?: string;
};

type CustomerOption = {
  customerId: string;
  name: string;
  phone: string;
};

type Product = {
  productId: string;
  name: string;
  price: number;
   pieces: number; 
};

/* =========================
   Component
========================= */

const Sales: React.FC = () => {
  const { showToast } = useToast();

  // Page cache (last 10 pages)
  const [salePages, setSalePages] = useState<Map<number, Sale[]>>(
    () => new Map()
  );

  // UI State
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"All" | "Paid" | "Pending">(
    "All"
  );
  const [paymentFilter, setPaymentFilter] = useState<"All" | "Cash" | "Bank">(
    "All"
  );

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });

  // Date filters
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Debounced search
  const debouncedSearch = useDebounce(searchTerm, 400);

  // Transitional UI
  const [isPending, startTransition] = useTransition();

  // For Add/Edit Form (sticky)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // Refs for Enter-to-focus chain
  const customerRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLSelectElement>(null);
  const paymentRef = useRef<HTMLSelectElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const productNameRef = useRef<HTMLInputElement>(null);
  const ctnRef = useRef<HTMLInputElement>(null);
  const piecesRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  // Form State
  const [form, setForm] = useState<{
    customerId: number;
    date: string;
    status: "Pending" | "Paid";
    paymentMethod: "Cash" | "Bank";
    notes: string;
    items: SaleItem[];
  }>({
    customerId: 0,
    date: new Date().toISOString().split("T")[0],
    status: "Pending",
    paymentMethod: "Cash",
    notes: "",
    items: [],
  });

  const [newItem, setNewItem] = useState<Omit<SaleItem, "total">>({
    productId: 0,
    productName: "",
    ctn: 0,
    pieces: 0,
    quantity: 0,
    price: 0,
  });

  // store last refetch vars - for retry or toast contexts
  const lastRefetchVars = useRef<RefetchVars | null>(null);










  const { data: customersData } = useQuery(GET_CUSTOMERS_PAGINATED, {
  variables: { page: 1, limit: 100 },
});
const { data: productsData } = useQuery(GET_PRODUCTS_PAGINATED, {
  variables: { page: 1, limit: 100 },
});


const customerOptions = customersData?.customersPaginated?.data || [];
const productOptions = productsData?.productsPaginated?.data || [];



  /* =========================
     Helpers
  ========================= */

  const focusNextIfValid = (
    e: React.KeyboardEvent<Focusable>,
    nextRef?: FocusRef,
    currentValue?: string | number,
    optional: boolean = false
  ) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const ok =
      optional ||
      (typeof currentValue === "string"
        ? currentValue.trim().length > 0
        : currentValue !== undefined && currentValue !== null && currentValue !== 0);
    if (ok) nextRef?.current?.focus();
  };

  // quantity auto-calc when ctn | pieces changes
  useEffect(() => {
    setNewItem((prev) => ({
      ...prev,
      quantity: (Number(prev.ctn) || 0) * (Number(prev.pieces) || 0),
    }));
  }, [newItem.ctn, newItem.pieces]);



  
  /* =========================
     Apollo: Query & Mutations
  ========================= */

  const { data, error, networkStatus, refetch } = useQuery(GET_SALES_PAGINATED, {
    variables: {
      page: paginationModel.page + 1,
      limit: Math.max(10, Math.min(paginationModel.pageSize, 100)),
      search: debouncedSearch || undefined,
      status: activeFilter !== "All" ? activeFilter : undefined,
      paymentMethod: paymentFilter !== "All" ? paymentFilter : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
    fetchPolicy: "cache-and-network",

    notifyOnNetworkStatusChange: true,
  });

  const [createSaleMutation] = useMutation(CREATE_SALE);
  const [updateSaleMutation] = useMutation(UPDATE_SALE);
  const [deleteSaleMutation] = useMutation(DELETE_SALE);

  // Error toast on query fail
  useEffect(() => {
    if (error) {
      showToast(`🚫 Failed to load sales: ${error.message}`, "error");
    }
  }, [error, showToast]);



    const grandTotal = useMemo(
    () => form.items.reduce((sum, it) => sum + Number(it.total), 0),
    [form.items]
  );




  /* =========================
     Handle incoming data
  ========================= */

  useEffect(() => {
  let cancelled = false;

  const handleData = async () => {
    if (data?.salesPaginated?.data) {
      const pageIdx = paginationModel.page;

      const incoming: Sale[] = data.salesPaginated.data.map((s: Sale) => ({
        ...s,
        total: typeof s.total === "string" ? Number(s.total) : s.total,
        items: (s.items || []).map((p: SaleItem) => ({
          productName: p.productName,
          ctn: Number(p.ctn) || 0,
          pieces: Number(p.pieces) || 0,
          quantity: Number(p.quantity) || 0,
          price: Number(p.price) || 0,
          total:
            Number(p.total) ||
            (Number(p.quantity) || 0) * (Number(p.price) || 0),
        })),
      }));

      if (!cancelled) {
        setSalePages((prev) => {
          const newMap = new Map(prev);
          newMap.set(pageIdx, incoming);

          // Keep only last 10 pages
          const keys = Array.from(newMap.keys()).sort((a, b) => a - b);
          if (keys.length > 10) {
            for (const k of keys.slice(0, keys.length - 10)) newMap.delete(k);
          }
          return newMap;
        });
      }

      try {
        await addSalesToDexie(incoming);
        await clearOldSales(1000);
      } catch (e) {
        console.log("dexie error ", e);
      }
    } else if (!data && error) {
      const dexieSales = await getSalesFromDexie(
        paginationModel.page,
        paginationModel.pageSize
      );
      if (!cancelled) {
        setSalePages((prev) => {
          const nm = new Map(prev);
          nm.set(paginationModel.page, dexieSales);
          return nm;
        });
      }
    }
  };

  handleData();

  return () => {
    cancelled = true;
  };
}, [data, error, paginationModel.page, paginationModel.pageSize]);

  
  /* =========================
     Refetch control
  ========================= */

  lastRefetchVars.current = {
    page: paginationModel.page + 1,
    limit: paginationModel.pageSize,
    search: debouncedSearch || undefined,
    status: activeFilter !== "All" ? activeFilter : undefined,
    paymentMethod: paymentFilter !== "All" ? paymentFilter : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  const throttledRefetch = useMemo(
    () =>
      throttle(async (vars: RefetchVars) => {
        try {
          await refetch(vars);
        } catch (err) {
          const msg = (err as Error).message || "Unknown error";
          showToast(`🚫 ${msg}`, "error");
        }
      }, 800),
    [refetch, showToast]
  );

  // changes that trigger refetch
  useEffect(() => {
    startTransition(() => {
      throttledRefetch({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        search: debouncedSearch || undefined,
        status: activeFilter !== "All" ? activeFilter : undefined,
        paymentMethod: paymentFilter !== "All" ? paymentFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
    });
  }, [
    debouncedSearch,
    activeFilter,
    paymentFilter,
    startDate,
    endDate,
    paginationModel,
    throttledRefetch,
  ]);


  
  /* =========================
     DataGrid rows/columns
  ========================= */

  const currentPageRows: Sale[] = useMemo(
    () => salePages.get(paginationModel.page) || [],
    [salePages, paginationModel.page]
  );

const rows = useMemo(
  () =>
    currentPageRows.map((s) => {
      const customer = customerOptions.find(
        (c: CustomerOption) => Number(c.customerId) === Number(s.customerId)
      );

      return {
        id: s.saleId || s.invoiceNo,
        ...s,
        customer: customer ? customer.name : "—", // ✅ inject customer name
      };
    }),
  [currentPageRows, customerOptions]
);







  
  const renderActions = useCallback(
    (params: GridRenderCellParams) => {
      const saleId = params.row.saleId as number | undefined;
      const invoiceNo = params.row.invoiceNo as string | undefined;

      return (
  <div className="space-x-2">
 <button
  className="text-blue-600 hover:underline"
  onClick={() => {
    const sale =
      currentPageRows.find((x) =>
        saleId ? x.saleId === saleId : x.invoiceNo === invoiceNo
      ) || null;

    if (sale) {
      setEditingSale(sale);
     setForm({
  customerId: Number(sale.customerId), // ✅ number → string
  date: sale.date,
  status: sale.status,
  paymentMethod: sale.paymentMethod,
  notes: sale.notes || "",
  items: sale.items.map(item => ({
    productId: item.productId,
    productName: item.productName || "", // ✅ ensure string
    ctn: item.ctn ?? 0,
    pieces: item.pieces ?? 0,
    quantity: item.quantity,
    price: item.price,
    total: item.total ?? item.quantity * item.price, // ✅ auto-calc if missing
  })),
});

      setIsFormOpen(true);
    }
  }}
>
  Edit
</button>


  <button
    className="text-red-600 hover:underline"
    onClick={() => handleDeleteSale(saleId)}
  >
    Delete
  </button>
</div>

      );
    },
    [currentPageRows]
  );




  const columns: GridColDef[] = useMemo(
    () => [
      { field: "invoiceNo", headerName: "Invoice No", flex: 1 },
      { field: "customer", headerName: "Customer", flex: 1 },
      {
        field: "date",
        headerName: "Date",
        flex: 1,
        renderCell: (p) => {
          // ensure y-m-d
          return (
            <span>
              {new Date(p.value as string).toLocaleDateString("en-CA")}
            </span>
          );
        },
      },
      {
  field: "total",
  headerName: "Total",
  flex: 1,
  valueFormatter: (value) => Number(value ?? 0).toFixed(2),
},

      { field: "status", headerName: "Status", flex: 1 },
      {
        field: "paymentMethod",
        headerName: "Payment",
        flex: 1,
        renderCell: (p) => <span>{p.value || "—"}</span>,
      },
      { field: "action", headerName: "Actions", flex: 1, renderCell: renderActions },
    ],
    [renderActions]
  );

  /* =========================
     CRUD Handlers
  ========================= */

  const resetForm = () => {
    setForm((prev) => ({
      customerId: 0,
      date: prev.date, // keep same date for multiple entries
      status: "Pending",
      paymentMethod: "Cash",
      notes: "",
      items: [],
    }));
    setEditingSale(null);
    setEditingItemIndex(null);
  };

  const handleAddItem = () => {
    if (!newItem.productName || !newItem.price || !newItem.ctn || !newItem.pieces)
      return;

    const total = Number(newItem.quantity) * Number(newItem.price);
    const updated = [...form.items];

    if (editingItemIndex !== null) {
      updated[editingItemIndex] = {
        ...newItem,
        total,
      };
    } else {
      updated.push({
        ...newItem,
        total,
      });
    }

    setForm({ ...form, items: updated });
    setNewItem({
      productId: 0,
      productName: "",
      ctn: 0,
      pieces: 0,
      quantity: 0,
      price: 0,
    });
    setEditingItemIndex(null);
    productNameRef.current?.focus();
  };

 const handleSubmitSale = async () => {
  if (!form.customerId || form.items.length === 0) {
    showToast("Please select customer and add at least one product.", "error");
    return;
  }

  const invoiceTotal = form.items.reduce(
    (acc, it) => acc + Number(it.total),
    0
  );

  const payload: CreateSaleInput = {
  invoiceNo: editingSale?.invoiceNo || `INV-${Date.now()}`,
  customerId: form.customerId,  // ✅ no TS error now
  date: form.date,
  items: form.items.map((x) => ({
    productId: Number(x.productId),
    productName: x.productName,
    ctn: Number(x.ctn) || 0,
    pieces: Number(x.pieces) || 0,
    quantity: Number(x.quantity) || 0,
    price: Number(x.price) || 0,
    total: Number(x.total) || Number(x.quantity) * Number(x.price),
  })),
  total: Number(invoiceTotal.toFixed(2)),
  status: form.status,
  paymentMethod: form.paymentMethod,
  notes: form.notes,
};


  try {
    if (editingSale?.saleId) {
      const res = await updateSaleMutation({
        variables: {
          saleId: editingSale.saleId,
          updateSaleInput: payload,
        },
      });
      const updated: Sale | undefined = res.data?.updateSale;
      if (updated) {
        await updateSaleInDexie(updated.saleId, updated);
        setSalePages((prev) => {
          const nm = new Map(prev);
          const pageIdx = paginationModel.page;
          const page = nm.get(pageIdx) || [];
          nm.set(
            pageIdx,
            page.map((s) => (s.saleId === updated.saleId ? updated : s))
          );
          return nm;
        });
        showToast("✅ Sale updated", "success");
      }
    } else {
      const res = await createSaleMutation({
        variables: {
          createSaleInput: payload,
        },
      });
      const created = res.data?.createSale as Sale | undefined;
      if (created) {
        await addSalesToDexie([created]);
        await clearOldSales(1000);
        setSalePages((prev) => {
          const nm = new Map(prev);
          const first = nm.get(0) || [];
          nm.set(0, [created, ...first].slice(0, 10));
          return nm;
        });
        setPaginationModel({ page: 0, pageSize: 10 });
        showToast("✅ Sale created", "success");
      }
    }

    setIsFormOpen(false);
    resetForm();
    throttledRefetch({
      page: 1,
      limit: paginationModel.pageSize,
      search: debouncedSearch || undefined,
      status: activeFilter !== "All" ? activeFilter : undefined,
      paymentMethod: paymentFilter !== "All" ? paymentFilter : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  } catch (err) {
    showToast(`🚫 ${(err as Error).message}`, "error");
  }
};


  const handleDeleteSale = useCallback(
    async (saleId?: number) => {
      if (!saleId) return;
      if (!window.confirm("Delete this sale?")) return;

      try {
        await deleteSaleMutation({ variables: { saleId } });
        await deleteSaleFromDexie(saleId);

        setSalePages((prev) => {
          const nm = new Map(prev);
          const pageIdx = paginationModel.page;
          const page = nm.get(pageIdx) || [];
          nm.set(
            pageIdx,
            page.filter((s) => s.saleId !== saleId)
          );
          return nm;
        });

        showToast("🗑️ Sale deleted", "success");
      } catch (err) {
        showToast(`🚫 ${(err as Error).message}`, "error");
      }
    },
    [paginationModel.page, deleteSaleMutation, showToast]
  );




useEffect(() => {
  console.log("GraphQL sales data:", data?.salesPaginated?.data);
  console.log("Mapped rows:", rows);
}, [data, rows]);



  
  /* =========================
     Initial focus when form opens
  ========================= */
  useEffect(() => {
    if (isFormOpen) customerRef.current?.focus();
  }, [isFormOpen]);

  /* =========================
     Initial loading skeleton
  ========================= */
  if (networkStatus === NetworkStatus.loading && !data) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton variant="rectangular" height={40} style={{ marginBottom: 8 }} />
        <Skeleton variant="rectangular" height={40} style={{ marginBottom: 8 }} />
        <Skeleton variant="rectangular" height={40} style={{ marginBottom: 8 }} />
        <Skeleton variant="rectangular" height={40} style={{ marginBottom: 8 }} />
        <Skeleton variant="rectangular" height={40} style={{ marginBottom: 8 }} />
      </div>
    );
  }

  /* =========================
     Render
  ========================= */



  return (
    <>
      <Suspense fallback={<FallbackLoader type="page" />}>
        <PartyPage
          title={isPending ? "Sales (Loading...)" : "Sales"}
          breadcrumbs={["Dashboard", "Sales"]}
          buttons={[
            {
              label: isFormOpen ? "Close Form" : "+ Add New Sale",
              variant: "primary",
              onClick: () => setIsFormOpen((s) => !s),
            },
          ]}
          filters={["All", "Paid", "Pending"]}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          activeFilter={activeFilter}
            onFilterChange={(filter) =>setActiveFilter(filter as "All" | "Paid" | "Pending")}
          // extra payment filter (optional UI: you can add a dropdown in PartyPage or repurpose filters)
          extraControls={
            <div className="flex gap-2">
              <select
                className="border rounded px-2 py-1"
                value={paymentFilter}
                onChange={(e) =>
                  setPaymentFilter(e.target.value as "All" | "Cash" | "Bank")
                }
              >
                <option value="All">All Payments</option>
                <option value="Cash">Cash</option>
                <option value="Bank">Bank</option>
              </select>
            </div>
          }
          // date range
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onClearDateRange={() => {
            setStartDate("");
            setEndDate("");
          }}
          customTable={
            <div className="space-y-6 relative">
              {/* Sticky Inline Form */}
              {isFormOpen && (
                <div className="space-y-4 p-6 rounded-lg shadow border border-gray-200 sticky top-0 z-50 bg-white">
                  <h2 className="text-xl font-bold text-gray-800">
                    {editingSale ? "Edit Sale" : "Add New Sale"}
                  </h2>

                  {/* Customer & Date */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Customer Name*
                      </label>
                 
<Autocomplete
  options={customerOptions}
  getOptionLabel={(c: CustomerOption) => c.name}
  value={customerOptions.find((c:Customer) => c.customerId === form.customerId) || null}
  onChange={(_, value) =>
    setForm({
      ...form,
      customerId: value ? Number(value.customerId) : 0,
    })
  }
  renderInput={(params) => (
    <TextField
      {...params}
      label="Customer Name"
      variant="outlined"
      inputRef={customerRef}
      onKeyDown={(e) => focusNextIfValid(e, dateRef, form.customerId)}
    />
  )}
/>


                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date*
                      </label>
                      <input
                        ref={dateRef}
                        type="date"
                        value={form.date}
                        onChange={(e) =>
                          setForm({ ...form, date: e.target.value })
                        }
                        onKeyDown={(e) => focusNextIfValid(e, statusRef, form.date)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                  </div>

                  {/* Status & Payment */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status*
                      </label>
                      <select
                        ref={statusRef}
                        value={form.status}
                        onChange={(e) =>
                          setForm({ ...form, status: e.target.value as "Paid" | "Pending" })
                        }
                        onKeyDown={(e) =>
                          focusNextIfValid(e, paymentRef, form.status)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="Pending">Pending</option>
                        <option value="Paid">Paid</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Method*
                      </label>
                      <select
                        ref={paymentRef}
                        value={form.paymentMethod}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            paymentMethod: e.target.value as "Cash" | "Bank",
                          })
                        }
                        onKeyDown={(e) => focusNextIfValid(e, notesRef, form.paymentMethod)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="Cash">Cash</option>
                        <option value="Bank">Bank</option>
                      </select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      ref={notesRef}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      onKeyDown={(e) =>
                        focusNextIfValid(e, productNameRef, form.notes, true)
                      }
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Additional notes"
                    />
                  </div>

                  {/* Product Entry */}
                  <div className="border border-gray-200 p-4 rounded-lg bg-gray-50">
                    <h3 className="font-semibold text-gray-800 mb-3">Add Product</h3>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                 <Autocomplete
  options={productOptions}
  getOptionLabel={(p: Product) => p.name}
  value={productOptions.find((p:Product) => p.name === newItem.productName) || null}
  onChange={(_, value) => {
    if (value) {
      setNewItem({
        ...newItem,
        productId: Number(value.productId),
        productName: value.name,
        price: value.price,
        pieces: value.pieces,  // ✅ auto-fill pieces from backend
      });
    }
  }}
  renderInput={(params) => (
    <TextField
      {...params}
      placeholder="Product Name*"
      inputRef={productNameRef}
      onKeyDown={(e) => focusNextIfValid(e, ctnRef, newItem.productName)}
      fullWidth
    />
  )}
/>




                      <input
                        ref={ctnRef}
                        type="number"
                        min="0"
                        value={newItem.ctn || ""}
                        onChange={(e) =>
                          setNewItem({ ...newItem, ctn: +e.target.value || 0 })
                        }
                        onKeyDown={(e) => focusNextIfValid(e, piecesRef, newItem.ctn)}
                        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="CTN*"
                        required
                      />

                      <input
                        ref={piecesRef}
                        type="number"
                        min="0"
                        value={newItem.pieces || ""}
                        onChange={(e) =>
                          setNewItem({ ...newItem, pieces: +e.target.value || 0 })
                        }
                        onKeyDown={(e) => focusNextIfValid(e, priceRef, newItem.pieces)}
                        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Pieces/CTN*"
                        required
                      />

                      <input
                        type="number"
                        min="0"
                        value={newItem.quantity || ""}
                        readOnly
                        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100"
                        placeholder="Auto-Qty"
                        title="Auto-calculated: CTN × Pieces"
                      />

                      <input
                        ref={priceRef}
                        type="number"
                        min="0"
                        step="0.01"
                        value={newItem.price || ""}
                        onChange={(e) =>
                          setNewItem({ ...newItem, price: +e.target.value || 0 })
                        }
                        onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Price*"
                        required
                      />

                      <input
                        readOnly
                        value={(
                          Number(newItem.quantity) * Number(newItem.price || 0)
                        ).toFixed(2)}
                        placeholder="Total"
                        className="border px-3 py-2 rounded bg-gray-100"
                      />
                    </div>

                    <button
                      onClick={handleAddItem}
                      disabled={
                        !newItem.productName ||
                        !newItem.price ||
                        !newItem.ctn ||
                        !newItem.pieces
                      }
                      className={`mt-3 px-4 py-2 rounded-md shadow ${
                        !newItem.productName ||
                        !newItem.price ||
                        !newItem.ctn ||
                        !newItem.pieces
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 text-white"
                      }`}
                    >
                      {editingItemIndex !== null ? "Update Item" : "+ Add Item"}
                    </button>
                  </div>

                  {/* Items Table */}
                  {form.items.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Product
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              CTN
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Pieces/CTN
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Qty
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Price
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {form.items.map((it, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2 whitespace-nowrap">
                                {it.productName}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap">{it.ctn}</td>
                              <td className="px-4 py-2 whitespace-nowrap">
                                {it.pieces}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap">
                                {it.quantity}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap">
                                {Number(it.price).toFixed(2)}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap">
                                {Number(it.total).toFixed(2)}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap space-x-2">
                                <button
                                  onClick={() => {
                                    setNewItem({
                                       productId: it.productId, 
                                      productName: it.productName,
                                      ctn: it.ctn,
                                      pieces: it.pieces,
                                      quantity: it.quantity,
                                      price: it.price,
                                    });
                                    setEditingItemIndex(idx);
                                    productNameRef.current?.focus();
                                  }}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    setForm((prev) => ({
                                      ...prev,
                                      items: prev.items.filter((_, i) => i !== idx),
                                    }));
                                  }}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50">
                            <td
                              colSpan={5}
                              className="px-4 py-2 text-right font-medium text-gray-900"
                            >
                              Grand Total:
                            </td>
                            <td className="px-4 py-2 font-medium text-gray-900">
                              {grandTotal.toFixed(2)}
                            </td>
                            <td className="px-4 py-2"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  {/* Submit */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSubmitSale}
                      disabled={!form.customerId || form.items.length === 0}
                      className={`px-6 py-2 rounded-md shadow ${
                        !form.customerId || form.items.length === 0
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-green-600 hover:bg-green-700"
                      } text-white font-medium`}
                    >
                      {editingSale ? "Update Sale" : "Submit Sale"}
                    </button>
                    <button
                      onClick={() => {
                        resetForm();
                        setIsFormOpen(false);
                      }}
                      className="px-6 py-2 rounded-md shadow bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Sales Table */}
              <div className="bg-white rounded-lg shadow border border-gray-200">
                <Suspense fallback={<FallbackLoader  />}>
                  <DataGrid
                    rows={rows}
                    columns={columns}
                    getRowId={(row) => row.saleId ?? row.invoiceNo}
                    paginationMode="server"
                    paginationModel={paginationModel}
                    onPaginationModelChange={(m) => {
                      startTransition(() => {
                        setPaginationModel(m);
                      });
                    }}
                    rowCount={data?.salesPaginated?.total || 0}
                    pageSizeOptions={[10, 20, 50]}
                    checkboxSelection
                    disableRowSelectionOnClick
                    autoHeight
                    loading={
                      networkStatus === NetworkStatus.loading &&
                      !salePages.get(paginationModel.page)
                    }
                    sx={{
                      "& .MuiDataGrid-cell:focus": { outline: "none" },
                      "& .MuiDataGrid-columnHeader:focus": { outline: "none" },
                    }}
                  />
                </Suspense>
              </div>
            </div>
          }
        />
      </Suspense>
    </>
  );
};

export default Sales;
