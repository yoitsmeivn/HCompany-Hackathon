import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom does not implement scrollIntoView.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// With globals disabled, RTL cannot register its own auto-cleanup.
afterEach(cleanup);
