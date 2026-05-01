export interface TSpanProps {
    fill?: string;
    children: string;
}

export function TSpan({ fill, children }: TSpanProps): string {
    return `<tspan${fill ? ` fill="${fill}"` : ''}>${children}</tspan>`;
}
