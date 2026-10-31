/**
 * ร้านที่ใช้ระบบนี้ — โค้ดและ Supabase project ชุดเดียวกัน แต่แต่ละร้านมี path,
 * Postgres schema, bucket รูป และ session cookie ของตัวเอง
 * ระบบบัญชี (auth.users) ใช้ร่วมกัน จึงต้องเช็กเสมอว่าผู้ใช้เป็นของร้านไหน
 */
export type ShopSlug = "mala-peng" | "rompho";

export type Shop = {
  slug: ShopSlug;
  /** "" = ร้านหลักที่อยู่ root, ร้านอื่นขึ้นต้นด้วย / เช่น /rompho */
  basePath: string;
  /** ชื่อที่โชว์บนแถบเมนู */
  label: string;
  /** ชื่อร้านที่พิมพ์บนบิล */
  receiptName: string;
  /** โลโก้บนบิล แสดงแทนเลขที่บิล null = แสดงเลขที่บิลตามปกติ */
  receiptLogo: string | null;
  /** ข้อความท้ายบิล แยกบรรทัด */
  receiptFooter: string[];
  /** null = ยังไม่มีโลโก้ ให้โชว์ตัวอักษรย่อแทน */
  logo: string | null;
  logoInitial: string;
  /** ห้ามตั้ง prefix ของ localStorage ซ้ำกัน เพราะทุกร้านอยู่ origin เดียวกัน */
  storagePrefix: string;
  dbSchema: string;
  storageBucket: string;
  /** undefined = ใช้ชื่อ cookie ดีฟอลต์ของ Supabase เพื่อไม่ให้ session ของร้านหลักหลุด */
  authCookieName: string | undefined;
};

export const DEFAULT_SHOP: Shop = {
  slug: "mala-peng",
  basePath: "",
  label: "POS",
  receiptName: "หม่าล่า เป่ง",
  receiptLogo: null,
  receiptFooter: ["ขอบคุณที่ใช้บริการ"],
  logo: "/logo.png",
  logoInitial: "ห",
  storagePrefix: "",
  dbSchema: "public",
  storageBucket: "product-images",
  authCookieName: undefined,
};

export const ROMPHO_SHOP: Shop = {
  slug: "rompho",
  basePath: "/rompho",
  label: "ร่มโพธิ์",
  receiptName: "ร่มโพธิ์",
  receiptLogo: "/rompho-logo.png",
  receiptFooter: [
    "มูลีกู้กับเหล้า",
    "ข้าวกู้กับปล๋า",
    "น้ำแข็งกู้กับโซดา",
    "ส่วนตั๋วข้าเมากู้แลง",
    "ขอบคุณเจ้าา",
  ],
  logo: "/rompho-logo.png",
  logoInitial: "ร",
  storagePrefix: "rompho:",
  dbSchema: "rompho",
  storageBucket: "rompho-product-images",
  authCookieName: "sb-rompho-auth-token",
};

export function shopFromPathname(pathname: string): Shop {
  const { basePath } = ROMPHO_SHOP;
  return pathname === basePath || pathname.startsWith(`${basePath}/`)
    ? ROMPHO_SHOP
    : DEFAULT_SHOP;
}

/** ร้านของหน้าที่เปิดอยู่ ใช้ได้เฉพาะใน event handler/effect ถ้าใช้ตอน render ให้ใช้ useShop */
export function currentShop(): Shop {
  return typeof window === "undefined"
    ? DEFAULT_SHOP
    : shopFromPathname(window.location.pathname);
}

/** path ภายในแอป ("/sales") -> path จริงของร้าน ("/rompho/sales") */
export function shopHref(shop: Shop, path: string): string {
  if (path === "/") return shop.basePath || "/";
  return `${shop.basePath}${path}`;
}

/** path จริงของร้าน ("/rompho/sales") -> path ภายในแอป ("/sales") */
export function stripBasePath(shop: Shop, pathname: string): string {
  return pathname.slice(shop.basePath.length) || "/";
}

export function shopStorageKey(key: string): string {
  return `${currentShop().storagePrefix}${key}`;
}

/** อีเมลภายในของพนักงานที่ล็อกอินด้วยเบอร์ แยกโดเมนรายร้านเพื่อให้เบอร์เดียวกันอยู่คนละร้านได้ */
export function staffPhoneEmail(shop: Shop, phoneDigits: string): string {
  const domain = shop.basePath
    ? `${shop.slug}.staff.pos.local`
    : "staff.pos.local";
  return `phone-${phoneDigits}@${domain}`;
}
