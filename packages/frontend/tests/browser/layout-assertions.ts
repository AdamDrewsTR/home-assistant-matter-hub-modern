import {
  expect,
  type Frame,
  type FrameLocator,
  type Page,
} from "@playwright/test";

export async function expectWorkspaceFits(
  page: Page,
  app: Frame | FrameLocator,
  width: number,
) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    width,
  );
  const result = await app.locator("html").evaluate((html) => ({
    width: innerWidth,
    scroll: html.scrollWidth,
    surfaces: [
      ...document.querySelectorAll(
        ".MuiDialog-paper,.MuiDialogContent-root,[role=listbox],header",
      ),
    ]
      .filter((element) => element.getBoundingClientRect().height > 0)
      .map((element) => ({
        name: element.className,
        scroll: element.scrollWidth,
        client: element.clientWidth,
      })),
    overflow: [...document.querySelectorAll("body *")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (
          !rect.width ||
          !rect.height ||
          style.visibility === "hidden" ||
          style.opacity === "0" ||
          element.closest("[hidden],[aria-hidden=true],.MuiTouchRipple-root")
        )
          return false;
        if (rect.left >= -1 && rect.right <= innerWidth + 1) return false;
        for (
          let parent = element.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          const style = getComputedStyle(parent);
          if (
            ["auto", "scroll"].includes(style.overflowX) ||
            parent.matches(
              ".react-flow, .MuiTabs-scroller, .MuiLinearProgress-root",
            ) ||
            style.textOverflow === "ellipsis" ||
            parent.matches(".MuiOutlinedInput-notchedOutline legend")
          ) {
            const bounds = parent.getBoundingClientRect();
            if (bounds.left >= -1 && bounds.right <= innerWidth + 1)
              return false;
          }
        }
        return true;
      })
      .slice(0, 8)
      .map(
        (element) =>
          `${element.tagName}.${String(element.className).split(" ").slice(0, 2).join(".")}: ${element.textContent?.slice(0, 80)}`,
      ),
  }));
  const { surfaces, ...layout } = result;
  expect(layout).toEqual({ width, scroll: width, overflow: [] });
  for (const surface of surfaces) {
    expect(surface.scroll, surface.name).toBeLessThanOrEqual(
      surface.client + 1,
    );
  }
}
