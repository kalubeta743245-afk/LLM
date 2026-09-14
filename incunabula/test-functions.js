function withTimeout(p, ms, label) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' timeout')), ms)),
  ]);
}

async function main() {
  const models = require('./netlify/functions/models');
  const chat = require('./netlify/functions/chat');

  for (const id of ['tokenrouter', 'nvidia', 'openrouter']) {
    try {
      const mRes = await withTimeout(models.handler({ httpMethod: 'POST', body: JSON.stringify({ providerId: id }) }), 20000, id + ' MODELS');
      const mData = JSON.parse(mRes.body);
      console.log('MODELS', id, '->', mRes.statusCode, mData.ok ? `count=${mData.count} ms=${mData.ms}` : 'ERR ' + mData.error);
    } catch (e) {
      console.log('MODELS', id, '-> THREW', e.message);
    }

    const def = { tokenrouter: 'openai/gpt-5.4-nano', nvidia: 'meta/llama-3.3-70b-instruct', openrouter: 'deepseek/deepseek-v4-flash-0731' }[id];
    try {
      const cRes = await withTimeout(chat.handler({
        httpMethod: 'POST',
        body: JSON.stringify({ providerId: id, model: def, messages: [{ role: 'user', content: 'Reply with exactly: pong' }], maxTokens: 128 }),
      }), 25000, id + ' CHAT');
      const cData = JSON.parse(cRes.body);
      console.log('CHAT', id, '->', cRes.statusCode, cData.ok ? `ms=${cData.ms} content=${JSON.stringify(cData.content)}` : 'ERR ' + cData.error);
    } catch (e) {
      console.log('CHAT', id, '-> THREW', e.message);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });