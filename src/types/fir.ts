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

export interface FIRLayout {
  mode: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  wrap: boolean;
  itemSpacing: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  primaryAlign: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAlign: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
}

export interface BorderSideStyle {
  width: number;
  color: RGBAColor;
  style: 'solid' | 'dashed' | 'dotted' | 'none';
}

export interface FIRStyle {
  backgroundColor?: RGBAColor;
  borderRadius?: {
    topLeft: number;
    topRight: number;
    bottomRight: number;
    bottomLeft: number;
  };
  borders?: {
    top: BorderSideStyle;
    right: BorderSideStyle;
    bottom: BorderSideStyle;
    left: BorderSideStyle;
  };
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
  imageData?: {
    base64: string;
    scaleMode: 'FILL' | 'FIT' | 'CROP';
  };
  zIndex: number;
  children?: FIRNode[];
}
