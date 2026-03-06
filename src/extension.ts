import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Vibe Coder is awake and watching...');

    // Intercept the save event
    const saveListener = vscode.workspace.onWillSaveTextDocument((event) => {
        const document = event.document;

        // Only mess with TypeScript and JavaScript files for now
        if (document.languageId !== 'typescript' && document.languageId !== 'javascript') {
            return;
        }

        const fullText = document.getText();

        // 1. Run the code through our Emoji Nuke
        const textWithoutEmojis = nukeEmojis(fullText);

        // Tell VS Code to replace the file content with our cleaned version
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(fullText.length)
        );
        
        const edit = vscode.TextEdit.replace(fullRange, textWithoutEmojis);
        
        // Apply the edit BEFORE the file actually saves to disk
        event.waitUntil(Promise.resolve([edit]));
    });

    context.subscriptions.push(saveListener);
}

// Our first weapon: The Regex Emoji Killer
function nukeEmojis(text: string): string {
    // This regex catches 99% of standard emojis (🚀, ✨, 💡, etc.)
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    
    return text.replace(emojiRegex, '');
}

export function deactivate() {}