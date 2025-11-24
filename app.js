// Routing scenarios: each one defines sample events and routing rules.
const ROUTING_SCENARIOS = [
  {
    id: "orders-routing",
    label: "Orders – status & channel routing",
    description:
      "Order events are routed to billing, fulfillment, and analytics based on status, fulfillment type, and channel.",
    events: [
      {
        id: "order_paid_web_physical",
        label: "OrderPlaced – PAID, WEB, physical (healthy)",
        payload: {
          type: "OrderPlaced",
          version: 1,
          order_id: "ord_123",
          status: "PAID",
          channel: "WEB",
          fulfillment_type: "PHYSICAL",
          shipping_region: "US",
          total_amount_minor: 12900,
          currency: "USD"
        }
      },
      {
        id: "order_paid_missing_fields",
        label: "OrderPlaced – PAID, missing currency & shipping_region",
        payload: {
          type: "OrderPlaced",
          version: 1,
          order_id: "ord_456",
          status: "PAID",
          channel: "API",
          fulfillment_type: "PHYSICAL",
          // shipping_region missing
          total_amount_minor: 4800
          // currency missing
        }
      },
      {
        id: "inventory_adjusted",
        label: "InventoryAdjusted – unrecognized by routing rules",
        payload: {
          type: "InventoryAdjusted",
          version: 1,
          sku: "sku-001",
          delta: -2,
          reason: "shipment"
        }
      }
    ],
    routes: [
      {
        id: "paid_to_billing",
        label: "Paid orders → Billing Invoices",
        expressionDisplay: 'type === "OrderPlaced" && status === "PAID"',
        targets: [
          { id: "topic-billing", label: "billing.invoices", kind: "topic" }
        ],
        contract: {
          requiredFields: [
            "type",
            "status",
            "order_id",
            "total_amount_minor",
            "currency"
          ],
          allowedValues: {
            status: ["PAID"]
          }
        },
        evaluate: (event) =>
          event.type === "OrderPlaced" && event.status === "PAID"
      },
      {
        id: "physical_to_fulfillment",
        label: "Physical orders → Fulfillment Queue",
        expressionDisplay:
          'type === "OrderPlaced" && fulfillment_type === "PHYSICAL"',
        targets: [
          { id: "queue-fulfillment", label: "fulfillment.queue", kind: "queue" }
        ],
        contract: {
          requiredFields: ["type", "order_id", "fulfillment_type", "shipping_region"],
          allowedValues: {}
        },
        evaluate: (event) =>
          event.type === "OrderPlaced" && event.fulfillment_type === "PHYSICAL"
      },
      {
        id: "all_orders_to_analytics",
        label: "All OrderPlaced → Analytics Stream",
        expressionDisplay: 'type === "OrderPlaced"',
        targets: [
          { id: "topic-analytics", label: "analytics.orders", kind: "topic" }
        ],
        contract: {
          requiredFields: ["type", "order_id", "status", "channel"],
          allowedValues: {}
        },
        evaluate: (event) => event.type === "OrderPlaced"
      }
      // Note: no DLQ rule here on purpose, to show a true silent drop case.
    ]
  },
  {
    id: "user-events-routing",
    label: "User events – region & PII-aware routing",
    description:
      "User activity events are routed to marketing, risk, or audit sinks based on region and consent flags.",
    events: [
      {
        id: "page_view_eu_with_consent",
        label: "UserPageView – EU user with marketing consent",
        payload: {
          type: "UserPageView",
          version: 2,
          user_id: "user_001",
          region: "EU",
          path: "/pricing",
          marketing_consent: true
        }
      },
      {
        id: "page_view_eu_no_consent",
        label: "UserPageView – EU user without marketing consent",
        payload: {
          type: "UserPageView",
          version: 2,
          user_id: "user_002",
          region: "EU",
          path: "/home",
          marketing_consent: false
        }
      },
      {
        id: "page_view_us",
        label: "UserPageView – US user (marketing opt-in implied)",
        payload: {
          type: "UserPageView",
          version: 2,
          user_id: "user_003",
          region: "US",
          path: "/checkout",
          // marketing_consent omitted (treated as implied opt-in for US)
        }
      }
    ],
    routes: [
      {
        id: "eu_marketing",
        label: "EU users with consent → EU Marketing Bus",
        expressionDisplay:
          'type === "UserPageView" && region === "EU" && marketing_consent === true',
        targets: [
          { id: "topic-eu-marketing", label: "marketing.eu.events", kind: "topic" }
        ],
        contract: {
          requiredFields: ["type", "user_id", "region", "marketing_consent"],
          allowedValues: {
            region: ["EU"]
          }
        },
        evaluate: (event) =>
          event.type === "UserPageView" &&
          event.region === "EU" &&
          event.marketing_consent === true
      },
      {
        id: "us_marketing",
        label: "Non-EU views → Global Marketing Bus",
        expressionDisplay:
          'type === "UserPageView" && region !== "EU"',
        targets: [
          { id: "topic-global-marketing", label: "marketing.global.events", kind: "topic" }
        ],
        contract: {
          requiredFields: ["type", "user_id", "region"],
          allowedValues: {}
        },
        evaluate: (event) =>
          event.type === "UserPageView" && event.region && event.region !== "EU"
      },
      {
        id: "eu_no_consent_to_risk",
        label: "EU without consent → Risk & Audit",
        expressionDisplay:
          'type === "UserPageView" && region === "EU" && marketing_consent === false',
        targets: [
          { id: "topic-risk", label: "risk.user.events", kind: "topic" },
          { id: "topic-audit", label: "audit.user.events", kind: "topic" }
        ],
        contract: {
          requiredFields: ["type", "user_id", "region", "marketing_consent"],
          allowedValues: {
            region: ["EU"]
          }
        },
        evaluate: (event) =>
          event.type === "UserPageView" &&
          event.region === "EU" &&
          event.marketing_consent === false
      }
    ]
  }
];

const IMPACT_LABELS = {
  low: "Low impact",
  medium: "Medium impact",
  high: "High impact"
};

function init() {
  const scenarioSelect = document.getElementById("scenario-select");
  const eventSelect = document.getElementById("event-select");
  const scenarioDescriptionEl = document.getElementById("scenario-description");
  const summaryBadge = document.getElementById("summary-badge");
  const eventJsonEl = document.getElementById("event-json");
  const routingMapContainer = document.getElementById("routing-map-container");
  const detailsCard = document.getElementById("details-card");

  // Populate scenario dropdown
  ROUTING_SCENARIOS.forEach((scenario, index) => {
    const option = document.createElement("option");
    option.value = scenario.id;
    option.textContent = scenario.label;
    if (index === 0) option.selected = true;
    scenarioSelect.appendChild(option);
  });

  // Helper: get current selected scenario
  function getSelectedScenario() {
    const id = scenarioSelect.value;
    return ROUTING_SCENARIOS.find((s) => s.id === id) || ROUTING_SCENARIOS[0];
  }

  // Populate event dropdown for given scenario
  function populateEvents(scenario) {
    eventSelect.innerHTML = "";
    (scenario.events || []).forEach((evt, index) => {
      const option = document.createElement("option");
      option.value = evt.id;
      option.textContent = evt.label;
      if (index === 0) option.selected = true;
      eventSelect.appendChild(option);
    });
  }

  function getSelectedEvent(scenario) {
    const id = eventSelect.value;
    return (scenario.events || []).find((e) => e.id === id) || scenario.events[0];
  }

  function render() {
    const scenario = getSelectedScenario();
    if (!scenario || !scenario.events || !scenario.events.length) return;

    populateEvents(scenario);
    const event = getSelectedEvent(scenario);

    scenarioDescriptionEl.textContent = scenario.description;
    eventJsonEl.textContent = JSON.stringify(event.payload, null, 2);

    const evaluation = evaluateRouting(scenario, event);

    renderSummary(evaluation, summaryBadge);
    renderRoutingMap(evaluation, routingMapContainer);
    renderDetails(evaluation, detailsCard);
  }

  // Initial render
  if (ROUTING_SCENARIOS.length > 0) {
    populateEvents(ROUTING_SCENARIOS[0]);
    const scenario = ROUTING_SCENARIOS[0];
    const event = scenario.events[0];
    scenarioDescriptionEl.textContent = scenario.description;
    eventJsonEl.textContent = JSON.stringify(event.payload, null, 2);

    const evaluation = evaluateRouting(scenario, event);
    renderSummary(evaluation, summaryBadge);
    renderRoutingMap(evaluation, routingMapContainer);
    renderDetails(evaluation, detailsCard);
  }

  scenarioSelect.addEventListener("change", () => {
    const scenario = getSelectedScenario();
    if (!scenario) return;
    populateEvents(scenario);
    const event = getSelectedEvent(scenario);
    scenarioDescriptionEl.textContent = scenario.description;
    eventJsonEl.textContent = JSON.stringify(event.payload, null, 2);

    const evaluation = evaluateRouting(scenario, event);
    renderSummary(evaluation, summaryBadge);
    renderRoutingMap(evaluation, routingMapContainer);
    renderDetails(evaluation, detailsCard);
  });

  eventSelect.addEventListener("change", () => {
    const scenario = getSelectedScenario();
    if (!scenario) return;
    const event = getSelectedEvent(scenario);
    eventJsonEl.textContent = JSON.stringify(event.payload, null, 2);

    const evaluation = evaluateRouting(scenario, event);
    renderSummary(evaluation, summaryBadge);
    renderRoutingMap(evaluation, routingMapContainer);
    renderDetails(evaluation, detailsCard);
  });
}

// Evaluate routing for a scenario + event
function evaluateRouting(scenario, event) {
  const payload = event.payload || {};
  const routeResults = (scenario.routes || []).map((route) => {
    const matched = !!route.evaluate(payload);
    const violations = [];

    if (matched && route.contract) {
      const contract = route.contract;

      // Required fields
      if (contract.requiredFields && contract.requiredFields.length) {
        contract.requiredFields.forEach((field) => {
          if (payload[field] === undefined || payload[field] === null) {
            violations.push(`Missing required field "${field}".`);
          }
        });
      }

      // Allowed values
      if (contract.allowedValues) {
        Object.entries(contract.allowedValues).forEach(([field, allowed]) => {
          if (
            payload[field] !== undefined &&
            payload[field] !== null &&
            !allowed.includes(payload[field])
          ) {
            violations.push(
              `Field "${field}" has value "${payload[field]}", which is outside the allowed set: ${allowed.join(
                ", "
              )}.`
            );
          }
        });
      }
    }

    const targets = matched ? route.targets || [] : [];
    return { route, matched, violations, targets };
  });

  const matchedRoutes = routeResults.filter((r) => r.matched);
  const destinationsSet = new Set();
  matchedRoutes.forEach((r) => {
    (r.targets || []).forEach((t) => destinationsSet.add(t.label));
  });
  const destinations = Array.from(destinationsSet);
  const silentDrop = matchedRoutes.length === 0;
  const hasViolations = routeResults.some(
    (r) => r.matched && r.violations && r.violations.length > 0
  );

  return {
    scenario,
    event,
    routeResults,
    matchedRoutes,
    destinations,
    silentDrop,
    hasViolations
  };
}

function renderSummary(evaluation, summaryBadge) {
  const { matchedRoutes, destinations, silentDrop, hasViolations } = evaluation;

  let level = "low";
  let text = "";

  if (silentDrop) {
    level = "high";
    text =
      '<span class="count">0 matching routes</span> · High impact · Event will be silently dropped';
  } else if (hasViolations) {
    level = "medium";
    text = `<span class="count">${matchedRoutes.length} matching route${
      matchedRoutes.length === 1 ? "" : "s"
    }</span> · Medium impact · ${destinations.length} destination${
      destinations.length === 1 ? "" : "s"
    } · Contract issues detected`;
  } else {
    level = "low";
    text = `<span class="count">${matchedRoutes.length} matching route${
      matchedRoutes.length === 1 ? "" : "s"
    }</span> · Low impact · ${destinations.length} destination${
      destinations.length === 1 ? "" : "s"
    } · No critical issues detected`;
  }

  summaryBadge.className = "summary-badge";
  summaryBadge.classList.add(`summary-badge-${level}`);
  summaryBadge.innerHTML = text;
}

function renderRoutingMap(evaluation, container) {
  container.innerHTML = "";

  const { scenario, routeResults, silentDrop } = evaluation;

  if (!scenario.routes || !scenario.routes.length) {
    const empty = document.createElement("p");
    empty.className = "map-empty";
    empty.textContent = "No routing rules defined for this scenario.";
    container.appendChild(empty);
    return;
  }

  const header = document.createElement("div");
  header.className = "routing-map-header";

  const title = document.createElement("p");
  title.className = "routing-map-title";
  title.textContent = "Routing paths from event to destinations";

  const note = document.createElement("p");
  note.className = "routing-map-note";
  note.textContent =
    "Each row shows the event passing (or failing) through a routing rule into its destinations.";
  header.appendChild(title);
  header.appendChild(note);

  container.appendChild(header);

  const lanes = document.createElement("div");
  lanes.className = "routing-lanes";

  routeResults.forEach((result) => {
    const lane = document.createElement("div");
    lane.className = "routing-lane";

    // Event node
    const eventNode = document.createElement("div");
    eventNode.className = "routing-node routing-node-event";
    eventNode.innerHTML = `
      <div class="routing-node-title">Incoming Event</div>
      <div class="routing-node-subtitle">${evaluation.event.label}</div>
    `;
    lane.appendChild(eventNode);

    const arrow1 = document.createElement("span");
    arrow1.className = "connector-arrow";
    arrow1.textContent = "→";
    lane.appendChild(arrow1);

    // Route node
    const routeNode = document.createElement("div");
    routeNode.className = "routing-node";
    routeNode.classList.add(
      result.matched ? "routing-node-route-pass" : "routing-node-route-fail"
    );

    const routeStatusPill = document.createElement("span");
    routeStatusPill.className = "routing-node-pill";
    routeStatusPill.classList.add(
      result.matched ? "routing-node-pill-pass" : "routing-node-pill-fail"
    );
    routeStatusPill.textContent = result.matched ? "MATCH" : "NO MATCH";

    routeNode.innerHTML = `
      <div class="routing-node-title">${result.route.label}</div>
      <div class="routing-node-subtitle">${result.route.expressionDisplay}</div>
    `;
    routeNode.appendChild(routeStatusPill);

    lane.appendChild(routeNode);

    if (result.matched && result.targets && result.targets.length > 0) {
      const arrow2 = document.createElement("span");
      arrow2.className = "connector-arrow";
      arrow2.textContent = "→";
      lane.appendChild(arrow2);

      result.targets.forEach((target) => {
        const destNode = document.createElement("div");
        destNode.className =
          "routing-node routing-node-destination";

        const pill = document.createElement("span");
        pill.className =
          "routing-node-pill routing-node-pill-destination";
        pill.textContent = target.kind || "destination";

        destNode.innerHTML = `
          <div class="routing-node-title">${target.label}</div>
          <div class="routing-node-subtitle">Target</div>
        `;
        destNode.appendChild(pill);

        lane.appendChild(destNode);
      });
    } else if (!result.matched && silentDrop) {
      // Only show an explicit drop node on lanes when nothing matches at all
      const arrow2 = document.createElement("span");
      arrow2.className = "connector-arrow";
      arrow2.textContent = "→";
      lane.appendChild(arrow2);

      const dropNode = document.createElement("div");
      dropNode.className = "routing-node routing-node-drop";
      dropNode.innerHTML = `
        <div class="routing-node-title">No Route</div>
        <div class="routing-node-subtitle">Event is dropped for this rule set</div>
        <span class="routing-node-pill routing-node-pill-fail">SILENT DROP RISK</span>
      `;
      lane.appendChild(dropNode);
    }

    lanes.appendChild(lane);
  });

  container.appendChild(lanes);
}

function renderDetails(evaluation, detailsCard) {
  const { routeResults, scenario } = evaluation;

  detailsCard.innerHTML = "";

  const title = document.createElement("h3");
  title.textContent = "Rule Evaluation & Contract Checks";
  detailsCard.appendChild(title);

  const meta = document.createElement("p");
  meta.className = "details-meta";
  meta.textContent = `${routeResults.length} routing rule${
    routeResults.length === 1 ? "" : "s"
  } evaluated for scenario "${scenario.label}".`;
  detailsCard.appendChild(meta);

  // Rule evaluation section
  const rulesSection = document.createElement("div");
  rulesSection.className = "details-section";

  const rulesTitle = document.createElement("h4");
  rulesTitle.textContent = "Rule Evaluation Trace";
  rulesSection.appendChild(rulesTitle);

  const rulesList = document.createElement("ul");
  routeResults.forEach((result) => {
    const li = document.createElement("li");
    const status = result.matched ? "MATCH" : "NO MATCH";
    const destinations = (result.targets || []).map((t) => t.label);

    li.textContent = `${result.route.label}: ${status}${
      destinations.length
        ? ` → ${destinations.join(", ")}`
        : result.matched
        ? " (no targets configured)"
        : ""
    }`;
    rulesList.appendChild(li);
  });
  rulesSection.appendChild(rulesList);
  detailsCard.appendChild(rulesSection);

  // Contract violations section
  const violationsSection = document.createElement("div");
  violationsSection.className = "details-section";

  const violationsTitle = document.createElement("h4");
  violationsTitle.textContent = "Contract Violations";
  violationsSection.appendChild(violationsTitle);

  const violationsList = document.createElement("ul");
  let hasAnyViolations = false;

  routeResults.forEach((result) => {
    if (result.matched && result.violations && result.violations.length) {
      hasAnyViolations = true;
      result.violations.forEach((v) => {
        const li = document.createElement("li");
        li.textContent = `${result.route.label}: ${v}`;
        violationsList.appendChild(li);
      });
    }
  });

  if (!hasAnyViolations) {
    const li = document.createElement("li");
    li.textContent = "No contract violations detected for this sample event.";
    violationsList.appendChild(li);
  }

  violationsSection.appendChild(violationsList);
  detailsCard.appendChild(violationsSection);
}

document.addEventListener("DOMContentLoaded", init);
