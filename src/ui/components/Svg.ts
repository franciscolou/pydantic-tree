export interface SvgProps {
    id?: string;
    width: string | number;
    height: string | number;
    viewBox: string;
    children: string;
}

export function Svg({ width, height, viewBox, children }: SvgProps): string {
    return `
<svg
  id="svgRoot"
  width="${width}"
  height="${height}"
  viewBox="${viewBox}"
  xmlns="http://www.w3.org/2000/svg"
>
${children}
</svg>
`;
}
