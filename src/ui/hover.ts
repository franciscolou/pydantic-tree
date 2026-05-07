import type { ClassNode } from '../types';
import { Messages } from '../config';

export function renderClassMarkdown(node: ClassNode): string {
    return `
### Classe \`${node.name}\`

**Bases:** ${formatBases(node)}

**Atributos:**
${formatAttributes(node)}

**Métodos:**
${formatMethods(node)}
`;
}

function formatBases(node: ClassNode): string {
    return node.bases.length ? node.bases.map(b => b.name).join(', ') : Messages.hover.noBases;
}

function formatAttributes(node: ClassNode): string {
    if (!node.attributes.length) return Messages.hover.noAttributes;
    return node.attributes.map(attr => {
        const base = `${attr.name}: ${attr.type ?? '?'}`;
        if (!attr.defaultValue) return `• \`${base}\``;
        const compact = attr.defaultValue.replace(/\n\s*/g, ' ');
        return `• \`${base} = ${compact}\``;
    }).join('\n\n');
}

function formatMethods(node: ClassNode): string {
    if (!node.methods.length) return Messages.hover.noMethods;
    return node.methods.map(method => {
        const params = method.params
            .map(param => {
                let s = param.name;
                if (param.type) s += `: ${param.type}`;
                if (param.defaultValue) s += ` = ${param.defaultValue}`;
                return s;
            })
            .join(', ');
        const ret = method.returnType ? ` → ${method.returnType}` : '';
        return `• \`${method.name}(${params})${ret}\``;
    }).join('\n\n');
}
