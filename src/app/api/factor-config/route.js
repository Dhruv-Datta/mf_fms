import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const FILE_PATH = path.join(process.cwd(), 'data', 'factor-config.json');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
  } catch {
    return { factors: [], importanceWeights: { Volatility: 0.9 }, exposures: {} };
  }
}

function writeConfig(config) {
  const dir = path.dirname(FILE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(config, null, 2));
}

export async function GET() {
  return NextResponse.json(readConfig());
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const config = readConfig();

    if (body.factors !== undefined) {
      config.factors = body.factors;
    }
    if (body.importanceWeights !== undefined) {
      config.importanceWeights = body.importanceWeights;
    }
    if (body.exposures !== undefined) {
      for (const [ticker, factors] of Object.entries(body.exposures)) {
        config.exposures[ticker] = { ...(config.exposures[ticker] || {}), ...factors };
      }
    }

    writeConfig(config);
    return NextResponse.json(config);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
