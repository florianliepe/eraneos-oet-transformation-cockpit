import { migratePmoDocument, type PmoDocument } from "@/lib/pmo-schema";
import { defaultPmoWorkflowUrl, publicWorkflowEndpoint } from "@/lib/public-runtime";
import { AgentRunEnvelopeSchema, legacyAgentRun, type AgentRunEnvelope } from "@/lib/agent-contracts";
import {
  ProposalPublicationSchema,
  ProposalSetSchema,
  ReviewBundleSchema,
  buildReviewBundle,
  type DecisionInput,
  type ProposalPublication,
  type ProposalSet,
  type ReviewBundle,
} from "@/lib/governed-proposals";
import type { WorkspaceScope } from "@/lib/project-data-repository";
import { credentialRequired, newCorrelationId, readWorkflowResponse, workflowError } from "@/lib/operational-quality";
import { AgentOutcomeUnknownError, AgentRunAcceptedResponseSchema, AgentRunStatusResponseSchema, type AgentRunReceipt } from "@/lib/agent-run-reconciliation";

const MAX_BATCH_BYTES = 29 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".json", ".md", ".txt", ".csv", ".xlsx", ".png", ".jpg", ".jpeg"]);

export type PmoApiResponse = {
  ok?: boolean;
  source?: "github" | "bootstrap";
  storageConfigured?: boolean;
  document?: PmoDocument;
  error?: string;
  commit?: { sha?: string; url?: string };
};

export type WorkflowIntakeResponse = {
  ok?: boolean;
  error?: string;
  wpId?: string;
  committedFiles?: string[];
  needs_review?: string[];
  document?: PmoDocument;
  appliedChanges?: Array<{ entity: string; action: string; id?: string; summary?: string }>;
  agentRun?: AgentRunEnvelope;
  proposalSet?: ProposalSet;
  commit?: { sha?: string; url?: string };
};

export type ProposalReviewResponse = { ok?: boolean; error?: string; reviewBundle?: ReviewBundle; commit?: { sha?: string; url?: string } };
export type ProposalPublishResponse = ProposalPublication & { document?: PmoDocument };

export type ExtractedEvidence = {
  name: string;
  type: "text" | "json" | "docx_text" | "xlsx" | "pdf_text" | "image_ocr" | "text_update";
  content: string;
  mediaType?: string;
  size?: number;
  contentHash?: string;
};

function webhookUrl() {
  return publicWorkflowEndpoint(process.env.NEXT_PUBLIC_N8N_PMO_WEBHOOK_URL, defaultPmoWorkflowUrl);
}

function extension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function unwrap<T>(raw: unknown): T {
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (first && typeof first === "object" && "json" in first) {
      return (first as { json: T }).json;
    }
    return first as T;
  }
  return raw as T;
}

async function callWorkflow<T>(secret: string, body: unknown, requestCorrelationId?: string): Promise<T> {
  const normalizedSecret = secret.trim();
  if (!normalizedSecret) throw credentialRequired("pmo_workflow");
  const correlationId = requestCorrelationId || newCorrelationId();

  let response: Response;
  try { response = await fetch(webhookUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-n8n-webhook-secret": normalizedSecret,
      "x-correlation-id": correlationId,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  }); } catch (cause) { throw workflowError({ component: "pmo_workflow", correlationId, cause }); }

  const raw: unknown = await readWorkflowResponse(response, "pmo_workflow", correlationId);
  const payload = unwrap<T & { error?: string }>(raw);
  return payload;
}

async function normalizeDocument<T extends { document?: unknown }>(payload: T): Promise<Omit<T, "document"> & { document?: PmoDocument }> {
  return payload.document ? { ...payload, document: migratePmoDocument(payload.document) } : payload as Omit<T, "document"> & { document?: PmoDocument };
}

export async function loadPmoDocument(secret: string, workspace: WorkspaceScope) {
  return normalizeDocument(await callWorkflow<PmoApiResponse>(secret, { mode: "pmo.read", workspace }));
}

export async function savePmoDocument(secret: string, document: PmoDocument, workspace: WorkspaceScope) {
  return normalizeDocument(await callWorkflow<PmoApiResponse>(secret, { mode: "pmo.save", workspace, document }));
}

export async function reviewAndPublishProposalSet(secret: string, proposalSet: ProposalSet, reviewer: string, decisions: DecisionInput[], expectedRevision: number, workspace: WorkspaceScope) {
  const reviewBundle = buildReviewBundle(proposalSet, reviewer, decisions);
  const reviewed = await callWorkflow<ProposalReviewResponse>(secret, { mode: "pmo.review", workspace, proposalSetId: proposalSet.id, reviewBundle });
  if (!reviewed.ok || !reviewed.reviewBundle) throw new Error(reviewed.error || "The governed review could not be recorded.");
  const storedReview = ReviewBundleSchema.parse(reviewed.reviewBundle);
  const idempotencyKey = storedReview.id.replace(/[^A-Za-z0-9-]/g, "-").slice(0, 80);
  const published = await callWorkflow<ProposalPublishResponse>(secret, {
    mode: "pmo.publish",
    workspace,
    proposalSetId: proposalSet.id,
    reviewBundleId: storedReview.id,
    actor: reviewer,
    expectedRevision,
    idempotencyKey,
  });
  const parsed = ProposalPublicationSchema.parse(published);
  return normalizeDocument({ ...published, ...parsed });
}

export async function extractEvidence(files: File[]): Promise<ExtractedEvidence[]> {
  if (files.length > 20) throw new Error("A maximum of 20 evidence files is allowed.");
  if (files.reduce((total, file) => total + file.size, 0) > MAX_BATCH_BYTES) {
    throw new Error("The evidence batch exceeds 29 MB.");
  }

  const extracted: ExtractedEvidence[] = [];
  for (const file of files) {
    const ext = extension(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext)) throw new Error(`Unsupported file type: ${file.name}`);

    const bytes = await file.arrayBuffer();
    const contentHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
      .map((value) => value.toString(16).padStart(2, "0")).join("");
    const metadata = { mediaType: file.type || "application/octet-stream", size: file.size, contentHash };

    if (ext === ".md" || ext === ".txt" || ext === ".csv") {
      extracted.push({ name: file.name, type: "text", content: new TextDecoder().decode(bytes), ...metadata });
      continue;
    }

    if (ext === ".json") {
      const raw = new TextDecoder().decode(bytes);
      let content = raw;
      try { content = JSON.stringify(JSON.parse(raw), null, 2); }
      catch { throw new Error(`Invalid JSON document: ${file.name}`); }
      extracted.push({ name: file.name, type: "json", content, ...metadata });
      continue;
    }

    if (ext === ".docx") {
      const { default: JSZip } = await import("jszip");
      const zip = await JSZip.loadAsync(bytes);
      const documentXml = await zip.file("word/document.xml")?.async("string");
      if (!documentXml) throw new Error(`DOCX has no readable document body: ${file.name}`);
      const xml = new DOMParser().parseFromString(documentXml, "application/xml");
      const paragraphs = Array.from(xml.getElementsByTagNameNS("*", "p")).map((paragraph) =>
        Array.from(paragraph.getElementsByTagNameNS("*", "t")).map((node) => node.textContent || "").join(""),
      ).filter(Boolean);
      extracted.push({ name: file.name, type: "docx_text", content: paragraphs.join("\n"), ...metadata });
      continue;
    }

    if (ext === ".xlsx") {
      const { default: readExcelFile } = await import("read-excel-file/browser");
      const sheets = await readExcelFile(file);
      const content = sheets.map(({ sheet, data }) => {
        const csv = data.map((row) => row.map((cell) => {
          const value = cell instanceof Date ? cell.toISOString() : String(cell ?? "");
          return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
        }).join(",")).join("\n");
        return `## Sheet: ${sheet}\n${csv}`;
      }).join("\n\n");
      extracted.push({ name: file.name, type: "xlsx", content, ...metadata });
      continue;
    }

    if (ext === ".pdf") {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items.map((item) => "str" in item ? item.str : "").join(" ");
        pages.push(`## Page ${pageNumber}\n${text}`);
      }
      extracted.push({ name: file.name, type: "pdf_text", content: pages.join("\n\n"), ...metadata });
      continue;
    }

    const Tesseract = await import("tesseract.js");
    const result = await Tesseract.recognize(file, "eng");
    extracted.push({ name: file.name, type: "image_ocr", content: result.data.text || "", ...metadata });
  }
  return extracted;
}

export async function ingestEvidence(
  secret: string,
  meta: Record<string, string>,
  files: File[],
  workspace: WorkspaceScope,
  textUpdate = "",
  onProgress?: (receipt: AgentRunReceipt) => void,
) {
  const extracted = await extractEvidence(files);
  if (textUpdate.trim()) {
    extracted.unshift({ name: "workbench-update.md", type: "text_update", content: textUpdate.trim() });
  }
  if (extracted.length === 0) throw new Error("Add at least one document or written update.");
  const correlationId = meta.correlation_id || newCorrelationId();
  const idempotencyKey = meta.idempotency_key || correlationId;
  const requestMeta = { ...meta, correlation_id: correlationId, idempotency_key: idempotencyKey, organisation_id: workspace.organisationId, project_id: workspace.projectId };
  const started = await callWorkflow<WorkflowIntakeResponse & { agentRun?: unknown; accepted?: boolean; run?: unknown }>(secret, { mode: "pmo.ingest", workspace, meta: requestMeta, extracted }, correlationId);
  let raw: WorkflowIntakeResponse & { agentRun?: unknown };
  if (started.accepted && started.run) {
    let receipt = AgentRunAcceptedResponseSchema.parse({ ok: true, accepted: true, run: started.run }).run;
    onProgress?.(receipt);
    const deadline = Date.now() + 8 * 60 * 1000;
    let transientFailures = 0;
    while (receipt.state === "accepted" || receipt.state === "running") {
      if (Date.now() >= deadline) throw new AgentOutcomeUnknownError(receipt);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const status = await callWorkflow<unknown>(secret, { mode: "pmo.run.status", workspace, runId: receipt.runId, correlationId, idempotencyKey }, correlationId);
        receipt = AgentRunStatusResponseSchema.parse(status).run;
        transientFailures = 0;
        onProgress?.(receipt);
      } catch (reason) {
        transientFailures += 1;
        if (transientFailures >= 3) throw new AgentOutcomeUnknownError(receipt);
        if (!(reason instanceof Error)) throw reason;
      }
    }
    if (receipt.state === "failed") throw new Error(receipt.error?.safeMessage || "The governed workflow run failed.");
    raw = receipt.result as WorkflowIntakeResponse & { agentRun?: unknown };
  } else {
    raw = started;
  }
  const parsedRun = AgentRunEnvelopeSchema.safeParse(raw.agentRun);
  const fallbackRun = legacyAgentRun({
    meta: requestMeta,
    evidence: extracted.map((item) => ({ name: item.name, contentHash: item.contentHash })),
    appliedChanges: raw.appliedChanges,
    needsReview: raw.needs_review,
    revision: raw.document?.revision,
    commitSha: raw.commit?.sha,
    wpId: raw.wpId,
  });
  const response: WorkflowIntakeResponse = {
    ...raw,
    proposalSet: raw.proposalSet ? ProposalSetSchema.parse(raw.proposalSet) : undefined,
    agentRun: parsedRun.success ? parsedRun.data : AgentRunEnvelopeSchema.parse({ ...fallbackRun, executionId: `agent:${idempotencyKey}`, correlationId }),
  };
  return normalizeDocument(response);
}
