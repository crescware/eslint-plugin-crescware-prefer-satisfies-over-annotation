# @crescware/eslint-plugin-crescware-prefer-satisfies-over-annotation

An [oxlint](https://oxc.rs/docs/guide/usage/linter) JS plugin that prefers `satisfies` over a binding type annotation or an `as` assertion for object and array literals.

## Rule: `prefer-satisfies-over-annotation`

A `const` whose initializer is a plain object or array literal should declare its type with `satisfies`, not with a binding annotation or an `as` assertion. `satisfies` keeps excess-property checking strict while preserving the literal's narrow inferred type, instead of widening it (an annotation) or overriding it (an `as` assertion).

```ts
// NG: a type annotation on the literal (always reported)
const obj: Something = { ... };
const arr: Something[] = [ ... ];

// NG: a literal with no declared type (reported unless `allowWithoutAnnotation` is enabled)
const obj = { ... };
const arr = [ ... ];

// NG: an `as` assertion on the literal (reported unless `allowAsAssertion` is enabled)
const obj = { ... } as Something;
const arr = [ ... ] as Something[];

// NG: `as const` declares no type to check against (reported unless `allowAsConst` is enabled)
const frozen = { ... } as const;

// OK
const obj = { ... } satisfies Something;
const arr = [ ... ] satisfies Something[];
// keep the freeze of `as const` and add a check -- `as const` comes first:
const frozen = { ... } as const satisfies Something;

// OK: empty literals are allowed by default -- `satisfies` cannot type them
// (`[] satisfies T` still infers `never[]`). See `allowEmptyLiteral`.
const empty = {};
const emptyArr = [];
```

### Scope

The rule fires when a `const` initializer is a plain object or array literal (`ObjectExpression` / `ArrayExpression`), or such a literal wrapped in an `as` assertion. Object and array literals are treated the same.

- With a type annotation (`const x: T = {...}`): always reported.
- Without a type annotation (`const x = {...}`): reported by default, ignored when `allowWithoutAnnotation` is `true`.
- With an `as` assertion other than `as const` (`const x = {...} as T`, including chains such as `{...} as unknown as T`): reported by default, ignored when `allowAsAssertion` is `true`.
- With an `as const` assertion (`const x = {...} as const`): reported by default, ignored when `allowAsConst` is `true`. `as const` freezes the literal but declares no type to check against; to keep the freeze and add a check, write `{...} as const satisfies T` (the `as const` must come before `satisfies` -- `{...} satisfies T as const` is a type error because `as const` can only apply to a literal).
- An empty literal (`const x = {}` / `const x = []`, with zero properties/elements): allowed by default, because `satisfies` cannot type it usefully (`[] satisfies T` still infers `never[]`). Controlled by `allowEmptyLiteral`, which takes precedence over `allowAsConst` (so `{} as const` follows the `allowEmptyLiteral` policy). A spread (`[...xs]` / `{...o}`) counts as non-empty and stays in scope.
- Out of scope: a `satisfies` clause (`const x = {...} satisfies T`), and initializers that are not object/array literals (`const v = JSON.parse(...)`, `const n: number = 1`).
- Out of scope: `let` / `var` declarations.

The rule does not autofix; it reports only.

### Options

```jsonc
"crescware-prefer-satisfies-over-annotation/prefer-satisfies-over-annotation": [
  "error",
  {
    // false (default): a literal with no type annotation is reported.
    // true: annotationless literals pass (annotated / `as` literals are unaffected).
    "allowWithoutAnnotation": false,

    // false (default): an `as` assertion other than `as const` is reported.
    // true: `as` assertions on literals pass.
    "allowAsAssertion": false,

    // false (default): a bare `as const` on a literal is reported.
    // true: `as const` on literals passes. (To keep the freeze and a check,
    //       write `{...} as const satisfies T`.)
    "allowAsConst": false,

    // true (default): empty `{}` / `[]` literals are not reported.
    // false: report them with the standard message.
    // { "message": "..." }: report them with that custom message.
    "allowEmptyLiteral": true
  }
]
```

| Option                   | Type                             | Default | Effect                                                                                                                                                                 |
| ------------------------ | -------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allowWithoutAnnotation` | `boolean`                        | `false` | When `true`, suppresses reports for literals that have no type annotation. Annotated and `as`-asserted literals are still reported.                                    |
| `allowAsAssertion`       | `boolean`                        | `false` | When `true`, suppresses reports for `as` assertions (other than `as const`) on literals.                                                                               |
| `allowAsConst`           | `boolean`                        | `false` | When `true`, suppresses reports for a bare `as const` on a literal. To keep the freeze while declaring a type, write `{...} as const satisfies T` (`as const` first).  |
| `allowEmptyLiteral`      | `boolean \| { message: string }` | `true`  | An empty `{}` / `[]` cannot be typed by `satisfies`. `true` skips it; `false` reports it with the standard message; `{ message }` reports it with that custom message. |

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
