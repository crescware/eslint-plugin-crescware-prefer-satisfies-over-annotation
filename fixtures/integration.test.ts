import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const oxlintBin = resolve(repoRoot, "node_modules/.bin/oxlint");
const fixturesDir = resolve(repoRoot, "fixtures");
const defaultConfig = resolve(fixturesDir, "oxlintrc.default.json");
const allowConfig = resolve(fixturesDir, "oxlintrc.allow.json");

type Diagnostic = {
  message: string;
  filename: string;
  severity: string;
};

type OxlintReport = { diagnostics: Diagnostic[] };

const runFixtures = (configPath: string): Diagnostic[] => {
  const result = spawnSync(
    oxlintBin,
    ["-c", configPath, "--no-ignore", "-f", "json", resolve(fixturesDir) + "/"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (result.error !== undefined && result.error !== null) {
    throw result.error;
  }
  const parsed = JSON.parse(result.stdout ?? "") as OxlintReport;
  return parsed.diagnostics;
};

const messagesFor = (diagnostics: Diagnostic[], filename: string): string[] => {
  return diagnostics
    .filter((v) => v.filename.endsWith(`/${filename}`))
    .map((v) => v.message);
};

const annotatedMessage = (name: string): string => {
  return `Const '${name}' has a type annotation on a literal initializer. Move the type into a 'satisfies' clause: write 'const ${name} = ... satisfies T' instead of 'const ${name}: T = ...'.`;
};

const annotationlessMessage = (name: string): string => {
  return `Const '${name}' has a literal initializer with no declared type. Add a 'satisfies' clause: write 'const ${name} = ... satisfies T'.`;
};

let defaultDiagnostics: Diagnostic[] = [];
let allowDiagnostics: Diagnostic[] = [];

beforeAll(() => {
  const probe = spawnSync(oxlintBin, ["--version"], { encoding: "utf8" });
  if (probe.status !== 0) {
    throw new Error(`oxlint not runnable: ${probe.stderr ?? ""}`);
  }
  defaultDiagnostics = runFixtures(defaultConfig);
  allowDiagnostics = runFixtures(allowConfig);
});

const okFiles = [
  "ok-satisfies.ts",
  "ok-as.ts",
  "ok-out-of-scope.ts",
  "ok-let-var.ts",
] satisfies string[];

describe("default options", () => {
  test("annotated literals are reported", () => {
    expect(messagesFor(defaultDiagnostics, "ng-annotated.ts")).toEqual([
      annotatedMessage("origin"),
      annotatedMessage("nums"),
    ]);
  });

  test("annotationless literals are reported", () => {
    expect(messagesFor(defaultDiagnostics, "ng-annotationless.ts")).toEqual([
      annotationlessMessage("obj"),
      annotationlessMessage("arr"),
      annotationlessMessage("empty"),
    ]);
  });

  test.each(okFiles)("%s has no diagnostics", (file) => {
    expect(messagesFor(defaultDiagnostics, file)).toEqual([]);
  });

  test("total diagnostics are fully accounted for", () => {
    expect(defaultDiagnostics.length).toBe(5);
  });
});

describe("allowWithoutAnnotation: true", () => {
  test("annotated literals are still reported", () => {
    expect(messagesFor(allowDiagnostics, "ng-annotated.ts")).toEqual([
      annotatedMessage("origin"),
      annotatedMessage("nums"),
    ]);
  });

  test("annotationless literals are ignored", () => {
    expect(messagesFor(allowDiagnostics, "ng-annotationless.ts")).toEqual([]);
  });

  test.each(okFiles)("%s has no diagnostics", (file) => {
    expect(messagesFor(allowDiagnostics, file)).toEqual([]);
  });

  test("total diagnostics are fully accounted for", () => {
    expect(allowDiagnostics.length).toBe(2);
  });
});
