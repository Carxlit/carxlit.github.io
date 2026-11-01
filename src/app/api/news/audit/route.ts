import { NextResponse } from 'next/server';
import { runFullNewsroomAudit } from '@/lib/agents/newsroom-auditor';
import { isLocalCloudMode, CLOUD_MODE_MESSAGE } from '@/lib/config/run-mode';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auditReport = await runFullNewsroomAudit();
    return NextResponse.json({
      success: true,
      report: auditReport,
    });
  } catch (error: any) {
    console.error('[API /api/news/audit] Error ejecutando auditoría:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error en auditoría' },
      { status: 500 }
    );
  }
}

export async function POST() {
  if (isLocalCloudMode()) {
    return NextResponse.json({ success: true, cloudMode: true, message: CLOUD_MODE_MESSAGE });
  }
  try {
    const auditReport = await runFullNewsroomAudit();
    return NextResponse.json({
      success: true,
      report: auditReport,
      message: `Auditoría completada. Puntuación de salud: ${auditReport.overallHealthScore}/100. Elementos reparados: ${auditReport.healedCount}.`,
    });
  } catch (error: any) {
    console.error('[API /api/news/audit POST] Error ejecutando auto-sanación:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error en auto-sanación' },
      { status: 500 }
    );
  }
}

