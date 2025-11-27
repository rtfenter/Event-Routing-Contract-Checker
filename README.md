# Event Routing Contract Checker  
[![Live Demo](https://img.shields.io/badge/Live%20Demo-000?style=for-the-badge)](https://rtfenter.github.io/Event-Routing-Contract-Checker/)

### An interactive tool that validates routing rules and filtering logic before events ship, catching misrouted or silently dropped events at design time.

This project is part of my **Systems of Trust Series**, exploring how distributed systems maintain coherence, truth, and alignment across services, schemas, and teams.

The goal of this checker is to make **event routing correctness** legible — not just the shape of the event, but whether it will actually flow through the system as intended based on filtering rules, topic contracts, and routing logic.

---

## Purpose

Most routing issues don’t show up as errors.  
They show up as **absence** — events that never arrive downstream.

Routing breaks when:

- filters use wrong field names  
- rule order causes unexpected drops  
- boolean logic hides edge cases  
- topics expect stricter contracts  
- event versions aren’t recognized  
- “optional” fields are used as required routing keys  

These failures are silent and extremely costly:

- inventory doesn’t update  
- billing misses events  
- analytics lose attribution  
- state machines stall  
- retries clog pipelines  

This tool exposes routing correctness before events ever leave the producer.

---

## Features (MVP)

This prototype includes:

- **Routing Rule Builder** – select fields, operators, and values to simulate real filter logic  
- **Event Payload Preview** – choose or edit a sample event to test routing paths  
- **Rule Evaluation Trace** – visual trace of which rules pass/fail for the chosen event  
- **Routing Decision Graph** – shows exactly which topics/queues/services the event will reach  
- **Contract Mismatch Flags** – detect mismatches between event fields and routing requirements  
- **Silent Drop Detection** – highlight cases where the event satisfies no routing rule  
- **Lightweight client-side experience** – static HTML + JS, no backend required  

This tool focuses on routing correctness, not full event governance or schema management — intentionally minimal and high-signal.

---

## Demo Screenshot

<img width="2804" height="1908" alt="Screenshot 2025-11-24 at 09-07-10 Event Routing Contract Checker" src="https://github.com/user-attachments/assets/20c35d1c-5cd2-49ea-b705-ee36a8f3039e" />

---

## Routing Decision Flow Diagram

```
    Incoming Event (v1 or v2)
           |
           v
      Routing Logic
     (filters, conditions,
      rule ordering)
           |
    ┌──────────────┬───────────────┬────────────────┐
    v              v               v
 Topic A        Topic B        Dead Letter / Drop
   |              |                  |
 Consumers       Pipelines      (no match, silent)
   |              |
 Downstream     Analytics
 Services       Storage
```

The checker simulates these routing paths and surfaces any rule or contract violations.

---

## Why Routing Contracts Matter

Routing is where “we thought it would flow” and “what actually happens” diverge.

Common silent failures include:

- the wrong field is used in a filter (`order_status` vs `status`)  
- enums differ between routing logic and the event schema  
- rule ordering causes later rules to never fire  
- type mismatches break numeric comparisons  
- event version changes invalidate filters  
- topics expect fields that the event no longer emits  

Because routing almost never throws errors, teams don’t discover issues until:

- dashboards drop to zero  
- consumers see missing updates  
- services desynchronize  
- backfills become necessary  
- audits reveal missing records  

Routing correctness is a trust layer — not infrastructure noise.

This tool surfaces routing issues before they hit production.

---

## How This Maps to Real Systems

Each component corresponds to a real architectural concern:

### Rule Definition & Evaluation  
Routing rules often evolve faster than schemas:

- filtering on removed or repurposed fields  
- boolean logic accidentally shadowing conditions  
- rules applied in incorrect order  
- OR/AND combinations creating blind spots  

The checker evaluates rules exactly as the system does, making implicit logic explicit.

### Contract Alignment  
Topic-level contracts often require:

- specific field presence  
- enum value compatibility  
- version recognition (`"event_version": "2"`)  
- invariant assumptions (e.g., amounts must be numeric)  

Mismatch between event shape and contract leads to misrouted or dropped events.

### Event Simulation  
Testing routing with a real or synthetic event reveals:

- which rules fire  
- which topics will publish  
- whether any consumer receives the event  
- whether the event silently dies  

This simulation de-risks changes early in the development cycle.

### Drop Detection  
The most important case is also the quietest:

**No routing rules match.**

The event disappears.  
No logs.  
No errors.  
Nothing downstream updates.

The tool treats silent drops as first-class failures, surfacing them in the UI.

---

## Part of the Systems of Trust Series

Main repo:  
https://github.com/rtfenter/Systems-of-Trust-Series

---

## Status

MVP is implemented and active.  
This prototype will focus on **rule evaluation, contract mismatch detection, and routing simulation**, not a full event bus configuration system.

---
## Local Use

Everything runs client-side.

To run locally (once the prototype is implemented):

1. Clone the repo  
2. Open `index.html` in your browser  

That’s it — static HTML + JS, no backend required.
