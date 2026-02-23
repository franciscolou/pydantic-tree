export interface GroupProps {
    id?: string;
    transform?: string;
    children: string;
}

export function Group({ transform, children }: GroupProps): string {
    return `
<g
  id="viewport"
  ${transform ? `transform="${transform}"` : ''}
>
${children}
</g>
`;
}
