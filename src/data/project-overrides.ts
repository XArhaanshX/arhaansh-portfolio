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
  repos: [] as string[],
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
