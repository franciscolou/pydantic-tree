import * as vscode from 'vscode';
import type { ClassNode, MethodParam } from './types';

/* =========================================================
   REGEX
   ========================================================= */

const CLASS_LINE_REGEX =
    /^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(([^)]*)\))?\s*:/;

const ATTR_REGEX =
    /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^=]+?)(?:\s*=\s*.+)?\s*$/;

const METHOD_REGEX =
    /^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?\s*:/;

/* =========================================================
   ENTRY POINT
   ========================================================= */

export function extractClasses(
    document: vscode.TextDocument
): Map<string, ClassNode> {
    const classes = new Map<string, ClassNode>();

    for (let i = 0; i < document.lineCount; i++) {
        const match = document.lineAt(i).text.match(CLASS_LINE_REGEX);
        if (!match) continue;

        const node = createClassNode(match[1], parseBases(match[2]));
        const body = getClassBody(document, i);

        parseClassBody(node, body, i);
        classes.set(node.name, node);
    }

    return classes;
}

/* =========================================================
   CLASS BODY
   ========================================================= */

function getClassBody(
    document: vscode.TextDocument,
    classLine: number
): string[] {
    const body: string[] = [];
    const baseIndent =
        document.lineAt(classLine).firstNonWhitespaceCharacterIndex;

    for (let i = classLine + 1; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        if (line.isEmptyOrWhitespace) continue;

        if (line.firstNonWhitespaceCharacterIndex <= baseIndent) break;
        body.push(line.text);
    }

    return body;
}

function parseClassBody(node: ClassNode, lines: string[], baseLine: number) {
    lines.forEach((line, i) => {
        if (line.trim().startsWith('#')) return;

        const absoluteLine = baseLine + i + 1;
        if (tryParseMethod(node, line, absoluteLine)) return;
        tryParseAttribute(node, line, absoluteLine);
    });
}

/* =========================================================
   MEMBERS
   ========================================================= */

function tryParseMethod(node: ClassNode, raw: string, line: number): boolean {
    const match = raw.match(METHOD_REGEX);
    if (!match) return false;

    node.methods.push({
        name: match[1],
        params: parseParams(match[2]),
        returnType: match[3]?.trim(),
        definedAtLine: line,
    });

    return true;
}

function tryParseAttribute(node: ClassNode, raw: string, line: number) {
    const match = raw.match(ATTR_REGEX);
    if (!match) return;

    node.attributes.push({
        name: match[1],
        type: match[2].trim(),
        definedAtLine: line,
    });
}

/* =========================================================
   HELPERS
   ========================================================= */

function createClassNode(name: string, bases: string[]): ClassNode {
    return {
        name,
        bases,
        attributes: [],
        methods: [],
    };
}

function parseBases(raw?: string): string[] {
    if (!raw) return [];
    return raw
        .split(',')
        .map(b => b.trim())
        .filter(Boolean);
}

function parseParams(raw: string): MethodParam[] {
    if (!raw.trim()) return [];

    return raw
        .split(',')
        .map(p => p.trim())
        .filter(p => p && p !== 'self' && p !== 'cls')
        .map(p => {
            const [nameAndType, defaultValue] = p.split('=');
            const [name, type] = nameAndType.split(':').map(s => s.trim());

            return {
                name,
                type,
                defaultValue: defaultValue?.trim(),
            };
        });
}
