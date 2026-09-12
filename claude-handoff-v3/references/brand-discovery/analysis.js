(() => {
  "use strict";

  const STORAGE_KEY = "anuma-analysis-strategist-v1";
  const REQUIRED_EXCLUSIONS = new Set([
    "archetypeResult",
    "confusion",
    "anything",
    "customPalette",
    "uiFeatureOther",
    "mockupAlternative",
  ]);
  const RESPONDENT_COLORS = ["#78e5ec", "#efb56d", "#a7e2b1", "#ec8a86", "#9f9bff", "#d5dd75"];
  const teamResponses = Array.isArray(window.ANUMA_ANALYSIS_RESPONSES)
    ? window.ANUMA_ANALYSIS_RESPONSES
    : [];

  let strategistResponse = loadStrategist();
  let lastFocusedElement = null;

  const signalDefinitions = [
    {
      title: "Connection is the central outcome",
      strength: "high",
      label: "Strong alignment · 6 of 6",
      description: "Every respondent frames the value through connection, community, collective experience or relationship—even when their explanation of that outcome differs.",
      fields: ["belief", "futureLoss", "want", "problemExternal", "success", "different"],
    },
    {
      title: "Credibility needs two kinds of proof",
      strength: "high",
      label: "Strong alignment · 6 of 6",
      description: "Science gives the work permission to make serious claims. Participant testimony makes those claims emotionally intelligible. The proof stack needs both.",
      fields: ["nonnegotiable", "authority", "proud", "proofPoints", "claim"],
    },
    {
      title: "VR is both differentiator and barrier",
      strength: "high",
      label: "Universal tension · 6 of 6",
      description: "The headset enables attentional containment, embodied reimagining and remote co-presence, while also triggering access, comfort and cultural resistance.",
      fields: ["barrier", "currentPerception", "medium"],
    },
    {
      title: "Context is part of the experience",
      strength: "high",
      label: "Strong alignment · 5+ of 6",
      description: "Preparation, consent, facilitation and integration repeatedly appear as core product requirements—not secondary support content.",
      fields: ["soloPathway", "companionRole", "companionFunctions", "claim"],
    },
    {
      title: "Group depth; solo reach",
      strength: "medium",
      label: "Directional signal",
      description: "Group practice carries the strongest relational conviction. Solo delivery is supported as a scalable doorway, especially when it leads toward continuity and community.",
      fields: ["belief", "soloPathway", "facilitatorPathway", "communityRole"],
    },
    {
      title: "The commercial doorway is unresolved",
      strength: "open",
      label: "Open decision · not consensus",
      description: "Audience, entity roles, product naming and revenue logic all contain materially different positions. Brand design cannot responsibly hide those choices.",
      fields: ["priorityAudience", "relationship", "layerRelationship", "facilitatorPrice", "confusion"],
    },
  ];

  const spectrumDefinitions = [
    { id: "voiceAcademic", title: "Expertise & access", left: "Academic", right: "Everyday" },
    { id: "voicePoetic", title: "Imagination & clarity", left: "Poetic", right: "Literal" },
    { id: "voiceProvocative", title: "Challenge convention", left: "Reassuring", right: "Provocative" },
    { id: "visualOrganic", title: "Visual energy", left: "Organic", right: "Engineered" },
  ];

  const archetypeMaps = {
    naturalGift: {
      "Make complex truth understandable": "Sage",
      "Open new paths to self-discovery": "Explorer",
      "Restore trust and possibility": "Innocent",
      "Transform how reality is perceived": "Mystic",
      "Challenge limiting conventions": "Outlaw",
      "Help people meet difficulty with courage": "Champion",
      "Create intimate, beautiful connection": "Lover",
      "Make people feel part of a shared humanity": "Connector",
      "Bring play, presence and relief": "Jester",
      "Invent original worlds and tools": "Creator",
      "Care for people through vulnerable transitions": "Healer",
      "Create clear systems others can trust": "Royal",
    },
    changeMethod: {
      "Teach people how to see more clearly": "Sage",
      "Invite people beyond familiar boundaries": "Explorer",
      "Make a complex future feel hopeful and accessible": "Innocent",
      "Act as a catalyst for profound inner change": "Mystic",
      "Break rules that keep people constrained": "Outlaw",
      "Equip people to overcome a meaningful challenge": "Champion",
      "Deepen felt connection with self and others": "Lover",
      "Create a welcoming place where nobody is above anyone": "Connector",
      "Disarm tension through delight and surprise": "Jester",
      "Turn imagination into experiences that did not exist before": "Creator",
      "Hold people safely through change": "Healer",
      "Set a standard and organise the ecosystem around it": "Royal",
    },
    shadowRisk: {
      "Sounding intelligent but emotionally distant": "Sage",
      "Always seeking the next frontier without finishing": "Explorer",
      "Making the work feel unrealistically safe or simple": "Innocent",
      "Promising transformation we cannot responsibly guarantee": "Mystic",
      "Becoming defined by opposition and conflict": "Outlaw",
      "Glorifying struggle, performance or heroic leadership": "Champion",
      "Prioritising allure or approval over substance": "Lover",
      "Smoothing out the difference that makes us matter": "Connector",
      "Using play to avoid seriousness or accountability": "Jester",
      "Remaining in endless invention instead of shipping": "Creator",
      "Overprotecting people or weakening their agency": "Healer",
      "Becoming controlling, hierarchical or exclusive": "Royal",
    },
  };
  const archetypeWeights = { naturalGift: 3, changeMethod: 2, shadowRisk: 1 };

  const visualRoutes = {
    bioluminescent: { title: "Bioluminescent depth", palette: "linear-gradient(90deg,#050716,#16134a,#256bff,#55d8ff)" },
    numadelic_ember: { title: "Numadelic ember", palette: "linear-gradient(90deg,#090611,#24122f,#f26a2e,#ffb15f)" },
    lucid_blueprint: { title: "Lucid blueprint", palette: "linear-gradient(90deg,#080b1c,#17244d,#78b9ff,#d7e9ff)" },
    earth_signal: { title: "Earth signal", palette: "linear-gradient(90deg,#080a12,#173239,#b56a3c,#d8b784)" },
    ceremonial_tech: { title: "Ceremonial technology", palette: "linear-gradient(90deg,#06040f,#211448,#6f4dff,#9ddcff)" },
    living_studio: { title: "Living studio", palette: "linear-gradient(90deg,#071015,#123d49,#1fb9a8,#b7f1dc)" },
  };

  const tensions = [
    { left: "Scale", right: "Safeguarding", fields: ["soloPathway", "impact", "claim"] },
    { left: "Scientific clarity", right: "Sacred resonance", fields: ["nonnegotiable", "different", "tension"] },
    { left: "One coherent world", right: "Two accountable roles", fields: ["relationship", "sharedDistinct", "confusion"] },
    { left: "Solo accessibility", right: "Relational depth", fields: ["soloPathway", "facilitatorPathway", "communityRole"] },
    { left: "Creator freedom", right: "Quality control", fields: ["designerPathway", "designerEconomics"] },
    { left: "Mystery", right: "Immediate clarity", fields: ["risk", "launchPriority", "sample"] },
  ];

  const decisions = [
    { title: "Choose the launch audience", detail: "Validate one readiness-based beachhead before a broad consumer story. Internal alignment is not market demand.", status: "Needs audience tests" },
    { title: "Resolve entity and governance roles", detail: "Decide ownership, scientific independence, revenue flow and which entity makes each promise before naming architecture.", status: "Leadership decision" },
    { title: "Define solo eligibility and safety", detail: "Set preparation, contraindication, exit, intensity, escalation and integration standards before broad access.", status: "Protocol required" },
    { title: "Treat monetisation as research", detail: "Test participant, facilitator, retreat and institutional models separately; the fieldwork does not support one answer.", status: "Experiment" },
    { title: "Test the word “numadelic”", detail: "Measure whether the term creates useful curiosity or compounds explanation cost among first-time audiences.", status: "Comprehension test" },
  ];

  function flatten(document) {
    if (!document || !Array.isArray(document.sections)) return [];
    return document.sections.flatMap((section) =>
      (Array.isArray(section.responses) ? section.responses : []).map((response) => ({
        ...response,
        sectionId: section.id,
        sectionName: section.section,
      })),
    );
  }

  function getResponse(document, id) {
    return flatten(document).find((response) => response.id === id) || null;
  }

  function normalizeSelections(value) {
    if (Array.isArray(value)) return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
    if (typeof value === "string" && value.trim()) return [value.trim()];
    return [];
  }

  function hasAnswer(response) {
    if (!response) return false;
    const value = response.value;
    if (typeof value === "string") return Boolean(value.trim());
    if (Array.isArray(value)) return normalizeSelections(value).length > 0;
    if (value && typeof value === "object") {
      return Object.values(value).some((item) => typeof item === "string" ? Boolean(item.trim()) : Array.isArray(item) && item.length > 0);
    }
    return value !== null && value !== undefined;
  }

  function responseText(response) {
    if (!response || !hasAnswer(response)) return "No response";
    const value = response.value;
    if (Array.isArray(value)) return normalizeSelections(value).join(" · ");
    if (value && typeof value === "object") {
      return Object.entries(value)
        .filter(([, item]) => typeof item === "string" ? item.trim() : Array.isArray(item) && item.length)
        .map(([key, item]) => `${key}: ${Array.isArray(item) ? item.join(" · ") : item}`)
        .join("\n");
    }
    return String(value).trim();
  }

  function initials(name) {
    return String(name || "Unknown")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-GB").format(value);
  }

  function countWords() {
    return teamResponses.reduce((total, document) => total + flatten(document).reduce((subtotal, response) => {
      if (response.type !== "textarea" && response.type !== "text") return subtotal;
      const text = responseText(response);
      return subtotal + (text === "No response" ? 0 : text.split(/\s+/).filter(Boolean).length);
    }, 0), 0);
  }

  function countSelections(id) {
    const labels = new Map();
    teamResponses.forEach((document) => {
      const response = getResponse(document, id);
      normalizeSelections(response?.value).forEach((selection) => {
        const key = selection.normalize("NFKC").trim().toLocaleLowerCase();
        const current = labels.get(key) || { label: selection, count: 0, respondents: [] };
        current.count += 1;
        current.respondents.push(document.respondentName);
        labels.set(key, current);
      });
    });
    return [...labels.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  function singleChoiceCounts(id) {
    const counts = new Map();
    teamResponses.forEach((document) => {
      const response = getResponse(document, id);
      if (!hasAnswer(response)) return;
      const key = String(response.value);
      const current = counts.get(key) || { value: key, label: response.display || key, count: 0, respondents: [] };
      current.count += 1;
      current.respondents.push(document.respondentName);
      counts.set(key, current);
    });
    return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  function calculateArchetypes(documentSet = teamResponses) {
    const names = ["Innocent", "Sage", "Explorer", "Mystic", "Outlaw", "Champion", "Lover", "Connector", "Jester", "Creator", "Healer", "Royal"];
    const totals = Object.fromEntries(names.map((name) => [name, { gift: 0, method: 0, shadow: 0, total: 0 }]));
    documentSet.forEach((document) => {
      Object.entries(archetypeWeights).forEach(([fieldId, weight]) => {
        normalizeSelections(getResponse(document, fieldId)?.value).forEach((selection) => {
          const archetype = archetypeMaps[fieldId][selection];
          if (!archetype) return;
          const part = fieldId === "naturalGift" ? "gift" : fieldId === "changeMethod" ? "method" : "shadow";
          totals[archetype][part] += weight;
          totals[archetype].total += weight;
        });
      });
    });
    return Object.entries(totals)
      .map(([name, scores]) => ({ name, ...scores }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }

  function renderHero() {
    const requiredResponses = teamResponses.flatMap(flatten).filter((response) => !REQUIRED_EXCLUSIONS.has(response.id));
    const requiredAnswered = requiredResponses.filter(hasAnswer).length;
    const completion = requiredResponses.length ? Math.round((requiredAnswered / requiredResponses.length) * 100) : 0;
    const ledger = [
      [teamResponses.length, "core-team voices"],
      [`${completion}%`, "required coverage"],
      ["3+", "years close to work"],
      [formatNumber(countWords()), "written words"],
    ];
    document.querySelector("#heroLedger").innerHTML = ledger.map(([value, label]) => `
      <div class="ledger-item"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>
    `).join("");

    document.querySelector("#respondentRibbon").innerHTML = teamResponses.map((document, index) => `
      <span class="respondent-chip" style="--dot:${RESPONDENT_COLORS[index % RESPONDENT_COLORS.length]}">
        <i></i>${escapeHtml(document.respondentName)}
      </span>
    `).join("");
  }

  function renderSignals() {
    document.querySelector("#findingSignals").innerHTML = signalDefinitions.map((signal, index) => `
      <article class="signal-card">
        <div class="signal-card__head">
          <span class="signal-card__index">0${index + 1}</span>
          <span class="confidence confidence--${signal.strength}"><i></i>${escapeHtml(signal.label)}</span>
        </div>
        <h4>${escapeHtml(signal.title)}</h4>
        <p>${escapeHtml(signal.description)}</p>
        <button type="button" data-evidence-title="${escapeHtml(signal.title)}" data-evidence-fields="${signal.fields.join(",")}">Trace evidence ↗</button>
      </article>
    `).join("");
  }

  function spectrumValues(id, documentSet = teamResponses) {
    return documentSet.map((document, index) => {
      const response = getResponse(document, id);
      const value = Number(response?.value);
      return Number.isFinite(value) ? { name: document.respondentName, value: Math.min(100, Math.max(0, value)), index } : null;
    }).filter(Boolean);
  }

  function average(items) {
    return items.length ? items.reduce((sum, item) => sum + item.value, 0) / items.length : 0;
  }

  function spectrumRead(definition, mean) {
    if (Math.abs(mean - 50) < 7) return "Essentially balanced";
    return mean < 50
      ? `${Math.round(100 - mean)}% ${definition.left}`
      : `${Math.round(mean)}% ${definition.right}`;
  }

  function renderPolarities() {
    document.querySelector("#polarityBoard").innerHTML = spectrumDefinitions.map((definition, index) => {
      const values = spectrumValues(definition.id);
      const mean = average(values);
      const min = Math.min(...values.map((item) => item.value));
      const max = Math.max(...values.map((item) => item.value));
      const strategist = strategistResponse ? spectrumValues(definition.id, [strategistResponse])[0] : null;
      const dots = values.map((item) => `
        <i class="polarity-dot" style="--position:${item.value};--dot:${RESPONDENT_COLORS[item.index % RESPONDENT_COLORS.length]}" title="${escapeHtml(item.name)}: ${item.value}/100" aria-label="${escapeHtml(item.name)}, ${item.value} out of 100"></i>
      `).join("");
      const strategistDot = strategist ? `<i class="polarity-dot polarity-dot--strategist" style="--position:${strategist.value}" title="${escapeHtml(strategist.name)}: ${strategist.value}/100" aria-label="Strategist, ${strategist.value} out of 100"></i>` : "";
      return `
        <article class="polarity-row">
          <div class="polarity-row__name"><span>0${index + 1}</span><strong>${escapeHtml(definition.title)}</strong></div>
          <div class="polarity-track-wrap">
            <div class="polarity-track" role="img" aria-label="${escapeHtml(definition.left)} to ${escapeHtml(definition.right)}. Team mean ${Math.round(mean)}. Range ${min} to ${max}.">${dots}${strategistDot}</div>
            <div class="polarity-labels"><span>${escapeHtml(definition.left)}</span><span>${escapeHtml(definition.right)}</span></div>
          </div>
          <div class="polarity-row__read"><strong>${escapeHtml(spectrumRead(definition, mean))}</strong><span>mean ${mean.toFixed(1)} · spread ${max - min} pts</span></div>
        </article>
      `;
    }).join("");
  }

  function renderCountChart(target, id, limit = 7) {
    const values = countSelections(id).slice(0, limit);
    document.querySelector(target).innerHTML = `<div class="count-chart">${values.map((item) => `
      <div class="count-row" title="${escapeHtml(item.respondents.join(", "))}">
        <span class="count-row__label">${escapeHtml(item.label)}</span>
        <span class="count-row__track" aria-hidden="true"><i style="--count:${item.count}"></i></span>
        <span class="count-row__value">${item.count}/6</span>
      </div>
    `).join("")}</div>`;
  }

  function renderArchetypes() {
    const scores = calculateArchetypes();
    document.querySelector("#archetypeChart").innerHTML = scores.map((item) => `
      <div class="archetype-row" title="Gift ${item.gift}, method ${item.method}, shadow recognition ${item.shadow}">
        <span>${escapeHtml(item.name)}</span>
        <div aria-hidden="true"><i style="--score:${item.total}"></i></div>
        <b>${item.total}</b>
      </div>
    `).join("");
  }

  function renderVisualVotes() {
    const votes = singleChoiceCounts("visualDirection");
    const byId = new Map(votes.map((vote) => [vote.value, vote]));
    const ordered = Object.entries(visualRoutes)
      .map(([id, route]) => ({ id, ...route, count: byId.get(id)?.count || 0 }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
    document.querySelector("#visualVotes").innerHTML = `
      <div class="visual-block-title"><strong>Visual routes</strong><span>Split 3 cold / 3 warm</span></div>
      ${ordered.map((route) => `
        <div class="route-vote">
          <span>${escapeHtml(route.title)}</span>
          <i class="route-vote__bar" style="--palette:${route.palette};--count:${route.count}" aria-hidden="true"></i>
          <b>${route.count}</b>
        </div>
      `).join("")}
      <button class="evidence-button" type="button" data-evidence-title="Visual direction choices" data-evidence-fields="visualDirection,visualReason">Inspect visual reasoning <span>↗</span></button>
    `;

    const mockups = ["mockup1", "mockup2", "mockup4", "mockup6", "mockup8", "mockup9"];
    const mockupCounts = new Map(singleChoiceCounts("mockupVote").map((vote) => [vote.value, vote.count]));
    mockups.sort((a, b) => (mockupCounts.get(b) || 0) - (mockupCounts.get(a) || 0));
    document.querySelector("#mockupVotes").innerHTML = `
      <div class="visual-block-title"><strong>Interface mockups</strong><span>Mockup 1 plurality · 3 of 6</span></div>
      <div class="mockup-grid-analysis">
        ${mockups.slice(0, 5).map((id) => `
          <div class="mockup-vote-card">
            <img src="assets/Anuma%20UI_Option${id.replace("mockup", "")}.png" alt="Mockup ${id.replace("mockup", "")}">
            <span>Mockup ${id.replace("mockup", "")} · ${mockupCounts.get(id) || 0} vote${mockupCounts.get(id) === 1 ? "" : "s"}</span>
          </div>
        `).join("")}
      </div>
      <button class="evidence-button" type="button" data-evidence-title="Mockup preferences" data-evidence-fields="mockupVote,mockupWhy,mockupReview">Inspect interface reasoning <span>↗</span></button>
    `;
  }

  function renderTensions() {
    document.querySelector("#tensionList").innerHTML = tensions.map((tension, index) => `
      <div class="tension-row">
        <span>0${index + 1}</span>
        <strong>${escapeHtml(tension.left)}</strong>
        <i class="tension-axis" aria-hidden="true"></i>
        <strong>${escapeHtml(tension.right)}</strong>
        <button type="button" data-evidence-title="${escapeHtml(tension.left)} and ${escapeHtml(tension.right)}" data-evidence-fields="${tension.fields.join(",")}">Trace tension ↗</button>
      </div>
    `).join("");
  }

  function renderDecisions() {
    document.querySelector("#decisionRegister").innerHTML = decisions.map((decision) => `
      <article class="decision-row">
        <strong>${escapeHtml(decision.title)}</strong>
        <p>${escapeHtml(decision.detail)}</p>
        <span class="decision-status">${escapeHtml(decision.status)}</span>
      </article>
    `).join("");
  }

  function renderStrategist() {
    const banner = document.querySelector("#strategistBanner");
    const lens = document.querySelector("#strategistLens");
    if (!strategistResponse) {
      banner.classList.add("hidden");
      lens.classList.add("hidden");
      renderPolarities();
      return;
    }

    banner.classList.remove("hidden");
    lens.classList.remove("hidden");
    document.querySelector("#strategistBannerName").textContent = strategistResponse.respondentName || "Independent response";

    const spectrumDeltas = spectrumDefinitions.map((definition) => {
      const teamMean = average(spectrumValues(definition.id));
      const strategistValue = spectrumValues(definition.id, [strategistResponse])[0]?.value;
      return Number.isFinite(strategistValue) ? { ...definition, teamMean, strategistValue, delta: strategistValue - teamMean } : null;
    }).filter(Boolean).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const largestDelta = spectrumDeltas[0];

    const topTraits = countSelections("primaryTraits").filter((item) => item.count >= 2).map((item) => item.label);
    const strategistTraits = normalizeSelections(getResponse(strategistResponse, "primaryTraits")?.value);
    const traitOverlap = strategistTraits.filter((trait) => topTraits.some((teamTrait) => teamTrait.toLowerCase() === trait.toLowerCase()));

    const topAvoid = countSelections("notTraits").filter((item) => item.count >= 3).map((item) => item.label);
    const strategistAvoid = normalizeSelections(getResponse(strategistResponse, "notTraits")?.value);
    const avoidOverlap = strategistAvoid.filter((trait) => topAvoid.some((teamTrait) => teamTrait.toLowerCase() === trait.toLowerCase()));

    const relationship = getResponse(strategistResponse, "relationship");
    const layerRelationship = getResponse(strategistResponse, "layerRelationship");
    const role = responseText(getResponse(strategistResponse, "role"));

    const comparisonCards = [
      {
        label: "Largest expression delta",
        title: largestDelta ? `${largestDelta.delta > 0 ? "+" : ""}${Math.round(largestDelta.delta)} points / ${largestDelta.title}` : "No slider comparison yet",
        detail: largestDelta ? `Team mean ${largestDelta.teamMean.toFixed(1)}; your response ${largestDelta.strategistValue}. Direction alone is not correctness—inspect why the difference exists.` : "Complete the expression section to compare your calibration.",
      },
      {
        label: "Shared positive character",
        title: traitOverlap.length ? traitOverlap.join(" · ") : "A deliberately different emphasis",
        detail: traitOverlap.length ? `${traitOverlap.length} of your selected traits recur across at least two team responses.` : "None of your selected traits appears in the team's repeated set. This may expose a useful outside perspective.",
      },
      {
        label: "Shared boundaries",
        title: avoidOverlap.length ? avoidOverlap.join(" · ") : "Different caution signals",
        detail: avoidOverlap.length ? `You share ${avoidOverlap.length} of the team's most repeated rejection signals.` : "Your strongest brand risks differ from the team baseline; surface them explicitly in synthesis.",
      },
      {
        label: "Architecture lens",
        title: relationship && hasAnswer(relationship) ? responseText(relationship) : "No entity choice recorded",
        detail: `${role === "No response" ? "Independent strategist" : role}. Product structure: ${layerRelationship && hasAnswer(layerRelationship) ? responseText(layerRelationship) : "not answered"}.`,
      },
    ];

    document.querySelector("#strategistComparison").innerHTML = `
      <div class="strategist-comparison-grid">
        ${comparisonCards.map((card) => `<article class="comparison-card"><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.title)}</strong><p>${escapeHtml(card.detail)}</p></article>`).join("")}
      </div>
      <button class="evidence-button" type="button" data-evidence-title="Independent strategist comparison" data-evidence-fields="whyNow,priorityAudience,primaryTraits,notTraits,relationship,layerRelationship,voiceAcademic,voicePoetic,voiceProvocative,visualOrganic">Read the source comparison <span>↗</span></button>
    `;
    renderPolarities();
  }

  function renderAll() {
    renderHero();
    renderSignals();
    renderPolarities();
    renderCountChart("#primaryTraitsChart", "primaryTraits", 8);
    renderCountChart("#avoidTraitsChart", "notTraits", 8);
    renderCountChart("#companionChart", "companionFunctions", 7);
    renderCountChart("#launchChart", "launchPriority", 7);
    renderArchetypes();
    renderVisualVotes();
    renderTensions();
    renderDecisions();
    renderStrategist();
    bindEvidenceButtons();
  }

  function bindEvidenceButtons() {
    document.querySelectorAll("[data-evidence-fields]").forEach((button) => {
      if (button.dataset.evidenceBound) return;
      button.dataset.evidenceBound = "true";
      button.addEventListener("click", () => {
        const fields = button.dataset.evidenceFields.split(",").map((field) => field.trim()).filter(Boolean);
        openEvidence(button.dataset.evidenceTitle || "Source responses", fields, button);
      });
    });
  }

  function openEvidence(title, fieldIds, trigger) {
    const drawer = document.querySelector("#evidenceDrawer");
    const scrim = document.querySelector("#drawerScrim");
    const content = document.querySelector("#evidenceContent");
    lastFocusedElement = trigger || document.activeElement;

    document.querySelector("#evidenceTitle").textContent = title;
    const totalPossible = fieldIds.length * teamResponses.length;
    const answered = fieldIds.reduce((total, id) => total + teamResponses.filter((document) => hasAnswer(getResponse(document, id))).length, 0);
    document.querySelector("#evidenceSummary").textContent = `${fieldIds.length} question${fieldIds.length === 1 ? "" : "s"} · ${answered} of ${totalPossible} possible team responses populated · blanks remain visible`;

    content.innerHTML = fieldIds.map((fieldId) => {
      const sample = teamResponses.map((document) => getResponse(document, fieldId)).find(Boolean) || getResponse(strategistResponse, fieldId);
      if (!sample) return "";
      const teamAnswers = teamResponses.map((document, index) => renderEvidenceAnswer(document, fieldId, index, false)).join("");
      const strategistAnswer = strategistResponse ? renderEvidenceAnswer(strategistResponse, fieldId, 0, true) : "";
      return `
        <section class="evidence-field">
          <header><h3>${escapeHtml(sample.label || fieldId)}</h3><span>${escapeHtml(sample.sectionId || "field")}.${escapeHtml(fieldId)}</span></header>
          ${teamAnswers}${strategistAnswer}
        </section>
      `;
    }).join("");

    drawer.classList.add("open");
    scrim.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    document.querySelector("#closeEvidence").focus();
  }

  function renderEvidenceAnswer(document, fieldId, index, isStrategist) {
    const response = getResponse(document, fieldId);
    const answered = hasAnswer(response);
    const color = isStrategist ? "#a7e2b1" : RESPONDENT_COLORS[index % RESPONDENT_COLORS.length];
    const name = document?.respondentName || "Unknown";
    return `
      <article class="evidence-answer ${answered ? "" : "evidence-answer--missing"} ${isStrategist ? "evidence-answer--strategist" : ""}">
        <span class="evidence-avatar" style="--dot:${color}">${escapeHtml(initials(name))}</span>
        <div class="evidence-answer__copy">
          <strong>${escapeHtml(name)}${isStrategist ? " · strategist lens" : ""}</strong>
          <p>${escapeHtml(answered ? responseText(response) : "No response")}</p>
        </div>
      </article>
    `;
  }

  function closeEvidence() {
    const drawer = document.querySelector("#evidenceDrawer");
    document.querySelector("#drawerScrim").classList.remove("open");
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") lastFocusedElement.focus();
  }

  function switchPhase(phase, shouldScroll = true, scrollTarget = "") {
    const target = document.querySelector(`[data-phase="${phase}"]`);
    if (!target) return;
    document.querySelectorAll(".phase-panel").forEach((panel) => panel.classList.toggle("active", panel === target));
    document.querySelectorAll(".phase-link").forEach((link) => {
      const active = link.dataset.phaseTarget === phase;
      link.classList.toggle("active", active);
      link.setAttribute("aria-current", active ? "page" : "false");
    });
    history.replaceState(null, "", `#${phase}`);
    if (shouldScroll) {
      const destination = scrollTarget ? document.querySelector(`#${scrollTarget}`) : target;
      destination?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function loadStrategist() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  function saveStrategist(document) {
    strategistResponse = document;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(document)); } catch { /* file remains active for this session */ }
  }

  function removeStrategist() {
    strategistResponse = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* no-op */ }
    renderStrategist();
    bindEvidenceButtons();
  }

  function validateImport(document) {
    if (!document || document.project !== "aNUma Brand Discovery") return "This is not an aNUma Brand Discovery export.";
    if (!document.respondentName || !Array.isArray(document.sections)) return "The response is missing a respondent name or sections.";
    const ids = new Set(flatten(document).map((response) => response.id));
    if (!ids.has("priorityAudience") || !ids.has("primaryTraits") || !ids.has("voiceAcademic")) return "The response does not match the current fieldwork schema.";
    return "";
  }

  async function importFile(file) {
    const status = document.querySelector("#importStatus");
    status.classList.remove("error");
    status.textContent = "Reading response…";
    try {
      const imported = JSON.parse(await file.text());
      const error = validateImport(imported);
      if (error) throw new Error(error);
      saveStrategist(imported);
      renderStrategist();
      bindEvidenceButtons();
      status.textContent = `${imported.respondentName} added as a separate strategist lens.`;
      setTimeout(() => {
        document.querySelector("#importDialog").close();
        switchPhase("findings", true, "strategistLens");
      }, 700);
    } catch (error) {
      status.classList.add("error");
      status.textContent = error instanceof SyntaxError ? "That file is not valid JSON." : error.message;
    }
  }

  function bindInteractions() {
    document.querySelectorAll("[data-phase-target]").forEach((button) => {
      button.addEventListener("click", () => switchPhase(button.dataset.phaseTarget, true, button.dataset.scrollTarget || ""));
    });
    document.querySelector("#closeEvidence").addEventListener("click", closeEvidence);
    document.querySelector("#drawerScrim").addEventListener("click", closeEvidence);
    document.querySelector("#methodButton").addEventListener("click", () => document.querySelector("#methodDialog").showModal());
    document.querySelector("#importButton").addEventListener("click", () => document.querySelector("#importDialog").showModal());
    document.querySelector("#replaceStrategist").addEventListener("click", () => document.querySelector("#importDialog").showModal());
    document.querySelector("#removeStrategist").addEventListener("click", removeStrategist);
    document.querySelector("#printButton").addEventListener("click", () => window.print());
    document.querySelector("#printButtonBottom").addEventListener("click", () => window.print());
    document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => document.querySelector(`#${button.dataset.closeDialog}`).close()));

    const fileInput = document.querySelector("#strategistFile");
    const drop = document.querySelector(".file-drop");
    fileInput.addEventListener("change", () => fileInput.files?.[0] && importFile(fileInput.files[0]));
    ["dragenter", "dragover"].forEach((eventName) => drop.addEventListener(eventName, (event) => {
      event.preventDefault();
      drop.classList.add("dragging");
    }));
    ["dragleave", "drop"].forEach((eventName) => drop.addEventListener(eventName, (event) => {
      event.preventDefault();
      drop.classList.remove("dragging");
    }));
    drop.addEventListener("drop", (event) => event.dataTransfer?.files?.[0] && importFile(event.dataTransfer.files[0]));

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.querySelector("#evidenceDrawer").classList.contains("open")) closeEvidence();
    });
  }

  function auditDataset() {
    if (teamResponses.length !== 6) console.warn(`Expected six core-team responses; found ${teamResponses.length}.`);
    const seen = new Set();
    teamResponses.forEach((document) => {
      if (seen.has(document.respondentName)) console.warn(`Duplicate respondent: ${document.respondentName}`);
      seen.add(document.respondentName);
      if (flatten(document).length !== 70) console.warn(`${document.respondentName} has ${flatten(document).length} response records; expected 70.`);
    });
  }

  auditDataset();
  renderAll();
  bindInteractions();
  const initialPhase = ["findings", "interpretation", "recommendation"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "findings";
  switchPhase(initialPhase, false);
})();
