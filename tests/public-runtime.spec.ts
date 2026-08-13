import { expect, test } from "@playwright/test";
import { defaultPmoWorkflowUrl, leanUatPmoWorkflowUrl, publicWorkflowEndpoint, selectedPmoWorkflowUrl } from "../src/lib/public-runtime";

test("accepts only approved HTTPS webhook endpoints", () => {
  expect(publicWorkflowEndpoint(undefined, defaultPmoWorkflowUrl)).toBe(defaultPmoWorkflowUrl);
  expect(publicWorkflowEndpoint("https://workflow.test/webhook/pmo")).toBe("https://workflow.test/webhook/pmo");
  expect(() => publicWorkflowEndpoint("http://workflow.test/webhook/pmo")).toThrow(/outside the approved/);
  expect(() => publicWorkflowEndpoint("https://example.com/webhook/pmo")).toThrow(/outside the approved/);
  expect(() => publicWorkflowEndpoint("https://workflow.test/api/pmo")).toThrow(/outside the approved/);
});

test("keeps the default runtime unless the explicit lean UAT switch is present", () => {
  expect(selectedPmoWorkflowUrl("https://workflow.test/webhook/current")).toBe("https://workflow.test/webhook/current");
  expect(leanUatPmoWorkflowUrl).toContain("/webhook/8d92d8ef-4267-4e67-88e8-8daab51c9361");
});
