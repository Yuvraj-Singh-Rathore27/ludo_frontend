import React, { useEffect, useRef, useState, useContext, useCallback } from 'react';
import { PlayerDataContext, SocketContext } from '../../../App';
import mapImage from '../../../images/map.jpg';
import positionMapCoords from '../positions';
import pawnImages from '../../../constants/pawnImages';
import canPawnMove from './canPawnMove';
import getPositionAfterMove from './getPositionAfterMove';
import styles from '../Gameboard.module.css';

const SAFE_POSITIONS = [16, 24, 29, 37, 42, 50, 55, 63];

// ─── Module-level image preload ───────────────────────────────────────────────
// Images are decoded ONCE when the module loads, not on every canvas repaint.
// All subsequent ctx.drawImage() calls are synchronous and zero-decode-cost.
const MAP_IMAGE = (() => {
    const img = new Image();
    img.src = mapImage;
    return img;
})();

const PAWN_IMAGES = (() => {
    const cache = {};
    Object.entries(pawnImages).forEach(([color, src]) => {
        const img = new Image();
        img.src = src;
        cache[color] = img;
    });
    return cache;
})();
// ─────────────────────────────────────────────────────────────────────────────

const drawStar = (ctx, cx, cy, radius = 9) => {
    const spikes = 5;
    const innerRadius = radius * 0.42;
    let angle = -Math.PI / 2;
    const step = Math.PI / spikes;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? radius : innerRadius;
        ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
        angle += step;
    }
    ctx.closePath();
    ctx.fillStyle = 'gold';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
};

const Map = ({ pawns, nowMoving, rolledNumber }) => {
    const player = useContext(PlayerDataContext);
    const socket = useContext(SocketContext);

    const canvasRef = useRef(null);
    const ctxRef = useRef(null);           // cached 2d context — not re-fetched on every event
    const touchableAreasRef = useRef({});  // Path2D map keyed by pawn._id — never mutates props
    const rafRef = useRef(null);           // pending RAF handle for mousemove throttle
    const hintPawnRef = useRef(null);      // mirrors hintPawn state without triggering renders

    const [hintPawn, setHintPawn] = useState(null);

    // Cache the 2d context once on mount — avoids getContext() overhead on every event
    useEffect(() => {
        ctxRef.current = canvasRef.current?.getContext('2d') ?? null;
    }, []);

    // ── Canvas redraw ──────────────────────────────────────────────────────────
    // Runs only when pawns or hintPawn change. No new Image() objects created here —
    // all images are pre-decoded at module level above.
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(MAP_IMAGE, 0, 0);

            SAFE_POSITIONS.forEach(pos => {
                const { x, y } = positionMapCoords[pos];
                drawStar(ctx, x, y);
            });

            // Build fresh Path2D hit areas — stored in ref, never written to prop objects
            const areas = {};
            pawns.forEach(pawn => {
                const { x, y } = positionMapCoords[pawn.position];

                const area = new Path2D();
                area.arc(x, y, 12, 0, 2 * Math.PI);
                areas[pawn._id] = area;

                const img = PAWN_IMAGES[pawn.color];
                if (img?.complete) {
                    ctx.drawImage(img, x - 17, y - 15, 35, 30);
                }
            });
            touchableAreasRef.current = areas;

            // Ghost hint pawn — semi-transparent preview of where pawn will land
            if (hintPawn) {
                const { x, y } = positionMapCoords[hintPawn.position];
                const img = PAWN_IMAGES[hintPawn.color];
                if (img?.complete) {
                    ctx.globalAlpha = 0.45;
                    ctx.drawImage(img, x - 17, y - 15, 35, 30);
                    ctx.globalAlpha = 1;
                }
            }
        };

        if (MAP_IMAGE.complete) {
            draw();
        } else {
            // First paint — map not decoded yet; draw once it is
            MAP_IMAGE.addEventListener('load', draw, { once: true });
            return () => MAP_IMAGE.removeEventListener('load', draw);
        }
    }, [pawns, hintPawn]);

    // ── Click handler ──────────────────────────────────────────────────────────
    const handleCanvasClick = useCallback(event => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const cursorX = (event.clientX - rect.left) * scaleX;
        const cursorY = (event.clientY - rect.top) * scaleY;

        for (const pawn of pawns) {
            const area = touchableAreasRef.current[pawn._id];
            if (area && ctx.isPointInPath(area, cursorX, cursorY)) {
                if (canPawnMove(pawn, rolledNumber)) {
                    socket?.emit('game:move', pawn._id);
                }
            }
        }

        // Clear hint after move
        hintPawnRef.current = null;
        setHintPawn(null);
    }, [pawns, rolledNumber, socket]);

    // ── Mouse move handler ─────────────────────────────────────────────────────
    // Throttled to one RAF per frame — prevents canvas redraws on every mouse pixel.
    // setHintPawn only called when the hovered pawn actually changes.
    const handleMouseMove = useCallback(event => {
        if (!nowMoving || !rolledNumber) return;
        if (rafRef.current) return; // already a frame pending — skip

        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const canvas = canvasRef.current;
            const ctx = ctxRef.current;
            if (!canvas || !ctx) return;

            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (event.clientX - rect.left) * scaleX;
            const y = (event.clientY - rect.top) * scaleY;

            let found = false;
            for (const pawn of pawns) {
                const area = touchableAreasRef.current[pawn._id];
                if (
                    area &&
                    ctx.isPointInPath(area, x, y) &&
                    player.color === pawn.color &&
                    canPawnMove(pawn, rolledNumber)
                ) {
                    const pawnPosition = getPositionAfterMove(pawn, rolledNumber);
                    if (pawnPosition) {
                        canvas.style.cursor = 'pointer';
                        // Only trigger re-render when the hovered pawn changes
                        if (hintPawnRef.current?.id !== pawn._id) {
                            const next = { id: pawn._id, position: pawnPosition, color: 'grey' };
                            hintPawnRef.current = next;
                            setHintPawn(next);
                        }
                        found = true;
                        break;
                    }
                }
            }

            if (!found) {
                canvas.style.cursor = 'default';
                if (hintPawnRef.current !== null) {
                    hintPawnRef.current = null;
                    setHintPawn(null);
                }
            }
        });
    }, [nowMoving, rolledNumber, pawns, player.color]);

    // Cancel any pending RAF on unmount to prevent stale-closure callbacks
    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    return (
        <canvas
            className={styles.canvas}
            width={460}
            height={460}
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
        />
    );
};

// React.memo — prevents canvas repaint when parent re-renders for unrelated reasons
// (ping update, clock tick, toast notification, etc.)
export default React.memo(Map);
