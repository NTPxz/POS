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
  is_sold_out: boolean;
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
  bill_requested_at: string | null;
  customer_name: string | null;
  user_id: string | null;
  created_at: string;
};

export type SaleItemStatus = "pending" | "accepted" | "served";

export const SALE_ITEM_STATUS_LABELS: Record<SaleItemStatus, string> = {
  pending: "รอรับออเดอร์",
  accepted: "กำลังเตรียม",
  served: "เสิร์ฟแล้ว",
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
  ordered_by: "staff" | "customer";
  status: SaleItemStatus;
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

export type ActivityLog = {
  id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  description: string;
  actor_id: string | null;
  actor_email: string | null;
  created_at: string;
};

export type TableOrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  status: SaleItemStatus;
};

export type TableOrder = {
  sale_id: string | null;
  subtotal: number;
  discount: number;
  total: number;
  items: TableOrderItem[];
  bill_requested: boolean;
};

export type PromotionType = "buy_x_get_fixed_discount";

export type Promotion = {
  id: string;
  name: string;
  type: PromotionType;
  threshold_qty: number | null;
  discount_amount: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
