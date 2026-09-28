"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

interface FlickeringGridProps extends React.HTMLAttributes<HTMLDivElement> {
  squareSize?: number
  gridGap?: number
  flickerChance?: number
  color?: string
  width?: number
  height?: number
  className?: string
  maxOpacity?: number
}

export const FlickeringGrid: React.FC<FlickeringGridProps> = ({
  squareSize = 4,
  gridGap = 6,
  flickerChance = 0.3,
  color,
  width,
  height,
  className,
  maxOpacity = 0.3,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduceMotion = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [resolvedColor, setResolvedColor] = useState<string>("rgb(0, 0, 0)")

  const resolveColor = useCallback((colorValue: string | undefined): string => {
    if (typeof window === "undefined") {
      return "rgb(0, 0, 0)"
    }

    // This app's tokens are bare HSL channels ("0 0% 3.9%"), so a plain
    // var(--foreground) is not a colour. Wrap it, and resolve anything that
    // mentions a custom property through the DOM: a canvas fillStyle cannot
    // read CSS variables and silently falls back to black.
    const colorToResolve = colorValue || "hsl(var(--foreground))"

    if (colorToResolve.includes("var(")) {
      const tempEl = document.createElement("div")
      tempEl.style.color = colorToResolve
      tempEl.style.position = "absolute"
      tempEl.style.visibility = "hidden"
      document.body.appendChild(tempEl)
      const computedColor = window.getComputedStyle(tempEl).color
      document.body.removeChild(tempEl)
      return computedColor || "rgb(0, 0, 0)"
    }

    return colorToResolve
  }, [])

  useEffect(() => {
    const updateColor = () => {
      const resolved = resolveColor(color)
      setResolvedColor(resolved)
    }

    updateColor()

    // Lenis toggles classes on <html> at every scroll start and stop; only an
    // actual theme change needs the colour re-resolved.
    let wasDark = document.documentElement.classList.contains("dark")
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains("dark")
      if (isDark === wasDark) return
      wasDark = isDark
      updateColor()
    })

    if (typeof window !== "undefined") {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      })
    }

    return () => {
      observer.disconnect()
    }
  }, [color, resolveColor])

  const memoizedColor = useMemo(() => {
    const toRGBA = (colorValue: string) => {
      if (typeof window === "undefined") {
        return `rgba(0, 0, 0,`
      }
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext("2d")
      if (!ctx) return "rgba(255, 0, 0,"
      ctx.fillStyle = colorValue
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b] = Array.from(ctx.getImageData(0, 0, 1, 1).data)
      return `rgba(${r}, ${g}, ${b},`
    }
    return toRGBA(resolvedColor)
  }, [resolvedColor])

  // Opacity is held as one of a few levels rather than a float per square:
  // each level is drawn as one path with one fillStyle, so a frame is a
  // handful of fill() calls instead of one fillRect and one freshly built
  // rgba() string per square (about 12,000 of each across a wide window).
  const LEVELS = 6
  const levelOpacity = useMemo(
    () => Array.from({ length: LEVELS }, (_, l) => ((l + 1) / LEVELS) * maxOpacity),
    [maxOpacity]
  )
  const randomLevel = () => Math.floor(Math.random() * (LEVELS + 1)) - 1 // -1 = off

  const setupCanvas = useCallback(
    (canvas: HTMLCanvasElement, width: number, height: number) => {
      // Capped at 2: past that the 2px squares gain nothing but fill area.
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      const cols = Math.floor(width / (squareSize + gridGap))
      const rows = Math.floor(height / (squareSize + gridGap))

      const squares = new Int8Array(cols * rows)
      for (let i = 0; i < squares.length; i++) squares[i] = randomLevel()

      return { cols, rows, squares, dpr }
    },
    // randomLevel only reads the LEVELS constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [squareSize, gridGap]
  )

  const updateSquares = useCallback(
    (squares: Int8Array, deltaTime: number) => {
      const chance = flickerChance * deltaTime
      for (let i = 0; i < squares.length; i++) {
        if (Math.random() < chance) squares[i] = randomLevel()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flickerChance]
  )

  // The colour lives in a ref that drawGrid reads each frame. If drawGrid
  // depended on it, a theme switch would re-run the setup effect and rebuild
  // both observers mid-transition (WebKit then reported a ResizeObserver loop).
  const colorRef = useRef(memoizedColor)
  const repaintRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    colorRef.current = memoizedColor
    // The animation loop picks the new colour up on its next frame; with
    // reduced motion there is no loop, so repaint once.
    repaintRef.current?.()
  }, [memoizedColor])

  const drawGrid = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      cols: number,
      rows: number,
      squares: Int8Array,
      dpr: number
    ) => {
      ctx.clearRect(0, 0, width, height)
      const step = (squareSize + gridGap) * dpr
      const size = squareSize * dpr
      for (let level = 0; level < LEVELS; level++) {
        ctx.beginPath()
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            if (squares[i * rows + j] === level) ctx.rect(i * step, j * step, size, size)
          }
        }
        ctx.fillStyle = `${colorRef.current}${levelOpacity[level]})`
        ctx.fill()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [squareSize, gridGap, levelOpacity]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationFrameId = 0
    let gridParams: ReturnType<typeof setupCanvas>
    // In refs, not state: an intersection change starts or stops the loop
    // here instead of re-running this effect, which used to rebuild both
    // observers and re-randomise the grid on every scroll in or out.
    let inView = false
    let lastTime = 0
    let lastDraw = 0

    const paint = () =>
      drawGrid(
        ctx,
        canvas.width,
        canvas.height,
        gridParams.cols,
        gridParams.rows,
        gridParams.squares,
        gridParams.dpr
      )

    const updateCanvasSize = () => {
      const newWidth = width || container.clientWidth
      const newHeight = height || container.clientHeight
      setCanvasSize({ width: newWidth, height: newHeight })
      gridParams = setupCanvas(canvas, newWidth, newHeight)
      // Resizing a canvas clears it; repaint at once rather than on the next
      // tick (and under reduced motion there is no next tick).
      paint()
    }

    updateCanvasSize()
    repaintRef.current = reduceMotion ? paint : null

    // The flicker reads the same at about 12 frames a second as at 120, for a
    // tenth of the work: the loop wakes every frame but only redraws on this
    // interval.
    const FRAME_MS = 83

    const animate = (time: number) => {
      animationFrameId = 0
      if (!inView || document.hidden || reduceMotion) return
      if (time - lastDraw >= FRAME_MS) {
        const deltaTime = lastTime ? (time - lastTime) / 1000 : 0
        lastTime = time
        lastDraw = time
        updateSquares(gridParams.squares, deltaTime)
        paint()
      }
      animationFrameId = requestAnimationFrame(animate)
    }

    const start = () => {
      if (animationFrameId || reduceMotion || document.hidden || !inView) return
      lastTime = 0
      animationFrameId = requestAnimationFrame(animate)
    }
    const stop = () => {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = 0
    }

    const resizeObserver = new ResizeObserver(() => updateCanvasSize())
    resizeObserver.observe(container)

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting
        if (inView) start()
        else stop()
      },
      { threshold: 0 }
    )
    intersectionObserver.observe(canvas)

    const onVisibility = () => (document.hidden ? stop() : start())
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      repaintRef.current = null
      stop()
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [setupCanvas, updateSquares, drawGrid, width, height, reduceMotion])

  return (
    <div
      ref={containerRef}
      className={cn(`h-full w-full ${className}`)}
      {...props}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none"
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
        }}
      />
    </div>
  )
}

