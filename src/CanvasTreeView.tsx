import { h } from 'preact'
import { useRef, useEffect, useState, useMemo, useCallback } from 'preact/hooks'

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
    const next = current.children.find((child) => child.expanded)
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

  // --- Animation state ---
  // Map of node.key -> animated y position
  const [yPositions, setYPositions] = useState<Record<string, number>>({})
  const yPositionsRef = useRef<Record<string, number>>({})
  const [opacities, setOpacities] = useState<Record<string, number>>({})
  const opacitiesRef = useRef<Record<string, number>>({})
  const [renderedKeys, setRenderedKeys] = useState<Set<string>>(new Set())
  const animationRef = useRef<number | null>(null)

  // Easing function
  function easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  // Animate y positions and opacities to target
  const animateYPositions = useCallback(
    (
      targetY: Record<string, number>,
      targetOpacities: Record<string, number>,
      nextRenderedKeys: Set<string>,
    ) => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      const duration = 20
      const start = performance.now()
      const initialY = { ...yPositionsRef.current }
      const initialO = { ...opacitiesRef.current }
      // For new nodes, animate from parent's y and opacity 0
      for (const k in targetY) {
        if (!(k in initialY)) {
          const parentKey = k.lastIndexOf('.') !== -1 ? k.slice(0, k.lastIndexOf('.')) : null
          if (parentKey && parentKey in targetY) {
            initialY[k] = targetY[parentKey]
          } else {
            initialY[k] = targetY[k]
          }
        }
        if (!(k in initialO)) {
          initialO[k] = 0
        }
      }
      // For disappearing nodes, keep their last y and opacity 1
      for (const k in initialY) {
        if (!(k in targetY)) {
          targetY[k] = initialY[k]
          targetOpacities[k] = 0
        }
      }
      yPositionsRef.current = initialY
      opacitiesRef.current = initialO
      setRenderedKeys(new Set([...Object.keys(targetY)]))
      function step(now: number) {
        const t = Math.min(1, (now - start) / duration)
        const nextY: Record<string, number> = {}
        const nextO: Record<string, number> = {}
        let changed = false
        for (const k in targetY) {
          // Animate y
          const fromY = initialY[k]
          const toY = targetY[k]
          const y = fromY + (toY - fromY) * easeInOutCubic(t)
          nextY[k] = y
          if (Math.abs(y - toY) > 0.5) changed = true
          // Animate opacity
          const fromO = initialO[k] ?? 1
          const toO = targetOpacities[k] ?? 1
          const o = fromO + (toO - fromO) * easeInOutCubic(t)
          nextO[k] = o
          if (Math.abs(o - toO) > 0.01) changed = true
        }
        yPositionsRef.current = nextY
        opacitiesRef.current = nextO
        setYPositions(nextY)
        setOpacities(nextO)
        if (changed && t < 1) {
          animationRef.current = requestAnimationFrame(step)
        } else {
          setYPositions(targetY)
          setOpacities(targetOpacities)
          yPositionsRef.current = { ...targetY }
          opacitiesRef.current = { ...targetOpacities }
          setRenderedKeys(nextRenderedKeys)
          animationRef.current = null
        }
      }
      animationRef.current = requestAnimationFrame(step)
    },
    [],
  )

  // When nodes change, animate y positions and opacities
  useEffect(() => {
    const targetY: Record<string, number> = {}
    const targetOpacities: Record<string, number> = {}
    for (const node of nodes) {
      targetY[node.key] = node.y
      targetOpacities[node.key] = 1
    }
    // For disappearing nodes, fade out
    for (const k of renderedKeys) {
      if (!(k in targetY)) {
        targetY[k] = yPositionsRef.current[k] ?? 0
        targetOpacities[k] = 0
      }
    }
    const nextRenderedKeys = new Set(
      [...Object.keys(targetY)].filter(
        (k) => targetOpacities[k] > 0 || (opacitiesRef.current[k] ?? 1) > 0.01,
      ),
    )
    animateYPositions(targetY, targetOpacities, nextRenderedKeys)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes])

  // Draw tree (use animated y and opacity)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = maxWidth * dpr
    canvas.height = maxHeight * dpr
    canvas.style.width = `${maxWidth}px`
    canvas.style.height = `${maxHeight}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, maxWidth, maxHeight)
    ctx.font = '14px monospace'
    ctx.textBaseline = 'middle'
    // Draw connections
    for (const node of nodes) {
      if (!renderedKeys.has(node.key)) continue
      const nodeY = yPositions[node.key] ?? node.y
      const nodeO = opacities[node.key] ?? 1
      for (const child of node.children) {
        if (!renderedKeys.has(child.key)) continue
        const childY = yPositions[child.key] ?? child.y
        const childO = opacities[child.key] ?? 1
        ctx.save()
        ctx.globalAlpha = Math.min(nodeO, childO)
        ctx.strokeStyle = openPathKeys.has(node.key) && openPathKeys.has(child.key) ? '#7f1d1d' : '#18181b'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(node.x + node.width, nodeY + node.height / 2)
        ctx.bezierCurveTo(
          node.x + node.width + 20,
          nodeY + node.height / 2,
          child.x - 20,
          childY + child.height / 2,
          child.x,
          childY + child.height / 2,
        )
        ctx.stroke()
        ctx.restore()
      }
    }
    // Draw nodes
    for (const node of nodes) {
      if (!renderedKeys.has(node.key)) continue
      const nodeY = yPositions[node.key] ?? node.y
      const nodeO = opacities[node.key] ?? 1
      ctx.save()
      ctx.globalAlpha = nodeO
      ctx.fillStyle = openPathKeys.has(node.key) ? '#7f1d1d' : '#18181b'
      ctx.strokeStyle = '#27272a'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(node.x, nodeY, node.width, node.height, 8)
      ctx.fill()
      ctx.stroke()
      // Expand/collapse icon
      const isObject = node.value && typeof node.value === 'object' && !Array.isArray(node.value)
      if (isObject) {
        ctx.fillStyle = '#27272a'
        ctx.beginPath()
        ctx.arc(node.x + 14, nodeY + node.height / 2, 8, 0, 2 * Math.PI)
        ctx.fill()
        ctx.fillStyle = '#d4d4d8'
        ctx.font = 'bold 14px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(node.expanded ? '-' : '+', node.x + 14, nodeY + node.height / 2 + 1)
        ctx.textAlign = 'left'
      }
      ctx.fillStyle = '#d4d4d8'
      ctx.font = '14px monospace'
      ctx.fillText(
        isObject ? node.label : `${node.label}: ${String(node.value)}`,
        node.x + (isObject ? 30 : 10),
        nodeY + node.height / 2,
      )
      ctx.restore()
    }
  }, [nodes, maxWidth, maxHeight, openPathKeys, yPositions, opacities, renderedKeys])

  // Handle click for expand/collapse (use animated y)
  const handleCanvasClick = (e: MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    for (const node of nodes) {
      const nodeY = yPositions[node.key] ?? node.y
      const isObject = node.value && typeof node.value === 'object' && !Array.isArray(node.value)
      if (
        isObject &&
        x >= node.x + 6 &&
        x <= node.x + 22 &&
        y >= nodeY + node.height / 2 - 8 &&
        y <= nodeY + node.height / 2 + 8
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
