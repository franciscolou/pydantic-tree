export function HtmlRoot(body: string): string {
    return `<!DOCTYPE html>
<html>
<head>
<style>
  :root {
      /* Structural - from VSCode */
      --pt-bg:       var(--vscode-editor-background,       #1e1e1e);
      --pt-panel-bg: var(--vscode-editorWidget-background, #252526);
      --pt-border:   var(--vscode-editorWidget-border,     #3c3c3c);
      --pt-text:     var(--vscode-editor-foreground,       #d4d4d4);

      /* Header */
      --pt-header-bg:          #4ec9b0;
      --pt-abstract-header-bg: #f2f7d7;
      --pt-header-text:        #000000;

      /* File path section */
      --pt-filepath-bg:   #1a1a1a;
      --pt-filepath-text: #717171;

      /* Section labels */
      --pt-section-label: #606060;

      /* Semantic syntax colors — dark theme defaults */
      --pt-type:      #4ec9b0;
      --pt-string:    #ce9178;
      --pt-number:    #b5cea8;
      --pt-attribute: #9cdcfe;
      --pt-method:    #dccd79;
      --pt-override:  #c586c0;
      --pt-bool: var(--vscode-symbolIcon-booleanForeground)

      /* Edge colors */
      --pt-edge:   var(--vscode-editorWidget-border, #6a6a6a);
      --pt-edge-0: #7a9fc2;
      --pt-edge-1: #89b08a;
      --pt-edge-2: #c2a97a;
      --pt-edge-3: #a87ec2;
      --pt-edge-4: #7ab8b5;
      --pt-edge-5: #c28080;

      /* Hover underline on interactive nodes */
      --pt-hover-underline:        rgba(255,255,255,0.85);
      --pt-hover-underline-member: rgba(255,255,255,0.30);
  }

  /* Light theme overrides */
  body[data-vscode-theme-kind="vscode-light"],
  body[data-vscode-theme-kind="vscode-high-contrast-light"] {
      --pt-type:     #267f99;
      --pt-string:   #a31515;
      --pt-attribute:#0070c1;
      --pt-method:   #795e26;
      --pt-override: #af00db;

      --pt-edge-0: #2b6797;
      --pt-edge-1: #2e6b30;
      --pt-edge-2: #7d5a00;
      --pt-edge-3: #6b2f8f;
      --pt-edge-4: #1d7a75;
      --pt-edge-5: #8b2222;

      --pt-hover-underline:        rgba(0,0,0,0.85);
      --pt-hover-underline-member: rgba(0,0,0,0.30);

      --pt-filepath-bg:   #e0e0e0;
      --pt-filepath-text: #5a5a5a;

      --pt-section-label: #909090;
  }
</style>
</head>
<body style="margin:0;overflow:hidden;">
${body}
</body>
</html>
`;
}
