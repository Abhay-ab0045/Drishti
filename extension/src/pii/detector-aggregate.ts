import { PIIDetection } from './types';

export function aggregateDetections(
  domDetections: PIIDetection[],
  regexDetections: PIIDetection[],
  visualDetections: PIIDetection[],
  labelBoxes: { x: number, y: number, w: number, h: number }[]
): PIIDetection[] {
  const merged: PIIDetection[] = [];
  const seenPaths = new Map<string, PIIDetection>();

  for (const det of [...domDetections, ...regexDetections]) {
    if ('domPath' in det.location) {
      const key = `${det.type}-${det.location.domPath}`;
      if (seenPaths.has(key)) {
        const existing = seenPaths.get(key)!;
        if (det.confidence > existing.confidence) {
          seenPaths.set(key, det); 
        }
      } else {
        seenPaths.set(key, det);
      }
    }
  }

  merged.push(...Array.from(seenPaths.values()));

  for (const det of visualDetections) {
    if (det.type === 'FACE_IMAGE' && 'boundingBox' in det.location) {
      let isSensitiveLabel = false;
      const [x, y, w, h] = det.location.boundingBox;
      
      for (const box of labelBoxes) {
        const distX = Math.abs((box.x + box.w / 2) - (x + w / 2));
        const distY = Math.abs((box.y + box.h / 2) - (y + h / 2));
        if (distX < 300 && distY < 300) {
          isSensitiveLabel = true;
          break;
        }
      }

      if (isSensitiveLabel) {
        merged.push({ type: 'SENSITIVE_LABEL_IMAGE', source: 'visual', location: det.location, confidence: 0.95 });
      } else {
        merged.push(det);
      }
    } else {
      merged.push(det);
    }
  }

  return merged;
}
