import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip api, badge, static assets and favicon.
  matcher: ["/((?!api|badge|_next|_vercel|.*\\..*).*)"],
};
