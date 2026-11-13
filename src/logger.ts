export const log = (level: 'info' | 'warn' | 'error', message: string, context: Record<string, unknown> = {}) => {
  const safe = { level, message, time: new Date().toISOString(), ...context };
  console.log(JSON.stringify(safe));
};
