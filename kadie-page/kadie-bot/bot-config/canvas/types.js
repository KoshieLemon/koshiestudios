// Port typing helpers: exec(flow) vs data(type)
export function canonicalType(t){
  if (!t) return 'any';
  const s = String(t).toLowerCase().trim();
  switch (s){
    case 'bool':
    case 'boolean': return 'boolean';
    case 'int':
    case 'integer': return 'int';
    case 'float':
    case 'number':
    case 'double': return 'float';
    case 'string':
    case 'text': return 'string';
    case 'any': return 'any';
    default: return s;
  }
}

export function normalizePortsFromElement(el){
  const toArr = (map, dir) => {
    const arr = [];
    if (map && typeof map === 'object'){
      for (const k of Object.keys(map)){
        const v = String(map[k]||'').toLowerCase();
        if (v === 'flow' || v === 'exec'){
          arr.push({ name:k, kind:'flow' });
        } else {
          arr.push({ name:k, kind:'data', type: canonicalType(v||'any') });
        }
      }
    }
    if (!arr.length){
      arr.push(dir==='in' ? { name:'In', kind:'data', type:'any' } : { name:'Out', kind:'data', type:'any' });
    }
    return arr;
  };
  return {
    inputs:  toArr(el?.inputs,  'in'),
    outputs: toArr(el?.outputs, 'out'),
  };
}

// Strict compatibility: kinds must match, and for data pins the exact type must match.
// No wildcard 'any' matching to avoid accidental links.
export function pinsCompatible(outPin, inPin){
  if (!outPin || !inPin) return false;
  if (outPin.kind !== inPin.kind) return false;
  if (outPin.kind === 'flow') return true;
  const a = canonicalType(outPin.type);
  const b = canonicalType(inPin.type);
  if (!a || !b) return false;
  // disallow 'any' wildcard here by spec
  if (a === 'any' || b === 'any') return false;
  return a === b;
}
