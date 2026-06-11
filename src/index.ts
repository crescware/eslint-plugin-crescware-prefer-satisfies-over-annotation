type TypeAnnotation = { type: "TSTypeAnnotation" };

type Expression = { type: string };

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
type RuleContext = { report: (descriptor: ReportDescriptor) => void };

type Visitor = Record<string, (node: never) => void>;

type Rule = {
  meta?: Record<string, unknown>;
  create: (context: RuleContext) => Visitor;
};

type Plugin = {
  meta: { name: string };
  rules: Record<string, Rule>;
};

// Literal initializers that should carry their type via `satisfies` instead of
// a binding annotation. A plain object literal (`{}`, `{ a: 1 }`) is an
// ObjectExpression and an array literal (`[]`, `[1, 2]`) is an ArrayExpression.
// Anything else as the initializer (`JSON.parse(...)` -> CallExpression,
// `1` -> Literal, `x satisfies T` -> TSSatisfiesExpression) is out of scope.
const literalKind = (init: Expression): "object" | "array" | null => {
  if (init.type === "ObjectExpression") {
    return "object";
  }
  if (init.type === "ArrayExpression") {
    return "array";
  }
  return null;
};

const buildMessage = (name: string, kind: "object" | "array"): string => {
  const placeholder = kind === "object" ? "{...}" : "[...]";
  return `Prefer 'satisfies' over a type annotation on the ${kind} literal bound to '${name}'. Replace 'const ${name}: T = ${placeholder}' with 'const ${name} = ${placeholder} satisfies T'.`;
};

const rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer `const x = {...} satisfies T` over `const x: T = {...}` for object and array literal initializers, so excess-property checks stay strict while the literal keeps its narrow inferred type.",
    },
    schema: [],
  },
  create(context: RuleContext): Visitor {
    const checkDeclarator = (node: VariableDeclarator): void => {
      if (node.parent?.kind !== "const") {
        return;
      }
      const id = node.id;
      if (id.type !== "Identifier" || typeof id.name !== "string") {
        return;
      }
      if (id.typeAnnotation?.type !== "TSTypeAnnotation") {
        return;
      }
      const init = node.init;
      if (init === null || init === undefined) {
        return;
      }
      const kind = literalKind(init);
      if (kind === null) {
        return;
      }
      context.report({
        message: buildMessage(id.name, kind),
        node: id,
      });
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
