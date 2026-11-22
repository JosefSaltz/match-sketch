/** A point in world feet or screen pixels, depending on context. */
export type Point = { x: number; y: number };

/** A size in screen pixels. */
export type Size = { width: number; height: number };

/** A bay's dimensions in feet: width left-to-right, depth uprange-to-downrange. */
export type CanvasSize = { widthFt: number; depthFt: number };
