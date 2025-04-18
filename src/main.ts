import { loadFontsAsync, 
  once,
  showUI,
  on,
  emit,
  convertRgbColorToHexColor
 } from '@create-figma-plugin/utilities'

import { getTokenType } from './utils/getTokenType'
import { formatToken, formatReference, formatTypographyToken } from './utils/tokenFormat'

export default function () {
  on('get-variables', async function () {
    const typography = await figma.getLocalTextStylesAsync()
    const jsonTypography = await getJsonTypography(typography)

    const collections = await figma.variables.getLocalVariableCollectionsAsync()
    const { result: jsonVaraibles } = await getJsonVariables(collections)

    const json = {
      ...jsonVaraibles,
      typography: jsonTypography,
    }

    emit('display-json', JSON.stringify(json, null, 2))
  })

  on('notify', function (message: string, options: { error?: boolean }) {
    figma.notify(message, {
      timeout: 2000,
      error: options.error,
    })
  })

  showUI({ height: 800, width: 1000 })
}

const colorHasTransparency = (color: RGBA): boolean => {
  return color.a !== undefined && color.a !== 1
}

// Helper to flatten a nested token tree into a map of { path: value }
function flattenTokens(obj: any, prefix = '', map: Record<string, any> = {}) {
  for (const key in obj) {
    if (obj[key] && typeof obj[key] === 'object' && '$type' in obj[key] && '$value' in obj[key]) {
      map[prefix ? `${prefix}.${key}` : key] = obj[key].$value
    } else if (obj[key] && typeof obj[key] === 'object') {
      flattenTokens(obj[key], prefix ? `${prefix}.${key}` : key, map)
    }
  }
  return map
}

const extractCollectionVariables = async (
  collection: VariableCollection,
  mode: { modeId: string; name: string },
  tokenMap: Record<string, any>,
  parentPath: string = '',
) => {
  const result: any = {}

  await Promise.all(
    collection.variableIds.map(async variableId => {
      const variable = await figma.variables.getVariableByIdAsync(variableId)
      if (!variable) return

      const pathArray = variable?.name.split('/') || []
      let ref = result
      let fullPath = parentPath
      pathArray.forEach(async (path, index) => {
        const formattedPath = path.split(' ').join('-').toLowerCase()
        fullPath = fullPath ? `${fullPath}.${formattedPath}` : formattedPath
        if (index === pathArray.length - 1) {
          let variableValue: any = variable?.valuesByMode[mode.modeId]
          let isAlias = false
          let aliasPath = ''
          let resolvedActualValue: any = undefined

          if (variableValue.type === 'VARIABLE_ALIAS') {
            let v = await figma.variables.getVariableByIdAsync(variableValue.id)
            const collection = await figma.variables.getVariableCollectionByIdAsync(
              v?.variableCollectionId || '',
            )
            variableValue = v?.valuesByMode[collection?.modes[0].modeId || '']
            isAlias = true
            aliasPath = (v?.name ?? '').split(' ').join('-').toLowerCase().replace(/\//g, '.')
            // Try to resolve the referenced value from the tokenMap
            resolvedActualValue = tokenMap[aliasPath]
          }

          let formattedValue = variableValue
          if (variable?.resolvedType === 'COLOR') {
            if (colorHasTransparency(variableValue)) {
              formattedValue = `rgba(${Math.round(variableValue.r * 255)}, ${Math.round(
                variableValue.g * 255,
              )}, ${Math.round(variableValue.b * 255)}, ${variableValue.a?.toFixed(3)})`
            } else {
              formattedValue = `#${convertRgbColorToHexColor(variableValue as RGB)}`
            }
          }
          if (variable?.resolvedType === 'FLOAT' && variableValue.type !== 'VARIABLE_ALIAS') {
            formattedValue = `${variableValue}px`
          }
          if (isAlias) {
            formattedValue = formatReference(aliasPath)
            // If we couldn't resolve from the map, fallback to the computed value
            if (resolvedActualValue === undefined) {
              resolvedActualValue =
                variable?.resolvedType === 'COLOR'
                  ? colorHasTransparency(variableValue)
                    ? `rgba(${Math.round(variableValue.r * 255)}, ${Math.round(
                        variableValue.g * 255,
                      )}, ${Math.round(variableValue.b * 255)}, ${variableValue.a?.toFixed(3)})`
                    : `#${convertRgbColorToHexColor(variableValue as RGB)}`
                  : variableValue
            }
          }

          ref[formattedPath] = formatToken({
            type: getTokenType(variable.resolvedType, formattedValue),
            value: formattedValue,
            resolvedValue: isAlias ? resolvedActualValue : undefined,
            description: variable.description || undefined,
          })
          // Add to tokenMap for future reference resolution
          tokenMap[fullPath] = isAlias ? resolvedActualValue : formattedValue
        } else {
          ref[formattedPath] = ref[formattedPath] || {}
          ref = ref[formattedPath]
        }
      })
    }),
  )
  return result
}

const getJsonVariables = async (
  collections: VariableCollection[],
): Promise<{ result: Record<string, any> }> => {
  let result: Record<string, any> = {}
  let tokenMap: Record<string, any> = {}
  await Promise.all(
    collections.map(async collection => {
      const modes = collection.modes
      let variables: any = {}
      if (modes.length > 1) {
        for (const mode of modes) {
          variables[mode.name.toLowerCase()] = await extractCollectionVariables(
            collection,
            mode,
            tokenMap,
            '',
          )
        }
      } else {
        variables = await extractCollectionVariables(collection, modes[0], tokenMap, '')
      }
      result[collection.name.toLowerCase()] = variables
      // After each collection, update the tokenMap with the new tokens
      flattenTokens(variables, '', tokenMap)
    }),
  )
  return { result }
}

// Add type definitions for nested typography structure
interface Spacing {
  value: number
  unit: 'PIXELS' | 'PERCENT'
}

interface TypographyLeaf {
  id?: string
  fontFamily: string
  fontStyle: string
  fontSize: number | string
  key?: string
  leadingTrim?: string
  letterSpacing?: Spacing | string
  lineHeight?: string
  listSpacing?: number
  paragraphIndent?: number
  paragraphSpacing?: number
  remote?: boolean
  textCase?: string
  textDecoration?: string
  type?: string
}

interface TypographyNode {
  [key: string]: TypographyNode | TypographyLeaf
}

const getBoundVariables = async (boundVariables: Record<string, { id: string }>) => {
  if (!boundVariables) return []
  const boundVariablesArray: { name: string; value: string }[] = []
  await Promise.all(
    Object.keys(boundVariables).map(async variable => {
      const variableValue = await figma.variables.getVariableByIdAsync(
        boundVariables[variable as keyof typeof boundVariables]?.id || '',
      )
      boundVariablesArray.push({ name: variable, value: variableValue?.name || '' })
    }),
  )
  return boundVariablesArray
}

const getJsonTypography = async (typography: TextStyle[]) => {
  // Build a token map from all variables for reference resolution
  let tokenMap: Record<string, any> = {}
  // Try to get all local variable collections and flatten them
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync()
    const { result: jsonVariables } = await getJsonVariables(collections)
    flattenTokens(jsonVariables, '', tokenMap)
  } catch (e) {
    // If not available, skip
  }

  const nested: TypographyNode = {}
  await Promise.all(
    typography.map(async style => {
      const boundVariablesArray = await getBoundVariables(style.boundVariables || {})
      const parts = style.name.split('/').map(part => part.trim())
      let current = nested
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          // assign style properties at the leaf
          // Use references for fontFamily, fontWeight, fontSize if they are variable-bound
          const fontFamilyValue = boundVariablesArray.find(variable => variable.name === 'fontFamily')?.value
          const fontFamilyRef = fontFamilyValue
            ? formatReference((fontFamilyValue ?? '').split(' ').join('-').toLowerCase().replace(/\//g, '.'))
            : undefined
          const fontFamily = fontFamilyRef || style.fontName.family
          const fontFamilyResolved = fontFamilyRef
            ? tokenMap[(fontFamilyValue ?? '').split(' ').join('-').toLowerCase().replace(/\//g, '.')]
            : undefined

          const fontWeightValue = boundVariablesArray.find(variable => variable.name === 'fontWeight')?.value
          const fontWeightRef = fontWeightValue
            ? formatReference((fontWeightValue ?? '').split(' ').join('-').toLowerCase().replace(/\//g, '.'))
            : undefined
          const fontWeight = fontWeightRef || style.fontName.style
          const fontWeightResolved = fontWeightRef
            ? tokenMap[(fontWeightValue ?? '').split(' ').join('-').toLowerCase().replace(/\//g, '.')]
            : undefined

          const fontSizeValue = boundVariablesArray.find(variable => variable.name === 'fontSize')?.value
          const fontSizeRef = fontSizeValue
            ? formatReference((fontSizeValue ?? '').split(' ').join('-').toLowerCase().replace(/\//g, '.'))
            : undefined
          const fontSize = fontSizeRef || { value: style.fontSize, unit: 'px' }
          const fontSizeResolved = fontSizeRef
            ? tokenMap[(fontSizeValue ?? '').split(' ').join('-').toLowerCase().replace(/\//g, '.')]
            : undefined

          const letterSpacingValue = boundVariablesArray.find(
            variable => variable.name === 'letterSpacing',
          )?.value
          const letterSpacingRef = letterSpacingValue
            ? formatReference(
                (letterSpacingValue ?? '').split(' ').join('-').toLowerCase().replace(/\//g, '.'),
              )
            : undefined
          const letterSpacing = letterSpacingRef
            ? letterSpacingRef
            : {
                value:
                  style.letterSpacing.unit === 'PERCENT'
                    ? style.letterSpacing.value
                    : style.letterSpacing.value,
                unit: style.letterSpacing.unit === 'PERCENT' ? '%' : 'px',
              }
          const letterSpacingResolved = letterSpacingRef
            ? tokenMap[(letterSpacingValue ?? '').split(' ').join('-').toLowerCase().replace(/\//g, '.')]
            : undefined

          const lineHeightValue = boundVariablesArray.find(variable => variable.name === 'lineHeight')?.value
          const lineHeightRef = lineHeightValue
            ? formatReference((lineHeightValue ?? '').split(' ').join('-').toLowerCase().replace(/\//g, '.'))
            : undefined
          const lineHeight = lineHeightRef
            ? lineHeightRef
            : style.lineHeight.unit === 'AUTO'
            ? 'auto'
            : style.lineHeight.unit === 'PERCENT'
            ? style.lineHeight.value / 100
            : style.lineHeight.value
          const lineHeightResolved = lineHeightRef
            ? tokenMap[(lineHeightValue ?? '').split(' ').join('-').toLowerCase().replace(/\//g, '.')]
            : undefined

          // Compose resolvedValue object for all properties, not just references
          const resolvedValue = {
            fontFamily: fontFamilyResolved !== undefined ? fontFamilyResolved : style.fontName.family,
            fontWeight: fontWeightResolved !== undefined ? fontWeightResolved : style.fontName.style,
            fontSize: fontSizeResolved !== undefined ? fontSizeResolved : style.fontSize,
            letterSpacing:
              letterSpacingResolved !== undefined
                ? letterSpacingResolved
                : style.letterSpacing.unit === 'PERCENT'
                ? style.letterSpacing.value
                : style.letterSpacing.value,
            lineHeight:
              lineHeightResolved !== undefined
                ? lineHeightResolved
                : style.lineHeight.unit === 'AUTO'
                ? 'auto'
                : style.lineHeight.unit === 'PERCENT'
                ? style.lineHeight.value / 100
                : style.lineHeight.value,
          }

          current[part] = formatTypographyToken({
            fontFamily,
            fontSize,
            fontWeight,
            letterSpacing,
            lineHeight,
            description: style.description || undefined,
            resolvedValue,
          })
        } else {
          if (!current[part]) {
            current[part] = {}
          }
          current = current[part] as TypographyNode
        }
      })
    }),
  )
  return nested
}

const getLineHeight = (lineHeight: LineHeight): string => {
  if (lineHeight.unit === 'AUTO') {
    return 'auto'
  }
  return `${lineHeight.value}px`
}

const getLetterSpacing = (letterSpacing: { unit: string, value: number }): string => {
  if (letterSpacing.unit === 'PERCENT') {
    return `${letterSpacing.value}%`
  }
  return `${letterSpacing.value}px`
}
