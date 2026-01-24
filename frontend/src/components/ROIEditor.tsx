import { useRef, useState, useEffect, useCallback } from 'react'
import { MousePointer2, Undo, Trash2, Save } from 'lucide-react'

interface Point {
    x: number
    y: number
}

interface ROIEditorProps {
    points: Point[]
    onChange: (points: Point[]) => void
    imageUrl?: string
    className?: string
    mode?: 'polygon' | 'line'
}

export default function ROIEditor({ points, onChange, imageUrl, className = '', mode = 'polygon' }: ROIEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [currentPoints, setCurrentPoints] = useState<Point[]>(points || [])
    const [canvasSize, setCanvasSize] = useState({ width: 640, height: 360 })

    // Sync external points
    useEffect(() => {
        setCurrentPoints(points || [])
    }, [points])

    // Resize handler
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect()
                setCanvasSize({ width: rect.width, height: rect.height })
            }
        }
        updateSize()
        window.addEventListener('resize', updateSize)
        return () => window.removeEventListener('resize', updateSize)
    }, [])

    // Draw canvas
    const draw = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        if (currentPoints.length === 0) return

        if (mode === 'line') {
            // Draw Line Logic
            if (currentPoints.length < 2) {
                // Just draw the first point
                const p = currentPoints[0]
                ctx.beginPath()
                ctx.arc(p.x * canvas.width, p.y * canvas.height, 6, 0, Math.PI * 2)
                ctx.fillStyle = '#f59e0b'
                ctx.fill()
                return
            }

            const p1 = { x: currentPoints[0].x * canvas.width, y: currentPoints[0].y * canvas.height }
            const p2 = { x: currentPoints[1].x * canvas.width, y: currentPoints[1].y * canvas.height }

            // Draw the line
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.strokeStyle = '#f59e0b'
            ctx.lineWidth = 4
            ctx.stroke()

                // Draw Points
                ;[p1, p2].forEach((p, i) => {
                    ctx.beginPath()
                    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
                    ctx.fillStyle = i === 0 ? '#22c55e' : '#ef4444' // Start Green, End Red
                    ctx.fill()
                    ctx.strokeStyle = '#fff'
                    ctx.lineWidth = 2
                    ctx.stroke()
                })

            // Draw Direction Indicator (Arrow A -> B implies implied direction)
            // Let's assume implied normal direction. To make it clearer, let's just label sides A and B relative to the line.
            const midX = (p1.x + p2.x) / 2
            const midY = (p1.y + p2.y) / 2

            // Normal vector
            const dx = p2.x - p1.x
            const dy = p2.y - p1.y
            const len = Math.sqrt(dx * dx + dy * dy)
            const nx = -dy / len * 40
            const ny = dx / len * 40

            // Draw Arrow from Midpoint
            ctx.beginPath()
            ctx.moveTo(midX, midY)
            ctx.lineTo(midX + nx, midY + ny)
            ctx.strokeStyle = '#3b82f6' // Blue arrow
            ctx.lineWidth = 3
            ctx.stroke()

            // Arrow Head
            const headLen = 10
            const angle = Math.atan2(ny, nx)
            ctx.beginPath()
            ctx.moveTo(midX + nx, midY + ny)
            ctx.lineTo(midX + nx - headLen * Math.cos(angle - Math.PI / 6), midY + ny - headLen * Math.sin(angle - Math.PI / 6))
            ctx.lineTo(midX + nx - headLen * Math.cos(angle + Math.PI / 6), midY + ny - headLen * Math.sin(angle + Math.PI / 6))
            ctx.closePath()
            ctx.fillStyle = '#3b82f6'
            ctx.fill()

            // Text Labels
            ctx.font = '14px Arial'
            ctx.fillStyle = 'white'
            ctx.fillText("IN", midX + nx + 10, midY + ny)
            ctx.fillText("OUT", midX - nx + 10, midY - ny)

        } else {
            // Draw Polygon Logic (Existing)
            ctx.beginPath()
            ctx.moveTo(
                currentPoints[0].x * canvas.width,
                currentPoints[0].y * canvas.height
            )

            for (let i = 1; i < currentPoints.length; i++) {
                ctx.lineTo(
                    currentPoints[i].x * canvas.width,
                    currentPoints[i].y * canvas.height
                )
            }

            // Close path if we have at least 3 points
            if (currentPoints.length >= 3) {
                ctx.closePath()
                ctx.fillStyle = 'rgba(245, 158, 11, 0.2)' // Amber fill
                ctx.fill()
            }

            ctx.strokeStyle = '#f59e0b' // Amber stroke
            ctx.lineWidth = 2
            ctx.stroke()

            // Draw vertices
            currentPoints.forEach((point, index) => {
                ctx.beginPath()
                ctx.arc(
                    point.x * canvas.width,
                    point.y * canvas.height,
                    6,
                    0,
                    Math.PI * 2
                )
                ctx.fillStyle = index === 0 ? '#22c55e' : '#f59e0b' // Green for first point
                ctx.fill()
                ctx.strokeStyle = '#fff'
                ctx.lineWidth = 2
                ctx.stroke()
            })
        }
    }, [currentPoints, mode])

    useEffect(() => {
        draw()
    }, [draw, canvasSize])

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing && currentPoints.length > 0 && mode === 'polygon') return // If not drawing and has points, don't add more unless editing? 
        // Actually existing logic allowed adding points. Let's keep it simple.

        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return

        const x = (e.clientX - rect.left) / rect.width
        const y = (e.clientY - rect.top) / rect.height

        const newPoints = [...currentPoints, { x, y }]

        if (mode === 'line') {
            // Max 2 points for line
            if (newPoints.length > 2) {
                // Start over if clicking 3rd time? Or just replace 2nd?
                // Let's replace the last one to allow adjustment, or clear if full.
                // Better UX: limit to 2. User must undo/clear to adding.
                return
            }
        }

        setCurrentPoints(newPoints)
        onChange(newPoints)
        setIsDrawing(true)
    }


    const handleUndo = () => {
        if (currentPoints.length > 0) {
            const newPoints = currentPoints.slice(0, -1)
            setCurrentPoints(newPoints)
        }
    }

    const handleClear = () => {
        setCurrentPoints([])
        setIsDrawing(false)
        onChange([])
    }

    const handleSave = () => {
        onChange(currentPoints)
    }

    return (
        <div className={`relative ${className}`}>
            <div
                ref={containerRef}
                className="relative bg-transparent rounded-lg overflow-hidden border border-stone-700 aspect-video w-full h-full"
            >
                {/* Background image/video placeholder */}
                {imageUrl && (
                    <img
                        src={imageUrl}
                        alt="Camera Feed"
                        className="absolute inset-0 w-full h-full object-cover opacity-50"
                    />
                )}

                <canvas
                    ref={canvasRef}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    onClick={handleCanvasClick}
                    className="absolute inset-0 w-full h-full cursor-crosshair"
                />

                {/* Instructions Overlay */}
                {currentPoints.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center p-4 bg-black/60 rounded-lg backdrop-blur-sm">
                            <MousePointer2 className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                            <p className="text-sm text-white font-medium">Click to draw detection zone</p>
                            <p className="text-xs text-stone-400 mt-1">Click points to form a polygon</p>
                        </div>
                    </div>
                )}

                {/* Drawing indicator */}
                {isDrawing && currentPoints.length >= 3 && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-amber-500/80 rounded text-xs text-black font-bold animate-pulse">
                        Click first point (green) to close
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 mt-3">
                <button
                    type="button"
                    onClick={handleUndo}
                    disabled={currentPoints.length === 0}
                    className="flex items-center gap-1 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 rounded-lg text-xs text-stone-300 transition-colors"
                >
                    <Undo className="w-3 h-3" />
                    Undo
                </button>
                <button
                    type="button"
                    onClick={handleClear}
                    disabled={currentPoints.length === 0}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 rounded-lg text-xs text-red-400 transition-colors"
                >
                    <Trash2 className="w-3 h-3" />
                    Clear
                </button>
                <div className="flex-1" />
                <span className="text-xs text-stone-500">
                    {currentPoints.length} points
                </span>
                {currentPoints.length >= 3 && !isDrawing && (
                    <button
                        type="button"
                        onClick={handleSave}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-xs text-white font-medium transition-colors"
                    >
                        <Save className="w-3 h-3" />
                        Apply Zone
                    </button>
                )}
            </div>
        </div>
    )
}
