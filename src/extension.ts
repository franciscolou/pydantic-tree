import * as vscode from 'vscode';
import { ClassRef } from './types';
import { showClassTree, showCompleteClassTree, showProjectTree, showPickClassesTree } from "./handlers";
import { HoverProvider } from "./providers/hover";

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        registerHoverProvider(),
        registerShowClassCommand(context),
        registerShowCompleteClassCommand(context),
        registerShowProjectTreeCommand(context),
        registerPickClassesCommand(context)
    );
}

export function deactivate() {}


function registerHoverProvider(): vscode.Disposable {
    return vscode.languages.registerHoverProvider('python', HoverProvider);
}

function registerShowClassCommand(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand('pytree.showClassTree', (ref?: ClassRef) => showClassTree(context, ref));
}

function registerShowCompleteClassCommand(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand('pytree.showCompleteClassTree', (ref?: ClassRef) => showCompleteClassTree(context, ref));
}

function registerShowProjectTreeCommand(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand('pytree.showProjectTree', () => showProjectTree(context));
}

function registerPickClassesCommand(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand('pytree.pickClasses', () => showPickClassesTree(context));
}
