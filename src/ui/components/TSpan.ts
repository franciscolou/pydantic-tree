export interface TSpanProps {
    fill?: string;
    children: string;
}

export function TSpan({ fill, children }: TSpanProps): string {
    return `<tspan${fill ? ` style="fill: ${fill}"` : ''}>${children}</tspan>`;
}
