const memberCodes = new Set(['966','967','780','1001','344','721','430','893','931'].map(id => 'UNLOCK_' + id))
export const isMemberUnlock = (code: unknown) => typeof code === 'string' && memberCodes.has(code.trim().toUpperCase())
