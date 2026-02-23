export function HtmlRoot(body: string): string {
    return `
<!DOCTYPE html>
<html>
<body style="margin:0;overflow:hidden;">
${body}
</body>
</html>
`;
}
