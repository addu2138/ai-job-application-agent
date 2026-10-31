import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowUpRight, BriefcaseBusiness, ChevronDown, CircleHelp, FileSearch, Globe2, LayoutDashboard, ListChecks, LogOut, Mail, MapPin, Plus, Search, Settings2, ShieldCheck, Sparkles, Target, Upload, X } from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type Job = { id:string; company:string; title:string; location:string; work_mode:string; source:string; status:string; match_score:number|null; posted_date:string|null; salary_range:string|null; url:string };
type Application = { id:string; status:string; job:Job };
type CandidateProfile = { full_name?:string|null; email?:string|null; years_experience?:number|null; current_ctc_inr?:number|null; expected_ctc_min_inr?:number|null; expected_ctc_max_inr?:number|null; notice_period_days?:number|null; preferred_locations?:string[]; preferred_work_modes?:string[]; target_roles?:string[] };
type Tab = "Overview" | "Find jobs" | "Applications" | "Profile";

const demoJobs: Job[] = [
 {id:"demo-1",company:"Global Technology",title:"People Analytics Analyst",location:"Gurugram, India",work_mode:"Hybrid",source:"Company careers",status:"new",match_score:94,posted_date:"Recently",salary_range:"₹10–14 LPA",url:"#"},
 {id:"demo-2",company:"Financial Services Co.",title:"Compensation & Benefits Analyst",location:"Noida, India",work_mode:"Hybrid",source:"LinkedIn",status:"new",match_score:91,posted_date:"Recently",salary_range:"₹9–13 LPA",url:"#"},
 {id:"demo-3",company:"Enterprise Software",title:"Data Analyst — HR",location:"Remote, India",work_mode:"Remote",source:"Naukri",status:"new",match_score:88,posted_date:"This week",salary_range:"Not disclosed",url:"#"},
 {id:"demo-4",company:"Consulting Group",title:"Rewards Analyst",location:"Delhi NCR",work_mode:"On-site",source:"Company careers",status:"new",match_score:84,posted_date:"This week",salary_range:"₹10–12 LPA",url:"#"}
];
const nav: {name:Tab;icon:typeof LayoutDashboard}[] = [{name:"Overview",icon:LayoutDashboard},{name:"Find jobs",icon:FileSearch},{name:"Applications",icon:ListChecks},{name:"Profile",icon:Settings2}];
const jobStatuses=[["new","New"],["shortlisted","Shortlisted"],["applied","Applied"],["rejected","Rejected"],["expired","Expired"]] as const;
const appStatuses=[["saved","Saved"],["ready_for_review","Ready for review"],["needs_manual_action","Needs manual action"],["submitted","Submitted"],["interview","Interview"],["offer","Offer"],["rejected","Rejected"],["withdrawn","Withdrawn"]] as const;

function mapDbJob(row:any):Job {
 const min=typeof row.salary_min_inr==="number"?row.salary_min_inr/100000:null;
 const max=typeof row.salary_max_inr==="number"?row.salary_max_inr/100000:null;
 const salary=min!==null&&max!==null?`₹${min.toFixed(1)}–${max.toFixed(1)} LPA`:min!==null?`From ₹${min.toFixed(1)} LPA`:max!==null?`Up to ₹${max.toFixed(1)} LPA`:"Not disclosed";
 return {id:row.id,company:row.company_name||"Company not specified",title:row.job_title||"Untitled role",location:row.location||"Location not specified",work_mode:row.work_mode||"Not specified",source:row.source||"Unknown",status:row.status||"new",match_score:row.match_score===null?null:Number(row.match_score),posted_date:row.posted_at?new Date(row.posted_at).toLocaleDateString():row.discovered_at?new Date(row.discovered_at).toLocaleDateString():null,salary_range:salary,url:row.job_url||"#"};
}
function profileSeed(user:any):CandidateProfile {
 return {email:user.email||"adarshjaiswal470@gmail.com",years_experience:4,current_ctc_inr:528000,expected_ctc_min_inr:1000000,expected_ctc_max_inr:1200000,notice_period_days:90,preferred_locations:["Delhi NCR","Noida","Gurugram","Remote"],preferred_work_modes:["remote","hybrid","onsite"],target_roles:["Data Analyst","HR Analytics Analyst","People Analytics Analyst","Compensation & Benefits Analyst","Rewards Analyst","Reporting Analyst","Business Analyst"]};
}
function moneyLpa(value?:number|null){return value==null?"Not added":`₹${(value/100000).toFixed(2)} LPA`;}

export default function App(){
 const [tab,setTab]=useState<Tab>("Overview");
 const [jobs,setJobs]=useState<Job[]>(isSupabaseConfigured?[]:demoJobs);
 const [applications,setApplications]=useState<Application[]>([]);
 const [profile,setProfile]=useState<CandidateProfile|null>(null);
 const [user,setUser]=useState<any>(null);
 const [authReady,setAuthReady]=useState(!isSupabaseConfigured);
 const [authEmail,setAuthEmail]=useState("adarshjaiswal470@gmail.com");
 const [authBusy,setAuthBusy]=useState(false);
 const [authMessage,setAuthMessage]=useState("");
 const [query,setQuery]=useState("");
 const [filter,setFilter]=useState("All");
 const [uploadName,setUploadName]=useState("");
 const [notice,setNotice]=useState("");
 const [showAdd,setShowAdd]=useState(false);
 const [newCompany,setNewCompany]=useState("");
 const [newTitle,setNewTitle]=useState("");
 const [newLocation,setNewLocation]=useState("Delhi NCR");
 const [newUrl,setNewUrl]=useState("");

 useEffect(()=>{
  if(!supabase)return;
  let alive=true;
  supabase.auth.getSession().then(({data,error})=>{if(!alive)return;if(error)setAuthMessage(error.message);setUser(data.session?.user??null);setAuthReady(true);});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{setUser(session?.user??null);setAuthReady(true);});
  return ()=>{alive=false;subscription.unsubscribe();};
 },[]);

 useEffect(()=>{
  if(!supabase||!user?.id)return;
  let alive=true;
  (async()=>{
   const seed=profileSeed(user);
   const {data:existing,error:profileError}=await supabase.from("candidate_profiles").select("*").eq("user_id",user.id).maybeSingle();
   if(profileError){if(alive)setNotice("Profile could not be loaded: "+profileError.message);return;}
   let profileRow=existing;
   if(!profileRow){
    const {data:created,error}=await supabase.from("candidate_profiles").upsert({user_id:user.id,...seed},{onConflict:"user_id"}).select("*").single();
    if(error){if(alive)setNotice("Profile setup needs attention: "+error.message);return;} profileRow=created;
   }
   const {data:jobRows,error:jobsError}=await supabase.from("jobs").select("*").order("created_at",{ascending:false}).limit(100);
   const {data:appRows,error:appsError}=await supabase.from("applications").select("id,status,job_id,applications_job:jobs!applications_job_id_fkey(*)").order("created_at",{ascending:false}).limit(100);
   if(!alive)return;
   setProfile(profileRow);
   if(jobsError)setNotice("Jobs could not be loaded: "+jobsError.message);else setJobs((jobRows||[]).map(mapDbJob));
   if(appsError)setNotice("Applications could not be loaded: "+appsError.message);
   else setApplications((appRows||[]).filter((a:any)=>a.applications_job).map((a:any)=>({id:a.id,status:a.status,job:mapDbJob(a.applications_job)})));
  })();
  return ()=>{alive=false;};
 },[user?.id]);

 const filtered=useMemo(()=>jobs.filter(j=>(filter==="All"||j.status===filter)&&[j.company,j.title,j.location].join(" ").toLowerCase().includes(query.toLowerCase())),[jobs,filter,query]);
 const counts={total:jobs.length,matched:jobs.filter(j=>(j.match_score||0)>=80).length,applied:jobs.filter(j=>j.status==="applied").length,interview:applications.filter(a=>a.status==="interview").length};

 async function sendMagicLink(){
  if(!supabase)return;
  if(!authEmail.trim()){setAuthMessage("Enter your email address.");return;}
  setAuthBusy(true);setAuthMessage("");
  const {error}=await supabase.auth.signInWithOtp({email:authEmail.trim(),options:{emailRedirectTo:window.location.origin,shouldCreateUser:true}});
  setAuthBusy(false);setAuthMessage(error?"Could not send sign-in link: "+error.message:"Sign-in link sent. Open the email on this device to enter your private workspace.");
 }
 async function signOut(){if(!supabase)return;await supabase.auth.signOut();setJobs([]);setApplications([]);setProfile(null);setTab("Overview");}

 async function addJob(){
  if(!supabase||!user){setNotice("Sign in to save a job to your private workspace.");return;}
  if(!newCompany.trim()||!newTitle.trim()){setNotice("Company and job title are required.");return;}
  const {data,error}=await supabase.from("jobs").insert({user_id:user.id,source:"Manual",job_url:newUrl.trim()||"#",company_name:newCompany.trim(),job_title:newTitle.trim(),location:newLocation.trim()||"Not specified",status:"new"}).select("*").single();
  if(error){setNotice("Job could not be saved: "+error.message);return;}
  setJobs(old=>[mapDbJob(data),...old]);setShowAdd(false);setNewCompany("");setNewTitle("");setNewUrl("");setNotice("Job saved to your workspace.");
 }

 async function updateJobStatus(job:Job,status:string){
  if(!job.id.startsWith("demo-")&&supabase){
   const {error}=await supabase.from("jobs").update({status}).eq("id",job.id);
   if(error){setNotice("Status could not be updated: "+error.message);return;}
   if(status==="applied"&&!applications.some(a=>a.job.id===job.id)){
    const {data,error:appError}=await supabase.from("applications").insert({user_id:user.id,job_id:job.id,status:"submitted",application_method:"manual",applied_at:new Date().toISOString(),notes:"Marked as applied by the candidate; this does not represent an automated submission."}).select("id,status,job_id,applications_job:jobs!applications_job_id_fkey(*)").single();
    if(appError){setNotice("Job status updated, but tracker record could not be created: "+appError.message);}
    else if(data?.applications_job)setApplications(old=>[{id:data.id,status:data.status,job:mapDbJob(data.applications_job)},...old]);
   }
  }
  setJobs(old=>old.map(j=>j.id===job.id?{...j,status}:j));
 }
 async function updateApplicationStatus(app:Application,status:string){
  if(supabase){const {error}=await supabase.from("applications").update({status}).eq("id",app.id);if(error){setNotice("Application status could not be updated: "+error.message);return;}}
  setApplications(old=>old.map(a=>a.id===app.id?{...a,status}:a));
 }
 function handleUpload(file?:File){if(!file)return;setUploadName(file.name);setNotice("Resume selected. Secure storage and resume parsing are the next implementation step; this file has not been uploaded.");}

 if(isSupabaseConfigured&&!authReady)return <div className="auth-wrap"><section className="auth-card"><div className="brand-icon"><Sparkles size={20}/></div><h1>Opening your workspace…</h1><p>Checking your secure sign-in session.</p></section></div>;
 if(isSupabaseConfigured&&!user)return <div className="auth-wrap"><section className="auth-card"><div className="brand"><div className="brand-icon"><Sparkles size={20}/></div><div><b>CareerPilot</b><small>AI JOB AGENT</small></div></div><div className="eyebrow"><ShieldCheck size={14}/> PRIVATE CANDIDATE WORKSPACE</div><h1>Welcome back.</h1><p>Sign in with a secure email link to access your saved jobs and application tracker.</p><label className="auth-label">Email address</label><div className="auth-input"><Mail size={17}/><input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="you@example.com"/></div><button className="primary auth-submit" onClick={sendMagicLink} disabled={authBusy}>{authBusy?"Sending link…":"Email me a sign-in link"} <ArrowUpRight size={16}/></button>{authMessage&&<div className="auth-message">{authMessage}</div>}<small className="auth-foot"><ShieldCheck size={13}/> Your records are private and protected by Supabase row-level security.</small></section></div>;

 return <div className="shell"><aside className="sidebar"><div className="brand"><div className="brand-icon"><Sparkles size={20}/></div><div><b>CareerPilot</b><small>AI JOB AGENT</small></div></div><div className="workspace-label">WORKSPACE</div><nav>{nav.map(n=><button key={n.name} className={tab===n.name?"nav-item active":"nav-item"} onClick={()=>setTab(n.name)}><n.icon size={18}/>{n.name}{n.name==="Applications"&&applications.length>0&&<span className="nav-count">{applications.length}</span>}</button>)}</nav><div className="side-bottom"><div className="secure"><ShieldCheck size={17}/><div><b>Your data stays yours</b><small>Private workspace · RLS protected</small></div></div><div className="user-mini"><div className="avatar">AJ</div><div><b>{user?.email||"Demo candidate"}</b><small>{profile?.years_experience??4} years experience</small></div><button className="mini-logout" title="Sign out" onClick={signOut}><LogOut size={15}/></button></div></div></aside>
 <main className="main"><header className="topbar"><div className="crumb">Workspace <span>/</span> <b>{tab}</b></div><div className="top-actions"><span className={isSupabaseConfigured?"connection on":"connection"}><i/> {isSupabaseConfigured?"Supabase connected":"Demo mode"}</span><button className="icon-button" title="Help"><CircleHelp size={18}/></button><div className="avatar small">AJ</div></div></header>
 <div className="content"><div className="welcome"><div><div className="eyebrow"><Sparkles size={14}/> YOUR CAREER COMMAND CENTRE</div><h1>{tab==="Overview"?"Make your next move count.":tab==="Find jobs"?"Find roles worth applying to.":tab==="Applications"?"Your applications, organised.":"Your candidate profile."}</h1><p>{tab==="Overview"?"One focused workspace to discover relevant roles and manage every application.":tab==="Find jobs"?"Search your saved job leads and review the strongest profile matches.":tab==="Applications"?"Track progress from saved role to offer.":"Keep your experience and preferences ready for matching."}</p></div><label className="resume-btn"><Upload size={16}/>{uploadName?"Resume selected":"Upload resume"}<input type="file" accept=".pdf,.doc,.docx" onChange={e=>handleUpload(e.target.files?.[0])}/></label></div>
 {notice&&<div className="notice"><span>{notice}</span><button onClick={()=>setNotice("")}><X size={15}/></button></div>}
 {tab==="Overview"&&<><div className="stats"><Stat icon={BriefcaseBusiness} label="Jobs discovered" value={counts.total} note="In your workspace"/><Stat icon={Target} label="Strong matches" value={counts.matched} note="80% match or higher"/><Stat icon={ArrowUpRight} label="Applications sent" value={counts.applied} note="Marked applied by you"/><Stat icon={Activity} label="Interviews" value={counts.interview} note="From your tracker"/></div><div className="grid-main"><section className="panel"><div className="panel-head"><div><h2>Recommended opportunities</h2><p>Prioritised against your target roles and experience</p></div><button className="text-btn" onClick={()=>setTab("Find jobs")}>View all <ArrowUpRight size={15}/></button></div><JobList jobs={filtered.slice(0,4)} updateStatus={updateJobStatus}/></section><section className="panel profile-panel"><div className="panel-head"><div><h2>Match preferences</h2><p>Your current search direction</p></div><Target size={18} className="muted"/></div><div className="pref"><span>Target roles</span><b>Data · People Analytics · Rewards</b></div><div className="pref"><span>Preferred locations</span><b>{(profile?.preferred_locations||["Delhi NCR","Noida","Gurugram","Remote"]).join(" · ")}</b></div><div className="pref"><span>Experience</span><b>{profile?.years_experience??4} years</b></div><div className="pref"><span>Expected CTC</span><b>{moneyLpa(profile?.expected_ctc_min_inr)} – {moneyLpa(profile?.expected_ctc_max_inr)}</b></div><div className="pref"><span>Notice period</span><b>{profile?.notice_period_days??90} days</b></div><button className="secondary full" onClick={()=>setTab("Profile")}>Review profile <ArrowUpRight size={15}/></button></section></div><section className="panel steps"><div className="panel-head"><div><h2>Application workflow</h2><p>A transparent process with your approval and control</p></div><span className="tag"><ShieldCheck size={13}/> Human-controlled</span></div><div className="workflow"><Step n="01" title="Discover" text="Find roles from supported sources"/><Step n="02" title="Match" text="Score against your resume and goals"/><Step n="03" title="Prepare" text="Tailor resume and draft answers"/><Step n="04" title="Apply" text="Submit where permitted; verify confirmation"/></div></section></>}
 {tab==="Find jobs"&&<section className="panel"><div className="toolbar"><div className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search title, company or location"/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option>{jobStatuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><button className="primary" onClick={()=>setShowAdd(true)}><Plus size={16}/> Add job</button></div><JobList jobs={filtered} updateStatus={updateJobStatus}/>{showAdd&&<div className="modal-backdrop"><section className="add-modal"><div className="panel-head"><div><h2>Add a job lead</h2><p>Save a role to your private tracker.</p></div><button className="icon-button" onClick={()=>setShowAdd(false)}><X size={17}/></button></div><label>Company<input value={newCompany} onChange={e=>setNewCompany(e.target.value)} placeholder="Company name"/></label><label>Job title<input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="e.g. People Analytics Analyst"/></label><label>Location<input value={newLocation} onChange={e=>setNewLocation(e.target.value)} placeholder="Delhi NCR / Remote"/></label><label>Job link (optional)<input value={newUrl} onChange={e=>setNewUrl(e.target.value)} placeholder="https://…"/></label><div className="modal-actions"><button className="secondary" onClick={()=>setShowAdd(false)}>Cancel</button><button className="primary" onClick={addJob}>Save job</button></div></section></div>}</section>}
 {tab==="Applications"&&<section className="panel"><div className="panel-head"><div><h2>Application tracker</h2><p>Update your hiring progress. Status changes are saved to your account.</p></div></div><ApplicationList applications={applications} updateStatus={updateApplicationStatus}/></section>}
 {tab==="Profile"&&<section className="panel"><div className="panel-head"><div><h2>Candidate profile</h2><p>Profile details stored against your authenticated account</p></div></div><div className="profile-grid"><ProfileField label="Experience" value={`${profile?.years_experience??4} years`}/><ProfileField label="Current CTC" value={moneyLpa(profile?.current_ctc_inr??528000)}/><ProfileField label="Expected CTC" value={`${moneyLpa(profile?.expected_ctc_min_inr??1000000)} – ${moneyLpa(profile?.expected_ctc_max_inr??1200000)}`}/><ProfileField label="Notice period" value={`${profile?.notice_period_days??90} days`}/><ProfileField label="Locations" value={(profile?.preferred_locations||["Delhi NCR","Noida","Gurugram","Remote"]).join(", ")}/><ProfileField label="Work mode" value={(profile?.preferred_work_modes||["remote","hybrid","onsite"]).join(", ")}/><ProfileField label="Target roles" value={(profile?.target_roles||[]).join(", ")||"Data Analyst, HR Analytics, Compensation & Benefits, Rewards"}/><ProfileField label="Application email" value={user?.email||profile?.email||"Not signed in"}/></div><div className="notice neutral"><ShieldCheck size={17}/> Your profile is private to your account. Update or remove information through the connected Supabase project.</div></section>}
 <footer>CareerPilot <span>·</span> Built for a more focused job search <span>·</span> You stay in control of every application.</footer></div></main></div>
}
function Stat({icon:Icon,label,value,note}:{icon:any;label:string;value:number;note:string}){return <div className="stat"><div className="stat-top"><span>{label}</span><Icon size={18}/></div><strong>{value.toString().padStart(2,"0")}</strong><small>{note}</small></div>}
function JobList({jobs,updateStatus}:{jobs:Job[];updateStatus:(job:Job,status:string)=>void}){if(!jobs.length)return <div className="empty"><FileSearch size={25}/><b>No jobs here yet</b><span>Add a lead or connect a job source to get started.</span></div>;return <div className="job-list">{jobs.map(j=><article className="job" key={j.id}><div className="company-mark">{j.company.slice(0,1).toUpperCase()}</div><div className="job-detail"><b>{j.title}</b><span>{j.company} <i>·</i> {j.location}</span><div className="job-meta"><span><Globe2 size={12}/>{j.source}</span><span><MapPin size={12}/>{j.work_mode||"Not specified"}</span>{j.salary_range&&<span>{j.salary_range}</span>}</div></div><div className="score"><strong>{j.match_score??"—"}{j.match_score!==null?"%":""}</strong><small>Match</small></div><select aria-label="Update job status" value={j.status} onChange={e=>updateStatus(j,e.target.value)}>{jobStatuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><a className="open-link" href={j.url||"#"} target="_blank" rel="noreferrer" aria-label="Open job"><ArrowUpRight size={17}/></a></article>)}</div>}
function ApplicationList({applications,updateStatus}:{applications:Application[];updateStatus:(app:Application,status:string)=>void}){if(!applications.length)return <div className="empty"><ListChecks size={25}/><b>No applications tracked yet</b><span>Mark a saved job as Applied to add it to this tracker.</span></div>;return <div className="job-list">{applications.map(a=><article className="job" key={a.id}><div className="company-mark">{a.job.company.slice(0,1).toUpperCase()}</div><div className="job-detail"><b>{a.job.title}</b><span>{a.job.company} <i>·</i> {a.job.location}</span><div className="job-meta"><span>{a.job.source}</span><span>Application tracker</span></div></div><select aria-label="Update application status" value={a.status} onChange={e=>updateStatus(a,e.target.value)}>{appStatuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><a className="open-link" href={a.job.url||"#"} target="_blank" rel="noreferrer" aria-label="Open job"><ArrowUpRight size={17}/></a></article>)}</div>}
function Step({n,title,text}:{n:string;title:string;text:string}){return <div className="step"><span>{n}</span><b>{title}</b><small>{text}</small></div>}
function ProfileField({label,value}:{label:string;value:string}){return <div className="profile-field"><span>{label}</span><b>{value}</b></div>}
