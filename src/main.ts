import { loadFontsAsync, 
  once,
  showUI,
  on,
  emit,
  convertRgbColorToHexColor
 } from '@create-figma-plugin/utilities'

import { InsertCodeHandler } from './types'

export default function () {
  on('get-variables', async function () {
    const typography = await figma.getLocalTextStylesAsync();
    const jsonTypography = await getJsonTypography(typography)

    const collections = await figma.variables.getLocalVariableCollectionsAsync()
    const jsonVaraibles = await getJsonVariables(collections)

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

  showUI({ height: 600, width: 600 })
}

const colorHasTransparency = (color: RGBA): boolean => {
  return color.a !== undefined && color.a !== 1
}


const extractCollectionVariables = async (collection: VariableCollection, mode: { modeId: string, name: string }) => {
  const result: any = {};

  await Promise.all(
    collection.variableIds.map(async (variableId) => {

      const variable = await figma.variables.getVariableByIdAsync(variableId);

      const pathArray = variable?.name.split('/') || [];
      let ref = result;

      let variableValue: any = variable?.valuesByMode[mode.modeId]

      if (variableValue.type === "VARIABLE_ALIAS") {
        let v = await figma.variables.getVariableByIdAsync(variableValue.id)
        const collection = await figma.variables.getVariableCollectionByIdAsync(v?.variableCollectionId || '')
        console.log(v, v?.valuesByMode, mode.modeId, collection)
        variableValue = v?.valuesByMode[collection?.modes[0].modeId || '']
      }

      if (variable?.resolvedType === "COLOR") {
        if (colorHasTransparency(variableValue)) {
          variableValue = `rgba(${Math.round(variableValue.r * 255)}, ${Math.round(variableValue.g * 255)}, ${Math.round(variableValue.b * 255)}, ${variableValue.a?.toFixed(3)})`
        } else {
          variableValue = `#${convertRgbColorToHexColor(variableValue as RGB)}`
        }
      }

      
      if (variable?.resolvedType === "FLOAT" && variableValue.type !== "VARIABLE_ALIAS") {
        variableValue = `${variableValue}px`
      }


      pathArray.forEach((path, index) => {

        const formattedPath = path.split(' ').join('-').toLowerCase()

        if (index === pathArray.length - 1) {
          ref[formattedPath] = { "value": variableValue };
        } else {
          ref[formattedPath] = ref[formattedPath] || {};
          ref = ref[formattedPath];
        }
      });
    })
  );

  return result
}

const getJsonVariables = async (collections: VariableCollection[]): Promise<Record<string, any>> => {
  let result: Record<string, any> = {}
  await Promise.all(collections.map(async (collection) => {
    const modes = collection.modes
    let variables: any = {}

    if (modes.length > 1) {
      for (const mode of modes) {
        variables[mode.name.toLowerCase()] = await extractCollectionVariables(collection, mode)
      }
    } else {
      variables = await extractCollectionVariables(collection, modes[0])
    }
    
    result[collection.name.toLowerCase()] = variables
  }))

  return result
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
