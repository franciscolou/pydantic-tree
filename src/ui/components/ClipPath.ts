export interface ClipPathProps {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export function ClipPath({
    id,
    x,
    y,
    width,
    height,
}: ClipPathProps): string {
    return `
<defs>
    <clipPath id="${id}">
        <rect
            x="${x}"
            y="${y}"
            width="${width}"
            height="${height}"
        />
    </clipPath>
</defs>`;
}