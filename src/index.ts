type TypeAnnotation = { type: "TSTypeAnnotation" };

type Expression = { type: string };

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

type RuleOptions = {
  allowWithoutAnnotation?: boolean;
  allowAsAssertion?: boolean;
};

type RuleContext = {
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
  return `Const '${name}' uses an 'as' assertion on a literal initializer. Move the type into a 'satisfies' clause: write 'const ${name} = ... satisfies T' instead of 'const ${name} = ... as T'. ('as const' is allowed.)`;
};

const rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require object and array literals bound to a `const` to declare their type with `satisfies` rather than a binding annotation or an `as` assertion. A type annotation is always reported; a missing type is reported unless the `allowWithoutAnnotation` option is enabled; an `as` assertion other than `as const` is reported unless the `allowAsAssertion` option is enabled.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowWithoutAnnotation: { type: "boolean" },
          allowAsAssertion: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context: RuleContext): Visitor {
    const allowWithoutAnnotation =
      context.options[0]?.allowWithoutAnnotation === true;
    const allowAsAssertion = context.options[0]?.allowAsAssertion === true;

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
      if (init.type === "TSAsExpression") {
        const asExpr = init as AsExpression;
        if (isAsConst(asExpr)) {
          return;
        }
        if (!isPlainObjectOrArrayLiteral(unwrapAsChain(asExpr))) {
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
