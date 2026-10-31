import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_MAX_AGE } from "@/lib/supabase/cookie-options";
import { shopFromPathname, shopHref, stripBasePath } from "@/lib/shops";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const shop = shopFromPathname(request.nextUrl.pathname);
  const path = stripBasePath(shop, request.nextUrl.pathname);

  // matcher ด้านล่างยกเว้น /api และ /order ได้เฉพาะของร้านหลัก ส่วนของร้านอื่นต้องเช็กตรงนี้
  if (path.startsWith("/api") || path.startsWith("/order")) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { maxAge: AUTH_COOKIE_MAX_AGE, name: shop.authCookieName },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = path.startsWith("/login");

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = shopHref(shop, "/login");
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = shopHref(shop, "/");
    return NextResponse.redirect(url);
  }

  // บัญชีที่เจ้าของร้านตั้งรหัสให้ ต้องตั้งรหัสของตัวเองก่อนจึงจะเข้าหน้าอื่นได้
  const isChangePasswordPage = path === "/change-password";
  const mustChangePassword = user?.app_metadata?.must_change_password === true;

  if (user && mustChangePassword !== isChangePasswordPage) {
    const url = request.nextUrl.clone();
    url.pathname = shopHref(shop, mustChangePassword ? "/change-password" : "/");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|order|_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
