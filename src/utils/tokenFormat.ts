// Utility functions for formatting design tokens according to the Design Tokens Format Module spec

export interface FormatTokenOptions {
  type: string
  value: any
  description?: string
  extensions?: any
  deprecated?: boolean
  resolvedValue?: any
}

export function formatToken({
  type,
  value,
  description,
  extensions,
  deprecated,
  resolvedValue,
}: FormatTokenOptions) {
  const token: any = {
    $type: type,
    $value: value,
  }
  if (description) token.$description = description
  if (extensions) token.$extensions = extensions
  if (deprecated !== undefined) token.$deprecated = deprecated
  if (resolvedValue !== undefined) token.$resolvedValue = resolvedValue
  return token
}

export function formatReference(tokenPath: string): string {
  return `{${tokenPath}}`
}

// Example for formatting a typography token
export interface FormatTypographyTokenOptions {
  fontFamily: any
  fontSize: any
  fontWeight: any
  letterSpacing: any
  lineHeight: any
  description?: string
  extensions?: any
  deprecated?: boolean
  resolvedValue?: any
}

export function formatTypographyToken({
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
  description,
  extensions,
  deprecated,
  resolvedValue,
}: FormatTypographyTokenOptions) {
  // Helper to wrap value and resolvedValue
  function wrap(val: any, resolved: any) {
    if (resolved !== undefined) {
      return { $value: val, $resolvedValue: resolved }
    }
    return { $value: val }
  }
  const value = {
    fontFamily: wrap(fontFamily, resolvedValue?.fontFamily),
    fontSize: wrap(fontSize, resolvedValue?.fontSize),
    fontWeight: wrap(fontWeight, resolvedValue?.fontWeight),
    letterSpacing: wrap(letterSpacing, resolvedValue?.letterSpacing),
    lineHeight: wrap(lineHeight, resolvedValue?.lineHeight),
  }
  return formatToken({
    type: 'typography',
    value,
    description,
    extensions,
    deprecated,
  })
}

// Example for formatting a shadow token
export interface FormatShadowTokenOptions {
  color: any
  offsetX: any
  offsetY: any
  blur: any
  spread: any
  inset?: boolean
  description?: string
  extensions?: any
  deprecated?: boolean
  resolvedValue?: any
}

export function formatShadowToken({
  color,
  offsetX,
  offsetY,
  blur,
  spread,
  inset,
  description,
  extensions,
  deprecated,
  resolvedValue,
}: FormatShadowTokenOptions) {
  const value: any = {
    color,
    offsetX,
    offsetY,
    blur,
    spread,
  }
  if (inset !== undefined) value.inset = inset
  return formatToken({
    type: 'shadow',
    value,
    description,
    extensions,
    deprecated,
    resolvedValue,
  })
}
