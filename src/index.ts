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

type RuleOptions = { allowWithoutAnnotation?: boolean };

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

const rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require object and array literals bound to a `const` to declare their type with `satisfies` rather than a binding annotation. A type annotation is always reported; a missing type is reported unless the `allowWithoutAnnotation` option is enabled.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowWithoutAnnotation: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context: RuleContext): Visitor {
    const allowWithoutAnnotation =
      context.options[0]?.allowWithoutAnnotation === true;

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
