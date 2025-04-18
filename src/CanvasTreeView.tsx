import { h } from 'preact'
import { useRef, useEffect, useState, useMemo } from 'preact/hooks'

type CanvasTreeNode = {
  key: string
  label: string
  value: any
  depth: number
  parentKey: string | null
  expanded: boolean
  children: CanvasTreeNode[]
  x: number
  y: number
  width: number
  height: number
}

function buildCanvasTree(
  value: any,
  label: string,
  parentKey: string | null,
  depth: number,
  expandedMap: Record<string, boolean>,
  yOffset: { value: number },
  nodeList: CanvasTreeNode[],
  maxWidth: { value: number },
  keyPrefix = '',
) {
  const key = parentKey ? `${parentKey}.${label}` : label
  const isObject = value && typeof value === 'object' && !Array.isArray(value)
  const expanded = expandedMap[key] ?? depth === 0
  const children: CanvasTreeNode[] = []
  const labelText = isObject ? label : `${label}: ${String(value)}`
  const width = (labelText.length + 10) * 7
  const height = 28
  const x = depth * 200

  let y = 0
  let childYs: number[] = []

  if (isObject && expanded) {
    for (const childKey of Object.keys(value)) {
      const childNode = buildCanvasTree(
        value[childKey],
        childKey,
        key,
        depth + 1,
        expandedMap,
        yOffset,
        nodeList,
        maxWidth,
        key,
      )
      children.push(childNode)
      childYs.push(childNode.y)
    }
  }

  if (children.length > 0) {
    // Center parent between first and last child
    y = (children[0].y + children[children.length - 1].y) / 2
  } else {
    y = yOffset.value
    yOffset.value += height + 16
  }

  const node: CanvasTreeNode = {
    key,
    label,
    value,
    depth,
    parentKey,
    expanded,
    children,
    x,
    y,
    width,
    height,
  }
  nodeList.push(node)
  maxWidth.value = Math.max(maxWidth.value, x + width)
  return node
}

// Helper to get the open path keys (from root to the first expanded leaf)
function getOpenPathKeys(node: CanvasTreeNode | undefined): Set<string> {
  const path = new Set<string>()
  let current: CanvasTreeNode | undefined = node
  while (current) {
    path.add(current.key)
    const next = current.children.find(child => child.expanded)
    current = next
  }
  return path
}

function CanvasTreeView({ data }: { data: any }) {
  let parsed: any
  try {
    parsed = typeof data === 'string' ? JSON.parse(data) : data
  } catch {
    return <div class='text-red-500'>Invalid JSON</div>
  }
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({ root: true })
  // Build tree structure and layout
  const [nodes, maxWidth, maxHeight, rootNode] = useMemo(() => {
    const nodeList: CanvasTreeNode[] = []
    const yOffset = { value: 16 }
    const maxWidth = { value: 0 }
    const root = buildCanvasTree(parsed, 'root', null, 0, expandedMap, yOffset, nodeList, maxWidth)
    return [nodeList, maxWidth.value, yOffset.value + 16, root]
  }, [parsed, expandedMap])

  const openPathKeys = useMemo(() => getOpenPathKeys(rootNode), [rootNode])

  // Draw tree
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    // Set the actual pixel size
    canvas.width = maxWidth * dpr
    canvas.height = maxHeight * dpr
    // Set the CSS size
    canvas.style.width = `${maxWidth}px`
    canvas.style.height = `${maxHeight}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0) // Scale all drawing by dpr
    ctx.clearRect(0, 0, maxWidth, maxHeight)
    ctx.font = '14px monospace'
    ctx.textBaseline = 'middle'
    // Draw connections
    for (const node of nodes) {
      for (const child of node.children) {
        // Highlight line if both parent and child are on the open path
        ctx.strokeStyle = openPathKeys.has(node.key) && openPathKeys.has(child.key) ? '#7f1d1d' : '#18181b'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(node.x + node.width, node.y + node.height / 2)
        ctx.bezierCurveTo(
          node.x + node.width + 20,
          node.y + node.height / 2,
          child.x - 20,
          child.y + child.height / 2,
          child.x,
          child.y + child.height / 2,
        )
        ctx.stroke()
      }
    }
    // Draw nodes
    for (const node of nodes) {
      // Node box
      ctx.fillStyle = openPathKeys.has(node.key) ? '#7f1d1d' : '#18181b'
      ctx.strokeStyle = '#27272a'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(node.x, node.y, node.width, node.height, 8)
      ctx.fill()
      ctx.stroke()
      // Expand/collapse icon
      const isObject = node.value && typeof node.value === 'object' && !Array.isArray(node.value)
      if (isObject) {
        ctx.fillStyle = '#27272a'
        ctx.beginPath()
        ctx.arc(node.x + 14, node.y + node.height / 2, 8, 0, 2 * Math.PI)
        ctx.fill()
        ctx.fillStyle = '#d4d4d8'
        ctx.font = 'bold 14px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(node.expanded ? '-' : '+', node.x + 14, node.y + node.height / 2 + 1)
        ctx.textAlign = 'left'
      }
      // Label
      ctx.fillStyle = '#d4d4d8'
      ctx.font = '14px monospace'
      ctx.fillText(
        isObject ? node.label : `${node.label}: ${String(node.value)}`,
        node.x + (isObject ? 30 : 10),
        node.y + node.height / 2,
      )
    }
  }, [nodes, maxWidth, maxHeight, openPathKeys])

  // Handle click for expand/collapse
  const handleCanvasClick = (e: MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    // Find node under click
    for (const node of nodes) {
      const isObject = node.value && typeof node.value === 'object' && !Array.isArray(node.value)
      if (
        isObject &&
        x >= node.x + 6 &&
        x <= node.x + 22 &&
        y >= node.y + node.height / 2 - 8 &&
        y <= node.y + node.height / 2 + 8
      ) {
        setExpandedMap((prev) => ({ ...prev, [node.key]: !node.expanded }))
        break
      }
    }
  }

  return (
    <div style={{ position: 'relative', minHeight: maxHeight, minWidth: maxWidth, overflow: 'auto' }}>
      <canvas
        ref={canvasRef}
        width={maxWidth}
        height={maxHeight}
        style={{
          width: maxWidth,
          height: maxHeight,
          background: 'transparent',
          display: 'block',
          cursor: 'pointer',
        }}
        onClick={handleCanvasClick as any}
      />
    </div>
  )
}

export default CanvasTreeView
