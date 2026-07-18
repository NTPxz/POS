export type Category = {
  id: string;
  name: string;
  position: number;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  barcode: string | null;
  category_id: string | null;
  price: number;
  cost: number;
  stock: number;
  track_stock: boolean;
  low_stock_threshold: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PaymentMethod = "cash" | "transfer" | "card";

export type SaleStatus = "open" | "completed" | "voided";

export type Sale = {
  id: string;
  sale_number: number;
  table_id: string | null;
  subtotal: number;
  discount: number;
  total: number;
  cost_total: number;
  payment_method: PaymentMethod;
  received: number | null;
  change: number | null;
  note: string | null;
  status: SaleStatus;
  voided_at: string | null;
  user_id: string | null;
  created_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  price: number;
  cost: number;
  quantity: number;
  total: number;
  created_at: string;
};

export type SaleWithItems = Sale & { sale_items: SaleItem[] };

export type CartItem = {
  product: Product;
  quantity: number;
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "เงินสด",
  transfer: "โอนเงิน",
  card: "บัตร",
};

export type ExpenseCategory = {
  id: string;
  name: string;
  position: number;
  created_at: string;
};

export type Expense = {
  id: string;
  category_id: string | null;
  title: string;
  amount: number;
  expense_date: string;
  note: string | null;
  user_id: string | null;
  created_at: string;
};

export type ExpenseWithCategory = Expense & {
  expense_categories: { name: string } | null;
};

export type IncomeCategory = {
  id: string;
  name: string;
  position: number;
  created_at: string;
};

export type Income = {
  id: string;
  category_id: string | null;
  title: string;
  amount: number;
  income_date: string;
  note: string | null;
  user_id: string | null;
  created_at: string;
};

export type IncomeWithCategory = Income & {
  income_categories: { name: string } | null;
};

export type Role = "owner" | "manager" | "staff";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "เจ้าของร้าน",
  manager: "ผู้จัดการ",
  staff: "พนักงานขาย",
};

const ROLE_RANK: Record<Role, number> = { staff: 0, manager: 1, owner: 2 };

/** current มีสิทธิ์เท่ากับหรือสูงกว่า min หรือไม่ */
export function hasRole(current: Role, min: Role): boolean {
  return ROLE_RANK[current] >= ROLE_RANK[min];
}

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: Role;
  created_at: string;
  updated_at: string;
};

export type DiningTable = {
  id: string;
  name: string;
  position: number;
  is_active: boolean;
  created_at: string;
};
