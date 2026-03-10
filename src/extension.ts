import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log("VibeCoder is awake and watching...");

  // On-save pipeline
  const saveListener = vscode.workspace.onWillSaveTextDocument((event) => {
    const document = event.document;

    if (
      document.languageId !== "typescript" &&
      document.languageId !== "javascript"
    ) {
      return;
    }

    const edit = buildScrubEdit(document);
    if (edit) {
      event.waitUntil(Promise.resolve([edit]));
    }
  });

  // Manual command: VibeCoder: Scrub This File Now
  const scrubCommand = vscode.commands.registerCommand(
    "vibe-coder.scrubNow",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage(
          "VibeCoder: No active editor to scrub.",
        );
        return;
      }

      const document = editor.document;
      if (
        document.languageId !== "typescript" &&
        document.languageId !== "javascript"
      ) {
        vscode.window.showWarningMessage(
          "VibeCoder: Only TypeScript and JavaScript files are supported.",
        );
        return;
      }

      const edit = buildScrubEdit(document);
      if (edit) {
        const wsEdit = new vscode.WorkspaceEdit();
        wsEdit.set(document.uri, [edit]);
        await vscode.workspace.applyEdit(wsEdit);
        vscode.window.showInformationMessage(
          "VibeCoder: File scrubbed. You look less like a bot now.",
        );
      } else {
        vscode.window.showInformationMessage(
          "VibeCoder: Nothing to scrub. Surprisingly human file.",
        );
      }
    },
  );

  context.subscriptions.push(saveListener, scrubCommand);
}

// ─── Core Pipeline ────────────────────────────────────────────────────────────

function buildScrubEdit(document: vscode.TextDocument): vscode.TextEdit | null {
  const config = vscode.workspace.getConfiguration("vibe-coder");
  const fullText = document.getText();

  let result = fullText;

  if (config.get<boolean>("enableEmojiNuke", true)) {
    result = nukeEmojis(result);
  }

  if (config.get<boolean>("enableSmartScrubber", true)) {
    result = smartScrub(result);
  }

  if (config.get<boolean>("enableChaosEngine", false)) {
    result = chaosEngine(result);
  }

  if (result === fullText) {
    return null; // Nothing changed, no edit needed
  }

  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(fullText.length),
  );

  return vscode.TextEdit.replace(fullRange, result);
}

// ─── Weapon 1: The Emoji Nuke ─────────────────────────────────────────────────
// Regex catches the vast majority of Unicode emoji blocks (🚀, ✨, 💡, 🐛, etc.)

function nukeEmojis(text: string): string {
  const emojiRegex =
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  return text.replace(emojiRegex, "");
}

// ─── Weapon 2: The Smart Scrubber ─────────────────────────────────────────────
// Line-by-line pass that detects and removes AI-generated cringe comments.
// Safe rules:
//   - Never touches code lines (only pure comment lines)
//   - Never touches TODO / FIXME / HACK / BUG / XXX markers
//   - Never touches JSDoc @tags
//   - Collapses 3+ consecutive blank lines left behind into 2

const AI_CRINGE_PATTERNS: RegExp[] = [
  // "This X does/is/..." — the classic AI opener
  /^this (function|method|class|component|hook|file|module|code|block|section|snippet|piece|part|line|handler|helper|utility|approach|logic|implementation|variable|constant|array|object|interface|type|enum|param|parameter|prop|property|state|ref|effect|callback|promise|async|await|loop|iteration|condition|check|validation|helper function|utility function)\b/i,

  // "The following / above / below..."
  /^the (function|method|class|component|hook|following|above|below|code|block|section|snippet|line|loop|condition|variable|constant|array|object|interface|type|enum|parameter|prop|state|callback|promise)\b/i,

  // "Here we / Here is..."
  /^here (we|i|is|are|'?s)\b/i,

  // "Below/Above we can see..."
  /^(below|above) (we|i|is|are|you|can|the)\b/i,

  // "Now we / Now let's..."
  /^now (we|i|let'?s|it'?s)\b/i,

  // "We can/need/use/should/are/will..."
  /^we (can|need|use|are|will|should|have|define|create|call|check|set|get|handle|make|add|remove|update|initialize|import|export|render|return|iterate|loop|fetch|load|build|configure|setup|validate|ensure|pass|wrap|map|filter|reduce|store|save|delete|push|pull|merge|sort|find|search|parse|serialize|convert|transform|format|log|throw|catch|resolve|reject|dispatch|emit|subscribe|unsubscribe)\b/i,

  // Numbered step comments: "1.", "1)", "Step 1:", "Phase 1", "Part 1"
  /^step \d+\s*[:\-.]?\s/i,
  /^\d+[\.\)]\s+\w/,
  /^phase \d+/i,
  /^part \d+/i,

  // Imperative AI comment starters (AI loves these)
  /^(initialize|instantiate|define|declare|import|export|create|handle|process|manage|update|fetch|load|render|build|configure|set up|setup|check|validate|ensure|make sure|loop through|iterate (over|through)|iterate the|map (over|through)|filter the|reduce the|sort the|find the|search for|parse the|serialize|convert|transform|format|return the|throw (a|an|the|new)|catch (the|any)|resolve (the|a)|reject (the|a)|dispatch|emit|subscribe|unsubscribe)\b/i,

  // "Note that..." / "Note:" / "Important:" / "Warning:" / "Remember:"
  /^(note that|note:|important:|warning:|remember:|keep in mind|please note|be aware|be sure to|don'?t forget)\b/i,

  // Divider lines: ---, ===, ***, ###, etc.
  /^[-=*#~]{3,}\s*$/,

  // Completely empty comment body
  /^$/,

  // Single-word AI labels that add nothing
  /^(example|output|result|usage|summary|overview|description|details|explanation|implementation|approach|solution|logic|flow|process|pipeline|lifecycle|algorithm|pseudocode|breakdown|walkthrough|context|background|rationale|motivation|purpose|goal|objective|task|todo list|steps|instructions):?\s*$/i,
];

// Patterns that look like AI cringe but we NEVER remove
const SACRED_PATTERNS: RegExp[] = [
  /^(TODO|FIXME|HACK|BUG|XXX|REVIEW|OPTIMIZE|NOSONAR)[\s:]*/i,
  /^@/, // JSDoc tags: @param, @returns, @throws, @example...
  /^eslint/i, // eslint-disable comments
  /^@ts-/i, // @ts-ignore, @ts-expect-error
  /^istanbul/i, // istanbul ignore
  /^prettier/i, // prettier-ignore
  /^copyright/i, // license headers
  /^license/i,
  /^(author|version|since|see|link|deprecated):/i, // common doc tags without @
];

function isAICringe(commentBody: string): boolean {
  const body = commentBody.trim();

  // Too short to be cringe (e.g. a single letter or number used as a label)
  // But empty is definitely cringe
  if (body.length === 0) {
    return true;
  }

  // Never touch sacred patterns
  if (SACRED_PATTERNS.some((p) => p.test(body))) {
    return false;
  }

  return AI_CRINGE_PATTERNS.some((p) => p.test(body));
}

function smartScrub(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let consecutiveBlanks = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Pure single-line comment: the whole line is // ...
    if (/^\/\//.test(trimmed)) {
      const commentBody = trimmed.slice(2).trim();
      if (isAICringe(commentBody)) {
        // Replace with a blank to avoid jamming code together,
        // but we'll collapse runs of blanks below.
        consecutiveBlanks++;
        if (consecutiveBlanks <= 1) {
          result.push("");
        }
        continue;
      }
    }

    // JSDoc / block comment interior lines: " * This function..."
    // Matches lines like `     * This creates a new...`
    if (/^\*\s/.test(trimmed) || trimmed === "*") {
      const commentBody = trimmed.replace(/^\*\s?/, "").trim();
      if (isAICringe(commentBody)) {
        consecutiveBlanks++;
        if (consecutiveBlanks <= 1) {
          result.push("");
        }
        continue;
      }
    }

    // Any non-blank line resets the blank counter
    if (trimmed !== "") {
      consecutiveBlanks = 0;
    } else {
      consecutiveBlanks++;
      // Collapse 3+ consecutive blank lines into 2
      if (consecutiveBlanks > 2) {
        continue;
      }
    }

    result.push(line);
  }

  // Trim trailing blank lines introduced by scrubbing (but keep one final newline)
  while (result.length > 0 && result[result.length - 1].trim() === "") {
    result.pop();
  }

  return result.join("\n") + "\n";
}

// ─── Weapon 3: The Chaos Engine ───────────────────────────────────────────────
// Walks the source character-by-character, skipping comments and template literals,
// and randomly swaps single ↔ double quotes in string literals.
// A swap only happens when:
//   (a) the string content doesn't contain the target quote character (would break syntax)
//   (b) a per-string coin flip says yes (50/50)

function chaosEngine(text: string): string {
  return randomizeQuotes(text);
}

function randomizeQuotes(text: string): string {
  let result = "";
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    // ── Skip single-line comments (//) ────────────────────────────────────
    if (ch === "/" && text[i + 1] === "/") {
      while (i < len && text[i] !== "\n") {
        result += text[i++];
      }
      continue;
    }

    // ── Skip block comments (/* ... */) ───────────────────────────────────
    if (ch === "/" && text[i + 1] === "*") {
      result += text[i++]; // /
      result += text[i++]; // *
      while (i < len) {
        if (text[i] === "*" && text[i + 1] === "/") {
          result += text[i++]; // *
          result += text[i++]; // /
          break;
        }
        result += text[i++];
      }
      continue;
    }

    // ── Skip template literals (` ... `) — too complex to rewrite ─────────
    if (ch === "`") {
      result += text[i++]; // opening backtick
      while (i < len) {
        if (text[i] === "\\") {
          result += text[i++]; // backslash
          if (i < len) {
            result += text[i++];
          } // escaped char
          continue;
        }
        if (text[i] === "`") {
          result += text[i++]; // closing backtick
          break;
        }
        // Template expression ${...} — skip recursively
        if (text[i] === "$" && text[i + 1] === "{") {
          result += text[i++]; // $
          result += text[i++]; // {
          let depth = 1;
          while (i < len && depth > 0) {
            if (text[i] === "{") {
              depth++;
            } else if (text[i] === "}") {
              depth--;
            }
            if (depth > 0) {
              result += text[i++];
            } else {
              result += text[i++];
            } // closing }
          }
          continue;
        }
        result += text[i++];
      }
      continue;
    }

    // ── Handle single or double quoted string literals ─────────────────────
    if (ch === '"' || ch === "'") {
      const openQuote = ch;
      const altQuote = openQuote === '"' ? "'" : '"';

      let body = "";
      let containsAlt = false;
      i++; // skip opening quote

      while (i < len && text[i] !== openQuote) {
        if (text[i] === "\\") {
          // Escaped character — copy verbatim
          const esc = text[i] + (text[i + 1] ?? "");
          body += esc;
          i += 2;
          continue;
        }
        if (text[i] === altQuote) {
          containsAlt = true;
        }
        body += text[i++];
      }
      if (i < len) {
        i++;
      } // skip closing quote

      // Only swap if safe (no unescaped alt quote inside) and lucky (50%)
      if (!containsAlt && Math.random() < 0.5) {
        result += altQuote + body + altQuote;
      } else {
        result += openQuote + body + openQuote;
      }
      continue;
    }

    result += text[i++];
  }

  return result;
}

export function deactivate() {}
