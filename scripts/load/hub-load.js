/**
 * Load test for CLP Hub (k6: https://k6.io). See docs/load-testing.md.
 *
 *   k6 run -e BASE_URL=https://<preview>.vercel.app scripts/load/hub-load.js
 *
 * Scenarios, each switched on by an env var so nothing writes by accident:
 *
 *   public_read   always on   Public pages at a ramping rate (the recruitment spike).
 *   staff_browse  STAFF_EMAIL + STAFF_PASSWORD
 *                             Staff log in, then move between /hub pages.
 *   public_apply  ALLOW_WRITES=yes
 *                             Submits the /participar form with obviously fake
 *                             people (@example.com). Writes participant rows.
 *   contact_form  ALLOW_WRITES=yes and CONTACT=yes
 *                             Submits the contact form. Writes Consultas rows.
 *   cron          CRON_SECRET  Calls the scheduled-action processor once a minute.
 *                             It sends any automatic email that is due, so only
 *                             against a database whose recipients are fake.
 *
 * Writes are refused against the production host (see PROD_HOSTS). Server
 * actions are submitted the way a browser without JavaScript would: the page's
 * own hidden React inputs plus the visible fields, as multipart.
 */
import http from "k6/http";
import { check, group, sleep } from "k6";
import { parseHTML } from "k6/html";
import { FormData } from "https://jslib.k6.io/formdata/0.0.2/index.js";

const BASE = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const PROD_HOSTS = ["numadelic.org", "www.numadelic.org"];
const host = BASE.replace(/^https?:\/\//, "").split(/[/:]/)[0];
const WRITES = __ENV.ALLOW_WRITES === "yes";
const PEAK = Number(__ENV.PEAK_RPS || 20); // public page requests per second at peak
const STAFF = Number(__ENV.STAFF_VUS || 10); // concurrent staff

if (WRITES && PROD_HOSTS.includes(host)) {
  throw new Error(`Refusing ALLOW_WRITES against ${host}. Use a preview or a disposable environment.`);
}

const PUBLIC_PATHS = (__ENV.PUBLIC_PATHS || "/,/clearlight,/clearlight/participar,/meditate").split(",");
const STAFF_PATHS = (
  __ENV.STAFF_PATHS ||
  "/hub,/hub/solicitudes,/hub/participantes,/hub/cohortes,/hub/calendario,/hub/tareas,/hub/logistica-vr"
).split(",");

const scenarios = {
  public_read: {
    executor: "ramping-arrival-rate",
    exec: "publicRead",
    startRate: 1,
    timeUnit: "1s",
    preAllocatedVUs: 20,
    maxVUs: 200,
    stages: [
      { target: PEAK, duration: "1m" },
      { target: PEAK, duration: "3m" },
      { target: PEAK * 3, duration: "30s" }, // an announcement spike
      { target: PEAK * 3, duration: "1m" },
      { target: 0, duration: "30s" },
    ],
  },
};
if (__ENV.STAFF_EMAIL && __ENV.STAFF_PASSWORD) {
  scenarios.staff_browse = {
    executor: "ramping-vus",
    exec: "staffBrowse",
    startVUs: 1,
    stages: [
      { target: STAFF, duration: "1m" },
      { target: STAFF, duration: "4m" },
      { target: 0, duration: "30s" },
    ],
  };
}
if (WRITES) {
  scenarios.public_apply = {
    executor: "constant-arrival-rate",
    exec: "publicApply",
    rate: Number(__ENV.APPLY_PER_MIN || 30),
    timeUnit: "1m",
    duration: "5m",
    preAllocatedVUs: 5,
    maxVUs: 30,
  };
  if (__ENV.CONTACT === "yes") {
    scenarios.contact_form = {
      executor: "constant-arrival-rate",
      exec: "contactForm",
      rate: 10,
      timeUnit: "1m",
      duration: "5m",
      preAllocatedVUs: 2,
      maxVUs: 10,
    };
  }
}
if (__ENV.CRON_SECRET) {
  scenarios.cron = {
    executor: "constant-arrival-rate",
    exec: "cron",
    rate: 1,
    timeUnit: "1m",
    duration: "6m",
    preAllocatedVUs: 1,
  };
}

export const options = {
  scenarios,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{kind:public}": ["p(95)<1500"],
    "http_req_duration{kind:staff}": ["p(95)<2500"],
    "http_req_duration{kind:write}": ["p(95)<3000"],
    "http_req_duration{kind:cron}": ["p(95)<10000"],
    checks: ["rate>0.99"],
  },
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const id = () => `${__VU}-${__ITER}-${Date.now().toString(36)}`;

/**
 * Submit the server-action form on `path` that contains `marker`, as a
 * browser without JavaScript would. Returns the response.
 */
function submitForm(path, marker, fields, kind) {
  const page = http.get(`${BASE}${path}`, { tags: { kind } });
  const form = parseHTML(page.body).find("form").has(marker).first();
  if (form.size() === 0) {
    check(page, { [`form ${marker} found on ${path}`]: () => false });
    return null;
  }
  const fd = new FormData();
  form.find("input[type=hidden]").each((_, el) => {
    const name = el.attributes().name?.value;
    if (name) fd.append(name, el.attributes().value?.value ?? "");
  });
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return http.post(`${BASE}${path}`, fd.body(), {
    headers: { "Content-Type": `multipart/form-data; boundary=${fd.boundary}` },
    tags: { kind },
  });
}

export function publicRead() {
  const res = http.get(`${BASE}${pick(PUBLIC_PATHS)}`, { tags: { kind: "public" } });
  check(res, { "public page 200": (r) => r.status === 200 });
}

let loggedIn = false; // module scope is per VU in k6

export function staffBrowse() {
  if (!loggedIn) {
    group("login", () => {
      const res = submitForm(
        "/hub/login",
        'input[name="password"]',
        { email: __ENV.STAFF_EMAIL, password: __ENV.STAFF_PASSWORD },
        "staff",
      );
      // A successful login redirects away from /hub/login.
      loggedIn = check(res, { "staff login": (r) => r && r.status === 200 && !r.url.includes("/hub/login") });
    });
    if (!loggedIn) {
      sleep(5);
      return;
    }
  }
  const res = http.get(`${BASE}${pick(STAFF_PATHS)}`, { tags: { kind: "staff" } });
  check(res, {
    "staff page 200": (r) => r.status === 200,
    "still signed in": (r) => !r.url.includes("/hub/login"),
  });
  sleep(2 + Math.random() * 4); // a person reading the page
}

export function publicApply() {
  const n = id();
  const res = submitForm(
    "/clearlight/participar",
    'input[name="firstName"]',
    {
      firstName: "Prueba",
      lastName: `Carga ${n}`,
      email: `loadtest+${n}@example.com`,
      phone: `+34 600 ${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`,
      privacy: "on",
      website: "", // honeypot stays empty
    },
    "write",
  );
  check(res, { "apply accepted": (r) => r && r.status === 200 && !r.body.includes('aria-invalid="true"') });
}

export function contactForm() {
  const n = id();
  const res = submitForm(
    "/clearlight/participar",
    'input[name="nombre"]',
    {
      nombre: `Prueba de carga ${n}`,
      email: `loadtest+${n}@example.com`,
      mensaje: "Mensaje sintético de una prueba de carga. Ignorar.",
      website: "",
    },
    "write",
  );
  check(res, { "contact accepted": (r) => r && r.status === 200 && !r.body.includes('aria-invalid="true"') });
}

export function cron() {
  const res = http.get(`${BASE}/api/internal/process-scheduled-actions`, {
    headers: { Authorization: `Bearer ${__ENV.CRON_SECRET}` },
    tags: { kind: "cron" },
  });
  check(res, { "cron 200": (r) => r.status === 200 });
}
