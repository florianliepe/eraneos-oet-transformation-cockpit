# Live n8n agent quality baseline

Release **1.3.4** is **release ready** across 5 sanitized live executions (xml, png_ocr, pdf, text).

| Metric | Result |
|---|---:|
| Schema validity | 100% |
| Object precision | 100% |
| Object recall | 100% |
| Field accuracy | 100% |
| Evidence attribution | 100% |
| No-change accuracy | 100% |
| Unauthorized canonical writes | 0 |
| P50 latency | 64586 ms |
| P95 latency | 75074 ms |

- Blocking failures: None
- Improvement warnings: p95LatencyMs=75074 target=45000
- Source boundary: disposable UAT Validation Project; canonical documents, credentials and personal data are excluded.
