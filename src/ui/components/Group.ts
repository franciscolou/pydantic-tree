export interface GroupProps {
    id?: string;
    transform?: string;
    className?: string;
    clipPath?: string;
    dataPtBox?: boolean;
    children: string;
}

export function Group({
    id,
    transform,
    className,
    clipPath,
    dataPtBox,
    children,
}: GroupProps): string {
    const attrs = [
        id ? `id="${id}"` : '',
        transform ? `transform="${transform}"` : '',
        className ? `class="${className}"` : '',
        clipPath ? `clip-path="${clipPath}"` : '',
        dataPtBox ? 'data-pt-box' : '',
    ]
        .filter(Boolean)
        .join(' ');
    return `<g${attrs ? ' ' + attrs : ''}>${children}</g>`;
}
