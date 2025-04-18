import { TokenType } from '../types/token'

/**
 * Get the type of a variable
 * figma variable types: "BOOLEAN" | "FLOAT" | "STRING" | "COLOR"
 *
 * token types as for Design Tokens Format Module: "color" | "dimension" | "fontFamily" | "fontWeight" | "duration" | "cubicBezier" | "number" | "additional"
 *
 * @param variable - The variable to get the type of
 * @returns The type of the variable
 *
 * ! Here we default all the float to dimension type as letter we tranform
 * ! all of them to dimension anyway, it can became an issue.
 */

export const getTokenType = (type: string, value: any): TokenType => {
  if (type === 'COLOR') return 'color'
  if (type === 'FLOAT') {
    if (isDimension(value)) return 'dimension'
    return 'number'
  }
  if (type === 'STRING') {
    if (isFontWeight(value)) return 'fontWeight'
    return 'additional'
  }
  if (type === 'BOOLEAN') return 'additional'
  return 'additional'
}

const isDimension = (value: any): boolean => {
  return /^\d+(\.\d+)?(px|rem)$/i.test(value.toString())
}

const isFontWeight = (value: any): boolean => {
  return (
    /^[1-9]00$/.test(value.toString()) ||
    /^(thin|extra-?light|light|regular|normal|medium|semi-?bold|bold|extra-?bold|black)$/i.test(
      value.toString(),
    )
  )
}
