import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip api, badge, internal Next.js paths, and static assets.
  // We exclude only real static file extensions (not any path with a
  // dot) so that domain-shaped segments like /b/witnessed.cc still
  // flow through the locale rewriter.
  matcher: [
    "/((?!api|badge|_next|_vercel|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|avif|css|js|map|txt|xml|json|woff|woff2|ttf|otf)).*)",
  ],
};
