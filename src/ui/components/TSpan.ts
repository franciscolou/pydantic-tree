export interface TSpanProps {
    fill?: string;
    fontStyle?: string;
    fontWeight?: string;
    children: string;
}

export function TSpan({
    fill,
    fontStyle,
    fontWeight,
    children,
}: TSpanProps): string {
    const style = [
        fill ? `fill: ${fill}` : '',
        fontStyle ? `font-style: ${fontStyle}` : '',
        fontWeight ? `font-weight: ${fontWeight}` : '',
    ]
        .filter(Boolean)
        .join('; ');
    return `<tspan${style ? ` style="${style}"` : ''}>${children}</tspan>`;
}
