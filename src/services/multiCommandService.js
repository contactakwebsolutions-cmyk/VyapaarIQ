function splitIntoCommandTexts(rawText) {
    if (!rawText) return [];

    const text = String(rawText).replace(/\r\n/g, '\n');
    const lines = text.split('\n');

    const commands = [];

    for (const line of lines) {
        const trimmedLine = (line || '').trim();
        if (!trimmedLine) continue;

        // Secondary separator: comma (,)
        // Split only when the next token looks like a new command, to keep backward compatibility
        // for descriptions like: "S 100 milk, bread".
        const parts = trimmedLine.split(/,(?=\s*(?:[SEPI]\b|[అఖవఆ]\b))/i);
        for (const part of parts) {
            const cmd = (part || '').trim();
            if (cmd) commands.push(cmd);
        }
    }

    return commands;
}

module.exports = { splitIntoCommandTexts };

