import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {

  const { pathname } = request.nextUrl;

  const scannerPaths = [
    "/CFIDE",
    "/Autodiscover",
    "/Microsoft-Server-ActiveSync",
    "/ECP",
    "/EWS",
    "/Exchange",
    "/OWA",
    "/Rpc",
    "/ecp",
    "/OAB",
    "/aspnet_client",
    "/PowerShell",
    "/cgi-bin",
    "/nuxeo",
  ];

  const isScannerPath = scannerPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  const scannerFileExtensions = [
    ".php",
    ".asp",
    ".aspx",
    ".jsp",
    ".cfm",
    ".cgi",
    ".pl",
    ".py",
    ".do",
    ".action",
  ];

  const isScannerFile = scannerFileExtensions.some((extension) =>
    pathname.toLowerCase().endsWith(extension)
  );

  if (isScannerPath || isScannerFile) {
    return new NextResponse("Not Found", { status: 404 });
  }
  
  const publicPages = [
    "/log-in",
    "/log-in/create-account",
    "/log-in/confirm-email",
    "/log-in/confirm-email-code",
    "/log-in/forgot-password",
  ];

  const isPublicPage = publicPages.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`)
  );

  const isPublicFile =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/sonic_dev_logo.png");

  const publicApiRoutes = [
    "/api/sonic/log-in-check",
    "/api/sonic/create-account",
    "/api/sonic/forgot-password",
    "/api/sonic/confirm-email",
    "/api/sonic/validate-auth-token",

    "/api/bigcommerce/order-created",
  ];

  const isPublicApiRoute = publicApiRoutes.includes(pathname);

  if (isPublicPage || isPublicFile || isPublicApiRoute) {
    return NextResponse.next();
  }

  const authToken = request.cookies.get("sonic_auth_token")?.value;

  if (!authToken) {

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/log-in";
    loginUrl.searchParams.set("redirect", pathname);

    return NextResponse.redirect(loginUrl);
  }

  const validateUrl = new URL(
    "/api/sonic/validate-auth-token",
    process.env.INTERNAL_APP_URL || request.nextUrl.origin
  );

  try {
    const validateResponse = await fetch(validateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        authToken,
      }),
    });

    const rawText = await validateResponse.text();

    let data: any = {};

    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {

      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/log-in";
      loginUrl.searchParams.set("redirect", pathname);

      return NextResponse.redirect(loginUrl);
    }

    if (!validateResponse.ok || !data.authenticated) {

      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/log-in";
      loginUrl.searchParams.set("redirect", pathname);

      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete("sonic_auth_token");

      return response;
    }

    return NextResponse.next();
  } catch (error) {

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/log-in";
    loginUrl.searchParams.set("redirect", pathname);

    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};