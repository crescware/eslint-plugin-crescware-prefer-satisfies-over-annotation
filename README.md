# @crescware/eslint-plugin-crescware-prefer-satisfies-over-annotation

An [oxlint](https://oxc.rs/docs/guide/usage/linter) JS plugin that prefers `satisfies` over a binding type annotation for object and array literals.

## Rule: `prefer-satisfies-over-annotation`

When a `const` binding annotates an **object literal** or **array literal** initializer with a type, the rule reports it and suggests moving the type to a `satisfies` clause:

```ts
// NG
const obj: Something = { ... };
const arr: Something[] = [ ... ];

// OK
const obj = { ... } satisfies Something;
const arr = [ ... ] satisfies Something[];
```

`satisfies` keeps excess-property checking strict while preserving the literal's narrow inferred type, instead of widening it to the annotation.

### Scope

The rule fires only when the initializer is a literal:

- Targets: `const x: T = {}` (object literal) and `const x: T = []` (array literal).
- Out of scope: initializers that are not object/array literals — e.g. `const v: unknown = JSON.parse(...)`, `const n: number = 1`, `const s: string = "x"`. These keep their annotation and are not reported.
- Out of scope: `let` / `var` declarations, and bindings without a type annotation.

## Usage

Register the plugin in your `.oxlintrc.json` and enable the rule:

```json
{
  "jsPlugins": [
    "@crescware/eslint-plugin-crescware-prefer-satisfies-over-annotation"
  ],
  "rules": {
    "crescware-prefer-satisfies-over-annotation/prefer-satisfies-over-annotation": "error"
  }
}
```

## Stack

- **Runtime**: Node.js 24 (via [mise](https://mise.jdx.dev/))
- **Package manager**: pnpm (via corepack)
- **Language**: TypeScript ([native preview](https://github.com/microsoft/typescript-go))
- **Test**: [Vitest](https://vitest.dev/)
- **Lint**: [oxlint](https://oxc.rs/docs/guide/usage/linter)
- **Format**: [oxfmt](https://github.com/oxc-project/oxc)
- **Unused code**: [Knip](https://knip.dev/)

## Setup

```sh
mise install
corepack enable
pnpm install
```

## Scripts

| Command            | Description                              |
| ------------------ | ---------------------------------------- |
| `pnpm build`       | Compile `src` to `dist`                  |
| `pnpm check`       | Run all checks (types, lint, knip, test) |
| `pnpm check:types` | Type check                               |
| `pnpm check:lint`  | Lint and format check                    |
| `pnpm check:knip`  | Unused files/exports check               |
| `pnpm test`        | Run fixture integration tests            |
| `pnpm format`      | Fix lint and format                      |
