import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type AuthenticationStatus =
  | "authenticated"
  | "unauthenticated"
  | "validation_error";

async function validateAuthToken(
  request: NextRequest,
  authToken: string
): Promise<AuthenticationStatus> {
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
      cache: "no-store",
    });

    const rawText = await validateResponse.text();

    if (!rawText) {
      return "unauthenticated";
    }

    let data: {
      authenticated?: boolean;
    };

    try {
      data = JSON.parse(rawText) as {
        authenticated?: boolean;
      };
    } catch {
      return "unauthenticated";
    }

    if (
      !validateResponse.ok ||
      data.authenticated !== true
    ) {
      return "unauthenticated";
    }

    return "authenticated";
  } catch (error) {
    console.error(
      "Failed to validate Sonic authentication token:",
      error
    );

    return "validation_error";
  }
}

function createLoginRedirect(request: NextRequest) {
  const loginUrl = request.nextUrl.clone();

  loginUrl.pathname = "/log-in";
  loginUrl.search = "";
  loginUrl.searchParams.set(
    "redirect",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  return loginUrl;
}

function createHomeRedirect(request: NextRequest) {
  const homeUrl = request.nextUrl.clone();

  homeUrl.pathname = "/";
  homeUrl.search = "";

  return homeUrl;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Reject common automated scanner requests.
   */
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
    (path) =>
      pathname === path ||
      pathname.startsWith(`${path}/`)
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

  const lowercasePathname = pathname.toLowerCase();

  const isScannerFile =
    scannerFileExtensions.some((extension) =>
      lowercasePathname.endsWith(extension)
    );

  if (isScannerPath || isScannerFile) {
    return new NextResponse("Not Found", {
      status: 404,
    });
  }

  /*
   * Pages that must remain accessible before logging in.
   */
  const publicPages = [
    "/log-in",
    "/log-in/create-account",
    "/log-in/confirm-email",
    "/log-in/confirm-email-code",
    "/log-in/forgot-password",
    "/log-in/reset-password",
  ];

  const isPublicPage = publicPages.some(
    (page) =>
      pathname === page ||
      pathname.startsWith(`${page}/`)
  );

  /*
   * Static files do not need authentication.
   */
  const isPublicFile =
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/sonic_dev_logo.png";

  /*
   * API routes needed during authentication or by
   * external BigCommerce requests.
   */
  const publicApiRoutes = [
    "/api/sonic/log-in-check",
    "/api/sonic/create-account",
    "/api/sonic/forgot-password",
    "/api/sonic/confirm-email",
    "/api/sonic/validate-auth-token",
    "/api/sonic/email-confirmation-codes",
    "/api/sonic/reset-password",

    "/api/bigcommerce/order-created",
    "/api/bigcommerce/order-options",
    "/api/bigcommerce/order-shipping-address",
  ];

  const isPublicApiRoute =
    publicApiRoutes.includes(pathname);

  /*
   * Public files and API routes should pass through
   * without checking the dashboard login.
   */
  if (isPublicFile || isPublicApiRoute) {
    return NextResponse.next();
  }

  const authToken = request.cookies.get(
    "sonic_auth_token"
  )?.value;

  /*
   * Login-related page:
   *
   * - No cookie: allow the page.
   * - Valid cookie: redirect to the dashboard.
   * - Invalid cookie: clear it and allow the page.
   */
  if (isPublicPage) {
    if (!authToken) {
      return NextResponse.next();
    }

    const authenticationStatus =
      await validateAuthToken(request, authToken);

    if (
      authenticationStatus === "authenticated"
    ) {
      return NextResponse.redirect(
        createHomeRedirect(request)
      );
    }

    const response = NextResponse.next();

    /*
     * Delete the cookie only when validation explicitly
     * determines that it is invalid. Do not delete it
     * merely because the validation request temporarily
     * failed.
     */
    if (
      authenticationStatus === "unauthenticated"
    ) {
      response.cookies.delete("sonic_auth_token");
    }

    return response;
  }

  /*
   * All remaining routes are protected.
   */
  if (!authToken) {
    return NextResponse.redirect(
      createLoginRedirect(request)
    );
  }

  const authenticationStatus =
    await validateAuthToken(request, authToken);

  if (
    authenticationStatus !== "authenticated"
  ) {
    const response = NextResponse.redirect(
      createLoginRedirect(request)
    );

    if (
      authenticationStatus === "unauthenticated"
    ) {
      response.cookies.delete("sonic_auth_token");
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};