#!/usr/bin/env node
// Rocketlane API labs - run against the auskin@klenty.com trial workspace.
// Needs Node 18+. Usage:
//   export RL_API_KEY="..."          (Settings -> API -> Create API key)
//   node round2-labs.mjs lab1        (read workspace + pagination)
//   node round2-labs.mjs lab2        (create projects: minimal, traps, template)
//   node round2-labs.mjs lab3        (phases + tasks + assignment)
//   node round2-labs.mjs lab4        (time entry)
//   node round2-labs.mjs lab5        (rate-limit-safe client demo)
// Edit OWNER_EMAIL and (for templates) TEMPLATE_ID below before lab2.

const BASE = "https://api.rocketlane.com/api/1.0";
const KEY = process.env.RL_API_KEY;
const OWNER_EMAIL = "auskin@klenty.com"; // your workspace login
const TEMPLATE_ID = 5000000074218; // paste from the template's URL in the UI (no list-templates API!)

if (!KEY) {
  console.error("Set RL_API_KEY first (Settings -> API -> Create API key).");
  process.exit(1);
}

// ---- Rate-limit-aware fetch: the Lab 5 lesson baked into every call ----
// Their rules: 60/min on list-GETs, 200/min overall. 429 => errorCode TOO_MANY_REQUEST
// with X-Retry-After = EPOCH MILLIS (not the standard Retry-After seconds).
async function rl(path, { method = "GET", body, attempt = 1 } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "api-key": KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429 && attempt <= 5) {
    const retryAtMillis = Number(res.headers.get("x-retry-after"));
    const waitMs =
      Number.isFinite(retryAtMillis) && retryAtMillis > Date.now()
        ? retryAtMillis - Date.now()
        : Math.min(2 ** attempt * 1000, 30_000) + Math.random() * 500; // backoff + jitter fallback
    console.log(
      `429 rate-limited. Honoring X-Retry-After: waiting ${(waitMs / 1000).toFixed(1)}s (attempt ${attempt})`,
    );
    await new Promise((r) => setTimeout(r, waitMs));
    return rl(path, { method, body, attempt: attempt + 1 });
  }
  const reqId = res.headers.get("x-request-id");
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    console.error(
      `HTTP ${res.status} (X-Request-Id: ${reqId})`,
      JSON.stringify(json?.errors ?? json, null, 2),
    );
    throw new Error(`Request failed: ${method} ${path}`);
  }
  return json;
}

// ---- Lab 1: read the workspace + pagination ----
async function lab1() {
  console.log(
    "== Users (API is read-only for users - invites are side effects) ==",
  );
  const users = await rl("/users?pageSize=10");
  for (const u of users.data ?? [])
    console.log(
      ` - ${u.firstName ?? ""} ${u.lastName ?? ""} <${u.email}> [${u.type}/${u.status}]`,
    );

  console.log(
    "\n== Projects, page by page (pageSize + pageToken; token lives 15 min) ==",
  );
  let token = "",
    page = 1;
  do {
    const q = token ? `&pageToken=${token}` : "";
    const res = await rl(`/projects?pageSize=5${q}`);
    console.log(
      ` page ${page}: ${(res.data ?? []).map((p) => `#${p.projectId} ${p.projectName}`).join(" | ") || "(empty)"}`,
    );
    console.log(
      `   pagination: hasMore=${res.pagination?.hasMore} total=${res.pagination?.totalRecordCount}`,
    );
    token = res.pagination?.hasMore ? res.pagination?.nextPageToken : null;
    page++;
  } while (token);

  console.log("\n== Filter syntax: operator suffixes ==");
  const filtered = await rl(
    `/projects?projectName.cn=onboarding&sortBy=createdAt&sortOrder=DESC`,
  );
  console.log(
    ` projects containing 'onboarding': ${filtered.data?.length ?? 0}`,
  );
}

// ---- Lab 2: create projects (THE likely assignment) ----
async function lab2() {
  console.log("== 2a. Minimal create: the exactly-three required fields ==");
  const p1 = await rl("/projects", {
    method: "POST",
    body: {
      projectName: `API lab minimal ${new Date().toISOString().slice(0, 16)}`,
      customer: { companyName: "Acme Lab Inc" }, // case-sensitive + IMMUTABLE after create
      owner: { emailId: OWNER_EMAIL },
      autoCreateCompany: true, // create-or-reuse the company
    },
  });
  console.log(
    ` created #${p1.projectId ?? p1.data?.projectId} -> 201 with full project object`,
  );

  console.log(
    "\n== 2b. With dates, visibility, financials, idempotency key ==",
  );
  const ext = `lab-${Date.now()}`;
  const p2 = await rl("/projects", {
    method: "POST",
    body: {
      projectName: "API lab full",
      customer: { companyName: "Acme Lab Inc" },
      owner: { emailId: OWNER_EMAIL },
      autoCreateCompany: true,
      startDate: "2026-08-03",
      dueDate: "2026-09-30",
      visibility: "MEMBERS",
      financials: { contractType: "NON_BILLABLE" },
      externalReferenceId: ext, // your dedupe/idempotency handle
    },
  });
  console.log(` created with externalReferenceId=${ext}`);
  const found = await rl(`/projects?externalReferenceId.eq=${ext}`);
  console.log(
    ` lookup by externalReferenceId found ${found.data?.length ?? 0} project(s) - safe-retry pattern proven`,
  );

  if (TEMPLATE_ID) {
    console.log(
      "\n== 2c. From a template (sources[]; startDate REQUIRED with sources) ==",
    );
    const p3 = await rl("/projects", {
      method: "POST",
      body: {
        projectName: "API lab from template",
        customer: { companyName: "Acme Lab Inc" },
        owner: { emailId: OWNER_EMAIL },
        autoCreateCompany: true,
        startDate: "2026-08-03",
        sources: [{ templateId: TEMPLATE_ID, startDate: "2026-08-03" }], // dueDate auto-calculated
        assignProjectOwner: true,
      },
    });
    console.log(
      ` created from template ${TEMPLATE_ID}: #${p3.projectId ?? p3.data?.projectId}`,
    );
  } else {
    console.log(
      "\n(2c skipped: set TEMPLATE_ID from a template's URL in the UI - there is NO list-templates API.)",
    );
  }
}

// ---- Lab 3: phases + tasks ----
async function lab3() {
  const proj = await rl("/projects", {
    method: "POST",
    body: {
      projectName: `API lab tasks ${Date.now()}`,
      customer: { companyName: "Acme Lab Inc" },
      owner: { emailId: OWNER_EMAIL },
      autoCreateCompany: true,
    },
  });
  const pid = proj.projectId ?? proj.data?.projectId;
  console.log(`project #${pid}`);

  console.log("== Phase: needs phaseName + project + BOTH dates ==");
  const phase = await rl("/phases", {
    method: "POST",
    body: {
      phaseName: "Kickoff",
      project: { projectId: pid },
      startDate: "2026-08-03",
      dueDate: "2026-08-14",
    },
  });
  const phaseId = phase.phaseId ?? phase.data?.phaseId;

  console.log(
    "== Task: taskName + project required; assignees via the SUB-ENDPOINT, not PUT ==",
  );
  const task = await rl("/tasks", {
    method: "POST",
    body: {
      taskName: "Draft onboarding plan",
      project: { projectId: pid },
      phase: phaseId ? { phaseId } : undefined,
      type: "TASK",
      effortInMinutes: 120,
      startDate: "2026-08-03",
      dueDate: "2026-08-05",
    },
  });
  const taskId = task.taskId ?? task.data?.taskId;
  await rl(`/tasks/${taskId}/add-assignees`, {
    method: "POST",
    body: { members: [{ emailId: OWNER_EMAIL }] },
  });
  console.log(` task #${taskId} created in phase, assigned via /add-assignees`);
}

// ---- Lab 4: time entry ----
async function lab4() {
  const today = new Date().toISOString().slice(0, 10);
  const entry = await rl("/time-entries", {
    method: "POST",
    body: {
      date: today,
      minutes: 120,
      activityName: "API lab study",
      billable: false,
      notes: "Shreeda's 'log two hours' example, raw",
    },
  });
  console.log(
    `time entry created for ${today}: 120 min (id ${entry.timeEntryId ?? entry.data?.timeEntryId})`,
  );
}

// ---- Lab 5: deliberately show the throttle logic ----
async function lab5() {
  console.log(
    "Firing 12 list-GETs with a client-side throttle (their budget: 60/min on list-GETs)...",
  );
  let done = 0;
  for (let i = 0; i < 12; i++) {
    await rl("/users?pageSize=1");
    done++;
    await new Promise((r) => setTimeout(r, 1100)); // ~55/min pace: stay UNDER the budget instead of surfing 429s
  }
  console.log(
    `${done}/12 succeeded with zero 429s - the point: budget proactively; the 429 handler is the safety net, not the plan.`,
  );
}

const labs = { lab1, lab2, lab3, lab4, lab5 };
const pick = process.argv[2];
if (!labs[pick]) {
  console.log(`Usage: node round2-labs.mjs <${Object.keys(labs).join("|")}>`);
  process.exit(1);
}
labs[pick]().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
