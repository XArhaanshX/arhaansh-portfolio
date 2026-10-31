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
  // only a README pointing at Multimodal-Fatigue-Detection-System
  "XArhaanshX/Fatigue-Detection": { hide: true },
  // Wunder Fund Alpha Connectome: the rules keep the approach private until 15 Nov 2026
  "XArhaanshX/WunderFund-Quant-Dev-Challenge": {
    set: {
      title: "Quant ML Challenge",
      category: "Quant ML",
      stack: ["Python"],
      summary: "Wunder Fund Alpha Connectome: predict future price moves from 112 order-book and trade features. Code goes public after 15 Nov 2026.",
    },
  },
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
    set: { origin: "hackathon", category: "NLP & agents", summary: "Ankur (Smart India Hackathon 2026): finds the pre-approved farm contingency plan that matches the weather forecast." },
  },
  // team hackathon builds on teammates' accounts: the repo names do not say what they are
  "liualt/Quorum": {
    set: { title: "AI Interview Panel", origin: "hackathon", category: "NLP & agents", summary: "Quorum (EcoSphere 2026): three AI interviewers run a live engineering case while the candidate fixes a real bug." },
  },
  "liualt/PRISM": {
    set: { title: "Code History Search", origin: "hackathon", category: "NLP & agents", summary: "PRISM (Samsung GenAI Hackathon): plain-English search over a JavaScript repo's code and its whole git history." },
  },
  "Ujjwal160107/adhigrahan-radar": {
    set: { title: "Land Delay Radar", origin: "hackathon", category: "Classical ML", summary: "Adhigrahan Radar (Smart India Hackathon 2026): predicts which land-acquisition projects will miss their legal deadlines." },
  },
  // no README, so the filter skips it
  "Ujjwal160107/vivaad-radar": {
    show: true,
    set: {
      title: "Land Dispute Radar",
      origin: "hackathon",
      category: "NLP & agents",
      summary: "Vivaad Radar: links court cases to land survey numbers and shows, with evidence, whether a parcel is in litigation.",
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
  "XArhaanshX/Handwriting-Recognition-Few-Shot-Pipeline": { set: { title: "Few-Shot Handwriting", summary: "Picks out one handwritten letter, like a lowercase a, in scanned paragraphs with a deterministic few-shot pipeline." } },
  "XArhaanshX/Clustering-Problem-for-Discharge-Research": { set: { title: "Partial Discharge", summary: "How robust is partial-discharge classification (simulated, sharp point, void, surface) as the signal degrades with noise?" } },
  "XArhaanshX/Stochastic-Signal-Integration-in-HF-Load-Data": { set: { title: "Stochastic HF Load", summary: "Adds controlled random noise to high-frequency load data to test how robust forecasting models are." } },
  "XArhaanshX/HFLF-Temporal-Resolution-Study": { set: { title: "HFLF Resolution Study", summary: "Tests whether simple persistence still beats LightGBM at load forecasting as the sampling interval changes." } },
  "XArhaanshX/Single-Circuit-Symbol-Identification": { set: { title: "Circuit Symbol ID", summary: "Finds a circuit symbol inside large engineering diagrams from one template image, with a hybrid vision pipeline." } },
  "XArhaanshX/Symbol-Segmentation-in-SLDs": { set: { title: "SLD Segmentation", summary: "Locates circuit symbols in single line diagrams (SLDs), the drawings engineers use to map power networks." } },
  "XArhaanshX/Time-Series-Load-Forecasting": { set: { title: "Load Forecasting", summary: "Compares machine learning models for predicting electricity demand on a power grid." } },
  "XArhaanshX/Load-forecasting": { set: { title: "Load Forecast Survey" } },
  "XArhaanshX/Churn-Prediction-Project": { set: { title: "Churn Prediction", summary: "Predicts which customers will leave, from data cleaning and SMOTE class balancing to a FastAPI service." } },
  "XArhaanshX/Wafer-Anomaly-Detection": { set: { title: "Wafer Anomaly Audit", summary: "Finds and fixes the bugs in a broken chip-fab anomaly detector, with evidence for every fix." } },
  "XArhaanshX/Tremor-Detection": { set: { summary: "An ESP32 wristband that detects Parkinson's rest tremor on the band itself and scores how severe it is." } },
  "XArhaanshX/SCOPE-Reverse-Engineering": {
    set: {
      title: "CTF-Dortress",
      summary: "Dortress CTF 2026, reverse-engineering track: unpacked a Themida-protected Go binary and rebuilt its source as readable Go.",
      award: { place: "Winner", event: "Dortress CTF 2026", when: "Oct 2026", at: "2026-10-01", sure: true },
    },
  },
  "XArhaanshX/database-project": { set: { title: "Stream-Aware B+Tree" } },
};
