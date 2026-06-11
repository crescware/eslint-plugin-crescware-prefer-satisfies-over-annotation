import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const oxlintBin = resolve(repoRoot, "node_modules/.bin/oxlint");
const fixturesDir = resolve(repoRoot, "fixtures");
const configPath = resolve(fixturesDir, "oxlintrc.fixtures.json");

type Diagnostic = {
  message: string;
  filename: string;
  severity: string;
};

type OxlintReport = { diagnostics: Diagnostic[] };

type LiteralKind = "object" | "array";

let allDiagnostics: Diagnostic[] = [];

const runFixturesOnce = (): Diagnostic[] => {
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

const messagesFor = (filename: string): string[] => {
  return allDiagnostics
    .filter((v) => v.filename.endsWith(`/${filename}`))
    .map((v) => v.message);
};

const expectedMessage = (name: string, kind: LiteralKind): string => {
  const placeholder = kind === "object" ? "{...}" : "[...]";
  return `Prefer 'satisfies' over a type annotation on the ${kind} literal bound to '${name}'. Replace 'const ${name}: T = ${placeholder}' with 'const ${name} = ${placeholder} satisfies T'.`;
};

beforeAll(() => {
  const probe = spawnSync(oxlintBin, ["--version"], { encoding: "utf8" });
  if (probe.status !== 0) {
    throw new Error(`oxlint not runnable: ${probe.stderr ?? ""}`);
  }
  allDiagnostics = runFixturesOnce();
});

describe("OK fixtures produce no false positives", () => {
  test.each([
    "ok-satisfies.ts",
    "ok-no-annotation.ts",
    "ok-out-of-scope.ts",
    "ok-let-var.ts",
  ])("%s", (file) => {
    expect(messagesFor(file)).toEqual([]);
  });
});

const ngCases = [
  {
    file: "ng-object.ts",
    note: "object literal annotations",
    bindings: [
      { name: "origin", kind: "object" },
      { name: "settings", kind: "object" },
    ],
  },
  {
    file: "ng-array.ts",
    note: "array literal annotations",
    bindings: [
      { name: "nums", kind: "array" },
      { name: "names", kind: "array" },
      { name: "empty", kind: "array" },
    ],
  },
] satisfies {
  file: string;
  note: string;
  bindings: { name: string; kind: LiteralKind }[];
}[];

describe("NG fixtures match exactly", () => {
  test.each(ngCases)("$file ($note)", ({ file, bindings }) => {
    expect(messagesFor(file)).toEqual(
      bindings.map((b) => expectedMessage(b.name, b.kind)),
    );
  });
});

describe("Totals", () => {
  test("no diagnostics emitted from OK fixtures", () => {
    const okMessages = allDiagnostics
      .filter((v) => /\/ok-/.test(v.filename))
      .map((v) => v.message);
    expect(okMessages).toEqual([]);
  });

  test("every diagnostic is accounted for by an NG fixture case", () => {
    const expectedTotal = ngCases.reduce(
      (sum, ngCase) => sum + ngCase.bindings.length,
      0,
    );
    expect(allDiagnostics.length).toBe(expectedTotal);
  });
});
