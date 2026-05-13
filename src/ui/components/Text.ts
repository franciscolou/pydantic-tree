export interface TextProps {
    x: number;
    y: number;
    fontSize?: number;
    fontWeight?: string | number;
    fill?: string;
    textAnchor?: string;
    sectionLabel?: boolean;
    children: string;
}

export function Text({
    x,
    y,
    fontSize,
    fontWeight,
    fill,
    textAnchor,
    sectionLabel,
    children,
}: TextProps): string {
    return `
<text
  x="${x}"
  y="${y}"
  ${fontSize ? `font-size="${fontSize}"` : ''}
  ${fontWeight ? `font-weight="${fontWeight}"` : ''}
  ${fill ? `style="fill: ${fill}"` : ''}
  ${textAnchor ? `text-anchor="${textAnchor}"` : ''}
  ${sectionLabel ? 'data-pt-section-label="1"' : ''}
>
${children}
</text>
`;
}
