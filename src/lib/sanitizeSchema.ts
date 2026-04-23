import { defaultSchema } from 'hast-util-sanitize';

// hast-util-sanitize v6+ does not include 'className' in the wildcard '*' attributes.
// KaTeX's HTML output uses span elements with 'class' and 'style' for glyph layout;
// both must be explicitly allowed here or all math classes get stripped.
export const katexSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      'className',
      'style',
    ],
  },
};
