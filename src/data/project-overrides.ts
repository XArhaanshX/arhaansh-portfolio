// The only hand-typed project data. Everything else on the Projects screen is derived from
// GitHub (+ LinkedIn honours) by src/lib/project-labels.ts. One line per wrong label:
//   "owner/repo": { set: { title: "Better Name" } }   // any derived field
//   "owner/repo": { hide: true }                       // drop a repo that passed the filter
//   "owner/repo": { show: true }                       // keep a repo the filter skipped
// Overrides apply at sync time and again whenever projects are read, so an edited line
// takes effect on the next deploy even before the daily refresh runs.
import type { ProjectOverride } from "@/lib/project-labels";

// where projects come from besides github.com/<profile login>: hackathon team orgs (their
// repos are labelled hackathon builds) and single extra repos
export const PROJECT_SOURCES = {
  hackathonOrgs: [] as string[],
  // team builds on teammates' accounts
  repos: ["liualt/Quorum", "liualt/PRISM", "Ujjwal160107/adhigrahan-radar", "Ujjwal160107/vivaad-radar", "Ujjwal160107/CC-Xposed"],
  // His commits are matched by author email (plus the GitHub noreply address, added at sync).
  authorEmails: ["arhaanshjhingan@gmail.com"],
  formerLogins: [] as string[],
};

export const PROJECT_OVERRIDES: Record<string, ProjectOverride> = {
  // not portfolio work
  "XArhaanshX/github-demo": { hide: true },
  "XArhaanshX/test-portfolio": { hide: true },
  "XArhaanshX/Arch-Hyprland-Configs": { hide: true },
  "XArhaanshX/arhaansh-portfolio": { hide: true },
  // LinkedIn names the project, not the repo, so the win cannot be matched by rule
  "XArhaanshX/Multimodal-Fatigue-Detection-System": {
    set: { title: "Fatigue Detection", origin: "hackathon", summary: "Godot driving-sim telemetry plus webcam face signals (OpenCV, MediaPipe) feed a LightGBM fatigue model that escalates haptic alerts.", award: { place: "Winner", event: "Panasonic Equinox '26", when: "Apr 2026", at: "2026-04-01", sure: true } },
  },
  // Power Projects internship: no README, so the filter skips it
  "XArhaanshX/PSSE-Agent": {
    show: true,
    set: { title: "PSSE Agent", category: "NLP & agents", summary: "Agentic AI that turns a substation spec into a validated PSS/E 36 power-system model and single-line diagram." },
  },
  // Smart India Hackathon 2026 build; the README calls it Ankur
  "XArhaanshX/MeghMitra": {
    set: { origin: "hackathon", category: "NLP & agents", summary: "Ankur (SIH 2026): retrieves pre-approved contingency actions from district agriculture plans to match IMD's forecast." },
  },
  // team hackathon builds on teammates' accounts: the repo names do not say what they are
  "liualt/Quorum": {
    set: { title: "AI Interview Panel", origin: "hackathon", category: "NLP & agents", summary: "Quorum (EcoSphere 2026 by Agora): three AI interviewers run a live engineering case while the candidate fixes a real defect in a sandbox." },
  },
  "liualt/PRISM": {
    set: { title: "Code History Search", origin: "hackathon", category: "NLP & agents", summary: "PRISM (Samsung PRISM GenAI Hackathon): ask about a JavaScript repo in plain English and get matching functions across its whole git history." },
  },
  "Ujjwal160107/adhigrahan-radar": {
    set: { title: "Land Delay Radar", origin: "hackathon", category: "Classical ML", summary: "Adhigrahan Radar (SIH 2026, SIH26017): predicts which land-acquisition projects will miss their statutory deadlines, before they do." },
  },
  // no README, so the filter skips it
  "Ujjwal160107/vivaad-radar": {
    show: true,
    set: {
      title: "Land Dispute Radar",
      origin: "hackathon",
      category: "NLP & agents",
      summary: "Vivaad Radar: links court cases to land survey numbers and scores, with evidence, whether a parcel is caught up in litigation.",
      award: { place: "Winner", event: "Innohack 2.0", when: "Aug 2026", at: "2026-08-01", sure: true },
    },
  },
  // his commits are not in it (the ML lives in his DistilBERT model), so the filter skips it
  "Ujjwal160107/CC-Xposed": {
    show: true,
    set: {
      title: "Authorship Classifier",
      origin: "hackathon",
      // the create-next-app README names Bun; the model is DistilBERT
      stack: ["Python", "JavaScript", "Transformers", "FastAPI", "Next.js"],
      category: "NLP & agents",
      summary: "ChatPrint: tells who wrote a piece of text from its stylistic signals, with a DistilBERT classifier behind a FastAPI service.",
      award: { place: "Winner", event: "CodeChef-VIT Internal", when: "Mar 2026", at: "2026-03-01", sure: true },
    },
  },
  // titles that fit the 22-cell index column
  "XArhaanshX/Handwriting-Recognition-Few-Shot-Pipeline": { set: { title: "Few-Shot Handwriting" } },
  "XArhaanshX/Clustering-Problem-for-Discharge-Research": { set: { title: "Partial Discharge", summary: "How robust is partial-discharge classification (simulated, sharp point, void, surface) as the signal degrades with noise?" } },
  "XArhaanshX/Stochastic-Signal-Integration-in-HF-Load-Data": { set: { title: "Stochastic HF Load" } },
  "XArhaanshX/HFLF-Temporal-Resolution-Study": { set: { title: "HFLF Resolution Study" } },
  "XArhaanshX/Single-Circuit-Symbol-Identification": { set: { title: "Circuit Symbol ID" } },
  "XArhaanshX/Symbol-Segmentation-in-SLDs": { set: { title: "SLD Segmentation" } },
  "XArhaanshX/Time-Series-Load-Forecasting": { set: { title: "Load Forecasting" } },
  "XArhaanshX/Churn-Prediction-Project": { set: { title: "Churn Prediction" } },
  "XArhaanshX/Wafer-Anomaly-Detection": { set: { title: "Wafer Anomaly Audit" } },
  "XArhaanshX/SCOPE-Reverse-Engineering": {
    set: {
      title: "CTF-Dortress",
      summary: "Dortress CTF 2026, reverse-engineering track: unpacked a Themida-protected Go binary and rebuilt its source as readable Go.",
      award: { place: "Winner", event: "Dortress CTF 2026", when: "Oct 2026", at: "2026-10-01", sure: true },
    },
  },
  "XArhaanshX/database-project": { set: { title: "Stream-Aware B+Tree" } },
};
