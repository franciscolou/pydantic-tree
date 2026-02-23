export interface TextProps {
    x: number;
    y: number;
    fontSize?: number;
    fontWeight?: string | number;
    fill?: string;
    textAnchor?: string;
    children: string;
}

export function Text({
    x,
    y,
    fontSize,
    fontWeight,
    fill,
    textAnchor,
    children,
}: TextProps): string {
    return `
<text
  x="${x}"
  y="${y}"
  ${fontSize ? `font-size="${fontSize}"` : ''}
  ${fontWeight ? `font-weight="${fontWeight}"` : ''}
  ${fill ? `fill="${fill}"` : ''}
  ${textAnchor ? `text-anchor="${textAnchor}"` : ''}
>
${children}
</text>
`;
}
