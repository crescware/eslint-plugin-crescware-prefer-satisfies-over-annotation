type TypeAnnotation = { type: "TSTypeAnnotation" };

type Expression = { type: string };

// Only `length` matters here -- the element/property nodes themselves are never
// inspected, so their shape is left opaque.
type ArrayExpression = { type: "ArrayExpression"; elements: unknown[] };

type ObjectExpression = { type: "ObjectExpression"; properties: unknown[] };

// `expr as T`: `expression` is the asserted value and `typeAnnotation` is the
// target type. `as const` is the special case where the annotation is a
// `TSTypeReference` whose name is the reserved word `const`; `const` cannot be a
// user-defined type name, so this never collides with a real type.
type AsExpression = {
  type: "TSAsExpression";
  expression: Expression;
  typeAnnotation: {
    type: string;
    typeName?: { type: string; name?: string } | null;
  };
};

type VariableDeclaration = {
  type: "VariableDeclaration";
  kind: "const" | "let" | "var";
};

type VariableDeclarator = {
  type: "VariableDeclarator";
  id: { type: string; name?: string; typeAnnotation?: TypeAnnotation | null };
  init?: Expression | null;
  parent?: VariableDeclaration;
};

type ReportDescriptor = { message: string; node: unknown };

// `allowEmptyLiteral` is a union: `true` (default) skips empty literals, `false`
// reports them with the standard message, and `{ message }` reports them with a
// caller-supplied message. The object form exists because the standard
// "use satisfies" message is wrong for an empty literal -- `satisfies` cannot
// type it usefully -- so anyone who opts into reporting needs to override it.
type EmptyLiteralOption = boolean | { message: string };

type RuleOptions = {
  allowWithoutAnnotation?: boolean;
  allowAsAssertion?: boolean;
  allowAsConst?: boolean;
  allowEmptyLiteral?: EmptyLiteralOption;
};

type RuleContext = {
  filename: string;
  options: RuleOptions[];
  report: (descriptor: ReportDescriptor) => void;
};

type Visitor = Record<string, (node: never) => void>;

type Rule = {
  meta?: Record<string, unknown>;
  create: (context: RuleContext) => Visitor;
};

type Plugin = {
  meta: { name: string };
  rules: Record<string, Rule>;
};

// This rule targets TypeScript-only syntax (`satisfies`, `as`, and binding type
// annotations), so it is meaningless on plain JavaScript. Files whose extension
// is `.js` / `.mjs` / `.cjs` / `.jsx` are skipped entirely; `.ts` / `.tsx` /
// `.mts` / `.cts` stay in scope.
const JS_EXTENSIONS = [".js", ".mjs", ".cjs", ".jsx"] satisfies string[];

const isJavaScriptFile = (filename: string): boolean => {
  const lower = filename.toLowerCase();
  return JS_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

// A "plain literal" is an object/array literal with neither a `satisfies` nor an
// `as` clause. Only these surface as ObjectExpression / ArrayExpression: adding
// `satisfies T` makes the initializer a TSSatisfiesExpression, and `as T` /
// `as const` make it a TSAsExpression, so both are already out of scope. Any
// other initializer (`JSON.parse(...)` -> CallExpression, `1` -> Literal) is
// likewise excluded.
const isPlainObjectOrArrayLiteral = (init: Expression): boolean => {
  return init.type === "ObjectExpression" || init.type === "ArrayExpression";
};

// `as const` is allowed: it freezes the literal's type instead of widening it to
// an annotation, so it is categorically different from `as T` and stays out of
// scope. Every other `as` target (including `as number[]`) is reportable.
const isAsConst = (init: AsExpression): boolean => {
  const ann = init.typeAnnotation;
  if (ann.type !== "TSTypeReference") {
    return false;
  }
  const typeName = ann.typeName;
  if (typeName === null || typeName === undefined) {
    return false;
  }
  return typeName.type === "Identifier" && typeName.name === "const";
};

// Follow an `as` chain down to the expression it ultimately wraps. `{} as
// unknown as T` nests TSAsExpression nodes with the literal at the root, so any
// `as` applied to a `{}` / `[]` literal is reportable no matter how many casts
// are stacked on top.
const unwrapAsChain = (init: AsExpression): Expression => {
  let current: Expression = init.expression;
  while (current.type === "TSAsExpression") {
    current = (current as AsExpression).expression;
  }
  return current;
};

// An empty object/array literal: `{}` / `[]` with zero properties/elements.
// `satisfies` is useless here -- `[] satisfies number[]` still infers `never[]`
// and `{} satisfies T` still infers `{}`, so the bound value is unusable. A
// spread (`[...xs]` / `{...o}`) counts as non-empty: its type propagates, so
// `satisfies` works and the literal stays in scope.
const isEmptyObjectOrArrayLiteral = (node: Expression): boolean => {
  if (node.type === "ArrayExpression") {
    return (node as ArrayExpression).elements.length === 0;
  }
  if (node.type === "ObjectExpression") {
    return (node as ObjectExpression).properties.length === 0;
  }
  return false;
};

// Resolve an initializer to the literal it ultimately is -- unwrapping any `as`
// chain -- then test whether that literal is empty. `{} as T` and
// `{} as unknown as T` are both empty-literal cases.
const initIsEmptyLiteral = (init: Expression): boolean => {
  const target =
    init.type === "TSAsExpression" ? unwrapAsChain(init as AsExpression) : init;
  return isEmptyObjectOrArrayLiteral(target);
};

// Type annotation present: `const x: T = {...}`. Always reported -- the type
// must move into a `satisfies` clause regardless of options.
const annotatedMessage = (name: string): string => {
  return `Const '${name}' has a type annotation on a literal initializer. Move the type into a 'satisfies' clause: write 'const ${name} = ... satisfies T' instead of 'const ${name}: T = ...'.`;
};

// No annotation: `const x = {...}`. Reported by default; suppressed only when
// the `allowWithoutAnnotation` option is true.
const annotationlessMessage = (name: string): string => {
  return `Const '${name}' has a literal initializer with no declared type. Add a 'satisfies' clause: write 'const ${name} = ... satisfies T'.`;
};

// `as` assertion other than `as const`: `const x = {...} as T`. Reported by
// default; suppressed only when the `allowAsAssertion` option is true. Unlike a
// plain annotation, `as` also bypasses checking, so moving to `satisfies` both
// preserves the narrow inferred type and restores the assignability check.
const asAssertionMessage = (name: string): string => {
  return `Const '${name}' uses an 'as' assertion on a literal initializer. Move the type into a 'satisfies' clause: write 'const ${name} = ... satisfies T' instead of 'const ${name} = ... as T'. ('as const' is controlled separately by the 'allowAsConst' option.)`;
};

// `as const`: `const x = {...} as const`. It freezes the literal's type but
// declares no type to check the value against, so by default it is reported;
// suppressed only when the `allowAsConst` option is true. The fix keeps the
// freeze AND adds a check by appending `satisfies` -- but `as const` must come
// first: `{...} as const satisfies T` is valid, whereas `{...} satisfies T as
// const` is a type error because `as const` can only apply to a literal, not to
// a `satisfies` expression.
const asConstMessage = (name: string): string => {
  return `Const '${name}' uses 'as const' on a literal initializer but declares no type. Add a 'satisfies' clause: write 'const ${name} = ... as const satisfies T' (the 'as const' must come before 'satisfies'). Enable the 'allowAsConst' option to allow a bare 'as const'.`;
};

const rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require object and array literals bound to a `const` to declare their type with `satisfies` rather than a binding annotation or an `as` assertion. A type annotation is always reported; a missing type is reported unless the `allowWithoutAnnotation` option is enabled; an `as` assertion other than `as const` is reported unless the `allowAsAssertion` option is enabled; an `as const` assertion is reported unless the `allowAsConst` option is enabled. An empty object/array literal (`{}` / `[]`) is allowed by default because `satisfies` cannot type it usefully; set `allowEmptyLiteral` to `false` to report it with the standard message, or to `{ message }` to report it with a custom message.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowWithoutAnnotation: { type: "boolean" },
          allowAsAssertion: { type: "boolean" },
          allowAsConst: { type: "boolean" },
          allowEmptyLiteral: {
            oneOf: [
              { type: "boolean" },
              {
                type: "object",
                properties: { message: { type: "string", minLength: 1 } },
                required: ["message"],
                additionalProperties: false,
              },
            ],
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context: RuleContext): Visitor {
    // TypeScript-only rule: do nothing on JavaScript files.
    if (isJavaScriptFile(context.filename)) {
      return {};
    }
    const allowWithoutAnnotation =
      context.options[0]?.allowWithoutAnnotation === true;
    const allowAsAssertion = context.options[0]?.allowAsAssertion === true;
    const allowAsConst = context.options[0]?.allowAsConst === true;
    const rawEmptyLiteral = context.options[0]?.allowEmptyLiteral;
    const allowEmptyLiteral: EmptyLiteralOption =
      rawEmptyLiteral === undefined ? true : rawEmptyLiteral;

    const checkDeclarator = (node: VariableDeclarator): void => {
      if (node.parent?.kind !== "const") {
        return;
      }
      const id = node.id;
      if (id.type !== "Identifier" || typeof id.name !== "string") {
        return;
      }
      const init = node.init;
      if (init === null || init === undefined) {
        return;
      }
      // Empty literals (`{}` / `[]`, including through an `as` chain, and
      // including `{} as const`) are handled first: `satisfies` cannot type
      // them, so the empty-literal policy takes precedence over both the `as`
      // and `as const` policies. By default they are skipped; `false` falls
      // through to the normal handling below; the object form reports with the
      // caller's custom message.
      if (initIsEmptyLiteral(init)) {
        if (allowEmptyLiteral === true) {
          return;
        }
        if (allowEmptyLiteral !== false) {
          context.report({ message: allowEmptyLiteral.message, node: id });
          return;
        }
      }
      if (init.type === "TSAsExpression") {
        const asExpr = init as AsExpression;
        if (!isPlainObjectOrArrayLiteral(unwrapAsChain(asExpr))) {
          return;
        }
        // `as const` declares no type to check against; reported unless
        // `allowAsConst` is enabled. It is distinct from `as T`, which carries
        // its own option and message.
        if (isAsConst(asExpr)) {
          if (allowAsConst) {
            return;
          }
          context.report({ message: asConstMessage(id.name), node: id });
          return;
        }
        if (allowAsAssertion) {
          return;
        }
        context.report({ message: asAssertionMessage(id.name), node: id });
        return;
      }
      if (!isPlainObjectOrArrayLiteral(init)) {
        return;
      }
      if (id.typeAnnotation?.type === "TSTypeAnnotation") {
        context.report({ message: annotatedMessage(id.name), node: id });
        return;
      }
      if (allowWithoutAnnotation) {
        return;
      }
      context.report({ message: annotationlessMessage(id.name), node: id });
    };

    return {
      VariableDeclarator: checkDeclarator as unknown as (node: never) => void,
    };
  },
} satisfies Rule;

const plugin = {
  meta: { name: "crescware-prefer-satisfies-over-annotation" },
  rules: {
    "prefer-satisfies-over-annotation": rule,
  },
} satisfies Plugin;

export default plugin;
