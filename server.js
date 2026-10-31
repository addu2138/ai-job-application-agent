import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "dist");

app.use(express.static(dist));
app.get("/health", (_req, res) => res.json({ ok: true, service: "careerpilot" }));

const clean = (value) => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const dateValue = (value) => {
  if (!value) return null;
  if (typeof value === "number") return new Date(value < 1e12 ? value * 1000 : value).toISOString();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
};
const withinDays = (date, days) => !days || !date || Date.now() - Date.parse(date) <= days * 86400000;

app.get("/api/jobs", async (req, res) => {
  const query = clean(req.query.query);
  const locations = clean(req.query.locations).split("|").map(x => x.trim().toLowerCase()).filter(Boolean);
  const days = Math.max(0, Math.min(90, Number(req.query.days) || 0));
  const terms = query.split(/\s+OR\s+|[,;|]/i).map(x => x.trim().toLowerCase()).filter(x => x.length > 2);
  const matchesQuery = (job) => !terms.length || terms.some(term => `${job.title} ${job.company} ${job.description} ${(job.tags || []).join(" ")}`.toLowerCase().includes(term));
  const matchesLocation = (job) => !locations.length || locations.some(term => term === "remote" && job.remote || `${job.location} ${job.remote ? "remote" : ""}`.toLowerCase().includes(term)) || /india/i.test(job.location);
  const results = [];
  const errors = [];

  try {
    const [arbeitnowResult, remotiveResult] = await Promise.allSettled([
      fetch("https://www.arbeitnow.com/api/job-board-api?page=1", { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12000) }),
      fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(terms.slice(0, 3).join(" "))}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12000) })
    ]);

    if (arbeitnowResult.status === "fulfilled" && arbeitnowResult.value.ok) {
      const payload = await arbeitnowResult.value.json();
      for (const item of (payload.data || [])) {
        const job = {
          source: "Arbeitnow",
          source_job_id: String(item.slug || item.id || item.url),
          company: clean(item.company_name),
          title: clean(item.title),
          location: clean(item.location || (item.remote ? "Remote" : "Not specified")),
          remote: Boolean(item.remote),
          work_mode: item.remote ? "Remote" : "Not specified",
          employment_type: (item.job_types || []).join(", "),
          posted_at: dateValue(item.created_at || item.created_at_timestamp),
          url: item.url,
          description: clean(item.description),
          tags: Array.isArray(item.tags) ? item.tags.map(clean).filter(Boolean) : []
        };
        if (job.title && job.url && withinDays(job.posted_at, days) && matchesQuery(job) && matchesLocation(job)) results.push(job);
      }
    } else {
      errors.push("Arbeitnow feed unavailable");
    }

    if (remotiveResult.status === "fulfilled" && remotiveResult.value.ok) {
      const payload = await remotiveResult.value.json();
      for (const item of (payload.jobs || [])) {
        const job = {
          source: "Remotive",
          source_job_id: String(item.id),
          company: clean(item.company_name),
          title: clean(item.title),
          location: clean(item.candidate_required_location || "Remote"),
          remote: true,
          work_mode: "Remote",
          employment_type: clean(item.job_type),
          posted_at: dateValue(item.publication_date),
          url: item.url,
          description: clean(item.description),
          tags: Array.isArray(item.tags) ? item.tags.map(clean).filter(Boolean) : []
        };
        if (job.title && job.url && withinDays(job.posted_at, days) && matchesQuery(job) && matchesLocation(job)) results.push(job);
      }
    } else {
      errors.push("Remotive feed unavailable");
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Job sources could not be reached");
  }

  const unique = [...new Map(results.map(job => [`${job.source}:${job.source_job_id}`, job])).values()]
    .sort((a, b) => (Date.parse(b.posted_at || "") || 0) - (Date.parse(a.posted_at || "") || 0))
    .slice(0, 100);

  res.json({ jobs: unique, sources: ["Arbeitnow", "Remotive"], errors, fetched_at: new Date().toISOString() });
});

app.get("/{*splat}", (_req, res) => res.sendFile(path.join(dist, "index.html")));
const port = Number(process.env.PORT || 10000);
app.listen(port, "0.0.0.0", () => console.log(`CareerPilot listening on ${port}`));
