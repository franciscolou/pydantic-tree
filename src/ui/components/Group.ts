export interface GroupProps {
    id?: string;
    transform?: string;
    children: string;
}

export function Group({ id, transform, children }: GroupProps): string {
    return `
<g
  ${id ? `id="${id}"` : ''}
  ${transform ? `transform="${transform}"` : ''}
>
${children}
</g>
`;
}
