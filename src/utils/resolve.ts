import * as vscode from 'vscode';
import { ClassNode, ClassRef } from "../types";
import { extractClasses } from "../utils/parser";

export async function resolveClassNode(ref?: ClassRef): Promise<ClassNode | undefined> {
    if (ref) {
        const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(ref.fileUri));
        const classes = await extractClasses(document);
        for (const node of classes.values()) {
            if (node.definedAtLine === ref.line) return node;
        }
        return undefined;
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor) return undefined;
    return getClassUnderCursor(editor.document, editor.selection.active);
}

export async function getClassUnderCursor(
    document: vscode.TextDocument,
    position: vscode.Position
): Promise<ClassNode | undefined> {
    const range = document.getWordRangeAtPosition(position);
    if (!range) return;
    const word = document.getText(range);
    const classes = await extractClasses(document);
    // The map is identified by class ID; resolve by name within this document.
    // If the cursor lands on a class declaration line, prefer that class so
    // the right node is picked when this file declares multiple classes that
    // happen to share a leading word.
    for (const node of classes.values()) {
        if (node.name === word && node.definedAtLine === position.line) return node;
    }
    for (const node of classes.values()) {
        if (node.name === word) return node;
    }
    return undefined;
}

export function resolveLayeredNodes(
    nameLayers: string[][],
    classes: Map<string, ClassNode>
): ClassNode[][] {
    return nameLayers.map(layer =>
        layer.map(name => classes.get(name)).filter((node): node is ClassNode => Boolean(node))
    );
}