import OpenAI from 'openai';
import { Together } from 'together-ai';
import fs from 'fs';
import path from 'path';

const ROOT = '.';
// Load env
for (const envFile of ['.env.local', '.env']) {
  const p = path.join(ROOT, envFile);
  if (fs.existsSync(p)) {
    fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
      const t = line.trim();
      if (t && !t.startsWith('#')) {
        const eq = t.indexOf('=');
        if (eq > 0) {
          const k = t.slice(0, eq).trim();
          const v = t.slice(eq + 1).trim().replace(/^"|"$/g, '');
          process.env[k] = process.env[k] || v;
        }
      }
    });
  }
}

async function testOpenAIModel(model) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 10,
    });
    console.log(`✅ OpenAI ${model} success:`, response.choices[0].message.content.trim());
    return true;
  } catch (err) {
    console.log(`❌ OpenAI ${model} failed:`, err.message);
    return false;
  }
}

async function testTogetherModel(model) {
  try {
    const together = new Together({ apiKey: process.env.TOGETHER_API_KEY });
    const response = await together.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 10,
    });
    console.log(`✅ Together ${model} success:`, response.choices[0].message.content.trim());
    return true;
  } catch (err) {
    console.log(`❌ Together ${model} failed:`, err.message);
    return false;
  }
}

async function run() {
  console.log('Testing OpenAI models...');
  await testOpenAIModel('gpt-3.5-turbo');
  await testOpenAIModel('gpt-4');
  await testOpenAIModel('gpt-4o');

  console.log('\nTesting Together models...');
  await testTogetherModel('meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo');
  await testTogetherModel('meta-llama/Meta-Llama-3-70b-instruct');
  await testTogetherModel('mistralai/Mixtral-8x7B-Instruct-v0.1');
  await testTogetherModel('Qwen/Qwen2.5-72B-Instruct');
}

run();
