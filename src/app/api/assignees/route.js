import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const TABLE = 'app_settings';
const KEY = 'assignees';

// GET - load saved assignees [{name, color}]
export async function GET() {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('key', KEY)
      .single();

    if (error && error.code === 'PGRST116') {
      return NextResponse.json({ assignees: [] });
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let assignees = [];
    try {
      assignees = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    } catch {
      assignees = [];
    }

    return NextResponse.json({ assignees: Array.isArray(assignees) ? assignees : [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT - save assignees list
export async function PUT(req) {
  try {
    const { assignees } = await req.json();

    if (!Array.isArray(assignees)) {
      return NextResponse.json({ error: 'assignees must be an array' }, { status: 400 });
    }

    const row = {
      key: KEY,
      value: JSON.stringify(assignees),
    };

    const { data, error } = await supabase
      .from(TABLE)
      .upsert(row, { onConflict: 'key' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let saved = [];
    try {
      saved = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    } catch {
      saved = assignees;
    }

    return NextResponse.json({ assignees: saved });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
