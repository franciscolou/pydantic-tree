import * as vscode from 'vscode';
import * as path from 'path';
import type { ClassNode } from '../types';

/**
 * Returns true if making `newParentId` a base of `childId` would create a
 * circular inheritance (newParent is the child itself, or has the child in
 * its own ancestor chain).
 */
export function detectCycle(
    childId: string,
    newParentId: string,
    classes: Map<string, ClassNode>
): boolean {
    if (childId === newParentId) {
        return true;
    }
    const visited = new Set<string>();
    const stack = [newParentId];
    while (stack.length) {
        const id = stack.pop()!;
        if (visited.has(id)) {
            continue;
        }
        visited.add(id);
        const node = classes.get(id);
        if (!node) {
            continue;
        }
        for (const base of node.bases) {
            if (base.id === childId) {
                return true;
            }
            if (base.id) {
                stack.push(base.id);
            }
        }
    }
    return false;
}

function collectMembers(
    classId: string,
    classes: Map<string, ClassNode>
): { attrs: Set<string>; methods: Set<string> } {
    const attrs = new Set<string>();
    const methods = new Set<string>();
    const visited = new Set<string>();
    const stack = [classId];
    while (stack.length) {
        const id = stack.pop()!;
        if (visited.has(id)) {
            continue;
        }
        visited.add(id);
        const node = classes.get(id);
        if (!node) {
            continue;
        }
        for (const a of node.attributes) {
            attrs.add(a.name);
        }
        for (const m of node.methods) {
            methods.add(m.name);
        }
        for (const b of node.bases) {
            if (b.id) {
                stack.push(b.id);
            }
        }
    }
    return { attrs, methods };
}

/**
 * Returns the attribute/method names from the prospective new parent's
 * inheritance chain that conflict with names already defined locally in the
 * child or inherited from other (unchanged) bases.
 */
export function detectConflicts(
    child: ClassNode,
    oldParentId: string,
    newParentId: string,
    classes: Map<string, ClassNode>
): { attrs: string[]; methods: string[] } {
    const fromNewParent = collectMembers(newParentId, classes);

    const ownNames = new Set<string>([
        ...child.attributes.map(a => a.name),
        ...child.methods.map(m => m.name),
    ]);

    const otherInherited = new Set<string>();
    for (const base of child.bases) {
        if (!base.id || base.id === oldParentId) {
            continue;
        }
        const members = collectMembers(base.id, classes);
        for (const n of members.attrs) {
            otherInherited.add(n);
        }
        for (const n of members.methods) {
            otherInherited.add(n);
        }
    }

    const attrs: string[] = [];
    const methods: string[] = [];
    for (const name of fromNewParent.attrs) {
        if (ownNames.has(name) || otherInherited.has(name)) {
            attrs.push(name);
        }
    }
    for (const name of fromNewParent.methods) {
        if (ownNames.has(name) || otherInherited.has(name)) {
            methods.push(name);
        }
    }
    return { attrs, methods };
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Converts a Python source-file URI to its dotted module path relative to
 * the containing workspace folder. Returns null if the file is outside any
 * workspace folder.
 *
 *   /ws/pkg/models.py       -> pkg.models
 *   /ws/pkg/__init__.py     -> pkg
 *   /ws/pkg/sub/__init__.py -> pkg.sub
 */
function computeModulePath(fileUri: string): string | null {
    const uri = vscode.Uri.parse(fileUri);
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) {
        return null;
    }
    const rel = path.relative(folder.uri.fsPath, uri.fsPath);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
        return null;
    }
    let normalized = rel.split(path.sep).join('/');
    if (normalized.endsWith('.py')) {
        normalized = normalized.slice(0, -3);
    }
    if (normalized === '__init__' || normalized.endsWith('/__init__')) {
        normalized = normalized.slice(0, -'__init__'.length);
        if (normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
    }
    if (!normalized) {
        return null;
    }
    return normalized.split('/').join('.');
}

/**
 * Naive but effective check: is `name` referenced as a whole word in any
 * top-level import statement of the document? Catches `from x import Name`,
 * `from x import Name as Alias` (treated as imported), `import Name`, and
 * `from . import Name`. Doesn't model aliases beyond presence.
 */
function isNameImported(text: string, name: string): boolean {
    const lines = text.split('\n');
    let inDocstring = false;
    let quote = '';
    const wordRe = new RegExp(`\\b${escapeRegex(name)}\\b`);
    for (const line of lines) {
        const trimmed = line.trim();
        if (inDocstring) {
            if (trimmed.includes(quote)) {
                inDocstring = false;
            }
            continue;
        }
        if (trimmed === '' || trimmed.startsWith('#')) {
            continue;
        }
        if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
            quote = trimmed.slice(0, 3);
            if (
                trimmed.length > 3 &&
                trimmed.slice(3).includes(quote)
            ) {
                continue;
            }
            inDocstring = true;
            continue;
        }
        if (/^(import|from)\s/.test(trimmed)) {
            if (wordRe.test(trimmed)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Decides where a new import line should be inserted: immediately after the
 * last existing top-level import, or, if none exist, at the top of the file
 * (below any leading docstring or comments).
 */
function findImportInsertionLine(doc: vscode.TextDocument): number {
    let inDocstring = false;
    let quote = '';
    let lastImportLine = -1;
    let firstCodeLine = -1;
    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        const trimmed = text.trim();
        if (inDocstring) {
            if (trimmed.includes(quote)) {
                inDocstring = false;
            }
            continue;
        }
        if (trimmed === '' || trimmed.startsWith('#')) {
            continue;
        }
        if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
            quote = trimmed.slice(0, 3);
            if (
                trimmed.length > 3 &&
                trimmed.slice(3).includes(quote)
            ) {
                continue;
            }
            inDocstring = true;
            continue;
        }
        if (/^(import|from)\s/.test(trimmed)) {
            lastImportLine = i;
            continue;
        }
        if (firstCodeLine < 0) {
            firstCodeLine = i;
        }
        break;
    }
    if (lastImportLine >= 0) {
        return lastImportLine + 1;
    }
    return firstCodeLine >= 0 ? firstCodeLine : 0;
}

/**
 * Finds the range covering the bases tuple of a class declaration starting at
 * `classLine` (the line containing `class Foo(...):`). Handles multi-line
 * declarations by tracking parenthesis depth. Returns null if the class has
 * no parentheses (no explicit bases).
 */
function findBasesRegion(
    doc: vscode.TextDocument,
    classLine: number
): vscode.Range | null {
    let depth = 0;
    let openLine = -1;
    let openCol = -1;
    const lastLine = Math.min(classLine + 30, doc.lineCount - 1);
    for (let line = classLine; line <= lastLine; line++) {
        const text = doc.lineAt(line).text;
        for (let col = 0; col < text.length; col++) {
            const ch = text[col];
            if (ch === '(') {
                if (depth === 0) {
                    openLine = line;
                    openCol = col;
                }
                depth++;
            } else if (ch === ')') {
                depth--;
                if (depth === 0) {
                    return new vscode.Range(
                        new vscode.Position(openLine, openCol + 1),
                        new vscode.Position(line, col)
                    );
                }
            } else if (depth === 0 && ch === ':') {
                return null;
            }
        }
    }
    return null;
}

/**
 * Rewrites the source code: in `child`'s class declaration, replaces the
 * base-class identifier that corresponds to `oldParent` with `newParent`'s
 * name. If `newParent` lives in a different file and isn't already imported,
 * a `from <module> import <Name>` line is added in the same edit.
 */
export async function rewriteInheritance(
    child: ClassNode,
    oldParent: ClassNode,
    newParent: ClassNode
): Promise<boolean> {
    const matchingBase = child.bases.find(b => b.id === oldParent.id);
    if (!matchingBase) {
        return false;
    }
    const oldName = matchingBase.name;
    const newName = newParent.name;

    const doc = await vscode.workspace.openTextDocument(
        vscode.Uri.parse(child.fileUri)
    );
    const region = findBasesRegion(doc, child.definedAtLine);
    if (!region) {
        return false;
    }

    const text = doc.getText(region);
    const regex = new RegExp(`\\b${escapeRegex(oldName)}\\b`);
    const match = regex.exec(text);
    if (!match) {
        return false;
    }

    const edit = new vscode.WorkspaceEdit();

    if (oldName !== newName) {
        const startOffset = doc.offsetAt(region.start) + match.index;
        const endOffset = startOffset + oldName.length;
        edit.replace(
            doc.uri,
            new vscode.Range(
                doc.positionAt(startOffset),
                doc.positionAt(endOffset)
            ),
            newName
        );
    }

    if (newParent.fileUri !== child.fileUri) {
        const fullText = doc.getText();
        if (!isNameImported(fullText, newName)) {
            const modulePath = computeModulePath(newParent.fileUri);
            if (modulePath) {
                const insertLine = findImportInsertionLine(doc);
                const importStmt = `from ${modulePath} import ${newName}\n`;
                edit.insert(
                    doc.uri,
                    new vscode.Position(insertLine, 0),
                    importStmt
                );
            }
        }
    }

    if (oldName === newName && edit.size === 0) {
        return false;
    }
    return vscode.workspace.applyEdit(edit);
}
