// Port typing helpers: exec(flow) vs data(type)
export function normalizePortsFromElement(el){
  const coerce = (map, dir) => {
    const arr = [];
    if (map && typeof map === 'object') {
      for (const k of Object.keys(map)) {
        const v = String(map[k]||'').toLowerCase();
        if (v === 'flow' || v === 'exec') {
          arr.push({ name: k, kind: 'flow' });
        } else {
          arr.push({ name: k, kind: 'data', type: (v||'any') });
        }
      }
    }
    if (!arr.length) {
      arr.push(dir==='in' ? { name:'In',  kind:'data', type:'any' }
                          : { name:'Out', kind:'data', type:'any' });
    }
    return arr;
  };
  return {
    inputs:  coerce(el.inputs,  'in'),
    outputs: coerce(el.outputs, 'out'),
  };
}

export function pinsCompatible(outPin, inPin){
  if (!outPin || !inPin) return false;
  if (outPin.kind !== inPin.kind) return false;
  if (outPin.kind === 'flow') return true;
  const a = (outPin.type||'any').toLowerCase();
  const b = (inPin.type ||'any').toLowerCase();
  return a === 'any' || b === 'any' || a === b;
}
