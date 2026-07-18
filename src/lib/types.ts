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

export type Sale = {
  id: string;
  sale_number: number;
  subtotal: number;
  discount: number;
  total: number;
  cost_total: number;
  payment_method: PaymentMethod;
  received: number | null;
  change: number | null;
  note: string | null;
  status: "completed" | "voided";
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
