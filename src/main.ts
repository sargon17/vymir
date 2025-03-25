import { loadFontsAsync, once, showUI, on, emit } from '@create-figma-plugin/utilities'

import { InsertCodeHandler } from './types'

export default function () {
  on('get-variables', async function () {
    const typography = await figma.getLocalTextStylesAsync();
    const jsonTypography = await getJsonTypography(typography)
    emit('display-json', JSON.stringify(jsonTypography, null, 2))
  })

  on('notify', function (message: string, options: { error?: boolean }) { 
    figma.notify(message, {
      timeout: 2000,
      error: options.error,
    })
  })

  showUI({ height: 600, width: 600 })
}

// Add type definitions for nested typography structure
interface Spacing {
  value: number;
  unit: "PIXELS" | "PERCENT";
}

interface TypographyLeaf {
  id?: string;
  fontFamily: string;
  fontStyle: string;
  fontSize: number | string;
  key?: string;
  leadingTrim?: string;
  letterSpacing?: Spacing | string;
  lineHeight?: string;
  listSpacing?: number;
  paragraphIndent?: number;
  paragraphSpacing?: number;
  remote?: boolean;
  textCase?: string;
  textDecoration?: string;
  type?: string;
}

interface TypographyNode {
  [key: string]: TypographyNode | TypographyLeaf;
}

const getBoundVariables = async (boundVariables: Record<string, { id: string }>) => {
  if (!boundVariables) return []

  const boundVariablesArray: { name: string; value: string }[] = [];
  await Promise.all(Object.keys(boundVariables).map(async (variable) => {
    const variableValue = await figma.variables.getVariableByIdAsync(boundVariables[variable as keyof typeof boundVariables]?.id || '')
    boundVariablesArray.push({ name: variable, value: variableValue?.name || '' })
  }))
  return boundVariablesArray
}

const getJsonTypography = async (typography: TextStyle[]) => {
  const nested: TypographyNode = {};
  await Promise.all(typography.map(async (style) => {
    const boundVariablesArray = await getBoundVariables(style.boundVariables || {})
    const parts = style.name.split('/').map(part => part.trim());
    let current = nested;


    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        // assign style properties at the leaf
        current[part] = {
          // id: style.id,
          fontFamily: boundVariablesArray.find(variable => variable.name === 'fontFamily')?.value || style.fontName.family,
          fontStyle: boundVariablesArray.find(variable => variable.name === 'fontStyle')?.value || style.fontName.style,
          fontSize: boundVariablesArray.find(variable => variable.name === 'fontSize')?.value || style.fontSize,
          // key: style.key,
          // leadingTrim: style.leadingTrim,
          letterSpacing: boundVariablesArray.find(variable => variable.name === 'letterSpacing')?.value || getLetterSpacing(style.letterSpacing),
          lineHeight: boundVariablesArray.find(variable => variable.name === 'lineHeight')?.value || getLineHeight(style.lineHeight),
          // listSpacing: style.listSpacing,
          // paragraphIndent: style.paragraphIndent,
          // paragraphSpacing: style.paragraphSpacing,
          // remote: style.remote,
          // textCase: style.textCase,
          // textDecoration: style.textDecoration,
          // type: style.type
        };
      } else {
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part] as TypographyNode;
      }
    });
  }));
  return nested;
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
