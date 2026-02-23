import { Theme } from '../../config';

export interface LineProps {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    stroke?: string;
    strokeWidth?: number;
}

export function Line({
    x1,
    y1,
    x2,
    y2,
    stroke = Theme.colors.edge,
    strokeWidth = 1,
}: LineProps): string {
    return `
<line
  x1="${x1}"
  y1="${y1}"
  x2="${x2}"
  y2="${y2}"
  stroke="${stroke}"
  stroke-width="${strokeWidth}"
/>
`;
}
