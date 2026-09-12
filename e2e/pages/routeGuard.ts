import type { Route } from "@playwright/test";

/**
 * page.route() intercepts every method by default; most mocks here only
 * care about one. Wrapping a handler in this lets unmatched methods fall
 * through instead of every mock re-writing the same method check.
 */
export function onlyMethod(
  method: string,
  handler: (route: Route) => unknown,
) {
  return (route: Route) => {
    if (route.request().method() !== method) return route.fallback();
    return handler(route);
  };
}
