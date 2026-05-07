export interface NavGroupProps {
    fileUri: string;
    line: number;
    role: 'class' | 'member';
    children: string;
}

export function NavGroup({
    fileUri,
    line,
    role,
    children,
}: NavGroupProps): string {
    return `
<g
    data-file="${fileUri}"
    data-line="${line}"
    data-pt-role="${role}"
    style="cursor: pointer"
>
    ${children}
</g>`;
}
