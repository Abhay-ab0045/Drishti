import { JSDOM } from 'jsdom';
import { detectFromAttributes, detectFromTextNodes } from '../src/pii/detector-dom';
import { aggregateDetections } from '../src/pii/detector-aggregate';
import { PIIDetection } from '../src/pii/types';

const FIXTURES = `
  <div>
    <!-- REAL CASES -->
    <input type="password" id="real-pwd" />
    <input autocomplete="cc-number" id="real-cc" />
    <input name="aadhaar_number" id="real-aadhaar-input" />
    <input name="pan" id="real-pan-input" />
    <span id="real-email">john.doe@example.com</span>
    <span id="real-phone">+91-9876543210</span>
    <span id="real-aadhaar-text">Aadhaar: 1234 5678 9012</span>
    <span id="real-pan-text">PAN: ABCDE1234F</span>
    <!-- The CC below must pass Luhn (e.g. 4242 4242 4242 4242) -->
    <span id="real-cc-text">Card: 4242 4242 4242 4242</span>

    <!-- NEAR-MISS TRAPS -->
    <input name="user_id" id="uid" /> <!-- Adversarial Trap 1: "uid" shouldn't flag Aadhaar -->
    <span id="trap-tracking">Tracking ID: 123456789012</span>
    <span id="trap-invalid-cc">Invalid Card: 1234 5678 9012 3456</span> <!-- Fails Luhn -->
    <span id="trap-not-pan">Not PAN: ABCDE12345</span> <!-- 5 digits at end instead of letter -->
    
    <!-- ADVERSARIAL REAL CASES -->
    <span id="real-cc-no-hint">4111 1111 1111 1111</span> <!-- Adversarial 2: CC with no DOM hint (valid Luhn) -->
    <span id="real-aadhaar-and-tracking">Your Aadhaar is 1234 5678 9012 and your order tracking ID is 987654321012</span> <!-- Adversarial 3: Real Aadhaar and Tracking ID in same block -->

    <!-- VISUAL HEURISTIC TRAPS -->
    <span id="trap-visual-context">Stock Photo description</span>
    <span id="real-visual-context" style="position: absolute; left: 50px; top: 50px;">Passport Photo</span>
  </div>
`;

// Setup JSDOM
const dom = new JSDOM(FIXTURES);
// @ts-ignore
global.document = dom.window.document;
// @ts-ignore
global.Node = dom.window.Node;
// @ts-ignore
global.NodeFilter = dom.window.NodeFilter;
// @ts-ignore
global.Element = dom.window.Element;

async function runTest() {
  const domDetections = detectFromAttributes();
  const { detections: regexDetections, labelBoxes } = detectFromTextNodes();

  // Mock visual detections
  const visualDetections: PIIDetection[] = [
    { type: 'FACE_IMAGE', source: 'visual', location: { boundingBox: [0, 0, 100, 100] }, confidence: 0.90 } // Trap: no sensitive label nearby
  ];

  const merged = aggregateDetections(domDetections, regexDetections, visualDetections, labelBoxes);

  console.log('--- RAW DETECTIONS ---');
  merged.forEach(d => console.log(`${d.type.padEnd(20)} | Conf: ${d.confidence.toFixed(2)} | Path: ${'domPath' in d.location ? d.location.domPath : 'visual'}`));

  console.log('\n--- EVALUATION ---');
  // Define ground truth
  const groundTruthCount = 12; // 1 pwd, 1 cc input, 1 aadhaar input, 1 pan input, 1 email, 1 phone, 1 aadhaar text, 1 pan text, 1 cc text, 1 visual, 1 cc no hint, 1 aadhaar with tracking
  let truePositives = 0;
  let falsePositives = 0;

  for (const det of merged) {
    if ('domPath' in det.location) {
      const path = det.location.domPath;
      if (path.includes('trap') || path.includes('invalid') || path.includes('not pan') || path === '#uid') {
        falsePositives++;
        console.log(`❌ FALSE POSITIVE: ${det.type} at ${path}`);
      } else if (path.includes('real-') || path.includes('example.com') || path.includes('+91') || path.includes('1234') || path.includes('ABCDE')) {
        truePositives++;
      } else {
        if (det.type === 'AADHAAR') {
           console.log(`❌ FALSE POSITIVE (Caught tracking ID as Aadhaar): ${path}`);
           falsePositives++;
        }
      }
    } else {
       // visual
       if (det.type === 'SENSITIVE_LABEL_IMAGE') {
          truePositives++;
       } else {
          console.log(`❌ FALSE POSITIVE: Visual face not correctly labeled`);
          falsePositives++;
       }
    }
  }

  const recall = truePositives / groundTruthCount;
  const precision = truePositives / (truePositives + falsePositives || 1);

  console.log(`\nMetrics:`);
  console.log(`True Positives:  ${truePositives}`);
  console.log(`False Positives: ${falsePositives}`);
  console.log(`Precision:       ${(precision * 100).toFixed(1)}%`);
  console.log(`Recall:          ${(recall * 100).toFixed(1)}%`);
}

runTest();
