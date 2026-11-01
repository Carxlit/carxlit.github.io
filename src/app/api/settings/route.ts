import { NextRequest, NextResponse } from 'next/server';
import { 
  getStoredCredentials, 
  saveStoredCredentials, 
  validateFacebookToken 
} from '@/lib/config/credentials-manager';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const creds = getStoredCredentials();
    return NextResponse.json({
      success: true,
      credentials: {
        facebookPageId: creds.facebookPageId || '1418440394683304',
        facebookAccessToken: creds.facebookAccessToken ? creds.facebookAccessToken : '',
        telegramToken: creds.telegramToken || '',
        telegramChatId: creds.telegramChatId || '',
        blueskyHandle: creds.blueskyHandle || '',
        blueskyPassword: creds.blueskyPassword || '',
        brandName: creds.brandName || 'Punto Ciego',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al obtener credenciales' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, credentials } = body;

    // Acción 1: Validar únicamente el token de Facebook en vivo
    if (action === 'validate_facebook') {
      const token = credentials?.facebookAccessToken;
      const pageId = credentials?.facebookPageId || '1418440394683304';

      if (!token) {
        return NextResponse.json(
          { success: false, error: 'Se requiere ingresar un token de Facebook para validar.' },
          { status: 400 }
        );
      }

      const validation = await validateFacebookToken(token, pageId);
      return NextResponse.json({
        success: validation.valid,
        validation,
      });
    }

    // Acción 2: Guardar credenciales (con validación opcional de Facebook)
    let finalFacebookToken = credentials?.facebookAccessToken;

    if (finalFacebookToken) {
      const pageId = credentials?.facebookPageId || '1418440394683304';
      const validation = await validateFacebookToken(finalFacebookToken, pageId);

      if (!validation.valid) {
        return NextResponse.json(
          { 
            success: false, 
            error: `El token de Facebook no es válido: ${validation.error}`,
            validation 
          },
          { status: 400 }
        );
      }

      // Si Meta resolvió automáticamente un Page Token a partir de un User Token, usamos el de página
      if (validation.resolvedToken) {
        finalFacebookToken = validation.resolvedToken;
      }
    }

    const saved = saveStoredCredentials({
      facebookPageId: credentials?.facebookPageId,
      facebookAccessToken: finalFacebookToken,
      telegramToken: credentials?.telegramToken,
      telegramChatId: credentials?.telegramChatId,
      blueskyHandle: credentials?.blueskyHandle,
      blueskyPassword: credentials?.blueskyPassword,
      brandName: credentials?.brandName,
    });

    return NextResponse.json({
      success: true,
      message: 'Credenciales guardadas y sincronizadas exitosamente en el servidor.',
      credentials: saved,
    });
  } catch (error: any) {
    console.error('[API /api/settings POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al guardar credenciales' },
      { status: 500 }
    );
  }
}

