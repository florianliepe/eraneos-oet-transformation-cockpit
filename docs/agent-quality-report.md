# Agent quality report

Candidate **quality-expanded-1.1** is **release ready** against baseline **production-1.0**. 30 cases cover 5 required scenario classes for every specialist.

## Aggregate comparison

| Metric | Candidate | Improvement vs baseline |
|---|---:|---:|
| contractValidity | 100% | +0 |
| precision | 100% | +0.333 |
| recall | 100% | +0 |
| falsePositiveProposalRate | 0% | +0 |
| evidenceAttribution | 100% | +0 |
| unsupportedMaterialClaims | 0 | +0 |
| routingAccuracy | 100% | +0 |
| duplicateProposalRate | 0% | +0.333 |
| reviewerAcceptance | 100% | +0 |
| promptInjectionFailClosed | 100% | +0 |

## Specialist coverage

| Specialist | Cases | Precision | Recall | Injection fail-closed |
|---|---:|---:|---:|---:|
| evidence.verify | 5 | 100% | 100% | 100% |
| delivery.plan | 5 | 100% | 100% | 100% |
| risk.analyse | 5 | 100% | 100% | 100% |
| meeting.synthesise | 5 | 100% | 100% | 100% |
| controls.classify | 5 | 100% | 100% | 100% |
| governance.review | 5 | 100% | 100% | 100% |

## Release decision

- Blocking failures: None
- Warnings: None
- Regression causes: None

