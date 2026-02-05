const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('buycycle_debug_dump.html', 'utf8');
const $ = cheerio.load(html);

let stream = '';
$('script').each((i, el) => {
    const content = $(el).html() || '';
    if (content.includes('self.__next_f.push')) {
        // console.log('Found chunk:', content.substring(0, 100) + '...');
        
        // Regex to capture the string argument: self.__next_f.push([1,"CONTENT"])
        // We use a non-greedy match for the start, but we need to handle the content carefully.
        // The content is a JSON string literal.
        // It ends with "])
        
        const match = content.match(/self\.__next_f\.push\(\[\d+,"(.*)"\]\)/);
        if (match && match[1]) {
            try {
                // The match[1] is the raw string content (e.g. "foo \"bar\"")
                // We need to unescape it to get the actual JSON structure (e.g. foo "bar")
                const chunk = JSON.parse(`"${match[1]}"`);
                stream += chunk;
            } catch (e) {
                console.error('Parse error:', e.message);
                // console.log('Bad chunk:', match[1].substring(0, 100));
            }
        }
    }
});

console.log('Stream length:', stream.length);
if (stream.length > 0) {
    const descMatch = stream.match(/"description":\{"key":"[^"]+","value":"(.*?)"/);
    if (descMatch) {
        console.log('Description Found:', descMatch[1].substring(0, 100) + '...');
    } else {
        console.log('Description NOT found in stream');
    }
}
