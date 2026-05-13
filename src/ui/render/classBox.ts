import type { ClassNode, RenderedBox, MethodDef } from '../../types';
import { Theme, UI, Messages } from '../../config';
import {
    ClassBox,
    Line,
    Text,
    TSpan,
    NavGroup,
    ClipPath,
    Group,
} from '../components';

export function collectInheritedNames(
    node: ClassNode,
    allNodes: Map<string, ClassNode>
): { attrs: Set<string>; methods: Set<string> } {
    const attrs = new Set<string>();
    const methods = new Set<string>();
    const visited = new Set<string>();
    const stack: string[] = node.bases
        .map(b => b.id)
        .filter((id): id is string => id !== undefined);
    while (stack.length) {
        const id = stack.pop()!;
        if (visited.has(id)) {
            continue;
        }
        visited.add(id);
        const base = allNodes.get(id);
        if (!base) {
            continue;
        }
        for (const attr of base.attributes) {
            attrs.add(attr.name);
        }
        for (const method of base.methods) {
            methods.add(method.name);
        }
        for (const b of base.bases) {
            if (b.id) {
                stack.push(b.id);
            }
        }
    }
    return { attrs, methods };
}

function renderTypeSpans(typeStr: string): string {
    const tokens = typeStr.split(/((?:'[^']*')|(?:"[^"]*")|[\[\]])/);
    return tokens
        .map(token => {
            if (!token) {
                return '';
            }
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

const BOOL_KEYWORDS = new Set(['True', 'False', 'None']);
const PY_KEYWORDS = new Set([
    'and',
    'or',
    'not',
    'in',
    'is',
    'lambda',
    'if',
    'else',
    'for',
]);

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
            const q = raw.endsWith("'''")
                ? "'''"
                : raw.endsWith('"""')
                  ? '"""'
                  : raw.slice(-1);
            let j = i + raw.length;
            while (j < expr.length) {
                if (expr.startsWith(q, j)) {
                    j += q.length;
                    break;
                }
                if (expr[j] === '\\') {
                    j++;
                }
                j++;
            }
            toks.push({
                text: escapeXml(expr.slice(i, j)),
                color: Theme.colors.string,
            });
            i = j;
            continue;
        }

        // Number
        if (
            /[0-9]/.test(expr[i]) ||
            (expr[i] === '.' && /[0-9]/.test(expr[i + 1] ?? ''))
        ) {
            if (expr[i] === '0' && /[xXbBoO]/.test(expr[i + 1] ?? '')) {
                let j = i + 2;
                while (j < expr.length && /[0-9a-fA-F_]/.test(expr[j])) {
                    j++;
                }
                toks.push({
                    text: expr.slice(i, j),
                    color: Theme.colors.number,
                });
                i = j;
            } else {
                let p = i;
                while (p < expr.length && /[0-9_]/.test(expr[p])) {
                    p++;
                }
                if (p > i) {
                    toks.push({
                        text: expr.slice(i, p),
                        color: Theme.colors.number,
                    });
                }
                i = p;
                if (i < expr.length && expr[i] === '.') {
                    toks.push({ text: '.', color: Theme.colors.text });
                    i++;
                    p = i;
                    while (p < expr.length && /[0-9_]/.test(expr[p])) {
                        p++;
                    }
                    if (p > i) {
                        toks.push({
                            text: expr.slice(i, p),
                            color: Theme.colors.number,
                        });
                    }
                    i = p;
                }
                if (i < expr.length && /[eE]/.test(expr[i])) {
                    p = i + 1;
                    if (p < expr.length && /[+\-]/.test(expr[p])) {
                        p++;
                    }
                    while (p < expr.length && /[0-9_]/.test(expr[p])) {
                        p++;
                    }
                    toks.push({
                        text: expr.slice(i, p),
                        color: Theme.colors.number,
                    });
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
            while (j < expr.length && /[a-zA-Z0-9_]/.test(expr[j])) {
                j++;
            }
            const word = expr.slice(i, j);
            const color = BOOL_KEYWORDS.has(word)
                ? Theme.colors.bool
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
        if (merged.length && merged[merged.length - 1].color === tok.color) {
            merged[merged.length - 1].text += tok.text;
        } else {
            merged.push({ ...tok });
        }
    }
    return merged
        .map(tok => TSpan({ fill: tok.color, children: tok.text }))
        .join('');
}

export interface MethodLayout {
    wrapped: boolean;
    measureLines: string[];
}

export function computeMethodLayouts(
    methods: MethodDef[],
    wrapAt: number
): MethodLayout[] {
    const indentStr = '    ';
    return methods.map(method => {
        const prefix = method.isAbstract
            ? `${Messages.ui.abstractIndicator} `
            : '';
        const singleLine =
            prefix +
            `${method.name}(${method.params.map(param => `${param.name}${param.type ? `: ${param.type}` : ''}`).join(', ')})` +
            `${method.returnType ? ` -> ${method.returnType}` : ''}`;
        if (singleLine.length <= wrapAt) {
            return { wrapped: false, measureLines: [singleLine] };
        }
        return {
            wrapped: true,
            measureLines: [
                `${prefix}${method.name}(`,
                ...method.params.map(
                    param =>
                        `${indentStr}${param.name}${param.type ? `: ${param.type}` : ''},`
                ),
                `) -> ${method.returnType ?? ''}`,
            ],
        };
    });
}

function computeFilePathLines(fileUri: string, boxWidth: number): string[] {
    const { sidePadding, filePathCharWidth } = UI.box;
    const maxChars = Math.floor((boxWidth - sidePadding) / filePathCharWidth);
    const path = decodeURIComponent(fileUri.replace(/^file:\/\//, ''));
    if (path.length <= maxChars) {
        return [path];
    }
    const lines: string[] = [];
    let remaining = path;
    while (remaining.length > maxChars) {
        let breakAt = remaining.lastIndexOf('/', maxChars);
        if (breakAt <= 0) {
            breakAt = maxChars;
        } else {
            breakAt++;
        }
        lines.push(remaining.slice(0, breakAt));
        remaining = remaining.slice(breakAt);
    }
    if (remaining) {
        lines.push(remaining);
    }
    return lines.slice(0, 3);
}

function filePathSectionHeight(lines: string[]): number {
    return (
        UI.box.filePathPadding * 2 + lines.length * UI.box.filePathLineHeight
    );
}

export function computeBoxWidth(
    node: ClassNode,
    layouts: MethodLayout[]
): number {
    const { minWidth, maxWidth, charWidth, sidePadding } = UI.box;
    const attrTexts = node.attributes.flatMap(attr => {
        const base = `${attr.name}: ${attr.type ?? '?'}`;
        if (!attr.defaultValue) {
            return [base];
        }
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
    return Math.min(
        maxWidth,
        Math.max(minWidth, longestLineLength * charWidth + sidePadding)
    );
}

export function measureClassBox(
    node: ClassNode,
    _inherited: { attrs: Set<string>; methods: Set<string> }
): { width: number; height: number } {
    const {
        headerHeight,
        padding,
        lineHeight,
        sectionGap,
        sectionTopPadding,
        maxWidth,
        sidePadding,
        charWidth,
    } = UI.box;
    const wrapAt = Math.floor((maxWidth - sidePadding) / charWidth);

    const classMethods = node.methods.filter(m => m.isClassMethod);
    const staticMethods = node.methods.filter(m => m.isStaticMethod);
    const regularMethods = node.methods.filter(
        m => !m.isClassMethod && !m.isStaticMethod
    );

    const classLayouts = computeMethodLayouts(classMethods, wrapAt);
    const staticLayouts = computeMethodLayouts(staticMethods, wrapAt);
    const regularLayouts = computeMethodLayouts(regularMethods, wrapAt);
    const allLayouts = [...classLayouts, ...staticLayouts, ...regularLayouts];

    const width = computeBoxWidth(node, allLayouts);

    const countLines = (layouts: MethodLayout[]) =>
        layouts.reduce((sum, l) => sum + l.measureLines.length, 0);

    const attrLineCount = node.attributes.reduce(
        (sum, attr) =>
            sum +
            (attr.defaultValue ? attr.defaultValue.split('\n').length : 1),
        0
    );

    let y = headerHeight + sectionTopPadding;

    if (node.attributes.length) {
        y += lineHeight; // "Attributes" label
        y += attrLineCount * lineHeight;
    }

    const hasAnyMethod =
        classMethods.length || staticMethods.length || regularMethods.length;
    if (hasAnyMethod) {
        if (node.attributes.length) {
            y += sectionGap / 2 + sectionTopPadding;
        }
        if (classMethods.length) {
            y += lineHeight; // "Class Methods" label
            y += countLines(classLayouts) * lineHeight;
        }
        if (staticMethods.length) {
            if (classMethods.length) { y += sectionGap; }
            y += lineHeight; // "Static Methods" label
            y += countLines(staticLayouts) * lineHeight;
        }
        if (regularMethods.length) {
            if (classMethods.length || staticMethods.length) { y += sectionGap; }
            y += lineHeight; // "Methods" label
            y += countLines(regularLayouts) * lineHeight;
        }
    }

    return { width, height: y + padding };
}

function renderSectionLabel(
    label: string,
    y: number
): { svg: string; endY: number } {
    return {
        svg: Text({
            x: 16,
            y,
            fontSize: Theme.font.size.normal,
            children: TSpan({
                fill: Theme.colors.sectionLabel,
                fontStyle: 'italic',
                children: label,
            }),
        }),
        endY: y + UI.box.lineHeight,
    };
}

function renderAttributes(
    node: ClassNode,
    startY: number,
    baseX: number,
    inherited: { attrs: Set<string> }
): { svg: string; endY: number } {
    const { lineHeight, charWidth } = UI.box;
    let y = startY;
    const svg = node.attributes
        .map(attr => {
            const [firstDefault, ...contLines] = attr.defaultValue
                ? attr.defaultValue.split('\n')
                : [];

            const firstText = Text({
                x: baseX,
                y,
                fontSize: Theme.font.size.normal,
                children:
                    TSpan({
                        fill: inherited.attrs.has(attr.name)
                            ? Theme.colors.override
                            : Theme.colors.attribute,
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

            const contSvg = contLines
                .map(line => {
                    const leadingSpaces = line.match(/^ */)?.[0].length ?? 0;
                    const text = Text({
                        x: baseX + leadingSpaces * charWidth,
                        y,
                        fontSize: Theme.font.size.normal,
                        children: renderPythonValue(line.trimStart()),
                    });
                    y += lineHeight;
                    return text;
                })
                .join('');

            return NavGroup({
                fileUri: node.fileUri,
                line: attr.definedAtLine,
                role: 'member',
                children: firstText + contSvg,
            });
        })
        .join('');
    return { svg, endY: y };
}

function renderDivider(
    y: number,
    boxWidth: number
): { svg: string; endY: number } {
    const dividerY = y + UI.box.sectionGap / 2;
    return {
        svg: Line({
            x1: 12,
            y1: dividerY,
            x2: boxWidth - 12,
            y2: dividerY,
            stroke: Theme.colors.border,
        }),
        endY: dividerY + UI.box.sectionTopPadding,
    };
}

function renderMethodRows(
    node: ClassNode,
    methods: MethodDef[],
    layouts: MethodLayout[],
    startY: number,
    baseX: number,
    inherited: { methods: Set<string> }
): { svg: string; endY: number } {
    const { lineHeight } = UI.box;
    const indentPx = 4 * UI.box.charWidth;
    let y = startY;

    const svg = methods
        .map((method, i) => {
            const methodColor = inherited.methods.has(method.name)
                ? Theme.colors.override
                : Theme.colors.method;
            const layout = layouts[i];

            const abstractPrefixSvg = method.isAbstract
                ? TSpan({
                      fill: '#ffffff',
                      fontStyle: 'italic',
                      fontWeight: 'bold',
                      children: `${Messages.ui.abstractIndicator} `,
                  })
                : '';

            if (!layout.wrapped) {
                const paramsSvg = method.params
                    .map(
                        param =>
                            TSpan({
                                fill: Theme.colors.attribute,
                                children: param.name,
                            }) +
                            (param.type
                                ? TSpan({
                                      fill: Theme.colors.text,
                                      children: ': ',
                                  }) + renderTypeSpans(param.type)
                                : '')
                    )
                    .join(TSpan({ fill: Theme.colors.text, children: ', ' }));

                const returnSvg = method.returnType
                    ? TSpan({ fill: Theme.colors.text, children: ' → ' }) +
                      renderTypeSpans(method.returnType)
                    : '';

                const text = Text({
                    x: baseX,
                    y,
                    fontSize: Theme.font.size.normal,
                    children:
                        abstractPrefixSvg +
                        TSpan({ fill: methodColor, children: method.name }) +
                        TSpan({ fill: Theme.colors.text, children: '(' }) +
                        paramsSvg +
                        TSpan({ fill: Theme.colors.text, children: ')' }) +
                        returnSvg,
                });
                y += lineHeight;
                return NavGroup({
                    fileUri: node.fileUri,
                    line: method.definedAtLine,
                    role: 'member',
                    children: text,
                });
            }

            const lines: string[] = [];
            lines.push(
                Text({
                    x: baseX,
                    y,
                    fontSize: Theme.font.size.normal,
                    children:
                        abstractPrefixSvg +
                        TSpan({ fill: methodColor, children: method.name }) +
                        TSpan({ fill: Theme.colors.text, children: '(' }),
                })
            );
            y += lineHeight;

            for (const param of method.params) {
                lines.push(
                    Text({
                        x: baseX + indentPx,
                        y,
                        fontSize: Theme.font.size.normal,
                        children:
                            TSpan({
                                fill: Theme.colors.attribute,
                                children: param.name,
                            }) +
                            (param.type
                                ? TSpan({
                                      fill: Theme.colors.text,
                                      children: ': ',
                                  }) + renderTypeSpans(param.type)
                                : '') +
                            TSpan({ fill: Theme.colors.text, children: ',' }),
                    })
                );
                y += lineHeight;
            }

            lines.push(
                Text({
                    x: baseX,
                    y,
                    fontSize: Theme.font.size.normal,
                    children:
                        TSpan({ fill: Theme.colors.text, children: ')' }) +
                        (method.returnType
                            ? TSpan({
                                  fill: Theme.colors.text,
                                  children: ' → ',
                              }) + renderTypeSpans(method.returnType)
                            : ''),
                })
            );
            y += lineHeight;

            return NavGroup({
                fileUri: node.fileUri,
                line: method.definedAtLine,
                role: 'member',
                children: lines.join(''),
            });
        })
        .join('');

    return { svg, endY: y };
}

export function renderClassBox(
    node: ClassNode,
    x: number,
    y: number,
    inherited: { attrs: Set<string>; methods: Set<string> }
): RenderedBox {
    const {
        headerHeight,
        padding,
        sectionGap,
        sectionTopPadding,
        maxWidth,
        sidePadding,
        charWidth,
        borderRadius,
    } = UI.box;
    const wrapAt = Math.floor((maxWidth - sidePadding) / charWidth);
    const contentIndent = 24;

    const classMethods = node.methods.filter(m => m.isClassMethod);
    const staticMethods = node.methods.filter(m => m.isStaticMethod);
    const regularMethods = node.methods.filter(
        m => !m.isClassMethod && !m.isStaticMethod
    );

    const classLayouts = computeMethodLayouts(classMethods, wrapAt);
    const staticLayouts = computeMethodLayouts(staticMethods, wrapAt);
    const regularLayouts = computeMethodLayouts(regularMethods, wrapAt);
    const allLayouts = [...classLayouts, ...staticLayouts, ...regularLayouts];

    const width = computeBoxWidth(node, allLayouts);

    const fpLines = computeFilePathLines(node.fileUri, width);
    const fpHeight = filePathSectionHeight(fpLines);
    const { filePathFontSize, filePathLineHeight, filePathPadding } = UI.box;

    const parts: string[] = [];
    let curY = headerHeight + sectionTopPadding;

    if (node.attributes.length) {
        const lbl = renderSectionLabel(Messages.ui.sections.attributes, curY);
        parts.push(lbl.svg);
        curY = lbl.endY;
        const attrs = renderAttributes(node, curY, contentIndent, inherited);
        parts.push(attrs.svg);
        curY = attrs.endY;
    }

    const hasAnyMethod =
        classMethods.length || staticMethods.length || regularMethods.length;
    if (hasAnyMethod) {
        if (node.attributes.length) {
            const divider = renderDivider(curY, width);
            parts.push(divider.svg);
            curY = divider.endY;
        }
        if (classMethods.length) {
            const lbl = renderSectionLabel(
                Messages.ui.sections.classMethods,
                curY
            );
            parts.push(lbl.svg);
            curY = lbl.endY;
            const rows = renderMethodRows(
                node,
                classMethods,
                classLayouts,
                curY,
                contentIndent,
                inherited
            );
            parts.push(rows.svg);
            curY = rows.endY;
        }
        if (staticMethods.length) {
            if (classMethods.length) { curY += sectionGap; }
            const lbl = renderSectionLabel(
                Messages.ui.sections.staticMethods,
                curY
            );
            parts.push(lbl.svg);
            curY = lbl.endY;
            const rows = renderMethodRows(
                node,
                staticMethods,
                staticLayouts,
                curY,
                contentIndent,
                inherited
            );
            parts.push(rows.svg);
            curY = rows.endY;
        }
        if (regularMethods.length) {
            if (classMethods.length || staticMethods.length) { curY += sectionGap; }
            const lbl = renderSectionLabel(Messages.ui.sections.methods, curY);
            parts.push(lbl.svg);
            curY = lbl.endY;
            const rows = renderMethodRows(
                node,
                regularMethods,
                regularLayouts,
                curY,
                contentIndent,
                inherited
            );
            parts.push(rows.svg);
            curY = rows.endY;
        }
    }

    const height = curY + padding;

    const panel = ClassBox({
        x: 0,
        y: 0,
        width,
        height,
        borderRadius,
        fill: Theme.colors.panelBackground,
        stroke: Theme.colors.border,
    });

    // File path floats above the box (negative y) so it doesn't affect box layout.
    // It extends by borderRadius downward so the bottom rounded corners are hidden behind the panel.
    const filePathBg = ClassBox({
        x: 0,
        y: -fpHeight,
        width,
        height: fpHeight + borderRadius,
        borderRadius,
        fill: Theme.colors.filePathBackground,
        stroke: 'none',
    });
    const filePathTextSvg = fpLines
        .map((line, i) =>
            Text({
                x: 16,
                y:
                    -fpHeight +
                    filePathPadding +
                    (i + 1) * filePathLineHeight -
                    2,
                fontSize: filePathFontSize,
                fill: Theme.colors.filePathText,
                children: escapeXml(line),
            })
        )
        .join('');
    const filePathSection = Group({
        className: 'file-path-section',
        children: filePathBg + filePathTextSvg,
    });

    const header = ClassBox({
        x: 0,
        y: 0,
        width,
        height: headerHeight,
        fill: node.isAbstract
            ? Theme.colors.abstractHeaderBackground
            : Theme.colors.headerBackground,
        stroke: 'none',
    });

    const title = NavGroup({
        fileUri: node.fileUri,
        line: node.definedAtLine,
        role: 'class',
        children: Text({
            x: width / 2,
            y: 22,
            textAnchor: 'middle',
            fontSize: Theme.font.size.header,
            fontWeight: Theme.font.weight.bold,
            fill: Theme.colors.headerText,
            children: node.name,
        }),
    });

    const clipId = `clip-${node.id.replace(/\W/g, '_')}`;
    const clipDef = ClipPath({
        id: clipId,
        x: 0,
        y: headerHeight,
        width,
        height: height - headerHeight,
    });
    const clippedContent = Group({
        clipPath: `url(#${clipId})`,
        children: parts.join(''),
    });

    return {
        svg: Group({
            dataPtBox: true,
            dataPtBoxId: node.id,
            transform: `translate(${x - width / 2}, ${y})`,
            children:
                clipDef +
                panel +
                filePathSection +
                header +
                title +
                clippedContent,
        }),
        width,
        height,
    };
}
