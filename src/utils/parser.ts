import * as vscode from 'vscode';
import type {
    ClassNode,
    MethodParam,
    MethodDef,
    AttrDef,
    PropDef,
    BaseRef,
} from '../types';

/* =========================================================
   REGEX (used only on individual declaration lines)
   ========================================================= */

const ABSTRACT_CLASS_REGEX = /\bmetaclass\s*=\s*(?:abc\.)?ABCMeta\b/;
const ABSTRACT_BASE_REGEX = /\b(?:abc\.)?ABC\b/;
const ABSTRACT_METHOD_REGEX = /^\s*@(?:abc\.)?abstractmethod\b/;
const CLASS_METHOD_REGEX = /^\s*@classmethod\b/;
const STATIC_METHOD_REGEX = /^\s*@staticmethod\b/;
const PROPERTY_REGEX = /^\s*@property\b/;

// Handles PEP 695 type-parameter lists: class Foo[T, U: int](Base):
const CLASS_BASES_REGEX = /class\s+\w+(?:\[(?:[^\[\]]|\[[^\[\]]*\])*\])?\s*\(([^)]*)\)/;
const DEF_START_REGEX = /^\s*def\s+/;
const METHOD_DECL_REGEX =
    /^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?\s*:/;
const ATTR_DECL_REGEX =
    /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^=\n]+?)(?:\s*=\s*(.+))?$/;
const ENUM_MEMBER_REGEX =
    /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/;
const BARE_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_.]*/;

/* =========================================================
   IDENTIFIERS
   ========================================================= */

export function makeClassId(
    fileUri: string,
    name: string,
    line: number
): string {
    const wsUri = vscode.workspace.workspaceFolders?.[0]?.uri.toString();
    const prefix = wsUri ? wsUri + '/' : null;
    const key =
        prefix && fileUri.startsWith(prefix)
            ? fileUri.slice(prefix.length)
            : fileUri;
    return `${key}#${name}@${line}`;
}

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

function collectMethodDeclText(
    startLine: number,
    document: vscode.TextDocument
): string {
    const parts: string[] = [];
    let depth = 0;
    let foundOpen = false;
    const limit = Math.min(startLine + 30, document.lineCount - 1);
    for (let l = startLine; l <= limit; l++) {
        const text = document.lineAt(l).text;
        parts.push(text);
        depth += bracketDepth(text);
        if (!foundOpen && text.includes('(')) {
            foundOpen = true;
        }
        if (foundOpen && depth === 0) {
            break;
        }
    }
    return parts.join(' ');
}

function extractMethod(
    sym: vscode.DocumentSymbol,
    document: vscode.TextDocument
): MethodDef {
    let declText = '';
    let isAbstract = false;
    let isClassMethod = false;
    let isStaticMethod = false;
    const limit = Math.min(sym.range.start.line + 10, document.lineCount - 1);
    for (let l = sym.range.start.line; l <= limit; l++) {
        const t = document.lineAt(l).text;
        if (ABSTRACT_METHOD_REGEX.test(t)) { isAbstract = true; }
        if (CLASS_METHOD_REGEX.test(t)) { isClassMethod = true; }
        if (STATIC_METHOD_REGEX.test(t)) { isStaticMethod = true; }
        if (DEF_START_REGEX.test(t)) {
            declText = collectMethodDeclText(l, document);
            break;
        }
    }

    const match = declText.match(METHOD_DECL_REGEX);
    return {
        name: sym.name,
        params: match ? parseParams(match[2]) : [],
        returnType: match?.[3]?.trim() || undefined,
        definedAtLine: sym.range.start.line,
        isAbstract: isAbstract || undefined,
        isClassMethod: isClassMethod || undefined,
        isStaticMethod: isStaticMethod || undefined,
    };
}

function bracketDepth(text: string): number {
    let depth = 0;
    for (const ch of text) {
        if (ch === '(' || ch === '[' || ch === '{') {
            depth++;
        } else if (ch === ')' || ch === ']' || ch === '}') {
            depth--;
        }
    }
    return depth;
}

function extractAttribute(
    sym: vscode.DocumentSymbol,
    document: vscode.TextDocument
): AttrDef {
    const firstLine = document.lineAt(sym.range.start.line).text;
    const match = firstLine.match(ATTR_DECL_REGEX);

    const baseIndent = firstLine.match(/^ */)?.[0].length ?? 0;

    let defaultValue: string | undefined;
    if (match?.[3] !== undefined) {
        const parts = [match[3].trim()];
        let depth = bracketDepth(parts[0]);
        let l = sym.range.start.line + 1;
        while (
            depth > 0 &&
            l < document.lineCount &&
            l <= sym.range.start.line + 20
        ) {
            const rawLine = document.lineAt(l).text;
            parts.push(rawLine.slice(baseIndent).trimEnd());
            depth += bracketDepth(rawLine);
            l++;
        }
        defaultValue = parts.join('\n');
    }

    return {
        name: sym.name,
        type: match?.[2]?.trim() || undefined,
        defaultValue: defaultValue || undefined,
        definedAtLine: sym.range.start.line,
    };
}

function extractProperty(
    sym: vscode.DocumentSymbol,
    document: vscode.TextDocument
): PropDef | undefined {
    const limit = Math.min(sym.range.start.line + 10, document.lineCount - 1);
    for (let l = sym.range.start.line; l <= limit; l++) {
        const t = document.lineAt(l).text;
        if (DEF_START_REGEX.test(t)) {
            const declText = collectMethodDeclText(l, document);
            const match = declText.match(METHOD_DECL_REGEX);
            return {
                name: sym.name,
                returnType: match?.[3]?.trim() || undefined,
                definedAtLine: sym.range.start.line,
            };
        }
    }
    return undefined;
}

function collectClassDeclLines(
    sym: vscode.DocumentSymbol,
    document: vscode.TextDocument
): string[] {
    const lines: string[] = [];
    let depth = 0;
    let foundOpen = false;
    const limit = Math.min(sym.range.start.line + 30, document.lineCount - 1);
    for (let l = sym.range.start.line; l <= limit; l++) {
        const text = document.lineAt(l).text;
        lines.push(text);
        for (const ch of text) {
            if (ch === '(') {
                depth++;
                foundOpen = true;
            } else if (ch === ')') {
                depth--;
            }
        }
        if (!foundOpen || (foundOpen && depth === 0)) {
            break;
        }
    }
    return lines;
}

async function extractClassFromSymbol(
    sym: vscode.DocumentSymbol,
    document: vscode.TextDocument
): Promise<ClassNode> {
    const declLines = collectClassDeclLines(sym, document);
    const declLineText = declLines[0];
    const isAbstract =
        declLines.some(
            l => ABSTRACT_CLASS_REGEX.test(l) || ABSTRACT_BASE_REGEX.test(l)
        ) || undefined;
    const bases = await resolveBases(declLineText, document, sym);

    const methods: MethodDef[] = [];
    const attributes: AttrDef[] = [];
    const properties: PropDef[] = [];

    for (const child of sym.children) {
        switch (child.kind) {
            case vscode.SymbolKind.Method:
            case vscode.SymbolKind.Function:
            case vscode.SymbolKind.Constructor: {
                let isProperty = false;
                const scanLimit = Math.min(
                    child.range.start.line + 10,
                    document.lineCount - 1
                );
                for (let l = child.range.start.line; l <= scanLimit; l++) {
                    const t = document.lineAt(l).text;
                    if (PROPERTY_REGEX.test(t)) { isProperty = true; break; }
                    if (DEF_START_REGEX.test(t)) { break; }
                }
                if (isProperty) {
                    const prop = extractProperty(child, document);
                    if (prop) { properties.push(prop); }
                } else {
                    methods.push(extractMethod(child, document));
                }
                break;
            }
            case vscode.SymbolKind.Variable:
            case vscode.SymbolKind.Field:
            case vscode.SymbolKind.Constant: {
                const lineText = document.lineAt(child.range.start.line).text;
                if (ATTR_DECL_REGEX.test(lineText)) {
                    attributes.push(extractAttribute(child, document));
                }
                break;
            }
            case vscode.SymbolKind.Property: {
                const prop = extractProperty(child, document);
                if (prop) { properties.push(prop); }
                break;
            }
            case vscode.SymbolKind.EnumMember: {
                const lineText = document.lineAt(child.range.start.line).text;
                if (ATTR_DECL_REGEX.test(lineText)) {
                    attributes.push(extractAttribute(child, document));
                } else {
                    const m = lineText.match(ENUM_MEMBER_REGEX);
                    if (m) {
                        attributes.push({
                            name: m[1],
                            defaultValue: m[2].trim(),
                            definedAtLine: child.range.start.line,
                        });
                    }
                }
                break;
            }
        }
    }

    return {
        id: makeClassId(
            document.uri.toString(),
            sym.name,
            sym.range.start.line
        ),
        name: sym.name,
        bases,
        attributes,
        properties,
        methods,
        definedAtLine: sym.range.start.line,
        fileUri: document.uri.toString(),
        isAbstract,
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

/**
 * Returns the classes defined in `document`, identified by their universal class
 * IDs. Bases are resolved via the language server so that aliased imports
 * and same-name classes from different files are disambiguated to the
 * actual definition site.
 */
export async function extractClasses(
    document: vscode.TextDocument
): Promise<Map<string, ClassNode>> {
    const key = document.uri.toString();
    const cached = symbolCache.get(key);
    if (cached?.version === document.version) {
        return cached.classes;
    }

    const symbols = await getDocumentSymbols(document.uri);
    if (!symbols) {
        return new Map();
    }

    const classes = new Map<string, ClassNode>();
    for (const sym of symbols) {
        if (sym.kind !== vscode.SymbolKind.Class) {
            continue;
        }
        const node = await extractClassFromSymbol(sym, document);
        classes.set(node.id, node);
    }

    symbolCache.set(key, { version: document.version, classes });
    return classes;
}

/**
 * Builds a class map that includes the focus class, all its ancestors and
 * all descendants present in the current document — following base class
 * definitions across files when needed. Keyed by class ID.
 */
export async function buildInheritanceMap(
    focusId: string,
    document: vscode.TextDocument
): Promise<Map<string, ClassNode>> {
    const docClasses = await extractClasses(document);

    const merged = new Map<string, ClassNode>(docClasses);
    const queue: string[] = [focusId];
    const visited = new Set<string>([focusId]);

    while (queue.length > 0) {
        const id = queue.shift()!;
        const node = merged.get(id);
        if (!node) {
            continue;
        }

        for (const base of node.bases) {
            if (!base.id || visited.has(base.id)) {
                continue;
            }
            visited.add(base.id);

            if (merged.has(base.id)) {
                queue.push(base.id);
                continue;
            }

            const resolved = await loadClassById(base.id);
            if (!resolved) {
                continue;
            }

            merged.set(resolved.id, resolved);
            queue.push(resolved.id);
        }
    }

    return merged;
}

/* =========================================================
   ID RESOLUTION
   ========================================================= */

/**
 * Loads the class node referenced by an ID by parsing the file it lives in.
 * Returns undefined if the file can't be opened or the class is no longer
 * present at that location.
 */
async function loadClassById(id: string): Promise<ClassNode | undefined> {
    const hashIdx = id.indexOf('#');
    if (hashIdx < 0) {
        return undefined;
    }
    const key = id.slice(0, hashIdx);
    const fileUri = key.startsWith('file://')
        ? key
        : (vscode.workspace.workspaceFolders?.[0]?.uri.toString() ?? '') +
          '/' +
          key;

    let targetDoc: vscode.TextDocument;
    try {
        targetDoc = await vscode.workspace.openTextDocument(
            vscode.Uri.parse(fileUri)
        );
    } catch {
        return undefined;
    }
    const targetClasses = await extractClasses(targetDoc);
    return targetClasses.get(id);
}

/**
 * Resolves the bases of a class declaration into BaseRefs.
 *
 * For each base expression, the bare class identifier is located on the
 * declaration line and `executeDefinitionProvider` is asked where it points
 * to. The resulting position is used to compute the universal ID of the
 * actual class being inherited from. This naturally disambiguates classes
 * with the same name across files and resolves aliased imports.
 */
/**
 * Returns the index of the `(` that opens the base-class list, correctly
 * skipping an optional PEP 695 type-parameter block `[...]` that may appear
 * between the class name and the parentheses.  Returns -1 when not found.
 */
function findBasesParenIndex(lineText: string): number {
    const m = lineText.match(/^\s*class\s+\w+/);
    if (!m) { return -1; }
    let i = m[0].length;
    while (i < lineText.length && lineText[i] === ' ') { i++; }
    if (lineText[i] === '[') {
        let depth = 1;
        i++;
        while (i < lineText.length && depth > 0) {
            if (lineText[i] === '[') { depth++; }
            else if (lineText[i] === ']') { depth--; }
            i++;
        }
        while (i < lineText.length && lineText[i] === ' ') { i++; }
    }
    return lineText[i] === '(' ? i : -1;
}

async function resolveBases(
    lineText: string,
    document: vscode.TextDocument,
    classSymbol: vscode.DocumentSymbol
): Promise<BaseRef[]> {
    const match = lineText.match(CLASS_BASES_REGEX);
    if (!match?.[1]?.trim()) {
        return [];
    }

    const rawBases = match[1]
        .split(',')
        .map(b => b.trim())
        .filter(Boolean);
    const parenIdx = findBasesParenIndex(lineText);
    if (parenIdx < 0) {
        return rawBases.map(name => ({ name }));
    }

    let searchFrom = parenIdx;
    return Promise.all(
        rawBases.map(async raw => {
            const bareName = raw.match(BARE_NAME_REGEX)?.[0] ?? raw;
            const idx = lineText.indexOf(bareName, searchFrom);
            if (idx < 0) {
                return { name: raw };
            }
            searchFrom = idx + bareName.length;

            const id = await resolveBaseId(
                classSymbol.range.start.line,
                idx,
                document
            );
            return { name: raw, id };
        })
    );
}

async function resolveBaseId(
    line: number,
    column: number,
    fromDoc: vscode.TextDocument
): Promise<string | undefined> {
    const position = new vscode.Position(line, column);
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeDefinitionProvider',
        fromDoc.uri,
        position
    );
    if (!locations?.length) {
        return undefined;
    }

    const loc = locations[0];
    const targetSymbols = await getDocumentSymbols(loc.uri);
    if (!targetSymbols) {
        return undefined;
    }

    const targetSym = findEnclosingClass(targetSymbols, loc.range.start);
    if (!targetSym) {
        return undefined;
    }

    return makeClassId(
        loc.uri.toString(),
        targetSym.name,
        targetSym.range.start.line
    );
}

function findEnclosingClass(
    symbols: vscode.DocumentSymbol[],
    pos: vscode.Position
): vscode.DocumentSymbol | undefined {
    for (const sym of symbols) {
        if (sym.kind === vscode.SymbolKind.Class && sym.range.contains(pos)) {
            return sym;
        }
    }
    // Fallback: definition might land on a name token whose range is the
    // selectionRange, not the full class range. Try selectionRange match.
    for (const sym of symbols) {
        if (
            sym.kind === vscode.SymbolKind.Class &&
            sym.selectionRange.contains(pos)
        ) {
            return sym;
        }
    }
    return undefined;
}

/* =========================================================
   HELPERS
   ========================================================= */

function splitParams(raw: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (const ch of raw) {
        if (ch === '(' || ch === '[' || ch === '{') {
            depth++;
            current += ch;
        } else if (ch === ')' || ch === ']' || ch === '}') {
            depth--;
            current += ch;
        } else if (ch === ',' && depth === 0) {
            parts.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    if (current) {
        parts.push(current);
    }
    return parts;
}

function parseParams(raw: string): MethodParam[] {
    if (!raw.trim()) {
        return [];
    }

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
