import type { ClassNode, RenderedBox } from '../types';
import { Theme, UI } from '../config';
import { ClassBox, Line, Text, TSpan, Group } from './components';

function navGroup(fileUri: string, line: number, content: string, role: 'class' | 'member' = 'member'): string {
    return `<g data-file="${fileUri}" data-line="${line}" data-pt-role="${role}" style="cursor:pointer">${content}</g>`;
}

/* =========================================================
   INHERITED NAMES
========================================================= */

export function collectInheritedNames(
    node: ClassNode,
    allNodes: Map<string, ClassNode>
): { attrs: Set<string>; methods: Set<string> } {
    const attrs = new Set<string>();
    const methods = new Set<string>();
    const visited = new Set<string>();
    const stack = [...node.bases];
    while (stack.length) {
        const name = stack.pop()!;
        if (visited.has(name)) continue;
        visited.add(name);
        const base = allNodes.get(name);
        if (!base) continue;
        for (const attr of base.attributes) attrs.add(attr.name);
        for (const method of base.methods) methods.add(method.name);
        stack.push(...base.bases);
    }
    return { attrs, methods };
}

/* =========================================================
   TYPE SPAN RENDERING
========================================================= */

function renderTypeSpans(typeStr: string): string {
    const tokens = typeStr.split(/((?:'[^']*')|(?:"[^"]*")|[\[\]])/);
    return tokens
        .map(token => {
            if (!token) return '';
            if (
                (token.startsWith("'") && token.endsWith("'")) ||
                (token.startsWith('"') && token.endsWith('"'))
            ) {
                return TSpan({ fill: Theme.colors.string, children: token });
            }
            if (token === '[' || token === ']') {
                return TSpan({ fill: Theme.colors.text, children: token });
            }
            return TSpan({ fill: Theme.colors.type, children: token });
        })
        .join('');
}

/* =========================================================
   PYTHON VALUE TOKENIZER
========================================================= */

const NUMBER_COLOR = '#b5cea8';
const BOOL_COLOR   = '#569cd6';
const BOOL_KEYWORDS = new Set(['True', 'False', 'None']);
const PY_KEYWORDS   = new Set(['and', 'or', 'not', 'in', 'is', 'lambda', 'if', 'else', 'for']);

function escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderPythonValue(expr: string): string {
    type Tok = { text: string; color: string };
    const toks: Tok[] = [];
    let i = 0;

    while (i < expr.length) {
        // String prefix + literal
        const strPfx = expr.slice(i).match(/^[fFbBrRuU]{0,2}(?:'{3}|"{3}|'|")/);
        if (strPfx) {
            const raw = strPfx[0];
            const q = raw.endsWith("'''") ? "'''" : raw.endsWith('"""') ? '"""' : raw.slice(-1);
            let j = i + raw.length;
            while (j < expr.length) {
                if (expr.startsWith(q, j)) { j += q.length; break; }
                if (expr[j] === '\\') j++;
                j++;
            }
            toks.push({ text: escapeXml(expr.slice(i, j)), color: Theme.colors.string });
            i = j;
            continue;
        }

        // Number
        if (/[0-9]/.test(expr[i]) || (expr[i] === '.' && /[0-9]/.test(expr[i + 1] ?? ''))) {
            if (expr[i] === '0' && /[xXbBoO]/.test(expr[i + 1] ?? '')) {
                let j = i + 2;
                while (j < expr.length && /[0-9a-fA-F_]/.test(expr[j])) j++;
                toks.push({ text: expr.slice(i, j), color: NUMBER_COLOR });
                i = j;
            } else {
                let p = i;
                while (p < expr.length && /[0-9_]/.test(expr[p])) p++;
                if (p > i) toks.push({ text: expr.slice(i, p), color: NUMBER_COLOR });
                i = p;
                if (i < expr.length && expr[i] === '.') {
                    toks.push({ text: '.', color: Theme.colors.text });
                    i++;
                    p = i;
                    while (p < expr.length && /[0-9_]/.test(expr[p])) p++;
                    if (p > i) toks.push({ text: expr.slice(i, p), color: NUMBER_COLOR });
                    i = p;
                }
                if (i < expr.length && /[eE]/.test(expr[i])) {
                    p = i + 1;
                    if (p < expr.length && /[+\-]/.test(expr[p])) p++;
                    while (p < expr.length && /[0-9_]/.test(expr[p])) p++;
                    toks.push({ text: expr.slice(i, p), color: NUMBER_COLOR });
                    i = p;
                }
                if (i < expr.length && /[jJ]/.test(expr[i])) {
                    toks.push({ text: expr[i], color: Theme.colors.text });
                    i++;
                }
            }
            continue;
        }

        // Identifier / keyword
        if (/[a-zA-Z_]/.test(expr[i])) {
            let j = i;
            while (j < expr.length && /[a-zA-Z0-9_]/.test(expr[j])) j++;
            const word = expr.slice(i, j);
            const color = BOOL_KEYWORDS.has(word)
                ? BOOL_COLOR
                : PY_KEYWORDS.has(word)
                    ? Theme.colors.attribute
                    : /[(\[]/.test(expr[j] ?? '')
                        ? Theme.colors.method
                        : Theme.colors.text;
            toks.push({ text: word, color });
            i = j;
            continue;
        }

        toks.push({ text: escapeXml(expr[i]), color: Theme.colors.text });
        i++;
    }

    // Merge adjacent same-color tokens
    const merged: Tok[] = [];
    for (const tok of toks) {
        if (merged.length && merged[merged.length - 1].color === tok.color)
            merged[merged.length - 1].text += tok.text;
        else merged.push({ ...tok });
    }
    return merged.map(tok => TSpan({ fill: tok.color, children: tok.text })).join('');
}

/* =========================================================
   METHOD LAYOUT
========================================================= */

export interface MethodLayout {
    wrapped: boolean;
    measureLines: string[];
}

export function computeMethodLayouts(node: ClassNode, wrapAt: number): MethodLayout[] {
    const indentStr = '    ';
    return node.methods.map(method => {
        const singleLine =
            `${method.name}(${method.params.map(param => `${param.name}${param.type ? `: ${param.type}` : ''}`).join(', ')})` +
            `${method.returnType ? ` -> ${method.returnType}` : ''}`;
        if (singleLine.length <= wrapAt) return { wrapped: false, measureLines: [singleLine] };
        return {
            wrapped: true,
            measureLines: [
                `${method.name}(`,
                ...method.params.map(param => `${indentStr}${param.name}${param.type ? `: ${param.type}` : ''},`),
                `) -> ${method.returnType ?? ''}`,
            ],
        };
    });
}

/* =========================================================
   BOX SIZING
========================================================= */

export function computeBoxWidth(node: ClassNode, layouts: MethodLayout[]): number {
    const { minWidth, maxWidth, charWidth, sidePadding } = UI.box;
    const attrTexts = node.attributes.flatMap(attr => {
        const base = `${attr.name}: ${attr.type ?? '?'}`;
        if (!attr.defaultValue) return [base];
        const [first, ...rest] = attr.defaultValue.split('\n');
        return [`${base} = ${first}`, ...rest];
    });
    const methodTexts = layouts.flatMap(layout => layout.measureLines);
    const longestLineLength = Math.max(
        node.name.length,
        ...attrTexts.map(t => t.length),
        ...methodTexts.map(t => t.length),
        10
    );
    return Math.min(maxWidth, Math.max(minWidth, longestLineLength * charWidth + sidePadding));
}

export function measureClassBox(
    node: ClassNode,
    inherited: { attrs: Set<string>; methods: Set<string> }
): { width: number; height: number } {
    const { headerHeight, padding, lineHeight, sectionGap, sectionTopPadding, maxWidth, sidePadding, charWidth } = UI.box;
    const wrapAt = Math.floor((maxWidth - sidePadding) / charWidth);
    const layouts = computeMethodLayouts(node, wrapAt);
    const width = computeBoxWidth(node, layouts);
    const attrLineCount = node.attributes.reduce((sum, attr) =>
        sum + (attr.defaultValue ? attr.defaultValue.split('\n').length : 1), 0);
    let y = headerHeight + sectionTopPadding + attrLineCount * lineHeight;
    if (node.attributes.length && node.methods.length) y += sectionGap / 2 + sectionTopPadding;
    const methodLineCount = layouts.reduce((sum, layout) => sum + layout.measureLines.length, 0);
    return { width, height: y + methodLineCount * lineHeight + padding };
}

/* =========================================================
   CONTENT RENDERING
========================================================= */

function renderAttributes(
    node: ClassNode,
    startY: number,
    inherited: { attrs: Set<string> }
): { svg: string; endY: number } {
    const { lineHeight, charWidth } = UI.box;
    let y = startY;
    const svg = node.attributes
        .map(attr => {
            const [firstDefault, ...contLines] = attr.defaultValue ? attr.defaultValue.split('\n') : [];

            const firstText = Text({
                x: 16,
                y,
                fontSize: Theme.font.size.normal,
                children:
                    TSpan({
                        fill: inherited.attrs.has(attr.name) ? Theme.colors.override : Theme.colors.attribute,
                        children: attr.name,
                    }) +
                    TSpan({ fill: Theme.colors.text, children: ': ' }) +
                    renderTypeSpans(attr.type ?? '?') +
                    (firstDefault !== undefined
                        ? TSpan({ fill: Theme.colors.text, children: ' = ' }) +
                          renderPythonValue(firstDefault)
                        : ''),
            });
            y += lineHeight;

            const contSvg = contLines.map(line => {
                const leadingSpaces = line.match(/^ */)?.[0].length ?? 0;
                const text = Text({
                    x: 16 + leadingSpaces * charWidth,
                    y,
                    fontSize: Theme.font.size.normal,
                    children: renderPythonValue(line.trimStart()),
                });
                y += lineHeight;
                return text;
            }).join('');

            return navGroup(node.fileUri, attr.definedAtLine, firstText + contSvg);
        })
        .join('');
    return { svg, endY: y };
}

function renderDivider(y: number, boxWidth: number): { svg: string; endY: number } {
    const dividerY = y + UI.box.sectionGap / 2;
    return {
        svg: Line({ x1: 12, y1: dividerY, x2: boxWidth - 12, y2: dividerY, stroke: Theme.colors.border }),
        endY: dividerY + UI.box.sectionTopPadding,
    };
}

function renderMethodRows(
    node: ClassNode,
    layouts: MethodLayout[],
    startY: number,
    inherited: { methods: Set<string> }
): { svg: string; endY: number } {
    const { lineHeight } = UI.box;
    const indentPx = 4 * UI.box.charWidth;
    let y = startY;

    const svg = node.methods
        .map((method, i) => {
            const methodColor = inherited.methods.has(method.name)
                ? Theme.colors.override
                : Theme.colors.method;
            const layout = layouts[i];

            if (!layout.wrapped) {
                const paramsSvg = method.params
                    .map(param =>
                        TSpan({ fill: Theme.colors.attribute, children: param.name }) +
                        (param.type
                            ? TSpan({ fill: Theme.colors.text, children: ': ' }) + renderTypeSpans(param.type)
                            : '')
                    )
                    .join(TSpan({ fill: Theme.colors.text, children: ', ' }));

                const returnSvg = method.returnType
                    ? TSpan({ fill: Theme.colors.text, children: ' → ' }) + renderTypeSpans(method.returnType)
                    : '';

                const text = Text({
                    x: 16, y, fontSize: Theme.font.size.normal,
                    children:
                        TSpan({ fill: methodColor, children: method.name }) +
                        TSpan({ fill: Theme.colors.text, children: '(' }) +
                        paramsSvg +
                        TSpan({ fill: Theme.colors.text, children: ')' }) +
                        returnSvg,
                });
                y += lineHeight;
                return navGroup(node.fileUri, method.definedAtLine, text);
            }

            const lines: string[] = [];
            lines.push(Text({
                x: 16, y, fontSize: Theme.font.size.normal,
                children:
                    TSpan({ fill: methodColor, children: method.name }) +
                    TSpan({ fill: Theme.colors.text, children: '(' }),
            }));
            y += lineHeight;

            for (const param of method.params) {
                lines.push(Text({
                    x: 16 + indentPx, y, fontSize: Theme.font.size.normal,
                    children:
                        TSpan({ fill: Theme.colors.attribute, children: param.name }) +
                        (param.type
                            ? TSpan({ fill: Theme.colors.text, children: ': ' }) + renderTypeSpans(param.type)
                            : '') +
                        TSpan({ fill: Theme.colors.text, children: ',' }),
                }));
                y += lineHeight;
            }

            lines.push(Text({
                x: 16, y, fontSize: Theme.font.size.normal,
                children:
                    TSpan({ fill: Theme.colors.text, children: ')' }) +
                    (method.returnType
                        ? TSpan({ fill: Theme.colors.text, children: ' → ' }) + renderTypeSpans(method.returnType)
                        : ''),
            }));
            y += lineHeight;

            return navGroup(node.fileUri, method.definedAtLine, lines.join(''));
        })
        .join('');

    return { svg, endY: y };
}

/* =========================================================
   BOX ASSEMBLY
========================================================= */

export function renderClassBox(
    node: ClassNode,
    x: number,
    y: number,
    inherited: { attrs: Set<string>; methods: Set<string> }
): RenderedBox {
    const { headerHeight, padding, sectionTopPadding, maxWidth, sidePadding, charWidth, borderRadius } = UI.box;
    const wrapAt = Math.floor((maxWidth - sidePadding) / charWidth);

    const layouts = computeMethodLayouts(node, wrapAt);
    const width = computeBoxWidth(node, layouts);

    const contentStartY = headerHeight + sectionTopPadding;
    const { svg: attrSvg, endY: afterAttrs } = renderAttributes(node, contentStartY, inherited);

    let methodStartY = afterAttrs;
    let dividerSvg = '';
    if (node.attributes.length && node.methods.length) {
        const divider = renderDivider(afterAttrs, width);
        dividerSvg = divider.svg;
        methodStartY = divider.endY;
    }

    const { svg: methodSvg, endY: afterMethods } = renderMethodRows(node, layouts, methodStartY, inherited);
    const height = afterMethods + padding;

    const panel = ClassBox({
        x: 0, y: 0, width, height, borderRadius,
        fill: Theme.colors.panelBackground,
        stroke: Theme.colors.border,
    });

    const header = ClassBox({
        x: 0, y: 0, width, height: headerHeight,
        fill: Theme.colors.headerBackground,
        stroke: 'none',
    });

    const title = navGroup(node.fileUri, node.definedAtLine, Text({
        x: width / 2,
        y: 22,
        textAnchor: 'middle',
        fontSize: Theme.font.size.header,
        fontWeight: Theme.font.weight.bold,
        fill: Theme.colors.headerText,
        children: node.name,
    }), 'class');

    const clipId = `clip-${node.name.replace(/\W/g, '_')}`;
    const clipDef =
        `<defs><clipPath id="${clipId}">` +
        `<rect x="0" y="${headerHeight}" width="${width}" height="${height - headerHeight}"/>` +
        `</clipPath></defs>`;
    const clippedContent = `<g clip-path="url(#${clipId})">${attrSvg}${dividerSvg}${methodSvg}</g>`;

    const group = Group({
        transform: `translate(${x - width / 2}, ${y})`,
        children: clipDef + panel + header + title + clippedContent,
    });

    return { svg: group, width, height };
}
