# CareerPilot — AI Job Application Agent

A candidate-controlled workspace to collect job leads, compare them with a candidate profile, prepare application materials, and track application progress.

## Current capabilities

- Dashboard with job, strong-match, application and interview counters.
- Job lead list with search and status filters.
- Application status tracking.
- Candidate profile defaults based on the initial project setup.
- Browser-side PDF/DOCX resume text extraction with contact, experience and skills detection.
- Extracted resume text and detected fields saved to the authenticated candidate profile.
- Supabase client wiring using browser-safe publishable/anon credentials.
- Render deployment manifest and health endpoint.

## Candidate defaults

- 4 years of experience; Data Analyst / HR & People Analytics / Compensation & Benefits / Rewards / Reporting / Business Analyst roles.
- Delhi NCR, Noida, Gurugram and Remote; hybrid and on-site are acceptable.
- Current CTC ₹5.28 LPA; expected CTC ₹10–12 LPA; 90-day notice period.

Update profile values from the authenticated profile before relying on them for live matching.

## Local development

```bash
npm install
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

## Supabase

The existing project schema contains candidate_profiles, jobs, applications, application_events and agent_runs with row-level security enabled.

1. Set `VITE_SUPABASE_URL` to the existing project URL.
2. Set `VITE_SUPABASE_ANON_KEY` to the project's publishable/anon key.
3. Configure Supabase Auth providers and redirect URLs for local and deployed origins.
4. Do not expose the Supabase service_role key in Vite/browser variables.

The frontend uses email magic-link sign-in, then loads candidate, job and application rows only after an authenticated session exists. Resume text and detected fields are stored in the user's RLS-protected candidate profile. The first authenticated session creates a candidate profile using the setup defaults. Demo sample cards are local presentation data and are not inserted into Supabase.

## Render deployment

Connect this repository to Render as a Web Service. The included `render.yaml` defines the build, start command and health check. Configure these environment variables in the Render dashboard:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Vite embeds `VITE_*` variables into the client bundle, so only the public publishable/anon key is appropriate here. Never use a service-role or secret key.

## Important limitations — not yet production automation

Live public job discovery is implemented through the server-side `/api/jobs` endpoint using Arbeitnow and Remotive public feeds. Results can be reviewed in Find Jobs, scored with a keyword-overlap resume match, saved to the authenticated workspace, and opened at the original posting. LinkedIn, Naukri, Indeed and Foundit are not directly scraped or imported; those portals require supported official APIs or licensed feeds. Advanced semantic resume-to-job scoring, AI-generated tailored resumes and answers, portal-specific form adapters, application submission, CAPTCHA/OTP handling, confirmation verification and email notifications are not implemented yet. PDF/DOCX text extraction runs in the browser; the original file is not uploaded. Scanned/image-only PDFs need OCR and are not parsed by this version. The interface does not claim to submit applications. Any future submission flow must respect each site's terms, rate limits, user review and anti-bot controls; no CAPTCHA/OTP or access-control bypass is supported.


## Live job discovery

The Find Jobs screen can request current listings from the public Arbeitnow and Remotive feeds through the same-origin `/api/jobs` endpoint. Search uses the candidate's saved target roles and preferred locations, plus the selected recency window. Review each listing and save it manually; opening the original posting happens in a new tab. Feed coverage, freshness and location matching depend on the providers, and this is not a complete index of LinkedIn/Naukri/Indeed/Foundit.
