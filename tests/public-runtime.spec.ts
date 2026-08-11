import { expect, test } from "@playwright/test";
import { defaultPmoWorkflowUrl, publicWorkflowEndpoint } from "../src/lib/public-runtime";

test("accepts only approved HTTPS webhook endpoints", () => {
  expect(publicWorkflowEndpoint(undefined, defaultPmoWorkflowUrl)).toBe(defaultPmoWorkflowUrl);
  expect(publicWorkflowEndpoint("https://workflow.test/webhook/pmo")).toBe("https://workflow.test/webhook/pmo");
  expect(() => publicWorkflowEndpoint("http://workflow.test/webhook/pmo")).toThrow(/outside the approved/);
  expect(() => publicWorkflowEndpoint("https://example.com/webhook/pmo")).toThrow(/outside the approved/);
  expect(() => publicWorkflowEndpoint("https://workflow.test/api/pmo")).toThrow(/outside the approved/);
});
