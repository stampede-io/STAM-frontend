import { test as base } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route("**/api/v1/oauth2/refresh", (route) =>
      route.fulfill({ status: 401, body: "no session" }),
    );
    await use(page);
  },
});

export { expect } from "@playwright/test";
