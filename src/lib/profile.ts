export type Profile = {
  // the site's name: header, boot log, page title
  site: string;
  name: string;
  role: string;
  dob?: string;
  location: string;
  // every place he lives between, shown on the About screen's "based" row
  based: string[];
  bio: string;
  education: string;
  studies: { degree: string; school: string; years: string }[];
  // newest first; `to` absent = current
  work: { role: string; org: string; from: string; to?: string; kind: string }[];
  // papers and studies, newest first; `tag` is the short status column on the terminal
  research: { title: string; tag: string; status: string; when: string; detail: string; url?: string }[];
  skills: string[];
  links: {
    github: string;
    linkedin: string;
    email: string;
    resume?: string;
  };
};

export const profile: Profile = {
  site: "arhaansh.me",
  name: "Arhaansh Jhingan",
  role: "Quant ML Developer",
  location: "Vellore, India",
  based: ["Vellore, TN", "Mumbai, MH"],
  bio: "Machine learning engineer and researcher: computer vision, time-series forecasting and quantitative ML. Quant ML Developer at Mintzy; previously ML Engineer intern at L&T and ML Research intern at Power Projects. BTech CSE at VIT Vellore and BS in Data Science & Applications at IIT Madras.",
  education: "VIT Vellore and IIT Madras",
  studies: [
    { degree: "BTech CSE", school: "VIT Vellore", years: "2025-29" },
    { degree: "BS Data Science & Applications", school: "IIT Madras", years: "2025-29" },
  ],
  work: [
    { role: "Quant ML Developer", org: "Mintzy", from: "Aug 2026", kind: "quant ML" },
    { role: "ML Research Intern", org: "Power Projects", from: "May 2026", to: "Sep 2026", kind: "agentic AI · CAD" },
    { role: "ML Engineer Intern", org: "L&T", from: "Jun 2026", to: "Aug 2026", kind: "computer vision" },
    // student chapters, after the internships
    { role: "AIML Team", org: "CodeChef-VIT", from: "Jan 2026", kind: "student chapter" },
    { role: "AIML Team", org: "IEEE-CS VIT", from: "Jan 2026", kind: "student chapter" },
  ],
  research: [
    {
      title: "Short-term electrical load forecasting",
      tag: "AUPEC",
      status: "Accepted at AUPEC 2026",
      when: "Aug 2026",
      detail: "A new pre-processing approach for load signals on Haryana grid data, under Dr. Ganesan K. Benchmarked 17 forecasting models (statistical, tree-based, deep and attention-based); feature-engineered tree models came out on top.",
      url: "https://github.com/XArhaanshX/Time-Series-Load-Forecasting",
    },
    {
      title: "Fuzzy-logic clustering of discharge data",
      tag: "study",
      status: "Research study",
      when: "Jul 2026",
      detail: "Clustering algorithms written from scratch that combine machine learning with fuzzy logic, to handle uncertainty and overlapping cluster boundaries in partial-discharge data.",
      url: "https://github.com/XArhaanshX/Clustering-Problem-for-Discharge-Research",
    },
  ],
  skills: [
    "Python",
    "PyTorch",
    "scikit-learn",
    "LightGBM",
    "XGBoost",
    "OpenCV",
    "Hugging Face Transformers",
    "Pandas",
    "NumPy",
    "Time-series forecasting",
    "Computer vision",
    "NLP",
    "Quantitative research",
    "FastAPI",
    "SQL",
    "C++",
    "Docker",
    "Linux",
  ],
  links: {
    github: "https://github.com/XArhaanshX",
    linkedin: "https://www.linkedin.com/in/arhaansh-jhingan-swarm/",
    email: "arhaanshjhingan@gmail.com",
    resume: "/resume.pdf",
  },
};
