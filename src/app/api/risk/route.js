import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

function readFactorConfig() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'factor-config.json');
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return { factors: [], importanceWeights: { Volatility: 0.9 }, exposures: {} };
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { holdings } = body;
    if (!holdings || !holdings.length) {
      return NextResponse.json({ error: 'holdings required' }, { status: 400 });
    }

    const factorConfig = readFactorConfig();
    const scriptPath = path.join(process.cwd(), 'scripts', 'fetch_risk.py');
    const holdingsJson = JSON.stringify(holdings);
    const factorJson = JSON.stringify(factorConfig);

    // Write to temp files to avoid shell escaping issues
    const tmpDir = path.join(process.cwd(), 'data');
    const holdingsFile = path.join(tmpDir, '.tmp_holdings.json');
    const factorFile = path.join(tmpDir, '.tmp_factors.json');

    fs.writeFileSync(holdingsFile, holdingsJson);
    fs.writeFileSync(factorFile, factorJson);

    const cmd = `python3 "${scriptPath}" "$(cat '${holdingsFile}')" "$(cat '${factorFile}')"`;
    const { stdout } = await execAsync(cmd, { timeout: 120000 });

    // Clean up temp files
    try { fs.unlinkSync(holdingsFile); } catch {}
    try { fs.unlinkSync(factorFile); } catch {}

    const result = JSON.parse(stdout);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
