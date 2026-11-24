export type FIRNodeType = 'FRAME' | 'TEXT' | 'VECTOR' | 'IMAGE' | 'RECTANGLE';

export interface RGBAColor {
  r: number; // 0..1
  g: number; // 0..1
  b: number; // 0..1
  a: number; // 0..1
}

export interface FIRBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FIRLayoutPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FIRLayout {
  mode: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  wrap: boolean;
  itemSpacing: number;
  padding: FIRLayoutPadding;
  primaryAlign: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAlign: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  sizingHorizontal?: 'FIXED' | 'HUG' | 'FILL';
  sizingVertical?: 'FIXED' | 'HUG' | 'FILL';
}

export interface BorderSideStyle {
  width: number;
  color: RGBAColor;
  style: 'solid' | 'dashed' | 'dotted' | 'none';
}

export type BorderStyle = BorderSideStyle;

export interface FIRBorderRadius {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

export interface FIRBorders {
  top: BorderSideStyle;
  right: BorderSideStyle;
  bottom: BorderSideStyle;
  left: BorderSideStyle;
}

export interface ShadowEffect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW';
  color: RGBAColor;
  offset: {
    x: number;
    y: number;
  };
  radius: number;
  spread?: number;
  visible?: boolean;
}

export interface FIRStyle {
  backgroundColor?: RGBAColor;
  borderRadius?: FIRBorderRadius;
  borders?: FIRBorders;
  shadows?: ShadowEffect[];
  blur?: number;
  opacity?: number;
}

export interface TextSegment {
  start: number;
  end: number;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  lineHeightPx?: number;
  letterSpacingPx?: number;
  color: RGBAColor;
  textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
}

export interface FIRTextData {
  characters: string;
  segments: TextSegment[];
}

export interface FIRImageData {
  base64: string;
  scaleMode: 'FILL' | 'FIT' | 'CROP';
}

export interface FIRNode {
  id: string;
  name: string;
  type: FIRNodeType;
  bounds: FIRBounds;
  visible: boolean;
  opacity: number;
  clipsContent: boolean;
  layout?: FIRLayout;
  style?: FIRStyle;
  textData?: FIRTextData;
  svgContent?: string;
  imageData?: FIRImageData;
  zIndex: number;
  children?: FIRNode[];
}

// ---------------------------------------------------------------------------
// Type Guards & Helpers
// ---------------------------------------------------------------------------

const VALID_NODE_TYPES: ReadonlySet<string> = new Set<FIRNodeType>([
  'FRAME',
  'TEXT',
  'VECTOR',
  'IMAGE',
  'RECTANGLE',
]);

export function isRGBAColor(value: unknown): value is RGBAColor {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.r === 'number' &&
    c.r >= 0 &&
    c.r <= 1 &&
    typeof c.g === 'number' &&
    c.g >= 0 &&
    c.g <= 1 &&
    typeof c.b === 'number' &&
    c.b >= 0 &&
    c.b <= 1 &&
    typeof c.a === 'number' &&
    c.a >= 0 &&
    c.a <= 1
  );
}

export function isFIRBounds(value: unknown): value is FIRBounds {
  if (typeof value !== 'object' || value === null) return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b.x === 'number' &&
    typeof b.y === 'number' &&
    typeof b.width === 'number' &&
    typeof b.height === 'number'
  );
}

export function isFIRNode(value: unknown): value is FIRNode {
  if (typeof value !== 'object' || value === null) return false;
  const node = value as Record<string, unknown>;

  if (typeof node.id !== 'string') return false;
  if (typeof node.name !== 'string') return false;
  if (typeof node.type !== 'string' || !VALID_NODE_TYPES.has(node.type)) return false;
  if (!isFIRBounds(node.bounds)) return false;
  if (typeof node.visible !== 'boolean') return false;
  if (typeof node.opacity !== 'number') return false;
  if (typeof node.clipsContent !== 'boolean') return false;
  if (typeof node.zIndex !== 'number') return false;

  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) return false;
    for (const child of node.children) {
      if (!isFIRNode(child)) return false;
    }
  }

  return true;
}

export interface FIRValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateFIRTree(root: unknown, path = 'root'): FIRValidationResult {
  const errors: string[] = [];

  function validateNode(node: unknown, currentPath: string): void {
    if (typeof node !== 'object' || node === null) {
      errors.push(`${currentPath}: must be a non-null object`);
      return;
    }

    const n = node as Record<string, unknown>;

    if (typeof n.id !== 'string' || n.id.trim() === '') {
      errors.push(`${currentPath}.id: must be a non-empty string`);
    }

    if (typeof n.name !== 'string') {
      errors.push(`${currentPath}.name: must be a string`);
    }

    if (typeof n.type !== 'string' || !VALID_NODE_TYPES.has(n.type)) {
      errors.push(
        `${currentPath}.type: must be one of FRAME, TEXT, VECTOR, IMAGE, RECTANGLE (received: ${String(n.type)})`
      );
    }

    if (!isFIRBounds(n.bounds)) {
      errors.push(`${currentPath}.bounds: must have numeric x, y, width, height`);
    }

    if (typeof n.visible !== 'boolean') {
      errors.push(`${currentPath}.visible: must be boolean`);
    }

    if (typeof n.opacity !== 'number' || n.opacity < 0 || n.opacity > 1) {
      errors.push(`${currentPath}.opacity: must be a number between 0 and 1`);
    }

    if (typeof n.clipsContent !== 'boolean') {
      errors.push(`${currentPath}.clipsContent: must be boolean`);
    }

    if (typeof n.zIndex !== 'number') {
      errors.push(`${currentPath}.zIndex: must be a number`);
    }

    // Specific type checks
    if (n.type === 'TEXT') {
      if (!n.textData || typeof (n.textData as Record<string, unknown>).characters !== 'string') {
        errors.push(`${currentPath}.textData: TEXT nodes must contain textData with characters`);
      }
    }

    if (n.type === 'VECTOR') {
      if (typeof n.svgContent !== 'string') {
        errors.push(`${currentPath}.svgContent: VECTOR nodes must contain string svgContent`);
      }
    }

    if (n.type === 'IMAGE') {
      if (!n.imageData || typeof (n.imageData as Record<string, unknown>).base64 !== 'string') {
        errors.push(`${currentPath}.imageData: IMAGE nodes must contain imageData with base64 string`);
      }
    }

    if (n.children !== undefined) {
      if (!Array.isArray(n.children)) {
        errors.push(`${currentPath}.children: must be an array`);
      } else {
        n.children.forEach((child, index) => {
          validateNode(child, `${currentPath}.children[${index}]`);
        });
      }
    }
  }

  validateNode(root, path);

  return {
    valid: errors.length === 0,
    errors,
  };
}
