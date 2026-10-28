import { expect, test } from "bun:test";
import { getProjects, projects, PROJECTS_KEY, type Project } from "./projects";
import { useStore } from "./store";

const kv = new Map<string, string>();
useStore({ get: async (k) => kv.get(k) ?? null, put: async (k, v) => void kv.set(k, v) });

const entry = (repo: string) => ({ ...projects[0], repo }) as Project;

test("an empty or corrupt store list serves the bundle", async () => {
  kv.set(PROJECTS_KEY, "[]");
  expect(await getProjects()).toBe(projects);
  kv.set(PROJECTS_KEY, "{not json");
  expect(await getProjects()).toBe(projects);
});

test("a fresh store list is served over the bundle, with overrides applied", async () => {
  kv.set(PROJECTS_KEY, JSON.stringify([entry("XArhaanshX/github-demo"), entry("XArhaanshX/fresh")]));
  const list = await getProjects();
  expect(list.map((p) => p.repo)).toEqual(["XArhaanshX/fresh"]);
});
