export interface GroupProps {
    id?: string;
    transform?: string;
    className?: string;
    clipPath?: string;
    dataPtBox?: boolean;
    dataPtBoxId?: string;
    children: string;
}

function escapeAttr(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

export function Group({
    id,
    transform,
    className,
    clipPath,
    dataPtBox,
    dataPtBoxId,
    children,
}: GroupProps): string {
    const attrs = [
        id ? `id="${id}"` : '',
        transform ? `transform="${transform}"` : '',
        className ? `class="${className}"` : '',
        clipPath ? `clip-path="${clipPath}"` : '',
        dataPtBox ? 'data-pt-box' : '',
        dataPtBoxId ? `data-pt-box-id="${escapeAttr(dataPtBoxId)}"` : '',
    ]
        .filter(Boolean)
        .join(' ');
    return `<g${attrs ? ' ' + attrs : ''}>${children}</g>`;
}
