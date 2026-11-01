import { NextResponse } from 'next/server';
import { runAutonomousNewsroomCycle } from '@/lib/agents/autonomous-newsroom';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await runAutonomousNewsroomCycle();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /api/news/auto-pilot] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error en ciclo autónomo' },
      { status: 500 }
    );
  }
}
