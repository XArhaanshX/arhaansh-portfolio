// "Enter portfolio": the first visit picks an edition, the terminal (laptop) or the scrolling
// page (phone, /m). The edition that suits this screen is suggested and focused; the choice
// is remembered in localStorage and either edition can switch from its footer.
import { profile } from "@/lib/profile";

export type Edition = "laptop" | "phone";

export function suggestedEdition(): Edition {
  const touch = window.matchMedia("(pointer: coarse)").matches;
  return touch || window.innerWidth < 760 ? "phone" : "laptop";
}

/** Resolves once the laptop edition is picked; picking the phone edition navigates to /m. */
export function chooseEdition(): Promise<void> {
  const suggested = suggestedEdition();
  const job = profile.work.find((w) => !w.to);
  const el = document.createElement("div");
  el.className = "chooser";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "chooser-title");
  const option = (edition: Edition, name: string, desc: string) =>
    `<button type="button" class="ch-opt${edition === suggested ? " ch-suggested" : ""}" data-edition="${edition}">
      <span class="ch-name">${name}${edition === suggested ? ` <span class="ch-tag">suggested here</span>` : ""}</span>
      <span class="ch-desc">${desc}</span>
    </button>`;
  el.innerHTML = `<div class="ch-panel">
    <p class="ch-site">${profile.site}</p>
    <h1 id="chooser-title" class="ch-title">${profile.name}</h1>
    <p class="ch-role">${profile.role}${job ? ` at ${job.org}` : ""}</p>
    <p class="ch-q">Which version do you want to open?</p>
    <div class="ch-opts">
      ${option("laptop", "Laptop", "The full terminal: keyboard shortcuts, the koi pond and live panels.")}
      ${option("phone", "Phone", "A scrolling page made for touch.")}
    </div>
    <p class="ch-note">Remembered for next time. Either version can switch from its footer.</p>
  </div>`;
  document.body.appendChild(el);
  el.querySelector<HTMLButtonElement>(".ch-suggested")?.focus();
  return new Promise((resolve) => {
    el.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-edition]");
      if (!btn) return;
      const edition = btn.dataset.edition as Edition;
      localStorage.setItem("version", edition);
      if (edition === "phone") {
        location.href = "/m";
        return;
      }
      el.remove();
      resolve();
    });
  });
}
