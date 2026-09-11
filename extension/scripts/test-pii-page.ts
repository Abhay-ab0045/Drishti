import { JSDOM } from 'jsdom';
import { detectFromAttributes, detectFromTextNodes } from '../src/pii/detector-dom';
import { aggregateDetections } from '../src/pii/detector-aggregate';

async function run() {
  try {
    const html = await fetch('http://localhost:3000/').then(r => r.text());
    const dom = new JSDOM(html);
    // @ts-ignore
    global.document = dom.window.document;
    // @ts-ignore
    global.Node = dom.window.Node;
    // @ts-ignore
    global.NodeFilter = dom.window.NodeFilter;
    // @ts-ignore
    global.Element = dom.window.Element;

    const domDetections = detectFromAttributes();
    const { detections: regexDetections, labelBoxes } = detectFromTextNodes();
    // Since we don't have the real vision detector here, pass empty array
    const merged = aggregateDetections(domDetections, regexDetections, [], labelBoxes);

    console.log('--- DETECTIONS ON TEST PAGE ---');
    if (merged.length === 0) console.log('None found.');
    merged.forEach(d => console.log(`${d.type.padEnd(20)} | Conf: ${d.confidence.toFixed(2)} | Path: ${'domPath' in d.location ? d.location.domPath : 'visual'}`));
  } catch(e: any) {
    console.error('Failed to fetch test page (is it running?):', e.message);
  }
}
run();
