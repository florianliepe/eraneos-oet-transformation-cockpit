import JSZip from "jszip";
import type { SteercoClaim, SteercoSnapshot } from "./steerco-schema";

const xml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const textRuns = (lines: string[]) => lines.map((line, index) => `<a:p><a:r><a:rPr lang="en-GB" sz="${index === 0 ? 2600 : 1500}" b="${index === 0 ? 1 : 0}"/><a:t>${xml(line)}</a:t></a:r><a:endParaRPr lang="en-GB"/></a:p>`).join("");
const slide = (lines: string[]) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="F4F1EE"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Report content"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="514350"/><a:ext cx="10820400" cy="5829300"/></a:xfrm><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${textRuns(lines)}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
const claims = (items: SteercoClaim[]) => items.slice(0, 7).map((item) => `${item.text} [${item.sourceIds.join(", ") || item.judgementBasis || "judgement"}]`);

export function assertExportableSnapshot(snapshot: SteercoSnapshot) {
  if (!["approved", "published", "revoked"].includes(snapshot.status)) throw new Error("Only reviewed snapshots can be exported.");
  if (!snapshot.approvedBy || !snapshot.approvedAt) throw new Error("Accountable approval metadata is required for export.");
}

export async function buildSteercoPowerPoint(snapshot: SteercoSnapshot): Promise<Uint8Array> {
  assertExportableSnapshot(snapshot);
  const sourceIds = new Set([...snapshot.executiveSummary, ...Object.values(snapshot.sections).flat(), ...snapshot.reporting.materialChanges].flatMap((item) => item.sourceIds));
  const slides = [
    ["Eraneos Transformation Cockpit", `Steering Committee report · ${snapshot.period.label}`, `Status: ${snapshot.rag.effective.toUpperCase()}`, `Approved by ${snapshot.approvedBy}`, `Snapshot ${snapshot.id} · revision ${snapshot.revision}`],
    ["Executive summary", ...claims(snapshot.executiveSummary)],
    ["Material changes and trends", ...snapshot.reporting.trends.map((item) => `${item.label}: ${item.current} ${item.unit} · ${item.direction}`), ...claims(snapshot.reporting.materialChanges)],
    ["Decisions, benefits and scenarios", ...claims([...snapshot.sections.decisions, ...snapshot.sections.benefits, ...snapshot.sections.scenarios])],
    ["Evidence and reproducibility", `Source PMO revision: ${snapshot.sourceRevision.pmo}`, `Evidence: ${[...sourceIds].sort().join(", ")}`, `AI contract: ${snapshot.generatedWith.model} · ${snapshot.generatedWith.promptVersion}`, `Approval: ${snapshot.approvedBy} · ${snapshot.approvedAt}`],
  ];
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`);
  zip.file("ppt/presentation.xml", `<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join("")}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
  zip.file("ppt/_rels/presentation.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slides.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join("")}</Relationships>`);
  slides.forEach((content, i) => zip.file(`ppt/slides/slide${i + 1}.xml`, slide(content)));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export function downloadSteercoPowerPoint(snapshot: SteercoSnapshot) {
  void buildSteercoPowerPoint(snapshot).then((content) => {
    const blob = new Blob([content as BlobPart], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `${snapshot.id}-r${snapshot.revision}.pptx`; link.click(); URL.revokeObjectURL(link.href);
  });
}
