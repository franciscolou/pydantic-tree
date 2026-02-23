export interface BoxProps {
    x: number;
    y: number;
    width: number;
    height: number;
    borderRadius?: number;
    fill?: string;
    stroke?: string;
}

export function ClassBox({
    x,
    y,
    width,
    height,
    borderRadius = 0,
    fill = 'transparent',
    stroke = 'black',
}: BoxProps): string {
    return `
<rect
  x="${x}"
  y="${y}"
  width="${width}"
  height="${height}"
  rx="${borderRadius}"
  ry="${borderRadius}"
  fill="${fill}"
  stroke="${stroke}"
/>
`;
}
