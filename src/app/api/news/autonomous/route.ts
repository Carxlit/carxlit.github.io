import { NextRequest, NextResponse } from 'next/server';
import { 
  runAutonomousNewsroomCycle, 
  getDailyEditorialReport, 
  getAutonomousConfig,
  saveAutonomousConfig,
  DEFAULT_AUTONOMOUS_CONFIG,
  AutonomousConfig 
} from '@/lib/agents/autonomous-newsroom';

import { isLocalCloudMode, CLOUD_MODE_MESSAGE } from '@/lib/config/run-mode';

export const dynamic = 'force-dynamic';

/**
 * GET /api/news/autonomous
 * Devuelve el estado actual de la redacción autónoma y su configuración
 */
export async function GET() {
  try {
    const config = getAutonomousConfig();
    const report = getDailyEditorialReport(config);
    return NextResponse.json({
      success: true,
      report,
      config,
    });
  } catch (error: any) {
    console.error('[API /api/news/autonomous GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al obtener estado editorial autónomo' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/news/autonomous
 * Ejecuta un ciclo del Newsroom Autónomo o actualiza la configuración
 */
export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body vacío permitido
    }

    // Si la acción es guardar configuración
    if (body.action === 'save_config' && body.config) {
      const updatedConfig = saveAutonomousConfig(body.config);
      const report = getDailyEditorialReport(updatedConfig);
      return NextResponse.json({
        success: true,
        message: `Configuración guardada: cuota diaria fijada en ${updatedConfig.maxDailyPosts} posts.`,
        config: updatedConfig,
        report,
      });
    }

    if (isLocalCloudMode()) {
      return NextResponse.json({
        success: true,
        actionTaken: 'cloud_mode',
        message: CLOUD_MODE_MESSAGE,
        report: getDailyEditorialReport(getAutonomousConfig()),
      });
    }

    const currentConfig = getAutonomousConfig();
    const config: AutonomousConfig = {
      ...currentConfig,
      ...(body.config || {}),
    };

    const result = await runAutonomousNewsroomCycle(config);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /api/news/autonomous POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error en ciclo autónomo' },
      { status: 500 }
    );
  }
}

