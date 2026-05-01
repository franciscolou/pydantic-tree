import * as vscode from 'vscode';
import type { ClassNode, MethodParam, MethodDef, AttrDef } from './types';

/* =========================================================
   REGEX (used only on individual declaration lines)
   ========================================================= */

const CLASS_BASES_REGEX = /class\s+\w+\s*\(([^)]+)\)/;

const METHOD_DECL_REGEX =
    /^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?\s*:/;

const ATTR_DECL_REGEX =
    /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^=\n]+?)(?:\s*=.*)?$/;

/* =========================================================
   DOCUMENT SYMBOLS
   ========================================================= */

async function getDocumentSymbols(
    uri: vscode.Uri
): Promise<vscode.DocumentSymbol[] | undefined> {
    return vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        uri
    );
}

/* =========================================================
   MEMBER EXTRACTION
   ========================================================= */

function extractMethod(
    sym: vscode.DocumentSymbol,
    document: vscode.TextDocument
): MethodDef {
    let declText = '';
    for (
        let l = sym.range.start.line;
        l <= Math.min(sym.range.start.line + 3, document.lineCount - 1);
        l++
    ) {
        const t = document.lineAt(l).text;
        if (METHOD_DECL_REGEX.test(t)) {
            declText = t;
            break;
        }
    }

    const match = declText.match(METHOD_DECL_REGEX);
    return {
        name: sym.name,
        params: match ? parseParams(match[2]) : [],
        returnType: match?.[3]?.trim() || undefined,
        definedAtLine: sym.range.start.line,
    };
}

function extractAttribute(
    sym: vscode.DocumentSymbol,
    document: vscode.TextDocument
): AttrDef {
    const lineText = document.lineAt(sym.range.start.line).text;
    const match = lineText.match(ATTR_DECL_REGEX);
    return {
        name: sym.name,
        type: match?.[2]?.trim() || undefined,
        definedAtLine: sym.range.start.line,
    };
}

function extractClassFromSymbol(
    sym: vscode.DocumentSymbol,
    document: vscode.TextDocument
): ClassNode {
    const declLineText = document.lineAt(sym.range.start.line).text;
    const bases = parseBases(declLineText);

    const methods: MethodDef[] = [];
    const attributes: AttrDef[] = [];

    for (const child of sym.children) {
        switch (child.kind) {
            case vscode.SymbolKind.Method:
            case vscode.SymbolKind.Function:
            case vscode.SymbolKind.Constructor:
                methods.push(extractMethod(child, document));
                break;
            case vscode.SymbolKind.Variable:
            case vscode.SymbolKind.Property:
            case vscode.SymbolKind.Field:
                attributes.push(extractAttribute(child, document));
                break;
        }
    }

    return {
        name: sym.name,
        bases,
        attributes,
        methods,
        definedAtLine: sym.range.start.line,
        fileUri: document.uri.toString(),
    };
}

/* =========================================================
   CACHE
   ========================================================= */

const symbolCache = new Map<
    string,
    { version: number; classes: Map<string, ClassNode> }
>();

/* =========================================================
   ENTRY POINTS
   ========================================================= */

export async function extractClasses(
    document: vscode.TextDocument
): Promise<Map<string, ClassNode>> {
    const key = document.uri.toString();
    const cached = symbolCache.get(key);
    if (cached?.version === document.version) return cached.classes;

    const symbols = await getDocumentSymbols(document.uri);
    if (!symbols) return new Map();

    const classes = new Map<string, ClassNode>();
    for (const sym of symbols) {
        if (sym.kind !== vscode.SymbolKind.Class) continue;
        const node = extractClassFromSymbol(sym, document);
        classes.set(node.name, node);
    }

    symbolCache.set(key, { version: document.version, classes });
    return classes;
}

/**
 * Builds a class map that includes the focus class, all its ancestors and
 * all descendants present in the current document — following base class
 * definitions across files when needed.
 */
export async function buildInheritanceMap(
    focusClass: string,
    document: vscode.TextDocument
): Promise<Map<string, ClassNode>> {
    const classes = await extractClasses(document);

    const queue: Array<{ name: string; doc: vscode.TextDocument }> = [
        { name: focusClass, doc: document },
    ];
    const visited = new Set<string>([focusClass]);

    while (queue.length > 0) {
        const { name, doc } = queue.shift()!;
        const node = classes.get(name);
        if (!node) continue;

        const symbols = await getDocumentSymbols(doc.uri);
        const classSym = symbols?.find(
            s => s.kind === vscode.SymbolKind.Class && s.name === name
        );
        if (!classSym) continue;

        for (const base of node.bases) {
            if (visited.has(base)) continue;
            visited.add(base);

            if (classes.has(base)) {
                queue.push({ name: base, doc });
                continue;
            }

            const resolved = await resolveBaseClass(base, doc, classSym);
            if (!resolved) continue;

            classes.set(resolved.node.name, resolved.node);
            queue.push({ name: resolved.node.name, doc: resolved.doc });
        }
    }

    return classes;
}

/* =========================================================
   CROSS-FILE RESOLUTION
   ========================================================= */

async function resolveBaseClass(
    baseName: string,
    fromDoc: vscode.TextDocument,
    classSymbol: vscode.DocumentSymbol
): Promise<{ doc: vscode.TextDocument; node: ClassNode } | null> {
    const lineText = fromDoc.lineAt(classSymbol.range.start.line).text;

    const parenIdx = lineText.indexOf('(');
    if (parenIdx < 0) return null;

    const baseIdx = lineText.indexOf(baseName, parenIdx);
    if (baseIdx < 0) return null;

    const position = new vscode.Position(
        classSymbol.range.start.line,
        baseIdx
    );

    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeDefinitionProvider',
        fromDoc.uri,
        position
    );

    if (!locations?.length) return null;

    const loc = locations[0];
    const targetDoc = await vscode.workspace.openTextDocument(loc.uri);
    const targetSymbols = await getDocumentSymbols(loc.uri);
    if (!targetSymbols) return null;

    const targetSym = targetSymbols.find(
        s => s.kind === vscode.SymbolKind.Class && s.name === baseName
    );
    if (!targetSym) return null;

    return {
        doc: targetDoc,
        node: extractClassFromSymbol(targetSym, targetDoc),
    };
}

/* =========================================================
   HELPERS
   ========================================================= */

function parseBases(lineText: string): string[] {
    const match = lineText.match(CLASS_BASES_REGEX);
    if (!match?.[1]?.trim()) return [];
    return match[1]
        .split(',')
        .map(b => b.trim())
        .filter(Boolean);
}

function splitParams(raw: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (const ch of raw) {
        if (ch === '(' || ch === '[' || ch === '{') { depth++; current += ch; }
        else if (ch === ')' || ch === ']' || ch === '}') { depth--; current += ch; }
        else if (ch === ',' && depth === 0) { parts.push(current); current = ''; }
        else { current += ch; }
    }
    if (current) parts.push(current);
    return parts;
}

function parseParams(raw: string): MethodParam[] {
    if (!raw.trim()) return [];

    return splitParams(raw)
        .map(p => p.trim())
        .filter(p => p && p !== 'self' && p !== 'cls' && !p.startsWith('*'))
        .map(p => {
            const [nameAndType, defaultValue] = p.split('=');
            const [name, type] = nameAndType.split(':').map(s => s.trim());
            return {
                name: name?.replace(/^\*+/, ''),
                type: type || undefined,
                defaultValue: defaultValue?.trim(),
            };
        });
}
